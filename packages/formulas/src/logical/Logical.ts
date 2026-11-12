/* cspell: disable */
import {
  FormulaContext, FormulaError, IRange,
  type AcceptError, type IReferenceRange, type Scalar,
  type Lambda, type Lazy, type Omittable, type Repeating
} from '@sheetxl/primitives';

import { flushSubnormal } from '../_utils/Arithmetic';
import { reduceIf } from '../_utils/ReduceIf';

/** A number below the smallest normal double reads as zero; anything else passes through. */
const zeroSubnormal = (value: Scalar): Scalar =>
  typeof value === 'number' ? flushSubnormal(value) : value;

/**
 * Checks whether all arguments are TRUE, and returns TRUE if all arguments are TRUE.
 * @param logical are 1 to 255 conditions you want to test that can be either TRUE or FALSE and can be logical values, arrays, or references.
 */
export function AND(logical: IRange<boolean>[]): Scalar {
  let hasCoercible = false;
  let hasFalse = false;
  for (const range of logical) {
    for (const value of range.values<boolean>()) {
      hasCoercible = true;
      if (!value) hasFalse = true;
    }
  }
  return hasCoercible ? !hasFalse : FormulaError.BuiltIn.Value!;
}

/**
 * Applies a LAMBDA function to each column and returns an array of the results.
 * @param array is an array to be separated by column.
 * @param fn is a LAMBDA that takes a column as its single parameter and returns one result for it.
 */
export function BYCOL(
  array: IRange,
  fn?: Lambda<[column: IRange], Scalar>
): IRange {
  if (!fn) return FormulaError.BuiltIn.Calc!; // absent fn is #CALC!; an explicit-empty slot is already #VALUE! at marshalling
  const columns = array.getColumnCount();
  // TODO - use vectorized ops, we don't because fn could be volatile
  const row: Scalar[] = new Array(columns);
  for (let c=0; c<columns; c++) {
    row[c] = fn(array.slice({ colStart: c, colEnd: c }));
  }
  return FormulaContext.createRange(1, columns, [row]);
}

/**
 * Applies a LAMBDA function to each row and returns an array of the results.
 * @param array is an array to be separated by row.
 * @param fn is a LAMBDA that takes a row as its single parameter and returns one result for it.
 */
export function BYROW(
  array: IRange,
  fn?: Lambda<[row: IRange], Scalar>
): IRange {
  if (!fn) return FormulaError.BuiltIn.Calc!; // absent fn is #CALC!; an explicit-empty slot is already #VALUE! at marshalling
  const rows = array.getRowCount();
  // TODO - use vectorized ops, we don't because fn could be volatile
  const grid: Scalar[][] = new Array(rows);
  for (let r=0; r<rows; r++) {
    grid[r] = [fn(array.slice({ rowStart: r, rowEnd: r }))];
  }
  return FormulaContext.createRange(rows, 1, grid);
}

/**
 * Returns the logical value FALSE.
 */
export function FALSE(): boolean {
  return false;
}

/**
 * Flattens all the values from one or more ranges into a single column.
 * @param ranges One or more ranges or scalar values to flatten.
 * @category Sheets
 */
export function FLATTEN(ranges: IRange[]): IRange {
  return ranges
    .map((range: IRange): IRange => range.flatten())
    .reduce((acc: IRange, column: IRange): IRange => acc.concat(column));
}

/**
 * Checks whether a condition is met, and returns one value if TRUE, and another value if FALSE.
 * @param logicalTest is any value or expression that can be evaluated to TRUE or FALSE.
 * @param valueIfTrue is the value that is returned if logicalTest is TRUE. If omitted, TRUE is returned. You can nest up to seven IF functions.
 * @param valueIfFalse is the value that is returned if logicalTest is FALSE. If omitted, FALSE is returned.
 */
export function IF(
  logicalTest: boolean,
  valueIfTrue: Lazy<AcceptError<any>>,
  valueIfFalse: Lazy<AcceptError<any>, false>
): any {
  // The branches are HANDLES, returned unread: the engine evaluates the one that comes back and
  // never opens the other, which is what keeps an untaken arm out of the read hook. `false` is
  // the absent default the engine supplies, in place of an initializer a handle cannot carry.
  return logicalTest ? valueIfTrue : valueIfFalse;
}

/**
 * Returns valueIfError if expression is an error and the value of the expression itself otherwise.
 * @param value is any value or expression or reference.
 * @param valueIfError is any value or expression or reference.
 */
