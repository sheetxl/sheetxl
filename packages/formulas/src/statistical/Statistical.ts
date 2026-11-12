/* cspell: disable */
import {
  FormulaContext, FormulaError, ValueKind,
  type AcceptError, type Scalar, type IFormulaContext, type IRange,
  type IRangeStats, type IReferenceRange, type Repeating, type ReportType
} from '@sheetxl/primitives';

import { aggregateIFS } from '../_utils/AggregateIFS';
import { reduceIf, countBlanks, ignoreBlanks } from '../_utils/ReduceIf';
import { rejectMatchedError } from '../_utils/Errors';
import { ValueOptionsAFunctions, ValueOptionsAverageA } from '../_utils/AValues';
import { CombinMax } from '../_utils/Combinatorics';

/**
 * Returns the average of the absolute deviations of data points from their mean. Arguments can be numbers or names, arrays, or references that contain numbers.
 * @param number are 1 to 255 arguments for which you want the average of the absolute deviations.
 */
export function AVEDEV(number: IRange<number>[]): number {
  let sum = 0;
  const arr = [];
  for (const range of number) {
    for (const v of range.values()) {
      sum += v;
      arr.push(v);
    }
  }

  const n = arr.length;
  if (n === 0) throw FormulaError.BuiltIn.Num!; // where AVERAGE, its own first step, is #DIV/0!
  const avg = sum / n;
  sum = 0;
  for (let i=0; i<n; i++) {
    sum += Math.abs(arr[i] - avg);
  }
  return sum / n;
}

/**
 * Returns the average (arithmetic mean) of its arguments, which can be numbers or names, arrays, or references that contain numbers.
 * @param number are 1 to 255 numeric arguments for which you want the average.
 */
export function AVERAGE(number: IRange<number>[]): number {
  return _snappedMean(number);
}

/**
 * Returns the average (arithmetic mean) of its arguments, evaluating text and FALSE in arguments as 0; TRUE evaluates as 1. Arguments can be numbers, names, arrays, or references.
 * @param value are 1 to 255 arguments for which you want the average.
 */
export function AVERAGEA(value: IRange<number>[]): number {
  return _snappedMean(value, ValueOptionsAverageA);
}

/**
 * Finds average(arithmetic mean) for the cells specified by a given condition or criteria.
 * @param range is the range of cells you want evaluated.
 * @param criteria is the condition or criteria in the form of a number, expression, or text that defines which cells will be used to find the average.
 * @param averageRange are the actual cells to be used to find the average. If omitted, the cells in range are used.
 */
export function AVERAGEIF(
  range: IReferenceRange,
  criteria: AcceptError<Scalar>,
  averageRange?: IReferenceRange
): Scalar {
  // The population is the NUMERIC members of the average range, NOT the matching positions —
  // the same rule AVERAGEIFS carries. Counting positions divided a sum of 6 numbers by the
  // 1,048,576 rows a whole-column "<>10" matches, and was wrong bounded too:
  // `AVERAGEIF(A1:A6,"<>10",C1:C6)` over `C = -7` then blanks is -7, not -7/6.
  const counts = reduceIf(range, criteria, averageRange,
    (accumulator: Scalar, value: Scalar): Scalar => {
      if (typeof value !== 'number') return accumulator;
      return (accumulator as number) + 1;
    },
    ignoreBlanks
  );
  const sums = reduceIf(range, criteria, averageRange,
    rejectMatchedError((accumulator: Scalar, value: Scalar): Scalar => {
      if (accumulator === null) accumulator = 0;
      if (typeof value !== 'number') return accumulator;
      return (accumulator as number) + value;
    }),
    ignoreBlanks
  );
  // A matched error reaches here as the sum — it outranks the no-match #DIV/0!.
  if (FormulaError.isError(sums)) return sums;
  if (!counts) return FormulaError.BuiltIn.Div0!; // no matches
  return (sums as number) / (counts as number);
};

