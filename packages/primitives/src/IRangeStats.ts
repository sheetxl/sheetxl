import { type IRange } from './IRange';
import { type Scalar } from './Scalar';
import { type ScalarType } from './ScalarType';
import { type FormulaError } from './FormulaError';

/**
 * Provides statistical summaries and queries over a range of cell values.
 *
 * @remarks
 * Prefer `IRangeStats` over iterating cells manually when you need aggregate or order-statistic
 * results. Implementations operate directly on the engine's internal value storage — no
 * intermediate array allocation is needed for most operations — and results are cached per
 * calculation cycle, so repeated calls within the same cycle are effectively free.
 *
 * This makes `IRangeStats` the right choice for:
 * 1. Formula fast-path calculations (e.g. `SUM`, `LARGE`, `RANK`, `PERCENTILE`)
 * 2. Status-bar aggregates (sum, count, average, min, max)
 * 3. AutoFilter distinct-value dropdowns and filter-match lookups
 * 4. Data-wrangling and profiling UIs
 * 5. Quick introspection without triggering a full range scan
 */
export interface IRangeStats {
  /**
   * Returns the bounding box of the cells these stats cover, in the coordinates of the scanned
   * grid.
   *
   * @returns The smallest rectangle containing every covered coordinate, or `null` when the
   * stats cover nothing.
   *
   * @remarks
   * Stats over several areas (a multi-area range, or a composite over several ranges) return the
   * union box, which can include cells outside every area — and a composite's children may sit
   * on different sheets, so its box is a shape, not an address. `getSize()` is the exact cell
   * count; this is where those cells are.
   */
  getCoords(): IRange.Coords | null;
  /**
   * Returns the total number of cells in the range, including empty cells.
   *
   * @remarks
   * This is the raw cell count (rows × columns across all coords), not the count of populated
   * values. To count only non-empty cells use `getCount()`. To count only numbers use
   * `getAggregates().numericalCount`.
   */
  getSize(): number;
  /**
   * Returns the total count of non-empty values in the range.
   *
   * @remarks
   * Counts all value types — numbers, strings, booleans, errors. Blank/empty cells are excluded.
   * To count only numbers, use `getAggregates().numericalCount`.
   *
   * Never throws on error values — errors are population here, not faults — regardless of
   * the `onError` iterator policy the stats were created with (same contract as
   * {@link getTypedCounts}).
   */
  getCount(): number;
  /**
   * Returns common numeric summary statistics: sum, min, max, average, variance, stdDev.
   *
   * @param options Per-call overrides of the iterator options the stats were created with.
   *   The primary use is `{ onError: 'ignore' }` — reporting surfaces degrade (aggregate the
   *   numeric population, count the errors elsewhere) where the default `'throw'` policy treats
   *   an error value as a fault. Results for an options-carrying call are not cached on the
   *   instance; the shared segment cache still applies.
   *
   * @remarks
   * All values in the result are composable: sub-range results can be merged without re-scanning
   * the data, which makes this efficient even over very large ranges.
   *
   * Returns `null` for numeric fields when the range contains no numbers.
   */
  getAggregates(options?: IRange.IteratorOptions): Readonly<IRangeStats.Aggregates>;
  /**
   * Returns the sum as `SUM` reports it — {@link getAggregates}'s `sum` with Excel's
   * cancellation-to-zero rule applied.
   *
   * @param total A total the caller accumulated across SEVERAL stats instances. Omit for a
   *   single range, where this range's own sum is used.
   *
   * @returns `0` when the total cancelled; otherwise the total unchanged.
   *
   * @remarks
   * Collapses a total to exactly zero when it lands at least 50 binary exponents below the
   * operands that produced it, so `SUM(0.1,0.2,-0.3)` is `0` rather than `5.55111512312578E-17`.
   * Use this wherever you mean "the number SUM shows" — a status bar, a report
   * total, a formula. Use `getAggregates().sum` where you mean the true total of the data.
   *
   * The two genuinely differ, and neither is a rounding of the other:
   *
   * - The rule is RELATIVE, never an absolute floor. `SUM(2E-13,-1E-13)` is `1E-13`.
   * - It applies to `SUM`, `AVERAGE`, `AVERAGEA`, `SUBTOTAL(1｜9｜101｜109)`, `AGGREGATE(1｜9)`
   *   and `PERCENTOF`, and to NOTHING else — `SUMIF`, `SUMPRODUCT`, `SERIESSUM`, `DSUM`, the
   *   `SUMX2MY2` family and every binary operator all keep the residue over the same values.
   *   That is why this is a method you call and not a change to `getAggregates`.
   * - `AVERAGE` divides THIS, not the raw sum: snapping the mean instead is wrong.
   *
   * It is also cheap when it does not fire: a bound derived from `min`/`max` rejects any
   * ordinary total without re-reading the range.
   *
   * **Multiple ranges.** The rule applies on the *final* accumulation step, so a total
   * spanning several ranges must be judged against the range holding the LAST value — pass the
   * running total as `total` and call this on that range. (Snapping each range separately gets
   * `SUM(A1:A3,0)` and `SUM(A1:A1,A2:A2,A3:A3)` wrong in opposite directions.) A composite
   * stats instance already does this across its children.
   */
  getSnappedSum(total?: number): number;
  /**
   * Returns order-statistic queries over the numeric values in the range: percentiles, quartiles,
   * rank, k-th largest/smallest, and binary search (floor/ceiling).
   *
   * @remarks
   * Use this when the *position* of a value within the sorted population matters, not just its
   * aggregate contribution.
   *
   * **Prefer this over `getRanked`** when working with numbers and you need an exact position
   * (k-th value), interpolated quantile, or rank of a known value. Non-numeric values are
   * excluded automatically.
   *
   * Also provides `findFloor` / `findCeiling` for binary-search lookups for numeric values.
   */
  getSortedNumbers(): IRangeStats.ISortedNumbers;
  /**
   * Returns the top-N values in the range as a lazily-evaluated iterator, with optional
   * filtering, custom comparison, and deduplication.
   *
   * @remarks
   * Use this when you need a *short list* of the highest or lowest values across any scalar type
   * (numbers, strings, dates via custom `compareFn`), typically for display purposes such as
   * StatusBar top-values, AutoFilter previews, or data-profiling UIs.
   *
   * **Prefer `getSortedNumbers`** when you need exact numeric rank, percentile, or a full
   * sorted population — `getRanked` is not designed for whole-population order statistics.
   * The key distinction: `getRanked` is *bounded* (limited output, any type);
   * `getSortedNumbers` is *complete* (all numeric values, full sorted order).
   */
  getRanked(options?: IRangeStats.GetRankedOptions): IterableIterator<Scalar>;
  /**
   * Returns the distribution of distinct values in the range — how many times each unique
   * value appears — along with unique-value enumeration and occurrence counts.
   *
   * @remarks
   * Use this for filter dropdowns (AutoFilter distinct values), data-profiling summaries,
   * pivot-like grouping, and any formula that needs `COUNTIF`-style frequency data
   * (`MODE`, `FREQUENCY`). Provides pandas-like `value_counts()` behavior.
   *
   * For purely numeric summary statistics use `getAggregates()`.
   * For sorted-order queries (rank, percentile) use `getSortedNumbers()`.
   */
  getFrequencies(options?: IRangeStats.GetFrequenciesOptions): IRangeStats.IFrequency;
  /**
   * Returns a breakdown of how many cells contain each native value type: number, string,
   * boolean, error, rich data, and blank.
   *
   * @param types Restrict the result to only the specified types. Omit to count all types.
   *
   * @remarks
   * Use this for data-profiling UIs ("this column has 420 numbers, 3 errors, 12 blanks"),
   * schema inference, and formula validation helpers. Covers the native spreadsheet scalar
   * types; does not distinguish semantic sub-types such as dates (which are stored as numbers).
   *
   * - Every requested type (all types when omitted) is present with an explicit count —
   *   a `0` is a fact about the range, a missing key would be ambiguous.
   * - Blanks report under {@link ScalarType.Null}: total cells minus non-empty values. A cell the
   *   range skips ({@link IRange.IteratorOptions.processRowSkip}) is not a blank; it is not counted.
   * - Never throws on error values — errors are population here, not faults — regardless of
   *   the `onError` iterator policy the stats were created with.
   */
  getTypedCounts(types?: readonly ScalarType[]): { [key in ScalarType]?: number };
  /**
   * For runtime type checking.
   */
  readonly isIRangeStats: true;
}

