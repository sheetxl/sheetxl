import type { ScalarType } from './ScalarType'
import type { Scalar } from './Scalar';
import type { FormulaError } from './FormulaError';

/**
 * A two-dimensional ranges of values that use array programming styles similar to NumPy's
 * ndarray, but expanded for use in a spreadsheet environment.
 *
 * * Provides methods for accessing dimensions, iterating over elements, and performing basic matrix operations.
 */
export interface IRange<T extends Scalar=Scalar> {
  /**
   * Applies a callback function to elements from this range and another range or a scalar, using NumPy-style broadcasting.
   *
   * **Broadcasting Rules:**
   * - If `other` is a scalar, it is broadcasted to match the shape of this range.
   * - If `other` is a range, both ranges must have the same length.
   *
   * @param other The other range or scalar to broadcast with.
   * @param callbackFn The function to apply to corresponding elements.
   * @param options {@link IRange.BroadcastOptions}
   *
   * @returns A new range with the broadcasted results.
   * @throws {Error} If the ranges have different length when broadcasting two ranges.
   */
  broadcast<TS extends Scalar=T>(
    other: IRange | TS,
    callbackFn: (a: TS, b: TS, coords: IRange.CellCoords, range: IRange<T>) => TS,
    options?: IRange.BroadcastOptions
  ): this;

  /**
   * Returns a range of 0x0.
   */
  empty(): this;

  /**
   * Returns an iterator that allows you to iterate over the individual entries within the range,
   * yielding pairs of `IRange.CellCoords` and `Scalar`.
   *
   * @param options {@link IRange.IteratorOptions}
   * @returns An iterator that yields a IRange.Entry for each value within the range.
   */
  entries<TS extends Scalar=T>(
    options?: IRange.IteratorOptions
  ): IterableIterator<IRange.Entry<TS>>;

  /**
   * Tests whether all elements in the range pass the test implemented by the provided function.
   *
   * @param callbackFn The function to test each element.
   * @param options {@link IRange.IteratorOptions}
   * @returns `true` if all elements pass the test, otherwise `false`.
   */
  every<TS extends Scalar=T>(
    callbackFn: (value: TS, coords: IRange.CellCoords, range: IRange<T>) => boolean,
    options?: IRange.IteratorOptions
  ): boolean

  /**
   * Iterates over the cells within the range, applying the provided callback function to each cell.
   *
   * This method is a more scalable alternative to `getValues` or `getCells` for large or sparse ranges,
   * as it:
   * 1. Skips empty values by default.
   * 2. Avoids creating large arrays.
   * 3. Allows for early termination.
   *
   * @param callbackFn A function that will be called for each non-empty cell in the range. The callback receives:
   *   - `value`: The `Scalar` at the current cell.
   *   - `coords`: A `IRange.CellCoords`.
   *   - The callback can return `{ break: T }` to stop the iteration early.
   * @param options {@link IRange.IteratorOptions}
   * @template T The Scalar type.
   * @template B The callback return type.
   * @returns The value returned by the callback function if it explicitly returned to stop the iteration early; otherwise, `void`.
   */
  forEach<TS extends Scalar=T, B=any>(
    callbackFn: (value: TS, coords: IRange.CellCoords, range: IRange<T>) => { break: B } | void,
    options?: IRange.IteratorOptions
  ): B | void;

  /**
   * Fill the entire range with a single value.
   *
   * @param value The value to fill.
   * @param coords If provided will fill from the coordinates to this area.
   */
  fill(
    value: Scalar,
    coords?: Partial<IRange.Coords>
  ): this;

  /**
   * Returns a new range with all values set to a specific value.
   *
   * @param value The value to fill
   * @param minWidth A fixed width for the range. DefaultValue `original width`.
   * @param minHeight A fixed height for the range. DefaultValue `original height`.
   */
  // TODO - rationalize this with fill?
  // TODO - the minWidth and minHeight are inconsistent with other coords from fill.
  fillEmpty(
    value: Scalar,
    minWidth?: number,
    minHeight?: number
  ): this;