/**
 * Finds average(arithmetic mean) for the cells specified by a given set of conditions or criteria.
 * @param averageRange are the actual cells to be used to find the average.
 * @param criteria the ranges to evaluate and the conditions to evaluate them against.
 * @param criteria.criteriaRange is the range of cells you want evaluated for the particular condition.
 * @param criteria.criteria is the condition or criteria in the form of a number, expression, or text that defines which cells will be used to find the average.
 */
export function AVERAGEIFS(
  averageRange: IReferenceRange,
  criteria: Repeating<[criteriaRange: IReferenceRange, criteria: AcceptError<Scalar>]>
): Scalar {
  const sums = aggregateIFS(FormulaContext, criteria,
    rejectMatchedError((acc, val) => {
      if (typeof val !== 'number') return acc; // skip non-numeric
      return acc === null ? val : (acc as number) + val;
    }),
    averageRange,
    null, // noMatchDefault
    ignoreBlanks
  );
  const counts = aggregateIFS(FormulaContext, criteria,
    (acc, val) => {
      if (typeof val !== 'number') return acc; // only count numeric matches
      return acc === null ? 1 : (acc as number) + 1;
    },
    averageRange,
    0, // noMatchDefault: 0 signals no numeric matches → #DIV/0!
    ignoreBlanks
  );
  // A matched error member reaches here as the sum — it outranks the no-match #DIV/0!.
  if (FormulaError.isError(sums)) return sums;
  return (counts === 0 || counts === null)
    ? FormulaError.BuiltIn.Div0!
    : (sums as number) / (counts as number);
}

/**
 * Finds the weighted average of a set of values, given the values and the corresponding weights.
 * @name AVERAGE.WEIGHTED
 * @param values the values to average and the weights to apply to them.
 * @param values.values are the values to be averaged.
 * @param values.weights are the corresponding weights to apply. A weight may be zero but not negative.
 * @category Sheets
 */
export function AVERAGE_WEIGHTED(
  values: Repeating<[values: IRange, weights: IRange]>
): number {
  // Every way this can be malformed is ONE error, #VALUE!: a shape that does not pair up, a
  // member that is not a number — blank included, so this tolerates NOTHING the way the AVERAGE
  // family tolerates text and empties — or a weight below zero. That is what Sheets does, and it
  // is not what the shape of the function suggests: #NUM! for the negative weight and #N/A for
  // the shape are both wrong, and so is a blank skipping its pair.
  //
  // That every member must be a number is what makes the validation O(1) per argument rather
  // than a walk: `numericalCount` short of the extent means SOMETHING in there is not a number,
  // and `min` carries the sign test. Both come off the same cached aggregates, so a whole-column
  // argument is rejected without visiting a cell. Errors never reach here — no `AcceptError`, so
  // the engine's reject default has already propagated them.
  let products = 0;
  let weightTotal = 0;
  const groupCount = values.length;
  for (let i=0; i<groupCount; i++) {
    const [value, weight] = values[i];
    // Shape, not member count: a group is one list of values against ONE weight per value, so a
    // 2x1 against a 1x2 is a mismatch rather than a reshape (contrast the SUMX2MY2 family, which
    // is documented to pair by flattened ordinal).
    const size = value.getRowCount() * value.getColumnCount();
    if (value.getRowCount() !== weight.getRowCount()
      || value.getColumnCount() !== weight.getColumnCount()) {
      throw FormulaError.BuiltIn.Value;
    }
    const weightAggregates = weight.getStats().getAggregates();
    if (value.getStats().getAggregates().numericalCount !== size
      || weightAggregates.numericalCount !== size
      || (weightAggregates.min ?? 0) < 0) {
      throw FormulaError.BuiltIn.Value;
    }
    // Both sides are now known dense and numeric, so the fold is arithmetic and nothing else.
    (value as IRange).alignReduce<number, null>([weight as IRange], (acc, aligned) => {
      const w = aligned[1]!;
      products += aligned[0]! * w;
      weightTotal += w;
      return acc;
    }, null);
  }
  // Every weight zero — nothing to divide by. An empty group lands here too, for the same reason.
  if (weightTotal === 0) throw FormulaError.BuiltIn.Div0;
  return products / weightTotal;
}

