/* cspell: disable */
import {
  IRange, FormulaError, FormulaContext, WildCard, ValueKind,
  type AcceptError, type Scalar, type IReferenceRange, type IRichData, type IRichType, type IFormulaContext,
  type Repeating, type Flatten, type Lazy, type Omittable, type NoLift, type ReportType
} from '@sheetxl/primitives';

import { IncludeEmpty, ColumnOriented, RowOriented } from '../_utils/Consts';
import { round15, excelCount } from '../_utils/Arithmetic';

/**
 * Creates a cell reference as text, given specified row and column numbers.
 * @param rowNum is the row number to use in the cell reference: Row_number = 1 for row 1.
 * @param columnNum is the column number to use in the cell reference. For example, Column_number = 4 for column D.
 * @param absNum specifies the reference type: absolute = 1; absolute row/relative column = 2; relative row/absolute column = 3; relative = 4.
 * @param a1 is a logical value that specifies the reference style: A1 style = 1 or TRUE; R1C1 style = 0 or FALSE.
 * @param sheetText is text specifying the name of the worksheet to be used as the external reference.
 */
export function ADDRESS(
  rowNum: number,
  columnNum: number,
  absNum: Omittable<number>=1,
  a1: Omittable<boolean>=true,
  // The empty NAME and no name at all are different answers — `ADDRESS(2,3,1,TRUE,"")` is
  // `!$C$2` and `ADDRESS(2,3,1,TRUE)` is `$C$2` — so the three positions have to be told apart,
  // and an OMITTED sheet sides with the ABSENT one where a blank CELL (which coerces to the empty
  // name, and takes the `!`) does not. Undeclared, an omitted argument would read as the cell.
  sheetText: Omittable<string> = undefined
): string {
  // Every one of the three counts is the double's 15-significant-digit reading, truncated toward
  // zero, and each is then bounded: the row and column by the GRID and `abs_num` by its four
  // values. `ADDRESS(0.0003*10000,1)` — 2.9999999999999996 — is row 3, `ADDRESS(2.9,3,2.9)` is
  // `C$2`, and `ADDRESS(1048577,1)` is #VALUE! rather than an address off the sheet.
  const row = _lookupIndex(rowNum);
  const column = _lookupIndex(columnNum);
  const abs = _lookupIndex(absNum);
  const entire = FormulaContext.getEntireCoords();
  if (abs < 1 || abs > 4) throw FormulaError.BuiltIn.Value;
  // A relative R1C1 part is an OFFSET, so zero and negatives are legal there —
  // `ADDRESS(-1,0,4,FALSE)` is `R[-1]C`. Every other part is a 1-based position.
  const relativeRow = !a1 && (abs === 3 || abs === 4);
  const relativeColumn = !a1 && (abs === 2 || abs === 4);
  if (relativeRow ? Math.abs(row) > entire.rowEnd : (row < 1 || row > entire.rowEnd + 1)) throw FormulaError.BuiltIn.Value;
  if (relativeColumn ? Math.abs(column) > entire.colEnd : (column < 1 || column > entire.colEnd + 1)) throw FormulaError.BuiltIn.Value;

  // For A1 notation: always subtract 1 (0-based indexing)
  // For R1C1 notation: subtract 1 only for absolute references; relative references use offset as-is
  const rowOffset = a1 || (abs === 1 || abs === 2) ? -1 : 0;
  const colOffset = a1 || (abs === 1 || abs === 3) ? -1 : 0;

  const asFixed: IRange.FixableCellCoords = {
    $colIndex: abs === 1 || abs === 3,
    colIndex: column + colOffset,
    $rowIndex: abs === 1 || abs === 2,
    rowIndex: row + rowOffset,
    scope: sheetText || undefined
  }
  const result = FormulaContext.getAddress(asFixed, !a1);
  // prepend '!' when sheetText is explicitly passed as empty string
  return sheetText === '' ? '!' + result : result;
}

/**
 * Returns the number of areas in a reference. An area is a range of contiguous cells or a single cell.
 * @param references is a reference to a cell or range of cells and can refer to multiple areas.
 */
export function AREAS(references: Flatten<IReferenceRange>): number {
  return references.length;
}

/**
 * Constrains an array result to a specified size.
 * @param inputRange The range to constrain.
 * @param numRows The number of rows the result should contain.
 * @param numCols The number of columns the result should contain.
 * @category Sheets
 */
export function ARRAY_CONSTRAIN(
  inputRange: IRange,
  numRows: number,
  numCols: number
): IRange {

  if (numRows < 0 || numCols < 0) return FormulaError.BuiltIn.Num!;
  numRows = Math.trunc(numRows);
  numCols = Math.trunc(numCols);
  if (numRows < 1 || numCols < 1) return FormulaError.BuiltIn.Ref!;

  return inputRange.slice({
    rowStart: 0,
    colStart: 0,
    rowEnd: Math.min(numRows, inputRange.getRowCount()) - 1,
    colEnd: Math.min(numCols, inputRange.getColumnCount()) - 1
  });
}

/**
 * Enables the display of values returned from an array formula into multiple rows and/or columns.
 * @param arrayFormula A range, a mathematical expression over ranges of the same size, or a function that returns a result of more than one cell.
 * @category Sheets
 *
 * @remarks
 * Identity. In Sheets this wrapper exists to switch a formula out of implicit intersection and
 * into array evaluation.
 * Here every formula already evaluates as an array and spills, so there for pure sheet compatiblity.
 */
export function ARRAYFORMULA(arrayFormula: IRange): IRange {
  return arrayFormula;
}

/**
 * Chooses a value or action to perform from a list of values, based on an index number.
 * @param indexNum specifies which value argument is selected. Index_num must be between 1 and 254, or a formula or a reference to a number between 1 and 254.
 * @param value are 1 to 254 numbers, cell references, defined names, formulas, functions, or text arguments from which CHOOSE selects.
 */
export function CHOOSE(
  indexNum: number,
  value: Lazy<AcceptError<any>>[]
): any {
  const valueLength = value.length;
  if (valueLength < 1 || valueLength > 254) throw FormulaError.BuiltIn.Value;
  const index = Math.trunc(indexNum);
  if (index < 1 || index > valueLength) throw FormulaError.BuiltIn.Value;
  // The arms are HANDLES and only the selected one is returned, so the others are never opened.
  // The INDEX is eager, as every selector is.
  return value[index - 1];
}

/**
 * Returns columns from an array or reference.
 * @param array The array or reference from which to choose columns.
 * @param colNum The number of the column to be returned.
 */
export function CHOOSECOLS(
  array: Flatten<IRange>,
  colNum: Repeating<number, 254>
): IRange {
  // A UNION is #REF! here where TAKE and DROP answer #VALUE! for the same argument. The split is
  // the RETURN TYPE, not the shape: TAKE and DROP hand back a reference and are asked to describe
  // one, while CHOOSECOLS hands back a value and answers the way COLUMNS does — no single extent
  // to describe.
  if (array.length > 1) return FormulaError.BuiltIn.Ref!;
  const range = array[0];
  const columns = range.getColumnCount();
  const indices = colNum.map(index => {
    // Truncate FIRST, then flip: `-2.9` is the SECOND column from the right, where truncating the
    // flipped `columns + index` lands on the third.
    const n = Math.trunc(index);
    if (n === 0) throw FormulaError.BuiltIn.Value;
    const col = n > 0 ? n - 1 : columns + n; // negative indices count from the right
    if (col < 0 || col >= columns) throw FormulaError.BuiltIn.Value;
    return col;
  });

  return range.take(indices, IRange.Axis.Column);
}

/**
 * Returns rows from an array or reference.
 * @param array The array or reference from which to choose rows.
 * @param rowNum The number of the row to be returned.
 */
export function CHOOSEROWS(
  array: Flatten<IRange>,
  rowNum: Repeating<number, 254>
): IRange {
  // See CHOOSECOLS — same rules, other axis.
  if (array.length > 1) return FormulaError.BuiltIn.Ref!;
  const range = array[0];
  const rows = range.getRowCount();
  const indices = rowNum.map(index => {
    const n = Math.trunc(index);
    if (n === 0) throw FormulaError.BuiltIn.Value;
    const row = n > 0 ? n - 1 : rows + n; // negative indices count from the bottom
    if (row < 0 || row >= rows) throw FormulaError.BuiltIn.Value;
    return row;
  });

  return range.take(indices, IRange.Axis.Row); // Row is the default
}

/**
 * The range an omitted reference stands for when it is more than the formula's cell, else `null`.
 *
 * @remarks
 * With no argument `ROW` and `COLUMN` describe the range their formula occupies. That is one cell
 * and one number, except for an array-entered formula, which occupies its whole block:
 * `{=COLUMN()}` entered over F6:H6 is `COLUMN(F6:H6)` — 6, 7, 8 — and `{=SUM(COLUMN())}` is 21 in
 * each of the three cells.
 */
function ownBlock(): IReferenceRange | null {
  if (FormulaContext.isImplicitIntersect()) return null; // value mode: never an array-entered block
  const own = FormulaContext.getReference();
  return own.size > 1 ? own : null;
}

/**
 * Returns the column number of a reference.
 * @param reference is the cell or range of contiguous cells for which you want the column number. If omitted, the cell containing the COLUMN function is used.
 * @returnKind number
 */
export function COLUMN(reference?: Flatten<IReferenceRange>): number | number[] {
  if (!reference || reference.length === 0) {
    const own = ownBlock();
    if (own === null) return FormulaContext.getColumn() + 1;
    reference = [own];
  }
  // A union has no single position to describe — `#REF!`.
  if (reference.length > 1) return FormulaError.BuiltIn.Ref! as unknown as number[];

  const retValue = [];
  const coords = reference[0].getCoords();
  const coordsColStart = coords.colStart;
  const coordsColEnd = coords.colEnd;
  for (let j=coordsColStart; j<=coordsColEnd; j++) {
    retValue.push(j+1);
  }
  return retValue;
}

/**
 * Returns the number of columns in an array or reference.
 * @param array is an array or array formula, or a reference to a range of cells for which you want the number of columns.
 */
export function COLUMNS(array: Flatten<IRange>): number | FormulaError.Known {
  if (array.length > 1) return FormulaError.BuiltIn.Ref!; // no single extent to describe
  return array[0].getColumnCount();
}

/**
 * Drops rows or columns from array start or end.
 * @param array The array from which to drop rows or columns.
 * @param row The number of rows to drop. A negative value drops from the end of the array.
 * @param columns The number of columns to drop. A negative value drops from the end of the array.
 */
export function DROP(
  array: IRange,
  row: number,
  columns?: Omittable<number>
): IReferenceRange { // declared IReferenceRange to mirror Excel's signature (see TAKE); over an array argument the result is a plain array
  // A count that EXHAUSTS an axis is #CALC! rather than an empty answer — dropping three rows of
  // three, or three hundred, or three from the far end, and a blank cell dropped at all. TAKE
  // reaches the same #CALC! from the opposite direction (a count of zero), so between them zero
  // and the extent are the two ends neither function can answer across.
  //
  // An omitted or blank count is ZERO here, where TAKE's is the whole extent — the two slots look
  // alike and are not, which is why neither is declared from the other.
  const rows = array.getRowCount();
  const cols = array.getColumnCount();
  columns = Math.trunc(columns ?? 0);
  row = Math.trunc(row);
  if (Math.abs(row) >= rows || Math.abs(columns) >= cols) return FormulaError.BuiltIn.Calc! as unknown as IReferenceRange;
  const rowStart = row >= 0     ? row      : 0;
  const rowEnd   = row >= 0     ? rows - 1 : rows + row - 1;
  const colStart = columns >= 0 ? columns : 0;
  const colEnd   = columns >= 0 ? cols - 1       : cols + columns - 1;
  return array.slice({ rowStart, rowEnd, colStart, colEnd }) as unknown as IReferenceRange;
}

/**
 * Expands an array to the specified dimensions.
 * @param array The array to expand.
 * @param row The number of rows in the expanded array. If missing, rows will not be expanded.
 * @param columns The number of columns in the expanded array. If missing, columns will not be expanded.
 * @param padWith The value with which to pad. The default is #N/A.
 */
/**
 * The range an `IRange | Scalar` array slot delivered. At SORT, SORTBY, UNIQUE, EXPAND, WRAPROWS
 * and WRAPCOLS a one-cell argument is read as THE ARGUMENT — the engine dereferences it and raises
 * its error in argument order, before any later slot is coerced (`SORT(<#N/A cell>,1,1,<#DIV/0!
 * cell>)` is #N/A; TAKE, DROP, INDEX and the rest read the same cell as a one-cell container and
 * answer #DIV/0!). What reaches the body is
 * therefore either a range or a plain value, and the body boxes the value to work on one shape.
 */
const _asRange = (arrayOrValue: IRange | Scalar): IRange =>
  (arrayOrValue as IRange)?.isIRange === true ? arrayOrValue as IRange : FormulaContext.createRange(1, 1, arrayOrValue as Scalar);

export function EXPAND(
  array: IRange | Scalar,
  row: Omittable<number>,
  columns?: Omittable<number>,
  padWith: NoLift<Omittable<AcceptError<Scalar>>> = FormulaError.BuiltIn.NA! // pad passthrough — an error pad fills as that error
): IRange {
  // A target SMALLER than the argument is #VALUE! on either axis — EXPAND cannot shrink, which is
  // where it parts company with TAKE over the same ladder. An OMITTED target keeps that axis as
  // it is (`EXPAND(a,,5)` widens and leaves the height alone), so both count slots are `Omittable`
  // with no initializer; the pad's initializer, by contrast, covers the omitted position too —
  // `EXPAND(a,4,4,)` pads with #N/A, not with the blank an undeclared slot would coerce to.
  //
  // Past the target, two different refusals: a count over 2^31-1 is #VALUE! and one merely too
  // large is #NUM!. BOTH axes are bounded, and both at 1,048,576 — the grid's ROW count, applied
  // to the width as well: 1,048,576 columns build and 1,048,577 are #NUM!, while 16,385 (past the
  // last COLUMN) is an ordinary answer that merely fails to spill.
  //
  // The two COUNT slots lift and the pad does not: `COLUMNS(EXPAND(a,<1x3>,4))` is 3 — one answer
  // per member, each of them #VALUE! because a smaller target cannot shrink — while a 1x2 at the
  // pad is a flat #VALUE!.
  const source = _asRange(array);
  const rowsOrig = source.getRowCount();
  const colsOrig = source.getColumnCount();
  const rows = row === undefined ? rowsOrig : Math.trunc(row);
  const cols = columns === undefined ? colsOrig : Math.trunc(columns);
  if (rows > 2147483647 || cols > 2147483647) return FormulaError.BuiltIn.Value!;
  if (rows < rowsOrig || cols < colsOrig) return FormulaError.BuiltIn.Value!;
  const entire = FormulaContext.getEntireCoords();
  const extentCap = entire.rowEnd - entire.rowStart + 1;
  if (rows > extentCap || cols > extentCap) return FormulaError.BuiltIn.Num!;
  return source.resize(rows, cols, padWith as Scalar);
}