  /**
   * Creates a new range with elements that pass the test implemented by the provided function.
   *
   * @param callbackFn The function to test each element.
   * @param options {@link IRange.IteratorOptions}
   * @returns A new range containing only the elements that pass the test.
   */
  filter<TS extends Scalar=T>(
    callbackFn: (value: TS, coords: IRange.CellCoords, range: IRange<T>) => boolean,
    options?: IRange.IteratorOptions
  ): this;

  /**
   * Returns the values as an array of values.
   *
   * @param options {@link IRange.IteratorOptions}
   */
  flatten(
    options?: IRange.IteratorOptions
  ): Scalar[];

  /**
   * Returns the values as a materialized 2D array.
   *
   * @param options {@link IRange.GetValuesOptions}
   *
   * @remarks
   * This is useful if a libraries or functions require a 2D array but can be very expensive
   * for large ranges.
   */
  getValues<TS extends Scalar=T>(
    options?: IRange.GetValuesOptions
  ): TS[][];

  /**
   * Returns a scalar value at a specific row and column index.
   *
   * @param rowIndex The row index of the value to retrieve.
   * @param colIndex The column index of the value to retrieve.
   * @param options {@link IRange.GetValuesOptions}
   *
   * Returns a value at a specific row and column index.
   */
  getValueAt<TS extends Scalar=T>(
    rowIndex: number,
    colIndex: number,
    options?: IRange.ValueOptions
  ): TS;

  /**
   * Returns the width of the range.
   */
  getWidth(): number;

  /**
   * Returns the height of the range.
   */
  getHeight(): number;

  /**
   * Indicates if the range has a type.
   */
  getScalarType(): ScalarType | null;

  /**
   * Intersects two ranges and applies a callback function to elements.
   *
   * @param other The other range.
   * @returns A new range with the intersected results or `null` if the ranges do not intersect.
   */
  intersect<TS extends Scalar=T>(
    other: IRange,
    callbackFn?: (a: TS, b: TS, coords: IRange.CellCoords, range: IRange<T>) => TS,
    options?: IRange.IteratorOptions
  ): this;

  /**
   * Returns `true` if the range is a literal range from a parameter.
   */
  isLiteral(): boolean;

  /**
   * Applies a transformation function to each value, returning a new `IRange`.
   *
   * @param callbackFn A function applied to each non-empty cell
   * @param options {@link IRange.IteratorOptions}
   */
  map<TS extends Scalar=T>(
    callbackFn: (value: TS, coords: IRange.CellCoords, range: IRange<T>) => TS,
    options?: IRange.IteratorOptions
  ): this;

  /**
   * Iterate values.
   *
   * @param options {@link IRange.IteratorOptions}
   */
  values<TS extends Scalar=T>(
    options?: IRange.IteratorOptions
  ): IterableIterator<TS>;

  /**
   * Applies a function against an accumulator and each element of the range (from left to right) to reduce it to a single value.
   *
   * @template U The type of the accumulator.
   * @param callbackFn The function to execute on each element.
   * @param initialValue The initial value of the accumulator.
   * @param options {@link IRange.IteratorOptions}
   * @returns The reduced value.
   */
  // TODO - skip uncoerced values?
  reduce<TS extends Scalar=T>(
    callbackFn: (accumulator: TS, value: TS, coords: IRange.CellCoords, range: IRange<T>) => TS,
    initialValue: TS,
    options?: IRange.IteratorOptions
  ): TS;

  /**
   * Replaces values in the range with values from another range.
   *
   * @param other The other range or a 2d array.
   * @param coords The starting coordinates for the replacement. Default Value {0 ,0}
   */
  replace<TS extends Scalar=T>(
    other: IRange | TS[][],
    coords?: IRange.CellCoords
  ): this;

  /**
   * Returns a new range either trimmed or expanded to fix the new width/height.
   */
  resize(
    width: number,
    height: number,
    fillValue?: Scalar
  ): this;

  /**
   * Returns a sliced subrange of the current range.
   *
   * @param coords A partial range definition ({ rowStart, rowEnd, colStart, colEnd }).
   * @returns A new `IRange` representing the sliced section.
   *
   * @remarks
   * If any coordinate is omitted, it defaults to the full extent of the range.
   */
  slice(coords: Partial<IRange.Coords>): this;

