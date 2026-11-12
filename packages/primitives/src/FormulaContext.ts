import { type Scalar } from './Scalar';
// a VALUE import: the `parseAsLiteral` stub reads the canonical error labels (FormulaError.ts has
// only type imports of its own, so this adds no cycle)
import { FormulaError } from './FormulaError';
import { type IRange } from './IRange';
import { type IReferenceRange } from './IReferenceRange';
import { type IFunction } from './IFunction';
import { type IFunctionArguments } from './IFunctionArguments';
import { type IFormulaContext } from './IFormulaContext';
import { type IRuntime } from './IRuntime';
import { type IRichData } from './IRichData';
import { type LocaleProfile } from './LocaleProfile';

/**
 * Default implementation of the IFormulaContext interface.
 *
 * @see IFormulaContext
 *
 * @remarks
 * This is a stubbed implementation of the IFormulaContext interface.
 * Runtime engines should provide a complete implementation.
 * @internal
 * @hidden
 */
export class StubbedFormulaContext implements IFormulaContext {

  /** @inheritdoc IFormulaContext.createRange */
  createRange<TS extends Scalar=Scalar>(
    rows?: number,
    columns?: number,
    values?: Scalar | Scalar[][] | ((value: TS, coords: IRange.CellCoords, range: IRange<TS>) => TS)
  ): IRange {
    throw outsideEvaluation('createRange');
  }

  /** @inheritdoc IFormulaContext.flattenAreas */
  flattenAreas(value: IRange | IRange[]): IRange {
    throw outsideEvaluation('flattenAreas');
  }

  /** @inheritdoc IFormulaContext.getReference */
  getReference(coords?: Readonly<IRange.Coords>, r1c1?: boolean): IReferenceRange {
    throw outsideEvaluation('getReference');
  }

  /** @inheritdoc IFormulaContext.getResizedReference */
  getResizedReference(anchor: Readonly<IRange.Coords>, rowCount: number, colCount: number): IReferenceRange {
    throw outsideEvaluation('getResizedReference');
  }

  /** @inheritdoc IFormulaContext.getNumberFormat */
  getNumberFormat(formatText: string, value: Scalar): string {
    throw outsideEvaluation('getNumberFormat');
  }

  /** @inheritdoc IFormulaContext.fromSerialDate */
  fromSerialDate(serialDate: number, dateOnly?: boolean): Date {
    throw outsideEvaluation('fromSerialDate');
  }

  /** @inheritdoc IFormulaContext.toSerialDate */
  toSerialDate(date: Date, dateOnly?: boolean): number {
    throw outsideEvaluation('toSerialDate');
  }

  /** @inheritdoc IFormulaContext.getDateParts */
  getDateParts(serialDate: number, reuseParts?: IFormulaContext.DateParts | boolean): IFormulaContext.DateParts {
    throw outsideEvaluation('getDateParts');
  }

  /** @inheritdoc IFormulaContext.getSerialDate */
  getSerialDate(
    year: number, month: number, day: number,
    hour?: number, minute?: number, second?: number, millis?: number
  ): number {
    throw outsideEvaluation('getSerialDate');
  }

  /** @inheritdoc IFormulaContext.getNow */
  getNow(): number {
    throw outsideEvaluation('getNow');
  }

  /** @inheritdoc IFormulaContext.getRandom */
  getRandom(): number {
    return Math.random();
  }

  /** @inheritdoc IFormulaContext.getValueAt */
  getValueAt(row: number, column: number, sheetName?: string, options?: IRange.ValueOptions): Scalar | null {
    return null;
  }

  /** @inheritdoc IFormulaContext.getEntireCoords */
  getEntireCoords(): IRange.Coords {
    return defaultEntireCoords;
  }

