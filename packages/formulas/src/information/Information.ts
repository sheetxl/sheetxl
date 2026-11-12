/* cspell: disable */
import {
  FormulaContext, FormulaError, ValueKind,
  type AcceptError, type NoLift, type ReportType, type Scalar, type Volatile,
  type IReferenceRange, type IRange, type IRichData, type Flatten
} from '@sheetxl/primitives';

import { round15 } from '../_utils/Arithmetic';
import { readFirstOrMembers } from '../_utils/FirstCell';

/**
 * The information to return about the cell.
 */
enum CellInfoType {
  /** Reference of the first cell in the reference, as text. */
  Address = 'address',
  /** Column number of the cell in the reference. */
  Col = 'col',
  /**
   * 1 if the cell is formatted in color for negative values; otherwise 0.
   * @deprecated Excel desktop only
   */
  Color = 'color',
  /** Value of the upper-left cell in the reference; not a formula. */
  Contents = 'contents',
  /**
   * Full path of the file that contains the reference, as text.
   * @deprecated Excel desktop only
   */
  Filename = 'filename',
  /**
   * Text value corresponding to the number format of the cell.
   * @deprecated Excel desktop only
   */
  Format = 'format',
  /**
   * 1 if the cell is formatted with parentheses for positive or all values; otherwise 0.
   * @deprecated Excel desktop only
   */
  Parentheses = 'parentheses',
  /**
   * Text value corresponding to the label prefix of the cell.
   * @deprecated Excel desktop only
   */
  Prefix = 'prefix',
  /**
   * 0 if the cell is not locked; otherwise 1.
   * @deprecated Excel desktop only
   */
  Protect = 'protect',
  /** Row number of the cell in the reference. */
  Row = 'row',
  /** "b" for a blank cell, "l" for a text constant, "v" for anything else. */
  Type = 'type',
  /**
   * Column width of the cell, rounded to an integer.
   * @deprecated Excel desktop only
   */
  Width = 'width',
}

/**
 * Returns information about the cell.
 * @param infoType The type of information to return.
 * @param reference The cell to report on. Defaults to the cell holding the formula.
 *
 * @remarks
 * This has similar functionality to Excel online but is missing formatting information from Excel desktop.
 * {@link https://support.office.com/client/results?authtype=unknown&lcid=1033&locale=en-us&ns=EXCEL&syslcid=1033&uilcid=1033&version=90&helpid=xlmain11.chm60173}
 */
export function CELL(
  infoType: CellInfoType,
  reference?: IReferenceRange
): Volatile<Scalar> {
  let retValue: Scalar = null;
  if (!reference) {
    // Creating a reference make a dynamic dependency.
    // In Excel using current cell reference will become stale so we are different but 'more correct'.
    reference = FormulaContext.getReference();
  }
  switch (infoType) {
    case CellInfoType.Address:
      // we just want the top left
      const coords = reference.getCoords();
      // (Excel also names the workbook — `[Book1]Data!$A$1` — IRuntime needs to provide.)
      const onAnotherSheet = FormulaContext.getSheetIndex(reference) !== FormulaContext.getSheetIndex();
      retValue = FormulaContext.getAddress({
        colIndex: coords.colStart,
        $colIndex: true,
        rowIndex: coords.rowStart,
        $rowIndex: true,
        scope: onAnotherSheet ? coords.scope : null
      })
      break;
    case CellInfoType.Col:
      // Opened even though only the position is answered: CELL depends on the cell's
      // VALUE for every info_type but "address" — `=CELL("row",A1)` in A1 is a circular
      // reference, `=CELL("address",A1)` is not.
      reference.getValueAt(0, 0);
      retValue = reference.getCoords().colStart + 1;
      break;
    case CellInfoType.Contents:
      retValue = reference.getValueAt(0, 0);
      break;
    case CellInfoType.Row:
      reference.getValueAt(0, 0); // see "col"
      retValue = reference.getCoords().rowStart + 1;
      break;
    case CellInfoType.Type:
      const value = reference.getValueAt(0, 0);
      if (value === null) {
        retValue = 'b';
      } else  if (typeof value === 'string') {
        retValue = 'l';
      } else {
        retValue = 'v';
      }
      break;
    default:
      retValue = FormulaError.BuiltIn.Value!
  }
  return retValue;
}

