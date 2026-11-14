/* cspell: disable */
import {
  FormulaContext, FormulaError, ValueKind,
  type AcceptError, type Omittable, type Scalar, type NoLift, type IRange, type IFormulaContext
} from '@sheetxl/primitives';

import { MAX_TRIG_ARGUMENT, x87Cos, x87Sin } from '../_utils/X87';

/**
 * Converts real and imaginary coefficients into a complex number.
 * @param realNum is the real coefficient of the complex number.
 * @param iNum is the imaginary coefficient of the complex number.
 * @param suffix is the suffix for the imaginary component of the complex number.
 */
export function COMPLEX(
  realNum: NoLift<Omittable<AcceptError<Scalar>>>,
  iNum: NoLift<Omittable<AcceptError<Scalar>>>,
  suffix: NoLift<AcceptError<string>>='i'
): Scalar {
  // The SUFFIX is checked before either coefficient is read: `COMPLEX(NA(),4,"zz")` is #VALUE! and
  // not the #N/A the first slot carries.
  if (FormulaError.isError(suffix)) throw suffix;
  // EMPTY suffix means "i".
  if (!suffix) suffix = 'i';
  if (suffix !== 'i' && suffix !== 'j') {
    throw FormulaError.BuiltIn.Value;
  }
  const real = coefficientArgument(realNum);
  const i = coefficientArgument(iNum);
  // Zero is the TEXT "0", not the number — every complex result is text, including this one, and
  // `ISTEXT(COMPLEX(0,0))` says so.
  if (real === 0 && i === 0) {
    return FormulaContext.toText(0);
  }
  if (real === 0) {
    if (i === 1) {
      return suffix;
    }
    if (i === -1) {
      return '-' + suffix;
    }
    return FormulaContext.toText(i, _literal) + suffix;
  }
  if (i === 0) {
    return FormulaContext.toText(real, _literal);
  }

  let sign = (i > 0) ? '+' : '';
  if (i === 1) {
    return FormulaContext.toText(real, _literal) + sign + suffix;
  }
  if (i === -1) {
    return FormulaContext.toText(real, _literal) + sign + '-' + suffix;
  }
  return FormulaContext.toText(real, _literal) + sign + FormulaContext.toText(i, _literal) + suffix;
}

/**
 * Returns the absolute value (modulus) of a complex number
 * @param inumber is a complex number for which you want the absolute value
 */
export function IMABS(inumber: NoLift<Scalar>): number {
  const { real, im } = parseIM(inumber);
  // The SCALED magnitude, not `sqrt(r^2 + i^2)`: squaring overflows a component near the top of
  // the range long before the answer does, and `IMABS("1E307+1E307i")` is 1.4142135623731E+307
  // where the naive form is #NUM!.
  return Math.hypot(real, im);
}

/**
 * Returns the imaginary coefficient of a complex number
 * @param inumber is a complex number for which you want the imaginary coefficient
 */
export function IMAGINARY(inumber: NoLift<Scalar>): number {
  return parseIM(inumber).im;
}

/**
 * Returns the argument q, an angle expressed in radians
 * @param inumber is a complex number for which you want the argument
 */
export function IMARGUMENT(inumber: NoLift<Scalar>): number {
  const { real, im } = parseIM(inumber);
  // The ORIGIN has no argument, and IMARGUMENT is the one reader that refuses it — the logarithms
  // and the square root take {@link imArgument}, whose 0 there is never the answer.
  if (real === 0 && im === 0) throw FormulaError.BuiltIn.Div0!;
  return imArgument(real, im);
}

/**
 * The argument of `real + im i`, over the whole plane.
 *
 * @remarks
 * Two quadrants of it are what `Math.atan(im / real)` cannot see: the quotient loses the sign of
 * the real part, so a NEGATIVE real part reflects the angle into the wrong half and the
 * logarithms come back on the wrong branch — `IMLN("-3+4i")` is 1.6094379124341+2.21429743558818i
 * and not the …−0.927295218001612i a bare arctangent gives. It is `atan2`, spelled out because
 * the axes are exact values rather than limits.
 */