/**
 * Counts the number of cells in a range that contain numbers.
 * @param number are 1 to 255 arguments that can contain or refer to a variety of different types of data, but only numbers are counted.
 */
export function COUNT(number: AcceptError<IRange<number>>[]): number {
  let numCnt = 0;
  for (const range of number) {
    if (FormulaError.isError(range)) continue; // a bare error is a value, and not a number
    numCnt += range.getStats().getAggregates().numericalCount ?? 0;
  }
  return numCnt;
}

/**
 * Counts the number of cells in a range that are not empty.
 * @param value are 1 to 255 arguments representing the values and cells you want to count. Values can be any type of information.
 */
export function COUNTA(value: AcceptError<IRange<number>>[]): number {
  // COUNTA counts POSITIONS, and only an empty CELL is not one. A blank anywhere else occupies
  // its position and counts: a blank member of a value array (`COUNTA(TOCOL(<1,blank,3>,0))` is
  // 3 where `COUNTA(<1,blank,3>)` is 2), and a blank handed over directly. That is why the same
  // grid counts 9 through CHOOSEROWS and 8 through TAKE — the shaper answers with an array and
  // TAKE with a reference. Every OTHER aggregate over the same array — COUNT, AVERAGE, AVERAGEA,
  // MEDIAN, MIN, STDEV.P — skips the blank exactly as it does in a reference, so the rule is
  // COUNTA's alone.
  const args = FormulaContext.getArgs().getRepeatingArgsAt(0);
  let count = 0;
  for (let i=0; i<value.length; i++) {
    const range = value[i];
    if (FormulaError.isError(range)) { count++; continue; } // a bare error is one value
    // The area itself says whether it is a reference. `value` runs one entry per AREA and the
    // argument view one per argument, so an argument that is several areas — a union, or a 3-D
    // span across sheets — puts every later area at an argument index that does not match it.
    const isReference = (range as IReferenceRange).isIReferenceRange === true
      || args.getKindAt(i) === ValueKind.Reference;
    count += isReference
      ? range.getStats().getAggregates().count ?? 0
      : range.getRowCount() * range.getColumnCount();
  }
  return count;
}

/**
 * Counts the number of empty cells in a specified range of cells.
 * @param range is the range from which you want to count the empty cells.
 */
export function COUNTBLANK(range: IReferenceRange): number | FormulaError.Known {
  // A reference UNION is `#VALUE!` here, where the aggregates flatten one. The slot
  // takes a reference whole, so the areas reach the body and only the argument view separates
  // `COUNTBLANK((A1:A5,B1:B2))` from a single range.
  if (FormulaContext.getArgs().getAreaCountAt(0) > 1) return FormulaError.BuiltIn.Value!;
  // A cell holding the EMPTY STRING counts as blank — typed as text or returned by a formula
  // alike — while a cell holding a single space does not. COUNTA counts the same empty-string
  // cell as a value, so the two deliberately disagree about it.
  let occupied = 0;
  for (const { value } of range.entries({ includeEmpty: false })) {
    if (value !== '') occupied++;
  }
  return (range.getColumnCount() * range.getRowCount()) - occupied;
}

/**
 * Counts the number of cells within a range that meet the given condition.
 * @param range is the range of cells from which you want to count nonblank cells.
 * @param criteria is the condition in the form of a number, expression, or text that defines which cells will be counted.
 */
export function COUNTIF(
  range: IReferenceRange,
  criteria: AcceptError<Scalar>
): Scalar {
  return reduceIf(
    range,
    criteria,
    undefined,
    (accumulator: Scalar) => {
      if (accumulator === null) return 1;
      return (accumulator as number) + 1;
    },
    countBlanks
  );
}