export function IFERROR(
  value: AcceptError<Scalar>,
  valueIfError: Lazy<AcceptError<any>>
): Scalar { // declared Scalar to mirror Excel's signature; the result may be any value
  // The fallback is a handle returned unread — the cast is the declared return type's, not a
  // claim about the value. `value` itself stays eager: it is what the test reads.
  return FormulaError.isError(value) ? valueIfError as unknown as Scalar : value;
}

/**
 * Returns the value you specify if the expression resolves to #N/A, otherwise returns the result of the expression.
 * @param value is any value or expression or reference.
 * @param valueIfNA is any value or expression or reference.
 */
export function IFNA(
  value: AcceptError<Scalar>,
  valueIfNA: Lazy<AcceptError<any>>
): Scalar { // declared Scalar to mirror Excel's signature; the result may be any value
  // As IFERROR — the fallback is a handle returned unread, the tested value is not.
  return FormulaError.BuiltIn.NA!.equals(value) ? valueIfNA as unknown as Scalar : value;
}

/**
 * Checks whether one or more conditions are met and returns a value corresponding to the first TRUE condition.
 * @param condition the conditions to test and the values to return for them.
 * @param condition.logicalTest is any value or expression that can be evaluated to TRUE or FALSE.
 * @param condition.logicalTrue is the value returned if logicalTest is TRUE.
 *
 * @remarks
 * The search STOPS at the first TRUE condition, and a condition past it is never read: a
 * `#DIV/0!` or an uncoercible text there does not surface. A fault reached BEFORE the match is
 * fatal, which is why the test slot accepts errors and this body decides — the engine's own
 * left-to-right propagation would refuse the whole call for a condition that is never evaluated.
 */
export function IFS(
  condition: Repeating<[logicalTest: AcceptError<boolean>, logicalTrue: AcceptError<any>], 254>
): any {
  for (const [logicalTest, logicalTrue] of condition) {
    if (FormulaError.isError(logicalTest)) return logicalTest;
    if (logicalTest) return logicalTrue;
  }
  return FormulaError.BuiltIn.NA!;
}

/**
 * Creates a function value which can be called within formulas.
 * @param parameterOrCalculation a parameter or a calculation that returns a value. If a parameter, it must be the last argument.
 */
export function LAMBDA(parameterOrCalculation: Repeating<AcceptError<IRange>, 254>): Lambda {
  // The engine intercepts a LAMBDA call at compile (the binder annotates the scope, and
  // evaluating the node closes the deferred body over the current registers, answering a real
  // lambda value). This declaration carries the wizard, arity, and docs — the body never runs.
  // `#CALC!` is also the CELL's verdict on an unconsumed lambda, so a path that misses the
  // intercept degrades to the right display.
  return FormulaError.BuiltIn.Calc as unknown as Lambda;
}

/**
 * Assigns calculation results to names. Useful for storing intermediate calculations and values by defining names inside a formula. These names only apply within the scope of the LET function.
 * @param name the name, or a calculation which can make use of all names within the LET. Names must start with a letter, cannot be the output of a formula, or conflict with range syntax.
 * @param nameOrValue the value associated with the name.
 */
export function LET(
  name: AcceptError<any>,
  nameOrValue: AcceptError<IRange>,
  calculationOrName: AcceptError<IRange>,
  ...rest: Repeating<AcceptError<IRange>, 254>
): any { // Lambda
  // `name` is a NAME TOKEN rather than a value, and no declared type says so. `*` claims nothing
  // about what belongs there, which is the point: a more specific type invites synthesizing a
  // literal in that position, and such a call does not PARSE.
  //
  // The engine intercepts a LET call at compile (the binder pass claims its declarations, and
  // evaluation answers the body expression directly). This declaration carries the wizard, arity,
  // and docs — the body never runs. Reaching it means the intercept was missed, and `undefined`
  // reads as an unimplemented function — the honest answer.
  return undefined;
}

/**
 * Returns a calculated array of a specified row and column size, by applying a LAMBDA function.
 * @param rows is the number of rows in the array. Must be greater than zero.
 * @param columns is the number of columns in the array. Must be greater than zero.
 * @param fn is a LAMBDA that is called to create the array. The LAMBDA takes two parameters, row index and column index.
 */
