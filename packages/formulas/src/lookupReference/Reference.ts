/* cspell: disable */
import { Scalar, IRange, IReferenceRange, FormulaError, FormulaContext } from '@sheetxl/primitives';

import { WildCard } from '../_utils';

/**
 * @summary Creates a cell reference as text, given specified row and column numbers
 * @param rowNum is the row number to use in the cell reference: Row_number = 1 for row 1
 * @param columnNum is the column number to use in the cell reference. For example, Column_number = 4 for column D
 * @param absNum specifies the reference type: absolute = 1; absolute row/relative column = 2; relative row/absolute column = 3; relative = 4
 * @param a1 is a logical value that specifies the reference style: A1 style = 1 or TRUE; R1C1 style = 0 or FALSE
 * @param sheetText is text specifying the name of the worksheet to be used as the external reference
 */
export function ADDRESS(
  rowNum: number,
  columnNum: number,
  absNum: number=1,
  a1: boolean=true,
  sheetText: string=''
): string {
  if (rowNum < 1 || columnNum < 1 || absNum < 1 || absNum > 4) throw FormulaError.BuiltIn.Value;

  const asFixed: IRange.FixableCellCoords = {
    $colIndex: absNum === 1 || absNum === 3,
    colIndex: columnNum - 1,
    $rowIndex: absNum === 1 || absNum === 2,
    rowIndex: rowNum - 1,
    sheetName: sheetText
  }
  return FormulaContext.getAddress(asFixed, !a1);
}

/**
 * @summary Returns the number of areas in a reference. An area is a range of contiguous cells or a single cell
 * @param references is a reference to a cell or range of cells and can refer to multiple areas
 */
export function AREAS(...references: IRange[]): number {
  return references.length;
}

/**
 * @summary Chooses a value or action to perform from a list of values, based on an index number
 * @param indexNum specifies which value argument is selected. Index_num must be between 1 and 254, or a formula or a reference to a number between 1 and 254
 * @param value1 value1,value2,... are 1 to 254 numbers, cell references, defined names, formulas, functions, or text arguments from which CHOOSE selects
 */
export function CHOOSE(
  indexNum: number,
  value1: IRange,
  ...value: IRange[]
): IRange {
  // one based
  if (indexNum === 1) return value1;
  if (indexNum < 1 || indexNum > value.length + 1) throw FormulaError.BuiltIn.Value;

  return value[indexNum - 2];
}

/**
 * @summary Returns columns from an array or reference.
 * @param array The array or reference from which to choose columns.
 * @param colNum1 col_num1,col_num2,... The number of the column to be returned.
 */
export function CHOOSECOLS(
  array: IRange,
  colNum1: number,
  ...colNum: number[]
): any {
  // TODO - use range forEach and not this way
  const asArray = array.getValues();
  // Process all column indices
  const indices = [colNum1, ...colNum].map(index => {
    // Column indices must be positive
    if (index <= 0) {
      throw FormulaError.BuiltIn.Value;
    }

    // Check if column index exceeds array bounds
    if (index > asArray[0].length) {
      throw FormulaError.BuiltIn.Ref;
    }

    // Convert to 0-based index
    return Math.floor(index - 1);
  });

  // Create a new array with selected columns
  const result = [];
  for (let i = 0; i < asArray.length; i++) {
    result[i] = indices.map(colIdx => asArray[i][colIdx]);
  }

  return result;
}

/**
 * @summary Returns rows from an array or reference.
 * @param array The array or reference from which to choose rows.
 * @param rowNum1 row_num1,row_num2,... The number of the row to be returned.
 */
