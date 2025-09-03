/* cspell: disable */
import { Scalar, FormulaError } from '@sheetxl/primitives';

const numberRegex: RegExp = /^\s?[+-]?\s?[0-9]+[.]?[0-9]*([eE][+-][0-9]+)?\s?$/;
const IMWithoutRealRegex: RegExp = /^\s?([+-]?\s?([0-9]+[.]?[0-9]*([eE][+-][0-9]+)?)?)\s?[ij]\s?$/;
const IMRegex: RegExp = /^\s?([+-]?\s?[0-9]+[.]?[0-9]*([eE][+-][0-9]+)?)\s?([+-]?\s?([0-9]+[.]?[0-9]*([eE][+-][0-9]+)?)?)\s?[ij]\s?$/;

const StandaloneWhitespaceRegEx: RegExp = /^\s?[+-]?\s?$/;
interface IM {
  real: number;
  im: number;
  unit: string;
}

function parseIM(textOrNumber: any): IM {
  let real: number = 0;
  let im: number = 0;
  let unit: string = 'i';
  if (typeof textOrNumber === 'number')
    return { real: textOrNumber, im, unit };
  if (typeof textOrNumber === 'boolean')
    throw FormulaError.BuiltIn.Value;
  let match = textOrNumber.match(numberRegex);
  if (match) {
    real = Number(match[0]);
    return { real, im, unit };
  }
  match = textOrNumber.match(IMWithoutRealRegex);
  if (match) {
    im = Number(StandaloneWhitespaceRegEx.test(match[1]) ? match[1] + '1' : match[1]);
    unit = match[0].slice(-1);
    return { real, im, unit };
  }
  match = textOrNumber.match(IMRegex);
  if (match) {
    real = Number(match[1]);
    im = Number(StandaloneWhitespaceRegEx.test(match[3]) ? match[3] + '1' : match[3]);
    unit = match[0].slice(-1);
    return { real, im, unit };
  }
  throw FormulaError.BuiltIn.Num;
}


/**
 * @summary Converts real and imaginary coefficients into a complex number
 * @param realNum is the real coefficient of the complex number
 * @param iNum is the imaginary coefficient of the complex number
 * @param suffix is the suffix for the imaginary component of the complex number
 */
export function COMPLEX(
  realNum: number,
  iNum: number,
  suffix: string='i'
): string | number {
  if (suffix !== 'i' && suffix !== 'j') {
    throw FormulaError.BuiltIn.Value;
  }
  if (realNum === 0 && iNum === 0) {
    return 0;
  }
  if (realNum === 0) {
    if (iNum === 1) {
      return suffix;
    }
    if (iNum === -1) {
      return '-' + suffix;
    }
    return iNum.toString() + suffix;
  }
  if (iNum === 0) {
    return realNum.toString()
  }

  let sign = (iNum > 0) ? '+' : '';
  if (iNum === 1) {
    return realNum.toString() + sign + suffix;
  }
  if (iNum === -1) {
    return realNum.toString() + sign + '-' + suffix;
  }
  return realNum.toString() + sign + iNum.toString() + suffix;
}


/**
 * @summary Returns the absolute value (modulus) of a complex number
 * @param inumber is a complex number for which you want the absolute value
 */
export function IMABS(inumber: Scalar): number {
  const { real, im } = parseIM(inumber);
  return Math.sqrt(Math.pow(real, 2) + Math.pow(im, 2));
}

/**
 * @summary Returns the imaginary coefficient of a complex number
 * @param inumber is a complex number for which you want the imaginary coefficient
 */
export function IMAGINARY(inumber: Scalar): number {
  return parseIM(inumber).im;
}

/**
 * @summary Returns the argument q, an angle expressed in radians
 * @param inumber is a complex number for which you want the argument
 */
export function IMARGUMENT(inumber: Scalar): number {
  const { real, im } = parseIM(inumber);
  // x + yi => x cannot be 0, since theta = tan-1(y / x)
  if (real === 0 && im === 0) return Infinity;
  // return PI/2 if x is equal to 0 and y is positive
  if (real === 0 && im > 0) {
    return Math.PI / 2;
  }
  // while return -PI/2 if x is equal to 0 and y is negative
  if (real === 0 && im < 0) {
    return -Math.PI / 2;
  }
  // return -PI if x is negative and y is equal to 0
  if (real < 0 && im === 0) {
    return Math.PI
  }
  // return 0 if x is positive and y is equal to 0
  if (real > 0 && im === 0) {
    return 0;
  }
  // return argument of inumber
  if (real > 0) {
    return Math.atan(im / real);
  }
  if (real < 0 && im > 0) {
    return Math.atan(im / real) + Math.PI;
  }
  return Math.atan(im / real) - Math.PI;
}

/**
 * @summary Returns the complex conjugate of a complex number
 * @param inumber is a complex number for which you want the conjugate
 */
export function IMCONJUGATE(inumber: Scalar): string | number {
  const { real, im, unit } = parseIM(inumber);
  return (im !== 0) ? COMPLEX(real, -im, unit) : '' + real;
}