/**
 * Extracts a value from a field of a given record.
 * @param value The record from which you want to extract the field.
 * @param fieldName The names of the field or fields that you want to extract.
 */
export function FIELDVALUE(
  value: AcceptError<IRichData>,
  fieldName: string
): Scalar | IRange {
  // Anything at `value` that is not a record is #FIELD!, and an error is not a record: it arrives
  // here rather than propagating. An error at `fieldName` does propagate, and wins over a
  // non-record `value` — `FIELDVALUE(NA(),1/0)` is #DIV/0!.
  //
  // The name matches ignoring case and nothing else (`" Population"` is #FIELD!). A field the
  // kind keeps out of dot notation is #FIELD! here too — `ShowInDotNotation` governs both, while
  // the card and autocomplete flags govern neither — and that is how the reserved keys (`_DisplayString`, `%EntityId`) stay out of reach.
  //
  // A list field spills (`"Leader(s)"` is 2x1); a nested record arrives as the record itself.
  if ((value as IRichData)?.isIRichData !== true || FormulaError.isError(value)) return FormulaError.BuiltIn.Field!;
  const kind = value.getKind();
  const property = _fieldOf(kind, fieldName);
  if (!property) return FormulaError.BuiltIn.Field!;
  const meta = value.getPropertyMeta ? value.getPropertyMeta(property.name) : property.meta;
  if (meta?.excludeFrom?.dotNotation) return FormulaError.BuiltIn.Field!;
  const field = value.getProperty(property.name);
  const asArray = (field as IRichData)?.isIRichData === true ? (field as IRichData).toArray?.() : null;
  if (!asArray) return field;
  const rows = asArray.length;
  const columns = rows > 0 ? asArray[0].length : 0;
  if (rows === 0 || columns === 0) return FormulaError.BuiltIn.Field!;
  if (rows === 1 && columns === 1) return asArray[0][0];
  return FormulaContext.createRange(rows, columns, asArray);
}

/** The kind's property named `name` ignoring case, preferring the exact spelling. */
const _fieldOf = (kind: IRichType, name: string): IRichType.Property | null => {
  const exact = kind.getProperty(name);
  if (exact) return exact;
  const folded = name.toUpperCase();
  const properties = kind.getProperties();
  for (let i=0; i<properties.length; i++) {
    if (properties[i].name.toUpperCase() === folded) return properties[i];
  }
  return null;
}

const _OptionsRawValue: IRange.ValueOptions = Object.freeze({ type: null });

/**
 * Filter a range or array.
 * @param array the range or array to filter.
 * @param include an array of booleans where TRUE represents a row or column to retain.
 * @param ifEmpty return if no items are retained.
 */
export function FILTER(
  array: Flatten<IRange>,
  include: Flatten<IRange<boolean>>,
  ifEmpty?: Omittable<AcceptError<IRange>>
): IRange {
  // - a UNION at `array` or `include` is #REF!, the way it is at CHOOSEROWS — both slots answer
  //   with a VALUE, so there is no single extent to describe. At `if_empty` a
  //   union is fine, because that slot is never described, only handed back.
  // - **`if_empty` is LAZY.** `FILTER(A1:A3,A1:A3>0,NA())` is the filtered column, not #N/A: a
  //   fault in that slot — an error, an empty array, a union — never surfaces unless the filter
  //   actually selected nothing. It is declared `AcceptError` so the error arrives as a VALUE
  //   rather than propagating through the call, and the body simply does not look at it.
  // - an OMITTED `if_empty` (`FILTER(a,b,)`) is the ABSENT one, so an empty answer is #CALC!;
  //   a blank CELL there is the value zero.
  if (array.length > 1 || include.length > 1) return FormulaError.BuiltIn.Ref!;
  const arrayArea = array[0];
  const includeArea = include[0];
  return _filter(arrayArea, includeArea, ifEmpty);
}

const _filter = (
  array: IRange,
  include: IRange<boolean>,
  ifEmpty?: Omittable<AcceptError<IRange>>
): IRange => {
  const arrayRows = array.getRowCount();
  const arrayCols = array.getColumnCount();
  const includeRows = include.getRowCount();
  const includeCols = include.getColumnCount();

  // The include is a column as tall as the array or a row as wide as it. A single value is
  // whichever of the two it fits: `FILTER(B1:B3,TRUE)` keeps the one column, and so the whole
  // array, `FILTER(B1:B3,FALSE)` keeps nothing, and `FILTER(A1:B3,TRUE)` fits neither.
  const filterRows = includeCols === 1 && includeRows === arrayRows;
  const filterCols = !filterRows && includeRows === 1 && includeCols === arrayCols;
  if (!filterRows && !filterCols) throw FormulaError.BuiltIn.Value;

  /** performance optimization - but not much as getValueAt is already internally optimized */
  let lastFilter = -1;
  let lastIncludeValue: boolean | null = null;
  const result = array.filter((value, coords) => {
    const filterIndex = filterRows ? coords.rowIndex : coords.colIndex;
    if (filterIndex !== lastFilter) {
      // RAW read: the boolean-typed handle would filter a text member to null before the
      // text check below could refuse it (all-blank include → #CALC! instead of #VALUE!).
      const includeVal = filterRows
        ? include.getValueAt(filterIndex, 0, _OptionsRawValue)
        : include.getValueAt(0, filterIndex, _OptionsRawValue);
      if (FormulaError.isError(includeVal)) throw includeVal;
      // Text in the include is #VALUE! — EXCEPT the boolean spellings, which are read as booleans in
      // both shapes (a text cell and an array constant) and in any case. Nothing is trimmed first:
      // `" TRUE "` is #VALUE! where `"true"` filters.
      let includeBool: Scalar = includeVal as Scalar;
      if (typeof includeBool === 'string') {
        const spelling = includeBool.toUpperCase();
        if (spelling !== 'TRUE' && spelling !== 'FALSE') throw FormulaError.BuiltIn.Value;
        includeBool = spelling === 'TRUE';
      }
      lastFilter = filterIndex;
      lastIncludeValue = !!includeBool;
    }
    // The include's member is read BEFORE the array's: `FILTER(<#N/A cell>,<#DIV/0! cell>)` is
    // #DIV/0!, while the shape check above still comes first
    // (`FILTER(<4x2>,<#N/A cell>,…)` is #VALUE!). An error member of `array` rides into the output.
    if (FormulaError.isError(value)) return value;
    return lastIncludeValue!;
  }, {
    axis: filterRows ? IRange.Axis.Row : IRange.Axis.Column,
    onError: 'value' // propogate errors.
  });

  if (result.size === 0) {
    if (ifEmpty === undefined) throw FormulaError.BuiltIn.Calc;
    // `if_empty` is handed back as a VALUE, never as the reference the slot took:
    // `ISREF(FILTER(a,<none>,<blank cell>))` is FALSE, its `TYPE` is 1 and `ISBLANK` is FALSE —
    // a ONE-CELL reference is dereferenced, and a blank cell's value is zero. A multi-cell one
    // keeps its blanks as blank members (`COUNTA` over three blank cells is 3), which is what
    // handing the container back already does.
    const asRange = ifEmpty as IRange;
    if (asRange?.isIRange === true && asRange.getRowCount() === 1 && asRange.getColumnCount() === 1) {
      return (asRange.getValueAt(0, 0) ?? 0) as unknown as IRange;
    }
    return asRange;
  }
  return result;
};

/**
 * Returns a formula as a string.
 * @param reference is a reference to a formula.
 */
export function FORMULATEXT(reference: Flatten<IReferenceRange>): string {
  // A union answers `#N/A` in the SHAPE of its first area (`FORMULATEXT((A1:A3,B1:B3))` is 3x1
  // of #N/A, `((A1,B1,C1))` is one #N/A).
  if (reference.length > 1) {
    const first = reference[0];
    return FormulaContext.createRange(first.getRowCount(), first.getColumnCount(), () => FormulaError.BuiltIn.NA) as unknown as string;
  }
  const area = reference[0];
  const refCoords = area.getCoords();
  const scope = refCoords.scope ?? undefined;
  // By position, never by value: `=FORMULATEXT(N2)` in N2 asks about the cell's formula, not its
  // result, and is not a circular reference.
  return FormulaContext.createRange(area.getRowCount(), area.getColumnCount(), (_scalar: Scalar, coords: IRange.CellCoords) => {
    const asText = FormulaContext.getFormulaAt(
      refCoords.rowStart + coords.rowIndex, refCoords.colStart + coords.colIndex, scope
    );
    return asText === null ? FormulaError.BuiltIn.NA : '=' + asText;
  }) as unknown as string;
}

/**
 * Extracts data stored in a PivotTable.
 * @param dataField is the name of the data field to extract data from.
 * @param pivotTable is a reference to a cell or range of cells in the PivotTable that contains the data you want to retrieve.
 * @param fieldItem the field/item pairs to refer to.
 * @param fieldItem.field field to refer to.
 * @param fieldItem.item field item to refer to.
 */
export function GETPIVOTDATA(
  // Both read as what arrived: the older form puts the pivot first, as a reference that must
  // neither be read nor lift, and its text second.
  dataField: ReportType<IRange>,
  pivotTable: ReportType<IRange>,
  fieldItem?: Repeating<[field: string, item?: Scalar]>
): Scalar {
  // The group's last slot is optional because Excel accepts a LONE trailing field: the accepted
  // counts are 2,3,4,6,8,10,12 — pairs, plus 3, which answers #REF!.
  const args = FormulaContext.getArgs();
  // Excel 2000's form, `GETPIVOTDATA(pivot, "Region[East] Apple")`: two arguments with a reference
  // first. `GETPIVOTDATA(H2, pivot)` with H2 holding a data field's name is this form too, and `#REF!`.
  if (args.getLength() === 2 && args.getKindAt(0) === ValueKind.Reference) {
    return pivotDataByName(args.getRawAt(0), pivotTable);
  }
  const found = pivotViewOf(pivotTable);
  if ('answer' in found) return found.answer;
  const view = found.view;
  const name = textOf(dataField);
  if (FormulaError.isError(name)) return name;
  const dataIndex = findDataField(view, name);
  if (dataIndex === -1) return FormulaError.BuiltIn.Ref!;

  const items = new Map<number, number>();
  const fields = view.getFields();
  for (const [field, item] of fieldItem ?? []) {
    if (item === undefined) return FormulaError.BuiltIn.Ref!;
    const name = String(field ?? '').toLowerCase();
    const fieldIndex = fields.findIndex((candidate) => candidate.name.toLowerCase() === name);
    if (fieldIndex === -1) return FormulaError.BuiltIn.Ref!;
    const itemIndex = findItem(fields[fieldIndex].items, item);
    if (itemIndex === -1) return FormulaError.BuiltIn.Ref!;
    const before = items.get(fieldIndex);
    if (before !== undefined && before !== itemIndex) return FormulaError.BuiltIn.Ref!;
    items.set(fieldIndex, itemIndex);
  }
  return view.getValue(dataIndex, items) ?? FormulaError.BuiltIn.Ref!;
}

/** A data field by the name the table shows, else by the name of the field it summarizes. */
const findDataField = (view: IFormulaContext.PivotView, name: string): number => {
  const wanted = name.toLowerCase();
  const dataFields = view.getDataFields();
  const shown = dataFields.findIndex((field) => field.name.toLowerCase() === wanted);
  if (shown !== -1) return shown;
  return dataFields.findIndex((field) => field.sourceName.toLowerCase() === wanted);
};

/**
 * An item by value for a number or a logical; for text, by the text it shows, which is its caption
 * when it has one: a renamed number no longer answers to its value as text.
 */
const findItem = (items: readonly IFormulaContext.PivotViewItem[], item: Scalar): number => {
  if (typeof item === 'string') {
    const wanted = item.toLowerCase();
    return items.findIndex((candidate) => (candidate.name ?? candidate.text).toLowerCase() === wanted);
  }
  if (typeof item === 'number' || typeof item === 'boolean') {
    return items.findIndex((candidate) => candidate.value === item);
  }
  return -1;
};

/**
 * The pivot table a GETPIVOTDATA argument names, or what the call answers instead: `#REF!` when
 * there is none, and the cell's saved value when its values are not computed here — Excel answers
 * from the pivot, which only changes on a refresh, and writing the formula clears that value.
 */
const pivotViewOf = (pivotTable: unknown): { view: IFormulaContext.PivotView } | { answer: Scalar } => {
  const reference = Array.isArray(pivotTable) ? (pivotTable.length === 1 ? pivotTable[0] : null) : pivotTable;
  const view = (reference as IReferenceRange | null)?.isIReferenceRange ? FormulaContext.getPivotAt(reference as IReferenceRange) : null;
  if (!view) return { answer: FormulaError.BuiltIn.Ref! };
  if (view.isComputed?.() === false) {
    const kept = FormulaContext.getValueAt(FormulaContext.getRow(), FormulaContext.getColumn());
    return { answer: kept !== null && kept !== undefined ? kept : FormulaError.BuiltIn.Ref! };
  }
  return { view };
};

/** The text of a one-cell argument; an error is answered as is. */
const textOf = (value: IRange | IRange[]): string | FormulaError.Known => {
  const range = Array.isArray(value) ? value[0] : value;
  if (!range || range.size !== 1) return FormulaError.BuiltIn.Value!;
  const single = range.getValueAt(0, 0);
  if (FormulaError.isError(single)) return single as FormulaError.Known;
  return single === null || single === undefined ? '' : String(single);
};

/**
 * Excel 2000's `GETPIVOTDATA(pivot_table, name)`: `name` describes the cell in words, in any order
 * and case — items, `Field[Item]`, a data field by either of its names, field names and
 * `Grand Total`, which ask for nothing — and a multi-word item is quoted (`'New York'`, or
 * `Name['Wendy   ']` to keep its spaces). A word that names nothing is `#N/A`; a cell the pivot
 * does not show is `#REF!`.
 */
