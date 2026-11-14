import { type Scalar } from './Scalar';
import { type FormulaError } from './FormulaError';
import { type IRange } from './IRange';
import { type IReferenceRange } from './IReferenceRange';
import { type IFunction } from './IFunction';
import { type IFunctionArguments } from './IFunctionArguments';
import { type IRuntime } from './IRuntime';
import { type IRichData } from './IRichData';

/**
 * Everything a formula function is allowed to know about the world outside its arguments.
 *
 * @remarks
 * Formula functions are pure — they cannot reach the workbook, the sheet they sit on, or
 * the clock. `FormulaContext` is the one channel that gives them sheet data, cell
 * coordinates, date and number parsing, and evaluation hints without giving up that purity.
 *
 * Import it and call its methods directly; there is nothing to construct or thread through
 * arguments. Every call is already scoped to the cell being evaluated:
 *
 * ```typescript
 * import { FormulaContext } from '@sheetxl/primitives';
 *
 * export function ROWNUMBER(): number {
 *   return FormulaContext.getRow() + 1;
 * }
 * ```
 *
 * ### Capabilities
 *
 * | Category | Key methods |
 * |---|---|
 * | Evaluation lifecycle | `getRow`, `getColumn`, `getEntireCoords`, `getRandom` |
 * | Answering later | `defer` |
 * | Argument reflection | `getArgs` |
 * | Output hints | `formatResults` |
 * | Range construction | `createRange`, `flattenAreas`, `filterHidden` |
 * | Dynamic references | `getReference`, `getValueAt`, `getFormulaAt`, `getSpillAt` |
 * | Function lookup | `getFunction` |
 * | Dates | `getNow`, `toSerialDate`, `fromSerialDate`, `getDateParts`, `getSerialDate`, `parseAsDate`, `parseAsSerialDate`, `isValidDate` |
 * | Coercion | `parseAsNumber`, `parseAsLiteral`, `toText`, `compare` |
 * | Criteria | `createCriteria`, `dbQuery` |
 * | Grouping | `createPivot`, `getPivotAt` |
 * | Sheet introspection | `getSheetCount`, `getSheetIndex`, `getAddress`, `getNumberFormat` |
 *
 * ### Implementors
 *
 * The calculation engine provides the implementation. Third-party code (UDF packages, test
 * harnesses) may supply its own for isolated evaluation or unit testing.
 */
export interface IFormulaContext {
  /**
   * Creates a range to return as a dynamic array result.
   *
   * @param rows The number of rows of the range. Default is 0.
   * @param columns The number of columns of the range. Default is 0.
   * @param values A single value to fill the range with, a grid of values, or a callback
   * invoked per cell. Default is `null` (an empty range).
   */
  createRange<TS extends Scalar=Scalar>(
    rows?: number,
    columns?: number,
    values?: Scalar | Scalar[][] | ((value: TS, coords: IRange.CellCoords, range: IRange<TS>) => TS)
  ): IRange;

  /**
   * One range over every cell of a `ReportType` slot's argument — the AREAS of a reference union
   * folded into a single column, or the range returned unchanged.
   *
   * @param value The argument as it arrived: a range, or one range per area.
   *
   * @remarks
   * A union `(A1:A5,B1:B2)` reaches a {@link IFunction.ParameterTypeJSON.reportType} slot as one
   * `IRange` per area. Functions that answer over it do so because they walk MEMBERS and a union
   * simply has more of them — `LARGE((DA1:DA5,DK1:DK2),2)` is the second largest of all seven
   * cells. This is that walk, and it is a helper rather than a marshalling step on purpose:
   * flattening is a shared reducer the bodies opt into, which is why the
   * same union is flattened by `LARGE`, refused by `SUMPRODUCT` and answered `#REF!` by `ROWS`.
   *
   * The result is a single column in area order, row-major within each area. SHAPE IS NOT
   * PRESERVED — a union has none. A body that needs an extent must ask
   * {@link IFunctionArguments.getAreaCountAt} and answer for itself.
   */
  flattenAreas(value: IRange | IRange[]): IRange;

  /**
   * Returns coordinates as an address string.
   *
   * @param coords The coordinates to get the address for. If not provided the current position is used.
   * @param r1c1 If `true`, the address will be in R1C1 format. Default is `false` (A1 format).
   */
  getAddress(coords?: Readonly<IRange.FixableCoords | IRange.FixableCellCoords>, r1c1?: boolean): string;

  /**
   * Looks up another formula function so it can be called from yours.
   *
   * @param name The name of the function. Case-insensitive.
   * @returns The function, or `null` if no function is registered under that name.
   */
  getFunction(name: string): IFunction | null;

  /**
   * Returns the coordinates of the entire sheet.
   *
   * @remarks
   * Useful for bounds-checking a range before building it.
   */
  getEntireCoords(): IRange.Coords;

  /**
   * Formats a value with a number format, as a cell would display it.
   *
   * @param formatText The number format to apply.
   * @param value The value to format.
   * @returns The formatted text, or `null` if the format cannot be applied.
   *
   * @remarks
   * This backs the `TEXT` function. For plain coercion to text use {@link toText}.
   */
  getNumberFormat(formatText: string, value: Scalar): string | null;

  /**
   * Returns the 0-based row of the cell being evaluated.
   */
  getRow(): number;

  /**
   * Returns the 0-based column of the cell being evaluated.
   */
  getColumn(): number;

  /**
   * Whether the call being evaluated is in VALUE mode, where a multi-cell reference at a
   * slot that reads ONE value is implicitly intersected with the formula's cell (the `@` rule);
   * `false` is ARRAY mode, where such a slot reads the reference's first cell.
   *
   * @remarks
   * Only a body that accepts a whole reference at a single-value slot and reads it itself asks
   * (`LINEST`'s `const`). The engine decides the mode from the formula around the call — a
   * scalar-valued root, an aggregator or a lookup above it are value mode; a spilling root, an
   * operator or lifting slot over an array-valued operand, a `LAMBDA` body and an array-entered
   * block are array mode — and the mode is inherited through every call that does not set it.
   * Outside a calculation this is `false`.
   */
  isImplicitIntersect(): boolean;

