/* cspell: disable */
import {
  FormulaContext, FormulaError, type AcceptError, type NoLift, type Omittable, type Scalar, type IRange, type IReferenceRange
} from '@sheetxl/primitives';

import { round15 } from '../_utils/Arithmetic';

/**
 * Averages the values in a column in a list or database that match conditions you specify.
 * @param database is the range of cells that makes up the list or database. A database is a list of related data.
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition.
 */
export function DAVERAGE(
  database: AcceptError<IReferenceRange>,
  field: NoLift<AcceptError<Scalar>>,
  criteria: AcceptError<IRange>
): Scalar { // number
  const matched = dbMatchNumeric(database, field, criteria);
  if (FormulaError.isError(matched)) return matched;
  const avg = matched.getStats().getAggregates().average;
  if (avg === null || avg === undefined) throw FormulaError.BuiltIn.Div0!;
  return avg;
}

/**
 * Counts the cells containing numbers in the field (column) of records in the database that match the conditions you specify.
 * @param database is the range of cells that makes up the list or database. A database is a list of related data.
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition.
 */
export function DCOUNT(
  database: AcceptError<IReferenceRange>,
  field: NoLift<Omittable<AcceptError<Scalar>>>,
  criteria: AcceptError<IRange>
): Scalar { // number
  if (field === undefined) return countRecords(database, criteria);
  const m = dbMatch(database, field, criteria);
  if (FormulaError.isError(m)) return m;
  return m.getStats().getAggregates().numericalCount ?? 0;
}

/**
 * Counts nonblank cells in the field (column) of records in the database that match the conditions you specify.
 * @param database is the range of cells that makes up the list or database. A database is a list of related data.
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition.
 */
export function DCOUNTA(
  database: AcceptError<IReferenceRange>,
  field: NoLift<Omittable<AcceptError<Scalar>>>,
  criteria: AcceptError<IRange>
): Scalar { // number
  if (field === undefined) return countRecords(database, criteria);
  const m = dbMatch(database, field, criteria);
  if (FormulaError.isError(m)) return m;
  return m.getStats().getAggregates().count ?? 0;
}

/**
 * Extracts from a database a single record that matches the conditions you specify.
 * @param database is the range of cells that makes up the list or database. A database is a list of related data.
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition.
 */
export function DGET(
  database: AcceptError<IReferenceRange>,
  field: NoLift<AcceptError<Scalar>>,
  criteria: AcceptError<IRange>
): Scalar { // number
  const matched = dbMatch(database, field, criteria); // DGET returns the member as-is, error included
  if (FormulaError.isError(matched)) return matched;
  const { rows } = matched.getShape();
  if (rows === 0) return FormulaError.BuiltIn.Value!;
  if (rows > 1) return FormulaError.BuiltIn.Num!;
  return matched.getValueAt(0, 0);
}

/**
 * Returns the largest number in the field (column) of records in the database that match the conditions you specify.
 * @param database is the range of cells that makes up the list or database. A database is a list of related data.
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition.
 */
export function DMAX(
  database: AcceptError<IReferenceRange>,
  field: NoLift<AcceptError<Scalar>>,
  criteria: AcceptError<IRange>
): Scalar { // number
  const matched = dbMatchNumeric(database, field, criteria);
  if (FormulaError.isError(matched)) return matched;
  return matched.getStats().getAggregates().max ?? 0;
}

/**
 * Returns the smallest number in the field (column) of records in the database that match the conditions you specify.
 * @param database is the range of cells that makes up the list or database. A database is a list of related data.
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition.
 */
export function DMIN(
  database: AcceptError<IReferenceRange>,
  field: NoLift<AcceptError<Scalar>>,
  criteria: AcceptError<IRange>
): Scalar { // number
  const matched = dbMatchNumeric(database, field, criteria);
  if (FormulaError.isError(matched)) return matched;
  return matched.getStats().getAggregates().min ?? 0;
}

/**
 * Multiplies the values in the field (column) of records in the database that match the conditions you specify.
 * @param database is the range of cells that makes up the list or database. A database is a list of related data.
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition.
 */
export function DPRODUCT(
  database: AcceptError<IReferenceRange>,
  field: NoLift<AcceptError<Scalar>>,
  criteria: AcceptError<IRange>
): Scalar { // number
  const matched = dbMatchNumeric(database, field, criteria);
  if (FormulaError.isError(matched)) return matched;
  let product = 1;
  let found = false;
  matched.forEach((v: Scalar) => {
    if (typeof v === 'number') { product *= v; found = true; }
  });
  return found ? product : 0;
}