const pivotDataByName = (pivot: unknown, nameArg: IRange | IRange[]): Scalar => {
  const found = pivotViewOf(pivot);
  if ('answer' in found) return found.answer;
  const pivotView = found.view;
  const name = textOf(nameArg);
  if (FormulaError.isError(name)) return name;

  const fields = pivotView.getFields();
  const dataFields = pivotView.getDataFields();
  const items = new Map<number, number>();
  let dataIndex = -1;
  const setItem = (fieldIndex: number, itemIndex: number): boolean => {
    const before = items.get(fieldIndex);
    items.set(fieldIndex, itemIndex);
    return before === undefined || before === itemIndex;
  };
  const unquote = (text: string): string => text.startsWith("'") && text.endsWith("'") && text.length > 1
    ? text.slice(1, -1).replace(/''/g, "'")
    : text.trim();

  // `Field[Item]` first: the field is the longest run of words before the bracket that names one,
  // and the words ahead of it join the loose ones.
  const loose: string[] = [];
  const bracket = /\[('(?:[^']|'')*'|[^\]]*)\]/g;
  let last = 0;
  let conflict = false;
  for (let match = bracket.exec(name); match; match = bracket.exec(name)) {
    const words = wordsOf(name.slice(last, match.index));
    last = match.index + match[0].length;
    let fieldIndex = -1;
    let used = words.length;
    while (used > 0) {
      const candidate = words.slice(words.length - used).join(' ').toLowerCase();
      fieldIndex = fields.findIndex((field) => field.name.toLowerCase() === candidate);
      if (fieldIndex !== -1) break;
      used--;
    }
    if (fieldIndex === -1) return FormulaError.BuiltIn.NA!;
    loose.push(...words.slice(0, words.length - used));
    const itemIndex = findItem(fields[fieldIndex].items, unquote(match[1]));
    if (itemIndex === -1) return FormulaError.BuiltIn.NA!;
    conflict ||= !setItem(fieldIndex, itemIndex);
  }
  loose.push(...wordsOf(name.slice(last)));

  // The loose words, longest phrase first from the left: a quoted phrase is one word.
  const phraseIs = (phrase: string): (() => boolean) | null => {
    const wanted = phrase.toLowerCase();
    if (wanted === 'grand total') return () => true;
    if (fields.some((field) => field.name.toLowerCase() === wanted)) return () => true;
    const shown = dataFields.findIndex((field) => field.name.toLowerCase() === wanted);
    const data = shown !== -1 ? shown : dataFields.findIndex((field) => field.sourceName.toLowerCase() === wanted);
    if (data !== -1) return () => { dataIndex = data; return true; };
    const holders: [number, number][] = [];
    fields.forEach((field, fieldIndex) => {
      const itemIndex = findItem(field.items, phrase);
      if (itemIndex !== -1) holders.push([fieldIndex, itemIndex]);
    });
    if (holders.length === 0) return null;
    // An item two fields share names no one cell.
    if (holders.length > 1) return () => false;
    return () => setItem(holders[0][0], holders[0][1]);
  };
  for (let at = 0; at < loose.length;) {
    let matched: (() => boolean) | null = null;
    let take = loose.length - at;
    while (take > 0) {
      const words = loose.slice(at, at + take);
      matched = phraseIs(take === 1 ? unquote(words[0]) : words.join(' '));
      if (matched) break;
      take--;
    }
    if (!matched) return FormulaError.BuiltIn.NA!;
    conflict ||= !matched();
    at += take;
  }
  if (conflict) return FormulaError.BuiltIn.Ref!;
  // No data field named: the table's first.
  if (dataIndex === -1) dataIndex = 0;
  if (dataIndex >= dataFields.length) return FormulaError.BuiltIn.Ref!;
  return pivotView.getValue(dataIndex, items) ?? FormulaError.BuiltIn.Ref!;
};

/** The words of a legacy name, a quoted phrase kept whole with its quotes. */
const wordsOf = (text: string): string[] => text.match(/'(?:[^']|'')*'|[^\s']+/g) ?? [];

/**
 * Looks for a value in the top row of a table or array of values and returns the value in the same column from a row you specify.
 * @param lookupValue is the value to be found in the first row of the table and can be a value, a reference, or a text string.
 * @param tableArray is a table of text, numbers, or logical values in which data is looked up. tableArray can be a reference to a range or a range name.
 * @param rowIndexNum is the row number in tableArray from which the matching value should be returned. The first row of values in the table is row 1.
 * @param rangeLookup is a logical value: to find the closest match in the top row (sorted in ascending order) = TRUE; find an exact match = FALSE.
 */
export function HLOOKUP(
  lookupValue: Scalar,
  tableArray: Flatten<IRange>,
  rowIndexNum: AcceptError<number>,
  rangeLookup: boolean = true
): Scalar {
  if (FormulaError.isError(lookupValue)) return lookupValue;
  // A blank lookup value, an empty cell or an omitted argument, is looked up as 0.
  if (lookupValue === null || lookupValue === undefined) lookupValue = 0;
  if (tableArray.length > 1) return FormulaError.BuiltIn.NA!; // a union is not a table
  const table = tableArray[0];
  if (_isScalarTable()) return _scalarTableAnswer(table);
  // A bad index from a CELL — an error, or text that is not a number — is judged with the
  // index, after the search: #REF! for a found key. A literal one is the argument's own fault.
  let indexFault: FormulaError.Known | null = null;
  if (FormulaError.isError(rowIndexNum)) {
    if (FormulaContext.getArgs().getKindAt(2) !== ValueKind.Reference) return rowIndexNum;
    indexFault = FormulaError.BuiltIn.Ref!;
  }
  const rowIndex = indexFault ? 1 : _lookupIndex(rowIndexNum as number);
  // The index is judged only once the key is FOUND: a missing key is #N/A whatever the index, and
  // a found one is #VALUE! below the table and #REF! past it.
  const pastEnd = rowIndex > table.getRowCount();
  const pick = (at: number): Scalar =>
    indexFault ?? (rowIndex < 1 ? FormulaError.BuiltIn.Value! : pastEnd ? FormulaError.BuiltIn.Ref! : (table.getValueAt(rowIndex - 1, at) ?? null));

  // See VLOOKUP — same rules, transposed.
  const asWildCard = _lookupWildCard(lookupValue);

  if (rangeLookup) {
    // MATCH's bisection over the first row, wildcards read as text: an unsorted
    // `BLA16,BLA23567,BLA245,BLA,BLATST234,MEIER3456,SOMEBLA` finds BLA for "Bla?45".
    const index = _approximateIndex(table.slice({ rowStart: 0, rowEnd: 0 }), lookupValue);
    return index === -1 ? FormulaError.BuiltIn.NA! : pick(index);
  }

  // Exact match with wildcard support
  if (!asWildCard) {
    // The first row alone — see `_scanExact`.
    const colIdx = table.slice({ rowStart: 0, rowEnd: 0 }).indexOf(lookupValue);
    if (colIdx === -1) return FormulaError.BuiltIn.NA!;
    return pick(colIdx);
  }
  const iter = table.entries({ axis: IRange.Axis.Row, includeEmpty: false });
  let next = iter.next();

  while (!next.done) {
    const { value, coords } = next.value;
    if (coords.rowIndex !== 0) break;

    if (asWildCard.test(typeof value === 'string' ? value : String(value))) {
      return pick(coords.colIndex);
    }

    next = iter.next();
  }

  return FormulaError.BuiltIn.NA!;
}

/**
 * HSTACK and VSTACK, which differ only in the axis.
 *
 * @remarks
 * Excel refuses a stack that would be TALLER than the grid — `VSTACK(A:A,A1)` and
 * `VSTACK(A:A,A:A)` are both `#NUM!`, where a single whole column is an ordinary 1,048,576-row
 * answer — and does NOT
 * bound the width: `COLUMNS(HSTACK(1:1,A1))` is 16385 and `COLUMNS(HSTACK(1:1,1:1))` is 32768,
 * both past the last column. So the bound is on the ANSWER rather than the operands, it is one
 * axis rather than both, and it is checked before anything is joined.
 *
 * The ragged pad is `#N/A` and belongs to `concat`; every other question the two names raise is
 * about members, and a member travels here rather than being read.
 */
const _stack = (array: IRange[], axis: IRange.Axis): IRange => {
  const entire = FormulaContext.getEntireCoords();
  const maxRows = entire.rowEnd - entire.rowStart + 1;
  const byCol = axis === IRange.Axis.Column;
  let rows = 0;
  const count = array.length;
  for (let i=0; i<count; i++) {
    const r = array[i].getRowCount();
    rows = byCol ? Math.max(rows, r) : rows + r;
  }
  if (rows > maxRows) return FormulaError.BuiltIn.Num!;
  return array.reduce((acc: IRange, arr: IRange) => acc.concat(arr, axis));
};

/**
 * Horizontally stacks arrays into one array.
 * @param array An array or reference to be stacked.
 */
export function HSTACK(
  array: Repeating<IRange, 254>
): IRange {
  return _stack(array, IRange.Axis.Column);
}

/**
 * Creates a shortcut or jump that opens a document stored on your hard drive, a network server, or on the Internet.
 * @param linkLocation is the text giving the path and file name to the document to be opened, a hard drive location, UNC address, or URL path.
 * @param friendlyName is text or a number that is displayed in the cell. If omitted, the cell displays the linkLocation text.
 * @returns A link that reads as its friendly name; a reference to it is a link too.
 */
export function HYPERLINK(
  linkLocation: string,
  // NOT omittable: an omitted friendly name is the blank VALUE, which displays as 0 rather
  // than falling back to the link text an absent one gives.
  friendlyName?: Scalar
): IRichData {
  const args = FormulaContext.getArgs();
  let friendly: Scalar | undefined = friendlyName;
  if (args.getLength() < 2) friendly = undefined;
  else if (friendly === null || friendly === undefined || args.getKindAt(1) === ValueKind.Omitted) friendly = 0;
  return FormulaContext.createRichData('hyperlink', { address: linkLocation, friendly });
}

/** The arguments of one `IMAGE` call: what its executor answers, and how an equal call is found again. */
interface ImagePayload {
  source: string;
  altText?: string;
  sizing?: number;
  height?: number;
  width?: number;
}

/**
 * Answers `IMAGE` calls through the workbook's fetch, and adds each picture to the workbook as the
 * resource its values hold, so the workbook saves it with them. The batch is grouped
 * by source: one fetch per source however many cells name it, and one value per distinct set of
 * arguments, shared by the calls that ask for it (values are immutable). A call gets its image only
 * once the picture is in: `#CONNECT!` when the server answers with an error, `#VALUE!` when it
 * cannot be reached or sends something that is not a picture.
 */
function runImages(
  calls: readonly IFormulaContext.DeferredCall<IRichData>[],
  ctx: IFormulaContext.IDeferContext
): void {
  const bySource = new Map<string, IFormulaContext.DeferredCall<IRichData>[]>();
  for (const call of calls) {
    const source = (call.payload as ImagePayload).source;
    const group = bySource.get(source);
    if (group) group.push(call);
    else bySource.set(source, [call]);
  }
  for (const [source, group] of bySource) {
    ctx.fetch(source).then(
      async (response: Response): Promise<void> => {
        let error = !response.ok
          ? FormulaError.BuiltIn.Connect
          : !response.headers.get('content-type')?.startsWith('image/') ? FormulaError.BuiltIn.Value : null;
        let resource: object | null = null;
        if (!error) {
          try {
            resource = ctx.addResource(await response.arrayBuffer(), { fetchedFrom: source });
          } catch {
            error = FormulaError.BuiltIn.Value;
          }
        }
        const images = new Map<string, IRichData>();
        for (const call of group) {
          if (error) {
            call.reject(error);
            continue;
          }
          const payload = call.payload as ImagePayload;
          const key = JSON.stringify([payload.altText, payload.sizing, payload.height, payload.width]);
          let image = images.get(key);
          if (!image) {
            image = ctx.createRichData('image', { ...payload, resource });
            images.set(key, image);
          }
          call.resolve(image);
        }
      },
      (error: unknown): void => {
        const failed = FormulaError.isError(error, FormulaError.Code.Blocked) ? new FormulaError.Value(error.message) : FormulaError.BuiltIn.Value;
        for (const call of group) call.reject(failed);
      }
    );
  }
}

/**
 * How IMAGE sizes the picture in its cell.
 *
 * @remarks
 * Declared `ReportType`: the body truncates the argument and refuses one outside 0-3.
 */
enum ImageSizing {
  /**
   * Fits the picture in the cell, keeping its aspect ratio.
   * @name Fit to cell
   */
  Fit = 0,
  /**
   * Fills the cell, ignoring the picture's aspect ratio.
   * @name Fill cell
   */
  Fill = 1,
  /**
   * Keeps the picture's own size, which may overflow the cell.
   * @name Original size
   */
  Original = 2,
  /**
   * Uses the height and width given.
   * @name Custom size
   */
  Custom = 3,
}

/**
 * Returns an image from a given source.
 * @param source The path of the source that points to the image.
 * @param alternateText The alternative text that describes the image for accessibility.
 * @param sizing The setting that determines the dimensions in which the image will be rendered in the cell.
 * @param height The custom height of the image in pixels.
 * @param width The custom width of the image in pixels.
 * @returns The image, once it has loaded; `#BUSY!` until then, or the image it showed when a
 * recalculation loads it again. A source that cannot be loaded is
 * `#VALUE!`, or `#CONNECT!` when the server answers with an error.
 */
export function IMAGE(
  source: string,
  alternateText: Omittable<string> = undefined,
  sizing: Omittable<ReportType<ImageSizing>> = ImageSizing.Fit,
  height: Omittable<number> = undefined,
  width: Omittable<number> = undefined
): IRichData {
  if (!source) return FormulaError.BuiltIn.Value as unknown as IRichData;
  const mode = Math.trunc(sizing);
  if (mode < 0 || mode > 3) return FormulaError.BuiltIn.Value as unknown as IRichData;
  const payload: ImagePayload = { source };
  if (alternateText) payload.altText = alternateText;
  if (mode !== ImageSizing.Fit) payload.sizing = mode;
  if (mode === ImageSizing.Custom) {
    if (height === undefined && width === undefined) return FormulaError.BuiltIn.Value as unknown as IRichData;
    if ((height !== undefined && height < 1) || (width !== undefined && width < 1)) return FormulaError.BuiltIn.Value as unknown as IRichData;
    if (height !== undefined) payload.height = height;
    if (width !== undefined) payload.width = width;
  } else if (height !== undefined || width !== undefined) {
    return FormulaError.BuiltIn.Value as unknown as IRichData;
  }
  // Called again by a recalculation, the picture it showed stays until the new one arrives.
  const previous = FormulaContext.defer(runImages, payload);
  return (previous ?? FormulaError.BuiltIn.Busy) as IRichData;
}

/**
 * Returns a value or reference of the cell at the intersection of a particular row and column, in a given range.
 * @param array is a range of cells or an array constant.
 * @param rowNum selects the row in Array or Reference from which to return a value. If omitted, colNum is required.
 * @param colNum selects the column in Array or Reference from which to return a value. If omitted, rowNum is required.
 * @param areaNum selects the area in Array or Reference from which to return a value. If omitted, the first area is used.
 *
 * @remarks
 * Combines the array and reference forms of INDEX using optional parameters.
 */