  /** @inheritdoc IFormulaContext.isValidDate */
  isValidDate(value: any, jsDateOnly?: boolean): boolean {
    if (value instanceof Date || Object.prototype.toString.call(value) === '[object Date]') {
      // Verify it's a valid date (not Invalid Date)
      return !isNaN(value.getTime());
    }
    if (jsDateOnly) return false;
    if (typeof value === 'number') {
      if (value < 0 || value > MAX_SERIAL_DATE) return false;
      return true;
    }
    return false;
  }

  /** @inheritdoc IFormulaContext.getRow */
  getRow(): number {
    return 0;
  }

  /** @inheritdoc IFormulaContext.getColumn */
  getColumn(): number {
    return 0;
  }

  /** @inheritdoc IFormulaContext.isImplicitIntersect */
  isImplicitIntersect(): boolean {
    return false;
  }

  /** @inheritdoc IFormulaContext.getFormulaAt */
  getFormulaAt(row: number, column: number, sheetName?: string): string | null {
    return null;
  }

  /** @inheritdoc IFormulaContext.getSpillAt */
  getSpillAt(row: number, column: number, sheetName?: string): IReferenceRange | null {
    return null;
  }

  /** @inheritdoc IFormulaContext.getSheetIndex */
  getSheetIndex(sheet?: string | IReferenceRange): number {
    return -1;
  }

  /** @inheritdoc IFormulaContext.getSheetCount */
  getSheetCount(): number | null {
    return 1;
  }

  /** @inheritdoc IFormulaContext.defer */
  defer(_executor: IFormulaContext.DeferExecutor, _payload?: unknown): unknown {
    // Outside a calculation nothing answers later: the function's return value is the answer.
    return undefined;
  }

  /** @inheritdoc IFormulaContext.formatResults */
  formatResults(numFmt: string): void {
    // nothing
  }

  /** @inheritdoc IFormulaContext.filterHidden */
  filterHidden(range: IRange, options?: IFormulaContext.FilterHiddenOptions): IRange {
    return range;
  }

  /** @inheritdoc IFormulaContext.filterTotals */
  filterTotals(range: IRange): IRange {
    return range;
  }

  /** @inheritdoc IFormulaContext.getFunction */
  getFunction(name: string): IFunction | null {
    return null;
  }

  /** @inheritdoc IFormulaContext.getAddress */
  getAddress(coords?: Readonly<IRange.FixableCoords | IRange.FixableCellCoords>, r1c1?: boolean): string {
    throw outsideEvaluation('getAddress');
  }

  /** @inheritdoc IFormulaContext.parseAsSerialDate */
  parseAsSerialDate(textOrNumber: string | number, requireDate?: boolean): number {
    throw outsideEvaluation('parseAsSerialDate');
  }

  /** @inheritdoc IFormulaContext.parseAsDate */
  parseAsDate(serialOrString: string | number | Date | any, requireDate?: boolean): Date {
    throw outsideEvaluation('parseAsDate');
  }

  /** @inheritdoc IFormulaContext.parseAsNumber */
  parseAsNumber(textOrNumber: Scalar, options?: IFormulaContext.ParseNumberOptions): number;
  parseAsNumber(textOrNumber: Scalar | undefined, options?: IFormulaContext.ParseNumberOptions): number | undefined;
  parseAsNumber(textOrNumber: Scalar | undefined, options?: IFormulaContext.ParseNumberOptions): number | undefined {
    throw outsideEvaluation('parseAsNumber');
  }

  /**
   * Unimplemented. See {@link IFormulaContext.createCriteria}.
   *
   * @remarks
   * Unimplemented rather than approximated. Criteria parsing is the one rule that needs all three
   * localization planes at once, and this stub has none of them — a "basic" version would answer
   * plausibly and wrongly, where throwing names the actual mistake (evaluating criteria outside an
   * installed scope).
   */
  createCriteria(
    criteria: Scalar,
    options?: IFormulaContext.CriteriaOptions
  ): IFormulaContext.CriteriaEvaluator {
    throw outsideEvaluation('createCriteria');
  }