/**
 * Estimates the standard deviation based on a sample from selected database entries.
 * @param database is the range of cells that makes up the list or database. A database is a list of related data.
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition.
 */
export function DSTDEV(
  database: AcceptError<IReferenceRange>,
  field: NoLift<AcceptError<Scalar>>,
  criteria: AcceptError<IRange>
): Scalar { // number
  const matched = dbMatchNumeric(database, field, criteria);
  if (FormulaError.isError(matched)) return matched;
  const agg = matched.getStats().getAggregates();
  if ((agg.numericalCount ?? 0) < 2) return FormulaError.BuiltIn.Div0!;
  return agg.stdDev ?? 0;
}

/**
 * Calculates the standard deviation based on the entire population of selected database entries.
 * @param database is the range of cells that makes up the list or database. A database is a list of related data.
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition.
 */
export function DSTDEVP(
  database: AcceptError<IReferenceRange>,
  field: NoLift<AcceptError<Scalar>>,
  criteria: AcceptError<IRange>
): Scalar { // number
  const matched = dbMatchNumeric(database, field, criteria);
  if (FormulaError.isError(matched)) return matched;
  const agg = matched.getStats().getAggregates();
  if (!agg.numericalCount) return FormulaError.BuiltIn.Div0!;
  return agg.stdDevP ?? 0;
}

/**
 * Adds the numbers in the field (column) of records in the database that match the conditions you specify.
 * @param database is the range of cells that makes up the list or database. A database is a list of related data.
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition.
 */
export function DSUM(
  database: AcceptError<IReferenceRange>,
  field: NoLift<AcceptError<Scalar>>,
  criteria: AcceptError<IRange>
): Scalar { // number
  const matched = dbMatchNumeric(database, field, criteria);
  if (FormulaError.isError(matched)) return matched;
  return matched.getStats().getAggregates().sum ?? 0;
}

/**
 * Estimates variance based on a sample from selected database entries.
 * @param database is the range of cells that makes up the list or database. A database is a list of related data.
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition.
 */
export function DVAR(
  database: AcceptError<IReferenceRange>,
  field: NoLift<AcceptError<Scalar>>,
  criteria: AcceptError<IRange>
): Scalar { // number
  const matched = dbMatchNumeric(database, field, criteria);
  if (FormulaError.isError(matched)) return matched;
  const agg = matched.getStats().getAggregates();
  if ((agg.numericalCount ?? 0) < 2) return FormulaError.BuiltIn.Div0!;
  return agg.var ?? 0;
}

/**
 * Calculates variance based on the entire population of selected database entries.
 * @param database is the range of cells that makes up the list or database. A database is a list of related data.
 * @param field is either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param criteria is the range of cells that contains the conditions you specify. The range includes a column label and one cell below the label for a condition.
 */
export function DVARP(
  database: AcceptError<IReferenceRange>,
  field: NoLift<AcceptError<Scalar>>,
  criteria: AcceptError<IRange>
): Scalar { // number
  const matched = dbMatchNumeric(database, field, criteria);
  if (FormulaError.isError(matched)) return matched;
  const agg = matched.getStats().getAggregates();
  if (!agg.numericalCount) return FormulaError.BuiltIn.Div0!;
  return agg.varP ?? 0;
}

// Utils

/**
 * The error the three arguments fault with, in ARGUMENT order, or `null`.
 *
 * @remarks
 * All three slots take `AcceptError`, so nothing faults at the marshaller and the reading order is
 * this function's: `DSUM(db,NA(),1/0)` is #N/A and `DSUM(db,1/0,NA())` is #DIV/0!. The
 * marker is not here to own that order — it is here because the `field` slot needs an error as a
 * VALUE, and restoring the order the engine would have given is the price of asking for that.
 *
 * The `field` slot is why: an error read out of a CELL is not a header name and is `#VALUE!`
 * (`DSUM(db,H5,crit)` over #N/A), where an error typed into the call propagates
 * (`DSUM(db,NA(),crit)` is #N/A). Only the argument's KIND separates them — a one-cell reference
 * reports `Reference` however it dereferenced.
 */