export function INDEX(
  array: Flatten<IRange>,
  rowNum: Omittable<number>,
  // An ABSENT column is the one-index form and an OMITTED one (`INDEX(A1:C3,2,)`) is a zero, which
  // means the whole row — two different answers, so the two positions cannot share a default.
  colNum: Omittable<number | undefined, 0> = undefined,
  areaNum: Omittable<number, 0> = 1
): any {
  // A bare error at the array slot propagated before this ran, ahead of every other slot
  // (`INDEX(NA(),1/0,1)` is #N/A). A 1x1 REFERENCE or ARRAY holding an error is a range and is
  // bounds-checked like any other: `INDEX(A1,2,1)` and `INDEX({#N/A},2,1)` are #REF! where
  // `INDEX(A1,1,1)` is the member's own error.
  rowNum ??= 0;

  // The SIGN is judged on the value as given and the row and column POSITIONS as counts
  // (`excelCount`), so a value just under an integer is that integer. Both halves are needed:
  // `INDEX(A1:C3,-0.5,2)` is #VALUE! where truncating first would make it the whole column, and
  // `INDEX({10,20,30},1,1.9999998)` is 20 where truncating the raw double would be 10.
  if (rowNum < 0 || (colNum !== undefined && colNum < 0) || areaNum < 1) return FormulaError.BuiltIn.Value;
  let rowIndex = excelCount(rowNum);
  let colIndex = colNum === undefined ? 0 : excelCount(colNum);
  const areaIndex = _lookupIndex(areaNum);
  if (areaIndex > array.length) return FormulaError.BuiltIn.Ref;

  const range = array[areaIndex - 1];
  // An EMPTY array reads as the value 0 wherever a value is asked of it:
  // `INDEX(MUNIT(1E307),1,1)` is 0, so it indexes as a 1x1 holding zero.
  if (range.size === 0 && !(range as IReferenceRange).isIReferenceRange) {
    return (rowIndex <= 1 && colIndex <= 1) ? 0 : FormulaError.BuiltIn.Ref;
  }
  const rows = range.getRowCount();
  const cols = range.getColumnCount();
  if (colNum === undefined) {
    // The ONE-INDEX form reads its index along the range's only axis, and a range that has two of
    // them is refused: `INDEX(A1:C3,2)` is #REF! where `INDEX(A1:A3,2)` is the second row and
    // `INDEX(A1:C1,2)` the second column.
    if (rows === 1) {
      colIndex = rowIndex;
      rowIndex = 1;
    } else if (cols !== 1 && (range as IReferenceRange).isIReferenceRange) {
      return FormulaError.BuiltIn.Ref;
    }
    // A 2-D ARRAY answers the whole row: `INDEX({1,2;3,4},2)` is {3,4}.
  }

  if (rowIndex > rows || colIndex > cols) return FormulaError.BuiltIn.Ref;

  const rowStart = rowIndex === 0 ? 0        : rowIndex - 1;
  const rowEnd   = rowIndex === 0 ? rows - 1 : rowIndex - 1;
  const colStart = colIndex === 0 ? 0        : colIndex - 1;
  const colEnd   = colIndex === 0 ? cols - 1 : colIndex - 1;

  // index is context senstive.
  if ((range as IReferenceRange).isIReferenceRange) {
    const refCoords = (range as IReferenceRange).getCoords();
    return FormulaContext.getReference({
      rowStart: refCoords.rowStart + rowStart,
      rowEnd:   refCoords.rowStart + rowEnd,
      colStart: refCoords.colStart + colStart,
      colEnd:   refCoords.colStart + colEnd,
      scope:    refCoords.scope
    });
  }

  // A single member picked from an ARRAY is a VALUE, not a 1x1 array — TYPE(INDEX(TRANSPOSE(
  // A1:A3),1,2)) is 1 (the reference path above answers the same through its one-cell
  // reference). A whole row/column pick (index 0) stays an array.
  if (rowStart === rowEnd && colStart === colEnd) {
    return range.getValueAt(rowStart, colStart) ?? null;
  }
  return range.slice({ rowStart, rowEnd, colStart, colEnd });
}

/**
 * Returns the reference specified by a text string.
 * @param refText is a reference to a cell that contains an A1- or R1C1-style reference, a name defined as a reference, or a reference to a cell as a text string.
 * @param a1 is a logical value that specifies the type of reference in refText: R1C1-style = FALSE; A1-style = TRUE.
 */
export function INDIRECT(
  refText: string,
  a1: boolean=true
): IReferenceRange {
  return FormulaContext.getReference(refText, !a1);
}

/**
 * Looks up a value either from a one-row or one-column range or from an array. Provided for backward compatibility.
 * @param lookupValue is a value that LOOKUP searches for in lookupVector and can be a number, text, a logical value, or a name or reference to a value.
 * @param lookupVector is a range that contains only one row or one column of text, numbers, or logical values, placed in ascending order.
 * @param resultVector is a range that contains only one row or column, the same size as lookupVector.
 */
export function LOOKUP(
  lookupValue: Scalar,
  lookupVector: Flatten<IRange>,
  // An omitted resultvector is a vector that was SUPPLIED and is empty - #VALUE!, whatever the
  // shape of lookupvector, where an absent one selects the array form below.
  resultVector?: Omittable<IRange | null, null>
): Scalar {
  if (FormulaError.isError(lookupValue)) return lookupValue;
  // A blank lookup value, an empty cell or an omitted argument, is looked up as 0.
  if (lookupValue === null || lookupValue === undefined) lookupValue = 0;
  if (lookupVector.length > 1) return FormulaError.BuiltIn.NA!; // a union is not a table
  const vector = lookupVector[0];
  if (resultVector === null) return FormulaError.BuiltIn.Value!;

  const rows = vector.getRowCount();
  const cols = vector.getColumnCount();
  const is2D = rows > 1 && cols > 1;

  // ── Array form ──────────────────────────────────────────────────────────────
  // A 2D vector is treated as an array ONLY when resultVector is absent:
  //   - wider than tall → search first ROW, return last ROW value
  //   - taller than wide (or square) → search first COLUMN, return last COLUMN value
  if (is2D && !resultVector) {
    const searchByRow = cols > rows;
    if (searchByRow) {
      // Search first row, return value from last row at matching column index
      const colIdx = _approximateIndex(vector.slice({ rowStart: 0, rowEnd: 0 }), lookupValue);
      if (colIdx === -1) return FormulaError.BuiltIn.NA!;
      return vector.getValueAt(rows - 1, colIdx) ?? null;
    } else {
      // Search first column, return value from last column at matching row index
      const rowIdx = _approximateIndex(vector.slice({ colStart: 0, colEnd: 0 }), lookupValue);
      if (rowIdx === -1) return FormulaError.BuiltIn.NA!;
      return vector.getValueAt(rowIdx, cols - 1) ?? null;
    }
  }

  // ── Vector form ─────────────────────────────────────────────────────────────
  // A 1D vector searches along whichever axis it occupies; a 2D one (only reachable
  // here with a resultVector) searches its leading row/column the way the array form does.
  const byRow = is2D ? cols > rows : rows === 1; // true = iterate columns, false = iterate rows
  const matchIdx = _approximateIndex(
    byRow ? vector.slice({ rowStart: 0, rowEnd: 0 }) : vector.slice({ colStart: 0, colEnd: 0 }), lookupValue);
  if (matchIdx === -1) return FormulaError.BuiltIn.NA!;

  if (!resultVector) {
    return (byRow ? vector.getValueAt(0, matchIdx) : vector.getValueAt(matchIdx, 0)) ?? 0;
  }
  return _lookupResultAt(resultVector, matchIdx, byRow ? cols : rows);
}

/**
 * Reads position {@link index} out of a LOOKUP `resultVector`.
 *
 * @remarks
 * `resultVector` is an ANCHOR PLUS A LENGTH, not a bounded range: only its top-left corner is
 * honored, and the vector is re-sized to `lookupVector`'s length — so reads run PAST the range
 * the caller actually wrote. `LOOKUP(3,A1:A4,B1:B2)` reads `B3`. This is the same anchor+resize
 * `SUMIF`'s `sum_range` gets ({@link REDUCEIF}), and it is why LOOKUP belongs with
 * `OFFSET`/`INDIRECT`/`SUMIF` as reading cells outside its arguments.
 *
 * The resize AXIS is the result vector's own orientation, NOT the lookup vector's. A 1x1
 * resultVector is horizontal: `LOOKUP(3,A1:A4,B1:B1)` reads `D1`, not `B3`.
 */
function _lookupResultAt(resultVector: IRange, index: number, length: number): Scalar {
  const rRows = resultVector.getRowCount();
  const rCols = resultVector.getColumnCount();
  // A 2D resultVector has no unambiguous axis and is refused outright.
  if (rRows > 1 && rCols > 1) return FormulaError.BuiltIn.NA!;
  const downward = rRows > 1; // 1xN *and* 1x1 both run along the row

  if ((resultVector as IReferenceRange).isIReferenceRange) {
    // Re-derive the whole resized vector rather than the single cell: the dependency must cover
    // every cell it could have returned, so a later edit inside the resized tail
    // still invalidates us.
    const c = (resultVector as IReferenceRange).getCoords();
    const resized = FormulaContext.getResizedReference(c, downward ? length : 1, downward ? 1 : length);
    // A blank cell is answered blank, not 0 (`ISNUMBER` of it is FALSE, `&"x"` is "x"), as are
    // one past the populated data and a position past the grid edge the window was clamped to.
    return (downward ? resized.getValueAt(index, 0) : resized.getValueAt(0, index)) ?? null;
  }

  // A literal array has no anchor to extend from, so it indexes positionally — and running off
  // the end is #N/A rather than the reference path's 0.
  if (index >= (downward ? rRows : rCols)) return FormulaError.BuiltIn.NA!;
  return (downward ? resultVector.getValueAt(index, 0) : resultVector.getValueAt(0, index)) ?? 0;
}

/**
 * How MATCH compares the lookup value with the values in the array.
 *
 * @remarks
 * Declared `ReportType`, as every numeric built-in enum is: the body keeps the verdict. It reads the
 * argument by its SIGN.
 */
enum MatchType {
  /**
   * The largest value that is less than or equal to the lookup value. The array must be sorted in ascending order.
   * @name Less than
   */
  LessThan = 1,
  /**
   * The first value that is exactly equal to the lookup value. The array can be in any order.
   * @name Exact match
   */
  Exact = 0,
  /**
   * The smallest value that is greater than or equal to the lookup value. The array must be sorted in descending order.
   * @name Greater than
   */
  GreaterThan = -1,
}

/**
 * Returns the relative position of an item in an array that matches a specified value in a specified order.
 * @param lookupValue is the value you use to find the value you want in the array, a number, text, or logical value, or a reference to one of these.
 * @param lookupArray is a contiguous range of cells containing possible lookup values, an array of values, or a reference to an array.
 * @param matchType is a number 1, 0, or -1 indicating which value to return.
 */
export function MATCH(
  lookupValue: Scalar,
  lookupArray: Flatten<IRange>,
  matchType: Omittable<ReportType<MatchType>, 0> = MatchType.LessThan
): Scalar {
  if (lookupArray.length > 1 || _isScalarTable()) return FormulaError.BuiltIn.NA!; // a union is not a table
  // Nor is a 2-D range: `MATCH(1,{1,2;3,4},0)` is #N/A, where XMATCH's is #VALUE!.
  if (lookupArray[0].getRowCount() > 1 && lookupArray[0].getColumnCount() > 1) return FormulaError.BuiltIn.NA!;
  // A blank lookup value, an empty cell or an omitted argument, is looked up as 0.
  if (lookupValue === null || lookupValue === undefined) lookupValue = 0;
  const matchMode = matchType === 0 ? 0 : matchType > 0 ? -1 : 1;
  // matchType ±1 requires sorted input; binary search on unsorted data is undefined behavior
  const searchMode = matchType === 0 ? 1 : matchType > 0 ? 2 : -2;
  // MATCH's EXACT mode honors wildcards
  return _matchCore(lookupValue, lookupArray[0], matchMode, searchMode, matchType === 0, true);
}

/**
 * Returns a reference to a range that is a given number of rows and columns from a given reference.
 * @param reference is the reference from which you want to base the offset, a reference to a cell or range of adjacent cells.
 * @param rows is the number of rows, up or down, that you want the upper-left cell of the result to refer to.
 * @param cols is the number of columns, to the left or right, that you want the upper-left cell of the result to refer to.
 * @param height is the height, in number of rows, that you want the result to be, the same height as Reference if omitted.
 * @param width is the width, in number of columns, that you want the result to be, the same width as Reference if omitted.
 */
export function OFFSET(
  reference: IReferenceRange,
  rows: number,
  cols: number,
  height?: Omittable<number>,
  width?: Omittable<number>
): IReferenceRange {
  rows = Math.trunc(rows);
  cols = Math.trunc(cols);

  const refCoords = reference.getCoords();
  // The shift is applied FIRST and the size grows from the SHIFTED anchor — `OFFSET(C5,2,0,-2,1)`
  // is `C6:C7`, not `C4:C5`.
  const [rowStart, rowEnd] = _offsetWindow(refCoords.rowStart + rows, height ?? reference.getRowCount());
  const [colStart, colEnd] = _offsetWindow(refCoords.colStart + cols, width ?? reference.getColumnCount());
  // A window that leaves the grid is `#REF!`, which `getReference` answers for coords it cannot
  // form — the only reason every sub-unit and negative size anchored at A1 is an error.
  return FormulaContext.getReference({ rowStart, colStart, rowEnd, colEnd, scope: refCoords.scope });
}

/**
 * Returns the row number of a reference.
 * @param reference is the cell or a single range of cells for which you want the row number; if omitted, returns the cell containing the ROW function.
 * @returnKind number
 */
export function ROW(reference?: Flatten<IReferenceRange>): number | number[] | number[][] {
  if (!reference || reference.length === 0) {
    const own = ownBlock();
    if (own === null) return FormulaContext.getRow() + 1;
    reference = [own];
  }
  // A union has no single position to describe — `#REF!`.
  if (reference.length > 1) return FormulaError.BuiltIn.Ref! as unknown as number[];

  const retValue = [];
  const coords = reference[0].getCoords();
  const coordsRowStart = coords.rowStart;
  const coordsRowEnd = coords.rowEnd;
  for (let j=coordsRowStart; j<=coordsRowEnd; j++) {
    retValue.push([j+1]); // as rows
  }
  return retValue;
}

/**
 * Returns the number of rows in a reference or array.
 * @param array is an array, an array formula, or a reference to a range of cells for which you want the number of rows.
 */
export function ROWS(array: Flatten<IRange>): number | FormulaError.Known {
  if (array.length > 1) return FormulaError.BuiltIn.Ref!; // no single extent to describe
  return array[0].getRowCount();
}

/**
 * Retrieves the real-time data (RTD) from a program that supports COM automation.
 * @hidden Unimplemented Connectivity
 * @param progId is the programmatic identifier (ProgID) of a registered COM automation add-in. Enclose the id in quotation marks.
 * @param server is the name of the server that provides the real-time data. If running locally us an empty string.
 * @param topic are 1 to 38 parameters that specify a piece of data.
 */
export function RTD(
  progId: string,
  server: string,
  topic: string[]
): Scalar {
  return FormulaError.BuiltIn.NA;
}

/**
 * Sorts a range or array.
 * @param array the range or array to sort.
 * @param sortIndex a number indicating the row or column to sort by.
 * @param sortOrder a number indicating the desired sort order; 1 for ascending order (default), -1 for descending order.
 * @param byCol a logical value indicating the desired sort direction: FALSE to sort by row (default), TRUE to sort by column.
 */