const imArgument = (real: number, im: number): number => {
  if (real === 0 && im === 0) return 0;
  if (real === 0) return im > 0 ? Math.PI / 2 : -Math.PI / 2;
  if (im === 0) return real > 0 ? 0 : Math.PI;
  if (real > 0) return Math.atan(im / real);
  return im > 0 ? Math.atan(im / real) + Math.PI : Math.atan(im / real) - Math.PI;
};

/**
 * `ln|z|`, on the NAIVE magnitude.
 *
 * @remarks
 * Not {@link IMABS}'s scaled one: the square of a component near the top of the range overflows,
 * and Excel's logarithms refuse there rather than answering the 708 the scaled form would give
 * (`IMLN("1E307+1E307i")` is `#NUM!` while `IMABS` of the same number answers). The origin lands
 * on the same refusal from the other end, `ln 0` being `-Infinity`.
 */
const _logMagnitude = (real: number, im: number): number => {
  const magnitude = Math.log(Math.sqrt(real * real + im * im));
  if (!Number.isFinite(magnitude)) throw FormulaError.BuiltIn.Num;
  return magnitude;
};

/**
 * Returns the complex conjugate of a complex number
 * @param inumber is a complex number for which you want the conjugate
 */
export function IMCONJUGATE(inumber: NoLift<Scalar>): Scalar {
  const { real, im, unit } = parseIM(inumber);
  return (im !== 0) ? COMPLEX(real, -im, unit) : FormulaContext.toText(real);
}

/**
 * Raw-component trig/hyperbolic forms. Composition (IMCOT = 1/tan, IMSEC = 1/cos, ...) must stay
 * at full double precision; only the final COMPLEX call rounds.
 *
 * @remarks
 * The circular half is Excel's own — {@link x87Sin} and {@link x87Cos}, which reduce against pi
 * rounded to 64 bits and not against pi. Near a multiple of pi/2 that is a FOURTH-digit
 * difference, not a last-bit one: `IMCOS("1.5707963267949")` is -3.49145625605507E-15 in Excel
 * where the platform library gives -3.4914813388431334E-15.
 */
type IMParts = { real: number, im: number };
/**
 * The hyperbolic pair, as the EXPONENTIALS rather than as the library's own.
 *
 * @remarks
 * Excel takes the exponentials: `IMCSCH("10%")` is 9.9833527572961, the
 * reciprocal of a `sinh(0.1)` an ulp above the correctly rounded one, and that ulp is the
 * difference between these two lines and `Math.sinh`. The tangent pair is the exception and takes
 * the library's — see {@link _tanIM}.
 */
const _cosh = (x: number): number => (Math.exp(x) + Math.exp(-x)) / 2;
/**
 * The sine of the HYPERBOLIC names. Under {@link SinhExponentialFloor} the exponentials cancel
 * and the function is taken whole: `IMSINH("1E-16")` is 1E-16 and `IMCSCH("1E-20")` is 1E+20.
 */
const _sinh = (x: number): number =>
  Math.abs(x) < SinhExponentialFloor ? Math.sinh(x) : (Math.exp(x) - Math.exp(-x)) / 2;
/**
 * The sine the CIRCULAR names take of their imaginary part: one exponential and its reciprocal,
 * which cancel to nothing where the argument is under an ulp of one — `IMSIN("1E-16i")` is 0 and
 * `IMSIN("1E-15i")` is 1.11022302462516E-15i.
 */
const _sinhOfReciprocal = (x: number): number => {
  const e = Math.exp(x);
  return (e - 1 / e) / 2;
};
/** Where the hyperbolic names stop taking their sine as two exponentials; between 0.01 and 0.03. */
const SinhExponentialFloor = 0.02;
const _cosIM = (real: number, im: number): IMParts =>
  ({ real: x87Cos(real) * _cosh(im), im: -x87Sin(real) * _sinhOfReciprocal(im) });
const _sinIM = (real: number, im: number): IMParts =>
  ({ real: x87Sin(real) * _cosh(im), im: x87Cos(real) * _sinhOfReciprocal(im) });
const _coshIM = (real: number, im: number): IMParts =>
  ({ real: x87Cos(im) * _cosh(real), im: x87Sin(im) * _sinh(real) });
const _sinhIM = (real: number, im: number): IMParts =>
  ({ real: x87Cos(im) * _sinh(real), im: x87Sin(im) * _cosh(real) });
