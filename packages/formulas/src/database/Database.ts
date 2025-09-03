/* cspell: disable */
import { IRange } from '@sheetxl/primitives';

// https://github.com/formulajs/formulajs/blob/master/src/database.js
// TODO - formula.js has these! woot.

/**
 * @hidden Unimplemented
 * @summary Averages the values in a column in a list or database that match conditions you specify
 * @param database is the range of cells that makes up the list or database. A database is a list of related data
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition
 */
export function DAVERAGE(
  database: IRange,
  field: string,
  criteria: IRange<string> // validate
): Promise<IRange> {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Counts the cells containing numbers in the field (column) of records in the database that match the conditions you specify
 * @param database is the range of cells that makes up the list or database. A database is a list of related data
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition
 */
export function DCOUNT(
  database: IRange,
  field: string,
  criteria: IRange<string> // validate
): Promise<IRange> {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Counts nonblank cells in the field (column) of records in the database that match the conditions you specify
 * @param database is the range of cells that makes up the list or database. A database is a list of related data
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition
 */
export function DCOUNTA(
  database: IRange,
  field: string,
  criteria: IRange<string> // validate
): Promise<IRange> {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Extracts from a database a single record that matches the conditions you specify
 * @param database is the range of cells that makes up the list or database. A database is a list of related data
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition
 */
export function DGET(
  database: IRange,
  field: string,
  criteria: IRange<string> // validate
): Promise<IRange> {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the largest number in the field (column) of records in the database that match the conditions you specify
 * @param database is the range of cells that makes up the list or database. A database is a list of related data
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition
 */
export function DMAX(
  database: IRange,
  field: string,
  criteria: IRange<string> // validate
): Promise<IRange> {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the smallest number in the field (column) of records in the database that match the conditions you specify
 * @param database is the range of cells that makes up the list or database. A database is a list of related data
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition
 */
export function DMIN(
  database: IRange,
  field: string,
  criteria: IRange<string> // validate
): Promise<IRange> {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Multiplies the values in the field (column) of records in the database that match the conditions you specify
 * @param database is the range of cells that makes up the list or database. A database is a list of related data
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition
 */
export function DPRODUCT(
  database: IRange,
  field: string,
  criteria: IRange<string> // validate
): Promise<IRange> {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Estimates the standard deviation based on a sample from selected database entries
 * @param database is the range of cells that makes up the list or database. A database is a list of related data
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition
 */
export function DSTDEV(
  database: IRange,
  field: string,
  criteria: IRange<string> // validate
): Promise<IRange> {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Calculates the standard deviation based on the entire population of selected database entries
 * @param database is the range of cells that makes up the list or database. A database is a list of related data
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition
 */
export function DSTDEVP(
  database: IRange,
  field: string,
  criteria: IRange<string> // validate
): Promise<IRange> {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Adds the numbers in the field (column) of records in the database that match the conditions you specify
 * @param database is the range of cells that makes up the list or database. A database is a list of related data
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition
 */
export function DSUM(
  database: IRange,
  field: string,
  criteria: IRange<string> // validate
): Promise<IRange> {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Estimates variance based on a sample from selected database entries
 * @param database is the range of cells that makes up the list or database. A database is a list of related data
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition
 */
export function DVAR(
  database: IRange,
  field: string,
  criteria: IRange<string> // validate
): Promise<IRange> {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Calculates variance based on the entire population of selected database entries
 * @param database is the range of cells that makes up the list or database. A database is a list of related data
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition
 */
export function DVARP(
  database: IRange,
  field: string,
  criteria: IRange<string> // validate
): Promise<IRange> {
  return undefined;
}