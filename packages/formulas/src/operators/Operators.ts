/* cspell: disable */
import { FormulaContext, FormulaError, type Scalar } from '@sheetxl/primitives';

// EQ/GT/GTE/LT/LTE/NE are the CALLABLE spelling of `=`/`>`/`>=`/`<`/`<=`/`<>`.
//
// The arithmetic is plain JavaScript. The engine turns a non-finite result into #NUM! at the
// boundary, so overflow needs no help here. #DIV/0! is the one thing plain arithmetic cannot
// express, because it is raised deliberately rather than derived from a float, so the two
// operators that can hit it say so.
//
// Flushing a subnormal to zero is NOT at that boundary: only MULTIPLY, DIVIDE and POW flush,
// while ADD, SUBTRACT and every function result keep the value (`EXP(-745)` is 5E-324 and
// `EXP(-745)*2` is 0). So the three that flush say so themselves. DIVIDE flushes at both ends —
// its divisor is tested against zero after the flush.
const MinNormalNumber = 2.2250738585072014e-308;
const flushSubnormal = (value: number): number =>
  (value > -MinNormalNumber && value < MinNormalNumber) ? 0 : value;

/**
 * Returns the sum of two numbers. Equal to the '+' operator.
 * @param value1 The first number to add.
 * @param value2 The second number to add.
 * @category Sheets
 */
export function ADD(
  value1: number,
  value2: number
): number {
  return value1 + value2;
}

/**
 * Returns the result of dividing one number by another. Equal to the '/' operator.
 * @param dividend The number to be divided.
 * @param divisor The number to divide by.
 * @category Sheets
 */
export function DIVIDE(
  dividend: number,
  divisor: number
): number {
  // The divisor is tested against zero AFTER the flush, so a subnormal divisor is #DIV/0! even
  // though it compares unequal to zero: `A1=0` is FALSE and `1/A1` is #DIV/0! for an `A1`
  // holding EXP(-745).
  if (flushSubnormal(divisor) === 0) throw FormulaError.BuiltIn.Div0!;
  return flushSubnormal(dividend / divisor);
}

/**
 * Returns TRUE if the two specified values are equal. Equal to the '=' operator.
 * @param value1 The first value to compare.
 * @param value2 The second value to compare.
 * @category Sheets
 */
export function EQ(
  value1: Scalar,
  value2: Scalar
): boolean {
  return FormulaContext.compare(value1, value2) === 0;
}

/**
 * Returns TRUE if the first value is greater than the second. Equal to the '>' operator.
 * @param value1 The first value to compare.
 * @param value2 The second value to compare.
 * @category Sheets
 */
export function GT(
  value1: Scalar,
  value2: Scalar
): boolean {
  return FormulaContext.compare(value1, value2) > 0;
}

/**
 * Returns TRUE if the first value is greater than or equal to the second. Equal to the '>=' operator.
 * @param value1 The first value to compare.
 * @param value2 The second value to compare.
 * @category Sheets
 */
export function GTE(
  value1: Scalar,
  value2: Scalar
): boolean {
  return FormulaContext.compare(value1, value2) >= 0;
}

/**
 * Returns TRUE if the first value is less than the second. Equal to the '<' operator.
 * @param value1 The first value to compare.
 * @param value2 The second value to compare.
 * @category Sheets
 */
export function LT(
  value1: Scalar,
  value2: Scalar
): boolean {
  return FormulaContext.compare(value1, value2) < 0;
}

/**
 * Returns TRUE if the first value is less than or equal to the second. Equal to the '<=' operator.
 * @param value1 The first value to compare.
 * @param value2 The second value to compare.
 * @category Sheets
 */
export function LTE(
  value1: Scalar,
  value2: Scalar
): boolean {
  return FormulaContext.compare(value1, value2) <= 0;
}

/**
 * Returns the difference of two numbers. Equal to the '-' operator.
 * @param value1 The number from which to subtract.
 * @param value2 The number to subtract.
 * @category Sheets
 */
export function MINUS(
  value1: number,
  value2: number
): number {
  return value1 - value2;
}

/**
 * Returns the product of two numbers. Equal to the '*' operator.
 * @param value1 The first number to multiply.
 * @param value2 The second number to multiply.
 * @category Sheets
 */
export function MULTIPLY(
  value1: number,
  value2: number
): number {
  return flushSubnormal(value1 * value2);
}

/**
 * Returns TRUE if the two specified values are not equal. Equal to the '<>' operator.
 * @param value1 The first value to compare.
 * @param value2 The second value to compare.
 * @category Sheets
 */
export function NE(
  value1: Scalar,
  value2: Scalar
): boolean {
  return FormulaContext.compare(value1, value2) !== 0;
}

/**
 * Returns a number raised to a power. Equal to the '^' operator.
 * @param base The number to raise to a power.
 * @param exponent The power to raise the base to.
 * @category Sheets
 */
export function POW(
  base: number,
  exponent: number
): number {
  // `0^-1` is #DIV/0! and `0^0` is #NUM! where JS says 1. Any other zero base is already
  // right on plain `**`.
  if (base === 0) {
    if (exponent < 0) throw FormulaError.BuiltIn.Div0!;
    if (exponent === 0) return Number.NaN;
  }
  if (base < 0) {
    // A negative base takes a fractional exponent only when the exponent's RECIPROCAL is an odd
    // integer read at 15 significant digits — an odd root of a negative number is real, an even
    // one is not. `(-8)^(1/3)` answers where `(-8)^(0.3333333333333)` is #NUM!, and an integer
    // exponent past 2^32-2 falls out of the integer path and is #NUM! too. The same rule is in
    // `POWER` (mathTrig/Math.ts `negativeBasePower`).
    if (Number.isInteger(exponent) && Math.abs(exponent) <= 4294967294) return flushSubnormal(base ** exponent);
    const reciprocal = Number((1 / exponent).toPrecision(15));
    if (!Number.isInteger(reciprocal) || Math.abs(reciprocal % 2) !== 1) return Number.NaN;
    return flushSubnormal(-((-base) ** exponent));
  }
  return flushSubnormal(base ** exponent);
}

/**
 * Returns the negation of a number. Equal to the unary '-' operator.
 * @param value The number to negate.
 * @category Sheets
 */
export function UMINUS(value: number): number {
  return value * -1;
}

/**
 * Converts a number to a percentage. Equal to the '%' operator.
 * @param value The number to convert to a percentage.
 * @category Sheets
 */
export function UNARY_PERCENT(value: number): number {
  return DIVIDE(value, 100);
}

/**
 * Returns a number unchanged. Equal to the unary '+' operator.
 * @param value The number to return.
 * @category Sheets
 */
export function UPLUS(value: number): number {
  return value;
}

/**
 * Checks whether a number is between two numbers, inclusive by default.
 * @param value The value to test.
 * @param lower The lower bound.
 * @param upper The upper bound.
 * @param lowerInclusive Whether the lower bound is inclusive. Default TRUE.
 * @param upperInclusive Whether the upper bound is inclusive. Default TRUE.
 * @category Sheets
 */
export function ISBETWEEN(
  value: number,
  lower: number,
  upper: number,
  lowerInclusive: boolean = true,
  upperInclusive: boolean = true
): boolean {
  const lowerOk = lowerInclusive ? value >= lower : value > lower;
  const upperOk = upperInclusive ? value <= upper : value < upper;
  return lowerOk && upperOk;
}