  /**
   * Unimplemented. See {@link IFormulaContext.createPivot}.
   *
   * @remarks
   * A pivot needs the engine's key equality, which this stub does not have.
   */
  createPivot(
    rows: IRange | null,
    columns: IRange | null,
    options?: IFormulaContext.PivotOptions
  ): IFormulaContext.Pivot {
    throw outsideEvaluation('createPivot');
  }

  /**
   * No pivot tables. See {@link IFormulaContext.getPivotAt}.
   */
  getPivotAt(_reference: IReferenceRange): IFormulaContext.PivotView | null {
    return null;
  }

  /**
   * Parses the canonical English boolean and error literals.
   * See {@link IFormulaContext.parseAsLiteral}.
   *
   * @remarks
   * CANONICAL English only, deliberately. The localized spellings live in a language pack, which
   * `@sheetxl/sdk` resolves and this package cannot see — the engine reaches `parseBooleanLocal` /
   * `parseErrorLocal` through the calculation context and never lands here. Canonical is always
   * accepted there too, so this stub is that rule with the localized alternates missing.
   */
  parseAsLiteral(text: string): boolean | FormulaError.Known | undefined {
    const upper = text.toUpperCase();
    if (upper === 'TRUE') return true;
    if (upper === 'FALSE') return false;
    return FormulaError.getBuiltInByLabel(upper);
  }

  /**
   * Renders a scalar as text. See {@link IFormulaContext.toText}.
   *
   * @remarks
   * A BASIC rendering, deliberately NOT the engine's. The engine's rule -- coercion General (15
   * significant digits, plain decimal while the rendering fits 20 characters, else
   * scientific) written with the workbook LOCALE's decimal separator -- is
   * `formatNumberGeneral` in `@sheetxl/sdk`, and every evaluation path reaches it through
   * the calculation context rather than through this stub. Numbers here get the plain JS
   * rendering, which diverges from the engine on both precision and separator.
   *
   * This exists so authoring, type defs and other non-runtime access get usable text
   * instead of throwing. Anything that needs the full rule is running in the engine, and
   * the engine never lands here.
   */
  toText(value: Scalar | undefined): string {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    // An error renders as its label rather than propagating — see IFormulaContext.toText.
    if ((value as FormulaError.Known)?.isFormulaError) return (value as FormulaError.Known).getLabel();
    return String(value);
  }

  /**
   * Orders two scalars. See {@link IFormulaContext.compare}.
   *
   * @remarks
   * A BASIC total order, deliberately NOT the engine's. The engine's rule -- locale collation, the word
   * sort, a blank taking the other operand's type, 11-decimal numeric normalization -- is
   * `ScalarCollation` in `@sheetxl/sdk`, and every evaluation path reaches it through the
   * calculation context rather than through this stub. `options` is ignored: strength is a
   * collation concept and nothing here collates.
   *
   * This exists so authoring, type defs and other non-runtime access get a usable ordering
   * instead of throwing. Anything that needs the full rule is running in the engine, and the
   * engine never lands here.
   */
  compare(a: Scalar, b: Scalar, options?: Intl.CollatorOptions): number {
    if (a === b) return 0;
    const rankA = typeRank(a);
    const rankB = typeRank(b);
    if (rankA !== rankB) return rankA < rankB ? -1 : 1;
    // Same rank: plain JS ordering. Text compares by code UNIT, not collated.
    return (a as any) < (b as any) ? -1 : ((a as any) > (b as any) ? 1 : 0);
  }

  /** @inheritdoc IFormulaContext.getRuntime */
  getRuntime(): IRuntime {
    return defaultRuntimeDetails;
  }

  /** @inheritdoc IFormulaContext.getArgs */
  getArgs(): IFunctionArguments {
    throw new NotImplementedError(NO_ARGUMENTS_ERROR);
  }