const _oneIM: IMParts = { real: 1, im: 0 };
const _divIM = (n: IMParts, d: IMParts): IMParts => {
  if (d.real === 0 && d.im === 0) throw FormulaError.BuiltIn.Num;
  // A divisor ON an axis divides once rather than through the modulus, which would round the
  // answer a second time: `IMSECH("10%")` is 0.995020748953227 and not the …226 below.
  if (n.im === 0 && d.im === 0) return { real: n.real / d.real, im: 0 };
  if (n.im === 0 && d.real === 0) return { real: 0, im: -n.real / d.im };
  // A divisor that ran past the top of the range makes the quotient ZERO rather than the NaN the
  // arithmetic would give: `IMSEC("1E307+1E307i")` is 0, the reciprocal of a cosine
  // whose components both overflowed.
  if (!Number.isFinite(d.real) || !Number.isFinite(d.im)) return { real: 0, im: 0 };
  const den = d.real * d.real + d.im * d.im;
  return { real: (n.real * d.real + n.im * d.im) / den, im: (n.im * d.real - n.real * d.im) / den };
};

/**
 * The bound the tangent pair holds its ARGUMENT to.
 *
 * @remarks
 * `MAX_TRIG_ARGUMENT` is the same refusal `SIN`, `COS` and `TAN` make on the worksheet, and the
 * complex family inherits it: `IMTAN("1E10")` is `#NUM!` where `IMTAN("800")` answers. It is the
 * argument that is held to it and not the doubled angle the identity below evaluates —
 * `IMCOT("134217727+1i")` answers and `IMCOT("134217728+1i")` does not.
 */
const _requireTrigArgument = (real: number): void => {
  if (Math.abs(real) >= MAX_TRIG_ARGUMENT) throw FormulaError.BuiltIn.Num;
};

/**
 * tan and cot, which take three forms and not one.
 *
 * @remarks
 * ON THE REAL AXIS the answer has one component and is the plain quotient of the two real
 * functions. That is the branch a half-angle identity cannot serve: its denominator
 * `cosh 2y − cos 2x` cancels to zero at `y = 0` wherever `cos 2x` rounds to 1, so `IMCOT` at pi
 * would be `#NUM!` where the quotient answers −309488357722796.
 *
 * OFF IT the half-angle identity is what Excel's digits agree with —
 * `tan(x+yi) = (sin 2x + i sinh 2y)/(cos 2x + cosh 2y)`, and cot with the sign of the imaginary
 * part turned over and the denominator's terms swapped. A quotient of the complex sine and cosine
 * is two digits short in the small component (`IMCOT("3+4i")`), and the cancellation the
 * denominator keeps is Excel's own: `IMCOT("1E-16i")` is `#NUM!`.
 *
 * FAR OUT along the imaginary axis both hyperbolic terms have run past the range and the identity
 * leaves `Infinity/Infinity`. `tanh y` is exactly 1 there and says what the limit is:
 * `IMTAN("0+800i")` is `i`. That saturation is also what lets the pair answer past
 * {@link MAX_TRIG_ARGUMENT}, the circular factor having dropped out of the answer.
 */
const _tanIM = (real: number, im: number): IMParts => {
  const saturated = Math.tanh(im);
  if (Math.abs(saturated) === 1) return { real: 0, im: saturated };
  _requireTrigArgument(real);
  if (im === 0) return { real: x87Sin(real) / x87Cos(real), im: 0 };
  const den = x87Cos(2 * real) + Math.cosh(2 * im);
  if (den === 0) throw FormulaError.BuiltIn.Num;
  return { real: x87Sin(2 * real) / den, im: Math.sinh(2 * im) / den };
};
const _cotIM = (real: number, im: number): IMParts => {
  const saturated = Math.tanh(im);
  if (Math.abs(saturated) === 1) return { real: 0, im: -saturated };
  if (im === 0) {
    // Past the bound the family parts company: `IMCOT("1E10")` is 0 where every one of its five
    // siblings is `#NUM!` — and so is IMCOT itself one step OFF the real axis, which is why this
    // answer sits inside the axis branch. It holds at 2^27, 1E9 and 1E10 alike.
    if (Math.abs(real) >= MAX_TRIG_ARGUMENT) return { real: 0, im: 0 };
    const sin = x87Sin(real);
    if (sin === 0) throw FormulaError.BuiltIn.Num;
    return { real: x87Cos(real) / sin, im: 0 };
  }
  _requireTrigArgument(real);
  const den = Math.cosh(2 * im) - x87Cos(2 * real);
  if (den === 0) throw FormulaError.BuiltIn.Num;
  return { real: x87Sin(2 * real) / den, im: -Math.sinh(2 * im) / den };
};