  /**
   * Tests whether at least one element in the range passes the test implemented by the provided function.
   *
   * @param callbackFn The function to test each element.
   * @param options {@link IRange.IteratorOptions}
   * @returns `true` if at least one element passes the test, otherwise `false`.
   */
  some<TS extends Scalar=T>(
    callbackFn: (value: TS, coords: IRange.CellCoords, range: IRange<T>) => boolean,
    options?: IRange.IteratorOptions
  ): boolean;

  // /**
  //  * Unions two ranges and applies a callback function to any intersecting elements.
  //  *
  //  * @param other The other range.
  //  * @param callback The function to apply to corresponding elements.
  //  * @returns A new range with the unioned results.
  //  */
  // union<T extends Scalar=Scalar>(
  //   other: IRange,
  //   callbackFn: (a: T, b: T, coords: IRange.CellCoords, range: IRange) => T,
  //   options?: IRange.IteratorOptions
  // ): this;

  /**
   * Creates a `IncrementalUpdater` for efficiently updating sparsely populated cells in a streaming low memory way.
   *
   * @param options {@link IRange.StartUpdateOptions}
   *
   * @remarks
   * - **Ordering:** By default updates must be added in either row-major or column-major order, as specified
   * by the `orientation` parameter, with major/minor coordinates increasing monotonically. Unless
   * `allowUnorderedWrites` is set to `true out of order updates will result in an error.

   * - **Performance:**  Setting `orientation` to `IRange.Orientation.Column` is generally faster as it aligns with the internal data representation.
   * - **Performance:**  Setting `allowUnorderedWrites` adds a nominal performance overhead for all updates and will do a full apply when an
   *      out of order update is detected.
   *   The default `IRange.Orientation.Row` is provided for compatibility with common spreadsheet APIs.
   * - **Validation:** Data validation (e.g., for protected cells or boundaries) is performed when the `apply` method is called.
   * - **Transactions:**
   *    - Adding values to the `IncrementalUpdater` only builds a temporary representation of the updates.
   *      No actual changes are made to the sheet until `apply` is called.
   *    - This allows for safe batching of updates within a single transaction using `doBatch`.

   * @example
```typescript startIncrementalUpdates
  const updates = range.startIncrementalUpdates()
    .pushAt(1, 0, 2)
    .pushAt(1, 0, 567)
    .pushAt(1, 0, 3)
    .pushAt(1, 0, 123)
    .pushAt(1, 0, 1)
    .apply();
  });
```
   */
  startIncrementalUpdates<TS extends Scalar=T>(
    options?: IRange.StartUpdateOptions
  ): IRange.IncrementalUpdater<TS>;

  /**
   * Returns a string representation of the range.
   */
  toString(): string;

  /**
   * Change the type of default range coercion for the values in the range.
   *
   * @param type The new scalar type.
   */
  toType(type: ScalarType): this;

  /**
   * Returns the range transposed.
   */
  transpose(): this;

  /**
   * Returns an iterator that allows you to iterate over the individual values within the range.
   *
   * @remarks
   * For more advanced iteration, use {@link IRange.entries} or {@link IRange.forEach}.
   */
  [Symbol.iterator](): IterableIterator<Scalar>;

  // count (count of non-zero elements) (this will be one of the several aggregation/accumulator methods)
  // sum
  // max
  // min
  // countA
  // countBlank

  // sort (how will this work and why is it here?)
  // find


  // /**
  //  * Returns a new IRange that is the matrix product of this IRange and another
  //  * IRange.
  //  *
  //  * @param other The other Array2D to multiply with.
  //  * * @example
  //  * const array1 = new IRange([[1, 2], [3, 4]]);
  //  * const array2 = new IRange([[5, 6], [7, 8]]);
  //  * const product = array1.dot(array2);  // Returns [[19, 22], [43, 50]]
  //  */
  // dot(other: Array2D): this;
  // pick
  // pickRaw

  // var?, var.s, var.p

  // copyTo (numpy) (grid has this now)
  // reverse (numpy calls this flip)
  // concat (this is confusing, numpy has concat, concatenate, hstack, vstack, and append)