export namespace IRangeStats {
  export const Aggregate = {
    /**
     * A count of all non-empty values — numbers, strings, booleans, and errors.
     *
     * @remarks
     * The same population as {@link IRangeStats.getCount}. For numbers only use
     * {@link IRangeStats.Aggregate.NumericalCount}.
     */
    Count: 'count',
    /**
     * A count of number values.
     */
    NumericalCount: 'numericalCount',
    /**
     * The sum of numeric values.
     */
    Sum: 'sum',
    /**
     * The average of numeric values.
     */
    Average: 'average',
    /**
     * The standard deviation of numeric values.
     */
    StdDev: 'stdDev',      // useful for Average option in data validation
    /**
     * The standard deviation of the entire population of numeric values.
     */
    PopulationStdDev: 'stdDevP',
    /**
     * The variance of numeric values.
     */
    Variance: 'var',
    /**
     * The variance of the entire population of numeric values.
     */
    PopulationVariance: 'varP',
    /**
     * The minimum numeric value.
     */
    Min: 'min',
    /**
     * The maximum numeric value.
     */
    Max: 'max',
    // skewness?: number;
    // kurtosis?: number;
  } as const;
  export type Aggregate = typeof Aggregate[keyof typeof Aggregate];

  /**
   * Contains the numeric aggregate results.
   *
   * @remarks
   * Every {@link IRangeStats.Aggregate} key is always present — a `0` count or a `null`
   * numeric field is a fact about the range; a missing key would be ambiguous (the same
   * contract as {@link IRangeStats.getTypedCounts}).
   *
   * A numeric field is `null` when no numbers were encountered; `var`/`stdDev` additionally
   * require at least 2 numbers. The two counts are never `null`.
   */
  export type Aggregates = {
    [K in Exclude<IRangeStats.Aggregate, 'count' | 'numericalCount'>]: number | null;
  } & {
    count: number;
    numericalCount: number;
  };