  /** @inheritdoc IFormulaContext.createRichData */
  createRichData(_type: string, _data?: any): IRichData {
    throw new NotImplementedError(NO_RICH_DATA_ERROR);
  }
}

/** Blank first, then the coarse shape: number &lt; text &lt; logical &lt; everything else. */
const typeRank = (value: Scalar): number => {
  if (value === null || value === undefined) return 0;
  switch (typeof value) {
    case 'number':  return 1;
    case 'string':  return 2;
    case 'boolean': return 3;
    default:        return 4;
  }
};

const NOT_IMPLEMENTED_ERROR = 'Not implemented in StubbedFormulaContext';
/**
 * What the stub throws for a method only an evaluation can answer. Reached by a body run outside
 * the engine, or by an executor that read the ambient context after an `await`.
 */
const outsideEvaluation = (name: string): Error => new NotImplementedError(
  `FormulaContext.${name}() is only valid while a function body is running. A deferred executor reads its workbook through ctx.getFormulaContext().`
);
const NO_ARGUMENTS_ERROR = 'FormulaContext.getArgs() is only valid while a function body is running';
const NO_RICH_DATA_ERROR = 'FormulaContext.createRichData() needs a workbook being calculated';
class NotImplementedError extends Error {
  constructor(message: string=NOT_IMPLEMENTED_ERROR) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

const defaultEntireCoords: IRange.Coords = Object.freeze({
  colStart: 0, // Zero based index
  rowStart: 0, // Zero based index
  colEnd: Math.pow(2, 14)-1, // Math.pow(2, 14) // 16384 (XFD) - Excel
  rowEnd: Math.pow(2, 20)-1  // Math.pow(2, 20) // 1048576 - Excel
});

const defaultRuntimeDetails: IRuntime = {
  isDate1904: () => false,
  getLocale: () => DEFAULT_LOCALE_PROFILE.tag,
  getLocaleProfile: () => DEFAULT_LOCALE_PROFILE,
  isR1C1: () => false,
  getNow: () => 0,
  getRandom: () => Math.random(),
  getLocation: () => 'unknown',
  getVersion: () => '1.0.0',
  getOS: () => 'unknown',
  getUser: () => 'unidentified',
  getDescription: () => 'Stubbed Formula Context',
}

const MAX_SERIAL_DATE = 2958465; // December 31, 9999

// The default backing used before (and outside) a calculation - so authoring, type defs, and any
// non-runtime access still behave sensibly instead of throwing.
const _stubContext = new StubbedFormulaContext();

/**
 * The single, shared {@link IFormulaContext} that formula implementations use (via
 * `import { FormulaContext } from '@sheetxl/primitives'`).
 *
 * @remarks
 * A thin delegate: every method forwards to the currently-installed scope. The runtime (the
 * calculation engine) installs the active per-evaluation scope; outside a calculation it falls back
 * to {@link StubbedFormulaContext}. `@sheetxl/primitives` owns the interface and a default; the
 * runtime supplies the implementation.
 */
export class ScopedFormulaContext implements IFormulaContext {
  protected _scope: Partial<IFormulaContext> = _stubContext;

  /** @hidden Installed by the runtime around each evaluation; `null` restores the stub. */
  _setScope(scope: Partial<IFormulaContext> | null): void {
    this._scope = scope ?? _stubContext;
  }

  /** @hidden */
  _getScope(): Partial<IFormulaContext> {
    return this._scope;
  }

  /**
   * @hidden Installed ONCE by the runtime marshaller; answers {@link getArgs} for whichever call
   * is currently dispatching, or `null` when none is.
   *
   * @remarks
   * A provider rather than a stack because the marshaller already pools one view per dispatch
   * DEPTH and knows the current depth. Reading a function pointer costs nothing for the ~99% of
   * calls whose body never asks.
   */
  protected _argsFn: (() => IFunctionArguments | null) | null = null;