/**
 * The bound on the circular argument, where the arithmetic has not already answered.
 *
 * @remarks
 * The order matters: at `"1E307+1E307i"` the hyperbolic factor overflows and the
 * reciprocal names still answer 0, so the refusal there belongs to the OVERFLOW and the argument
 * is never held to its range. Only a result whose components are both finite is.
 */
const _circular = (angle: number, parts: IMParts): IMParts => {
  if (Number.isFinite(parts.real) && Number.isFinite(parts.im) && Math.abs(angle) >= MAX_TRIG_ARGUMENT) {
    throw FormulaError.BuiltIn.Num;
  }
  return parts;
};

/** A component past the top of the range is `#NUM!` wherever it IS the answer. */
const _finite = (parts: IMParts): IMParts => {
  if (!Number.isFinite(parts.real) || !Number.isFinite(parts.im)) throw FormulaError.BuiltIn.Num;
  return parts;
};

/**
 * A COEFFICIENT slot of `COMPLEX`: a blank CELL is zero, an OMITTED argument is `#N/A`, and an
 * error arrives as a value because the SUFFIX is validated ahead of both.
 */
const coefficientArgument = (value: Scalar | undefined): number => {
  if (FormulaError.isError(value)) throw value;
  if (value === undefined) throw FormulaError.BuiltIn.NA;
  if (value === null) return 0;
  return FormulaContext.parseAsNumber(value);
};

/**
 * Returns the cosine of a complex number
 * @param inumber is a complex number for which you want the cosine
 */
export function IMCOS(inumber: NoLift<Scalar>): Scalar {
  const { real, im, unit } = parseIM(inumber);
  const r = _finite(_circular(real, _cosIM(real, im)));
  return COMPLEX(r.real, r.im, unit);
}

/**
 * Returns the hyperbolic cosine of a complex number
 * @param inumber is a complex number for which you want the hyperbolic cosine
 */
export function IMCOSH(inumber: NoLift<Scalar>): Scalar {
  const { real, im, unit } = parseIM(inumber);
  const r = _finite(_circular(im, _coshIM(real, im)));
  return COMPLEX(r.real, r.im, unit);
}

/**
 * Returns the cotangent of a complex number
 * @param inumber is a complex number for which you want the cotangent
 */
export function IMCOT(inumber: NoLift<Scalar>): Scalar {
  const { real, im, unit } = parseIM(inumber);
  const r = _cotIM(real, im);
  return COMPLEX(r.real, r.im, unit);
}

/**
 * Returns the hyperbolic cotangent of a complex number.
 * @param inumber is a complex number for which you want the hyperbolic cotangent.
 * @category Sheets
 */
export function IMCOTH(inumber: Scalar): Scalar {
  const { real, im, unit } = parseIM(inumber);
  const r = _divIM(_coshIM(real, im), _sinhIM(real, im));
  return COMPLEX(r.real, r.im, unit);
}

/**
 * Returns the cosecant of a complex number
 * @param inumber is a complex number for which you want the cosecant
 */
export function IMCSC(inumber: NoLift<Scalar>): Scalar {
  const { real, im, unit } = parseIM(inumber);
  const r = _divIM(_oneIM, _circular(real, _sinIM(real, im)));
  return COMPLEX(r.real, r.im, unit);
}

/**
 * Returns the hyperbolic cosecant of a complex number
 * @param inumber is a complex number for which you want the hyperbolic cosecant
 */
export function IMCSCH(inumber: NoLift<Scalar>): Scalar {
  const { real, im, unit } = parseIM(inumber);
  const r = _divIM(_oneIM, _circular(im, _sinhIM(real, im)));
  return COMPLEX(r.real, r.im, unit);
}

/**
 * Returns the quotient of two complex numbers
 * @param inumber1 is the complex numerator or dividend
 * @param inumber2 is the complex denominator or divisor
 */