  /**
   * Returns sorted numeric values in a range.
   *
   * @remarks
   * Sorting requires materializing the full numeric population (O(n log n), one allocation).
   * Unlike `Aggregates`, sorted views are **not composable across sub-ranges**.
   *
   * Covers the following functions (all share one sort per coords per calc cycle):
   * - `LARGE`, `SMALL`
   * - `MEDIAN`, `PERCENTILE`, `PERCENTILE.INC`, `PERCENTILE.EXC`
   * - `QUARTILE`, `QUARTILE.INC`, `QUARTILE.EXC`  (q1 = k=0.25, q3 = k=0.75)
   * - `RANK`, `RANK.EQ`, `RANK.AVG`
   * - `PERCENTRANK`, `PERCENTRANK.INC`, `PERCENTRANK.EXC`
   * - `MATCH type 1/-1`, `VLOOKUP sorted`, `XLOOKUP` (via `findFloor`/`findCeiling`)
   */
  export interface ISortedNumbers {
    /**
     * Returns the k-th largest numeric value (1-based).
     *
     * @param k The rank of the value to return, where 1 is the largest value. A fractional rank
     *          becomes a 0-based index before it truncates — over five values `k = 2.5` is the
     *          THIRD largest, not the second.
     * @returns `null` if k is out of range.
     *
     * @remarks
     * Equivalent to Excel `LARGE(array, k)`.
     */
    getLarge(k: number): number | null;
    /**
     * Returns the k-th smallest numeric value (1-based).
     *
     * @param k The rank of the value to return, where 1 is the smallest value. A fractional rank
     *          becomes a 0-based index before it truncates.
     * @returns `null` if k is out of range.
     *
     * @remarks
     * Equivalent to Excel `SMALL(array, k)`.
     */
    getSmall(k: number): number | null;
    /**
     * Returns the value at quantile k.
     *
     * @param k Quantile in [0, 1] inclusive (or (0, 1) exclusive). Maps directly to Excel's k parameter.
     *          - k=0.5  → `MEDIAN`
     *          - k=0.25 → Q1 (`QUARTILE` quart=1)
     *          - k=0.75 → Q3 (`QUARTILE` quart=3)
     * @param exclusive If true, uses the exclusive interpolation formula (PERCENTILE.EXC / QUARTILE.EXC).
     * @returns The value at the specified quantile, or `null` if k is out of range or no numbers in range.
     *
     * @remarks
     * Equivalent to Excel `PERCENTILE.INC` (exclusive=false) or `PERCENTILE.EXC` (exclusive=true).
     */
    getPercentile(k: number, exclusive?: boolean): number | null;
    /**
     * Returns the rank of value x in the sorted population (1-based, descending by default).
     *
     * @param x The value whose rank to find.
     * @param descending If true (default), rank 1 = largest. If false, rank 1 = smallest.
     * @param average If true, tied values receive the average of their rank positions (RANK.AVG).
     * @returns The rank of x, or `null` if x is not found or no numbers in range.
     *
     * @remarks
     * Equivalent to Excel `RANK.EQ` (average=false) or `RANK.AVG` (average=true).
     */
    getRankOf(x: number, descending?: boolean, average?: boolean): number | null;
    /**
     * Returns the fractional rank of value x as a value in [0, 1].
     *
     * @param x The value whose percent rank to find. A value between two members is interpolated;
     * one outside the population is not found.
     * @param exclusive If true, uses exclusive formula (0 and 1 are excluded).
     * @param significance Number of DECIMAL PLACES to TRUNCATE the result to — despite what
     * Excel's help calls the argument, it is not significant digits and it does not round.
     * Truncated toward zero first (1.9 places means 1), and must be at least 1. Omit it for the
     * exact untruncated rank, which is also the only form that cannot fail.
     * @returns The percent rank of x; `null` if x is not found or there are no numbers in range.
     */
    getPercentRankOf(
      x: number,
      exclusive?: boolean,
      significance?: number
    ): number | FormulaError.Known | null;
    /**
     * Returns all numeric values in the range, sorted ascending.
     */
    getValues(): readonly number[];
    /**
     * Binary search: returns the largest value ≤ x, or `null` if none exists.
     *
     * @param x The value to search for.
     *
     * @remarks
     * Used by `MATCH type 1` and `VLOOKUP sorted=true` (approximate match, sorted ascending).
     */
    findFloor(x: number): number | null;
    /**
     * Binary search: returns the smallest value ≥ x, or `null` if none exists.
     *
     * @param x The value to search for.
     *
     * @remarks
     * Used by `MATCH type -1` (sorted descending approximate match).
     */
    findCeiling(x: number): number | null;
  }