  /** @hidden */
  _setArgsProvider(provider: (() => IFunctionArguments | null) | null): void {
    this._argsFn = provider;
  }

  /** @inheritdoc IFormulaContext.getNumberFormat */
  getNumberFormat(formatText: string, value: Scalar): string | null {
    return this._getScope().getNumberFormat!(formatText, value);
  }

  /** @inheritdoc IFormulaContext.getEntireCoords */
  getEntireCoords(): IRange.Coords {
    return this._getScope().getEntireCoords!() ?? defaultEntireCoords;
  }

  /** @inheritdoc IFormulaContext.parseAsSerialDate */
  parseAsSerialDate(textOrNumber: Scalar, requireDate?: boolean): number {
    return this._getScope().parseAsSerialDate!(textOrNumber, requireDate);
  }

  /** @inheritdoc IFormulaContext.parseAsDate */
  parseAsDate(serialOrString: string | number | Date | any, requireDate?: boolean): Date {
    return this._getScope().parseAsDate!(serialOrString, requireDate);
  }

  /** @inheritdoc IFormulaContext.parseAsNumber */
  parseAsNumber(textOrNumber: Scalar, options?: IFormulaContext.ParseNumberOptions): number;
  parseAsNumber(textOrNumber: Scalar | undefined, options?: IFormulaContext.ParseNumberOptions): number | undefined;
  parseAsNumber(textOrNumber: Scalar | undefined, options?: IFormulaContext.ParseNumberOptions): number | undefined {
    return this._getScope().parseAsNumber!(textOrNumber, options);
  }

  /** @inheritdoc IFormulaContext.createCriteria */
  createCriteria(
    criteria: Scalar,
    options?: IFormulaContext.CriteriaOptions
  ): IFormulaContext.CriteriaEvaluator {
    return this._getScope().createCriteria!(criteria, options);
  }

  /** @inheritdoc IFormulaContext.createPivot */
  createPivot(
    rows: IRange | null,
    columns: IRange | null,
    options?: IFormulaContext.PivotOptions
  ): IFormulaContext.Pivot {
    return this._getScope().createPivot!(rows, columns, options);
  }

  /** @inheritdoc IFormulaContext.getPivotAt */
  getPivotAt(reference: IReferenceRange): IFormulaContext.PivotView | null {
    return this._getScope().getPivotAt?.(reference) ?? null;
  }

  /** @inheritdoc IFormulaContext.parseAsLiteral */
  parseAsLiteral(text: string): boolean | FormulaError.Known | undefined {
    // Falls back to the stub (canonical English) rather than throwing when a scope predates this
    // method — same treatment as `compare`.
    const scope = this._getScope();
    return scope.parseAsLiteral ? scope.parseAsLiteral(text) : _stubContext.parseAsLiteral(text);
  }

  /** @inheritdoc IFormulaContext.toText */
  toText(value: Scalar | undefined): string {
    return this._getScope().toText!(value);
  }

  /** @inheritdoc IFormulaContext.isValidDate */
  isValidDate(value: any, jsDateOnly: boolean=false): boolean {
    return this._getScope().isValidDate!(value, jsDateOnly);
  }

  /** @inheritdoc IFormulaContext.fromSerialDate */
  fromSerialDate(serialDate: number, dateOnly: boolean=false): Date {
    return this._getScope().fromSerialDate!(serialDate, dateOnly);
  }

  /** @inheritdoc IFormulaContext.toSerialDate */
  toSerialDate(date: Date, dateOnly: boolean=false): number {
    return this._getScope().toSerialDate!(date, dateOnly);
  }

  /** @inheritdoc IFormulaContext.getDateParts */
  getDateParts(serialDate: number, reuseParts?: IFormulaContext.DateParts | boolean): IFormulaContext.DateParts {
    return this._getScope().getDateParts!(serialDate, reuseParts);
  }