export function IMDIV(
  inumber1: NoLift<Omittable<AcceptError<Scalar>>>,
  inumber2: NoLift<Omittable<AcceptError<Scalar>>>
): Scalar {
  const res1: IM = parseIM(complexArgument(inumber1)); // left to right
  const real1: number = res1.real;
  const im1: number = res1.im;
  const unit1: string = res1.unit;

  const res2:IM = parseIM(complexArgument(inumber2));
  const real2: number = res2.real;
  const im2: number = res2.im;
  const unit2: string = res2.unit;

  if (real2 === 0 && im2 === 0 || unit1 !== unit2) throw FormulaError.BuiltIn.Num;

  const unit = unit1; // not needed
  const denominator = Math.pow(real2, 2) + Math.pow(im2, 2);
  const quotient = _finite({
    real: (real1 * real2 + im1 * im2) / denominator,
    im: (im1 * real2 - real1 * im2) / denominator
  });
  return COMPLEX(quotient.real, quotient.im, unit);
}

/**
 * Returns the exponential of a complex number
 * @param inumber is a complex number for which you want the exponential
 */
export function IMEXP(inumber: NoLift<Scalar>): Scalar {
  const { real, im, unit } = parseIM(inumber);
  let e: number = Math.exp(real);
  // An exponential past the top of the range CLAMPS rather than refusing — `IMEXP("1E3+2E-3i")`
  // is 1.79768953947724E+308+3.59538387280093E+305i, which is DBL_MAX times the cosine and the
  // sine to the last digit, and the same answer comes back at 710, 1E4 and 1E5. On the REAL axis
  // it refuses instead, and so does an imaginary part small enough to make one component
  // vanish — that half is not modelled here.
  if (!Number.isFinite(e)) {
    if (im === 0) throw FormulaError.BuiltIn.Num;
    e = Number.MAX_VALUE;
  }
  const r = _finite(_circular(im, { real: e * x87Cos(im), im: e * x87Sin(im) }));
  return COMPLEX(r.real, r.im, unit);
}

/**
 * Returns the exponential of a complex number
 * @param inumber is a complex number for which you want the exponential
 */
export function IMLN(inumber: NoLift<Scalar>): Scalar {
  const { real, im, unit } = parseIM(inumber);
  return COMPLEX(_logMagnitude(real, im), imArgument(real, im), unit);
}

/**
 * Returns the logarithm of a complex number to a specified base.
 * @param inumber is a complex number for which you want the logarithm.
 * @param base is the base of the logarithm. Default is 10.
 * @category Sheets
 */
export function IMLOG(
  inumber: Scalar,
  base: number = 10
): Scalar {
  const ln = IMLN(inumber);
  if (FormulaError.isError(ln)) return ln;
  if (base <= 0 || base === 1) return Number.NaN; // #NUM!;
  return IMDIV(ln, Math.log(base));
}

/**
 * Returns the base-10 logarithm of a complex number
 * @param inumber is a complex number for which you want the common logarithm
 */
export function IMLOG10(inumber: NoLift<Scalar>): Scalar {
  const { real, im, unit } = parseIM(inumber);
  return COMPLEX(_logMagnitude(real, im) / Math.LN10, imArgument(real, im) / Math.LN10, unit);
}

/**
 * Returns the base-2 logarithm of a complex number
 * @param inumber is a complex number for which you want the base-2 logarithm
 */
export function IMLOG2(inumber: NoLift<Scalar>): Scalar {
  const { real, im, unit } = parseIM(inumber);
  return COMPLEX(_logMagnitude(real, im) / Math.LN2, imArgument(real, im) / Math.LN2, unit);
}

/**
 * Returns the base-2 logarithm of a complex number
 * @param inumber is a complex number for which you want the base-2 logarithm
 */