  /**
   * Returns the size of the range this is the width * height.
   */
  get size(): number;

  get isIRange(): true;
}

/**
 * {@inheritDoc IRange}
 *
 * @see
 * ### **Interface**
 *
 * {@link IRange}
 */
export namespace IRange {

  export interface IteratorOptions extends IRange.ValueOptions {
    /**
     * The direction of the iteration.
     *
     * @defaultValue `IRange.Orientation.Column`
     */
    orientation?: IRange.Orientation;
    /**
     * The direction of the iteration.
     *
     * @defaultValue `IRange.Orientation.Row`
     */
    bounds?: Partial<IRange.Coords>;
    /**
     * Iterate in reverse order.
     *
     * @defaultValue `false`
     */
    reverse?: boolean;
    /**
     * If true will visit empty cells.
     * This is a potentially huge performance improvement if set to false.
     *
     * @defaultValue `false`
     *
     * @remarks
     * If includeEmpty is `true` this will always return rectangular results.
     * If bounds are provided it will provide empty spaces before and after.
     * If passing a large bound care must be taken.
     */
    includeEmpty?: boolean;
    /**
     * Useful for callback functions that want a this.
     */
    thisArg?: any
  }

  export interface ValueOptions {
    /**
     * Specifies the type of value desired.
     *
     * @remarks
     * Once set the values will attempt to coerce to the type requested.
     * Various operations will be affected by this setting.
     */
    type?: ScalarType;
    /**
     * If type is set and this is true values that don't match will attempt to be
     * coerced to the type value. If coerce fails the value will be ignored or
     * a `FormulaError.Value` will be returned depending on the `includeMistyped` setting.
     *
     * @default `depends` Ranges that are created from literal scalars will coerce by default.
     * @remarks
     * If type is not set this has no effect.
     */
    coerce?: boolean;
    /**
     * If `true` values that do not match the `type` will be ignored.
     * @default `depends` Ranges that are created from literal arrays will be ignored by default.
     *
     * @remarks
     * If type is not set this has no effect.
     */
    includeMistyped?: boolean;
    /**
     * Flag for including boolean values in coerce.
     *
     * @default `depends` Ranges that are created from literal scalars will include boolean by default.
     */
    includeBoolean?: boolean;
  }

  export interface GetValuesOptions extends ValueOptions {
    /**
     * The maximum width of the array.
     */
    maxWidth?: number;
    /**
     * The maximum width of the array.
     */
    maxHeight?: number;
    /**
     * If true will include trailing empties.
     */
    trailingEmpties?: boolean;
    /**
     * Allow for this to be set. DefaultValue `IRange.Orientation.Row`
     */
    orientation?: IRange.Orientation;
    /**
     * If provided then before return the callback will be visited for each cell.
     */
    onValue?: (value: Scalar, row: number, column: number, range: IRange) => Scalar;
  }

  export interface BroadcastOptions extends ValueOptions {
    /**
     * Controls how misaligned ranges are handled during broadcasting.
     *
     * - By default, `broadcast()` follows strict alignment rules like NumPy and will
     *   throw an error if the input ranges cannot be broadcasted together.
     * - When `mismatchFill` is provided, `broadcast()` will instead mimic Excel behavior:
     *   - It finds the **largest valid intersection** of the ranges.
     *   - It expands the result to the **union of both range sizes**.
     *   - Any cells that do not have valid corresponding values from the inputs
     *     will be filled with `mismatchFill` instead of causing an error.
     *
     * @example
     * // Throws an error if A and B are not naturally broadcast-compatible
     * const result = A.broadcast(B, (a, b) => a + b);
     *
     * @example
     * // Expands to union size and fills gaps with "#N/A" instead of erroring
     * const result = A.broadcast(B, (a, b) => a + b, { mismatchFill: "#N/A" });
     */
    mismatchFill?: Scalar;
    /**
     * If used this is will coerce the other.
     */
    otherType?: ScalarType;
  }

  /**
   * Entry for a Range iterator or visiting.
   */
  export interface Entry<T extends Scalar=Scalar> {
    value: T;
    coords: CellCoords;
  }