export function MAKEARRAY(
  rows: Omittable<number, 1>,
  columns: Omittable<number, 1>,
  fn: Lambda<[rowIndex: number, colIndex: number], Scalar>
): IRange {
  // Dimensions must be INTEGERS at least 1 — a fractional or sub-1 dimension is #VALUE!,
  // never truncated.
  if (rows !== Math.trunc(rows) || columns !== Math.trunc(columns)
    || rows < 1 || columns < 1) return FormulaError.BuiltIn.Value!;
  // An IMPLEMENTATION limit, not Excel's: Excel accepts dimensions past the grid on either axis
  // and past 2^20 total cells. Unbounded here means an OOM crash, so the grid's own extent is
  // the protective cap — a known difference, recorded in the known-differences doc.
  const entireCoords = FormulaContext.getEntireCoords();
  if (rows > entireCoords.rowEnd + 1 || columns > entireCoords.colEnd + 1) return FormulaError.BuiltIn.Value!;
  const grid: Scalar[][] = new Array(rows);
  for (let r=0; r<rows; r++) {
    const line: Scalar[] = new Array(columns);
    for (let c=0; c<columns; c++) {
      // 1-based indices.
      line[c] = fn(r + 1, c + 1);
    }
    grid[r] = line;
  }
  return FormulaContext.createRange(rows, columns, grid);
}

/**
 * Returns an array formed by 'mapping' each value in the array(s) to a new value by applying a lambda to create a new value.
 * @param array is an array to be mapped.
 * @param lambdaOrArray is a LAMBDA which must be the last argument and must have a parameter for each array passed, or another array to be mapped.
 */
// `AcceptError`: the union slot is discriminated by KIND, and an error is just another
// non-callable — `MAP(A1:C3,NA())` is #VALUE! (the callable position swallows it), never #N/A.
export function MAP(
  array: IRange,
  lambdaOrArray: AcceptError<any | Lambda<any[], Scalar>>[]
): IRange {
  const length = lambdaOrArray.length;
  const fn = length > 0 ? lambdaOrArray[length - 1] : null;
  if (typeof fn !== 'function') return FormulaError.BuiltIn.Value!;
  const arrays: IRange[] = [array];
  for (let i=0; i<length - 1; i++) {
    const other = lambdaOrArray[i];
    if ((other as IRange)?.isIRange !== true) return FormulaError.BuiltIn.Value!;
    arrays.push(other as IRange);
  }
  let minRows = Number.MAX_SAFE_INTEGER, maxRows = 0;
  let minCols = Number.MAX_SAFE_INTEGER, maxCols = 0;
  for (const range of arrays) {
    const rows = range.getRowCount();
    const columns = range.getColumnCount();
    if (rows < minRows) minRows = rows;
    if (rows > maxRows) maxRows = rows;
    if (columns < minCols) minCols = columns;
    if (columns > maxCols) maxCols = columns;
  }
  // TODO - use vectorized ops, we don't because fn could be volatile
  // No broadcasting at all: the output is max×max, and any position past the SMALLEST extent
  // on either axis is #N/A without the lambda running — a 1-row array is not stretched.
  const argsLength = arrays.length;
  // A REFERENCE input hands each member as a 1×1 reference slice (ISREF is TRUE inside the
  // callback, ROW/COLUMN/CELL("address") answer, a blank member is a blank CELL); an ARRAY has
  // no cells, so its members are handed as VALUES (`TYPE(v)` reads the member's own type).
  const refBacked: boolean[] = new Array(argsLength);
  for (let i=0; i<argsLength; i++) refBacked[i] = (arrays[i] as any).isIReferenceRange === true;
  const args: (IRange | Scalar)[] = new Array(argsLength); // reused per cell
  const grid: Scalar[][] = new Array(maxRows);
  for (let r=0; r<maxRows; r++) {
    const line: Scalar[] = new Array(maxCols);
    for (let c=0; c<maxCols; c++) {
      if (r >= minRows || c >= minCols) {
        line[c] = FormulaError.BuiltIn.NA!;
        continue;
      }
      for (let i=0; i<argsLength; i++) {
        args[i] = refBacked[i]
          ? arrays[i].slice({ rowStart: r, rowEnd: r, colStart: c, colEnd: c })
          : arrays[i].getValueAt(r, c) ?? null; // empty cells visit as blank
      }
      line[c] = fn(...args);
    }
    grid[r] = line;
  }
  return FormulaContext.createRange(maxRows, maxCols, grid);
}

/**
 * Changes FALSE to TRUE, or TRUE to FALSE.
 * @param logical is a value or expression that can be evaluated to TRUE or FALSE.
 */
export function NOT(logical: boolean): boolean {
  return !logical;
}