  /**
   * Resolves a range reference at runtime, returning an {@link IReferenceRange}.
   *
   * Use this when the address is computed from arguments rather than known at parse time,
   * as `INDIRECT`, `OFFSET`, and `SUMIF` do.
   *
   * @param coords The coordinates or address string of the range to resolve. If not provided
   * the range the formula being calculated occupies: its cell, or the whole block of an
   * array-entered formula.
   * @param r1c1 If `true`, the string is interpreted in R1C1 format.
   * @returns An {@link IReferenceRange} representing the resolved range.
   * @throws `#REF!` If the range cannot be parsed or resolved.
   * @throws `#NAME?` If the string resolves to an unknown named formula or sheet.
   *
   * @remarks
   * Each call adds a tracked dependency: the function is re-evaluated whenever the resolved
   * range's data changes or its address moves. Prefer {@link getValueAt} when a plain value
   * will do.
   */
  getReference(coords?: Readonly<IRange.Coords> | string, r1c1?: boolean): IReferenceRange<any>;

  /**
   * Resolves an ANCHOR-PLUS-LENGTH argument at runtime, returning an {@link IReferenceRange}
   * clamped to the grid.
   *
   * A few arguments honor only their top-left corner and are re-sized to the shape of the range
   * that drives them — `SUMIF`'s `sum_range`, `LOOKUP`'s `result_vector`. The window can therefore
   * run off the bottom or right of the grid: `SUMIF(A1:A5,">0",A1048574)` asks for five rows
   * starting three from the end. The part that fits is read and the rest is blank, which
   * is what this returns; positions past the clamp read as `undefined` from `getValueAt`.
   *
   * @param anchor The coords of the argument as written; only its top-left corner is honored.
   * @param rowCount The height the driving range gives the window.
   * @param colCount The width the driving range gives the window.
   *
   * @remarks
   * Use {@link getReference} for a reference that is the function's RESULT: an unformable window is
   * `#REF!` there rather than a short read. The clamp belongs to this handful of arguments only.
   *
   * The extent clamped against is the ANCHOR's sheet, which is not necessarily the sheet being
   * evaluated — {@link getEntireCoords} answers for the latter.
   */
  getResizedReference(anchor: Readonly<IRange.Coords>, rowCount: number, colCount: number): IReferenceRange<any>;

  /**
   * Reads the formula text of a cell.
   *
   * @param row The row of the cell.
   * @param column The column of the cell.
   * @param sheetName The name of the sheet. If not provided the current sheet is used.
   * @returns The formula text, or `null` if the cell has no formula.
   */
  getFormulaAt(row: number, column: number, sheetName?: string): string | null;

  /**
   * Returns the range the formula anchored at a cell OCCUPIES — what the spill anchor operator
   * (`A1#`) resolves to.
   *
   * @param row The row the formula is anchored at.
   * @param column The column the formula is anchored at.
   * @param sheetName The name of the sheet. If not provided the current sheet is used.
   * @returns The range, or `null` if no formula is anchored there.
   *
   * @remarks
   * The range is the formula's spill when it produced an array, the whole block for a legacy
   * array formula, and the cell ITSELF for an ordinary formula — every formula occupies at least
   * the cell it sits in. `null` means no formula is anchored at that cell: it holds a constant, it
   * is empty, or it merely lies INSIDE another cell's spill or array block.
   */
  getSpillAt(row: number, column: number, sheetName?: string): IReferenceRange | null;

  /**
   * Reads the value of a cell.
   *
   * @param row The row of the cell.
   * @param column The column of the cell.
   * @param sheetName The name of the sheet. If not provided the current sheet is used.
   * @param options Optional parameters for retrieving the value.
   * @returns The value at the cell, or `null` if the cell is empty.
   *
   * @remarks
   * Unlike {@link getReference}, this does not add a tracked dependency.
   */
  getValueAt(row: number, column: number, sheetName?: string, options?: IRange.ValueOptions): Scalar | null;

  /**
   * Returns the number of sheets in the workbook.
   */
  getSheetCount(): number | null;

  /**
   * Returns the 0-based index of a sheet.
   *
   * @param sheet The name of a sheet, or a reference to resolve to the sheet it is on.
   *              If not provided the current sheet is used.
   * @returns -1 If the sheet does not exist.
   */
  getSheetIndex(sheet?: string | IReferenceRange): number;

  /**
   * Returns a range as it reads without its hidden rows or columns.
   *
   * @param range The range to filter.
   * @param options See {@link IFormulaContext.FilterHiddenOptions}.
   * @returns `range` itself when nothing in it is hidden; otherwise the same range reading with
   * the hidden rows or columns skipped ({@link IRange.IteratorOptions.processRowSkip}).
   *
   * @remarks
   * Use this for functions that ignore hidden data, such as `SUBTOTAL`.
   *
   * Nothing is copied. The shape of `range` is kept, and a reference stays a reference: a hidden
   * cell is not visited and reads as empty, so every position still means the cell it meant, and
   * an aggregate that ignores blanks ignores it. A computed array has no rows or columns to hide
   * and is returned as it is.
   *
   * A hidden row is a hidden row, whoever hid it: a filter and the user leave the same mark, and
   * nothing here tells them apart. What a filter adds is a state of the range's SHEET, which
   * {@link IFormulaContext.FilterHiddenOptions.onlyWhileFiltered} reads.
   *
   * A formula that calls `SUBTOTAL` or `AGGREGATE` is recalculated when a row or column is hidden
   * or shown, and when a filter is set or cleared. One that reaches this only through a custom
   * function is not: it reads the state when it is next calculated.
   */
  filterHidden(range: IRange, options?: IFormulaContext.FilterHiddenOptions): IRange;

