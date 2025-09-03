import type { Scalar } from './Scalar';
import type { IRange } from './IRange';
import type { IReferenceRange } from './IReferenceRange';
import type { IFunction } from './IFunction';
import type { IRuntime } from './IRuntime';

/**
 * Provides the context for formula evaluation functions.
 */
export interface IFormulaContext {
  /**
   * Return the current location in the sheet.
   */
  getPosition(): Readonly<IRange.CellCoords>;

  /**
   * Create a range from a materialized 2D array.
   *
   * @param value The value to create a range from. This can be a single value or a 2D array.
   * @param isLiteral If `true`, the range will be treated as a literal value.
   * @returns An IRange representing the value.
   */
  getRange(value: Scalar | Scalar[][], isLiteral?: boolean): IRange;

  /**
   * Retrieves a value from the sheet.
   *
   * @param row The row where the value is located.
   * @param column The column where the value is located.
   * @returns The value at the specified row and column, or `null` if no value exists.
   */
  // TODO - coerce options?
  getValueAt(row: number, column: number): Scalar | null;

  /**
   * Returns a spill reference at a location if it exists.
   *
   * @param row The row where the spill starts.
   * @param column The column where the spill starts.
   * @returns An IReferenceRange if a spill exists at the location, otherwise `null`.
   */
  getSpillAt(row: number, column: number): IReferenceRange | null;

  /**
   * Used for functions that return RangeReferences such as
   * INDIRECT and OFFSET and SUMIF.
   *
   * @param coords The coordinates or a string of the range to get.
   * @param r1c1 If `true`, the coordinates are in R1C1 format.
   * @returns An IReferenceRange representing the range.
   * @throws Error #REF! if unable to parse the range.
   *
   * @remarks
   * * **PERFORMANCE**
   *   Calling this method wil create a dynamic dependency on this range if not in the original inputs.
   * * It is recommended to use this sparingly.
   * * If coords is a string it will be parsed but named references are not supported.
   */
  getReference(
    coords: Readonly<IRange.Coords> | string,
    r1c1?: boolean
  ): IReferenceRange<any>;

  /**
   * Returns a formatted value using the number formatting rules.
   *
   * @param formatText The format to apply to the value.
   * @param value The value to format.
   * @returns A formatted string of the value.
   */
  getNumberFormat(formatText: string, value: Scalar): string | null;

  /**
   * Returns the entire range of the sheet useful for validating range is to large.
   */
  getEntireCoords(): IRange.Coords;

  /**
   * Returns a formula string or null if no formula exists.
   *
   * @param row The row where the formula is located.
   * @param column The column where the formula is located.
   * @returns The formula string at the specified row and column, or `null` if no formula exists.
   */
  getFormulaAt(row: number, column: number): string | null;

  /**
   * Returns a formula string or null if no formula exists.
   *
   * @param sheetName The name of the sheet. If not provided the current sheet is used.
   * @returns -1 if the sheet does not exist.
   */
  getSheetIndex(sheetName?: string): number;

  /**
   * Returns the number of sheets in the workbook.
   */
  getSheetCount(): number | null;

  /**
   * Calling this will mark the function as volatile.
   *
   * @remarks
   * * Volatile functions will be re-evaluated on the next calculation.
   * * Functions may also be statically marked as volatile in the engine.
   */
  markVolatile(): void;

  /**
   * Provide a hint to the UI to format the return results.
   *
   * @param numFmt The number format to apply to the results.
   *
   * @remarks
   * * The UI will generally only format results if the user has not already formatted the area.
   * * If a range is returned all values will be formatted with the same format.
   */
  formatResults(numFmt: string): void;

  /**
   * Returns the address of the current sheet.
   *
   * @param coords The coordinates to get the address for. If not provided the current position is used.
   * @param r1c1 If `true`, the address will be in R1C1 format. Default is `false` (A1 format).
   */
  getAddress(coords?: Readonly<IRange.FixableCoords | IRange.FixableCellCoords>, r1c1?: boolean): string;

  /**
   * Returns `true` if the value is a valid date.
   *
   * @param value Any value to check.
   */
  isValidDate(value: any): boolean;

  /**
   * Parsed text as a date and time.
   *
   * @param text The text to parse as a date and time.
   * @param requireDate If `true`, the text must contain a date component.
   * @returns The OADate value or null if the text could not be parsed.
   */
  parseAsDateTime(text: string, requireDate?: boolean): number | null;

  /**
   * Returns a date from an OADate value. This is used for date calculations.
   *
   * @param oaDate A serialized date as a number.
   */
  fromOADate(oaDate: number): Date;

  /**
   * Returns an OADate value from a date. This is used for date calculations.
   *
   * @param date A date as a javascript object.
   */
  toOADate(date: Date): number;

  /**
   * Returns a function.
   *
   * @param name The name of the function.
   *
   * @remarks
   * Case-insensitive
   */
  getFunction(name: string): IFunction | null;

  /**
   * For introspecting the current runtime.
   *
   * @remarks
   * This is generally used for debugging but the built-in `INFO` function also makes use of this.
   */
  getRuntime(): IRuntime;

  // getPrecedents(): string[]; // TODO - this should ICellRange.Coords[]

  // /**
  //  * Checks the rows and columns to see if the spill is valid for bounds
  //  * @param rows The number of rows to spill.
  //  * @param columns The number of columns to spill.
  //  *
  //  * @remarks
  //  * * A row of 1 and column of 1 will be a single cell.
  //  * * Validate the spill will not out of bounds not that other data is in the way.
  //  * * The engine performs this validation it is available to validate early.
  //  */
  // validateSpillBounds(rows: number, columns: number): void;
}