export function SORT(
  array: IRange | Scalar,
  sortIndex?: Omittable<IRange>,
  sortOrder?: Omittable<IRange<ReportType<SortOrder>>>,
  byCol: boolean=false
): IRange {
  const source = _asRange(array);
  const rows = source.getRowCount();
  const cols = source.getColumnCount();
  const axis = byCol ? IRange.Axis.Column : IRange.Axis.Row;

  // The extent that bounds sortIndex is the one the index SELECTS ACROSS, which is the opposite of
  // the axis being reordered: byCol sorts COLUMNS by a row, so a row index, bounded by the row
  // count. It bounds how MANY keys there may be as well as what each one may say.
  const extent = byCol ? rows : cols;
  const indices = _sortKeyIndices(_sortArgValues(sortIndex), extent);
  const orders = _sortOrders(_sortArgValues(sortOrder), indices.length);
  // byCol sorts COLUMNS by a ROW's values (bounded by rows); !byCol sorts ROWS by a COLUMN's
  // values (bounded by cols) — same rule the argument validation above already applies.
  const keyRanges = indices.map(idx => byCol
    ? source.slice({ rowStart: idx, rowEnd: idx })   // a ROW vector — argsort(axis=Column) reads row 0
    : source.slice({ colStart: idx, colEnd: idx })    // a COLUMN vector — argsort(axis=Row) reads col 0
  );

  const perm = source.argsort(keyRanges, orders, axis);
  return source.take(perm, axis).resize(rows, cols);
}

/**
 * How SORT reads its `sortIndex` / `sortOrder` members: every position, blanks included, and an
 * error member substituted rather than propagated.
 *
 * The substitution is the point. A range slot leaves the member error policy to the body, and
 * SORT's answer to one is a plain #VALUE! — `SORT(A1:B4,{1,#N/A},{1,1})` is #VALUE! where the
 * error AS the argument keeps its identity upstream of here.
 */
const SortArgMembers: IRange.IteratorOptions = Object.freeze({
  includeEmpty: true,
  onError: 'value'
});

/**
 * Reads SORT's `sortIndex` / `sortOrder` container as the list of numbers it stands for.
 *
 * @remarks
 * Both slots are declared `array`, so the whole container arrives and the body — not the
 * marshaller — decides what its members mean:
 *
 * - a VECTOR only. `SORT(P1:S4,{1,2;3,4},1)` is #VALUE! over a four-column array, where the same
 *   four keys written `{1,2,3,4}` sort — so the refusal is the shape, not the count.
 * - a member is read the way a direct argument is: a blank is `0`, a boolean is `1`/`0`, and
 *   numeric text parses. `0` is not a legal index or order, which is the whole of
 *   `SORT(B1:B3,E1)` being #VALUE! for a blank `E1`.
 * - an error is #VALUE! wherever it can be read as a MEMBER, and keeps its identity only where it
 *   IS the argument: `SORT(A1:B4,NA(),1)` and a one-cell REFERENCE holding `#N/A` are both #N/A,
 *   while `{1,#N/A}`, a lone `{#N/A}`, and a two-cell reference carrying one are all #VALUE!. The
 *   split is array-vs-reference and not the member count — a 1x1 array and a 1x1 reference are the
 *   same shape and answer differently.
 *
 * An ABSENT or omitted argument is not a container at all and means key 1 / ascending, which is
 * why it cannot go through the blank-is-zero path above.
 */
function _sortArgValues(arg: IRange | undefined): number[] {
  if (!arg) return [1];
  if (arg.getRowCount() > 1 && arg.getColumnCount() > 1) throw FormulaError.BuiltIn.Value;
  if ((arg as IReferenceRange).isIReferenceRange && arg.getRowCount() === 1 && arg.getColumnCount() === 1) {
    const only = arg.getValueAt(0, 0);
    if (FormulaError.isError(only)) throw only;
  }
  return arg.getValuesFlat<Scalar>(SortArgMembers).map(value => {
    if (typeof value === 'number') return value;
    if (value === null) return 0;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') return FormulaContext.parseAsNumber(value);
    throw FormulaError.BuiltIn.Value; // an error or rich-data member — not a number and not itself
  });
}

/**
 * Validates SORT's `sortIndex` against `extent` and returns it 0-based.
 *
 * An index truncates toward zero and must then be 1..extent — `2.9` selects the second key, `3`
 * over two columns is #VALUE!, and one bad key in a multi-key array fails the whole call. Never
 * CLAMP, which is the worst of the options: an off-by-one would silently sort by the nearest legal
 * key, and an index past the end would read as "the sort did nothing" rather than as an error.
 *
 * The extent bounds the key COUNT too: `SORT(A1:B4,{1,1,1},1)` is #VALUE! over two columns even
 * though every index is legal and repeats are allowed, while the same three keys over four columns
 * sort.
 */
function _sortKeyIndices(sortIndex: number[], extent: number): number[] {
  if (sortIndex.length > extent) throw FormulaError.BuiltIn.Value;
  return sortIndex.map(idx => {
    // Read at FIFTEEN significant digits before truncating. `0.0003*10000` is
    // 2.9999999999999996 and selects the THIRD key — `SORT(<2 columns>,0.0003*10000)` is #VALUE!
    // where `SORT(…,2.9)` sorts by the second. The count slots of TAKE, DROP and WRAPROWS
    // read the same double RAW and land on two, so the two readings live side by side in one
    // category and neither predicts the other.
    const truncated = Math.trunc(round15(idx));
    if (!(truncated >= 1 && truncated <= extent)) throw FormulaError.BuiltIn.Value;
    return truncated - 1; // 1-based → 0-based
  });
}

/**
 * Validates a SORT/SORTBY `sortOrder` and pairs it with `keyCount` keys.
 *
 * A two-valued enum, not a sign: `2`, `0` and `-2` are all #VALUE!, while `1.5` sorts ascending
 * and `-1.5` is #VALUE! — so the rule is FLOOR, then require exactly 1 or -1.
 *
 * A lone order is BROADCAST rather than padded — `SORT(A1:B4,{1,2},{-1})` sorts BOTH keys
 * descending — and any other length must match the key count exactly, so `{1,2,3}` against `{1,1}`
 * is #VALUE!. SORTBY spells one order per key in its repeating group and so always arrives
 * already paired.
 */
function _sortOrders(sortOrder: number[], keyCount: number): number[] {
  if (sortOrder.length !== 1 && sortOrder.length !== keyCount) throw FormulaError.BuiltIn.Value;
  const orders = sortOrder.map(order => {
    // FLOOR, not truncate-toward-zero: `1.5` sorts ascending and `-1.5` is #VALUE!, which
    // truncation would have accepted as -1.
    const floored = Math.floor(order);
    if (floored !== 1 && floored !== -1) throw FormulaError.BuiltIn.Value;
    return floored;
  });
  return orders.length === keyCount ? orders : new Array<number>(keyCount).fill(orders[0]);
}

/**
 * The direction SORT and SORTBY sort a key in.
 *
 * @remarks
 * Declared `ReportType`, as every numeric built-in enum is: this argument FLOORS (`1.5` sorts
 * ascending, `-1.5` is #VALUE!), which an enum's gate does not, so `_sortOrders` keeps the verdict.
 * SORT takes an array of orders, one per key, so its slot is `IRange<ReportType<SortOrder>>`.
 */
enum SortOrder {
  /**
   * Smallest to largest.
   * @name Ascending
   */
  Ascending = 1,
  /**
   * Largest to smallest.
   * @name Descending
   */
  Descending = -1,
}

/**
 * Sorts a range or array based on the values in a corresponding range or array.
 * @param array the range or array to sort.
 * @param by the ranges to sort on and the direction for each.
 * @param by.byArray the range or array to sort on.
 * @param by.sortOrder a number indicating the desired sort order; 1 for ascending order (default), -1 for descending order.
 */
export function SORTBY(
  array: IRange | Scalar,
  by: Repeating<[byArray: IRange, sortOrder?: Omittable<ReportType<SortOrder>>], 254>
): IRange {
  const source = _asRange(array);
  const keyRanges: IRange[] = by.map(([byArray]) => byArray);
  // SORTBY has no index to bound, but its order argument is the same two-valued enum SORT's is:
  // `SORTBY(A1:B4,A1:A4,2)` is #VALUE!, and so is an invalid order on the SECOND key.
  const keyOrders: number[] = _sortOrders(by.map(([, sortOrder]) => sortOrder ?? 1), keyRanges.length);

  const rows = source.getRowCount();
  const cols = source.getColumnCount();

  // A 1x1 array holding an error answers with that error, before any shape is judged:
  // `SORTBY(<#N/A cell>, <4-row key>)` is #N/A and not the #VALUE! the mismatch would give.
  if (rows === 1 && cols === 1) {
    const only = source.getValueAt(0, 0);
    if (FormulaError.isError(only)) return only as unknown as IRange;
  }

  // The KEY's orientation picks the axis, and its length has to match that axis exactly:
  // a column vector sorts ROWS, a ROW vector sorts COLUMNS (`SORTBY(A1:C3,A1:C1)` reorders the
  // three columns), and anything two-dimensional is #VALUE!. A 1x1 key fits either way — it can
  // only ever be a no-op — so it does not choose, and when every key is 1x1 the axis is whichever
  // one is a single line.
  let axis: IRange.Axis | null = null;
  for (let k=0; k<keyRanges.length; k++) {
    const keyRange = keyRanges[k];
    const keyRows = keyRange.getRowCount();
    const keyCols = keyRange.getColumnCount();
    if (keyRows > 1 && keyCols > 1) return FormulaError.BuiltIn.Value!;
    if (keyRows === 1 && keyCols === 1) {
      // A 1x1 key sorts nothing, but it is still READ: one holding an error answers with that
      // error rather than passing the array through (the same split SORT's `sortIndex` draws
      // between an error AS the argument and an error as a member).
      const only = keyRange.getValueAt(0, 0);
      if (FormulaError.isError(only)) return only as unknown as IRange;
      continue;
    }
    const keyAxis = keyCols === 1 ? IRange.Axis.Row : IRange.Axis.Column;
    const extent = keyAxis === IRange.Axis.Row ? rows : cols;
    const length = keyAxis === IRange.Axis.Row ? keyRows : keyCols;
    if (length !== extent) return FormulaError.BuiltIn.Value!;
    if (axis !== null && axis !== keyAxis) return FormulaError.BuiltIn.Value!;
    axis = keyAxis;
  }
  if (axis === null) {
    if (cols === 1) axis = IRange.Axis.Column;
    else if (rows === 1) axis = IRange.Axis.Row;
    else return FormulaError.BuiltIn.Value!;
  }

  const perm = source.argsort(keyRanges, keyOrders, axis);
  return source.take(perm, axis).resize(rows, cols);
}

/**
 * Returns rows or columns from array start or end.
 * @param array The array from which to take rows or columns.
 * @param rows The number of rows to take. A negative value takes from the end of the array.
 * @param columns The number of columns to take. A negative value takes from the end of the array.
 */
export function TAKE(
  array: IRange,
  rows: Omittable<number>,
  columns?: Omittable<number>
): IReferenceRange { // declared IReferenceRange to mirror Excel's signature (AREAS says so: TAKE is a REFERENCE where CHOOSECOLS is not); over an array argument the result is a plain array
  const rowCount = rows === undefined ? undefined : Math.trunc(rows);
  const colCount = columns === undefined ? undefined : Math.trunc(columns);
  if (rowCount === 0 || colCount === 0) return FormulaError.BuiltIn.Calc! as unknown as IReferenceRange;

  const rowsOrig = array.getRowCount();
  const colsOrig = array.getColumnCount();

  const rowStart = rowCount === undefined || rowCount >= 0 ? 0 : Math.max(0, rowsOrig + rowCount);
  const rowEnd   = rowCount === undefined ? rowsOrig : rowCount >= 0 ? Math.min(rowCount, rowsOrig) : rowsOrig;

  const colStart = colCount === undefined || colCount >= 0 ? 0 : Math.max(0, colsOrig + colCount);
  const colEnd   = colCount === undefined ? colsOrig : colCount >= 0 ? Math.min(colCount, colsOrig) : colsOrig;

  return array.slice({ colStart, rowStart, rowEnd: rowEnd - 1, colEnd: colEnd - 1 }) as unknown as IReferenceRange;
}

/**
 * TOCOL and TOROW, which differ only in the axis they lay the answer along.
 *
 * @remarks
 * Four rules, and the first is the one that separates this pair from the other shapers:
 *
 * - **a reference UNION is FLATTENED**, area by area in the order written, duplicates kept:
 *   `SUM(TOCOL((A1:A3,B1:B3)))` is the sum of both columns and `TOCOL((A1:B2,B2:C3))` is eight
 *   members, not seven. Every other shaper refuses a union — `#VALUE!` at TAKE and
 *   DROP, `#REF!` at CHOOSEROWS — so this is the only place in the category where the multi-area
 *   shape is an ANSWER rather than a fault.
 * - **`ignore` is a closed four-valued enum.** `4` and `-1` are `#VALUE!` where the shapers'
 *   count slots would saturate, and it truncates on the way in.
 * - **an answer with NO members is `#CALC!`** — every value ignored, or an argument that was empty
 *   to begin with. It is the same `#CALC!` TAKE gives for a zero count.
 * - a member that survives travels unread: an error stays that error, a blank stays blank.
 *
 * `scanByColumn` transposes the READING, not the answer, so it changes the order of the members
 * and never the shape.
 */
const _flattenTo = (
  array: Flatten<IRange>,
  ignore: number,
  scanByColumn: boolean,
  axis: IRange.Axis
): IRange => {
  const mode = Math.trunc(ignore);
  if (!(mode >= 0 && mode <= 3)) return FormulaError.BuiltIn.Value!;
  const byColumn = axis === IRange.Axis.Column;
  const options = scanByColumn ? ColumnOriented : RowOriented;

  const values: Scalar[] = [];
  const areaCount = array.length;
  for (let a=0; a<areaCount; a++) {
    const area = array[a];
    const cols = area.getColumnCount();
    const rows = area.getRowCount();
    const ordered: Scalar[] = new Array(cols * rows).fill(null);
    const iter = area.entries<Scalar>(options);
    let e = iter.next();
    while (!e.done) {
      const { value, coords } = e.value;
      e = iter.next();
      ordered[scanByColumn
        ? coords.colIndex * rows + coords.rowIndex
        : coords.rowIndex * cols + coords.colIndex] = value;
    }
    for (let i=0; i<ordered.length; i++) {
      if (!_shouldIgnore(ordered[i], mode)) values.push(ordered[i]);
    }
  }
  if (values.length === 0) return FormulaError.BuiltIn.Calc!;

  const builder = array[0].empty().sparseBuilder<Scalar>(axis);
  for (let i=0; i<values.length; i++) {
    if (byColumn) builder.pushAt(i, 0, values[i]);
    else builder.pushAt(0, i, values[i]);
  }
  return builder.build().resize(byColumn ? values.length : 1, byColumn ? 1 : values.length);
};

