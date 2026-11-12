import { type ScalarType } from './ScalarType'
import { type Scalar } from './Scalar';
import { type FormulaError, type MaybeError } from './FormulaError';
import { type IRangeStats } from './IRangeStats';

/**
 * An immutable two-dimensional, mixed-type sparse array with functional vector semantics.
 *
 * @remarks
 * IRange is a persistent data structure — all operations return new ranges
 * via structural sharing. This allows for zero-copy cache-friendly writes, SIMD optimized
 * reads, and lockless concurrent evaluation.
 *
 * Designed to ensure familiarity for NumPy and JAX-ML users.
 *
 * 5 primitives are the core methods that have direct access to internal state.
 *
 * - entries()                — iterator with sparse/dense, axis, direction, and coercible options.
 * - sparseBuilder()          — streaming writer for sparse output construction.
 * - getShape()               — returns { rows, columns }.
 * - resize()                 — returns a new IRange at a different shape with a fill value.
 * - getType()                — the scalar type used for default coercion if set.
 *
 * 6 additional methods have been highly optimized for performance.
 *
 * - getValueAt(row, column)  — fast random access to individual cells.
 * - fill()                   — smart vector compression, zero copy.
 * - fillEmpty()              — virtual update for empty.
 * - clone()                  — creates a deep copy of the range.
 * - getStats()               — returns range statistics.
 * - hasError()               — exact error-member existence, raw untyped read.
 *
 * `errors()` is composed from the primitives but may be accelerated by implementations.
 *
 * All other methods — including `mask`, `choose`, `select`, `tile`, `repeat`, and the rest of the
 * utility surface are composed entirely in terms of those primitives with no special internal access.
 */
export interface IRange<T extends Scalar=Scalar> {

  /**
   * Returns the permutation indices that would sort the range.
   * Analogous to `np.argsort`. Use with `take()` to sort a parallel range (SORTBY pattern).
   *
   * @example
   * // single key
   * const perm = keyRange.argsort(1);
   * return dataRange.take(perm);
   *
   * @example
   * const perm = array.argsort([key1, key2], [1, -1]);
   * return dataRange.take(perm);
   *
   * @param keyRanges Single key range or array of key ranges.
   * @param orders `1` for ascending (default), `-1` for descending, per key.
   * @param axis Sort by rows (default) or columns.
   */
  argsort(
    keyRanges: IRange | IRange[],
    orders?: number | number[],
    axis?: IRange.Axis
  ): number[];

  /**
   * Returns the indices of the distinct rows (or columns) in this range, keeping the FIRST
   * occurrence of each. Analogous to `np.unique(arr, axis=0, return_index=True)`, but returning
   * only the kept indices (numpy's sorted, unique-value form isn't what `UNIQUE()` wants).
   *
   * @param axis Dedupe rows (default) or columns.
   * @param exactlyOnce If true, keep only rows/columns that occur EXACTLY once — drops every
   *   row that has a duplicate, rather than keeping one copy of it. Default false.
   *
   * @example
   * const kept = range.uniqueIndices();
   * return range.take(kept); // the SORTBY-style pattern argsort's own docs use
   */
  uniqueIndices(
    axis?: IRange.Axis,
    exactlyOnce?: boolean
  ): number[];

  /**
   * Applies a callback function to elements from this range and another range or a scalar,
   * using Excel's broadcasting rules. This is the two-operand special case of {@link zip}:
   * `a.broadcast(b, f)` is `a.zip([b], ([x, y]) => f(x, y))`.
   *
   * **Broadcasting Rules** (the same as {@link zip}):
   * - A scalar or a 1×1 range fills any shape: (1×1) + (3×4) → (3×4)
   * - Same shapes pair position by position: (3×4) + (3×4) → (3×4)
   * - A dimension of 1 tiles across the other operand's: (3×1) + (3×4) → (3×4)
   * - Incompatible shapes (neither equal nor 1) throw, unless `misalignValue` is set, in which
   *   case the result is the union shape and every position outside the intersection holds
   *   `misalignValue`. Here the pad is a RESULT; in {@link zip} it is an ARGUMENT.
   *
   * @param other The other range or scalar to broadcast with.
   * @param callbackFn The function to apply to corresponding elements.
   * @param options {@link IRange.BroadcastOptions}
   *
   * @returns A new range with the broadcasted results.
   *
   * @remarks
   * Iteration is sparse: the positions visited are the union of both operands' stored cells. A
   * position empty on both sides has one answer, and a callback that reads only its two values
   * (`callbackFn.length === 2`) receives that answer computed ONCE and written as runs; a callback
   * that asks for `coords` or `range` is called per position instead.
   */
  broadcast<TS extends Scalar=T>(
    other: IRange | TS,
    callbackFn: (a: TS, b: TS, coords: IRange.CellCoords, range: IRange<T>) => TS,
    options?: IRange.BroadcastOptions
  ): this;

  /**
   * Selects values from `from` by dispatching each element of `condition` to a 0-based index.
   *
   * For each cell, `selectFn` receives the corresponding value from `condition` and returns a 0-based
   * index into `from`. If the index is out of bounds, the original value from `this` is kept.
   *
   * **Broadcasting Rules:**
   * - Output shape is the max of `this`, `condition`, and all `from` ranges.
   * - All inputs are clamped to their bounds (NumPy-style broadcasting).
   * - Out-of-bounds index from `selectFn` falls back to `this` at that position.
   *
   * @param from The candidate ranges or scalars to select from (0-based).
   * @param selectFn Maps each condition value to a 0-based index into `from`.
   *   Return `-1` (or any out-of-bounds value) to keep the original value from `this`.
   * @param options {@link IRange.ValuesOptions}
   *
   * @returns A new range with selected values overlaid onto `this`.
   *
   * @see {@link mask} for the boolean shorthand (single condition, single value range).
   */
  choose<TS extends Scalar = T>(
    from: (IRange<TS> | TS)[],
    selectFn: (value: TS, coords: IRange.CellCoords, range: IRange<T>) => MaybeError<number>,
    options?: IRange.ValuesOptions
  ): this;