  /**
   * Returns a copy of a range with any cell whose formula is a nested total removed.
   *
   * @param range The range to filter.
   * @returns A new range without the nested totals, or `range` itself when there are none.
   *
   * @remarks
   * Use this for functions that must not double-count a total that sits inside their own data —
   * `SUBTOTAL` and `AGGREGATE`, which is also the pair being looked for. Excluding a cell and
   * blanking it are equivalent for every code either function offers (all are order-independent
   * and all ignore blanks), so removal is the simpler contract.
   *
   * A cell qualifies when its formula CALLS `SUBTOTAL` or `AGGREGATE` anywhere in its tree —
   * `=SUM(SUBTOTAL(9,A1:A3))` is excluded — and not when it merely references one: `=A4`, where A4
   * holds a subtotal, is ordinary data. `function_num` is irrelevant, and the two functions are
   * symmetric (either excludes either).
   *
   * Exclusion is per CELL, not per row: with a subtotal in `A4` and a plain `99` in `B4`,
   * `SUBTOTAL(9,A1:B4)` drops only `A4` and keeps the 99.
   */
  filterTotals(range: IRange): IRange;

  /**
   * Suggests a number format for this function's result.
   *
   * @param numFmt The number format to apply to the result.
   *
   * @remarks
   * A hint, not a command — the format is applied only where the user has not already
   * chosen one. When a range is returned every cell takes the same format.
   */
  formatResults(numFmt: string): void;

  /**
   * Coerces a value to a serial date.
   *
   * @param textOrNumber The text or number to parse.
   * @param requireDate If `true`, text must carry a date component; a time alone is rejected.
   * @returns The serial date.
   * @throws `#VALUE!` If the value cannot be read as a date.
   * @throws The original error, unchanged, if the value is already an error (`#N/A` stays `#N/A`).
   */
  parseAsSerialDate(textOrNumber: Scalar, requireDate?: boolean): number;

  /**
   * Coerces a value to a JavaScript `Date`.
   *
   * @param serialOrString The serial number, text, or `Date` to parse.
   * @param requireDate If `true`, text must carry a date component; a time alone is rejected.
   * @returns The date.
   * @throws `#VALUE!` If the value cannot be read as a date.
   * @throws The original error, unchanged, if the value is already an error (`#N/A` stays `#N/A`).
   *
   * @remarks
   * Prefer {@link getDateParts} for calendar arithmetic — see the note there.
   */
  parseAsDate(serialOrString: string | number | Date | any, requireDate?: boolean): Date;

  /**
   * Coerces a value to a number.
   *
   * @param textOrNumber The text or number to parse.
   * @param options Additional parsing options.
   * @returns The number.
   * @throws `#VALUE!` If the value cannot be read as a number.
   * @throws The original error, unchanged, if the value is already an error (`#N/A` stays `#N/A`).
   */
  parseAsNumber(textOrNumber: Scalar, options?: IFormulaContext.ParseNumberOptions): number;
  /**
   * `undefined` passes straight through, so an optional argument that was omitted stays omitted.
   */
  parseAsNumber(textOrNumber: Scalar | undefined, options?: IFormulaContext.ParseNumberOptions): number | undefined;

  /**
   * Compiles criteria text into a predicate.
   *
   * @param criteria The criteria, exactly as the user wrote it — a comparison (`">10"`, `"<>x"`),
   * a wildcard pattern (`"a*"`), or a literal of any type.
   * @returns A predicate to test cell values with. Call it once per cell.
   *
   * @remarks
   * This is the rule behind `COUNTIF`/`SUMIF`/`AVERAGEIF` and their `*IFS` forms, so reach for it
   * in any function that takes a criteria rather than parsing one — a criteria touches all three localization planes at once (a number in the
   * workbook's locale, a boolean word or error label in its language, text in its collation), and
   * they are easy to get subtly wrong one at a time.
   *
   * Compile ONCE and apply the predicate across the range; the parse is not free, and a criteria
   * does not vary per cell.
   *
   * Offer BLANK cells to the predicate rather than skipping them — a blank is what `""` and `"<>"`
   * select, and `"<>x"` matches one too.
   *
   * @example
   * ```typescript
   * const matches = FormulaContext.createCriteria(">10");
   * const count = range.reduce((total, value) => matches(value) ? total + 1 : total, 0);
   * ```
   */
  createCriteria(criteria: Scalar): IFormulaContext.CriteriaEvaluator;

  /**
   * Returns the records of a database that a criteria table selects.
   *
   * @param database The list: a header row over one record per row.
   * @param criteria The criteria table: a header row over one or more rows of conditions.
   * @returns The matching records, in the database's order and with all of its columns. The header
   * row is not among them. No match is a range of no rows.
   *
   * @remarks
   * This is the query behind the `D` functions (`DSUM`, `DGET`, `DCOUNT`, …), and it reads a
   * criteria table as they do:
   *
   * * A criteria header names a database column by its text, ignoring case. A number or a logical
   *   on either side is read as the text it shows.
   * * The conditions in one row all have to hold; a record matching any row is selected.
   * * A blank condition cell constrains nothing, so a wholly blank row selects every record.
   * * A condition is a criteria as {@link createCriteria} reads one (`">10"`, `"a*"`, `5`), except
   *   that plain text matches as a prefix: `appl` selects `Apple`.
   * * Under a header that names no column a condition is COMPUTED. A value there is read as a
   *   logical and holds for every record or for none. A formula is asked once per record: written
   *   for the first record, its relative references follow each record in turn, so `=B2>15` over a
   *   database whose first record is on row 2 selects the records whose column B is over 15.
   *
   * @example
   * ```typescript
   * // The sum of one column over the records the criteria selects.
   * const records = FormulaContext.dbQuery(database, criteria);
   * const total = records.slice({ colStart: 2, colEnd: 2 }).getStats().getAggregates().sum;
   * ```
   */
  dbQuery(database: IRange, criteria: IRange): IRange;

