import type { FormulaError } from './FormulaError';
import type { IRichData } from './IRichData';

/**
 * Represents a scalar value.
 *
 * @remarks
 * This type does not include dates, as spreadsheet date are serialized numbers.
 *
 * @see {@link JSScalar} for a version that includes dates.
 */
export type Scalar = number | boolean | string | FormulaError.Known | IRichData;

/**
 * Represents a cell value in JavaScript, including `Date` for convenience.
 *
 * @remarks
 * This type extends `Scalar` by allowing `Date` values. While `Date` is not natively
 * stored in the cell, it can be passed as a convenience, and it will be internally
 * converted to a numeric representation.
 */
// TODO - roll this in Scalar? Distinction is not necessary
export type JSScalar = Scalar | Date;

/**
 * Represents an update to a cell's value, allowing `null` to clear the cell.
 *
 * @remarks
 * This type is used to update a cell's value. Passing `null` will clear the cell's content.
 * The value must conform to the native types allowed in a cell (`Scalar`).
 */
export type ScalarUpdate = Scalar | null | undefined;

/**
 * Represents an update to a cell's value in JavaScript, allowing `Date` and `null`.
 *
 * @remarks
 * This type allows for updating a cell's value, including `Date` for convenience.
 * As with `ScalarUpdate`, `null` can be used to clear the cell's value.
 */
export type JSScalarUpdate = JSScalar | null | undefined;