export function IMPOWER(
  inumber: NoLift<Omittable<AcceptError<Scalar>>>,
  number: NoLift<Omittable<AcceptError<Scalar>>>
): Scalar {
  const { real, im, unit } = parseIM(complexArgument(inumber)); // left to right
  const num: number = FormulaContext.parseAsNumber(complexArgument(number) ?? 0);

  const magnitude: number = Math.sqrt(real * real + im * im);
  // ZERO has no logarithm and is answered outright: any positive power of it is zero, and both
  // `IMPOWER("0","0")` and a negative power are #NUM!. The test is on the COMPONENTS and not on
  // the magnitude, whose square underflows well before they do — `IMPOWER("1E-307","1E307")` is
  // #NUM! and would otherwise take this branch.
  if (real === 0 && im === 0) {
    if (num > 0) return COMPLEX(0, 0, unit);
    throw FormulaError.BuiltIn.Num;
  }
  // The SCALE is the refusal, not the power: `IMPOWER("1E-307","1E307")` underflows to a clean 0
  // and Excel refuses it, which is the exponent times the log running off the range rather than
  // the answer doing so.
  const scale: number = num * Math.log(magnitude);
  if (!Number.isFinite(scale)) throw FormulaError.BuiltIn.Num;
  const p: number = Math.pow(magnitude, num);
  if (!Number.isFinite(p)) throw FormulaError.BuiltIn.Num;

  const angle: number = num * imArgument(real, im);
  const r = _circular(angle, { real: p * x87Cos(angle), im: p * x87Sin(angle) });
  return COMPLEX(r.real, r.im, unit);
}

/**
 * Returns the product of 1 to 255 complex numbers
 * @param inumber are from 1 to 255 complex numbers to multiply.
 */
export function IMPRODUCT(inumber: AcceptError<IRange>[]): Scalar {
  const members = complexMembers(inumber);
  if (members.length === 0) return COMPLEX(0, 0, 'i');

  // The running product is kept as numbers and written once: a product read back from its own
  // text at every step is rounded to fifteen digits that many times.
  let unit: string | undefined;
  let real = 1;
  let im = 0;
  for (let i = 0; i < members.length; i++) {
    const item = members[i]!;
    unit = sharedUnit(unit, item);
    const product = {
      real: real * item.real - im * item.im,
      im: real * item.im + im * item.real
    };
    // A component past the top of the range is #VALUE! here and not the #NUM! the rest of the
    // family raises — `IMPRODUCT("1E307+1E307i","1E307+1E307i")` is `#VALUE!`.
    if (!Number.isFinite(product.real) || !Number.isFinite(product.im)) throw FormulaError.BuiltIn.Value;
    real = product.real;
    im = product.im;
  }
  return COMPLEX(real, im, unit ?? 'i');
}

/**
 * Returns the real coefficient of a complex number
 * @param inumber is a complex number for which you want the real coefficient
 */
export function IMREAL(inumber: NoLift<Scalar>): number {
  return parseIM(inumber).real;
}

/**
 * Returns the secant of a complex number
 * @param inumber is a complex number for which you want the secant
 */
export function IMSEC(inumber: NoLift<Scalar>): Scalar {
  const { real, im, unit } = parseIM(inumber);
  const r = _divIM(_oneIM, _circular(real, _cosIM(real, im)));
  return COMPLEX(r.real, r.im, unit);
}

/**
 * Returns the hyperbolic secant of a complex number
 * @param inumber is a complex number for which you want the hyperbolic secant
 */
export function IMSECH(inumber: NoLift<Scalar>): Scalar {
  const { real, im, unit } = parseIM(inumber);
  const r = _divIM(_oneIM, _circular(im, _coshIM(real, im)));
  return COMPLEX(r.real, r.im, unit);
}

/**
 * Returns the sine of a complex number
 * @param inumber is a complex number for which you want the sine
 */
export function IMSIN(inumber: NoLift<Scalar>): Scalar {
  const { real, im, unit } = parseIM(inumber);
  const r = _finite(_circular(real, _sinIM(real, im)));
  return COMPLEX(r.real, r.im, unit);
}

/**
 * Returns the hyperbolic sine of a complex number
 * @param inumber is a complex number for which you want the hyperbolic sine
 */
export function IMSINH(inumber: NoLift<Scalar>): Scalar {
  const { real, im, unit } = parseIM(inumber);
  const r = _finite(_circular(im, _sinhIM(real, im)));
  return COMPLEX(r.real, r.im, unit);
}

/**
 * Returns the square root of a complex number
 * @param inumber is a complex number for which you want the square root
 */
export function IMSQRT(inumber: NoLift<Scalar>): Scalar {
  const { real, im, unit } = parseIM(inumber);
  // The NAIVE magnitude, for the same reason the logarithms take it: `IMSQRT("1E307+1E307i")` is
  // #NUM! where the scaled form would answer. The origin is not a refusal here — the root of
  // zero is zero, and the argument's 0 carries it.
  const power: number = Math.sqrt(Math.sqrt(real * real + im * im));
  if (!Number.isFinite(power)) throw FormulaError.BuiltIn.Num;
  const argument: number = imArgument(real, im) / 2;
  return COMPLEX(power * x87Cos(argument), power * x87Sin(argument), unit);
}

