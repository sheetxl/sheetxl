/* cspell: disable */
import {
  FormulaContext, FormulaError,
  type AcceptError, type Omittable, type Scalar, type NoLift
} from '@sheetxl/primitives';

import { erf, erfc } from '../_utils/SpecialFunctions';

/**
 * A bound as the four error-function names read it.
 *
 * @remarks
 * A blank CELL is zero — `ERF(1,<a blank cell>)` is `ERF(1,0)`, which is −0.8427007929497149 —
 * and an error arrives as a VALUE so that the bodies can read LEFT TO RIGHT: `ERF("zz",NA())` is
 * `#VALUE!` and not the `#N/A` its second slot carries.
 */
const bound = (value: Scalar): number => {
  if (FormulaError.isError(value)) throw value;
  if (value === null) return 0;
  return FormulaContext.parseAsNumber(value);
};

/**
 * Returns the error function.
 * @param lowerLimit is the lower bound for integrating ERF.
 * @param upperLimit is the upper bound for integrating ERF.
 */
export function ERF(
  lowerLimit: NoLift<Omittable<AcceptError<Scalar>>>,
  upperLimit?: NoLift<AcceptError<Scalar>>
): number {
  // The required slot's third position: an empty comma is #N/A, where a blank CELL is zero.
  if (lowerLimit === undefined) throw FormulaError.BuiltIn.NA;
  const lower = bound(lowerLimit); // left to right
  if (upperLimit === undefined) return erf(lower);
  return erf(bound(upperLimit)) - erf(lower);
}

/**
 * Returns the error function.
 * @name ERF.PRECISE
 * @param x is the lower bound for integrating ERF.PRECISE.
 */
export function ERF_PRECISE(x: NoLift<Omittable<Scalar>>): number {
  if (x === undefined) throw FormulaError.BuiltIn.NA;
  return erf(bound(x));
}

/**
 * Returns the complementary error function.
 * @param x is the lower bound for integrating ERF.
 */
export function ERFC(x: NoLift<Omittable<Scalar>>): number {
  if (x === undefined) throw FormulaError.BuiltIn.NA;
  return erfc(bound(x));
}

/**
 * Returns the complementary error function.
 * @name ERFC.PRECISE
 * @param x is the lower bound for integrating ERF.
 */
export function ERFC_PRECISE(x: NoLift<Omittable<Scalar>>): number {
  if (x === undefined) throw FormulaError.BuiltIn.NA;
  return erfc(bound(x));
}