/**
 * Returns a number matching an error value.
 * @name ERROR.TYPE
 * @param errorVal is the error value for which you want the identifying number, and can be an actual error value or a reference to a cell containing an error value.
 */
export function ERROR_TYPE(errorVal: AcceptError<Scalar>): Scalar {
  if (FormulaError.isError(errorVal)) {
    return errorVal.getCode();
  }
  return FormulaError.BuiltIn.NA!;
}

/** The information to return about the operating environment. */
enum InfoType {
  /** Path of the current directory or folder. */
  Directory = 'directory',
  /** Amount of memory available. Legacy: answers #N/A. */
  MemAvail = 'memavail',
  /** Amount of memory being used for data. Legacy: answers #N/A. */
  MemUsed = 'memused',
  /** Number of active worksheets in the open workbooks. */
  NumFile = 'numfile',
  /** Absolute reference of the top and leftmost visible cell. */
  Origin = 'origin',
  /** Current operating system version, as text. */
  OSVersion = 'osversion',
  /** Current recalculation mode; "Automatic" or "Manual". */
  Recalc = 'recalc',
  /** Version of the application, as text. */
  Release = 'release',
  /** Name of the operating environment; "pcdos" or "mac". */
  System = 'system',
  /** Total memory available. Legacy: answers #N/A. */
  TotMem = 'totmem',
  /** The licensed user. Not part of Excel. */
  User = 'user',
}

/**
 * Returns information about the current operating system.
 * @param typeText The type of information to return.
 */
export function INFO(typeText: InfoType): Volatile<Scalar> {
  if (typeText === InfoType.Directory) {
    try {
      return FormulaContext.getRuntime().getLocation();
    } catch (e) {} // may not be available in all environments
    // Fallback for other environments
    return '..';
  }
  if (typeText === InfoType.NumFile) {
    return 1; // a NUMBER, not text — ISTEXT(INFO("NUMFILE")) is FALSE
  }
  if (typeText === InfoType.Origin) {
    // TODO - context.getView().getTopLeft(), and make it volatile with it.
    return '$A:$A$1';
  }
  if (typeText === InfoType.Recalc) {
    return 'Automatic'; // the calculation MODE by name, not a flag; the other spelling is 'Manual'
  }
  if (typeText === InfoType.Release) {
    return FormulaContext.getRuntime().getVersion();
  }
  if (typeText === InfoType.OSVersion) {
    return '1'; // TODO - implement (IRuntime.getOSVersion.)
  }
  if (typeText === InfoType.System) {
    // A two-word vocabulary of Excel's own, not the host's name for itself: `pcdos` on Windows
    // and `mac` on macOS.
    return FormulaContext.getRuntime().getOS() === 'mac' ? 'mac' : 'pcdos';
  }
  // The three memory codes are legacy: they are still ACCEPTED and answer #N/A rather than being
  // refused the way an unknown code is.
  if (typeText === InfoType.MemAvail || typeText === InfoType.MemUsed || typeText === InfoType.TotMem) {
    throw FormulaError.BuiltIn.NA;
  }
  // Not standard excel
  if (typeText === InfoType.User) {
    const licensee = FormulaContext.getRuntime().getUser();
    if (!licensee) {
      FormulaContext.formatResults('@[Red]');
      return 'Unidentified';
    }
    return licensee;
  }
  throw FormulaError.BuiltIn.Value;
}

/**
 * Checks whether a reference is to an empty cell, and returns TRUE or FALSE.
 * @param value is the cell or a name that refers to the cell you want to test.
 */
export function ISBLANK(value: AcceptError<Scalar>): boolean {
  return value === null;
}