/**
 * Checks whether any of the arguments are TRUE, and returns TRUE or FALSE. Returns FALSE only if all arguments are FALSE.
 * @param logical are 1 to 255 conditions that you want to test that can be either TRUE or FALSE.
 */
export function OR(logical: IRange<boolean>[]): Scalar {
  let hasCoercible = false;
  let hasTrue = false;
  for (const range of logical) {
    for (const value of range.values<boolean>()) {
      hasCoercible = true;
      if (value) hasTrue = true;
    }
  }
  return hasCoercible ? hasTrue : FormulaError.BuiltIn.Value!;
}

/**
 * Reduces an array to an accumulated value by applying a LAMBDA function to each value and returning the total value in the accumulator.
 * @param initialValue is the starting value for the accumulator.
 * @param array is an array to be reduced.
 * @param fn is a LAMBDA that is called to reduce the array. The LAMBDA takes two parameters, accumulator and value.
 */
export function REDUCE(
  initialValue: Omittable<AcceptError<any>>,
  array: IRange,
  fn: Lambda<[accumulator: any, value: IRange | Scalar], any>
): any {
  // A union has no single value to seed with — the `any` slot hands the areas through whole,
  // and the refusal is this body's own.
  if (Array.isArray(initialValue)) return FormulaError.BuiltIn.Value!;
  let accumulator: any = initialValue;
  let seeded = initialValue !== undefined;
  // Row-major, EVERY cell — empties visit as blank, and an error result keeps folding:
  // no short-circuit; the lambda is invoked with it.
  // TODO - use vectorized ops, we don't because fn could be volatile
  const refBacked = (array as any).isIReferenceRange === true;
  const iter = array.entries({ axis: IRange.Axis.Row, includeEmpty: true });
  let next = iter.next();
  while (!next.done) {
    if (!seeded) {
      seeded = true;
      // The seed is the member's VALUE — the accumulator is a value throughout (ISREF of it is
      // FALSE), only the MEMBER argument below is a reference.
      accumulator = next.value.value ?? null;
    } else {
      // A REFERENCE input hands the member as a 1×1 slice (a reference inside the callback, a
      // blank member a blank CELL); an ARRAY has no cells, so its members are values.
      const coords = next.value.coords;
      accumulator = fn(accumulator, refBacked
        ? array.slice({
            rowStart: coords.rowIndex, rowEnd: coords.rowIndex,
            colStart: coords.colIndex, colEnd: coords.colIndex
          })
        : next.value.value ?? null);
    }
    next = iter.next();
  }
  return accumulator;
}

/**
 * Reduces the cells specified by a given condition or criteria.
 * @param range is the range of cells you want evaluated.
 * @param criteria is the condition or criteria in the form of a number, expression, or text that defines which cells will be reduced.
 * @param reduceRange are the actual cells to reduce. If omitted, the cells in range are used. This can be blank.
 * @param fn is a LAMBDA that is called to reduce the array. The LAMBDA takes two parameters, accumulator and value.
 * @category SheetXL
 *
 * @remarks
 * This is a lambda equivalent to SUMIF, COUNTIF, and AVERAGEIF.
 */
export function REDUCEIF(
  range: IReferenceRange,
  criteria: AcceptError<Scalar>,
  reduceRange: Omittable<IReferenceRange>,
  fn: Lambda<[accumulator: Scalar, value: Scalar], Scalar>
): Scalar {
  // `null`: a user LAMBDA has no closed form to give, so `reduceIf` applies it.
  return reduceIf(range, criteria, reduceRange, fn, null);
};

/**
 * Scans an array by applying a LAMBDA function to each value and returns an array that has each intermediate value.
 * @param initialValue is the starting value for the accumulator.
 * @param array is an array to be reduced.
 * @param fn is a LAMBDA that is called to reduce the array. The LAMBDA takes two parameters, accumulator and value.
 */