function readFault(
  database: IRange,
  field: Scalar | undefined,
  criteria: IRange
): FormulaError.Known | null {
  if (FormulaError.isError(database)) return database;
  if (FormulaError.isError(field)) {
    return FormulaContext.getArgs().isDirectAt(1) ? field : FormulaError.BuiltIn.Value!;
  }
  if (FormulaError.isError(criteria)) return criteria;
  return null;
}

/**
 * The matched column of the database, or the error the arguments fault with.
 *
 * @remarks
 * The order is SHAPE, then the field, then the criteria. Both range arguments want at least
 * TWO rows — a header row over data, and a header row over conditions — and one row of either is
 * `#VALUE!` rather than an empty answer: `DSUM(<headers only>,"Yield",crit)` and
 * `DSUM(db,"Yield",<a header with nothing under it>)` are both `#VALUE!`, and so is a scalar or a
 * single cell at either slot.
 */
function dbMatch(
  database: IRange,
  field: Scalar,
  criteria: IRange
): IRange | FormulaError.Known {
  const fault = readFault(database, field, criteria);
  if (fault) return fault;

  if (database.getShape().rows < 2 || criteria.getShape().rows < 2) return FormulaError.BuiltIn.Value!;

  // The field is ONE value — a header by name or a 1-based column number. The slot is
  // `NoLift<...>`, so a multi-cell REFERENCE is `#VALUE!` before the body runs and an array
  // constant arrives here one member at a time.
  const colIdx = resolveFieldIndex(database, field as Scalar);
  if (colIdx < 0) return FormulaError.BuiltIn.Value!;

  return database
    .take(matchingRows(database, criteria))
    .slice({ colStart: colIdx, colEnd: colIdx });
}

/**
 * The numeric family is SELECTIVE: an error in a MATCHED row propagates (DSUM → #N/A) while
 * an error in an unmatched row is invisible — so the scan runs over the matched slice, in-body,
 * over the database the engine handed over whole. DCOUNT/DCOUNTA keep count semantics instead
 * (0 / 1 over a matched error); DGET returns the member as-is.
 */
function dbMatchNumeric(
  database: IRange,
  field: Scalar,
  criteria: IRange
): IRange | FormulaError.Known {
  const matched = dbMatch(database, field, criteria);
  if (FormulaError.isError(matched)) return matched;
  if (matched.hasError()) return matched.firstError()!;
  return matched;
}

/**
 * The count of matching RECORDS — what `DCOUNT` and `DCOUNTA` answer when `field` is OMITTED.
 *
 * @remarks
 * `DCOUNT(db,,crit)` is the number of rows the criteria selects, not a count taken over every
 * column of them: over three matching rows of a four-column database with three numeric columns
 * both names answer 3, where a column-wise reading would be 9 and 12. They are the only two of the
 * twelve that accept the omission at all — the other ten are `#VALUE!` — and it is the OMISSION
 * specifically: a blank CELL at the same slot is `#VALUE!` for all twelve.
 */
function countRecords(
  database: IRange,
  criteria: IRange
): Scalar {
  const fault = readFault(database, undefined, criteria);
  if (fault) return fault;
  if (database.getShape().rows < 2 || criteria.getShape().rows < 2) return FormulaError.BuiltIn.Value!;
  return matchingRows(database, criteria).length;
}

/**
 * The index of the first column whose HEADER is `value`, or -1.
 *
 * @remarks
 * A header matches by VALUE, comparing text case-insensitively and NOT trimming it:
 * `DSUM(db,"yield",…)` reads the `Yield` column and `DSUM(db," Yield ",…)` is `#VALUE!`. The
 * padding rule is the one that is easy to get backwards, and it holds in both directions —
 * over a database whose two headers are `" Yield "` and `"YIELD"`, the field `"YIELD"` reads the
 * SECOND column.
 *
 * The first match wins when two columns share a header.
 */
function matchHeaderIndex(
  database: IRange,
  value: Scalar
): number {
  const { columns } = database.getShape();
  const wanted = typeof value === 'string' ? value.toUpperCase() : value;
  for (let col = 0; col < columns; col++) {
    const header = database.getValueAt(0, col);
    if (typeof wanted === 'string') {
      if (typeof header === 'string' && header.toUpperCase() === wanted) return col;
    } else if (header === wanted && header !== null && header !== undefined) {
      return col;
    }
  }
  return -1;
}