/**
 * Counts the number of cells specified by a given set of conditions or criteria.
 * @param criteria the ranges to evaluate and the conditions to evaluate them against.
 * @param criteria.criteriaRange is the range of cells you want evaluated for the particular condition.
 * @param criteria.criteria is the condition in the form of a number, expression, or text that defines which cells will be counted.
 */
export function COUNTIFS(
  criteria: Repeating<[criteriaRange: IReferenceRange, criteria: AcceptError<Scalar>]>
): Scalar {
  return aggregateIFS(
    FormulaContext, criteria,
    (acc) => acc === null ? 1 : (acc as number) + 1,
    undefined, // aggRange
    0, // noMatchDefault
    countBlanks
  ) as unknown as Scalar;
}

/**
 * Counts the number of unique values in a list of specified values and ranges.
 * @param value are the values or ranges to consider for uniqueness.
 * @category Sheets
 */
export function COUNTUNIQUE(value: AcceptError<IRange>[]): number {
  // One sparse pass per argument, keys straight into a set. `values()` skips empties, which is
  // the rule — a blank is not a value. An error IS one, and distinct codes stay distinct
  // (in Sheets a column of #DIV/0!, #N/A, #DIV/0! is 2).
  //
  // Not `getFrequencies`, and not `uniqueIndices`: both build a value-and-count map this needs
  // no part of, and reaching either for the multi-argument form means joining the arguments
  // into one grid first (`concat` pads the narrower side with #N/A BY DEFAULT — those pads are
  // stored members, so the join both copies and miscounts unless the blank pad is passed).
  const seen = new Set<string>();
  const argCount = value.length;
  for (let i=0; i<argCount; i++) {
    const arg = value[i];
    if (FormulaError.isError(arg)) { seen.add(_sheetsDistinctKey(arg)); continue; } // one value
    for (const member of arg.values()) {
      seen.add(_sheetsDistinctKey(member));
    }
  }
  return seen.size;
}

/**
 * Counts the number of unique values in a range of cells, filtered by a set of criteria.
 * @param countUniqueRange is the range from which the unique values will be counted.
 * @param criteria the ranges to evaluate and the conditions to evaluate them against.
 * @param criteria.criteriaRange is the range of cells you want evaluated for the particular condition.
 * @param criteria.criteria is the condition in the form of a number, expression, or text that defines which cells will be counted.
 * @category Sheets
 */
export function COUNTUNIQUEIFS(
  countUniqueRange: IRange,
  criteria: Repeating<[criteriaRange: IReferenceRange, criteria: AcceptError<Scalar>]>
): number {
  const rowCount = countUniqueRange.getRowCount();
  const colCount = countUniqueRange.getColumnCount();
  const criteriaCount = criteria.length;
  const criteriaRanges: IReferenceRange[] = new Array(criteriaCount);
  const evaluators: IFormulaContext.CriteriaEvaluator[] = new Array(criteriaCount);
  for (let i=0; i<criteriaCount; i++) {
    const criteriaRange = criteria[i][0];
    // Sheets requires the counted range and EVERY criteria range to be the same shape — unlike
    // the *IFS family, which only compares the criteria ranges to each other.
    if (criteriaRange.getRowCount() !== rowCount || criteriaRange.getColumnCount() !== colCount) {
      throw FormulaError.BuiltIn.Value;
    }
    criteriaRanges[i] = criteriaRange;
    evaluators[i] = FormulaContext.createCriteria(criteria[i][1]);
  }
  // One sparse pass, no mask and no random access — the same lockstep merge `aggregateIFS` uses,
  // and for the same reason: reading each criteria cell by coordinate is a per-cell lookup into
  // a sparse grid, which is what makes a whole-column argument expensive. `alignReduce` races
  // the sides' STORED members instead, so a position blank everywhere is never visited.
  //
  // No `emptyFold` is needed, unlike the *IFS family: a blank in the counted range can never be
  // a unique value, so the blank positions contribute nothing no matter what the criteria say.
  // Keys go into a set with COUNTUNIQUE's own key function, so the two agree on what "the same
  // value" means.
  const seen = new Set<string>();
  (countUniqueRange as IRange).alignReduce<Scalar, null>(criteriaRanges, (acc, aligned) => {
    const value = aligned[0];
    if (value === null) return acc;
    for (let i=0; i<criteriaCount; i++) {
      if (!evaluators[i](aligned[i + 1])) return acc;
    }
    seen.add(_sheetsDistinctKey(value));
    return acc;
  }, null);
  return seen.size;
}