  /**
   * Groups the records of a range two ways at once — by row keys and by column keys — at every
   * key level of each, and crosses every row group with every column group.
   *
   * @param rows The row key columns, or `null` for none: every record is then in the one row group.
   * @param columns The column key columns, or `null` for none.
   * @param options Which records take part. See {@link IFormulaContext.PivotOptions}.
   * @returns The two axes of groups and what their crossings hold.
   * @throws `#VALUE!` for more than 32 key columns on one axis, or more groups and crossings than
   * the pivot can number.
   *
   * @remarks
   * Every row is a record, blank rows included. Two keys are equal by the rule `UNIQUE` uses: text
   * ignores case, and types never mix, so `1`, `"1"` and `TRUE` are three groups. A blank key is a
   * key of its own, distinct from `""`, and an error is a key like any other value.
   *
   * Each axis is a tree: its root is every kept record, the root's children are the groups of the
   * first key column, theirs add the second, and so on, each in the order its first record appears.
   * A subtotal is then one group, never a union of its children.
   *
   * One pivot answers what a grouping per key level, and another per pair of levels, would — in
   * one pass, which is what `PIVOTBY` and a pivot table need.
   *
   * @example
   * ```typescript
   * const pivot = FormulaContext.createPivot(regions, years);
   * for (const region of pivot.getRows().getRoot().getChildren()) {
   *   const total = pivot.getMembers(sales, region); // every year
   *   const [name] = region.getKeys();
   * }
   * ```
   */
  createPivot(
    rows: IRange | null,
    columns: IRange | null,
    options?: IFormulaContext.PivotOptions
  ): IFormulaContext.Pivot;

  /**
   * The pivot table a reference touches, as the values it shows.
   *
   * @param reference Any cell or range of the table, its page fields included.
   * @returns The view, or `null` when the reference touches no pivot table, or the table's values
   * are not computed (it is not modeled, or its view has not loaded yet).
   *
   * @remarks
   * What `GETPIVOTDATA` reads. The view answers for the values the table shows; matching a request
   * to its fields and items by name is the caller's.
   */
  getPivotAt(reference: IReferenceRange): IFormulaContext.PivotView | null;

  /**
   * Reads a typed literal in the workbook's language — the parse side of {@link toText}.
   *
   * @param text The text to read.
   * @returns The boolean or error the text spells, or `undefined` when it spells neither and is
   * therefore just text.
   *
   * @remarks
   * Booleans and error labels are the two values whose SPELLING follows the spreadsheet language
   * rather than the workbook locale — `WAHR` is `TRUE` and `#WERT!` is `#VALUE!` in a German
   * workbook, the same plane {@link toText} writes them on. Reach for this wherever a function
   * interprets text the user typed; criteria (`COUNTIF(range, "WAHR")`) is the built-in case.
   *
   * The canonical English spelling is ALWAYS accepted alongside the localized one, so text that
   * came from storage or an API reads the same under every language. This is how the formula
   * compiler reads a typed literal, and matching it is the point.
   *
   * Numbers are not literals here. They follow the workbook LOCALE (the decimal separator) rather
   * than the language, and belong to {@link parseAsNumber}.
   */
  parseAsLiteral(text: string): boolean | FormulaError.Known | undefined;

  /**
   * Coerces a value to text — the same rendering `&` and `CONCAT` produce.
   *
   * @param value The value to render. Text passes through unchanged, a blank
   * (`null`/`undefined`) becomes `''`, and a boolean takes the workbook language's word
   * (`TRUE`, `WAHR`). Numbers get 15 significant digits, plain decimal while the digits fit
   * in 20 characters and scientific beyond that, using the workbook's decimal separator.
   * @returns The rendered text.

   * @remarks
   * Reach for this whenever a function needs to treat an argument as text.
   *
   * This is coercion, not display. A cell's General format and `TEXT(value, "General")` are
   * fitted to the column and round much harder — `TEXT(2^0.5, "General")` is `1.414213562`
   * where coercion gives `1.4142135623731`. Use {@link getNumberFormat} when you want what
   * the user sees.
   *
   * @param options `literal` renders a number the way Excel writes one into formula text and into
   * a complex number's parts: plain decimal while it fits in 21 characters rather than 20, so
   * `0.0000117836687482814` and `100000000000000000000` stay plain where coercion turns them
   * scientific. Nothing but numbers changes.
   */
  toText(value: Scalar | undefined, options?: IFormulaContext.ToTextOptions): string;

  /**
   * Orders two values the way the comparison operators do.
   *
   * @param a The left value.
   * @param b The right value.
   * @param options Overrides the collator strength. Text only — see remarks.
   * @returns Negative, zero, or positive, like any JS comparator.
   *
   * @remarks
   * This is the single rule behind `=`, `<>`, `<`, `<=`, `>`, `>=`, so use it for any
   * comparison, equality included (`compare(a, b) === 0`). It ranks across types
   * (`number` &lt; `text` &lt; `FALSE` &lt; `TRUE`) rather than coercing, reads a blank as
   * the other operand's zero value, rounds numbers before comparing, and collates text
   * case-insensitively in the workbook locale.
   *
   * Do not reach for `localeCompare` instead: it uses the host's locale rather than the
   * workbook's, and does not sort the way a spreadsheet does.
   *
   * Errors order last so the comparator stays total, though operators never see that case —
   * an error operand propagates first.
   *
   * `options` is for functions like `SORT` and `SORTBY` that expose case sensitivity as a
   * user-facing toggle. It affects the text branch only; ranking, blanks, and numeric
   * rounding are fixed.
   */
  compare(a: Scalar, b: Scalar, options?: Intl.CollatorOptions): number;