/**
 * Which values to leave out.
 *
 * @remarks
 * Declared `ReportType`: this argument TRUNCATES on the way in (`TOCOL(a,1.9)` reads 1 and
 * `3.9` reads 3), which an enum's gate does not, so the body keeps the verdict.
 */
enum IgnoreValues {
  /**
   * Keep every value, blanks and errors included.
   * @name Keep all values
   */
  KeepAll = 0,
  /**
   * Leave out blank cells.
   * @name Ignore blanks
   */
  Blanks = 1,
  /**
   * Leave out error values.
   * @name Ignore errors
   */
  Errors = 2,
  /**
   * Leave out blank cells and error values.
   * @name Ignore blanks and errors
   */
  BlanksAndErrors = 3,
}

/**
 * Returns the array as one column.
 * @param array The array or reference to return as a column.
 * @param ignore Whether to ignore certain types of values. By default, no values are ignored.
 * @param scanByColumn Scan the array by column. By default, the array is scanned by row.
 */
export function TOCOL(
  array: Flatten<IRange>,
  ignore: ReportType<IgnoreValues>=IgnoreValues.KeepAll,
  scanByColumn: boolean=false
): IRange {
  return _flattenTo(array, ignore, scanByColumn, IRange.Axis.Column);
}

/**
 * Returns the array as one row.
 * @param array The array or reference to return as a row.
 * @param ignore Whether to ignore certain types of values. By default, no values are ignored.
 * @param scanByColumn Scan the array by column. By default, the array is scanned by row.
 */
export function TOROW(
  array: Flatten<IRange>,
  ignore: ReportType<IgnoreValues>=IgnoreValues.KeepAll,
  scanByColumn: boolean=false
): IRange {
  return _flattenTo(array, ignore, scanByColumn, IRange.Axis.Row);
}

/**
 * Converts a vertical range of cells to a horizontal range, or vice versa.
 * @param array is a range of cells on a worksheet or an array of values that you want to transpose.
 */
export function TRANSPOSE(array: IRange): IRange {
  return array.transpose();
}

/**
 * Trims a range to the last used cell in any direction.
 * @param range The range to be trimmed.
 * @param rowTrimMode Row trim direction. 0 - none, 1 - leading, 2 - trailing, 3 - both.
 * @param colTrimMode Column trim direction. 0 - none. 1 - leading, 2 - trailing, 3 - both.
 */
export function TRIMRANGE(
  range: IRange,
  rowTrimMode: Omittable<number>=3,
  colTrimMode: Omittable<number>=3
): IReferenceRange { // declared IReferenceRange to mirror Excel's signature (the trim-reference operators `.:.`/`.:`/`:.` build on it); over an array argument the result is a plain array
  // - the trim mode is a CLOSED enum, `0` none / `1` leading / `2` trailing / `3` both, and it
  //   does NOT truncate: `2.9` and `0.9` are both #VALUE! where the shapers' count slots would
  //   have taken two and zero. Text and booleans still coerce (`"1"`, TRUE, FALSE).
  // - "used" is anything that is not an EMPTY CELL. An empty STRING is used, so is a formula
  //   ANSWERING the empty string, so is an error, and so is zero; only a blank is trimmed. A
  //   blank INSIDE the block is kept — trimming is about the margins.
  // - a range with nothing used at all is `#REF!` (ERROR.TYPE 4), where an EMPTY ARRAY argument
  //   is `#CALC!`. Two different empties, two different errors.
  // - the axes are independent, and an untrimmed axis keeps the argument's own extent — which is
  //   the whole point over an unbounded argument: `ROWS(TRIMRANGE(A:A,1,0))` is 1,048,576 (the
  //   first used row to the bottom of the sheet) while `ROWS(TRIMRANGE(A:A,2,0))` is 3.
  if (!_isTrimMode(rowTrimMode) || !_isTrimMode(colTrimMode)) return FormulaError.BuiltIn.Value!;

  const rows = range.getRowCount();
  const cols = range.getColumnCount();
  if (rows === 0 || cols === 0) return FormulaError.BuiltIn.Calc!;

  // Bounds are kept RELATIVE to the argument and shifted to the sheet only for the reference
  // answer: `entries()` reports an index WITHIN the range, so using one as an address walks the
  // answer back to the top-left of the sheet and reads blanks.
  let rowStart = 0;
  let rowEnd = rows - 1;
  let colStart = 0;
  let colEnd = cols - 1;

  const trimRows = rowTrimMode !== 0;
  const trimCols = colTrimMode !== 0;
  if (trimRows || trimCols) {
    const firstRowMajor: IRange.Entry = range.entries({ axis: IRange.Axis.Row }).next().value;
    if (!firstRowMajor) return FormulaError.BuiltIn.Ref!; // nothing used anywhere
    if (rowTrimMode === 1 || rowTrimMode === 3) rowStart = firstRowMajor.coords.rowIndex;
    if (rowTrimMode === 2 || rowTrimMode === 3) {
      const last: IRange.Entry = range.entries({ reverse: true, axis: IRange.Axis.Row }).next().value;
      rowEnd = last.coords.rowIndex;
    }
    if (trimCols) {
      const firstColMajor: IRange.Entry = range.entries({ axis: IRange.Axis.Column }).next().value;
      if (colTrimMode === 1 || colTrimMode === 3) colStart = firstColMajor.coords.colIndex;
      if (colTrimMode === 2 || colTrimMode === 3) {
        const last: IRange.Entry = range.entries({ reverse: true, axis: IRange.Axis.Column }).next().value;
        colEnd = last.coords.colIndex;
      }
    }
  }

  const asReference = range as IReferenceRange;
  if (asReference.isIReferenceRange) {
    const origin = asReference.getCoords();
    return FormulaContext.getReference({
      rowStart: origin.rowStart + rowStart,
      rowEnd: origin.rowStart + rowEnd,
      colStart: origin.colStart + colStart,
      colEnd: origin.colStart + colEnd,
      scope: origin.scope
    });
  }
  return range.slice({ rowStart, rowEnd, colStart, colEnd }) as unknown as IReferenceRange;
}

/** TRIMRANGE's two mode slots: exactly 0, 1, 2 or 3 — a fraction is refused, not truncated. */
const _isTrimMode = (mode: number): boolean => Number.isInteger(mode) && mode >= 0 && mode <= 3;

/**
 * Returns the unique values from a range or array.
 * @param array the range or array from which to return unique rows or columns.
 * @param byCol is a logical value: compare rows against each other and return the unique rows = FALSE; compare columns against each other and return the unique columns = TRUE.
 * @param exactlyOnce is a logical value: return rows or columns that occur exactly once from the array = TRUE; return all distinct rows or columns from the array = FALSE.
 */
export function UNIQUE(
  array: IRange | Scalar,
  byCol: boolean=false,
  exactlyOnce: boolean=false
): IRange {
  const source = _asRange(array);
  const axis = byCol ? IRange.Axis.Column : IRange.Axis.Row;
  const selected = source.uniqueIndices(axis, exactlyOnce);
  if (selected.length === 0) throw FormulaError.BuiltIn.Calc;
  return source.take(selected, axis);
}

/**
 * Looks for a value in the leftmost column of a table, and then returns a value in the same row from a column you specify. By default, the table must be sorted in an ascending order.
 * @param lookupValue is the value to be found in the first column of the table, and can be a value, a reference, or a text string.
 * @param tableArray is a table of text, numbers, or logical values, in which data is retrieved. tableArray can be a reference to a range or a range name.
 * @param colIndexNum is the column number in tableArray from which the matching value should be returned. The first column of values in the table is column 1.
 * @param rangeLookup is a logical value: to find the closest match in the first column (sorted in ascending order) = TRUE; find an exact match = FALSE.
 */
export function VLOOKUP(
  lookupValue: Scalar,
  tableArray: Flatten<IRange>,
  colIndexNum: AcceptError<number>,
  rangeLookup: boolean = true
): Scalar {
  if (FormulaError.isError(lookupValue)) return lookupValue;
  // A blank lookup value, an empty cell or an omitted argument, is looked up as 0.
  if (lookupValue === null || lookupValue === undefined) lookupValue = 0;
  if (tableArray.length > 1) return FormulaError.BuiltIn.NA!; // a union is not a table
  const table = tableArray[0];
  if (_isScalarTable()) return _scalarTableAnswer(table);
  // A bad index from a CELL — an error, or text that is not a number — is judged with the
  // index, after the search: #REF! for a found key. A literal one is the argument's own fault.
  let indexFault: FormulaError.Known | null = null;
  if (FormulaError.isError(colIndexNum)) {
    if (FormulaContext.getArgs().getKindAt(2) !== ValueKind.Reference) return colIndexNum;
    indexFault = FormulaError.BuiltIn.Ref!;
  }
  const colIndex = indexFault ? 1 : _lookupIndex(colIndexNum as number);
  // The index is judged only once the key is FOUND: a missing key is #N/A whatever the index, and
  // a found one is #VALUE! below the table and #REF! past it.
  const pastEnd = colIndex > table.getColumnCount();
  const pick = (at: number): Scalar =>
    indexFault ?? (colIndex < 1 ? FormulaError.BuiltIn.Value! : pastEnd ? FormulaError.BuiltIn.Ref! : (table.getValueAt(at, colIndex - 1) ?? null));

  const asWildCard = _lookupWildCard(lookupValue);

  if (rangeLookup) {
    // MATCH's bisection over the first column, wildcards read as text: an unsorted
    // `BLA16,BLA23567,BLA245,BLA,BLATST234,MEIER3456,SOMEBLA` finds BLA for "Bla?45".
    const index = _approximateIndex(table.slice({ colStart: 0, colEnd: 0 }), lookupValue);
    return index === -1 ? FormulaError.BuiltIn.NA! : pick(index);
  }

  // Exact match with wildcard support
  if (!asWildCard) {
    // The first column alone, indexed — see `_scanExact`.
    const rowIdx = table.slice({ colStart: 0, colEnd: 0 }).indexOf(lookupValue);
    if (rowIdx === -1) return FormulaError.BuiltIn.NA!;
    return pick(rowIdx);
  }
  const iter = table.entries({ axis: IRange.Axis.Column, includeEmpty: false });
  let next = iter.next();

  while (!next.done) {
    const { value, coords } = next.value;
    if (coords.colIndex !== 0) break;

    if (asWildCard.test(typeof value === 'string' ? value : String(value))) {
      return pick(coords.rowIndex);
    }

    next = iter.next();
  }

  return FormulaError.BuiltIn.NA!;
}

/**
 * Vertically stacks arrays into one array.
 * @param array An array or reference to be stacked.
 */
export function VSTACK(
  array: Repeating<IRange, 254>
): IRange {
  return _stack(array, IRange.Axis.Row);
}

/**
 * WRAPROWS and WRAPCOLS, which differ only in the axis the count measures.
 *
 * @remarks
 * - **the pad fills the tail of the LAST strip, and nothing else.** The bound is the vector's
 *   LENGTH, not the position of its last value — `SUM(WRAPROWS(A:A,2))` is the sum of the column
 *   because a whole column divides evenly and no pad applies, where padding from the last value
 *   onward would fill a million positions with `#N/A`. A blank INSIDE the vector stays a blank.
 * - **`wrap_count` truncates toward zero and must then be 1..2^31-1**, both ends `#NUM!`:
 *   `2^31-1` wraps and `2^31` is `#NUM!`, `2.9` wraps at two, `FALSE`, a blank cell and an
 *   omitted argument are all `#NUM!` (zero), and a negative is `#NUM!` at any magnitude. A count
 *   past the vector's length is clamped to it rather than refused.
 * - **a vector with no members at all is `#VALUE!`** — a lone blank cell is the case, where an
 *   empty STRING is an ordinary member and wraps.
 * - the vector may be a row or a column; a 2-D argument is `#VALUE!` and so is a reference union.
 */
const _wrap = (
  vectorOrValue: IRange | Scalar,
  wrapCount: number,
  padWith: Omittable<AcceptError<Scalar>>,
  axis: IRange.Axis
): IRange => {
  const vector = _asRange(vectorOrValue);
  const { rows, columns } = vector.getShape();
  if (rows > 1 && columns > 1) return FormulaError.BuiltIn.Value!;

  const count = Math.trunc(wrapCount);
  if (!(count >= 1 && count <= 2147483647)) return FormulaError.BuiltIn.Num!;

  const n = rows * columns;
  const strip = Math.min(n, count);
  if (strip < 1) return FormulaError.BuiltIn.Value!; // a vector with nothing in it
  const byRow = axis === IRange.Axis.Row;
  const strips = Math.ceil(n / strip);

  const wrapped = vector.empty().resize(
    byRow ? strips : strip,
    byRow ? strip : strips,
    null
  );
  const builder = wrapped.sparseBuilder(axis);

  let seen = 0;
  vector.forEach((value, { rowIndex, colIndex }) => {
    const i = rowIndex * columns + colIndex;
    seen++;
    if (byRow) builder.pushAt(Math.floor(i / strip), i % strip, value);
    else builder.pushAt(i % strip, Math.floor(i / strip), value);
  });
  if (seen === 0) return FormulaError.BuiltIn.Value!;

  // Only the last strip's tail — `n` is where the vector ENDS, and everything before it that is
  // blank is a member rather than a hole. `padWith` is passed through as it arrived: a BLANK cell
  // at the slot pads with a blank (`ISBLANK` of the pad is TRUE), which coalescing to the default
  // `#N/A` would make unsayable — the default is only for an absent or omitted argument, and the
  // parameter's own initializer already carries it.
  for (let i=n; i<strips*strip; i++) {
    if (byRow) builder.pushAt(Math.floor(i / strip), i % strip, padWith as Scalar);
    else builder.pushAt(i % strip, Math.floor(i / strip), padWith as Scalar);
  }

  return builder.build();
};

/**
 * Wraps a row or column vector after a specified number of values.
 * @param vector The vector or reference to wrap.
 * @param wrapCount The maximum number of values per column.
 * @param padWith The value with which to pad. The default is #N/A.
 */
export function WRAPCOLS(
  vector: IRange | Scalar,
  wrapCount: number,
  padWith: Omittable<AcceptError<Scalar>> = FormulaError.BuiltIn.NA! // pad passthrough
): IRange {
  return _wrap(vector, wrapCount, padWith, IRange.Axis.Column);
}

/**
 * Wraps a row or column vector after a specified number of values.
 * @param vector The vector or reference to wrap.
 * @param wrapCount The maximum number of values per row.
 * @param padWith The value with which to pad. The default is #N/A.
 */
export function WRAPROWS(
  vector: IRange | Scalar,
  wrapCount: number,
  padWith: Omittable<AcceptError<Scalar>> = FormulaError.BuiltIn.NA!
): IRange {
  return _wrap(vector, wrapCount, padWith, IRange.Axis.Row);
}