/**
 * Returns the difference of two complex numbers
 * @param inumber1 is the complex number from which to subtract inumber2
 * @param inumber2 is the complex number to subtract from inumber1
 */
export function IMSUB(
  inumber1: NoLift<Omittable<AcceptError<Scalar>>>,
  inumber2: NoLift<Omittable<AcceptError<Scalar>>>
): Scalar {
  const res1 = parseIM(complexArgument(inumber1)); // left to right
  const real1 = res1.real;
  const im1 = res1.im;
  const unit1 = res1.unit;
  const res2 = parseIM(complexArgument(inumber2));
  const real2 = res2.real;
  const im2 = res2.im;
  const unit2 = res2.unit;

  // Two different suffixes are #NUM! here, where IMSUM and IMPRODUCT call the same mismatch
  // #VALUE! — `IMSUB("6+8j","3+4i")` is #NUM!.
  if (unit1 !== unit2) throw FormulaError.BuiltIn.Num;

  return COMPLEX(real1 - real2, im1 - im2, unit1);
}

/**
 * Returns the sum of complex numbers
 * @param inumber are from 1 to 255 complex numbers to add
 */
export function IMSUM(inumber: AcceptError<IRange>[]): Scalar {
  let realSum: number = 0;
  let imSum: number = 0;
  let unit: string | undefined;
  const members = complexMembers(inumber);
  for (let i=0; i<members.length; i++) {
    const item = members[i]!;
    unit = sharedUnit(unit, item);
    realSum += item.real;
    imSum += item.im;
  }
  return COMPLEX(realSum, imSum, unit ?? 'i');
}

/**
 * Returns the tangent of a complex number
 * @param inumber is a complex number for which you want the tangent
 */
export function IMTAN(inumber: NoLift<Scalar>): Scalar {
  const { real, im, unit } = parseIM(inumber);
  const r = _tanIM(real, im);
  return COMPLEX(r.real, r.im, unit);
}

/**
 * Returns the hyperbolic tangent of a complex number.
 * @param inumber is a complex number for which you want the hyperbolic tangent.
 * @category Sheets
 */
export function IMTANH(inumber: Scalar): Scalar {
  const { real, im, unit } = parseIM(inumber);
  const r = _divIM(_sinhIM(real, im), _coshIM(real, im));
  return COMPLEX(r.real, r.im, unit);
}

/**
 * One coefficient of a complex number as its text spells it.
 *
 * @remarks
 * The exponent's SIGN is optional — `1E3` is a coefficient and so is `2E-3` — and whitespace is
 * allowed anywhere a sign is, which is why the captures are stripped before they are read as
 * numbers (`"3 + 4i"` captures `"+ 4"`).
 */
const COEFFICIENT = String.raw`[+-]?\s*[0-9]+[.]?[0-9]*(?:[eE][+-]?[0-9]+)?`;

/** A bare unit (`i`, `-i`, `+i`) or a coefficient with one (`4i`, `2E-3j`). */
const RefExIMWithoutReal = new RegExp(String.raw`^\s*([+-]?\s*(?:[0-9]+[.]?[0-9]*(?:[eE][+-]?[0-9]+)?)?)\s*([ij])\s*$`);

/** A real part and an imaginary one — the full form. */
const RegexIM = new RegExp(String.raw`^\s*(${COEFFICIENT})\s*([+-]\s*(?:[0-9]+[.]?[0-9]*(?:[eE][+-]?[0-9]+)?)?)\s*([ij])\s*$`);

/** A capture that is only a sign — `"+"` in `3+i` — which stands for 1. */
const RegExStandaloneWhitespace: RegExp = /^\s*[+-]?\s*$/;

/** A capture read as a number, with the whitespace a sign may carry taken out first. */
const coefficient = (text: string): number =>
  RegExStandaloneWhitespace.test(text) ? Number(`${text.replace(/\s+/g, '')}1`) : Number(text.replace(/\s+/g, ''));