  /**
   * Returns the current date and time as a serial date.
   *
   * @returns The current date-time as a serial number.
   *
   * @remarks
   * Always read the clock through this, never `Date.now()`. The time is fixed for the whole
   * calculation pass, so every cell in one pass agrees, collaborators evaluating the same
   * workbook agree, and tests can pin it. Pair it with `Volatile<T>` so the function
   * picks up a fresh time on the next pass.
   *
   * This is a calendar clock, not a stopwatch — use `performance.now()` to measure elapsed time.
   *
   * @example
   * ```typescript
   * export function NOW(): Volatile<number> {
   *   return FormulaContext.getNow();
   * }
   * ```
   */
  getNow(): number;

  /**
   * Returns a random number in `[0, 1)`, like `Math.random()`.
   *
   * @remarks
   * Always draw through this, never `Math.random()`. The source is the runtime's, so a test or a
   * replay can seed it, and the engine sees the draw: a draw is a PER-CELL read — two cells calling
   * the same function in one pass differ — where `getNow` is one value for the whole pass, and the
   * engine only shares an evaluation across the cells of a block when nothing per-cell was read.
   * Pair it with `Volatile<T>` so the function draws again on the next pass.
   *
   * Under a seeded runtime ({@link IRuntime.getRandomSeed}) each draw is keyed by the cell, the
   * pass and which draw it is within that cell, so a function that draws more than once gets
   * distinct values and a cell gets the same ones however the pass was ordered. Take the draws
   * where they are used rather than hoisting them, and the values follow the cells rather than
   * the code path.
   *
   * @example
   * ```typescript
   * export function RAND(): Volatile<number> {
   *   return FormulaContext.getRandom();
   * }
   * ```
   */
  getRandom(): number;

  /**
   * Returns `true` if the value is a usable date — either a `Date` or a number in the
   * workbook's serial date range.
   *
   * @param value Any value to check.
   * @param jsDateOnly If `true`, only a `Date` without a time component is accepted.
   */
  isValidDate(value: any, jsDateOnly?: boolean): boolean;

  /**
   * Converts a `Date` to a serial date.
   *
   * @param date The date to convert.
   * @param dateOnly If `true`, the time of day is dropped and a whole-day serial is returned.
   * Use this for calendar arithmetic (day counts, coupon schedules) so a stray time component
   * cannot leak into the result.
   *
   * @remarks
   * Serial dates are wall-clock: the date's local fields become the serial and no timezone
   * enters the conversion. Read such dates back with `getFullYear`/`getMonth`/`getDate`,
   * never the `getUTC*` accessors.
   */
  toSerialDate(date: Date, dateOnly?: boolean): number;

  /**
   * Converts a serial date to a `Date`.
   *
   * @param serialDate The serial date to convert.
   * @param dateOnly If `true`, the fractional part is dropped and the time is midnight.
   *
   * @remarks
   * The serial becomes the date's local fields — see {@link toSerialDate}. For date
   * arithmetic prefer {@link getDateParts}.
   */
  fromSerialDate(serialDate: number, dateOnly?: boolean): Date;

  /**
   * Splits a serial date into its calendar and clock fields.
   *
   * @param serialDate The serial date to split.
   * @param reuseParts Avoids allocating a fresh {@link IFormulaContext.DateParts}:
   * - An object: the fields are written into THIS object, which is returned. The caller owns
   *   the buffer's lifetime — do not hold onto a previous result across a reused call, each
   *   call overwrites it in place. For code that calls this once per cell over a large range.
   * - `true`: the fields are written into a shared scratch object and returned — for a
   *   one-off caller (a single-value function like `YEAR`/`MONTH`/`DAY`) that just wants to
   *   avoid the allocation without owning a buffer itself. The result must be consumed
   *   immediately (read a field, done) — a second `true` call anywhere overwrites it.
   * @throws `#NUM!` If the serial falls outside the workbook's calendar.
   *
   * @remarks
   * Prefer this to {@link fromSerialDate} inside date functions. The spreadsheet calendar
   * has two days a JS `Date` cannot hold — serial 0 (`1900-01-00`) and the legacy
   * `1900-02-29` at serial 60 — and converting to a `Date` silently shifts them.
   * {@link IFormulaContext.DateParts} is plain numbers and represents both.
   */
  getDateParts(serialDate: number, reuseParts?: IFormulaContext.DateParts | boolean): IFormulaContext.DateParts;

  /**
   * Builds a serial date from calendar and clock fields — the inverse of {@link getDateParts}.
   *
   * @remarks
   * Fields may fall outside their normal range and carry, which is what makes `DATE` and
   * `TIME` arithmetic work: month 13 is January of the next year, hour 50 is two days plus
   * two hours, and `getSerialDate(1900, 1, 0)` is serial 0. The `day` carries in SERIAL
   * space, so it runs through the phantom `1900-02-29`.
   *
   * **This validates nothing, and that is deliberate — a caller MUST choose its own
   * policy.** No range check, no clamping, no bounds on any field, and no `DATE`-style
   * `0..1899 -> +1900` year offset. Those belong to `DATE`'s ARGUMENTS, not to the
   * calendar, and three things prove it:
   *
   * * **The day policy is the caller's.** `DATE` and `DATEDIF`'s `md`/`yd` re-anchoring
   *   want the raw carry above — `DATEDIF("2020-01-31","2020-03-01","md")` is `-1`
   *   because Jan 31 rolls into March. `EDATE`/`EOMONTH` want the opposite and CLAMP to
   *   the target month's length, so they pre-clamp before calling here. One conversion,
   *   two opposite rules. Baking either one in breaks the other.
   * * **Results may legitimately leave the calendar.** `YEARFRAC` basis 1 anchors a year
   *   length on January 1 of `laterYear + 1`, which at the top of the calendar is
   *   `10000-01-01`; `YEARFRAC(DATE(9998,1,1),DATE(9999,12,31),1)` is
   *   `1.9972602739726026`, not `#NUM!`. A range check here would break it.
   * * **The 16-bit argument limits are per-function.** `DATE`'s month errors outside
   *   `[-32767, 32766]` while its day saturates to `32767`, and `TIME` errors outside
   *   `[0, 32767]` on every argument — same magic number, three different rules.
   *
   * Note the asymmetry with {@link getDateParts}, which DOES throw `#NUM!` outside the
   * calendar because it answers a user-facing question. An internal intermediate that
   * steps one day past the end must therefore not be round-tripped through it; compute
   * on the fields instead, or `YEARFRAC(DATE(9999,1,1),DATE(9999,12,31),0)` becomes `#NUM!`
   * rather than `1`.
   */
  getSerialDate(
    year: number, month: number, day: number,
    hour?: number, minute?: number, second?: number, millis?: number
  ): number;

