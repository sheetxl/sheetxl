/**
 * Identifies which variant of {@link Scalar} a cell value is.
 *
 * Because `Scalar` is a union type, `ScalarType` gives you a safe, string-based
 * discriminant for branching on value kind — useful in formula implementations,
 * data-profiling UIs, and type-coercion logic without relying on `typeof` or
 * `instanceof` checks that do not cover all cases (e.g. `null`, `FormulaError`,
 * `IRichData`).
 *
 * @remarks
 * Dates have no dedicated variant. They are stored as `Number` values with a
 * number format applied. Use `FormulaContext.isValidDate` to distinguish them
 * at runtime. `InteropScalarType` extends this enum with a `Date` variant for
 * API boundaries that accept JavaScript `Date` objects.
 *
 * @see {@link Scalar} for the value type this enum describes.
 * @see {@link InteropScalarType} for the superset that includes `Date`.
 */
export const ScalarType = {
  /**
   * A numeric value.
   *
   * @remarks
   * Dates are expressed as formatted numbers within cells. They are internally stored as
   * serial numbers and can be formatted to display as dates.
   */
  Number: 'number',
  /**
   * A string value.
   */
  String: 'string',
  /**
   * A boolean value (`true` or `false`).
   */
  Boolean: 'boolean',
  /**
   * A cell that contains an error value.
   *
   * @remarks
   * Error cells represent cells where an error occurred during formula evaluation or data processing.
   */
  Error: 'error',
  /**
   * A complex data type represented as {@link IRichData}.
   *
   * @remarks
   * Rich data are objects that have complex structures and can contain data that goes beyond simple strings, numbers,
   * booleans, or error values. For example, hyperlinks and images are represented as rich data.
   */
  RichData: 'richData',
  /**
   * Represents the absence of a value.
   */
  Null: 'null'
} as const;
export type ScalarType = typeof ScalarType[keyof typeof ScalarType];

/**
 * Extends ScalarType to support `Date`.
 *
 * @see {@link InteropScalar | Javascript Dates}
 */
export const InteropScalarType = {
  ...ScalarType,
  /**
   * A date value.
   *
   * @remarks
   * Dates are represented as serial numbers in the underlying data model but
   * can be identified as dates through formatting. This type is used to indicate that a
   * cell's value should be treated as a date, even though it's stored as a number.
   */
  Date: 'date'
} as const;
export type InteropScalarType = typeof InteropScalarType[keyof typeof InteropScalarType];