export function CHOOSEROWS(array: IRange, rowNum1: number, ...rowNum: number[]): any {
  // TODO - use range forEach and not this way
  const asArray = array.getValues();
  // Process all row indices
  const indices = [rowNum1, ...rowNum].map(index => {
    // Row indices must be positive
    if (index <= 0) {
      throw FormulaError.BuiltIn.Value;
    }

    // Check if row index exceeds array bounds
    if (index > asArray.length) {
      throw FormulaError.BuiltIn.Ref;
    }

    // Convert to 0-based index
    return Math.floor(index - 1);
  });

  // Create a new array with selected rows
  return indices.map(rowIdx => [...asArray[rowIdx]]);
}

/**
 * @summary Returns the column number of a reference
 * @param reference is the cell or range of contiguous cells for which you want the column number. If omitted, the cell containing the COLUMN function is used
 */
export function COLUMN(
  reference?: IReferenceRange
): number[] {
  if (!reference) {
    return [FormulaContext.getPosition().colIndex + 1];
  }

  const retValue = [];
  const coords = reference.getCoords();
  const coordsColStart = coords.colStart;
  const coordsColEnd = coords.colEnd;
  for (let j=coordsColStart; j<=coordsColEnd; j++) {
    retValue.push(j+1);
  }
  return retValue;
}

/**
 * @summary Returns the number of columns in an array or reference
 * @param array is an array or array formula, or a reference to a range of cells for which you want the number of columns
 */
export function COLUMNS(array: IRange): number {
  return array.getWidth();
}

// Why is this an IReferenceRange in Excel (Perhaps this has iterators?)
// should be an array[][] like expand?
/**
 * @hidden Unimplemented
 * @summary Drops rows or columns from array start or end.
 * @param array The array from which to drop rows or columns.
 * @param row The number of rows to drop. A negative value drops from the end of the array.
 * @param columns The number of columns to drop. A negative value drops from the end of the array.
 */