  /**
   * Returns information about the environment the formula is running in.
   *
   * @remarks
   * Mostly for diagnostics; the built-in `INFO` function is built on it.
   */
  getRuntime(): IRuntime;

  /**
   * The current call's arguments — how many the caller supplied, in which positions, of what kind,
   * and what each value was BEFORE coercion.
   *
   * @remarks
   * Argument REFLECTION, for the one thing a declaration cannot say: what happened at *this* call.
   * It exists to serve a declared `any`, which means "no contract, the body decides" — every
   * other declared type maps onto a type we already have and the marshaller handles it.
   *
   * The returned view is valid ONLY while the body that asked for it is running. Views are pooled
   * by dispatch depth, so retaining one across an `await`, a callback, or a nested evaluation hands
   * you another call's arguments.
   *
   * @throws If called outside a function dispatch — there are no arguments to reflect on.
   */
  getArgs(): IFunctionArguments;

  /**
   * Answers this call later: hands `executor` a call to settle, and leaves the cell showing what
   * the function returns now.
   *
   * @param executor Runs once at the end of the recalculation with every call made against it.
   * Pass a module-level function by name: calls join one batch when they name the same function.
   * @param payload Everything the executor needs to answer this call, and how a later evaluation
   * recognizes it: while the call is still waiting, a recalculation with
   * an equal payload leaves it be rather than asking again. Once it has stopped, a recalculation
   * calls the function again; what it fetched is answered from the workbook's cache
   * (`IDeferContext.fetch`).
   * @returns The last answer this call gave for the same question, when the function is being
   * called again (a recalculation); `undefined` on a first call or a changed question. Return it
   * to keep showing it until the new answer arrives, or return something else to show that the
   * cell is waiting.
   *
   * @remarks
   * The function still returns a value: what this call answers until its result arrives (nothing
   * returned reads as blank), and it is what every formula over the cell calculates
   * from meanwhile: return `#BUSY!` when they should wait as an error, or text such as
   * `'Fetching…'` when that is what they should show.
   *
   * The executor runs after the recalculation, outside any cell, so the ambient `FormulaContext`
   * is not its own: it reads the workbook through `ctx.getFormulaContext()`. Whatever the body
   * knows about its cell goes in the payload.
   *
   * @example
   * ```typescript
   * function fetchAll(
   *   calls: readonly IFormulaContext.DeferredCall<string>[],
   *   ctx: IFormulaContext.IDeferContext
   * ): void {
   *   for (const call of calls) {
   *     ctx.fetch(call.payload as string)
   *       .then((response) => response.text())
   *       .then((text) => call.resolve(text), (error) => call.reject(error));
   *   }
   * }
   *
   * export function FETCHTEXT(url: string): string {
   *   FormulaContext.defer(fetchAll, url);
   *   return 'Fetching…';
   * }
   * ```
   */
  defer(executor: IFormulaContext.DeferExecutor, payload?: unknown): unknown;

  /**
   * A rich value of a registered type, made from its data as the type's JSON holds it, for the
   * workbook being calculated.
   *
   * @param type The name of the value's kind (`'hyperlink'`): what its `getKind().getName()`
   * will answer.
   * @param data The value's data, as its JSON's `data`.
   *
   * @remarks
   * A type nobody has registered still makes a value: one that carries the data and reads as
   * nothing.
   */
  createRichData(type: string, data?: any): IRichData;

}

/**
 * {@inheritDoc IFormulaContext}
 *
 * @see
 * ### **Interface**
 *
 * {@link IFormulaContext}
 */
export namespace IFormulaContext {

  /**
   * Options for {@link IFormulaContext.toText}.
   */
  export interface ToTextOptions {
    /**
     * Render a number as Excel writes a literal: plain decimal up to 21 characters, as in formula
     * text and the parts of a complex number.
     * @defaultValue `false`
     */
    literal?: boolean;
  }

  /**
   * Options for {@link IFormulaContext.filterHidden}.
   */
  export interface FilterHiddenOptions {
    /**
     * Which axis to filter on.
     * @defaultValue `IRange.AxisSelection.Row`
     */
    axes?: IRange.AxisSelection;
    /**
     * Skip the hidden rows or columns only while the range's sheet is filtered: while some
     * AutoFilter or table on that sheet holds a condition, whether or not it hides a row. Until
     * then `range` is returned as it is, hidden rows included.
     *
     * @remarks
     * This is `SUBTOTAL` 1-11 (they include manually hidden rows, which is what an
     * unfiltered sheet reads as). `SUBTOTAL` 101-111 and `AGGREGATE` leave it off and skip
     * always.
     * @defaultValue false
     */
    onlyWhileFiltered?: boolean;
  }

  /**
   * Options for {@link IFormulaContext.parseAsNumber}.
   */
  export interface ParseNumberOptions {

  }

  /**
   * The predicate {@link IFormulaContext.createCriteria} returns.
   *
   * @remarks
   * A blank cell arrives as `null` and is a meaningful input, not a value to skip — see the note
   * there.
   */
  export type CriteriaEvaluator = (value: Scalar) => boolean;

  /**
   * Options for {@link IFormulaContext.createPivot}.
   */
  export interface PivotOptions {
    /**
     * One column, as tall as the keys, selecting the records that take part. A record is kept
     * when its member is `TRUE` or a nonzero number, and left out otherwise.
     */
    filter?: IRange;
  }