  /**
   * Similar to {@link empty}, but returns an range with the same size but `null` values.
   */
  clear(): this;

  /**
   * Returns a new range identical to the current one.
   */
  clone(): this;

  /**
   * Applies a transformation function to this `IRange`, returning the result.
   *
   * Equivalent to `fn(this)` — useful for applying named or reusable transforms
   * inline without breaking a fluent method chain.
   *
   * @param fn A pure function that transforms this `IRange`.
   *
   * @example
   * const normalize = (r: IRange) => r.replace([[1,2,3]]).repeat(3,1);
   *
   * range.compute(normalize).mask(condition);
   */
  compute(fn: (range: IRange) => IRange): this;

  /**
   * Concatenates another range along the specified axis, returning a new range.
   *
   * - {@link IRange.Axis.Row} (default) — vertical stack:
   *   appends `other` below `this`. Both ranges must have the same column size, or the
   *   narrower is padded to the wider with `padWith`.
   * - {@link IRange.Axis.Column} — horizontal stack:
   *   appends `other` to the right of `this`. Both ranges must have the same row size,
   *   or the shorter is padded to the taller with `padWith`.
   *
   * @param other The range to append.
   * @param axis The axis to concatenate along. Default is {@link IRange.Axis.Row}.
   * @param padWith Value used to pad the narrower/shorter range. Default is `#N/A`.
   *
   * @remarks
   * Analogous to `np.vstack` / `np.hstack` in numpy and `torch.cat` in PyTorch.
   *
   * @example
   * // Vertical stack
   * a.concat(b)
   *
   * @example
   * // Horizontal stack
   * a.concat(b, IRange.Axis.Column)
   *
   * @example
   * // Pad with 0 instead of #N/A
   * a.concat(b, IRange.Axis.Row, 0)
   */
  concat(
    other: IRange,
    axis?: IRange.Axis,
    padWith?: Scalar
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
   *
   * @remarks
   * Skips empty values by default.
   *
```typescript entries
  const iterEntries:IterableIterator<IRange.Entry> = array.entries({
    axis: IRange.Axis.Row, // Default but Column and 'fastest' are also available
    includeEmpty: false // Default but true is also available but should be avoided if sparse.
  });

  let iter: IteratorResult<IRange.Entry> = iterEntries.next();
  while (!iter.done) {
    const entry = iter.value;
    const value = entry.value;
    const coords: Readonly<IRange.CellCoords> = entry.coords;
    iter = iterEntries.next();
    // ...interesting logic here. Perhaps a sparseBuilder.
  }
```
   */
  entries<TS extends Scalar=T>(
    options?: IRange.IteratorOptions
  ): IterableIterator<IRange.Entry<TS>>;

  /**
   * Iterates the range's error members — every stored `FormulaError` — in row-major order
   * by default. Row-major is the identity order: `errors().next()` yields the error that
   * propagates under the engine's reject policy (`#N/A` stays `#N/A`).
   *
   * @param options Narrowed iterator options — only `axis`, `bounds`, and `reverse`.
   * The narrowing is deliberate: `type`/`onError`/`coerce` are meaningless-to-contradictory
   * on an error iterator. Like {@link hasError}, the scan reads RAW stored members,
   * ignoring the range's read type and coercion policy.
   *
   * @see {@link hasError} for existence-only checks.
   */
  errors(
    options?: Pick<IRange.IteratorOptions, 'axis' | 'bounds' | 'reverse'>
  ): IterableIterator<IRange.Entry<FormulaError.Known>>;

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
   * Fill the entire range with a single value.
   *
   * @param value The value to fill.
   * @param coords If provided will fill from the coordinates to this area.
   *
   * @remarks
   * If the coords are outside the range then it will fill to the edge.
   * Does not resize
   */
  fill(
    value: Scalar,
    coords?: Partial<IRange.Coords>
  ): this;

  /**
   * Fill all empty values in the range with a single value.
   *
   * @param value The value to fill
   * @param coords If provided will fill from the coordinates to this area.
   */
  fillEmpty(
    value: Scalar,
    coords?: Partial<IRange.Coords>
  ): this;

  /**
   * Creates a new range with elements that pass the test implemented by the provided function.
   *
   * @param callbackFn The function to test each element.
   * @param options {@link IRange.IteratorOptions}
   * @returns A new range containing only the elements that pass the test.
   *
   * @remarks
   * If the callback returns an error this will propagate the error as the value with the error.
   */
  filter<TS extends Scalar=T>(
    callbackFn: (value: TS, coords: IRange.CellCoords, range: IRange<T>) => MaybeError<boolean>,
    options?: IRange.TraversalAxis | IRange.IteratorOptions
  ): this;

  /**
   * The first error member in row-major order, or `null` when there is none — the identity that
   * propagates when a body refuses a range with an error inside it:
   * `if (range.hasError()) return range.firstError();`.
   *
   * @remarks
   * Errors INSIDE a range are the body's to judge: the engine hands a valid range over whole and
   * never looks inside, so a function whose answer depends on every member says so with this
   * line, placed before its own validation where the member's error outranks it. A reshaper or a
   * lookup, whose members pass through or are never read, needs no line at all.
   */
  firstError(): FormulaError.Known | null;

  /**
   * Linearizes the range into a single column by flattened ordinal — the member at ordinal `i`
   * lands at row `i`, column 0.
   *
   * @param options {@link IRange.IteratorOptions}
   *
   * @remarks
   * `options.axis` is the TRAVERSAL order feeding the ordinal, not the orientation of the result:
   * the result is always Nx1, and a row is `flatten().transpose()`. The default is row-major,
   * which is the order two range operands pair in.
   *
   * `options.type` carries a read type onto the result, so a member the type filters out becomes
   * a HOLE at its ordinal rather than compacting the column. That is what lets two operands be
   * paired position by position — see {@link alignValues}.
   *
   * `options.includeEmpty` has no meaning here and is ignored: a range is inherently sparse, so
   * an empty position is simply absent. Sparsity is preserved and nothing is materialized.
   *
   * Equivalent to `reshape(rows * columns, 1)`, which is where the ordinal rule is stated.
   *
   * @see {@link getValuesFlat} for the same linearization as a JS array.
   */
  flatten(
    options?: IRange.IteratorOptions
  ): this;

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
   * Returns the shape of the range in rows and columns.
   */
  getShape(): { rows: number; columns: number };

  /**
   * Returns the statistics for the range.
   */
  getStats(options?: IRange.IteratorOptions): IRangeStats;

  /**
   * Returns `true` if any stored member of the range is a `FormulaError`.
   *
   * @remarks
   * Reads RAW stored members only — the range's read type and coercion policy are ignored.
   * A `toType(Number)` range with a text member does NOT "have an error"; a `#VALUE!`
   * synthesized by `errorOnInvalidCoercion` doesn't count.
   *
   * The result is EXACT, never conservative: `false` guarantees there are no error members.
   * (Internal fast paths may be conservative; the public result may not be.)
   *
   * Equivalent by definition to
   * `getStats().getTypedCounts([ScalarType.Error])[ScalarType.Error] > 0` — the two
   * definitions of "error member" must never drift.
   *
   * Deliberately takes no options: partial regions compose —
   * `range.slice(coords).hasError()` (slice is a zero-copy view).
   *
   * @see {@link errors} to iterate the error members themselves.
   */
  hasError(): boolean;

  /**
   * Indicates if the range has a type. Returns `undefined` when no type was set —
   * consumers compare against an (optionally undefined) requested type, so `null`
   * must NOT be substituted here.
   */
  getType(): ScalarType | undefined;

  /**
   * Returns the values as a materialized 2D array.
   *
   * @param options {@link IRange.GetValuesOptions}
   *
   * @remarks
   * This is useful for libraries or functions that require a
   * a materialized 2D array but is expensive for large ranges.
   */
  getValues<TS extends Scalar=T>(
    options?: IRange.GetValuesOptions
  ): TS[][];

  /**
   * Returns a scalar value at a specific row and column index.
   *
   * @param rowIndex The row index of the value to retrieve.
   * @param colIndex The column index of the value to retrieve.
   * @param options {@link IRange.ValueOptions}
   */
  getValueAt<TS extends Scalar=T>(
    rowIndex: number,
    colIndex: number,
    options?: IRange.ValueOptions
  ): TS;

  /**
   * Returns the members as a flat JS array.
   *
   * @param options {@link IRange.IteratorOptions}
   *
   * @remarks
   * The array form of {@link flatten}. Skips empty members unless `includeEmpty` is set, where
   * `flatten` keeps them as holes in a range.
   */
  getValuesFlat<TS extends Scalar=T>(
    options?: IRange.IteratorOptions
  ): TS[];

  /**
   * Returns the position of the first member equal to `value`, or `-1` when there is none.
   *
   * @param value The value to find.
   * @param options {@link IRange.IndexOfOptions}
   *
   * @remarks
   * Equality is the `=` operator's: text is case-insensitive, and no value matches one of another
   * type (`1` does not match `"1"`, nor `TRUE` `1`). Empty members, errors and rich data are never
   * a match. The position is the offset along a row or column vector, and the row-major offset
   * within a larger range. This is `MATCH(value, range, 0)` less one, and a range read by many
   * lookups is indexed once rather than scanned per call.
   */
  indexOf(value: Scalar, options?: IRange.IndexOfOptions): number;

  /**
   * Returns the number of columns of the range.
   */
  getColumnCount(): number;

  /**
   * Returns the number of rows of the range.
   */
  getRowCount(): number;

  /**
   * Applies a transformation function to each value, returning a new `IRange`.
   *
   * @param callbackFn A function applied to each non-empty cell
   * @param options {@link IRange.IteratorOptions}
   *
   * @remarks
   * The result carries NO read type, even when the source had one — the values are the callback's
   * outputs and `map` cannot know what type they are. Use {@link IRange.toType} on the result if
   * you do know. (`options.type` still applies to the values handed TO the callback.)
   */
  map<TS extends Scalar=T>(
    callbackFn: (value: TS, coords: IRange.CellCoords, range: IRange<T>) => TS,
    options?: IRange.MapOptions
  ): this;

  /**
   * Returns a new range where each cell is replaced with the value from `ifTrues`
   * where the corresponding `conditions` value is strictly `true`.
   *
   * @param conditions A range of values determining which cells are replaced.
   * @param ifTrues Values to use where `conditions` is `true` (specifically not truthy).
   *
   * @remarks
   * The mask rules are:
   * 1. If the condition is `true` then the value from `ifTrues` is used.
   * 2. If the condition is an error then that error is used.
   * 3. If the condition is outside the bounds of `ifTrues` then `options.misalignValue` is used (default `#N/A`).
   * 4. Else the original value is kept.
   *
   * Similar to pandas `DataFrame.mask(cond, other)`.
   *
   * @example
   * // Formula equivalent: =IF(A1:A10>0, B1:B10, 0)
   * original.mask(conditions, ifTrues)
   *
   * @see {@link broadcast} for element-wise transformation with a callback
   */
  mask<TS extends Scalar = T>(
    conditions: IRange | TS,
    ifTrues: IRange | TS,
    options?: IRange.MaskOptions
  ): this;

  /**
   * Iterates this range and any number of other ranges in lockstep, yielding the corresponding
   * values at each position — `values[0]` is this range's member, `values[i+1]` is `others[i]`'s.
   *
   * Positions are aligned by OFFSET from each range's start; there is no broadcasting or tiling —
   * dimension rules stay with the caller. Iteration is sparse: a position empty in EVERY range is
   * never visited, and a range with no member at a visited position contributes `null`. Each range
   * reads through its own declared type, so a filtered member (e.g. text under a `number` read)
   * surfaces as `null` exactly like an empty cell.
   *
   * A `null` entry in `others` contributes the 1-based POSITION ordinal instead — the implied
   * `{1,2,...,n}` sequence. The ordinal is positional within this range's shape (empties advance it),
   * so a sparse member keeps the ordinal its cell occupies.
   *
   * @param others The parallel ranges; `null` entries yield the 1-based position ordinal.
   * @param options {@link IRange.IteratorOptions} Applied to this range's read; `axis` orders the
   * iteration for all sides.
   * @returns Pairs of `[values, coords]` with `coords` relative to this range.
   */
  alignValues<TS extends Scalar=T>(
    others: (IRange | null)[],
    options?: IRange.IteratorOptions
  ): IterableIterator<[values: (TS | null)[], coords: IRange.CellCoords]>;

  /**
   * Reduces this range and any number of other ranges in lockstep — the fused, streaming form of
   * "align, apply an elementwise kernel, fold" (numpy's `f(a, b).sum()`, with no intermediate
   * range). Iteration and alignment follow {@link alignValues}: positions align by offset,
   * a position empty on every side is never visited, an absent/filtered member arrives as
   * `null`, and a `null` in `others` contributes the 1-based position ordinal.
   *
   * Value policy (what to skip, how to accumulate) belongs to the callback — this is the same
   * contract as {@link reduce}, over aligned members.
   *
   * @template U The type of the accumulator.
   * @param others The parallel range(s); `null` entries yield the 1-based position ordinal.
   * @param callbackFn The function to execute on each aligned position — `values[0]` is this
   * range's member, `values[i+1]` is `others[i]`'s.
   * @param initialValue The initial value of the accumulator.
   * @param options {@link IRange.ReduceOptions} Applied to this range's read; `axis` orders the
   * iteration for all sides. Supply `emptyFold` when the answer depends on the positions that are
   * empty on every side — they are never visited, so a fold that needs them must state their
   * contribution in closed form.
   * @returns The reduced value.
   */
  alignReduce<TS extends Scalar=T, U=TS>(
    others: IRange | null | (IRange | null)[],
    callbackFn: (accumulator: U, values: (TS | null)[], coords: IRange.CellCoords, range: IRange<T>) => U,
    initialValue: U,
    options?: IRange.ReduceOptions<U>
  ): U;

  /**
   * Applies a function against an accumulator and each element of the range (from left to right) to reduce it to a single value.
   *
   * @template U The type of the accumulator.
   * @param callbackFn The function to execute on each element.
   * @param initialValue The initial value of the accumulator.
   * @param options {@link IRange.IteratorOptions}
   * @returns The reduced value.
   *
   * @remarks
   * Iteration is sparse — empty cells are not visited. A fold whose answer DEPENDS on the empty
   * cells wants {@link alignReduce}'s `emptyFold`, which states their contribution in closed form;
   * pass no `others` for the single-range case.
   */
  reduce<TS extends Scalar=T, U=TS>(
    callbackFn: (accumulator: U, value: TS, coords: IRange.CellCoords, range: IRange<T>) => U,
    initialValue: U,
    options?: IRange.IteratorOptions
  ): U;

  /**
   * Repeat the values in the range to a new width and height by repeating individual values.
   *
   * @param rows Number of times to repeat each value vertically.
   * @param columns Number of times to repeat each value horizontally.
   *
   * @remarks
   * **Note**: Arguments follow matrix convention `(rows, columns)`, not geometric order `(columns, rows)`.
   *
   * `[1, 2].repeat(1, 3)` → `[1, 1, 1, 2, 2, 2]`  *(expand horizontally)*
   * `[1, 2].repeat(2, 1)` → `[[1, 2], [1, 2]]`     *(expand vertically)*
   *
   * To repeat the entire range as a block, see {@link tile}.
   */
  repeat(
    rows: number,
    columns: number
  ): this;

  /**
   * Reflows the range's members into a new shape by flattened row-major ordinal — numpy's
   * `reshape`: the member at flattened position `i` lands at row `⌊i / columns⌋`, column
   * `i % columns`. Empty positions keep their ordinal (they reflow as gaps), so sparse ranges
   * stay sparse.

   * Contrast {@link resize}, which trims/pads in place WITHOUT reflowing, and {@link repeat} /
   * {@link tile}, which duplicate values.
   *
   * @param rows The new number of rows.
   * @param columns The new number of columns.
   */
  reshape(
    rows: number,
    columns: number
  ): this;

  /**
   * Returns a new range with values from another range overlaid at the given offset.
   * Where they overlap, other wins. If other extends beyond this, the range expands.
   *
   * @param other The other range or a 2D array.
   * @param offset The starting coordinates for the replacement. Default: { rowIndex: 0, colIndex: 0 }
   */
  replace<TS extends Scalar=T>(
    other: IRange | TS[][],
    offset?: IRange.CellCoords
  ): this;

  /**
   * Returns a new range either trimmed or expanded to the new rows and columns.
   *
   * @param rows The new number of rows of the range.
   * @param cols The new number of columns of the range.
   * @param fillValue If provided then when expanding the new cells will be filled with this value. DefaultValue `null`
   */
  resize(
    rows: number,
    cols: number,
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

  /**
   * Returns a sorted copy of the range along the given axis.
   * Equivalent to `this.take(this.argsort(order, axis), axis)`.
   *
   * @param order - `1` for ascending (default), `-1` for descending.
   * @param axis - Sort rows (`Row`, default) or columns (`Column`).
   */
  sort(
    order?: number,
    axis?: IRange.Axis
  ): this;

  /**
   * Similar to {@link choose}, but matches by value equality rather than by index.
   *
   * For each cell, searches `match` for the first element equal to the expression value and returns
   * the corresponding element from `from`. If no match is found, `defaultValue` is used (or the
   * original value from `this` if no default is provided).
   *
   * @param match Values to match against the expression range.
   * @param from Values to return for each corresponding match.
   * @param defaultValue Fallback value when no match is found.
   * @param selectFn Optional custom equality function. Defaults to strict equality (`===`).
   * @param options {@link IRange.ValuesOptions}
   *
   * @see {@link choose} for index-based dispatch.
   */
  select<TS extends Scalar = T>(
    match: IRange<TS> | TS | (IRange<TS> | TS)[],
    from: (IRange<TS> | TS)[],
    defaultValue?: IRange<TS> | TS,
    selectFn?: (value: TS, coords: IRange.CellCoords, matchValue: TS, matchCoords: IRange.CellCoords, range: IRange<T>) => MaybeError<boolean>,
    options?: IRange.ValuesOptions
  ): this;

  /**
   * Creates a `SparseBuilder` for efficiently updating sparsely populated values in a streaming low memory way.
   *
   * @param options {@link IRange.SparseBuilderOptions}
   *
   * @remarks
   * - **Ordering:** By default updates must be added in either row-major or column-major order, as specified
   * by the `axis` parameter, with major/minor coordinates increasing monotonically. Unless
   * `allowUnorderedWrites` is set to `true` out of order updates will result in an error.

   * - **Performance:**  Setting `axis` to `IRange.Axis.Column` is generally faster as it aligns with the internal data representation.
   * - **Performance:**  Setting `allowUnorderedWrites` adds a nominal performance overhead for all updates and will do a full apply when an
   *      out of order update is detected.
   *   The default `IRange.Axis.Row` is provided for compatibility with common spreadsheet APIs.
   *
   * @example
```typescript sparseBuilder
  const updatedRange = range.sparseBuilder()
    .pushAt(0, 0, 'A1')
    .pushAt(0, 1, 'B1')
    .build();
```
   */
  sparseBuilder<TS extends Scalar=T>(
    options?: IRange.TraversalAxis | IRange.SparseBuilderOptions
  ): IRange.SparseBuilder<TS>;

  /**
   * Returns a new range by selecting values at the given indices along the specified axis.
   * The output size along the selected axis equals `indices.length` — no resizing is applied.
   *
   * Indices refer to positions within this range (0-based, relative to origin).
   * The same index may appear multiple times to repeat rows or columns.
   *
   * @param indices The positions to select, in the desired output order.
   * @param axis The axis to select along. Default is {@link IRange.Axis.Row}
   *   (select rows). Pass {@link IRange.Axis.Column} to select columns.
   *
   * @remarks
   * Analogous to `np.take` in numpy and `torch.index_select` in PyTorch.
   *
   * @example
   * // Reverse rows
   * range.take([2, 1, 0])
   *
   * @example
   * // Select columns 0 and 2, dropping column 1
   * range.take([0, 2], IRange.Axis.Column)
   *
   * @example
   * // Repeat a row
   * range.take([0, 0, 1, 2])
   */
  take(
    indices: readonly number[],
    axis?: IRange.Axis
  ): this;

  /**
   * Tile the range to a new width and height by repeating blocks of values.
   *
   * @param rows Number of times to tile the range vertically.
   * @param columns Number of times to tile the range horizontally.
   *
   * @remarks
   * **Note**: Arguments follow matrix convention `(rows, columns)`, not geometric order `(columns, rows)`.
   *
   * `[1, 2, 3].tile(1, 3)` → `[[1, 2, 3, 1, 2, 3, 1, 2, 3]]`       *(tile horizontally 3×)*
   * `[1, 2, 3].tile(3, 1)` → `[[1, 2, 3], [1, 2, 3], [1, 2, 3]]`  *(tile vertically 3×)*
   *
   * To repeat individual values instead of blocks, see {@link repeat}.
   */
  tile(
    rows: number,
    columns: number
  ): this;

  /**
   * Returns the scalar value of the range if it is a 1×1 range, otherwise throws an error.
   */
  toScalar(): Scalar;

  /**
   * Change the type of default range coercion for the values in the range.
   *
   * @param type The new scalar type or value options.
   */
  toType(type: ScalarType | IRange.ValueOptions): this;

  /**
   * Returns the range transposed.
   */
  transpose(): this;

  /**
   * Iterate values.
   *
   * @param options {@link IRange.IteratorOptions}
   *
   * @remarks
   * Skips empty values by default.
   */
  values<TS extends Scalar=T>(
    options?: IRange.IteratorOptions
  ): IterableIterator<TS>;

  /**
   * Aligns this range with any number of other ranges or scalars under Excel's broadcasting
   * rules, calls `callbackFn` with the aligned values at each position, and returns the results as
   * a new range of the broadcast shape. This is the N-ary form of {@link broadcast}, and the numpy
   * idiom "align once, apply the kernel, never index"
   * (`np.frompyfunc(f, n, 1)(*np.broadcast_arrays(...))`).
   *
   * **Broadcasting Rules** (Excel's; {@link broadcast} shares them):
   * - A scalar or a 1×1 range FILLS: it is the same value at every position.
   * - A dimension of 1 TILES across the largest extent in that dimension (`tile`, default on).
   * - A shorter dimension PADS: past its extent the operand contributes `misalignValue`
   *   (default `#N/A`). The pad is an ARGUMENT, reaching the callback in that operand's slot for
   *   the callback to decide what it means; it is not a result written around the callback.
   * - The output is `max(rows)` × `max(cols)` over the operands, anchored at this range's origin.
   *
   * **Iteration is sparse.** The positions visited are the UNION of the operands' stored cells
   * after broadcast mapping; an operand with no cell at a visited position contributes its empty
   * value (`null`, or the empty of `type`). Where EVERY shaped operand is blank the answer depends
   * only on which operands are padded there, so those positions form REGIONS of equal padding,
   * one per combination of operand extents, and `blankRegions` says how they are answered:
   * `'each'` (default) calls the callback per position with its coordinates; `'once'` calls it once
   * per region (the pandas `SparseArray` rule: the kernel runs once on `fill_value` and per stored
   * entry otherwise) — the unpadded region's answer is what the result's empty positions read as,
   * a padded region is written as runs. A region call carries `coords` of
   * `{ rowIndex: -1, colIndex: -1 }`: it answers for many positions and no one of them. Under
   * `'once'` a stretch of stored positions holding one value across every operand is one call too.
   * An operand's own empty positions read as its empty value (a `fillEmpty`, an earlier
   * elementwise result) and are never visited one by one.
   *
   * @param others Additional ranges or scalar values to align with this range, in argument order.
   * @param callbackFn Called at each position with the aligned values (`values[0]` is this
   *   range's, `values[i + 1]` is `others[i]`'s), the position relative to the output, and this
   *   range. Returns the output value for that position. `values` is ONE buffer reused across
   *   calls (the ufunc inner-loop rule): read it, do not retain it.
   * @param options {@link IRange.ZipOptions}. `type` reads EVERY operand's members, and the
   *   empty, through that type; it defaults to this range's own type, as {@link broadcast} does.
   *   Pass `type: null` to read every operand raw.
   * @returns A new, untyped range of the broadcast shape (the values are the callback's, so this
   *   range's type does not describe them).
   *
   * @example
   * // A 3×1 beside a 1×3 is 3×3: rows tile from the first, columns from the second.
   * const sums = a.zip([b, 10], ([x, y, k]) => (x as number) + (y as number) + (k as number));
   */
  zip(
    others: (IRange | Scalar)[],
    callbackFn: (values: Scalar[], coords: IRange.CellCoords, range: IRange<T>) => Scalar,
    options?: IRange.ZipOptions
  ): this;

  /**
   * Returns a string representation of the range.
   */
  toString(): string;

  /**
   * Returns `true` if the range is empty.
   */
  isEmpty(): boolean;

  /**
   * Returns the size of the range this is the rows * columns.
   */
  get size(): number;

  /**
   * Returns an iterator that allows you to iterate over the individual values within the range.
   *
   * @remarks
   * For more advanced iteration, use {@link IRange.entries} or {@link IRange.forEach}.
   */
  [Symbol.iterator](): IterableIterator<Scalar>;

  /**
   * Use for introspection.
   */
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

  /**
   * Options for controlling iteration behavior.
   */
  /**
   * Options for {@link IRange.indexOf}.
   */
  export interface IndexOfOptions {
    /**
     * Search from the last member back, answering the last match.
     *
     * @defaultValue `false`
     */
    reverse?: boolean;
  }

  export interface IteratorOptions extends IRange.ValueOptions {
    /**
     * The direction of the iteration.
     *
     * @defaultValue `IRange.Axis.Row`
     *
     * @remarks
     * If `axis` is set to `'fastest'`, the implementation will automatically choose the fastest axis
     * for iteration based on the internal data layout of the range.
     * This can provide performance benefits without requiring the caller to specify the axis,
     * especially when the optimal axis is not known in advance.
     */
    axis?: IRange.TraversalAxis;
    /**
     * The bounds of the iteration.
     *
     * @defaultValue `The entire range`
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
     * Skips rows of the range: given the next row that would be read, answers the row to read
     * instead - the same row when it is read, or the next one that is (the previous, when
     * `reverse`).
     *
     * @param index The 0-based row about to be read.
     * @param reverse Whether the read runs from the last row back.
     * @returns The row to read, at or past `index`.
     *
     * @remarks
     * A skipped cell is not visited, reads as empty and is left out of the statistics; the shape
     * of the range is unchanged. `SUBTOTAL` reads a range this way when it skips hidden rows.
     */
    processRowSkip?: (index: number, reverse?: boolean) => number;
    /**
     * Skips columns of the range, as {@link processRowSkip} skips rows.
     */
    processColumnSkip?: (index: number, reverse?: boolean) => number;
    /**
     * Useful for callback functions that want a this.
     */
    thisArg?: any
  }

  /**
   * Options for a fold — {@link IRange.alignReduce}.
   */
  export interface ReduceOptions<U=any> extends IRange.IteratorOptions {
    /**
     * Folds the positions the iteration never visited — the cells that are empty on EVERY side —
     * in a single call, given how many there are.
     *
     * @param accumulator The accumulator after every visited position has been folded.
     * @param count How many positions of this range's shape went unvisited. Never `0`: the fold
     * is skipped entirely when the iteration was dense.
     *
     * @remarks
     * A sparse fold visits stored members only, which is the whole point of it and is why
     * `SUM(A:A)` is not a million calls. But a reducer whose answer DEPENDS on the blanks —
     * `COUNTIF(A:A,"<>10")` is 1,048,576 — needs their contribution, and iterating them to get
     * it gives the cost back. The contribution is the same term repeated, so it is stated in
     * closed form here and applied once.
     *
     * This is the caller's to supply because only the caller knows the fold: `COUNTIF` adds the
     * count, `SUMIF` and `MAXIFS` are unchanged by a blank and pass nothing at all. It is the
     * open-ufunc analogue of numpy's `initial=` — numpy hard-codes the identity per reduction
     * because its set is closed, and this cannot.
     *
     * Omit it and the unvisited positions contribute nothing, which is the behavior every fold
     * had before this option existed.
     */
    emptyFold?: (accumulator: U, count: number) => U;
  }

  /**
   * Union type for coercion parameters.
   */
  export type CoerceParams = ScalarType[] | (
    (
      fromValue: Scalar,
      fromType: ScalarType,
      defaultCoerce: (value: Scalar, type: ScalarType) => Scalar,
      range: IRange
    ) => Scalar
  );

  /**
   * Passed to various methods to control coercion behavior when getting or iterating values.
   */
  export interface ValueOptions {
    /**
     * Specifies the target type for coercion and filtering when getting or
     * iterating values.
     *
     * @defaultValue The scalar type of the `IRange` itself (`getType()`)
     *
     * @remarks
     * - Values matching the type pass through unchanged.
     * - Values coercible to the type are coerced.
     * - If not set, the range's own scalar type (`getType()`) is used.
     * - If the range has no scalar type, or set to `null` explicitly,
     *   no coercion or filtering is performed.
     */
    type?: ScalarType | null;

    /**
     * Overrides default coercion behavior per type.
     * When a value cannot be coerced, {@link onError} determines the fallback.
     */
    coerce?: IRange.CoerceParams;

    /**
     * If `true`, coercion failure produces `#VALUE!` rather than silently skipping the value.
     *
     * @defaultValue `false`
     */
    errorOnInvalidCoercion?: boolean;

    /**
     * What to do when the visited value is a `FormulaError`.
     *
     * @defaultValue `throw`
     *
     * @remarks
     * 'throw' = throw error.
     * 'ignore' = silently skip the value.
     * 'value' = return a specific error value (default `#VALUE!`).
     * 'function' = custom handler; use this to return a specific error value.
     */
    onError?: 'throw' | 'ignore' | 'value' | ((error: FormulaError.Known) => void);
  }

  export interface GetValuesOptions extends IRange.ValueOptions {
    /**
     * The maximum number of rows of the array.
     */
    maxRows?: number;
    /**
     * The maximum number of columns of the array.
     */
    maxCols?: number;
    /**
     * If true will include trailing empties.
     */
    trailingEmpties?: boolean;
    /**
     * Allow for this to be set. DefaultValue `IRange.Axis.Row`
     */
    axis?: IRange.Axis;
    /**
     * If provided then before return the callback will be visited for each cell.
     */
    onValue?: (value: Scalar, row: number, column: number, range: IRange) => Scalar;
  }

  /**
   * Options used during range over range operators.
   */
  export interface ValuesOptions extends IRange.ValueOptions {
    /**
     * Controls how misaligned ranges are handled during broadcasting.
     *
     * - By default, `broadcast()` follows strict alignment rules like NumPy and will
     *   throw an error if the input ranges cannot be broadcasted together.
     * - When `misalignValue` is provided, `broadcast()` will instead follow Excel's behavior:
     *   - It finds the **largest valid intersection** of the ranges.
     *   - It expands the result to the **union of both range sizes**.
     *   - Any cells that do not have valid corresponding values from the inputs
     *     will be filled with `misalignValue` instead of causing an error.
     * - `zip()`, `mask()` and `choose()` always pad and default it to `#N/A`; in `zip()` the pad
     *   is delivered to the callback as that operand's value rather than written as the result.
     *
     * @example
     * // Throws an error if A and B are not naturally broadcast-compatible
     * const result = A.broadcast(B, (a, b) => a + b);
     *
     * @example
     * // Expands to union size and fills gaps with "#N/A" instead of erroring
     * const result = A.broadcast(B, (a, b) => a + b, { misalignValue: "#N/A" });
     */
    misalignValue?: Scalar;
  }

  /**
   * Options used during broadcasting.
   */
  export interface BroadcastOptions extends IRange.ValuesOptions {
    /**
     * Coerces values from `other` to the specified type before applying the callback.
     * Overrides the type inference that would otherwise be derived from `other`.
     */
    otherType?: ScalarType;
  }

  /**
   * Options for {@link IRange.map}.
   */
  export interface MapOptions extends IRange.IteratorOptions {
    /**
     * How the positions the range does not store are answered.
     *
     * @defaultValue `'each'`
     *
     * @remarks
     * `'each'` is the sparse walk: an empty position is not visited (or, with `includeEmpty`,
     * visited with its coordinates). `'once'` calls the callback a single time for every empty
     * position, with `coords` of `{ rowIndex: -1, colIndex: -1 }` and the value an empty reads
     * as, and every one of them takes that answer — the {@link IRange.zip} rule. Under `'once'` a
     * stretch of stored positions holding one value is also one call; a callback that reads only
     * its value gets that on its own (it cannot tell), and one that reads `coords` opts in here.
     */
    blankRegions?: 'each' | 'once';
  }

  /**
   * Options for {@link IRange.zip}.
   */
  export interface ZipOptions extends IRange.ValuesOptions {
    /**
     * Whether a dimension of 1 tiles across the largest extent in that dimension.
     *
     * @defaultValue `true`
     *
     * @remarks
     * Off, a dimension of 1 is a short dimension like any other and pads `misalignValue` past
     * its one position: the `MAP` rule, where a 1-row array is not stretched.
     */
    tile?: boolean;
    /**
     * How the positions where EVERY shaped operand is blank are answered.
     *
     * @defaultValue `'each'`
     *
     * @remarks
     * Such positions form regions of equal padding (see {@link IRange.zip}). `'each'` visits every
     * one with its coordinates; `'once'` calls the callback a single time per region, with
     * `coords` of `{ rowIndex: -1, colIndex: -1 }`, and writes the region as runs. An explicit
     * option rather than a callback-arity gate, so a callback that reads `coords` for the positions
     * it IS given can still have the blanks answered in one call.
     */
    blankRegions?: 'each' | 'once';
  }

  /**
   * Options used during masking.
   */
  export interface MaskOptions extends IRange.ValuesOptions {
    /**
     * Determines whether a condition value is considered true.
     *
     * @defaultValue `(cond) => cond === true`
     */
    isTrue?: (cond: Scalar, cell: IRange.CellCoords) => boolean;

    /**
     * Value substituted for empty cells during masking.
     *
     * @defaultValue `null`
     */
    emptyValue?: Scalar;
  }

  /**
   * Entry for a Range iterator or visiting.
   */
  export interface Entry<T extends Scalar=Scalar> {
    /**
     * The value of the cell for this entry.
     */
    value: T;
    /**
     * Coordinates of the cell for this entry.
     *
     * @remarks
     * This should not be used as keys. For performance reasons the same object may be reused across iterations and should be treated as immutable.
     */
    coords: Readonly<IRange.CellCoords>;
  }

  /**
   * The direction to traverse a range, either by row or by column,
   * or let the implementation decide the fastest way.
   */
  export type TraversalAxis = IRange.Axis | 'fastest';

  export interface TraversalAxisOptions {
    /**
     * The direction of the write.
     *
     * @defaultValue `IRange.Axis.Row`
     */
    axis?: TraversalAxis;
  }

  /**
   * Options for the {@link IRange.sparseBuilder}.
   *
   * @remarks
   * See {@link IRange.sparseBuilder} for details and ordering/performance tradeoffs.
   */
  export interface SparseBuilderOptions extends TraversalAxisOptions { }

  /**
   * A Builder for setting values in a streaming sparse grid.
   *
   * @template T The type of values stored within the tuples.
   *
   * @remarks
   * Coordinates must increase monotonically in the current axis — row then
   * column in row-major mode, column then row in column-major mode.
   */
  export interface SparseBuilder<T extends Scalar=Scalar> {
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
     * @param value The values to add. Accepts an {@link IRange} or a native array.
     * 2D ranges are flattened in row-major order.
     * @throws `Error` If the point is out of order compared to previously added points
     * (within the same row).
     */
    pushMultipleAt(row: number, col: number, value: IRange | T[]): this;
    /**
     * Apply the updates.
     */
    build(): IRange<T>;
  }

  /**
   * Specifies a single direction for the range.
   */
  export const Axis = {
    Column: 'column',
    Row: 'row'
  } as const;
  export type Axis = typeof Axis[keyof typeof Axis];

  /**
   * Allows for either direction or both. (But not none).
   */
  export const AxisSelection = {
    ...IRange.Axis,
    Both: 'both'
  } as const;
  export type AxisSelection = typeof AxisSelection[keyof typeof AxisSelection];

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
   * The coordinates of an Range in a 2D space.
   * The rowStart and colStart must be less than or equal to rowEnd and colEnd respectively.
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
    /**
     * An optional identifier for the 2D space these coordinates are relative to.
     *
     * @remarks
     * `scope` was added after the coords reuse/scratch patterns were established, so it is the
     * field a reused object is most likely to carry STALE. The contract: a function that writes
     * its result into a caller-supplied reuse object must write `scope` unconditionally —
     * `null` when the result is unscoped, never left over from the previous occupant
     * (a leaked scope silently re-targets the coords at another sheet's grid). Writing it
     * conditionally is only safe on a freshly created object. Geometry-only helpers that
     * never read or write `scope` (CoordUtils) are exempt; their scope-aware wrappers own it.
     */
    scope?: string | null;
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
    /**
     * An optional identifier for the 2D space these coordinates are relative to.
     * See the remark on {@link Coords.scope} for the reuse-object contract.
     */
    scope?: string | null;
  }

  /**
   * Adds `fixed flags` to `IRange.Coords`.
   */
  export interface FixableCoords extends IRange.Coords {
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
   * A address can be Either a `Partial<IRange.FixableCoords>`, a `FormulaError.Known` or a named range `string`.
   */
  export type Address = Partial<IRange.FixableCoords> | FormulaError.Ref | FormulaError.Name | string;

  /**
   * Serialize coords.
   *
   * @remarks
   * A single coords, several coords, or an address string. Items that anchor to several ranges
   * (data validations, conditional formats, protected ranges) serialize as a comma-separated
   * string (`'A1:B2,D5:D9'`); the coords-array form is accepted on load but never emitted.
   */
  export type JSONCoords = IRange.Coords | readonly IRange.Coords[] | string;

  /**
   * A serialized address-value pair as an object.
   */
  export interface JSONReferenceEntry<J=any> {
    /**
     * Range Address
     */
    r: JSONCoords,
    /**
     * Value
     */
    v: J
  };

  /**
   * A serialized address-value pair as an array tuple.
   */
  export type JSONReferenceTuple<J=any> = [range: JSONCoords, value: J];
  /**
   * A serialized address-value pair — either object or tuple form.
   *
   * @see {@link JSONReferenceEntry} {@link JSONReferenceTuple}
   */
  export type JSONReference<J=any> = JSONReferenceEntry<J> | JSONReferenceTuple<J>;
}