/**
 * Returns TRUE if the value is a date.
 * @param value The value to check.
 * @category Sheets
 *
 * @remarks
 * A TEXT predicate, despite the name — it asks whether text spells a date, not whether a value
 * is one. In Sheets every number is FALSE at every serial, `0`, `1`, `2958465` and `-1` alike,
 * and so is `DATEVALUE("1/1/2020")`, whose declared return is a number. Booleans and blanks are
 * FALSE; errors propagate with their identity. Text is TRUE when the parser accepts the WHOLE
 * string — a bare `"July"` and `"2/30/2020"` are FALSE.
 *
 * Where Sheets and Excel disagree on a SPELLING, Excel wins here: `ISDATE("July 20 1969")` is
 * FALSE (Excel wants the comma in month-day-year order), `ISDATE("Feb 30")` is TRUE (Excel
 * reads a number that cannot be a day as a 2-digit year — Feb 1930), and `ISDATE("1969-20-07")`
 * is FALSE (year-first is year-month-day with a four-digit year; Sheets takes year-day-month,
 * Excel does not). All three are the opposite of Sheets, and all are inherited rather than
 * decided here: this shares the `DATEVALUE` parser, and that parser answers to Excel.
 *
 * **`ISDATE(A1)` on a date cell is FALSE here and TRUE in Sheets — deliberately.** Sheets reads
 * the referenced cell's NUMBER FORMAT, and that is the parity we cannot reach: a date here is a
 * number carrying a date format, formats are not exposed to a formula, and the calculation graph
 * does not treat a format edit as a change that dirties anything — so a format-reading `ISDATE`
 * would answer correctly once and then go stale on the next reformat. Reading the value instead
 * (any serial-range number is a date) was the alternative, and it was rejected: it would have
 * contradicted six of the Sheets results above to buy back one, and called `ISDATE(42)` a date.
 *
 * Sheets also answers TRUE for `ISDATE(TODAY())` and `ISDATE(TIME(13,0,0))` — there the
 * argument's static type is a date, which is why `DATEVALUE` differs from `TODAY` there despite
 * both evaluating to a number. That provenance does not survive to a function here either.
 */