  /**
   * The records of a range grouped by rows and by columns — see {@link IFormulaContext.createPivot}.
   */
  export interface Pivot {
    /**
     * The number of records kept by the filter.
     */
    getRecordCount(): number;
    /**
     * The row groups.
     */
    getRows(): PivotAxis;
    /**
     * The column groups.
     */
    getColumns(): PivotAxis;
    /**
     * The members of `values` in both a row group and a column group, as one column in record order.
     *
     * @param values One column, as tall as the keys.
     * @param row A group of this pivot's rows; omit it, or pass the root, for every row.
     * @param column A group of this pivot's columns; omit it, or pass the root, for every column.
     * @returns An array, never a reference, or `null` when no kept record is in both groups.
     */
    getMembers(values: IRange, row?: PivotGroup, column?: PivotGroup): IRange | null;
    /**
     * What `fn` returns over the members {@link getMembers} would give, computed without them.
     *
     * @returns `null` when no kept record is in both groups, `undefined` when the pivot does not
     * compute `fn` this way: call `fn` over {@link getMembers} instead.
     *
     * @remarks
     * Optional. Where it is present it answers for the built-in aggregates it knows (`SUM`,
     * `COUNT`, `AVERAGE`, ...) with exactly the value the call would return, the first error
     * member included.
     */
    getAggregate?(values: IRange, fn: IFunction, row?: PivotGroup, column?: PivotGroup): Scalar | null | undefined;
  }

  /**
   * A pivot table as the values it shows — see {@link IFormulaContext.getPivotAt}.
   */
  export interface PivotView {
    /**
     * The table's values, in its order.
     */
    getDataFields(): readonly PivotViewDataField[];
    /**
     * The fields on the table's rows, columns and pages, in that order.
     */
    getFields(): readonly PivotViewField[];
    /**
     * A value the table shows.
     *
     * @param dataField The value, by index into {@link getDataFields}.
     * @param items Per field, by index into {@link getFields}, the item by index into its
     * {@link PivotViewField.items}. A field left out is totaled over.
     * @returns The value, or `undefined` when the table does not show it: a line it does not show
     * (a hidden or collapsed item, a subtotal or grand total turned off), an item not on its page,
     * or a crossing with no records.
     */
    getValue(dataField: number, items: ReadonlyMap<number, number>): Scalar | undefined;
    /**
     * Whether the table's values are known here.
     *
     * @returns `false` for a table that is there but whose values the host does not compute: its
     * fields and values are empty, and a caller that answered from it before keeps that answer, as
     * the table only changes on a refresh. Absent means `true`.
     */
    isComputed?(): boolean;
  }

  /**
   * A value of a {@link PivotView}.
   */
  export interface PivotViewDataField {
    /** As the table shows it (`Sum of Sales`). */
    readonly name: string;
    /** The name of the source field it summarizes (`Sales`). */
    readonly sourceName: string;
  }

  /**
   * A field of a {@link PivotView}.
   */
  export interface PivotViewField {
    /** As the table shows it: its caption, or the source field's name. */
    readonly name: string;
    readonly items: readonly PivotViewItem[];
  }

  /**
   * An item of a {@link PivotViewField}.
   */
  export interface PivotViewItem {
    /** The item's value; `null` for the blank item. */
    readonly value: Scalar;
    /** The value as the table shows it, in the field's number format; `(blank)` for the blank item. */
    readonly text: string;
    /** The caption the item was renamed to, if it was. */
    readonly name?: string;
  }

  /**
   * One axis of a {@link Pivot}: its groups at every key level, as a tree under one root.
   */
  export interface PivotAxis {
    /**
     * The group of every kept record, at level `0`.
     */
    getRoot(): PivotGroup;
    /**
     * The number of groups, the root included.
     */
    getGroupCount(): number;
  }

  /**
   * One group of a {@link PivotAxis}. The axis answers the same object for a group every time, so a
   * group can key a map.
   */
  export interface PivotGroup {
    /**
     * The number of key columns the group is keyed by: `0` for the root, `1` for the groups of the
     * first key column, and so on.
     */
    getLevel(): number;
    /**
     * The group one level up, or `null` for the root.
     */
    getParent(): PivotGroup | null;
    /**
     * The groups one level down, in the order their first records appear.
     */
    getChildren(): readonly PivotGroup[];
    /**
     * The keys, one per level down to this group's own. Each level's key is spelled by the first
     * record of the group at that level, so a group's keys begin with its parent's. A blank key is
     * `null`.
     */
    getKeys(): readonly Scalar[];
    /**
     * The number of kept records in the group.
     */
    getSize(): number;
    /**
     * The row of the group's first record within the keys.
     */
    getFirstRecord(): number;
  }

  /**
   * A serial date split into fields — see {@link IFormulaContext.getDateParts}.
   *
   * @remarks
   * These are the spreadsheet calendar's fields, not the Gregorian one's: `day` may be
   * `0` (`1900-01-00`) and February 1900 has 29 days.
   */
  export interface DateParts {
    /** Full year. */
    readonly year: number;
    /** 1 = January ... 12 = December. */
    readonly month: number;
    /** Day of month, 1-based. `0` for `1900-01-00`. */
    readonly day: number;
    /** Hour on a 24-hour clock. */
    readonly hour: number;
    /** Minute of the hour. */
    readonly minute: number;
    /** Second of the minute. */
    readonly second: number;
    /** Milliseconds. */
    readonly millis: number;
    /**
     * Day of week, 1 = Monday ... 7 = Sunday.
     *
     * @remarks
     * Derived from the serial throughout, so below serial 61 it follows the legacy
     * calendar rather than the real one. This is the same value `ddd`/`dddd` render.
     */
    readonly dow: number;
  }

  /**
   * Answers the calls made by {@link IFormulaContext.defer} against it. Invoked once at the end of
   * a recalculation with every such call; how many requests that becomes is the executor's choice.
   */
  export type DeferExecutor<T = any> = (
    calls: readonly DeferredCall<T>[],
    ctx: IDeferContext
  ) => void | Promise<void>;