  /** @inheritdoc IFormulaContext.getSerialDate */
  getSerialDate(
    year: number, month: number, day: number,
    hour: number=0, minute: number=0, second: number=0, millis: number=0
  ): number {
    return this._getScope().getSerialDate!(year, month, day, hour, minute, second, millis);
  }

  /** @inheritdoc IFormulaContext.getNow */
  getNow(): number {
    return this._getScope().getNow!();
  }

  /** @inheritdoc IFormulaContext.getRandom */
  getRandom(): number {
    return this._getScope().getRandom?.() ?? Math.random();
  }

  /** @inheritdoc IFormulaContext.createRange */
  createRange<TS extends Scalar=Scalar>(
    rows?: number,
    columns?: number,
    values?: Scalar | Scalar[][] | ((value: TS, coords: IRange.CellCoords, range: IRange<TS>) => TS)
  ): IRange {
    return this._getScope().createRange!(rows, columns, values);
  }

  /** @inheritdoc IFormulaContext.flattenAreas */
  flattenAreas(value: IRange | IRange[]): IRange {
    if (!Array.isArray(value)) return value;
    const values: Scalar[] = [];
    for (let a=0; a<value.length; a++) {
      const area = value[a];
      const { rows, columns } = area.getShape();
      for (let r=0; r<rows; r++) {
        for (let c=0; c<columns; c++) values.push(area.getValueAt(r, c));
      }
    }
    return this.createRange(values.length, 1,
      (_value: Scalar, coords: IRange.CellCoords) => values[coords.rowIndex]);
  }

  /** @inheritdoc IFormulaContext.getRow */
  getRow(): number {
    return this._getScope().getRow?.() ?? 0;
  }

  /** @inheritdoc IFormulaContext.getColumn */
  getColumn(): number {
    return this._getScope().getColumn?.() ?? 0;
  }

  /** @inheritdoc IFormulaContext.isImplicitIntersect */
  isImplicitIntersect(): boolean {
    return this._getScope().isImplicitIntersect?.() ?? false;
  }

  /** @inheritdoc IFormulaContext.getReference */
  getReference(coords?: Readonly<IRange.Coords>, r1c1?: boolean): IReferenceRange {
    return this._getScope().getReference!(coords, r1c1);
  }

  /** @inheritdoc IFormulaContext.getResizedReference */
  getResizedReference(anchor: Readonly<IRange.Coords>, rowCount: number, colCount: number): IReferenceRange {
    return this._getScope().getResizedReference!(anchor, rowCount, colCount);
  }

  /** @inheritdoc IFormulaContext.getValueAt */
  getValueAt(row: number, column: number, scope: string): Scalar | null {
    return this._getScope().getValueAt!(row, column, scope);
  }

  /** @inheritdoc IFormulaContext.getFormulaAt */
  getFormulaAt(row: number, column: number, scope: string): string | null {
    return this._getScope().getFormulaAt?.(row, column, scope) ?? null;
  }

  /** @inheritdoc IFormulaContext.getSpillAt */
  getSpillAt(row: number, column: number, scope: string): IReferenceRange | null {
    return this._getScope().getSpillAt?.(row, column, scope) ?? null;
  }

  /** @inheritdoc IFormulaContext.getSheetIndex */
  getSheetIndex(sheet?: string | IReferenceRange): number {
    return this._getScope().getSheetIndex?.(sheet) ?? -1;
  }

  /** @inheritdoc IFormulaContext.getSheetCount */
  getSheetCount(): number | null {
    return this._getScope().getSheetCount?.() ?? 1;
  }

  /** @inheritdoc IFormulaContext.defer */
  defer(executor: IFormulaContext.DeferExecutor, payload?: unknown): unknown {
    return this._getScope().defer?.(executor, payload);
  }

  /** @inheritdoc IFormulaContext.formatResults */
  formatResults(numFmt: string): void {
    this._getScope().formatResults?.(numFmt);
  }

