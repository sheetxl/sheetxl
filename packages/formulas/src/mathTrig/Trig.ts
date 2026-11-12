/* cspell: disable */
import { FormulaError } from '@sheetxl/primitives';

import { atanhExcel, flushSubnormal } from '../_utils/Arithmetic';
import { MAX_TRIG_ARGUMENT, x87Cos, x87Sin, x87Tan } from '../_utils/X87';

// The twenty-one trigonometric functions. Three facts run through the whole file and are stated
// once here rather than at each body:
//
// * The SIX CIRCULAR functions reduce their argument against pi rounded to 64 significand bits,
//   which is what `_utils/X87.ts` exists for, and they alone refuse `|x| >= 2^27`. The hyperbolic
//   and inverse functions have neither the reduction nor the bound.
// * The INVERSE functions are Excel's naive closed forms, not the library's accurate ones, and
//   the difference shows in both directions: `ASINH(1E-8)` is 9.999999889225291E-9 rather than
//   1E-8 because `ln(x + sqrt(x*x+1))` cancels, and `ASINH(1E307)` is `#NUM!` rather than 708.6
//   because `x*x` overflows from 2^512 up.
// * `Number.NaN` is the in-body spelling of `#NUM!`, and an overflow to Infinity becomes one at
//   the boundary, so a body only says what plain arithmetic gets wrong.

/**
 * Returns the arccosine of a number, in radians in the range 0 to Pi. The arccosine is the angle whose cosine is Number.
 * @param number is the cosine of the angle you want and must be from -1 to 1.
 */
export function ACOS(number: number): number {
  if (number > 1 || number < -1) return Number.NaN;
  // `PI/2 - ASIN(x)` rather than the library's arccosine: it is the spelling that agrees at
  // `ACOS(0.5)`.
  return Math.PI / 2 - Math.asin(number);
}

/**
 * Returns the inverse hyperbolic cosine of a number.
 * @param number is any real number equal to or greater than 1.
 */
export function ACOSH(number: number): number {
  if (number < 1) return Number.NaN;
  // `x*x` overflows from 2^512 up, which is why `ACOSH(1E307)` is #NUM! and not 708.6.
  return Math.log(number + Math.sqrt(number * number - 1));
}

/**
 * Returns the arccotangent of a number, in radians in the range 0 to Pi.
 * @param number is the cotangent of the angle you want.
 */
export function ACOT(number: number): number {
  // `ATAN(1/x)`, wrapped into (0, Pi) — NOT `PI/2 - ATAN(x)`, which cancels to 0 past 1E15
  // where the answer is 1E-15. `1/0` is Infinity, whose arctangent is Pi/2, so zero needs no case.
  const angle = Math.atan(flushSubnormal(1 / number));
  return number < 0 ? Math.PI + angle : angle;
}

/**
 * Returns the inverse hyperbolic cotangent of a number.
 * @param number is the hyperbolic cotangent of the angle that you want.
 */
export function ACOTH(number: number): number {
  if (Math.abs(number) <= 1) return Number.NaN;
  // The reciprocal is not taken first: `atanhExcel` reads `(x+1)/(x-1)` where the domain end is
  // close, which is precision `1/x` has already thrown away.
  return Math.abs(number) <= 2
    ? Math.log((number + 1) / (number - 1)) / 2
    : atanhExcel(flushSubnormal(1 / number));
}

/**
 * Returns the arcsine of a number in radians, in the range -Pi/2 to Pi/2.
 * @param number is the sine of the angle you want and must be from -1 to 1.
 */
export function ASIN(number: number): number {
  if (number > 1 || number < -1) return Number.NaN;
  return Math.asin(number);
}

/**
 * Returns the inverse hyperbolic sine of a number.
 * @param number is any real number.
 */
export function ASINH(number: number): number {
  // Taken on the MAGNITUDE and re-signed. The unsigned `ln(x + sqrt(x*x+1))` is a different
  // number in the last bit for a negative argument, and Excel's is this one.
  const magnitude = Math.abs(number);
  const value = Math.log(magnitude + Math.sqrt(magnitude * magnitude + 1));
  return number < 0 ? -value : value;
}

/**
 * Returns the arctangent of a number in radians, in the range -Pi/2 to Pi/2.
 * @param number is the tangent of the angle you want.
 */
export function ATAN(number: number): number {
  return Math.atan(number);
}

/**
 * Returns the arctangent of the specified x- and y- coordinates, in radians between -Pi and Pi, excluding -Pi.
 * @param x is the x-coordinate of the point.
 * @param y is the y-coordinate of the point.
 *
 * @remarks
 * The angle is reached through the RATIO `y/x`, so a pair whose ratio overflows is `#NUM!` even
 * where the angle itself is ordinary: `ATAN2(1E-300,1E307)` is `#NUM!` and not Pi/2.
 */