/**
 * The `field` argument as a 0-based column index into the database, or -1 when it names nothing.
 *
 * @remarks
 * The slot takes two unrelated kinds of value and the split is on TYPE, not on what resolves:
 * a NUMBER is a 1-based column position and a string is a header name, so `3` reads the third
 * column of a database whose headers are text and `"3"` is `#VALUE!` because no column is called
 * that. `TRUE` is the number 1 and `FALSE` is therefore 0, which is out of range.
 *
 * The position is read at fifteen significant digits before it is truncated —
 * `DSUM(db,0.0003*10000,crit)` reads column 3, where the raw double 2.9999999999999996 would name
 * column 2. Only the CRITERIA table's headers are exempt from the numeric reading altogether: a
 * criteria header of `1` matches a column headed by the number 1 and never column 1.
 */
function resolveFieldIndex(
  database: IRange,
  field: Scalar
): number {
  const { columns } = database.getShape();

  if (typeof field === 'boolean') field = field ? 1 : 0; // TRUE reads as column 1
  if (typeof field === 'number') {
    const idx = Math.trunc(round15(field)) - 1; // 1-based -> 0-based
    if (idx < 0 || idx >= columns) return -1;
    return idx;
  }

  if (typeof field === 'string') return matchHeaderIndex(database, field);

  return -1;
}

/**
 * The criteria table compiled to one predicate list per condition ROW: `null` for a row that can
 * never match, otherwise the pairs that all have to hold.
 *
 * @remarks
 * Criteria row 0 is headers and rows 1+ are OR'd condition rows; within a row every column is
 * AND'd. Three rules, all about a piece that is MISSING:
 *
 * * a BLANK condition cell is no constraint, so a wholly blank condition row matches every record
 *   — and because the rows are OR'd, one blank row anywhere makes the whole table match
 *   everything;
 * * a header that names no column of the database KILLS its condition row when there is a
 *   criterion under it (`Zzz`/`Apple` selects nothing, even beside a `Tree`/`Apple` column that
 *   would have matched) and is IGNORED when the cell under it is blank, which is what lets a
 *   criteria table be wider than the database;
 * * a header that is blank, or an error, names no column either, so it takes the same path.
 */
function buildCriteriaRows(
  database: IRange,
  criteria: IRange
): Array<Array<{ dbColIndex: number; evaluator: (v: Scalar) => boolean }> | null> {
  const { rows: cRows, columns: cCols } = criteria.getShape();

  // Map criteria header -> database column index. A criteria header is a header VALUE and never a
  // column position, which is where it parts from the `field` slot.
  const colMap: number[] = [];
  for (let cc = 0; cc < cCols; cc++) {
    colMap[cc] = matchHeaderIndex(database, criteria.getValueAt(0, cc));
  }

  const conditionRows: Array<Array<{ dbColIndex: number; evaluator: (v: Scalar) => boolean }> | null> = [];

  for (let cr = 1; cr < cRows; cr++) {
    const pairs: { dbColIndex: number; evaluator: (v: Scalar) => boolean }[] = [];
    let dead = false;
    for (let cc = 0; cc < cCols; cc++) {
      const criteriaValue = criteria.getValueAt(cr, cc);
      if (criteriaValue === null || criteriaValue === undefined) continue; // blank cell = no constraint
      const dbColIndex = colMap[cc];
      if (dbColIndex < 0) { dead = true; break; }
      pairs.push({
        dbColIndex,
        // The one thing the D functions' criteria table does differently from COUNTIF's argument:
        // a criterion that stays TEXT matches a PREFIX, so `appl` takes `Apple` and the empty
        // criterion takes every text cell.
        evaluator: FormulaContext.createCriteria(criteriaValue, { anchor: 'start' }),
      });
    }
    conditionRows.push(dead ? null : pairs);
  }

  return conditionRows;
}

/**
 * The 1-based data row indices (row 0 is the header) that match the criteria.
 */
function matchingRows(
  database: IRange,
  criteria: IRange
): number[] {
  const { rows: dbRows } = database.getShape();
  const conditionRows = buildCriteriaRows(database, criteria);

  const result: number[] = [];
  for (let row = 1; row < dbRows; row++) {
    // OR across condition rows; AND across the columns within one. A row with no pairs left
    // constrains nothing and therefore matches — which is how a blank condition row behaves.
    const matched = conditionRows.some(pairs =>
      pairs !== null && pairs.every(({ dbColIndex, evaluator }) =>
        evaluator(database.getValueAt(row, dbColIndex))
      )
    );
    if (matched) result.push(row);
  }
  return result;
}