  /** @inheritdoc IFormulaContext.filterHidden */
  filterHidden(range: IRange, options?: IFormulaContext.FilterHiddenOptions): IRange {
    return this._getScope().filterHidden?.(range, options) ?? range;
  }

  /** @inheritdoc IFormulaContext.filterTotals */
  filterTotals(range: IRange): IRange {
    return this._getScope().filterTotals?.(range) ?? range;
  }

  /** @inheritdoc IFormulaContext.getFunction */
  getFunction(fnName: string): IFunction | null {
    return this._getScope().getFunction?.(fnName) ?? null;
  }

  /** @inheritdoc IFormulaContext.getAddress */
  getAddress(coords?: Readonly<IRange.FixableCoords | IRange.FixableCellCoords>, r1c1?: boolean): string {
    return this._getScope().getAddress!(coords, r1c1);
  }

  /** @inheritdoc IFormulaContext.compare */
  compare(a: Scalar, b: Scalar, options?: Intl.CollatorOptions): number {
    return this._getScope().compare?.(a, b, options) ?? _stubContext.compare(a, b, options);
  }

  /** @inheritdoc IFormulaContext.getRuntime */
  getRuntime(): IRuntime {
    return this._getScope().getRuntime!();
  }

  /** @inheritdoc IFormulaContext.createRichData */
  createRichData(type: string, data?: any): IRichData {
    const scope = this._getScope();
    return scope.createRichData ? scope.createRichData(type, data) : _stubContext.createRichData(type, data);
  }

  /** @inheritdoc IFormulaContext.getArgs */
  getArgs(): IFunctionArguments {
    const provider = this._argsFn;
    const args = provider ? provider() : null;
    // Not the SCOPE's business: a scope is one per evaluated cell, and arguments are one per
    // function CALL — a lambda body re-enters dispatch from inside its caller, so several calls
    // share the scope and each needs its own view. The marshaller installs the provider
    // ({@link _setArgsProvider}); `null` means nothing is dispatching, which is a caller error
    // rather than a scope that predates the method.
    if (!args) throw new NotImplementedError(NO_ARGUMENTS_ERROR);
    return args;
  }

  get [Symbol.toStringTag](): string {
    return `[FormulaContext]`;
  }

  toString(): string {
    const scope = this._getScope();
    const scopeString = scope?.toString?.();
    return scopeString ?? '{STUB SCOPE}';
  }
}

/**
 * A plain en-US profile, for stubs and for environments without `Intl`.
 *
 * @internal
 * @hidden
 */
export const DEFAULT_LOCALE_PROFILE: LocaleProfile = Object.freeze({
  tag: 'en-US',
  numberingSystem: 'latn',

  decimal: '.',
  group: ',',
  grouping: [3],
  minusSign: '-',
  percentSign: '%',
  permilleSign: '‰',

  currencyCode: 'USD',
  currencySymbol: '$',
  currencyDisplay: 'symbol',
  currencyPosition: 'before',
  currencySpacing: 'tight',

  date: Object.freeze({
    calendar: 'gregory',
    short: 'M/d/yy',
    medium: 'MMM d, y',
    long: 'MMMM d, y',
    timeShort: 'h:mm a',
    timeLong: 'h:mm:ss a',
    am: 'AM',
    pm: 'PM',
    firstDay: 0,
    weekend: [6, 0],
    monthsWide: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ],
    monthsAbbr: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    weekdaysWide: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    weekdaysAbbr: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    hour12: true,
  }),

  listSeparator: ',',
  csvDelimiter: ',',
  rtl: false,

  collator: Object.freeze({ sensitivity: 'base', numeric: true })
}) as LocaleProfile;


/**
 * The shared {@link IFormulaContext} for formula implementations. See {@link ScopedFormulaContext}.
 *
 * @internal
 * @hidden
 */
export const FormulaContext: IFormulaContext = new ScopedFormulaContext();