/**
 * How XLOOKUP and XMATCH match the lookup value.
 *
 * @remarks
 * Declared `ReportType`, as every numeric built-in enum is: the body keeps the verdict (anything
 * else is #VALUE!).
 */
enum MatchMode {
  /**
   * Only an item equal to the lookup value.
   * @name Exact match
   */
  Exact = 0,
  /**
   * An item equal to the lookup value, or else the next smaller item.
   * @name Exact match or next smaller item
   */
  ExactOrSmaller = -1,
  /**
   * An item equal to the lookup value, or else the next larger item.
   * @name Exact match or next larger item
   */
  ExactOrLarger = 1,
  /**
   * The lookup value may use *, ? and ~ as wildcards.
   * @name Wildcard character match
   */
  Wildcard = 2,
  /**
   * The lookup value is a regular expression, matched case-sensitively against any part of each
   * item's text.
   * @name Regular expression match
   */
  Regex = 3,
}

/**
 * The order in which XLOOKUP and XMATCH search.
 *
 * @remarks
 * Declared `ReportType`, as every numeric built-in enum is: the body keeps the verdict (anything
 * else is #VALUE!).
 */
enum SearchMode {
  /**
   * Search from the first item to the last.
   * @name Search first-to-last
   */
  FirstToLast = 1,
  /**
   * Search from the last item to the first.
   * @name Search last-to-first
   */
  LastToFirst = -1,
  /**
   * A binary search of items sorted in ascending order.
   * @name Binary search (sorted ascending order)
   */
  BinaryAscending = 2,
  /**
   * A binary search of items sorted in descending order.
   * @name Binary search (sorted descending order)
   */
  BinaryDescending = -2,
}

/**
 * Searches a range or an array for a match and returns the corresponding item from a second range or array. By default, an exact match is used.
 * @param lookupValue is the value to search for.
 * @param lookupArray is the array or range to search.
 * @param returnArray is the array or range to return.
 * @param ifNotFound returned if no match is found.
 * @param matchMode 0=exact (default), -1=exact/next-smaller, 1=exact/next-larger, 2=wildcard
 * @param searchMode 1=first→last (default), -1=last→first, 2=binary asc, -2=binary desc
 */
export function XLOOKUP(
  lookupValue: Scalar,
  lookupArray: Flatten<IRange>,
  returnArray: Flatten<IRange>,
  ifNotFound: Omittable<AcceptError<Scalar>> = FormulaError.BuiltIn.NA!,
  matchMode: ReportType<MatchMode> = MatchMode.Exact,
  searchMode: Omittable<ReportType<SearchMode>> = SearchMode.FirstToLast
): IReferenceRange {
  // Both modes are FLOORED before they are judged: 0.5 is the exact match, -0.5 the next smaller
  // (`XLOOKUP(2,{1;5;3},{10;20;30},,-0.5)` is 10) and -1.5 is the refused -2.
  matchMode = Math.floor(matchMode);
  searchMode = Math.floor(searchMode);
  if (![0, -1, 1, 2, 3].includes(matchMode)) throw FormulaError.BuiltIn.Value;
  if (![1, -1, 2, -2].includes(searchMode)) throw FormulaError.BuiltIn.Value;

  if (matchMode >= 2 && (searchMode === 2 || searchMode === -2)) throw FormulaError.BuiltIn.Value;
  // A union at either array slot is not a table — `#N/A`.
  if (lookupArray.length > 1 || returnArray.length > 1) return FormulaError.BuiltIn.NA! as unknown as IReferenceRange;
  const lookup = lookupArray[0];
  const result = returnArray[0];
  if (lookup.getColumnCount() > 1 && lookup.getRowCount() > 1) throw FormulaError.BuiltIn.Value;

  let searchByColumn = lookup.getRowCount() === 1;
  if (searchByColumn && lookup.getColumnCount() === 1) {
    // A 1x1 lookup array is both a row and a column, so the RETURN array decides the orientation:
    // one row is a vertical lookup that answers the whole row — `XLOOKUP(1,1,{1,2,3})` is {1,2,3}
    // — one column a horizontal one that answers the whole column, and a 2-D one fits neither.
    if (result.getRowCount() === 1) searchByColumn = false;
    else if (result.getColumnCount() !== 1) throw FormulaError.BuiltIn.Value;
  }
  // The return array runs the lookup array's length, or the call is #VALUE! before anything is
  // searched, found or not.
  const lookupLength = searchByColumn ? lookup.getColumnCount() : lookup.getRowCount();
  if ((searchByColumn ? result.getColumnCount() : result.getRowCount()) !== lookupLength) throw FormulaError.BuiltIn.Value;

  let idx: number;
  if (matchMode === 3) {
    idx = _scanRegex(lookup, _lookupRegex(lookupValue), searchMode === -1);
  } else if (lookupValue === null || lookupValue === undefined) {
    idx = _searchBlank(lookup, matchMode, searchMode);
  } else if ((matchMode === 0 || matchMode === 2) && (searchMode === 1 || searchMode === -1)) {
    // Exact, scanned: it stops at the hit rather than opening the whole vector (`_scanExact`).
    // Only mode 2 reads a pattern: `XLOOKUP("a?b*",…)` in exact mode looks for that text.
    idx = _scanExact(lookup, lookupValue, searchMode === -1, matchMode === 2 ? _lookupWildCard(lookupValue, true) : null);
  } else {
    // The index is a POSITION into result, so the flatten must include empty cells — iteration
    // skips them by default, which would compact the array and shift every position after a gap.
    // Same rule as XMATCH below: search the compacted array (an empty cell is not a match
    // candidate) and map the hit back through its position.
    const positional: Scalar[] = lookup.getValuesFlat(IncludeEmpty);
    const flat: Scalar[] = [];
    const positionOf: number[] = [];
    for (let i = 0; i < positional.length; i++) {
      if (positional[i] === null || positional[i] === undefined) continue;
      flat.push(positional[i]);
      positionOf.push(i);
    }
    const compactIdx = searchArray(
      lookupValue,
      flat,
      matchMode as 0 | -1 | 1 | 2,
      searchMode as 1 | -1 | 2 | -2
    );
    idx = compactIdx === -1 ? -1 : positionOf[compactIdx];
  }
  if (idx === -1) return ifNotFound as unknown as IReferenceRange;

  const axisLength = searchByColumn ? result.getColumnCount() : result.getRowCount();
  if (idx < axisLength) {
    if ((result as IReferenceRange).isIReferenceRange === true) {
      const coords = (result as IReferenceRange).getCoords();
      return FormulaContext.getReference(searchByColumn ? {
        rowStart: coords.rowStart, rowEnd: coords.rowEnd,
        colStart: coords.colStart + idx, colEnd: coords.colStart + idx,
        scope: coords.scope
      } : {
        rowStart: coords.rowStart + idx, rowEnd: coords.rowStart + idx,
        colStart: coords.colStart, colEnd: coords.colEnd,
        scope: coords.scope
      });
    }
    // An array literal has no location to reference; the slice is still the whole row/column.
    return result.slice(searchByColumn
      ? { colStart: idx, colEnd: idx }
      : { rowStart: idx, rowEnd: idx }) as unknown as IReferenceRange;
  }
  return result.getValueAt(searchByColumn ? 0 : idx, searchByColumn ? idx : 0) as unknown as IReferenceRange;
}

/**
 * Returns the relative position of an item in an array. By default, an exact match is required.
 * @param lookupValue is the value to search for.
 * @param lookupArray is the array or range to search.
 * @param matchMode 0=exact (default), -1=exact/next-smaller, 1=exact/next-larger, 2=wildcard
 * @param searchMode 1=first→last (default), -1=last→first, 2=binary asc, -2=binary desc
 */
export function XMATCH(
  lookupValue: Scalar,
  lookupArray: Flatten<IRange>,
  matchMode: ReportType<MatchMode> = MatchMode.Exact,
  searchMode: Omittable<ReportType<SearchMode>> = SearchMode.FirstToLast
): Scalar {
  if (lookupArray.length > 1) return FormulaError.BuiltIn.NA!; // a union is not a table
  matchMode = Math.floor(matchMode); // floored, as XLOOKUP's are
  searchMode = Math.floor(searchMode);
  return _matchCore(lookupValue, lookupArray[0], matchMode, searchMode, matchMode === 2);
}

/**
 * The shared body of {@link XMATCH} and {@link MATCH}, which differ in wildcard handling, in
 * how an approximate search treats a member it cannot compare, and in a blank lookup value.
 *
 * `lookupValue` is ONE value: the slot is scalar and the engine lifts a container over it, one
 * position per member (`MATCH({"a";"b"},B1:B5,0)` spills 2x1, `MATCH(A1:A4,B1:B5,0)` spills 4x1
 * with a blank member answering `#N/A` and an error member keeping its identity).
 *
 * @param legacy MATCH's rules rather than XMATCH's: the approximate search steps past an error or a
 * member of another type (`_approximateMatch`) where XMATCH's binary search ranks one, and a blank
 * lookup value finds nothing where XMATCH finds an empty member (`_searchBlank`).
 */
function _matchCore(
  lookupValue: Scalar,
  lookupArray: IRange,
  matchMode: number,
  searchMode: number,
  allowWildcards: boolean,
  legacy: boolean = false
): Scalar {
  if (![0, -1, 1, 2, 3].includes(matchMode)) throw FormulaError.BuiltIn.Value;
  if (![1, -1, 2, -2].includes(searchMode)) throw FormulaError.BuiltIn.Value;
  // Wildcard and regex modes on a binary search are refused as a MODE PAIR — #VALUE.
  if (matchMode >= 2 && (searchMode === 2 || searchMode === -2)) throw FormulaError.BuiltIn.Value;
  if (lookupArray.getColumnCount() > 1 && lookupArray.getRowCount() > 1) throw FormulaError.BuiltIn.Value;
  if (matchMode === 3) {
    const position = _scanRegex(lookupArray, _lookupRegex(lookupValue), searchMode === -1);
    return position === -1 ? FormulaError.BuiltIn.NA! : position + 1;
  }
  if (lookupValue === null || lookupValue === undefined) {
    if (legacy) return FormulaError.BuiltIn.NA!;
    const position = _searchBlank(lookupArray, matchMode, searchMode);
    return position === -1 ? FormulaError.BuiltIn.NA! : position + 1;
  }

  if ((matchMode === 0 || matchMode === 2) && (searchMode === 1 || searchMode === -1)) {
    // Exact, scanned: it stops at the hit rather than opening the whole vector (`_scanExact`).
    const position = _scanExact(lookupArray, lookupValue, searchMode === -1,
      allowWildcards ? _lookupWildCard(lookupValue, true) : null);
    return position === -1 ? FormulaError.BuiltIn.NA! : position + 1;
  }

  const positional: Scalar[] = lookupArray.getValuesFlat(IncludeEmpty); // flattens row oriented.
  if (legacy && (searchMode === 2 || searchMode === -2)) {
    // A blank cell keeps its place, as it does for VLOOKUP: `MATCH(2,{1;<blank>;3;<blank>;5},1)`
    // bisects five positions, not three.
    const position = _approximateMatch(positional, lookupValue, searchMode === 2);
    return position === -1 ? FormulaError.BuiltIn.NA! : position + 1;
  }
  const compact: Scalar[] = [];
  const positionOf: number[] = [];
  for (let i=0; i<positional.length; i++) {
    if (positional[i] === null || positional[i] === undefined) continue;
    compact.push(positional[i]);
    positionOf.push(i);
  }
  const idx = searchArray(
    lookupValue,
    compact,
    matchMode as 0 | -1 | 1 | 2,
    searchMode as 1 | -1 | 2 | -2,
    allowWildcards
  );
  return idx === -1 ? FormulaError.BuiltIn.NA! : positionOf[idx] + 1;
}

// helpers

/**
 * MATCH's approximate search (`match_type` 1 or -1) over sorted `values`.
 *
 * @param ascending `true` for `match_type` 1 (largest at or below), `false` for -1 (smallest at or
 * above).
 * @returns The 0-based index, or -1.
 *
 * @remarks
 * `match_type` -1 is a scan (below). `match_type` 1 is a bisection, but not the one
 * {@link _binarySearch} runs for XMATCH, which ranks an error above everything and so misses
 * `=MATCH(2,1/{0,1,0,1,0})`, the "last non-error" idiom.
 *
 * - A midpoint that cannot be compared with the target — an error, or a member of another type —
 *   is stepped past: UPWARD to the first comparable member still inside the window, else downward.
 *   A window with none ends the search. The window then narrows from the member that was READ,
 *   not from the midpoint, when it closes downward: over `0,4,_,_,_,_,1,10,2,_,7,2,6` a search
 *   for 3 steps from the blank tenth position to the 7 after it and keeps positions eight to
 *   ten, finding the 2 at nine.
 * - An exact hit ends the search at the END of its run of equal members, scanned forward and
 *   stopped by the first member that is not equal, an error included: `MATCH(1,1/{1,1,1,1})` is 4
 *   and `MATCH(1,1/{0,1,0,1})` is 2.
 *
 * LOOKUP searches the same way.
 */
/**
 * {@link _approximateMatch} ascending over one row or column; the 0-based position, or -1.
 *
 * A blank cell keeps its PLACE and is stepped past like any member that cannot be compared, so
 * the midpoints are the range's own: `HLOOKUP("STRING",…,TRUE)` over
 * `INTEGRAL,DOUBLE,BLANK,STRING,REF,AREA,<blank>` opens on STRING, where the six texts alone
 * would open on BLANK and end on AREA.
 */
function _approximateIndex(vector: IRange, target: Scalar): number {
  return _approximateMatch(vector.getValuesFlat(IncludeEmpty), target, true);
}

function _approximateMatch(values: Scalar[], target: Scalar, ascending: boolean): number {
  const comparable = (i: number): boolean => values[i] != null && typeof values[i] === typeof target;
  if (!ascending) {
    // `match_type` -1 scans from the front: an equal member answers, the first smaller one ends
    // the search on the member before it. `MATCH(110,{110;110;110},-1)` is 1, and an ascending
    // `{"aaaa","bbbb"}` is 1 for "aaaa" and #N/A for "bbbb".
    let bound = -1;
    for (let i = 0; i < values.length; i++) {
      if (!comparable(i)) continue;
      const cmp = _lookupCompare(values[i], target);
      if (cmp === 0) return i;
      if (cmp < 0) return bound;
      bound = i;
    }
    return bound;
  }
  let lo = 0, hi = values.length - 1, bound = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    let at = mid;
    if (!comparable(at)) {
      while (at <= hi && !comparable(at)) at++;
      if (at > hi) {
        at = mid;
        while (at >= lo && !comparable(at)) at--;
        if (at < lo) break;
      }
    }
    const cmp = _lookupCompare(values[at], target);
    if (cmp === 0) {
      while (at + 1 < values.length && comparable(at + 1) && _lookupCompare(values[at + 1], target) === 0) at++;
      return at;
    }
    if (ascending ? cmp < 0 : cmp > 0) {
      bound = at;
      lo = Math.max(mid, at) + 1;
    } else {
      hi = at - 1;
    }
  }
  return bound;
}