  export interface StartUpdateOptions {
    /**
     * The direction of the write.
     *
     * @defaultValue `IRange.Orientation.Row`
     */
    orientation?: IRange.Orientation;
  }

  /**
   * A Results builder for creating new Ranges.
   * A builder maintains an ordered structure where major and minor values must always
   * increase, otherwise an error will be thrown.
   *
   * @template T The type of values stored within the tuples.
   */
  export interface IncrementalUpdater<T extends Scalar> {
    /**
     * Adds a single value associated with a specific major and minor index.
     *
     * @param row The row index.
     * @param col The column index.
     * @param value The value to be added.
     * @throws `Error` If the point is out of order compared to previously added points
     * (within the same row).
     *
     * @remarks
     * If the value is an Array, it will be treated as a discrete value. If you want to set
     * multiple values along the minor axis, then use {@link pushMultipleAt}.
     */
    pushAt(row: number, col: number, value: T): this;
    /**
     * Adds multiple values associated with a specific row and column index.
     *
     * @param row The row index.
     * @param col The column index.
     * @param value An array of values to be added.
     * @throws `Error` If the point is out of order compared to previously added points
     * (within the same row).
     */
    // TODO - or IListLike<T>? or IRange
    pushMultipleAt(row: number, col: number, value: T[]): this;
    /**
     * Apply the updates
     */
    apply(): IRange;
  }

  /**
   * Specifies a single direction for the range.
   */
  export const Orientation = {
    Column: 'column',
    Row: 'row'
  } as const;
  export type Orientation = typeof Orientation[keyof typeof Orientation];

  /**
   * Allows for either direction or both. (But not none).
   */
  export const Orientations = {
    ...IRange.Orientation,
    Both: 'both'
  } as const;
  export type Orientations = typeof Orientations[keyof typeof Orientations];

  /**
   * Indicates a direction for a range along an axis.
   *
   * @remarks
   * Used during fill, shift, etc.
   */
  export const Direction = {
    Up: 'up',
    Down: 'down',
    Left: 'left',
    Right: 'right'
  } as const;
  export type Direction = typeof Direction[keyof typeof Direction];

  /**
   * The coordinates of a cell range in a 2D space.
   * The rowStart and colStart must be less than or equal to rowEnd and colEnd respectively.
   * If all of the values are the same this represents a single cell.
   */
  export interface Coords {
    /**
     * Left column
     */
    colStart: number;
    /**
     * Top row
     */
    rowStart: number;
    /**
     * Right column
     */
    colEnd: number;
    /**
     * Bottom row
     */
    rowEnd: number;

    // TODO - review this again
    sheetName?: string;
  }

  /**
   * Adds `fixed flags` to `IRange.Coords`.
   */
  export interface FixableCoords extends Coords {
    /**
     * If `true` then the colStart is fixed.
     *
     * @defaultValue false
     */
    $colStart?: boolean;
    /**
     * If `true` then the rowStart is fixed.
     *
     * @defaultValue false
     */
    $rowStart?: boolean;
    /**
     * If `true` then the colEnd is fixed.
     *
     * @defaultValue false
     */
    $colEnd?: boolean;
    /**
     * If `true` then the rowEnd is fixed.
     *
     * @defaultValue false
     */
    $rowEnd?: boolean;
  }

  /**
   * The coordinates of a single cell in a 2D space.
   */
  export interface CellCoords {
    /**
     * The column index of the cell.
     */
    colIndex: number;

    /**
     * The row index of the cell.
     */
    rowIndex: number;

    // TODO - review this again
    sheetName?: string;
  }

  /**
   * Adds fixable flag to `IRange.CellCoords`.
   */
  export interface FixableCellCoords extends CellCoords {
    /**
     * If `true`, the column is fixed.
     */
    $colIndex?: boolean;
    /**
     * If `true`, the row is fixed.
     */
    $rowIndex?: boolean;
  }

  /**
   * A reference precedent can be Either a `IRange.FixableCoords`, a `FormulaError.Known` or a named range `string`.
   */
  // Error is #REF!, #NAME! (not #NULL as that is dynamic)
  export type StaticReference = IRange.FixableCoords | FormulaError.Known | string;
}