export function ISDATE(value: Scalar): boolean {
  if (typeof value !== 'string') return false; // numbers included — see above
  try {
    // The `DATEVALUE`/`TIMEVALUE` parser, with `requireDate` left off: a time alone is a date in
    // Sheets (`ISDATE("13:00")` is TRUE).
    FormulaContext.parseAsSerialDate(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns TRUE if the value is a valid email address.
 * @param value The value to check.
 * @category Sheets
 */
export function ISEMAIL(value: string): boolean {
  if (typeof value !== 'string') return false;
  // Keep in step with `TextUtils.isValidEmail` in @sheetxl/sdk (which can't be imported here).
  if (value.length > 7 && value.substring(0, 7).toLowerCase() === 'mailto:') {
    return !/\s/.test(value);
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value);
}

/**
 * Checks whether a value is an error other than #N/A, and returns TRUE or FALSE.
 * @param value is the value you want to test. Value can refer to a cell, a formula, or a name that refers to a cell, formula, or value.
 */
export function ISERR(value: AcceptError<Scalar>): Scalar {
  return FormulaError.isError(value) && (!(value instanceof FormulaError.NA));
}

/**
 * Checks whether a value is an error, and returns TRUE or FALSE
 * @param value is the value you want to test. Value can refer to a cell, a formula, or a name that refers to a cell, formula, or value
 */
export function ISERROR(value: AcceptError<Scalar>): Scalar {
  return FormulaError.isError(value);
}

/**
 * Returns TRUE if the number is even.
 * @param number is the value to test.
 */
export function ISEVEN(number: NoLift<Scalar>): Scalar {
  return isEvenInt(number);
}

/**
 * Checks whether a reference is to a cell containing a formula, and returns TRUE or FALSE.
 * @param reference is a reference to the cell you want to test.  Reference can be a cell reference, a formula, or name that refers to a cell.
 */
export function ISFORMULA(reference: ReportType<IReferenceRange>): boolean {
  // A UNION answers from its FIRST area, as `SHEET`/`SHEETS` do — `ISFORMULA((PA1,PA2))` is
  // TRUE when PA1 holds a formula. The slot is `ReportType`, so the areas arrive whole and the shape reads
  // below must see the area, not the list.
  reference = firstArea(reference);
  const refCoords = reference.getCoords();
  const scope = refCoords.scope ?? undefined;
  // By position, never by value: `=ISFORMULA(M2)` in M2 asks about the cell's formula, not its
  // result, and is not a circular reference.
  return FormulaContext.createRange(reference.getRowCount(), reference.getColumnCount(), (_scalar: Scalar, coords: IRange.CellCoords) => {
    return FormulaContext.getFormulaAt(
      refCoords.rowStart + coords.rowIndex, refCoords.colStart + coords.colIndex, scope
    ) !== null;
  }) as unknown as boolean;
}

/**
 * Checks whether a value is a logical value (TRUE or FALSE), and returns TRUE or FALSE.
 * @param value is the value you want to test. Value can refer to a cell, a formula, or a name that refers to a cell, formula, or value.
 */
export function ISLOGICAL(value: AcceptError<Scalar>): boolean {
  return typeof value === 'boolean';
}

/**
 * Checks whether a value is #N/A, and returns TRUE or FALSE.
 * @param value is the value you want to test. Value can refer to a cell, a formula, or a name that refers to a cell, formula, or value.
 */
export function ISNA(value: AcceptError<Scalar>): boolean {
  return value instanceof FormulaError.NA;
}

/**
 * Checks whether a value is not text (blank cells are not text), and returns TRUE or FALSE.
 * @param value is the value you want tested: a cell; a formula; or a name referring to a cell, formula, or value.
 */
export function ISNONTEXT(value: AcceptError<Scalar>): boolean {
  return !_readsAsText(value);
}

/** Text, or rich data that reads as text (a rich text): what `ISTEXT` answers TRUE for. */
function _readsAsText(value: Scalar): boolean {
  if (typeof value === 'string') return true;
  return (value as IRichData)?.isIRichData === true && typeof (value as IRichData).toPrimitive?.() === 'string';
}

/**
 * Checks whether a value is not text (blank cells are not text), and returns TRUE or FALSE.
 * @param value is the value you want tested: a cell; a formula; or a name referring to a cell, formula, or value.
 */
export function ISNUMBER(value: AcceptError<Scalar>): boolean {
  return typeof value === 'number';
}

/**
 * Returns TRUE if the number is odd.
 * @param number is the value to test.
 */
export function ISODD(number: NoLift<Scalar>): Scalar {
  const even = isEvenInt(number);
  return FormulaError.isError(even) ? even : !even;
}

/**
 * The integer `ISEVEN` and `ISODD` both test, or the error the argument earns.
 *
 * @remarks
 * Two rules that neither the name nor the sibling `EVEN`/`ODD` pair predicts:
 *
 * * a BOOLEAN is `#VALUE!` here, where numeric text of every spelling (`"2"`, `" 2 "`, `"10%"`)
 *   converts. The pair is stricter than almost every other numeric slot in the library.
 * * the number is read at FIFTEEN SIGNIFICANT DIGITS before it is truncated —
 *   `ISEVEN(0.0003*10000)` is FALSE because 2.9999999999999996 reads as 3. `EVEN` and `ODD`, four
 *   letters away, read the RAW double at the same position.
 *
 * A blank cell is 0, and 0 is even.
 */
function isEvenInt(raw: Scalar): Scalar {
  if (typeof raw === 'boolean') return FormulaError.BuiltIn.Value!;
  const value = (raw === null || raw === undefined) ? 0 : FormulaContext.parseAsNumber(raw);
  return Math.trunc(round15(value)) % 2 === 0;
}

/**
 * Checks whether the value is omitted, and returns TRUE or FALSE.
 * @param argument is the value you want to test, such as a LAMBDA parameter.
 */
export function ISOMITTED(argument: AcceptError<any>): boolean {
  // The question is about the BINDING, not the value, so the slot takes its argument WHOLE —
  // `ISOMITTED(A1:A3)` is a single FALSE, never a lifted spill. Only an omitted binding (the
  // engine's raw frame read reaches this function alone) reads as the Omitted kind; everything
  // else — blanks, values, ranges, errors — was supplied and answers FALSE.
  return FormulaContext.getArgs().getKindAt(0) === ValueKind.Omitted;
}

/**
 * Returns TRUE if the value is a valid HTTP or HTTPS URL.
 * @param value The value to check.
 * @category Sheets
 */
export function ISURL(value: string): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  } catch {
    return false;
  }
  return RegExValidHttpUrl.test(value);
}

/**
 * Checks whether a value is a reference, and returns TRUE or FALSE.
 * @param value is the value you want to test. Value can refer to a cell, a formula, or a name that refers to a cell, formula, or value.
 */
export function ISREF(value: Flatten<AcceptError<IRange>>): boolean {
  // We accept anything and do a runtime check.
  if (!value || value.length === 0) return false;
  for (let i=0; i<value.length; i++) {
    if (!(value[i] as IReferenceRange)?.isIReferenceRange) return false;
  }
  return true;
}

/**
 * Converts a value to text in a specific number format.
 * @param value is a number, a formula that evaluates to a numeric value, or a reference to a cell containing a numeric value.
 */
export function ISTEXT(value: AcceptError<Scalar>): boolean {
  return _readsAsText(value);
}

/**
 * Converts non-number value to a number, dates to serial numbers, TRUE to 1, anything else to 0 (zero).
 * @param value is the value to convert.
 */
export function N(value: IRange | Scalar): Scalar {
  // A lambda is not "anything else": it coerces to no number at all — #VALUE!, where text and
  // blanks read 0. Asked FIRST because the range arm boxes a lambda as a 1x1 literal, so the
  // container test below cannot tell it from a one-cell array. The kind surface is the test; the
  // delivered value is opaque here.
  if (FormulaContext.getArgs().getKindAt(0) === ValueKind.Lambda) return FormulaError.BuiltIn.Value!;
  const container = (value as IRange)?.isIRange === true ? value as IRange : null;
  if (container) return readFirstOrMembers(container, asNumeric);
  return asNumeric(value as Scalar);
}

/**
 * `N`'s per-value reading: a number is itself, a boolean is 0 or 1, everything else is 0.
 */
const asNumeric = (value: Scalar): Scalar => {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return Number(value);
  return 0;
};

/**
 * Returns the #N/A error value
 */
export function NA(): FormulaError.Known {
  return FormulaError.BuiltIn.NA!;
}

/**
 * The FIRST area of a `ReportType` reference slot, or the reference unchanged.
 *
 * @remarks
 * `SHEET((PA1,PA2))` is 1, `SHEETS((PA1,PA2))` is 1 and `ISFORMULA((PA1,PA2))` answers for PA1.
 * These three ask WHERE a reference is, and a union answers from its first area rather
 * than refusing (which is `ROWS`, whose question has no single answer) or flattening (which is the
 * aggregates, whose question is about values).
 */
const firstArea = <T>(value: T | T[]): T => (Array.isArray(value) ? value[0] : value);

/**
 * Returns the sheet number of the referenced sheet.
 * @param value is the name of a sheet or a reference that you want the sheet number of. If omitted the number of the sheet containing the function is returned.
 */
export function SHEET(
  value?: ReportType<IRange>
): Scalar { // number
  value = value === undefined ? undefined : firstArea(value);
  // No argument: the sheet being calculated.
  if (value === undefined) {
    const current = FormulaContext.getSheetIndex();
    return current >= 0 ? current + 1 : FormulaError.BuiltIn.NA!;
  }
  // A reference answers from its own location, never from what it contains.
  if ((value as IReferenceRange).isIReferenceRange) {
    const index = FormulaContext.getSheetIndex(value as IReferenceRange);
    return index >= 0 ? index + 1 : FormulaError.BuiltIn.NA!;
  }
  // Anything else is a name lookup, and only a single text value can be one.
  const single = value.size === 1 ? value.getValueAt(0, 0) : null;
  if (typeof single !== 'string') return FormulaError.BuiltIn.NA!;
  const index = FormulaContext.getSheetIndex(single);
  return index >= 0 ? index + 1 : FormulaError.BuiltIn.NA!;
}

/**
 * Returns the number of sheets in a reference.
 * @param reference is a reference for which you want to know the number of sheets it contains. If omitted the number of sheets in the workbook containing the function is returned.
 *
 * @remarks
 * A non-reference argument — a number, text, an array, a computed value — returns `#N/A`.
 */
export function SHEETS(
  reference?: ReportType<IRange>
): number | FormulaError.Known {
  if (reference === undefined) return FormulaContext.getSheetCount()!;
  // A 3-D reference (`Alpha:Gamma!A1`) arrives as one area per sheet it covers and counts them.
  // Over another workbook's sheets the answer is `#N/A`.
  if (Array.isArray(reference) && (reference as { isSheetSpan?: true }).isSheetSpan) {
    const first = reference[0] as IReferenceRange;
    return FormulaContext.getSheetIndex(first) >= 0 ? reference.length : FormulaError.BuiltIn.NA!;
  }
  reference = firstArea(reference);
  if (!(reference as IReferenceRange).isIReferenceRange) return FormulaError.BuiltIn.NA!;
  return 1;
}

/**
 * The numeric codes `TYPE` answers, keyed by kind — including a lambda, which answers 128. A blank answers 1, and so does an omitted argument. `ScalarType` is a
 * SUBSET of `ValueKind`, which is what lets a dereferenced cell VALUE index the same map as an
 * argument kind.
 */
const TYPE_CODES: Partial<Record<ValueKind, number>> = {
  [ValueKind.Number]: 1,
  [ValueKind.Null]: 1,
  [ValueKind.String]: 2,
  [ValueKind.Boolean]: 4,
  [ValueKind.Error]: 16,
  [ValueKind.Array]: 64,
  [ValueKind.RichData]: 128,
  [ValueKind.Lambda]: 128
};

/**
 * Returns an integer representing the data type of a value: number = 1; text = 2; logical value = 4; error value = 16; array = 64; compound data = 128.
 * @param value is the value to check.
 */
export function TYPE(value: AcceptError<IRange>): number {
  // A bare error arrives RAW (the engine's auto-reject is off); a range holding one is a range.
  if (FormulaError.isError(value)) return TYPE_CODES[ValueKind.Error]!;
  let kind: ValueKind = FormulaContext.getArgs().getKindAt(0);
  if (kind === ValueKind.Reference) {
    // A multi-cell reference reads as an array; a single cell DEREFERENCES to its value's
    // ScalarType — a kind again (TYPE(D1:D3) is 64, TYPE(<blank cell>) is 1).
    if (value.getColumnCount() > 1 || value.getRowCount() > 1) return TYPE_CODES[ValueKind.Array]!;
    kind = _scalarKindOf(value.getValueAt(0, 0));
  }
  return TYPE_CODES[kind] ?? 1;
}

/** A cell VALUE's `ScalarType`, as the {@link ValueKind} subset it is. */
function _scalarKindOf(scalar: Scalar): ValueKind {
  if (scalar === null) return ValueKind.Null;
  if (FormulaError.isError(scalar)) return ValueKind.Error;
  const type = typeof scalar;
  if (type === 'string') return ValueKind.String;
  if (type === 'boolean') return ValueKind.Boolean;
  if ((scalar as IRichData)?.isIRichData === true) {
    // Rich data is the kind of its primitive (a rich text is text, 2; a rich error is an error,
    // 16); 128 only for a kind that reads as nothing (an image).
    const primitive = (scalar as IRichData).toPrimitive?.();
    switch (typeof primitive) {
      case 'string': return ValueKind.String;
      case 'number': return ValueKind.Number;
      case 'boolean': return ValueKind.Boolean;
    }
    if (FormulaError.isError(primitive)) return ValueKind.Error;
    return ValueKind.RichData;
  }
  return ValueKind.Number;
}

// helpers
const RegExValidHttpUrl = new RegExp(
  '^([a-zA-Z]+:\\/\\/)?' +
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' +
    '((\\d{1,3}\\.){3}\\d{1,3}))' +
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' +
    '(\\?[;&a-z\\d%_.~+=-]*)?' +
    '(\\#[-a-z\\d_]*)?$',
  'i'
);