/**
 * The order the LOOKUP family searches by — {@link FormulaContext.compare} with ONE exception.
 *
 * @remarks
 * Every lookup ranks across types the way the comparison operators do rather than coercing
 * (`number` &lt; `text` &lt; `FALSE` &lt; `TRUE`), and collates text case-insensitively in the
 * workbook locale with the word sort. Raw JS `<`/`>` gets both wrong: `"3" <= 5` is TRUE in JS
 * where every text ranks above every number, and `"a" <= "B"` is FALSE in JS where the collation
 * makes it TRUE.
 */
function _lookupCompare(a: Scalar, b: Scalar): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a < b ? -1 : (a > b ? 1 : 0);
  }
  return FormulaContext.compare(a, b);
}

/**
 * `col_index_num` / `row_index_num` as VLOOKUP and HLOOKUP read them: the double's
 * 15-significant-digit reading, truncated toward zero.
 *
 * @remarks
 * Both readings are needed. `VLOOKUP(10,A1:C1,3.9,TRUE)` returns column 3
 * rather than `#REF!`, so the count is checked against the integer and not the raw double; and
 * `VLOOKUP(10,A1:C1,0.0003*10000,TRUE)` — 2.9999999999999996 — returns column 3, where a raw
 * truncation would return column 2. INDEX's index reads the RAW double at the same shape, which
 * is the usual per-slot split.
 */
/**
 * Whether a range-typed argument is a bare SCALAR the marshaller boxed, rather than an array or
 * a reference that happens to hold one cell.
 *
 * @remarks
 * VLOOKUP, HLOOKUP and MATCH search nothing at a scalar and answer `#N/A` at every index —
 * `VLOOKUP(10,10,2,TRUE)` is `#N/A` where `VLOOKUP(10,A1:A1,2,TRUE)` is `#REF!` — while a 1x1
 * ARRAY is an ordinary one-cell table: `VLOOKUP(10,{10},1,TRUE)` is 10 and `MATCH(10,{10},0)` is
 * 1. `TYPE` shows the split (64 for the array, 1 for the scalar), and
 * the argument's KIND is where the distinction lives — `getArgs().getKindAt(1)`, the
 * table/lookup slot being parameter 1 in all three askers.
 *
 * LOOKUP is the exception and asks nothing: `LOOKUP(10,10)` is 10.
 */
function _isScalarTable(): boolean {
  const kind = FormulaContext.getArgs().getKindAt(1);
  return kind !== ValueKind.Reference && kind !== ValueKind.Array;
}

/**
 * What VLOOKUP and HLOOKUP answer at a scalar table: `#N/A`, except text, which is `#VALUE!` —
 * `VLOOKUP(1,"foo",2,TRUE)`.
 */
function _scalarTableAnswer(table: IRange): Scalar {
  return typeof table.getValueAt(0, 0) === 'string' ? FormulaError.BuiltIn.Value! : FormulaError.BuiltIn.NA!;
}

function _lookupIndex(indexNum: number): number {
  if (!Number.isFinite(indexNum)) return indexNum;
  return Math.trunc(indexNum === 0 ? 0 : Number(indexNum.toPrecision(15)));
}

/**
 * The matcher for a wildcard lookup target, or `null` when the target is not a pattern.
 *
 * @param tilde Whether a `~` alone makes the target a pattern. It does for MATCH's exact mode and
 * XMATCH/XLOOKUP matchMode 2 — the tilde makes any next character literal and is dropped, so
 * `MATCH("~a",…,0)` finds the text `a`. Otherwise only `*` or `?` does (VLOOKUP/HLOOKUP exact).
 */
function _lookupWildCard(target: Scalar, tilde: boolean = false): RegExp | null {
  if (typeof target !== 'string') return null;
  const isPattern = tilde ? /[*?~]/.test(target) : WildCard.isWildCard(target);
  return isPattern ? WildCard.toRegex(target, 'i', true) : null;
}

/**
 * Binary search over sorted `values`, honoring `matchMode`.
 *
 * @param target `null` searches for an empty member, as {@link _searchBlank} does.
 * @param ascending `true` for searchMode 2, `false` for the descending searchMode -2.
 * @returns The 0-based index, or -1.
 *
 * @remarks
 * An equal member ends nothing: the bisection keeps narrowing toward the FRONT of the equal run
 * ascending and toward its BACK descending (`XMATCH(2,{1,2,2,2,3},0,2)`
 * is 2 and `XMATCH(2,{3,2,2,2,1},0,-2)` is 4. Over unsorted
 * values the same walk is what reproduces Excel's answers, so it is not a sorted-input shortcut.
 *
 * Without an equal member one boundary answers both approximate modes. Ascending, `near` is the
 * last index visited below the target, so next-smaller is that index and next-larger the one after
 * it. Descending, `near` is the last index above the target and the two modes swap.
 */
function _binarySearch(
  values: Scalar[],
  target: Scalar,
  matchMode: 0 | -1 | 1 | 2,
  ascending: boolean
): number {
  let lo = 0, hi = values.length - 1, hit = -1, near = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const cmp = target === null ? _blankCompare(values[mid]) : _lookupCompare(values[mid], target);
    if (cmp === 0) {
      hit = mid;
      if (ascending) hi = mid - 1;
      else lo = mid + 1;
    } else if (ascending ? cmp < 0 : cmp > 0) {
      near = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (hit !== -1) return hit;
  if (matchMode === 0 || matchMode === 2) return -1; // exact only, and there was none
  // The remaining direction is the neighbour on the other side of the boundary.
  if (ascending ? matchMode === -1 : matchMode === 1) return near;
  return near + 1 < values.length ? near + 1 : -1;
}

/**
 * How a member compares with a BLANK lookup value in XLOOKUP and XMATCH: equal to an empty member
 * and below every value, errors included.
 */
function _blankCompare(value: Scalar): number {
  return value === null || value === undefined ? 0 : -1;
}

/**
 * XLOOKUP and XMATCH for a BLANK lookup value: a reference to an empty cell, an omitted argument, a
 * blank member of a lifted one.
 *
 * @returns The 0-based position within the vector, or -1.
 *
 * @remarks
 * The blank equals an EMPTY member only — not 0, not `""`, not FALSE — and ranks above every value.
 * So in every mode an empty member is an exact hit, first in search order; without one, next-smaller
 * is the largest member (`XMATCH(Z1,{1,2,3},-1)` is 3) and next-larger finds nothing. The empty members
 * are the vector's own: a range's empty cells, and the empty members TOCOL or FILTER carry over from one,
 * never a 0 an operator made of it. MATCH, VLOOKUP and LOOKUP answer differently and do not come
 * here.
 */
function _searchBlank(
  lookupArray: IRange,
  matchMode: number,
  searchMode: number
): number {
  if (searchMode === 2 || searchMode === -2) {
    return _binarySearch(lookupArray.getValuesFlat(IncludeEmpty), null, matchMode as 0 | -1 | 1 | 2, searchMode === 2);
  }
  const reverse = searchMode === -1;
  const isRowVector = lookupArray.getRowCount() === 1;
  const iter = lookupArray.entries<Scalar>({
    axis: isRowVector ? IRange.Axis.Row : IRange.Axis.Column,
    includeEmpty: true,
    reverse
  });
  let best = -1;
  let bestValue: Scalar = null;
  let next = iter.next();
  while (!next.done) {
    const { value, coords } = next.value;
    const position = isRowVector ? coords.colIndex : coords.rowIndex;
    if (value === null || value === undefined) return position;
    // Next-smaller keeps the largest, the first of a tie in search order; it needs every member.
    if (matchMode === -1 && (best === -1 || _lookupCompare(value, bestValue) > 0)) {
      best = position;
      bestValue = value;
    }
    next = iter.next();
  }
  return best;
}

/**
 * The pattern of match_mode 3: the lookup value's text as a regular expression, case-sensitive, a
 * leading `(?i)`-style group setting its flags. An invalid pattern is #VALUE!.
 */
function _lookupRegex(target: Scalar): RegExp {
  let source = FormulaContext.toText(target);
  let flags = '';
  const inline = /^\(\?([ims]+)\)/.exec(source);
  if (inline) {
    flags = [...new Set(inline[1])].join('');
    source = source.slice(inline[0].length);
  }
  try {
    return new RegExp(source, flags);
  } catch {
    throw FormulaError.BuiltIn.Value;
  }
}

/**
 * The first member (or last, `reverse`) whose text the pattern finds anywhere in: `"a"` finds
 * `"cat"`, and a number or a logical is matched as its text (`"4"` finds 142).
 */
function _scanRegex(lookupArray: IRange, pattern: RegExp, reverse: boolean): number {
  const isRowVector = lookupArray.getRowCount() === 1;
  const iter = lookupArray.entries<Scalar>({
    axis: isRowVector ? IRange.Axis.Row : IRange.Axis.Column,
    includeEmpty: false,
    reverse
  });
  for (let next = iter.next(); !next.done; next = iter.next()) {
    const { value, coords } = next.value;
    if (FormulaError.isError(value)) continue;
    if (pattern.test(FormulaContext.toText(value))) return isRowVector ? coords.colIndex : coords.rowIndex;
  }
  return -1;
}

/**
 * The exact-match search of {@link searchArray}, run over the range itself rather than a
 * flattened copy of it.
 *
 * @returns The 0-based position within the vector, or -1.
 *
 * @remarks
 * Same answers as `searchArray`'s exact branch — a blank is never a candidate, the first hit in
 * scan order wins. A plain value is `IRange.indexOf`, which answers from an index over the
 * vector's stored runs and so costs the same however many cells share the table. A wildcard
 * pattern has no key to hash and is walked here.
 *
 * Either way the cells past the hit are never opened. That is what decides circularity when the vector contains the formula's own cell (a
 * hit before the self cell is not circular, a hit after it is, and `searchMode` -1 mirrors both);
 * while a read is deciding that, `indexOf` walks the cells rather than answering from the index.
 * The approximate modes still flatten — they have no hit to stop at, and they binary-search.
 */
function _scanExact(
  lookupArray: IRange,
  target: Scalar,
  reverse: boolean,
  wildCard: RegExp | null
): number {
  if (wildCard === null) return lookupArray.indexOf(target, { reverse });
  const isRowVector = lookupArray.getRowCount() === 1;
  const iter = lookupArray.entries<Scalar>({
    axis: isRowVector ? IRange.Axis.Row : IRange.Axis.Column,
    includeEmpty: false,
    reverse
  });
  let next = iter.next();
  while (!next.done) {
    const { value, coords } = next.value;
    if (value !== null && value !== undefined) {
      const matched = wildCard
        ? (typeof value === 'string' && wildCard.test(value))
        : _lookupCompare(value, target) === 0;
      if (matched) return isRowVector ? coords.colIndex : coords.rowIndex;
    }
    next = iter.next();
  }
  return -1;
}

// ─── Core search (operates on flat Scalar[]) ────────────────────────────────

/**
 * Returns 0-based index or -1 if not found.
 *
 * @param matchMode 0=exact, -1=exact/next-smaller, 1=exact/next-larger, 2=wildcard
 * @param searchMode 1=first→last, -1=last→first, 2=binary-asc, -2=binary-desc
 * @param allowWildcards Whether a pattern in `target` is honored. Defaults to matchMode 2.
 */
function searchArray(
  target: Scalar,
  values: Scalar[],
  matchMode: 0 | -1 | 1 | 2,
  searchMode: 1 | -1 | 2 | -2,
  allowWildcards: boolean = matchMode === 2
): number {
  const wildCard = allowWildcards ? _lookupWildCard(target, true) : null;

  if (searchMode === 2 || searchMode === -2) {
    // Wildcard mode never reaches a binary search.
    return _binarySearch(values, target, matchMode, searchMode === 2);
  }

  // Linear search
  const step = searchMode === -1 ? -1 : 1;
  const start = searchMode === -1 ? values.length - 1 : 0;
  const end = searchMode === -1 ? -1 : values.length;

  if (matchMode === 0 || matchMode === 2) {
    for (let i = start; i !== end; i += step) {
      const v = values[i];
      if (v === null || v === undefined) continue; // a blank is never a candidate
      if (wildCard) {
        if (typeof v === 'string' && wildCard.test(v)) return i;
      } else if (_lookupCompare(v, target) === 0) {
        return i;
      }
    }
    return -1;
  }

  // matchMode -1 or 1: approximate — see the remarks above.
  let bestIdx = -1;
  let bestVal: Scalar = null;
  for (let i = start; i !== end; i += step) {
    const v = values[i];
    if (v === null || v === undefined) continue;
    const cmp = _lookupCompare(v, target);
    if (cmp === 0) return i; // exact — unbeatable in either mode; first in scan order wins
    if (matchMode === -1) {
      if (cmp < 0 && (bestIdx === -1 || _lookupCompare(v, bestVal) > 0)) { bestIdx = i; bestVal = v; }
    } else {
      if (cmp > 0 && (bestIdx === -1 || _lookupCompare(v, bestVal) < 0)) { bestIdx = i; bestVal = v; }
    }
  }
  return bestIdx;
}

// helpers sort

// ─── Shared internal utilities ────────────────────────────────────────

// to determine whether to include a value based on the ignore parameter
function _shouldIgnore(v: Scalar, ignore: number): boolean {
  if (ignore === 0) return false;
  if (ignore === 1 || ignore === 3) { if (v === null) return true; }
  if (ignore === 2 || ignore === 3) { if (FormulaError.isError(v)) return true; }
  return false;
}

/**
 * One axis of {@link OFFSET}'s window, as absolute `[start, end]` coordinates grown from an already
 * shifted `anchor`.
 *
 * A size is NOT a count. The window spans the anchor to `anchor + trunc(size) - sign(size)` and
 * then normalizes, so an accepted size can grow the window UP/LEFT instead of down/right, and only an
 * EXACT zero is an error — every other `#REF!` in this range is the window leaving the grid.
 *
 * The sign test reads the RAW size, not the truncated one, which is what makes `0.5` and `-0.5`
 * both span two cells and in OPPOSITE directions: `0.5` truncates to `0` and takes the positive
 * branch (`[a, a-1]`, normalized to `a-1..a`), `-0.5` truncates to `-0` and takes the negative
 * branch (`[a+1, a]`, normalized to `a..a+1`).
 */
const _offsetWindow = (anchor: number, size: number): [start: number, end: number] => {
  // A blank cell reaches here as 0, and a range of no rows is not something a reference can be.
  // The same holds for an exact zero however spelled (literal, blank cell, `"0"`).
  if (size === 0) throw FormulaError.BuiltIn.Ref;
  const span = Math.trunc(size);
  const start = size > 0 ? anchor : anchor + span + 1;
  const end = size > 0 ? anchor + span - 1 : anchor;
  return start > end ? [end, start] : [start, end];
};