/**
 * @summary Returns the cosine of a complex number
 * @param inumber is a complex number for which you want the cosine
 */
export function IMCOS(inumber: Scalar): string | number {
  const { real, im, unit } = parseIM(inumber);
  const realInput = Math.cos(real) * (Math.exp(im) + Math.exp(-im)) / 2;
  const imaginaryInput = -Math.sin(real) * (Math.exp(im) - Math.exp(-im)) / 2;
  return COMPLEX(realInput, imaginaryInput, unit);
}

/**
 * @summary Returns the hyperbolic cosine of a complex number
 * @param inumber is a complex number for which you want the hyperbolic cosine
 */
export function IMCOSH(inumber: Scalar): string | number {
  const { real, im, unit } = parseIM(inumber);
  const realInput = Math.cos(im) * (Math.exp(real) + Math.exp(-real)) / 2;
  const imaginaryInput = -Math.sin(im) * (Math.exp(real) - Math.exp(-real)) / 2;
  return COMPLEX(realInput, -imaginaryInput, unit);
}

/**
 * @summary Returns the cotangent of a complex number
 * @param inumber is a complex number for which you want the cotangent
 */
export function IMCOT(inumber: Scalar): string | number {
  const real = IMCOS(inumber);
  const imaginary = IMSIN(inumber);
  return IMDIV(real, imaginary);
}

/**
 * @summary Returns the cosecant of a complex number
 * @param inumber is a complex number for which you want the cosecant
 */
export function IMCSC(inumber: Scalar): string | number {
  return IMDIV('1', IMSIN(inumber));
}

/**
 * @summary Returns the hyperbolic cosecant of a complex number
 * @param inumber is a complex number for which you want the hyperbolic cosecant
 */
export function IMCSCH(inumber: Scalar): string | number {
  return IMDIV('1', IMSINH(inumber));
}

/**
 * @summary Returns the quotient of two complex numbers
 * @param inumber1 is the complex numerator or dividend
 * @param inumber2 is the complex denominator or divisor
 */
export function IMDIV(inumber1: Scalar, inumber2: Scalar): string | number {
  const res1: IM = parseIM(inumber1);
  const real1: number = res1.real;
  const im1: number = res1.im;
  const unit1: string = res1.unit;

  const res2:IM = parseIM(inumber2);
  const real2: number = res2.real;
  const im2: number = res2.im;
  const unit2: string = res2.unit;

  if (real2 === 0 && im2 === 0 || unit1 !== unit2) throw FormulaError.BuiltIn.Num;

  const unit = unit1; // not needed
  const denominator = Math.pow(real2, 2) + Math.pow(im2, 2);
  return COMPLEX((real1 * real2 + im1 * im2) / denominator, (im1 * real2 - real1 * im2) / denominator, unit);
}

/**
 * @summary Returns the exponential of a complex number
 * @param inumber is a complex number for which you want the exponential
 */
export function IMEXP(inumber: Scalar): string | number {
  const { real, im, unit } = parseIM(inumber);
  const e: number = Math.exp(real);
  return COMPLEX(e * Math.cos(im), e * Math.sin(im), unit)
}

/**
 * @summary Returns the exponential of a complex number
 * @param inumber is a complex number for which you want the exponential
 */
export function IMLN(inumber: Scalar): string | number {
  const { real, im, unit } = parseIM(inumber);
  return COMPLEX(Math.log(Math.sqrt(Math.pow(real, 2) + Math.pow(im, 2))), Math.atan(im / real), unit);
}

/**
 * @summary Returns the base-10 logarithm of a complex number
 * @param inumber is a complex number for which you want the common logarithm
 */
export function IMLOG10(inumber: Scalar): string | number {
  const { real, im, unit } = parseIM(inumber);
  const realInput: number = Math.log(Math.sqrt(Math.pow(real, 2) + Math.pow(im, 2))) / Math.log(10);
  const imaginaryInput: number = Math.atan(im / real) / Math.log(10);
  return COMPLEX(realInput, imaginaryInput, unit);
}

/**
 * @summary Returns the base-2 logarithm of a complex number
 * @param inumber is a complex number for which you want the base-2 logarithm
 */
export function IMLOG2(inumber: Scalar): string | number {
  const { real, im, unit } = parseIM(inumber);
  const realInput: number = Math.log(Math.sqrt(Math.pow(real, 2) + Math.pow(im, 2))) / Math.log(2);
  const imaginaryInput: number = Math.atan(im / real) / Math.log(2);
  return COMPLEX(realInput, imaginaryInput, unit);
}

/**
 * @summary Returns the base-2 logarithm of a complex number
 * @param inumber is a complex number for which you want the base-2 logarithm
 */
export function IMPOWER(inumber: Scalar, number: number): string | number {
  const { unit } = parseIM(inumber);

  // calculate power of modules
  const p: number = Math.pow(IMABS(inumber), number);
  // calculate argument
  const t: number = IMARGUMENT(inumber);

  const real: number = p * Math.cos(number * t);
  const imaginary: number = p * Math.sin(number * t);
  return COMPLEX(real, imaginary, unit);
}

