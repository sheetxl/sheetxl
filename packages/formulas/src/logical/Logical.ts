/* cspell: disable */
import { ScalarType, Scalar, IRange, FormulaError } from '@sheetxl/primitives';

// TODO - remove
import { Types } from '../_utils/_Types';
import { FormulaHelpers } from '../_utils/_Helpers';

/**
 * @summary Checks whether all arguments are TRUE, and returns TRUE if all arguments are TRUE
 * @param logical logical1,logical2,... are 1 to 255 conditions you want to test that can be either TRUE or FALSE and can be logical values, arrays, or references
 */
export function AND(...logical: IRange[]): any { // boolean | FormulaError.Value
  let hasCoercible = false;
  for (const range of logical) {
    for (const value of range.values<boolean>({ type: ScalarType.Boolean, coerce: true })) {
      hasCoercible = true;
      if (!value) return false; // short-circuit on false
    }
  }
  return hasCoercible ? true : FormulaError.BuiltIn.Value;
}

/**
 * @hidden Unimplemented
 * @summary Applies a LAMBDA function to each column and returns an array of the results.
 * @param array is an array to be separated by column
 * @param fn is a LAMBDA that is called to scan the array.  The LAMBDA takes two parameters, accumulator and value.
 */
export function BYCOL(array: IRange, fn: any): IRange {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Applies a LAMBDA function to each row and returns an array of the results.
 * @param array is an array to be separated by column
 * @param fn is a LAMBDA that is called to scan the array.  The LAMBDA takes two parameters, accumulator and value.
 */
export function BYROW(array: IRange, fn: any): IRange {
  return undefined;
}

/**
 * @summary Returns the logical value FALSE
 */
export function FALSE(): boolean {
  return false;
}

const _broadcastOptions:IRange.BroadcastOptions = { mismatchFill: FormulaError.BuiltIn.NA }
const _booleanGetOptions:IRange.GetValuesOptions = { type: ScalarType.Boolean, coerce: true };

/**
 * @summary Checks whether a condition is met, and returns one value if TRUE, and another value if FALSE
 * @param logicalTest is any value or expression that can be evaluated to TRUE or FALSE
 * @param valueIfTrue is the value that is returned if Logical_test is TRUE. If omitted, TRUE is returned. You can nest up to seven IF functions
 * @param valueIfFalse is the value that is returned if Logical_test is FALSE. If omitted, FALSE is returned
 */
export function IF(
  logicalTest: IRange,
  valueIfTrue: IRange,
  valueIfFalse?: IRange
): IRange {
  // 3 scenarios. - 1x1, 1xN, NxN
  // 1x1
  if (logicalTest.size === 1) {
    const isTrue = logicalTest.getValueAt(0, 0, _booleanGetOptions) as boolean;
    return (isTrue) ? valueIfTrue : (valueIfFalse ?? logicalTest.empty().replace([[false]]));
  }
  const width = logicalTest.getWidth();
  const height = logicalTest.getHeight();

  // 1xN
  if (width === 1 || height === 1) {
    // iterate each logical (include Empties). For each column iterate in the opposite direction the true or false. (+1 offset)
    const orientationLogical = width === 1 ? IRange.Orientation.Column : IRange.Orientation.Row;
    const isColumn = height === 1;
    const lengthTrue = isColumn ? valueIfTrue.getHeight() : valueIfTrue.getWidth();
    const broadtcastIfTrue =(isColumn ? valueIfTrue.getWidth() : valueIfTrue.getHeight())  === 1;

    // false is optional. If not provided we treat it as a range of false that matches the length of true.
    if (!valueIfFalse) {
      const isColumn = height === 1;
      const lengthTrue = isColumn ? valueIfTrue.getHeight() : valueIfTrue.getWidth();
      // should we have this.fromValue?
      valueIfFalse = logicalTest.empty().fill(false, {
        colStart: 0,
        rowStart: 0,
        colEnd: (isColumn ? 1 : lengthTrue) - 1,
        rowEnd: (isColumn ? lengthTrue : 1) - 1,
      });
    }
    const lengthFalse = isColumn ? valueIfFalse.getHeight() : valueIfFalse.getWidth();
    const broadtcastIfFalse = (isColumn ? valueIfFalse.getWidth() : valueIfFalse.getHeight())  === 1;
    const lengthsMax = Math.max(lengthTrue, lengthFalse);

    // Create an error range for logical values we can't parse
    const ifError = logicalTest.empty().fill(FormulaError.BuiltIn.Value, {
      colStart: 0,
      rowStart: 0,
      colEnd: (isColumn ? valueIfFalse.getWidth() : lengthsMax) - 1,
      rowEnd: (isColumn ? lengthsMax : valueIfFalse.getHeight()) - 1,
    });
    const nas:Partial<IRange.Coords>[] = [];
    let retValue = logicalTest.empty();
    logicalTest.forEach<boolean>((logical: boolean | FormulaError.Value, coords: IRange.CellCoords) => {
      const isTrue = logical === true;
      let valuesIf = isTrue ? valueIfTrue : valueIfFalse;
      if (logical instanceof FormulaError.Known) {
        valuesIf = ifError;
      }
      // get a single span
      let index: number = 0;
      if ((isTrue && !broadtcastIfTrue) || (!isTrue && !broadtcastIfFalse)) {
        index = isColumn ? coords.colIndex : coords.rowIndex;
      }
      const slideBounds = isColumn ? { colStart: index, colEnd: index } : { rowStart: index, rowEnd: index };
      valuesIf = valuesIf.slice(slideBounds);
      retValue = retValue.replace(valuesIf, coords); // replace
      // if the length of the value is less than the length of the logical test then we need
      // to add remaining NAs. We mark for now since we don't know the final length. (all true, all false, true/false)
      const length = isColumn ? valuesIf.getHeight() : valuesIf.getWidth();
      if (length < lengthsMax) {
        if (isColumn) {
          slideBounds.rowStart = length;
          slideBounds.rowEnd = lengthsMax - 1;
        } else {
          slideBounds.colStart = length;
          slideBounds.colEnd = lengthsMax - 1;
        }
        nas.push(slideBounds);
      }
    }, { orientation: orientationLogical, type: ScalarType.Boolean, coerce: true, includeEmpty: true });
    // fill in the marked NAs
    for (let i=0; i<nas.length; i++) {
      retValue = retValue.fill(FormulaError.BuiltIn.NA, nas[i]);
    }

    return retValue;
  }

  // NxN
  const colEnd = width - 1;
  const rowEnd = height - 1;
  const callbackFn = (a: Scalar, b: Scalar, coords: IRange.CellCoords): Scalar => {
    let colIndex = coords.colIndex;
    let rowIndex = coords.rowIndex;
    if ((colIndex > colEnd || rowIndex > rowEnd)) {
      return FormulaError.BuiltIn.NA;
    }
    const isTrue = logicalTest.getValueAt(coords.rowIndex, coords.colIndex, _booleanGetOptions);
    return isTrue ? a : b;
  }

  let retValue = valueIfTrue.broadcast(valueIfFalse, callbackFn, _broadcastOptions);
  // TODO - this is not correct we need to fill right and bottom not all blanks
  retValue = retValue.fillEmpty(
    FormulaError.BuiltIn.NA,
    Math.max(valueIfTrue.getWidth(), valueIfFalse.getWidth()),
    Math.max(valueIfTrue.getHeight(), valueIfFalse.getHeight())
  );
  return retValue;
}

/**
 * @summary Returns value_if_error if expression is an error and the value of the expression itself otherwise
 * @param value is any value or expression or reference
 * @param valueIfError is any value or expression or reference
 */
export function IFERROR(value: IRange, valueIfError: IRange): IRange {
  // TODO - return to scalar and use implict broadcasting
  return value.broadcast(valueIfError, (valueA: Scalar=null, valueB: Scalar=null): Scalar => {
    return valueA instanceof FormulaError.Known ? valueB : valueA;
  }, {
    mismatchFill: null // prevents error but doesn't set
  });
}

/**
 * @summary Returns the value you specify if the expression resolves to #N/A, otherwise returns the result of the expression
 * @param value is any value or expression or reference
 * @param valueIfError is any value or expression or reference
 */
export function IFNA(value: IRange, valueIfError: IRange): IRange {
  // TODO - return to scalar and use implict broadcasting
  return value.broadcast(valueIfError, (valueA: Scalar=null, valueB: Scalar=null): Scalar => {
    return FormulaError.BuiltIn.NA.equals(valueA) ? valueB : valueA;
  }, {
    mismatchFill: null // prevents error but doesn't set
  });
}

/**
 * @summary Checks whether one or more conditions are met and returns a value corresponding to the first TRUE condition
 * @param logicalTest logical_test1,logical_test2,... is any value or expression that can be evaluated to TRUE or FALSE
 * @param logicalTrue value_if_true1,value_if_true2,... is the value returned if Logical_test is TRUE
 */
export function IFS(logicalTest: IRange, logicalTrue: IRange, ...rest: IRange[]): IRange {
  if (rest && rest.length % 2 !== 0)
    throw new FormulaError.NA('IFS expects all arguments after position 0 to be in pairs.');

  const ranges = [logicalTest, logicalTrue, ...rest];

  // TODO - this is incorrect this is the old logic.
  for (let i=0; i<ranges.length / 2; i++) {
    // TODO - this doesn't feel too hard. Note there is no
    const logicalTest = FormulaHelpers.accept(ranges[i * 2], Types.BOOLEAN);
    const valueIfTrue = FormulaHelpers.accept(ranges[i * 2 + 1]);
    if (logicalTest)
      return valueIfTrue;
  }
  throw FormulaError.BuiltIn.NA;
}


/**
 * @hidden Unimplemented
 * @summary Creates a function value with can be called within formulas.
 * @param parameterOrCalculation a parameter or a calculation that returns a value. If a parameter, it must be the last argument.
 */
export function LAMDA(...parameterOrCalculation: IRange[]): any {
  // // IRange | IFunction
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Assigns calculation results to names. Useful for storing intermediate calculations and values by defining names inside a formula. These names only apply within the scope of the LET function.
 * @param name name1,name2,... the name, or a calculation which can make use of all names within the LET. Names must start with a letter, cannot be the output of a formula, or conflict with range syntax.
 * @param nameOrValue name_value1,name_value2,... the value associated with the name.
 */
export function LET(
  name: string,
  nameOrValue: IRange,
  calculationOrName: IRange,
  ...rest: IRange[]
): any {
  // This function has a variable parameter list. We need to model this a bit differently.
  //
  // calculationOrName => IFunction
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns a calculated array of a specified row and column size, by applying a LAMBDA function.
 * @param rows is the number of rows in the array.  Must be greater than zero.
 * @param columns is the number of columns in the array.  Must be greater than zero.
 * @param fn is a LAMBDA that is called to create the array.  The LAMBDA takes two parameters, row index and column index.
 */
export function MAKEARRAY(rows: number, columns: number, fn: IRange): any {
  // fn -> IFunction
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns an array formed by 'mapping' each value in the array(s) to a new value by applying a lambda to create a new value.
 * @param array is an array to be mapped
 * @param lamdaOrArray lambda_or_array1,lambda_or_array2,... is a LAMBDA which must be the last argument and must have a parameter for each array passed, or another array to be mapped
 */
export function MAP(array: IRange, ...lamdaOrArray: IRange[]): any {
  // lamdaOrArray -> IRange | IFunction
  return undefined;
}

/**
 * @summary Changes FALSE to TRUE, or TRUE to FALSE
 * @param logical is a value or expression that can be evaluated to TRUE or FALSE
 */
export function NOT(logical: IRange): IRange {
  return logical
    .map((value) => {
      if (typeof value === 'boolean') return !value;
      if (typeof value === 'number') return value === 0;
      return FormulaError.BuiltIn.Value;
    })// TODO - we don't need to checkout outselves, { type: ScalarType.Boolean, coerce: true })
    .fillEmpty(true);
}

/**
 * @summary Checks whether any of the arguments are TRUE, and returns TRUE or FALSE. Returns FALSE only if all arguments are FALSE
 * @param logical logical1,logical2,... are 1 to 255 conditions that you want to test that can be either TRUE or FALSE
 */
export function OR(...logical: IRange[]): any { // boolean | FormulaError.Value
  let hasCoercible = false;
  for (const range of logical) {
    for (const value of range.values<boolean>({ type: ScalarType.Boolean, coerce: true })) {
      hasCoercible = true;
      if (value === true) return true; // short-circuit on truthy
    }
  }
  return hasCoercible ? false : FormulaError.BuiltIn.Value;
}

/**
 * @hidden Unimplemented
 * @summary Reduces an array to an accumulated value by applying a LAMBDA function to each value and returning the total value in the accumulator.
 * @param initialValue is the starting value for the accumulator
 * @param array is an array to be reduced
 * @param fn is a LAMBDA that is called to reduce the array.  The LAMBDA takes two parameters, accumulator and value.
 */
export function REDUCE(initialValue: IRange, array: IRange, fn: IRange): any {
  // lamdaOrArray -> IRange | IFunction
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Scans an array by applying a LAMBDA function to each value and returns an array that has each intermediate value
 * @param initialValue is the starting value for the accumulator
 * @param array is an array to be reduced
 * @param fn is a LAMBDA that is called to reduce the array.  The LAMBDA takes two parameters, accumulator and value.
 */
export function SCAN(initialValue: IRange, array: IRange, fn: IRange): any {
  // lamdaOrArray -> IRange | IFunction
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Evaluates an expression against a list of values and returns the result corresponding to the first matching value. If there is no match, an optional default value is returned
 * @param value is an expression to be evaluated
 * @param results result1,result2,... is a result to be returned if the corresponding value matches expression
 */
export function SWITCH(expression: IRange, value: IRange, ...results: IRange[]): any {
  // TODO - how to implement this? Is the expression a string
  return undefined;
}

/**
 * @summary Returns the logical value TRUE
 */
export function TRUE(): boolean {
  return false;
}

/**
 * @summary Returns a logical 'Exclusive Or' of all arguments
 * @param logical logical1,logical2,... are 1 to 254 conditions you want to test that can be either TRUE or FALSE and can be logical values, arrays, or references
 */
export function XOR(...logical: IRange[]): any { // boolean | FormulaError.Value
  let hasCoercible = false;
  let trueCount = 0;
  for (const range of logical) {
    for (const value of range.values<boolean>({ type: ScalarType.Boolean, coerce: true })) {
      hasCoercible = true;
      if (value === true) trueCount++;
    }
  }
  return hasCoercible ? (trueCount % 2 === 1) : FormulaError.BuiltIn.Value;
}