  /**
   * One call made by {@link IFormulaContext.defer}, as its executor receives it.
   *
   * @remarks
   * Settle each call itself, never by its position in a response. An executor that returns a
   * promise which rejects fails every call it has not settled.
   */
  export interface DeferredCall<T = any> {
    /** What the function passed to `defer`. */
    readonly payload: unknown;
    /** Settles the call with its result. */
    resolve(value: T, options?: DeferredCall.ResolveOptions): void;
    /** Settles the call with an error: a `FormulaError` as itself, anything else as `#VALUE!`. */
    reject(error: unknown): void;
    /** Runs `fn` when the result is no longer wanted. */
    onCancel(fn: () => void): void;
    /**
     * Whether the result is no longer wanted. Only an executor that holds calls to settle later
     * needs it; a result for a cancelled call is dropped.
     */
    readonly cancelled: boolean;
  }

  export namespace DeferredCall {
    /**
     * Options for {@link DeferredCall.resolve}.
     */
    export interface ResolveOptions {
      /**
       * Whether the blanks of an array result stay blank when it spills. Omitted, they read as
       * `0`, as any spilled array's blanks do.
       *
       * @remarks
       * For data whose empty fields mean "nothing here", such as an imported file. The result
       * keeps them while a formula passes it on as it is (`IF(c, result, …)`). A function that
       * answers element by element builds a new array, whose blanks read as `0`
       * (`IFERROR(result, …)`, `result & ""`).
       * @defaultValue false
       */
      keepBlanks?: boolean;
    }
  }

  /**
   * What an executor is given beside its calls.
   */
  export interface IDeferContext {
    /** A random number in `[0, 1)` from the calculation's source, which a test can seed. */
    getRandom(): number;
    /**
     * State kept for this executor across recalculations, made by `init` on first ask. Keep data
     * here (maps, numbers, strings, buffers), not connections or sockets.
     */
    getState<S>(init: () => S): S;
    /**
     * Groups `calls` by payload and runs `answer` once per distinct payload with every call that
     * asked it: one request per question, however many cells asked.
     *
     * @param calls The calls to group, usually every call the executor was handed.
     * @param answer Settles one group. When it throws, or the promise it returns rejects, the
     * group's calls it has not settled fail with that error; the other groups are not affected.
     * @returns Resolves once every group has been answered. It never rejects.
     *
     * @remarks
     * Payloads are equal as `defer` compares them: the same primitive, or plain objects or arrays
     * whose own values are the same one level deep. Groups are answered concurrently, in the
     * order their first call appears.
     *
     * @example
     * ```typescript
     * async function fetchQuotes(
     *   calls: readonly IFormulaContext.DeferredCall<number>[],
     *   ctx: IFormulaContext.IDeferContext
     * ): Promise<void> {
     *   await ctx.byPayload(calls, async (ticker: string, group) => {
     *     const response = await ctx.fetch(`https://api.example.com/quote/${ticker}`);
     *     const price: number = (await response.json()).price;
     *     for (const call of group) call.resolve(price);
     *   });
     * }
     * ```
     */
    byPayload<T = any, P = unknown>(
      calls: readonly DeferredCall<T>[],
      answer: (payload: P, group: readonly DeferredCall<T>[]) => void | Promise<void>
    ): Promise<void>;
    /**
     * A rich value of a registered type, for the workbook being calculated: what
     * {@link IFormulaContext.createRichData} makes inside a cell, made here for a call's result.
     */
    createRichData(type: string, data?: any): IRichData;
    /**
     * Adds bytes to the workbook being calculated as a resource (an `IResource`), for a rich value
     * to hold: pass it in {@link createRichData}'s data. The workbook saves it while a value holds
     * it. With `fetchedFrom` it is the workbook's copy of that URL: {@link fetch} answers the URL
     * from it, and adding the same URL again answers the resource already added.
     */
    addResource(buffer: ArrayBuffer, options?: { fetchedFrom?: string }): object;
    /**
     * Fetches through the workbook being calculated: the standard `fetch`, answered by the
     * fetchers the host registered for the URL's scheme, with the host's authentication. An
     * answer the workbook already has for the URL (a picture it keeps, or anything fetched while
     * it is open) answers from the workbook, and two calls for one URL share one request. In an
     * external calculation (*Refresh All*) it goes to the source.
     *
     * Rejects when the URL cannot be reached, with a `FormulaError.Blocked` when the site responded
     * but the browser would not let the page read it.
     */
    fetch(input: string, init?: RequestInit): Promise<Response>;
    /**
     * The formula context of the workbook being calculated, with no cell: its parsing, text,
     * comparison and dates, read with the workbook's locale and date system.
     *
     * @remarks
     * Valid for as long as the executor runs, across every `await`. The ambient `FormulaContext`
     * is not: it belongs to the cell being evaluated, and an executor runs after that evaluation
     * ends. What needs a cell (`getRow`, `getReference`, `getValueAt`, `defer`,
     * `formatResults`, `getRandom`) throws here; {@link getRandom} is the executor's own.
     */
    getFormulaContext(): IFormulaContext;
    /**
     * Reads delimited text (CSV, TSV) into rows of values, each field read the way the workbook
     * reads typed entry: numbers, dates, booleans and error labels become values, anything else
     * stays text, and an empty field is blank.
     *
     * @param text The delimited text.
     * @param options How the text is split.
     * @returns The rows, padded with blanks to the widest row.
     */
    parseText(text: string, options?: IDeferContext.ParseTextOptions): Promise<Scalar[][]>;
  }

  export namespace IDeferContext {
    /**
     * Options for {@link IDeferContext.parseText}.
     */
    export interface ParseTextOptions {
      /**
       * The character between fields.
       * @defaultValue `','`
       */
      delimiter?: string;
    }
  }
}