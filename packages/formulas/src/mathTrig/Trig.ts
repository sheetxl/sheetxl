/* cspell: disable */
// TODO - we have this in a number of places .rationalize
const MAX_NUMBER = 2 ** 27 - 1;

/**
 * @summary Returns the arccosine of a number, in radians in the range 0 to Pi. The arccosine is the angle whose cosine is Number
 * @param number is the cosine of the angle you want and must be from -1 to 1
 */
export function ACOS(number: number): number {
  if (number > 1 || number < -1) return Number.NaN;
  return Math.acos(number);
}

/**
 * @summary Returns the inverse hyperbolic cosine of a number
 * @param number is any real number equal to or greater than 1
 */
export function ACOSH(number: number): number {
  if (number < 1) return Number.NaN;
  return Math.acosh(number);
}

/**
 * @summary Returns the arccotangent of a number, in radians in the range 0 to Pi.
 * @param number is the cotangent of the angle you want
 */
export function ACOT(number: number): number {
  return Math.PI / 2 - Math.atan(number);
}

/**
 * @summary Returns the inverse hyperbolic cotangent of a number
 * @param number is the hyperbolic cotangent of the angle that you want
 */
export function ACOTH(number: number): number {
  if (Math.abs(number) <= 1) return Number.NaN;
  return Math.atanh(1 / number);
}

/**
 * @summary Returns the arcsine of a number in radians, in the range -Pi/2 to Pi/2
 * @param number is the sine of the angle you want and must be from -1 to 1
 */
export function ASIN(number: number): number {
  if (number > 1 || number < -1) return Number.NaN;
  return Math.asin(number);
}

/**
 * @summary Returns the inverse hyperbolic sine of a number
 * @param number is any real number equal to or greater than 1
 */
export function ASINH(number: number): number {
  return Math.asinh(number);
}

/**
 * @summary Returns the arctangent of a number in radians, in the range -Pi/2 to Pi/2
 * @param number is the tangent of the angle you want
 */
export function ATAN(number: number): number {
  return Math.atan(number);
}

/**
 * @summary Returns the arctangent of the specified x- and y- coordinates, in radians between -Pi and Pi, excluding -Pi
 * @param x is the x-coordinate of the point
 * @param y is the y-coordinate of the point
 */
export function ATAN2(x: number, y: number): number {
  if (y === 0 && x === 0) return Infinity;
  return Math.atan2(y, x);
}

/**
 * @summary Returns the inverse hyperbolic tangent of a number
 * @param number is any real number between -1 and 1 excluding -1 and 1
 */
export function ATANH(number: number): number {
  if (Math.abs(number) > 1) return Number.NaN;
  return Math.atanh(number);
}

/**
 * @summary Returns the cosine of an angle
 * @param number is the angle in radians for which you want the cosine
 */
export function COS(number: number): number {
  if (Math.abs(number) > MAX_NUMBER) return Number.NaN;
  const retValue = Math.cos(number);
  if (!isFinite(retValue)) return Number.NaN; // Infinity is Divide by 0 but we want #NUM!
  return retValue;
}

/**
 * @summary Returns the hyperbolic cosine of a number
 * @param number is any real number
 */
export function COSH(number: number): number {
  const retValue = Math.cosh(number);
  if (!isFinite(retValue)) return Number.NaN; // Infinity is Divide by 0 but we want #NUM!
  return retValue;
}

/**
 * @summary Returns the cotangent of an angle
 * @param number is the angle in radians for which you want the cotangent
 */
export function COT(number: number): number {
  if (Math.abs(number) > MAX_NUMBER) return Number.NaN;
  if (number === 0) return Infinity;
  return 1 / Math.tan(number);
}

/**
 * @summary Returns the hyperbolic cotangent of a number
 * @param number is the angle in radians for which you want the hyperbolic cotangent
 */
export function COTH(number: number): number {
  if (number === 0) return Infinity;
  return 1 / Math.tanh(number);
}

/**
 * @summary Returns the cosecant of an angle
 * @param number is the angle in radians for which you want the cosecant
 */
export function CSC(number: number): number {
  if (Math.abs(number) > MAX_NUMBER) return Number.NaN;
  return 1 / Math.sin(number);
}

/**
 * @summary Returns the hyperbolic cosecant of an angle
 * @param number is the angle in radians for which you want the hyperbolic cosecant
 */
export function CSCH(number: number): number {
  if (number === 0) return Infinity;
  return 1 / Math.sinh(number);
}

/**
 * @summary Returns the secant of an angle
 * @param number is the angle in radians for which you want the secant
 */
export function SEC(number: number): number {
  if (Math.abs(number) > MAX_NUMBER) return Number.NaN;
  return 1 / Math.cos(number);
}

/**
 * @summary Returns the hyperbolic secant of an angle
 * @param number is the angle in radians for which you want the hyperbolic secant
 */
export function SECH(number: number): number {
  return 1 / Math.cosh(number);
}

/**
 * @summary Returns the sine of an angle
 * @param number is the angle in radians for which you want the sine. Degrees * PI()/180 = radians
 */
export function SIN(number: number): number {
  if (Math.abs(number) > MAX_NUMBER) return Number.NaN;
  return Math.sin(number);
}

/**
 * @summary Returns the hyperbolic sine of a number
 * @param number is any real number
 */
export function SINH(number: number): number {
  const retValue = Math.sinh(number);
  if (!isFinite(retValue)) return Number.NaN; // Infinity is Divide by 0 but we want #NUM! to be compatible with Excel
  return retValue;
}

/**
 * @summary Returns the tangent of an angle
 * @param number is the angle in radians for which you want the tangent. Degrees * PI()/180 = radians
 */
export function TAN(number: number): number {
  if (Math.abs(number) > MAX_NUMBER) return Number.NaN;
  return Math.tan(number);
}

/**
 * @summary Returns the hyperbolic tangent of a number
 * @param number is any real number
 */
export function TANH(number: number): number {
  return Math.tanh(number);
}