/**
 * Returns the k-th largest value in a data set. For example, the fifth largest number.
 * @param array is the array or range of data for which you want to determine the k-th largest value.
 * @param k is the position (from the largest) in the array or cell range of the value to return.
 */
export function LARGE(
  array: ReportType<IRange<number>>,
  k: number
): number {
  const result = FormulaContext.flattenAreas(array).getStats().getSortedNumbers().getLarge(k);
  if (result === null) return Number.NaN; // #NUM! - k out of range
  return result;
}

/**
 * Returns the largest value in a set of values. Ignores logical values and text.
 * @param number are 1 to 255 numbers, empty cells, logical values, or text numbers for which you want the maximum.
 */
export function MAX(number: IRange<number>[]): number {
  return _extreme(number, true);
}

/**
 * Returns the largest value in a set of values. Does not ignore logical values and text.
 * @param value are 1 to 255 numbers, empty cells, logical values, or text numbers for which you want the maximum.
 */
export function MAXA(value: IRange<number>[]): number {
  return _extreme(value, true, ValueOptionsAFunctions);
}

/**
 * Returns the maximum value for the cells within a range that meet the given condition.
 * @param range is the range of cells from which you want to find the maximum nonblank cells.
 * @param criteria is the condition in the form of a number, expression, or text that defines which cells will be counted.
 * @param maxRange are the actual cells to be used to find the maximum. If omitted, the cells in range are used.
 * @category SheetXL
 */
export function MAXIF(
  range: IReferenceRange,
  criteria: Scalar,
  maxRange?: IReferenceRange
): Scalar {
  return reduceIf(
    range,
    criteria,
    maxRange,
    rejectMatchedError((accumulator: Scalar, value: Scalar) => {
      if (typeof value !== 'number') return accumulator ?? 0; // mimic MAXIFS
      if (accumulator === null) return value; // first match
      return Math.max(accumulator as number, value as number);
    }),
    ignoreBlanks
  );
}

/**
 * Returns the maximum value among cells specified by a given set of conditions or criteria.
 * @param maxRange the cells in which to determine the maximum value.
 * @param criteria the ranges to evaluate and the conditions to evaluate them against.
 * @param criteria.criteriaRange is the range of cells you want to evaluate for the particular condition.
 * @param criteria.criteria is the condition or criteria in the form of a number, expression, or text that defines which cells will be included when determining the maximum value.
 */
export function MAXIFS(
  maxRange: IReferenceRange,
  criteria: Repeating<[criteriaRange: IReferenceRange, criteria: AcceptError<Scalar>], 254>
): Scalar {
  return aggregateIFS(FormulaContext, criteria,
    rejectMatchedError((acc, val) => {
      if (typeof val !== 'number') return acc; // skip non-numeric
      return acc === null ? val : Math.max(acc as number, val as number);
    }),
    maxRange,
    0, // noMatchDefault
    ignoreBlanks
  ) as unknown as Scalar;
}

/**
 * Returns the median, or the number in the middle of the set of given numbers.
 * @param number are 1 to 255 numbers or names, arrays, or references that contain numbers for which you want the median.
 */