/**
 * A complex slot of the names that take two: a blank CELL is the complex zero, an OMITTED
 * argument is `#N/A`, and an error arrives as a VALUE so that the pair reads LEFT TO RIGHT
 * (`IMSUB("zz",NA())` is the first slot's `#NUM!`).
 */
const complexArgument = (value: Scalar | undefined): Scalar => {
  if (FormulaError.isError(value)) throw value;
  if (value === undefined) throw FormulaError.BuiltIn.NA;
  return value;
};

interface IM {
  real: number;
  im: number;
  unit: string;
  /** Set when the text carried no unit of its own: a real number, which sides with either suffix. */
  unitless?: boolean;
}

/**
 * The members of the names that take a LIST, in order. Every cell of every argument is one —
 * a blank cell is the complex zero, so `IMPRODUCT(7,A1)` over a blank A1 is 0 — and the first
 * that faults decides: `IMSUM({1," ",#NAME?})` is the `#NUM!` of the text that is no complex
 * number, ahead of the error behind it.
 */
const complexMembers = (list: readonly (IRange | Scalar)[]): IM[] => {
  const kinds = FormulaContext.getArgs().getRepeatingArgsAt(0);
  const members: IM[] = [];
  const add = (value: Scalar): void => {
    if (FormulaError.isError(value)) throw value;
    const parsed = parseIM(value);
    if (typeof value !== 'string' || !/[ij]\s*$/.test(value)) parsed.unitless = true;
    members.push(parsed);
  };
  for (let i = 0; i < list.length; i++) {
    if (kinds.getKindAt(i) === ValueKind.Omitted) continue; // no member: `IMPRODUCT("i",)` is `i`
    const argument = list[i]!;
    if (!(argument as IRange)?.isIRange) {
      add(argument as Scalar);
      continue;
    }
    const { rows, columns } = (argument as IRange).getShape();
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) add((argument as IRange).getValueAt(row, column));
    }
  }
  return members;
};

/**
 * The suffix a list answers in: the first one written. Two that differ are `#VALUE!`, and a real
 * number has none to differ by — `IMSUM("2","j")` is `2+j`.
 */
const sharedUnit = (unit: string | undefined, member: IM): string | undefined => {
  if (member.unitless) return unit;
  if (unit !== undefined && unit !== member.unit) throw FormulaError.BuiltIn.Value;
  return member.unit;
};

function parseIM(textOrNumber: Scalar): IM {
  let real: number = 0;
  let im: number = 0;
  let unit: string = 'i';
  if (typeof textOrNumber === 'number')
    return { real: textOrNumber, im, unit };
  // A BLANK cell is the complex number zero; a BOOLEAN is #VALUE!, which is the one input the
  // family refuses outright rather than failing to parse.
  if (textOrNumber === null || textOrNumber === undefined)
    return { real: 0, im, unit };
  if (typeof textOrNumber === 'boolean')
    throw FormulaError.BuiltIn.Value;
  if (typeof textOrNumber !== 'string') {
    throw FormulaError.BuiltIn.Value;
  }
  // Text that reads as a NUMBER is that real number, whatever spelling it used: `IMREAL("10%")`
  // is 0.1 and `IMREAL("1E10")` is ten billion. The number parser runs FIRST, so the complex
  // grammar below only ever sees text that is not simply a number. The empty string is the one
  // case both refuse, and it is #NUM! rather than the #VALUE! a number parse would raise.
  if (textOrNumber.trim() !== '') {
    try {
      return { real: FormulaContext.parseAsNumber(textOrNumber), im, unit };
    } catch (e) { /* not a number — try the complex grammar */ }
  }

  // The suffix is LOWER CASE only: `3+4I` is #NUM!, not a complex number with a capital unit.
  let match = textOrNumber.match(RefExIMWithoutReal);
  if (match) {
    im = coefficient(match[1]);
    unit = match[2];
    return { real, im, unit };
  }
  match = textOrNumber.match(RegexIM);
  if (match) {
    real = coefficient(match[1]);
    im = coefficient(match[2]);
    unit = match[3];
    return { real, im, unit };
  }
  throw FormulaError.BuiltIn.Num;
}

// helper

/** A complex number's parts are written as Excel writes a number literal: plain up to 21 characters. */
const _literal: IFormulaContext.ToTextOptions = { literal: true };
