/**
 * Represents the type of a Scalar.
 *
 * @remarks
 * `ScalarType` is used to indicate the kind of data contained in the cell, such as a number,
 * string, boolean, or rich data object.
 *
 * For example, dates are represented as (serial) numbers, and rich text
 * or complex data is stored as `RichData`.
 */
export const ScalarType = {
  /**
   * A numeric value.
   *
   * @remarks
   * Dates are expressed as formatted numbers within cells. They are internally stored as
   * serial numbers and can be formatted to display as dates.
   */
  Number: 'n',
  /**
   * A string value.
   */
  String: 's',
  /**
   * A boolean value (`true` or `false`).
   */
  Boolean: 'b',
  /**
   * A cell that contains an error value.
   *
   * @remarks
   * Error cells represent cells where an error occurred during formula evaluation or data processing.
   */
  Error: 'e',
  /**
   * A complex data type that is represented as a JSON object.
   *
   * @remarks
   * Rich data may include structured or complex data that goes beyond simple strings, numbers,
   * or booleans. Useful for use cases where a cell holds data like rich text or embedded objects.
   */
  // TODO - rename to `Object` or `Complex`?
  RichData: 'r',
  /**
   * Represents a cell that contains no value (null).
   *
   * @remarks
   * Cells with `null` values may still contain formatting or other cell metadata.
   */
  Null: 'z'
} as const;
export type ScalarType = typeof ScalarType[keyof typeof ScalarType];