export function ATAN2(x: number, y: number): number {
  if (y === 0 && x === 0) throw FormulaError.BuiltIn.Div0!;
  const ratio = y / x;
  // A non-finite ratio from a non-zero divisor is the overflow; from a zero one it is the
  // vertical angle, and its arctangent is the right answer.
  if (x !== 0 && !Number.isFinite(ratio)) return Number.NaN;
  const angle = Math.atan(ratio);
  if (x >= 0) return angle;
  return y >= 0 ? angle + Math.PI : angle - Math.PI;
}

/**
 * Returns the inverse hyperbolic tangent of a number.
 * @param number is any real number between -1 and 1 excluding -1 and 1.
 */
export function ATANH(number: number): number {
  // The domain is OPEN: `ATANH(1)` is #NUM!, not the infinity the limit suggests.
  if (Math.abs(number) >= 1) return Number.NaN;
  return atanhExcel(number);
}

/**
 * Returns the cosine of an angle.
 * @param number is the angle in radians for which you want the cosine.
 */
export function COS(number: number): number {
  if (Math.abs(number) >= MAX_TRIG_ARGUMENT) return Number.NaN;
  return x87Cos(number);
}

/**
 * Returns the hyperbolic cosine of a number.
 * @param number is any real number.
 */
export function COSH(number: number): number {
  // Excel reaches the answer through `e^|x|`, so it is that exponential and not the cosine
  // itself that overflows: COSH(709.78) answers 8.96E307 and COSH(709.79) is #NUM!, where
  // `Math.cosh` alone carries on to 9.05E307.
  if (!Number.isFinite(Math.exp(Math.abs(number)))) return Number.NaN;
  return Math.cosh(number);
}

/**
 * Returns the cotangent of an angle.
 * @param number is the angle in radians for which you want the cotangent.
 */
export function COT(number: number): number {
  if (Math.abs(number) >= MAX_TRIG_ARGUMENT) return Number.NaN;
  if (number === 0) throw FormulaError.BuiltIn.Div0!;
  return 1 / x87Tan(number);
}

/**
 * Returns the hyperbolic cotangent of a number.
 * @param number is the angle in radians for which you want the hyperbolic cotangent.
 */
export function COTH(number: number): number {
  if (number === 0) throw FormulaError.BuiltIn.Div0!;
  return flushSubnormal(1 / Math.tanh(number));
}

/**
 * Returns the cosecant of an angle.
 * @param number is the angle in radians for which you want the cosecant.
 */
export function CSC(number: number): number {
  if (Math.abs(number) >= MAX_TRIG_ARGUMENT) return Number.NaN;
  if (number === 0) throw FormulaError.BuiltIn.Div0!;
  return 1 / x87Sin(number);
}

/**
 * Returns the hyperbolic cosecant of an angle.
 * @param number is the angle in radians for which you want the hyperbolic cosecant.
 */
export function CSCH(number: number): number {
  if (number === 0) throw FormulaError.BuiltIn.Div0!;
  // The reciprocal does NOT inherit SINH's overflow: `CSCH(710)` is 0 where `SINH(710)` is
  // #NUM!, because the quotient underflows rather than the exponential overflowing.
  return flushSubnormal(1 / Math.sinh(number));
}

/**
 * Returns the secant of an angle.
 * @param number is the angle in radians for which you want the secant.
 */
export function SEC(number: number): number {
  if (Math.abs(number) >= MAX_TRIG_ARGUMENT) return Number.NaN;
  return 1 / x87Cos(number);
}

/**
 * Returns the hyperbolic secant of an angle.
 * @param number is the angle in radians for which you want the hyperbolic secant.
 */
export function SECH(number: number): number {
  return flushSubnormal(1 / Math.cosh(number)); // no overflow guard — see CSCH
}

/**
 * Returns the sine of an angle.
 * @param number is the angle in radians for which you want the sine. Degrees * PI()/180 = radians.
 */
export function SIN(number: number): number {
  if (Math.abs(number) >= MAX_TRIG_ARGUMENT) return Number.NaN;
  return x87Sin(number);
}

/**
 * Returns the hyperbolic sine of a number.
 * @param number is any real number.
 */
export function SINH(number: number): number {
  if (!Number.isFinite(Math.exp(Math.abs(number)))) return Number.NaN; // see COSH
  return Math.sinh(number);
}

/**
 * Returns the tangent of an angle.
 * @param number is the angle in radians for which you want the tangent. Degrees * PI()/180 = radians.
 */
export function TAN(number: number): number {
  if (Math.abs(number) >= MAX_TRIG_ARGUMENT) return Number.NaN;
  return x87Tan(number);
}

/**
 * Returns the hyperbolic tangent of a number.
 * @param number is any real number.
 */
export function TANH(number: number): number {
  return Math.tanh(number);
}
