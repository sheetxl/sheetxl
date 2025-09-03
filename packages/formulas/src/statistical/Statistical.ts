/* cspell: disable */
import { Scalar, IRange, IReferenceRange, FormulaError } from '@sheetxl/primitives';

// import { Criteria } from './lib';
// import { CompareOp } from './lib';

function onFnA(callbackfn: (v: number)=>void, ...value: IRange[]): void {
  for (const range of value) {
    const isLiteral = range.isLiteral();
    for (const v of range.values<Scalar>({ coerce: false, includeMistyped: true })) {
      const type = typeof v;
      if (type === "number") {
        callbackfn(v as number);
        continue;
      }
      if (type === "string") {
        callbackfn(v as number);
        continue;
      }
      if (type === "boolean") {
        if (isLiteral) continue; // mimic an excel bug
        callbackfn(v as number);
        continue;
      }
      // Return first error found (but in row major order)
      if ((v as FormulaError.Known).isFormulaError) throw v;
    }
  }
}

/**
 * @summary Returns the average of the absolute deviations of data points from their mean. Arguments can be numbers or names, arrays, or references that contain numbers
 * @param number number1,number2,... are 1 to 255 arguments for which you want the average of the absolute deviations
 */
export function AVEDEV(...number: IRange<number>[]): number {
  let sum = 0;
  const arr = [];
  for (const range of number) {
    for (const v of range.values()) {
      sum += v;
      arr.push(v);
    }
  }

  const n = arr.length;
  const avg = sum / n;
  sum = 0;
  for (let i=0; i<n; i++) {
    sum += Math.abs(arr[i] - avg);
  }
  return sum / n;
}

/**
 * @summary Returns the average (arithmetic mean) of its arguments, which can be numbers or names, arrays, or references that contain numbers
 * @param number number1,number2,... are 1 to 255 numeric arguments for which you want the average
 */
export function AVERAGE(...number: IRange<number>[]): number {
  let sum = 0;
  let cnt = 0;
  for (const range of number) {
    for (const v of range.values()) {
      sum += v;
      cnt++;
    }
  }

  if (cnt === 0) {
    throw FormulaError.BuiltIn.Div0 as any;
  }
  return sum / cnt;
}

/**
 * @summary Returns the average (arithmetic mean) of its arguments, evaluating text and FALSE in arguments as 0; TRUE evaluates as 1. Arguments can be numbers, names, arrays, or references
 * @param value value1,value2,... are 1 to 255 arguments for which you want the average
 */
export function AVERAGEA(...value: IRange<number>[]): number {
  let sum = 0;
  let cnt = 0;
  for (const range of value) {
    const isLiteral = range.isLiteral();
    for (const v of range.values<Scalar>({ coerce: false, includeMistyped: true })) {
      const type = typeof v;
      if (type === "number") {
        sum += v as number;
        cnt++;
        continue;
      }
      if (type === "string") {
        cnt++;
        continue;
      }
      if (type === "boolean") {
        if (isLiteral) continue; // mimic an excel bug
        sum+= v ? 1 : 0; // SUM add 1 for TRUE
        cnt++;
        continue;
      }
      // Return first error found (but in row major order)
      if ((v as FormulaError.Known).isFormulaError) return v as any;
    }
  }
  return sum / cnt;
}

/**
 * @hidden Unimplemented
 * @summary Finds average(arithmetic mean) for the cells specified by a given condition or criteria
 * @param range is the range of cells you want evaluated
 * @param criteria is the condition or criteria in the form of a number, expression, or text that defines which cells will be used to find the average
 * @param averageRange are the actual cells to be used to find the average. If omitted, the cells in range are used
 */
export function AVERAGEIF(
  range: IRange,
  criteria: IRange,
  averageRange?: IReferenceRange
): IReferenceRange {
  return undefined;
  // const ranges = H.retrieveRanges(context, range, averageRange);
  // range = ranges[0];
  // averageRange = ranges[1];

  // criteria = H.retrieveArg(context, criteria);
  // const isCriteriaArray = criteria.isArray;
  // criteria = Criteria.parse(H.accept(criteria));

  // let sum = 0;
  // let cnt = 0;
  // range.forEach((row, rowNum) => {
  //   row.forEach((value, colNum) => {
  //     const valueToAdd = averageRange[rowNum][colNum];
  //     if (typeof valueToAdd !== "number")
  //       return;
  //     // wildcard
  //     if (criteria.op === 'wc') {
  //       if (criteria.match === criteria.value.test(value)) {
  //         sum += valueToAdd;
  //         cnt++;
  //       }
  //     } else if (CompareOp(value, criteria.op, criteria.value, Array.isArray(value), isCriteriaArray)) {
  //       sum += valueToAdd;
  //       cnt++;
  //     }
  //   })
  // });
  // if (cnt === 0) throw FormulaError.BuiltIn.Div0;
  // return sum / cnt;
}