/**
 * @summary Returns the product of 1 to 255 complex numbers
 * @param inumber inumber1,inumber2,... Inumber1, Inumber2,... are from 1 to 255 complex numbers to multiply.
 */
export function IMPRODUCT(...inumber: Scalar[]): string | number {
  const inumberLength = inumber.length;
  if (inumberLength === 0) return 0;

  let result:string | number = inumber[0] as string | number;
  parseIM(result); // parse to valid
  for (let i=1; i<inumberLength; i++) {
    const item = inumber[i];
    const res1: IM = parseIM(result);
    const res2: IM = parseIM(item);
    const unit1: string = res1.unit;
    const unit2: string = res2.unit;
    if (unit1 !== unit2) throw FormulaError.BuiltIn.Value;
    const real1: number = res1.real;
    const im1: number = res1.im;
    const real2: number = res2.real;
    const im2: number = res2.im;
    result = COMPLEX(real1 * real2 - im1 * im2, real1 * im2 + im1 * real2);
  }
  return result;
}

/**
 * @summary Returns the real coefficient of a complex number
 * @param inumber is a complex number for which you want the real coefficient
 */
export function IMREAL(inumber: Scalar): number {
  return parseIM(inumber).real;
}

/**
 * @summary Returns the secant of a complex number
 * @param inumber is a complex number for which you want the secant
 */
export function IMSEC(inumber: Scalar): string | number {
  return IMDIV('1', IMCOS(inumber));
}

/**
 * @summary Returns the hyperbolic secant of a complex number
 * @param inumber is a complex number for which you want the hyperbolic secant
 */
export function IMSECH(inumber: Scalar): string | number {
  return IMDIV('1', IMCOSH(inumber));
}

/**
 * @summary Returns the sine of a complex number
 * @param inumber is a complex number for which you want the sine
 */
export function IMSIN(inumber: Scalar): string | number {
  const { real, im, unit } = parseIM(inumber);

  const realInput: number = Math.sin(real) * (Math.exp(im) + Math.exp(-im)) / 2;
  const imaginaryInput: number = Math.cos(real) * (Math.exp(im) - Math.exp(-im)) / 2;
  return COMPLEX(realInput, imaginaryInput, unit);
}

/**
 * @summary Returns the hyperbolic sine of a complex number
 * @param inumber is a complex number for which you want the hyperbolic sine
 */
export function IMSINH(inumber: Scalar): string | number {
  const { real, im, unit } = parseIM(inumber);
  const realInput: number = Math.cos(im) * (Math.exp(real) - Math.exp(-real)) / 2;
  const imaginaryInput: number = Math.sin(im) * (Math.exp(real) + Math.exp(-real)) / 2;
  return COMPLEX(realInput, imaginaryInput, unit);
}

/**
 * @summary Returns the square root of a complex number
 * @param inumber is a complex number for which you want the square root
 */
export function IMSQRT(inumber: Scalar): string | number {
  const { unit } = parseIM(inumber);
  // calculate the power of modulus
  const power: number = Math.sqrt(IMABS(inumber));
  // calculate argument
  const argument: number = IMARGUMENT(inumber);
  return COMPLEX(power * Math.cos(argument / 2), power * Math.sin(argument / 2), unit);
}

/**
 * @summary Returns the difference of two complex numbers
 * @param inumber1 is the complex number from which to subtract inumber2
 * @param inumber2 is the complex number to subtract from inumber1
 */
export function IMSUB(inumber1: Scalar, inumber2: Scalar): string | number {
  const res1 = parseIM(inumber1);
  const real1 = res1.real;
  const im1 = res1.im;
  const unit1 = res1.unit;
  const res2 = parseIM(inumber2);
  const real2 = res2.real;
  const im2 = res2.im;
  const unit2 = res2.unit;

  if (unit1 !== unit2) throw FormulaError.BuiltIn.Value;

  return COMPLEX(real1 - real2, im1 - im2, unit1);
}

/**
 * @summary Returns the sum of complex numbers
 * @param inumber inumber1,inumber2,... are from 1 to 255 complex numbers to add
 */
export function IMSUM(...inumber: Scalar[]): string | number {
  let realSum: number = 0;
  let imSum: number = 0;
  let prevUnit: string;
  const inumberLength: number = inumber.length;
  for (let i=0; i<inumberLength; i++) {
    const item = inumber[i];
    const { real, im, unit } = parseIM(item);
    if (!prevUnit) prevUnit = unit;
    if (prevUnit !== unit)
      throw FormulaError.BuiltIn.Value;
    realSum += real;
    imSum += im;
  }
  return COMPLEX(realSum, imSum, prevUnit);
}

/**
 * @summary Returns the tangent of a complex number
 * @param inumber is a complex number for which you want the tangent
 */
export function IMTAN(inumber: Scalar): string | number {
  return IMDIV(IMSIN(inumber), IMCOS(inumber));
}