  /**
   * Options for finding frequency statistics in a range.
   *
   */
  export interface GetFrequenciesOptions {
    /**
     * The maximum distinct values to count.
     *
     * @defaultValue No limit
     */
    limit?: number;
    /**
     * If `true` blank will be given its own distinct count.
     *
     * @defaultValue `false`
     */
    includeBlanks?: boolean;
    /**
     * Custom function to define distinctness.
     *
     * @defaultValue Uses internal canonicalization (type + value comparison)
     */
    keyFn?: (v: Scalar) => string | number;
    /**
     * Custom comparison used for ordering results (e.g. for UI display).
     *
     * @defaultValue Internal default comparison
     */
    // TODO - align to SortCollators
    compareFn?: (a: Scalar, b: Scalar) => number;
    /**
     * If `true` the ordering is reversed.
     *
     * @defaultValue `false`
     */
    reverse?: boolean;
    /**
     * Optionally restricts the population (e.g. numbers only).
     */
    filterFn?: (v: Scalar) => boolean;
  }

  /**
   * Frequency distribution results for a range.
   *
   * @remarks Provides pandas-like value_counts() functionality.
   */
  export interface IFrequency {
    /**
     * Returns an iterator of distinct values found (respecting options).
     *
     * @remarks Iterator can be consumed only once.
     *
     * Example:
     *   Data: ["Red", "Red", "Red", "Blue", "Blue", "Green"]
     *   getUniqueValues() -> Iterator("Red", "Blue", "Green")
     */
    getUniqueValues(): IterableIterator<Scalar>;
    /**
     * Returns the frequency (occurrence count) of a specific value.
     *
     * @param value The value to look up
     * @returns Number of times the value appears, or 0 if not found
     */
    getFrequency(value: Scalar): number;
    /**
     * Returns unique values with their frequencies as an iterator.
     *
     * @param options.sortBy How to sort results
     * @param options.descending Sort direction
     * @returns Iterator of [value, count] tuples, sorted by frequency (descending) by default
     *
     * @remarks
     * - First item is the mode (most frequent value)
     * - Values of equal count hold the order they were first seen
     * - Matches pandas value_counts() behavior
     * - Iterator can be consumed only once
     *
     * @example
     * ```typescript
     * // Get mode (most common)
     * const [mode, count] = stats.getValueCounts().next().value;
     *
     * // Get top 3
     * const top3 = Array.from(stats.getValueCounts()).slice(0, 3);
     *
     * // All values for dropdown
     * const all = Array.from(stats.getValueCounts());
     * ```
     */
    getValueCounts(options?: {
      sortBy?: 'value' | 'frequency';  // default: frequency
      descending?: boolean;            // default: true
    }): IterableIterator<[Scalar, number]>;
    /**
     * Total count of distinct values in the range (respecting options).
     */
    getUniqueCount(): number;
    /**
     * Number of cells visited in the source range iteration.
     *
     * @remarks May be less than total range size if `limit` was hit.
     */
    getVisitedCount(): number;
    /**
     * Total count of values in the range (respecting options).
     */
    getTotalCount(): number;
    /**
     * Indicates if results were truncated due to the `limit` option.
     *
     * @remarks When `true`, there may be additional distinct values that weren't counted.
     * This is a convenience method (visitedCount < totalCount)
     */
    isTruncated(): boolean;
    /**
     * Returns the bounding box of a value's occurrences, in the coordinates of the scanned grid.
     *
     * @param value The value to look up
     * @returns The smallest rectangle containing every occurrence, or `null` when the value was
     * not found, is blank, or the frequencies were merged from several ranges (no single grid).
     *
     * @remarks
     * Tracked by the same scan that counts, so it costs nothing extra. A box whose cell count
     * equals {@link getFrequency} is a contiguous block — the value lives in exactly that
     * rectangle; a larger box means the occurrences are scattered within it.
     */
    getExtent(value: Scalar): IRange.Coords | null;
  }

  /**
   * Options for finding top values in a range.
   */
  // TODO - Align these with GetFrequenciesOptions
  export interface GetRankedOptions {
    /**
     * Maximum number of values to return.
     *
     * @defaultValue `10`
     */
    limit?: number;
    /**
     * If `true` blank will be considered when ordering.
     *
     * @defaultValue `false`
     */
    includeBlanks?: boolean;
    /**
     * If `true` duplicate values collapse to a single entry.
     *
     * @defaultValue `false`
     */
    distinct?: boolean;
    /**
     * Custom comparison used for ordering results (e.g. for UI display).
     *
     * @defaultValue Internal default comparison
     */
    // TODO - align to SortCollators
    compareFn?: (a: Scalar, b: Scalar) => number;
    /**
     * If `true` the ordering is reversed (lowest values first).
     *
     * @defaultValue `false`
     */
    reverse?: boolean;
    /**
     * Optionally restricts the population (e.g. numbers only).
     */
    filterFn?: (v: Scalar) => boolean;
  }
}