// SUMIFS
/**
 * @hidden Unimplemented
 * @summary Finds average(arithmetic mean) for the cells specified by a given set of conditions or criteria
 * @param averageRange are the actual cells to be used to find the average.
 * @param criteriaRange criteria_range1,criteria_range2,... is the range of cells you want evaluated for the particular condition
 * @param criteria criteria1,criteria2,... is the condition or criteria in the form of a number, expression, or text that defines which cells will be used to find the average
 */
export function AVERAGEIFS(
  averageRange: IRange,
  criteriaRange: IRange,
  ...criteria: IRange[]
): any {
  return undefined;
}

/**
 * @summary Counts the number of cells in a range that contain numbers
 * @param number value1,value2,... are 1 to 255 arguments that can contain or refer to a variety of different types of data, but only numbers are counted
 */
export function COUNT(...number: IRange<number>[]): number {
  let cnt = 0;
  for (const range of number) {
    for (const v of range.values()) {
      cnt++;
    }
  }
  return cnt;
}

/**
 * @summary Counts the number of cells in a range that are not empty
 * @param value value1,value2,... are 1 to 255 arguments representing the values and cells you want to count. Values can be any type of information
 */
export function COUNTA(...value: IRange<number>[]): number {
  let cnt = 0;
  for (const range of value) {
    const isLiteral = range.isLiteral();
    for (const v of range.values<Scalar>({ coerce: false, includeMistyped: true })) {
      const type = typeof v;
      if (type === "number") {
        cnt++;
        continue;
      }
      if (type === "string") {
        cnt++;
        continue;
      }
      if (type === "boolean") {
        if (isLiteral) continue; // mimic an excel bug
        cnt++;
        continue;
      }
      // Return first error found (but in row major order)
      if ((v as FormulaError.Known).isFormulaError) return v as any;
    }
  }
  return cnt;
}

/**
 * @hidden Unimplemented
 * @summary Counts the number of empty cells in a specified range of cells
 * @param range is the range from which you want to count the empty cells
 */
// TODO - incorrect
export function COUNTBLANK(range: IRange): number {
  return range.size; // range.getCount();
}

/**
 * @hidden Unimplemented
 * @summary Counts the number of cells within a range that meet the given condition
 * @param range is the range of cells from which you want to count nonblank cells
 * @param criteria is the condition in the form of a number, expression, or text that defines which cells will be counted
 */
export function COUNTIF(
  range: IRange,
  criteria: IRange
): number { // IReferenceRange? (not sure)
  //FormulaContext
  return undefined
  // do not flatten the array
  // range = H.accept(range, Types.ARRAY, undefined, false, true);
  // const isCriteriaArray = criteria.isArray;
  // criteria = H.accept(criteria);

  // let cnt = 0;
  // // parse criteria
  // criteria = Criteria.parse(criteria);

  // range.forEach(row => {
  //   row.forEach(value => {
  //     // wildcard
  //     if (criteria.op === 'wc') {
  //       if (criteria.match === criteria.value.test(value))
  //         cnt++;
  //     } else if (CompareOp(value, criteria.op, criteria.value, Array.isArray(value), isCriteriaArray)) {
  //       cnt++;
  //     }
  //   })
  // });
  // return cnt;
}

// TODO - should be repeating pairs
/**
 * @hidden Unimplemented
 * @summary Counts the number of cells specified by a given set of conditions or criteria
 * @param criteriaRange criteria_range1,criteria_range2,... is the range of cells you want evaluated for the particular condition
 * @param criteria criteria1,criteria2,... is the condition in the form of a number, expression, or text that defines which cells will be counted
 */
export function COUNTIFS(
  criteriaRange: IRange,
  criteria: IRange
): number {
  // FormulaContext.
  return undefined
};

/**
 * @summary Returns the k-th largest value in a data set. For example, the fifth largest number.
 * @param array is the array or range of data for which you want to determine the k-th largest value.
 * @param k is the position (from the largest) in the array or cell range of the value to return.
 */
export function LARGE(array: IRange<number>, k: number): number {
  k = Math.floor(k); // Ensure k is an integer
  if (k < 1) return Number.NaN; // greater than 0

  const values: number[] = [];
  // Collect all valid numeric values from the array or range
  for (const v of array.values()) {
    values.push(v);
  }
  if (values.length === 0) return Number.NaN; // no returns
  // If k exceeds the number of values, return #NUM! error
  if (k > values.length) return Number.NaN; // no returns
  // Sort in descending order
  values.sort((a, b) => b - a);

  // Return the k-th largest value
  return values[k - 1];
}

/**
 * @summary Returns the largest value in a set of values. Ignores logical values and text
 * @param number number1,number2,... are 1 to 255 numbers, empty cells, logical values, or text numbers for which you want the maximum
 */