export function MEDIAN(number: IRange<number>[]): number {
  // Note - We can't use getStats().getSortedNumbers() here because median needs to consider all values across
  // TODO - Add a getStats(ranges) to allow for multi-range aggregation (with without) without flattening
  const values: number[] = [];
  // Collect all valid numeric values from the array or range
  for (const range of number) {
    for (const v of range.values()) {
      values.push(v);
    }
  }

  // Step 2: Return error if no numeric values found
  if (values.length === 0) return Number.NaN; // #NUM!

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
 * Returns the smallest number in a set of values. Ignores logical values and text.
 * @param number are 1 to 255 numbers, empty cells, logical values, or text numbers for which you want the minimum.
 */
export function MIN(number: IRange<number>[]): number {
  return _extreme(number, false);
}

/**
 * Returns the smallest value in a set of values. Does not ignore logical values and text.
 * @param value are 1 to 255 numbers, empty cells, logical values, or text numbers for which you want the minimum.
 */
export function MINA(value: IRange<number>[]): number {
  return _extreme(value, false, ValueOptionsAFunctions);
}

/**
 * Returns the minimum value for the cells within a range that meet the given condition.
 * @param range is the range of cells from which you want to count nonblank cells.
 * @param criteria is the condition in the form of a number, expression, or text that defines which cells will be counted.
 * @param minRange are the actual cells to be used to find the minimum. If omitted, the cells in range are used.
 * @category SheetXL
 */
export function MINIF(
  range: IReferenceRange,
  criteria: Scalar,
  minRange?: IReferenceRange
): Scalar {
  return reduceIf(
    range,
    criteria,
    minRange,
    rejectMatchedError((accumulator: Scalar, value: Scalar) => {
      if (typeof value !== 'number') return accumulator ?? 0; // mimic MINIFS
      if (accumulator === null) return value; // first match
      return Math.min(accumulator as number, value as number);
    }),
    ignoreBlanks
  );
}

/**
 * Returns the minimum value among cells specified by a given set of conditions or criteria.
 * @param minRange is the range of cells to evaluate for the minimum value.
 * @param criteria the ranges to evaluate and the conditions to evaluate them against.
 * @param criteria.criteriaRange is the range of cells to evaluate against the criteria.
 * @param criteria.criteria is the criteria to evaluate against the criteria range.
 */
export function MINIFS(
  minRange: IReferenceRange,
  criteria: Repeating<[criteriaRange: IReferenceRange, criteria: AcceptError<Scalar>], 254>
): Scalar {
  return aggregateIFS(FormulaContext, criteria,
    rejectMatchedError((acc, val) => {
      if (typeof val !== 'number') return acc; // skip non-numeric
      return acc === null ? val : Math.min(acc as number, val as number);
    }),
    minRange,
    0, // noMatchDefault
    ignoreBlanks
  ) as unknown as Scalar;
}

/**
 * Returns the number of permutations for a given number of objects that can be selected from the total objects.
 * @param number is the total number of objects.
 * @param numberChoosen is the number of objects in each permutation.
 */
export function PERMUT(
  number: number,
  numberChoosen: number
): number {
  number = Math.trunc(number);
  numberChoosen = Math.trunc(numberChoosen);

  if (number < 0 || numberChoosen < 0 || numberChoosen > number) {
    return Number.NaN; // #NUM!
  }
  if (number > CombinMax) return Number.NaN; // #NUM! — a count stops one short of INT_MAX

  let result = 1;
  for (let i=number; i>number - numberChoosen; i--) {
    result *= i;
    if (!Number.isFinite(result)) return Number.NaN; // #NUM! — past a double, and the walk is over
  }
  return result;
}

/**
 * Returns the number of permutations for a given number of objects (with repetitions) that can be selected from the total objects.
 * @param number is the total number of objects.
 * @param numberChoosen is the number of objects in each permutation.
 */
export function PERMUTATIONA(
  number: number,
  numberChoosen: number
): number {
  number = Math.trunc(number);
  numberChoosen = Math.trunc(numberChoosen);

  if (number < 0 || numberChoosen < 0) {
    return Number.NaN; // #NUM!
  }
  if (number > CombinMax || numberChoosen > CombinMax) return Number.NaN; // #NUM! — a count stops one short of INT_MAX

  return Math.pow(number, numberChoosen);
}

/**
 * Returns the k-th smallest value in a data set. For example, the fifth smallest number.
 * @param array is an array or range of numerical data for which you want to determine the k-th smallest value.
 * @param k is the position (from the smallest) in the array or range of the value to return.
 */
export function SMALL(
  array: ReportType<IRange<number>>,
  k: number
): number {
  array = FormulaContext.flattenAreas(array); // a union answers over every area
  const result = array.getStats().getSortedNumbers().getSmall(k);
  if (result === null) return Number.NaN; // #NUM! - k out of range
  return result;
}

// helpers

/**
 * Distinctness for the COUNTUNIQUE pair: type-tagged, so `0`, `"0"` and FALSE never collide,
 * and text compared RAW.
 *
 * @remarks
 * This is `defaultFrequencyKey` (the key behind `UNIQUE()`, `uniqueIndices` and
 * `getFrequencies`) with one deliberate difference, and the tags are kept identical so the two
 * agree everywhere else.
 * Excel folds text for case and accent when deciding what one value is; Sheets does not, and
 * `COUNTUNIQUE({"a";"A"})` is 2 there against `UNIQUE`'s 1 here. A Sheets-compatible function
 * has to answer the Sheets way, so it cannot share the default.
 */
const _sheetsDistinctKey = (value: Scalar): string => {
  if (value === null) return '\x00';
  const type = typeof value;
  if (type === 'number')  return '\x01' + (value as number).toString();
  if (type === 'string')  return '\x02' + (value as string);
  if (type === 'boolean') return '\x03' + (value ? '1' : '0');
  if (FormulaError.isError(value)) return '\x04' + (value as FormulaError.Known).getCode();
  return '\x05' + String(value); // rich data / anything else — identity by string form
};

/**
 * MAX, MIN and their A twins: the extreme over every argument, or 0 when no argument held a
 * number at all.
 *
 * @remarks
 * The zero has to come from a COUNT rather than from a starting value, because every candidate
 * starting value is also a legal answer: seeded at `MIN_SAFE_INTEGER`, `MAX(-1,-2,-4)` answered
 * 0, and seeded at `MAX_SAFE_INTEGER`, `MIN(1E307,2E307)` answered it back.
 */
const _extreme = (
  ranges: readonly IRange<number>[],
  largest: boolean,
  optionsValue?: IRange.ValueOptions
): number => {
  let best = 0;
  let seen = false;
  for (const range of ranges) {
    const aggs = range.getStats(optionsValue).getAggregates();
    if (!aggs.numericalCount) continue;
    const value = (largest ? aggs.max : aggs.min) as number;
    if (!seen) best = value;
    else best = largest ? Math.max(best, value) : Math.min(best, value);
    seen = true;
  }
  return seen ? best : 0;
};


/**
 * AVERAGE and AVERAGEA: the arithmetic mean over every argument, with cancellation snap
 * applied to the SUM and the division running after.
 *
 * @remarks
 * Snapping the MEAN instead is wrong — at an exponent gap of 49 the sum survives and the
 * AVERAGE is `8.88178419700125E-16`, which is itself 50 below the operands and would
 * have been zeroed. The snap is judged on the last accumulation step, so the running total goes
 * to the last argument that contributed a number (`IRangeStats.getSnappedSum`).
 *
 * The `*IF`/`*IFS` averages are on the other side of the split and never snap.
 */
const _snappedMean = (
  ranges: readonly IRange<number>[],
  optionsValue?: IRange.ValueOptions
): number => {
  let sum = 0;
  let numCount = 0;
  let last: IRangeStats | null = null;
  for (const range of ranges) {
    const stats = range.getStats(optionsValue);
    const aggs = stats.getAggregates();
    sum += aggs.sum ?? 0;
    numCount += aggs.numericalCount ?? 0;
    if (aggs.numericalCount > 0) last = stats;
  }
  if (numCount === 0) throw FormulaError.BuiltIn.Div0!;
  return (last ? last.getSnappedSum(sum) : sum) / numCount;
};