// `AcceptError`: an error seed is a VALUE — the fold runs and each partial result carries it, so
// the output is the array's shape filled with that error, never one propagated scalar.
export function SCAN(
  initialValue: Omittable<AcceptError<any>>,
  array: IRange,
  fn: Lambda<[accumulator: any, value: IRange | Scalar], Scalar>
): IRange {
  const rows = array.getRowCount();
  const columns = array.getColumnCount();
  // `initial_value` is an `any` slot, as REDUCE's is: a container arrives WHOLE rather than
  // lifting the call once per member (a whole-column seed lifted a million calls), and the
  // callback sees it as given — `N(ISREF(a))` over a 3-cell seed is 1. What the callback ANSWERS
  // is another matter: an array-shaped result has nowhere to go in the running array, so it is
  // `#CALC!` for the whole call — the callback's declared `Scalar` return throws it. A UNION seed
  // is `#VALUE!` in EVERY output cell — the error takes the output's shape. REDUCE accepts the
  // same array-shaped accumulator SCAN refuses.
  if (Array.isArray(initialValue)) {
    return FormulaContext.createRange(rows, columns, () => FormulaError.BuiltIn.Value!);
  }
  // TODO - use vectorized ops, we don't because fn could be volatile
  // Row-major over EVERY cell (empties visit as blank), output in the input's shape.
  const refBacked = (array as any).isIReferenceRange === true;
  let accumulator: any = initialValue ?? null;
  let seeded = initialValue !== undefined;
  const grid: Scalar[][] = new Array(rows);
  for (let r=0; r<rows; r++) {
    const line: Scalar[] = new Array(columns);
    for (let c=0; c<columns; c++) {
      let result: Scalar;
      if (!seeded) {
        seeded = true;
        result = array.getValueAt(r, c) ?? null; // the seed is a CELL's value — already one scalar
      } else {
        // A REFERENCE input hands the member as a 1×1 slice (a reference inside the callback, a
        // blank member a blank CELL); an ARRAY has no cells, so its members are values. The
        // accumulator is a value throughout.
        result = fn(accumulator, refBacked
          ? array.slice({ rowStart: r, rowEnd: r, colStart: c, colEnd: c })
          : array.getValueAt(r, c) ?? null);
      }
      accumulator = result;
      line[c] = result;
    }
    grid[r] = line;
  }
  return FormulaContext.createRange(rows, columns, grid);
}

/**
 * Evaluates an expression against a list of values and returns the result corresponding to the first matching value. If there is no match, an optional default value is returned.
 * @param match the values to compare against expression and the results to return for them.
 * @param match.value is a value to compare against expression.
 * @param match.result is a result to be returned if the corresponding value matches expression.
 * @param expression is an expression to be evaluated.
 * @param defaultResult is the result to be returned when no value matches expression.
 */
export function SWITCH(
  expression: Scalar,
  match: Repeating<[value: AcceptError<Scalar>, result: AcceptError<any>], 254>,
  defaultResult?: Omittable<AcceptError<any>, 0>
): any {
  // The comparison is the `=` OPERATOR's, which already carries the kind gate (`1` does not match
  // `"1"` and `TRUE` does not match `1`), the 15-significant-digit numeric normalization and the
  // COLLATED case-insensitive text rule — so `"a"` matches `"A"` and `"straße"` matches
  // `"STRASSE"`, expansions included.
  //
  // Two things are this function's own. A BLANK becomes the NUMBER 0 on either side before the
  // comparison, so `SWITCH(A1,0,…)` matches for an empty A1 while `SWITCH(A1,"",…)` does not —
  // where the bare operator answers TRUE to both. And a SUBNORMAL reads as zero here, as it does
  // at a logical slot, where `EXP(-745)=0` is FALSE.
  //
  // The search stops at the first match and nothing past it is read, so an error in a later case
  // never surfaces; a fault reached before the match is fatal, which is what the case slot's
  // `AcceptError` and the check below are for.
  const expr = zeroSubnormal(expression ?? 0);
  for (const [rawValue, result] of match) {
    if (FormulaError.isError(rawValue)) return rawValue;
    if (FormulaContext.compare(expr, zeroSubnormal(rawValue ?? 0)) === 0) {
      return result ?? 0;
    }
  }
  if (defaultResult !== undefined) return defaultResult;
  return FormulaError.BuiltIn.NA;
}

/**
 * Returns the logical value TRUE.
 */
export function TRUE(): boolean {
  return true;
}

/**
 * Returns a logical 'Exclusive Or' of all arguments.
 * @param logical are 1 to 254 conditions you want to test that can be either TRUE or FALSE and can be logical values, arrays, or references.
 */
export function XOR(logical: Repeating<IRange<boolean>, 254>): Scalar {
  let hasCoercible = false;
  let trueCount = 0;
  for (const range of logical) {
    for (const value of range.values<boolean>()) {
      hasCoercible = true;
      if (value) trueCount++;
    }
  }
  return hasCoercible ? (trueCount % 2 === 1) : FormulaError.BuiltIn.Value!;
}