export function DROP(
  array: IRange,
  row: number,
  columns: number=0
): IRange {
  // TODO - implement
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Expands an array to the specified dimensions.
 * @param array The array to expand.
 * @param row The number of rows in the expanded array. If missing, rows will not be expanded.
 * @param columns The number of columns in the expanded array. If missing, columns will not be expanded.
 * @param padWidth The value with which to pad. The default is #N/A.
 */
export function EXPAND(
  array: IRange,
  row: number,
  columns: number=0,
  padWidth: Scalar=FormulaError.BuiltIn.NA
): IRange {
  // TODO - implement
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Extracts a value from a field of a given record
 * @param value The record from which you want to extract the field
 * @param fieldName The names of the field or fields that you want to extract
 */
export function FIELDVALUE(value: Scalar, fieldName: string): any {
  // must be a complex type
  // TODO - implement
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Filter a range or array
 * @param array the range or array to filter
 * @param include an array of booleans where TRUE represents a row or column to retain
 * @param ifEmpty return if no items are retained
 */
export function FILTER(
  array: IRange,
  include: IRange,
  ifEmpty: IRange
): IRange {
  // TODO - implement
  return undefined;
}

/**
 * @summary Returns a formula as a string
 * @param reference is a reference to a formula
 */
export function FORMULATEXT(reference: IReferenceRange): string {
  const coords = reference.getCoords();
  const asText = FormulaContext.getFormulaAt(coords.rowStart, coords.colStart);
  if (asText === null) {
    throw FormulaError.BuiltIn.NA;
  }
  return '=' + asText;
}

// TODO - this repeats field1 and item1 (we can do this with a ...{ field1: string, item: any }[])
/**
 * @hidden Unimplemented
 * @summary Extracts data stored in a PivotTable.
 * @param dataField is the name of the data field to extract data from
 * @param pivotTable is a reference to a cell or range of cells in the PivotTable that contains the data you want to retrieve
 * @param field1 field1,field2,... field to refer to
 * @param item1 item1,item2,... field item to refer to
 */
export function GETPIVOTDATA(
  dataField: string,
  pivotTable: string,
  field1: string, //[]
  item1: IRange, //[]
): string {
  // TODO - implement
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Aggregate values by row fields
 * @param rowFields The range or array containing the row fields
 * @param values The range or array containing the values to aggregate
 * @param fn The function used to do the aggregations
 * @param fieldHeaders A number between 0 and 3 that specifies whether the field data has headers and whether field headers should be returned in the results
 * @param totalDepth Show totals for the row fields. 0 for none, 1 for grand totals, 2 for grand total and first level subtotals, etc
 * @param sortOrder The column index to sort the row fields on. A negative index will sort in reverse order
 * @param filterArray param-534 paramName-535
 * @param fieldRelationship The relationship of fields when multiple columns are supplied to the row_fields argument
 */
export function GROUPBY(
  rowFields: IReferenceRange,
  values: IRange,
  fn: any[], // this is a lambda function
  fieldHeaders: number=null, // 0-no, 1-yes, 2-no but generate, 3-yes and show
  totalDepth: number=2, // 0-no totals, 1-grand totals, 2-grand and subtotals, -1-grand totals at top, -2 grand and sub totals at top
  sortOrder: any[]=null, // <0, >0
  filterArray: boolean[]=null,
  fieldRelationship: number=0 // 0-Hierarchy, 1-Table
  ): string {
  // TODO - implement
  return undefined;
}

/**
 * @summary Looks for a value in the top row of a table or array of values and returns the value in the same column from a row you specify
 * @param lookupValue is the value to be found in the first row of the table and can be a value, a reference, or a text string
 * @param tableArray is a table of text, numbers, or logical values in which data is looked up. Table_array can be a reference to a range or a range name
 * @param rowIndexNum is the row number in table_array from which the matching value should be returned. The first row of values in the table is row 1
 * @param rangeLookup is a logical value: to find the closest match in the top row (sorted in ascending order) = TRUE; find an exact match = FALSE
 */
export function HLOOKUP(
  lookupValue: Scalar,
  tableArray: IRange,
  rowIndexNum: number,
  rangeLookup: boolean=true
): any {
  // check if rowIndexNum out of bound
  if (rowIndexNum < 1) return FormulaError.BuiltIn.Value;
  if (rowIndexNum > tableArray.getHeight()) return FormulaError.BuiltIn.Ref;
  if (tableArray.size === 1) return FormulaError.BuiltIn.NA;

  //TODO - this is causing huge performance issues move to range search.
  const asArray = tableArray.getValues();
  const lookupType = typeof lookupValue; // 'number', 'string', 'boolean'

  const asString = typeof lookupValue === 'string' ? lookupValue : String(lookupValue);
  const isWildCard = WildCard.isWildCard(asString);
  const asWildCard = isWildCard ? WildCard.toRegex(asString, 'i') : null;

  // approximate lookup (assume the array is sorted)
  if (rangeLookup) {
    let prevValue = lookupType === typeof asArray[0][0] ? asArray[0][0] : null;
    const asArray0Length = asArray[0].length;
    for (let i=1; i<asArray0Length; i++) {
      const currValue = asArray[0][i];
      const type = typeof currValue;
      // skip the value if type does not match
      if (type !== lookupType)
        continue;
      // if the previous two values are greater than lookup value, throw #N/A
      if (prevValue > lookupValue && currValue > lookupValue) {
        throw FormulaError.BuiltIn.NA;
      }
      if (currValue === lookupValue)
        return asArray[rowIndexNum - 1][i];
      // if previous value <= lookup value and current value > lookup value
      if (prevValue != null && currValue > lookupValue && prevValue <= lookupValue) {
        return asArray[rowIndexNum - 1][i - 1];
      }
      prevValue = currValue;
    }
    if (prevValue === null)
      throw FormulaError.BuiltIn.NA;
    if (asArray[0].length === 1) {
      return asArray[rowIndexNum - 1][0]
    }
    return prevValue;
  }
  // exact lookup with wildcard support
  else {
    let index = -1;
    if (isWildCard) {
      index = asArray[0].findIndex(item => {
        const asString = typeof item === 'string' ? item : String(item);
        return asWildCard.test(asString);
      });
    } else {
      index = asArray[0].findIndex(item => {
        return item === lookupValue;
      });
    }
    // the exact match is not found
    if (index === -1) throw FormulaError.BuiltIn.NA;
    return asArray[rowIndexNum - 1][index];
  }
}

/**
 * @hidden Unimplemented
 * @summary Horizontally stacks arrays into one array.
 * @param array array1,array2,... An array or reference to be stacked.
 */
export function HSTACK(
  array1: IRange,
  ...array: IRange[]
): Scalar {
  return undefined;
}

// TODO - how to return smart objects? (Perhaps we return a json object that setValues knows how to interpret?)
/**
 * @hidden Unimplemented
 * @summary Creates a shortcut or jump that opens a document stored on your hard drive, a network server, or on the Internet
 * @param linkLocation is the text giving the path and file name to the document to be opened, a hard drive location, UNC address, or URL path
 * @param friendlyName is text or a number that is displayed in the cell. If omitted, the cell displays the Link_location text
 */
export function HYPERLINK(
  linkLocation: string,
  friendlyName?: string
): any {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns an image from a given source
 * @param source The path of the source that points to the image
 * @param alternateText The alternative text that describes the image for accessibility
 * @param sizing The setting that determines the dimensions in which the image will be rendered in the cell
 * @param height The custom height of the image in pixels
 * @param width The custom width of the image in pixels
 */
export function IMAGE(
  source: string,
  alternateText: string,
  sizing: number,
  height: number,
  width: number
): any {
  return undefined;
}

/**
 * @summary Returns a value or reference of the cell at the intersection of a particular row and column, in a given range
 * @param array is a range of cells or an array constant.
 * @param rowNum selects the row in Array or Reference from which to return a value. If omitted, Column_num is required
 * @param colNum selects the column in Array or Reference from which to return a value. If omitted, Row_num is required
 * @param areaNum selects the area in Array or Reference from which to return a value. If omitted, the first area is used
 * @remarks
 * Excel has treats this as 2 signatures. Not sure why.
 */
export function INDEX(
  array: IRange[],
  rowNum: number=0,
  colNum: number=0,
  areaNum: number=1
): any { // IReferenceRange | FormulaError.Known {
  if (rowNum < 0 || colNum < 0 || areaNum < 0) return FormulaError.BuiltIn.Value;
  if (areaNum > array.length) return FormulaError.BuiltIn.Ref;

  const asSingleRange = array[areaNum-1];
  if (rowNum === 0 && colNum === 0) return asSingleRange;
  if (rowNum !== 0 && colNum !== 0) return asSingleRange.getValueAt(rowNum - 1, colNum - 1);

  const height = asSingleRange.getHeight();
  const width = asSingleRange.getWidth();
  if (rowNum > height || colNum > width) return FormulaError.BuiltIn.Ref;

  if (rowNum === 0) {
    const colIndex = colNum - 1;
    return asSingleRange.slice({
      colStart: colIndex,
      rowStart: 0,
      colEnd: colIndex,
      rowEnd: height - 1
    });
  } else {
    const rowIndex = rowNum - 1;
    return asSingleRange.slice({
      colStart: 0,
      rowStart: rowIndex,
      colEnd: width - 1,
      rowEnd: rowIndex
    });
  }
}

/**
 * @summary Returns the reference specified by a text string
 * @param refText is a reference to a cell that contains an A1- or R1C1-style reference, a name defined as a reference, or a reference to a cell as a text string
 * @param a1 is a logical value that specifies the type of reference in Ref_text: R1C1-style = FALSE; A1-style = TRUE.
 */
export function INDIRECT(refText: string, a1: boolean=true): IReferenceRange {
  return FormulaContext.getReference(refText, !a1);
}

/**
 * @hidden Unimplemented
 * @summary Looks up a value either from a one-row or one-column range or from an array. Provided for backward compatibility
 * @param lookupValue is a value that LOOKUP searches for in Lookup_vector and can be a number, text, a logical value, or a name or reference to a value
 * @param lookupVector is a range that contains only one row or one column of text, numbers, or logical values, placed in ascending order
 * @param resultVector is a range that contains only one row or column, the same size as Lookup_vector
 */
export function LOOKUP(
  lookupValue: Scalar,
  lookupVector: IRange,
  resultVector: IRange
): any {
  // legacy
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the relative position of an item in an array that matches a specified value in a specified order
 * @param lookupValue is the value you use to find the value you want in the array, a number, text, or logical value, or a reference to one of these
 * @param lookupArray is a contiguous range of cells containing possible lookup values, an array of values, or a reference to an array
 * @param matchType is a number 1, 0, or -1 indicating which value to return.
 */
export function MATCH(
  lookupValue: Scalar,
  lookupArray: number[][], //IRange with number
  matchType: number
): number {
  // matchType -1, 0, 1
  return undefined;
}

/**
 * @summary Returns a reference to a range that is a given number of rows and columns from a given reference
 * @param reference is the reference from which you want to base the offset, a reference to a cell or range of adjacent cells
 * @param rows is the number of rows, up or down, that you want the upper-left cell of the result to refer to
 * @param cols is the number of columns, to the left or right, that you want the upper-left cell of the result to refer to
 * @param height is the height, in number of rows, that you want the result to be, the same height as Reference if omitted
 * @param width is the width, in number of columns, that you want the result to be, the same width as Reference if omitted
 */
export function OFFSET(
  reference: IReferenceRange,
  rows: number,
  cols: number,
  height?: number,
  width?: number
): IReferenceRange {
  height = height ?? reference.getHeight();
  width = width ?? reference.getWidth();
  if (width < 0) throw FormulaError.BuiltIn.Ref;
  if (height < 0) throw FormulaError.BuiltIn.Ref;

  const refCoords = reference.getCoords();
  const offsetCoords = {
    rowStart: refCoords.rowStart + rows,
    colStart: refCoords.colStart + cols,
    rowEnd: refCoords.rowStart + rows + height - 1,
    colEnd: refCoords.colStart + cols + width - 1
  };
  return FormulaContext.getReference(offsetCoords);
}

/**
 * @hidden Unimplemented
 */
export function PIVOTBY(
  rowFields: IReferenceRange,
  colFields: IReferenceRange,
  values: IRange[],
  fn: any[], // Wow, this is a lambda function
  fieldHeaders: number=null, // 0-no, 1-yes, 2-no but generate, 3-yes and show
  rowTotalDepth: number=2, // 0-no totals, 1-grand totals, 2-grand and subtotals, -1-grand totals at top, -2 grand and sub totals at top
  rowSortOrder: any[]=null, // <0, >0
  colTotalDepth: number=2, // 0-no totals, 1-grand totals, 2-grand and subtotals, -1-grand totals at top, -2 grand and sub totals at top
  colSortOrder: any[]=null, // <0, >0
  filterArray: boolean[]=null,
  relativeTo: number=0
): number {
  // matchType -1, 0, 1
  return undefined;
}

/**
 * @summary Returns the row number of a reference
 * @param reference is the cell or a single range of cells for which you want the row number; if omitted, returns the cell containing the ROW function
 */
export function ROW(reference?: IReferenceRange): number[] {
  if (!reference) {
    return [FormulaContext.getPosition().rowIndex + 1];
  }

  const retValue = [];
  const coords = reference.getCoords();
  const coordsRowStart = coords.rowStart;
  const coordsRowEnd = coords.rowEnd;
  for (let j=coordsRowStart; j<=coordsRowEnd; j++) {
    retValue.push([j+1]); // as rows
  }
  return retValue;
}

/**
 * @summary Returns the number of rows in a reference or array
 * @param array is an array, an array formula, or a reference to a range of cells for which you want the number of rows
 */
export function ROWS(array: IRange): number {
  return array.getHeight();
}

/**
 * @hidden Unimplemented
 * @summary Retrieves the real-time data (RTD) from a program that supports COM automation
 * @param progId is the programmatic identifier (ProgID) of a registered COM automation add-in. Enclose the id in quotation marks
 * @param server is the name of the server that provides the real-time data. If running locally us an empty string
 * @param topic topic1,topic2,... are 1 to 38 parameters that specify a piece of data
 */
export function RTD(progId: string, server?: string, ...topic: string[]): any {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Sorts a range or array
 * @param array the range or array to sort
 * @param sortIndex a number indicating the row or column to sort by
 * @param sortOrder a number indicating the desired sort order; 1 for ascending order (default), -1 for descending order
 * @param byCol a logical value indicating the desired sort direction: FALSE to sort by row (default), TRUE to sort by column
 */
export function SORT(
  array: IRange,
  sortIndex?: number[],
  sortOrder?: number[],
  byCol: boolean=false
): IRange {
  return undefined;
}

// a repeating pair of params
/**
 * @hidden Unimplemented
 * @summary Sorts a range or array based on the values in a corresponding range or array
 * @param array the range or array to sort
 * @param byArray1 by_array1,by_array2,... the range or array to sort on
 * @param sortOrder sort_order1,sort_order2,... a number indicating the desired sort order; 1 for ascending order (default), -1 for descending order
 */
export function SORTBY(
  array: IRange,
  byArray1: IRange,
  sortOrder?: number[]
): IRange {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns rows or columns from array start or end.
 * @param array The array from which to take rows or columns.
 * @param rows The number of rows to take. A negative value takes from the end of the array.
 * @param columns The number of columns to take. A negative value takes from the end of the array.
 */
export function TAKE(
  array: IRange,
  rows: number, columns: number=0
): IRange {
  // supports negative values
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the array as one column.
 * @param array The array or reference to return as a column.
 * @param {'0 - Keep all values' | '1 - Ignore Blanks' | '2 - Ignore Errors' | '3 - Ignore Blanks and Errors'} ignore Whether to ignore certain types of values. By default, no values are ignored.
 * @param scanByColumn Scan the array by column. By default, the array is scanned by row.
 */
export function TOCOL(
  array: IRange,
  ignore: number=0,
  scanByColumn: boolean=false
): IRange {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the array as one row.
 * @param array The array or reference to return as a column.
 * @param {'0 - Keep all values' | '1 - Ignore Blanks' | '2 - Ignore Errors' | '3 - Ignore Blanks and Errors'} ignore Whether to ignore certain types of values. By default, no values are ignored.
 * @param scanByColumn Scan the array by column. By default, the array is scanned by row.
 */
export function TOROW(
  array: IRange,
  ignore: number=0,
  scanByColumn: boolean=false
): IRange {
  return undefined;
}

/**
 * @summary Converts a vertical range of cells to a horizontal range, or vice versa
 * @param array is a range of cells on a worksheet or an array of values that you want to transpose
 */
export function TRANSPOSE(array: IRange): IRange {
  return array.transpose();
}

/**
 * @summary Trims a range to the last used cell in any direction.
 * @param range The range to be trimmed
 * @param rowTrimMode Row trim direction. 0 - none, 1 - leading, 2 - trailing, 3 - both.
 * @param colTrimMode Column trim direction. 0 - none. 1 - leading, 2 - trailing, 3 - both.
 */
export function TRIMRANGE(
  range: IRange,
  rowTrimMode: number=3,
  colTrimMode: number=3
): IRange {
  let rowStart = 0;
  let rowEnd = range.getHeight() - 1;
  let colStart = 0;
  let colEnd = range.getWidth() - 1;

  const isReference = (range as IReferenceRange).isIReferenceRange;
  if (isReference) {
    const coords = (range as IReferenceRange).getCoords();
    rowStart = coords.rowStart;
    rowEnd = coords.rowEnd;
    colStart = coords.colStart;
    colEnd = coords.colEnd;
  } else {
    rowStart = 0;
    rowEnd = range.getHeight() - 1;
    colStart = 0;
    colEnd = range.getWidth() - 1;
  }

  if (rowTrimMode === 1 || rowTrimMode === 3) { // row leading
    const start: IRange.Entry = range.entries({ orientation: IRange.Orientation.Row }).next().value;
    if (!start) return FormulaError.BuiltIn.Ref as any; // empty
    rowStart = start.coords.rowIndex;
  }
  if (rowTrimMode === 2 || rowTrimMode === 3) { // row trailing
    const end: IRange.Entry = range.entries({ reverse: true, orientation: IRange.Orientation.Row }).next().value;
    if (!end) return FormulaError.BuiltIn.Ref as any; // empty
    rowEnd = end.coords.rowIndex;
  }

  if (colTrimMode === 1 || colTrimMode === 3) { // col leading
    const start: IRange.Entry = range.entries({ orientation: IRange.Orientation.Column }).next().value;
    if (!start) return FormulaError.BuiltIn.Ref as any; // empty
    colStart = start.coords.colIndex;
  }
  if (colTrimMode === 2 || colTrimMode === 3) { // col trailing
    const end: IRange.Entry = range.entries({ reverse: true, orientation: IRange.Orientation.Column }).next().value;
    if (!end) return FormulaError.BuiltIn.Ref as any; // empty
    colEnd = end.coords.colIndex;
  }

  let retValue:IRange = undefined;
  if (isReference) {
    return FormulaContext.getReference({
      colStart,
      rowStart,
      colEnd,
      rowEnd
    });
  } else {
    retValue = range.slice({
      colStart,
      rowStart,
      rowEnd,
      colEnd
    });
  }
  return retValue;
}

/**
 * @hidden Unimplemented
 * @summary Returns the unique values from a range or array.
 * @param array the range or array from which to return unique rows or columns
 * @param byCol is a logical value: compare rows against each other and return the unique rows = FALSE; compare columns against each other and return the unique columns = TRUE
 * @param exactlyOnce is a logical value: return rows or columns that occur exactly once from the array = TRUE; return all distinct rows or columns from the array = FALSE
 */
export function UNIQUE(
  array: IRange,
  byCol: boolean=false,
  exactlyOnce: boolean=false
): IRange {
  return undefined;
}

/**
 * @summary Looks for a value in the leftmost column of a table, and then returns a value in the same row from a column you specify. By default, the table must be sorted in an ascending order
 * @param lookupValue is the value to be found in the first column of the table, and can be a value, a reference, or a text string
 * @param tableArray is a table of text, numbers, or logical values, in which data is retrieved. Table_array can be a reference to a range or a range name
 * @param colIndexNum is the column number in table_array from which the matching value should be returned. The first column of values in the table is column 1
 * @param rangeLookup is a logical value: to find the closest match in the first column (sorted in ascending order) = TRUE; find an exact match = FALSE
 */
export function VLOOKUP(
  lookupValue: Scalar,
  tableArray: IRange,
  colIndexNum: number,
  rangeLookup: boolean=true
): Scalar {
  // check if colIndexNum out of bound
  if (colIndexNum < 1) return FormulaError.BuiltIn.Value;
  if (colIndexNum > tableArray.getWidth()) return FormulaError.BuiltIn.Ref;
  if (tableArray.size === 1) return FormulaError.BuiltIn.NA;

  //TODO - this is causing huge performance issues move to range search.
  const asArray = tableArray.getValues();
  const lookupType = typeof lookupValue; // 'number', 'string', 'boolean'

  const asString = typeof lookupValue === 'string' ? lookupValue : String(lookupValue);
  const isWildCard = WildCard.isWildCard(asString);
  const asWildCard = isWildCard ? WildCard.toRegex(asString, 'i') : null;

  // approximate lookup (assume the array is sorted)
  if (rangeLookup) {
    let prevValue = lookupType === typeof asArray[0][0] ? asArray[0][0] : null;

    const asArrayLength = asArray.length;
    for (let i=1; i<asArrayLength; i++) {
      const currRow = asArray[i];
      const currValue = asArray[i][0];
      const type = typeof currValue;
      // skip the value if type does not match
      if (type !== lookupType)
        continue;
      // if the previous two values are greater than lookup value, throw #N/A
      if (prevValue > lookupValue && currValue > lookupValue) {
        throw FormulaError.BuiltIn.NA;
      }
      if (currValue === lookupValue)
        return currRow[colIndexNum - 1];
      // if previous value <= lookup value and current value > lookup value
      if (prevValue != null && currValue > lookupValue && prevValue <= lookupValue) {
        return asArray[i - 1][colIndexNum - 1];
      }
      prevValue = currValue;
    }
    if (prevValue === null)
      throw FormulaError.BuiltIn.NA;
    if (asArray.length === 1) {
      return asArray[0][colIndexNum - 1]
    }
    return prevValue;
  }
  // exact lookup with wildcard support
  else {
    let index = -1;
    if (isWildCard) {
      index = asArray.findIndex(currRow => {
        return asWildCard.test(currRow[0] as string);
      });
    } else {
      index = asArray.findIndex(currRow => {
        return currRow[0] === lookupValue;
      });
    }
    // the exact match is not found
    if (index === -1) throw FormulaError.BuiltIn.NA;
    return asArray[index][colIndexNum - 1];
  }
}

/**
 * @hidden Unimplemented
 * @summary Vertically stacks arrays into one array.
 * @param array1 array1,array2,... An array or reference to be stacked.
 * @param array array1,array2,... An array or reference to be stacked.
 */
export function VSTACK(
  array1: IRange,
  ...array: IRange[]
): IRange {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Wraps a row or column vector after a specified number of values.
 * @param vector The vector or reference to wrap.
 * @param wrapCount The maximum number of values per column.
 * @param padWith The value with which to pad. The default is #N/A.
 */
export function WRAPCOLS(
  vector: IRange,
  wrapCount: number,
  padWith: Scalar=FormulaError.BuiltIn.NA
): IRange {
  // TODO - if more than one dimension then error.
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Wraps a row or column vector after a specified number of values.
 * @param vector The vector or reference to wrap.
 * @param wrapCount The maximum number of values per column.
 * @param padWith The value with which to pad. The default is #N/A.
 */
export function WRAPROWS(
  vector: IRange,
  wrapCount: number,
  padWith: Scalar=FormulaError.BuiltIn.NA
): IRange {
  // TODO - if more than one dimension then error.
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Searches a range or an array for a match and returns the corresponding item from a second range or array. By default, an exact match is used
 * @param lookupValue is the value to search for
 * @param lookupArray is the array or range to search
 * @param returnArray is the array or range to return
 * @param ifNotFound returned if no match is found
 * @param matchMode specify how to match lookup_value against the values in lookup_array
 * @param searchMode specify the search mode to use. By default, a first to last search will be used
 */
export function XLOOKUP(
  lookupValue: Scalar,
  lookupArray: IRange,
  returnArray: IRange,
  ifNotFound: Scalar,
  rangeLookup: boolean=true,
  matchMode: boolean,
  searchMode: boolean=true
): Scalar {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the relative position of an item in an array. By default, an exact match is required
 * @param lookupValue is the value to search for
 * @param lookupArray is the array or range to search
 * @param matchMode specify how to match the lookup_value against the values in lookup_array
 * @param searchMode specify the search mode to use. By default, a first to last search will be used
 */
export function XMATCH(
  lookupValue: Scalar,
  lookupArray: IRange,
  matchMode: boolean,
  searchMode: boolean=true
): Scalar {
  return undefined;
}