export function MAX(...number: IRange<number>[]): number {
  let max = Number.MIN_SAFE_INTEGER;
  for (const range of number) {
    for (const v of range.values()) {
      max = Math.max(max, v);
    }
  }
  if (max === Number.MIN_SAFE_INTEGER) return 0;
  return max;
}

/**
 * @summary Returns the largest value in a set of values. Does not ignore logical values and text
 * @param value value1,value2,... are 1 to 255 numbers, empty cells, logical values, or text numbers for which you want the maximum
 */
export function MAXA(...value: IRange[]): number {
  let min = 0;
  onFnA((v, ) => {
    min = Math.min(min, v);
  }, ...value);
  return min;
}

/**
 * @hidden Unimplemented
 * @summary Returns the maximum value among cells specified by a given set of conditions or criteria
 * @param maxRange the cells in which to determine the maximum value
 * @param criteriaRange criteria_range1,criteria_range2,... is the range of cells you want to evaluate for the particular condition
 * @param criteria criteria1,criteria2,... is the condition or criteria in the form of a number, expression, or text that defines which cells will be included when determining the maximum value
 */
export function MAXIFS(
  maxRange: IRange,
  criteriaRange: IRange,
  ...criteria: IRange[]
): number {
  // FormulaContext.
  return undefined;
}

/**
 * @summary Returns the median, or the number in the middle of the set of given numbers
 * @param number number1,number2,... are 1 to 255 numbers or names, arrays, or references that contain numbers for which you want the median
 */
export function MEDIAN(...number: IRange<number>[]): number {
  const values: number[] = [];
  // Collect all valid numeric values from the array or range
  for (const range of number) {
    for (const v of range.values()) {
      values.push(v);
    }
  }

  // Step 2: Return error if no numeric values found
  if (values.length === 0)  Number.NaN;

  // Step 3: Sort values numerically
  values.sort((a, b) => a - b);

  // Step 4: Calculate median based on number of values
  const n = values.length;
  if (n % 2 === 0) {
    // Even number of values - average the middle two
    const mid = n / 2;
    return (values[mid - 1] + values[mid]) / 2;
  } else {
    // Odd number of values - return middle value
    return values[Math.floor(n / 2)];
  }
}

/**
 * @summary Returns the smallest number in a set of values. Ignores logical values and text
 * @param number number1,number2,... are 1 to 255 numbers, empty cells, logical values, or text numbers for which you want the minimum
 */
export function MIN(...number: IRange<number>[]): number {
  let min = Number.MAX_SAFE_INTEGER;
  for (const range of number) {
    for (const v of range.values()) {
      min = Math.min(min, v);
    }
  }
  if (min === Number.MAX_SAFE_INTEGER) return 0;
  return min;
}

/**
 * @summary Returns the smallest value in a set of values. Does not ignore logical values and text
 * @param value value1,value2,... are 1 to 255 numbers, empty cells, logical values, or text numbers for which you want the minimum
 */
export function MINA(...value: IRange[]): number {
  let min = 0;
  onFnA((v) => {
    min = Math.min(min, v);
  }, ...value);
  return min;
}

/**
 * @hidden Unimplemented
 * @summary Returns the minimum value among cells specified by a given set of conditions or criteria
 * @param maxRange is the range of cells to evaluate for the minimum value
 * @param criteriaRange is the range of cells to evaluate against the criteria
 * @param criteria is the criteria to evaluate against the criteria range
 */
export function MINIFS(
  maxRange: IRange,
  criteriaRange: IRange,
  ...criteria: IRange[]
): number {
  // FormulaContext.
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the number of permutations for a given number of objects that can be selected from the total objects
 * @param number is the total number of objects
 * @param numberChoosen is the number of objects in each permutation
 */
export function PERMUT(number: number, numberChoosen: number): number {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the number of permutations for a given number of objects (with repetitions) that can be selected from the total objects
 * @param number is the total number of objects
 * @param numberChoosen is the number of objects in each permutation
 */
export function PERMUTATIONA(number: number, numberChoosen: number): number {
  return undefined;
}

/**
 * @summary Returns the k-th smallest value in a data set. For example, the fifth smallest number
 * @param array is an array or range of numerical data for which you want to determine the k-th smallest value
 * @param k is the position (from the smallest) in the array or range of the value to return
 */
export function SMALL(array: IRange<number>, k: number): number {
  k = Math.floor(k); // Ensure k is an integer
  if (k < 1) return Number.NaN; // greater than 0

  const values: number[] = [];
  // Collect all valid numeric values from the array or range
  for (const v of array.values()) {
    values.push(v);
  }
  if (values.length === 0) return Number.NaN; // no returns
  // If k exceeds the number of values, return #NUM! error
  if (k > values.length) return Number.NaN; // no returns
  // Sort in ascending order
  values.sort((a, b) => a - b);

  // Return the k-th largest value
  return values[k - 1];
}