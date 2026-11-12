/* cspell: disable */
import {
  FormulaContext, FormulaError,
  type AcceptError, type Omittable, type Scalar, type NoLift
} from '@sheetxl/primitives';

/**
 * Tests whether two numbers are equal.
 * @param number1 is the first number.
 * @param number2 is the second number.
 */
export function DELTA(
  number1: NoLift<Omittable<AcceptError<Scalar>>>,
  number2: NoLift<Omittable<AcceptError<Scalar>>>=0
): number {
  number2 = zeroIfBlank(number2); // right-to-left
  number1 = zeroIfBlank(number1);
  return number1 === number2 ? 1 : 0;
}

/**
 * Tests whether a number is greater than a threshold value.
 * @param number is the value to test against step.
 * @param step is the threshold value.
 */
export function GESTEP(
  number: NoLift<Omittable<AcceptError<Scalar>>>,
  step: NoLift<Omittable<AcceptError<Scalar>>>=0
): number {
  step = zeroIfBlank(step); // right-to-left
  number = zeroIfBlank(number);
  return number >= step ? 1 : 0;
}

/**
 * The pair's number slots, where a BLANK CELL is zero rather than a refusal.
 *
 * @remarks
 * Both names compare against zero by default, and a blank reads as that zero on either side:
 * `DELTA(0,<a blank cell>)` is 1 and `DELTA(5,)` is 0. The `Omittable` marker on the second slot
 * is what makes an empty comma take the same path as an absent argument; the first slot is
 * required, so an empty comma there is `#N/A` — it is the one caller that reaches here as
 * `undefined`.
 */
function zeroIfBlank(value: Scalar | undefined): number {
  // The REQUIRED slot's third position: an empty comma is #N/A. It reaches here as `undefined`
  // only from that slot — the optional one declares `Omittable<T>` with an initializer, so its
  // omission means the absent 0 instead.
  if (value === undefined) throw FormulaError.BuiltIn.NA;
  if (value === null) return 0;
  return FormulaContext.parseAsNumber(value);
}