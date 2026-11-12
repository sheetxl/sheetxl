/* cspell: disable */
import {
  ValueKind, FormulaContext, FormulaError, IRange,
  type IRangeStats, type Scalar, type Volatile, type IReferenceRange, type AcceptError, type IFormulaContext,
  type Repeating, type Omittable, type NoLift, type NoFilter, type ReportType
} from '@sheetxl/primitives';

import { flushSubnormal, round15, excelCount } from '../_utils/Arithmetic';
import { determinant, invert } from '../_utils/Matrix';
import { aggregateIFS } from '../_utils/AggregateIFS';
import { reduceIf, ignoreBlanks } from '../_utils/ReduceIf';
import { pairedMemberError, rejectMatchedError } from '../_utils/Errors';
import { factorialKernel, binomialKernel, CombinMax } from '../_utils/Combinatorics';
import { readIntersectedCell } from '../_utils/FirstCell';

/**
 * Returns the absolute value of a number, a number without its sign.
 * @param number is the real number for which you want the absolute value.
 */
export function ABS(number: number): number {
  return Math.abs(number);
}

/**
 * AGGREGATE's LARGE (code 14) and SMALL (code 15): a 1-based rank `k`, valid on `1 <= k <= n`
 * against the RAW value, turned into a 0-based index that is what truncates.
 */
const rankAt = (values: readonly number[], k: number, largest: boolean): Scalar => {
  const n = values.length;
  if (n === 0 || k < 1 || k > n) return FormulaError.BuiltIn.Num!;
  return values[Math.trunc(largest ? n - k : k - 1)];
};

/**
 * The calculation AGGREGATE performs.
 *
 * @remarks
 * Declared `ReportType`, as every numeric built-in enum is: the argument is TRUNCATED (`9.9`
 * is SUM), which an enum's gate does not do, so the body keeps the verdict. Also the
 * overload discriminant: 14-19 take a trailing `k`.
 */
enum AggregateFunction {
  /**
   * The average of the values.
   * @name AVERAGE
   */
  Average = 1,
  /**
   * How many values are numbers.
   * @name COUNT
   */
  Count = 2,
  /**
   * How many values are not empty.
   * @name COUNTA
   */
  CountA = 3,
  /**
   * The largest value.
   * @name MAX
   */
  Max = 4,
  /**
   * The smallest value.
   * @name MIN
   */
  Min = 5,
  /**
   * The product of the values.
   * @name PRODUCT
   */
  Product = 6,
  /**
   * The standard deviation of a sample.
   * @name STDEV.S
   */
  StdevS = 7,
  /**
   * The standard deviation of a whole population.
   * @name STDEV.P
   */
  StdevP = 8,
  /**
   * The sum of the values.
   * @name SUM
   */
  Sum = 9,
  /**
   * The variance of a sample.
   * @name VAR.S
   */
  VarS = 10,
  /**
   * The variance of a whole population.
   * @name VAR.P
   */
  VarP = 11,
  /**
   * The middle value.
   * @name MEDIAN
   */
  Median = 12,
  /**
   * The most frequent value.
   * @name MODE.SNGL
   */
  ModeSngl = 13,
  /**
   * The k-th largest value.
   * @name LARGE
   */
  Large = 14,
  /**
   * The k-th smallest value.
   * @name SMALL
   */
  Small = 15,
  /**
   * The k-th percentile, k from 0 to 1 inclusive.
   * @name PERCENTILE.INC
   */
  PercentileInc = 16,
  /**
   * The quartile k, from 0 to 4 inclusive.
   * @name QUARTILE.INC
   */
  QuartileInc = 17,
  /**
   * The k-th percentile, k from 0 to 1 exclusive.
   * @name PERCENTILE.EXC
   */
  PercentileExc = 18,
  /**
   * The quartile k, from 1 to 3 exclusive.
   * @name QUARTILE.EXC
   */
  QuartileExc = 19,
}

/**
 * What AGGREGATE leaves out.
 *
 * @remarks
 * Declared `ReportType`, as every numeric built-in enum is: the argument is TRUNCATED (`6.9`
 * is 6), which an enum's gate does not do, so the body keeps the verdict.
 */
enum AggregateOptions {
  /**
   * Ignore nested SUBTOTAL and AGGREGATE functions.
   * @name Ignore nested SUBTOTAL and AGGREGATE functions
   */
  IgnoreNested = 0,
  /**
   * Ignore hidden rows, nested SUBTOTAL and AGGREGATE functions.
   * @name Ignore hidden rows, nested SUBTOTAL and AGGREGATE functions
   */
  IgnoreHiddenNested = 1,
  /**
   * Ignore error values, nested SUBTOTAL and AGGREGATE functions.
   * @name Ignore error values, nested SUBTOTAL and AGGREGATE functions
   */
  IgnoreErrorsNested = 2,
  /**
   * Ignore hidden rows, error values, nested SUBTOTAL and AGGREGATE functions.
   * @name Ignore hidden rows, error values, nested SUBTOTAL and AGGREGATE functions
   */
  IgnoreHiddenErrorsNested = 3,
  /**
   * Ignore nothing.
   * @name Ignore nothing
   */
  IgnoreNothing = 4,
  /**
   * Ignore hidden rows.
   * @name Ignore hidden rows
   */
  IgnoreHidden = 5,
  /**
   * Ignore error values.
   * @name Ignore error values
   */
  IgnoreErrors = 6,
  /**
   * Ignore hidden rows and error values.
   * @name Ignore hidden rows and error values
   */
  IgnoreHiddenErrors = 7,
}

/**
 * Returns an aggregate in a list or database.
 * @param functionNum The function to use: 1-19.
 * @param options The options for the aggregate: 0-7.
 * @param array The ranges to aggregate.
 * @param KOrRest If functionNum is 14-19, this is the k value. Otherwise, this is the first of the ranges to aggregate.
 *
 * @remarks
 * Nested SUBTOTAL and AGGREGATE results are always excluded, regardless of `options`.
 */
export function AGGREGATE(
  functionNum: ReportType<AggregateFunction>,
  options: ReportType<AggregateOptions>,
  array: ReportType<IRange>,
  ...KOrRest: Repeating<IRange, 254>
): Scalar { // number
  // A union arrives as one range per area (`ReportType`) and aggregates over all of them. It IS a
  // reference, so the reference-form guard below is answered from the ARGUMENT — the flattened
  // values are a created range and would fail it.
  const isUnionAtArray = FormulaContext.getArgs().getAreaCountAt(2) > 1;
  array = FormulaContext.flattenAreas(array);
  const code = Math.trunc(functionNum);
  const opt = Math.trunc(options);

  if (code < 1 || code > 19) return FormulaError.BuiltIn.Value!;
  if (opt < 0 || opt > 7) return FormulaError.BuiltIn.Value!;

  // Codes 14-19 take a trailing k argument; every argument is marshalled as a range, so k arrives
  // as a 1x1 one. It is EXACTLY one argument: a second reference beside it and a missing one are
  // both #VALUE! — the arity of this function depends on the value of its first argument, which
  // is why the check is here and not in the declaration.
  //
  // `k` is a plain VALUE slot, so a multi-cell REFERENCE there is implicitly INTERSECTED
  // against the formula's own row rather than refused — the `@` rule in value mode, and the
  // reference's first cell in array mode.
  // A multi-cell ARRAY at the slot should LIFT and is still refused here — that half needs a
  // declaration that can call one rest parameter references for codes 1-13 and a value for 14-19.
  const needsK = code >= 14;
  const kRange = needsK ? KOrRest[0] : undefined;
  const kIsReference = !!(kRange as IReferenceRange)?.isIReferenceRange;
  if (needsK && (KOrRest.length !== 1 || (kRange != null && kRange.size !== 1 && !kIsReference))) {
    return FormulaError.BuiltIn.Value!;
  }
  const refs: IRange[] = needsK ? [array] : [array, ...KOrRest];

  let k = 0;
  if (needsK && KOrRest[0] != null) {
    // An OMITTED k is the third position (memory: blank-slot-vs-blank-cell) and reads as 0, which
    // is out of range: `AGGREGATE(14,0,A1:A5,)` is #NUM! where the argument's ABSENCE is #VALUE!.
    const raw = readIntersectedCell(KOrRest[0]);
    if (FormulaError.isError(raw)) throw raw;
    // The k slot coerces the way an ordinary numeric argument does — TRUE is 1, "2" is 2, a blank
    // is 0 — and text that is not a number is #VALUE! where an out-of-range number is #NUM!.
    if (typeof raw === 'number') k = raw;
    else if (typeof raw === 'boolean') k = raw ? 1 : 0;
    else if (raw === null) k = 0;
    else {
      const parsed = typeof raw === 'string' ? Number(raw.trim()) : Number.NaN;
      if (raw === '' || Number.isNaN(parsed)) return FormulaError.BuiltIn.Value!;
      k = parsed;
    }
  }

  // Codes 1-13 (reference form) take references only; 14-19 (array form) accept arrays.
  if (!needsK) {
    for (let i=0; i<refs.length; i++) {
      if (i === 0 && isUnionAtArray) continue;
      if (!(refs[i] as IReferenceRange)?.isIReferenceRange) return FormulaError.BuiltIn.Value!;
    }
  }

  const ignoreHidden = opt === 1 || opt === 3 || opt === 5 || opt === 7;
  const ignoreErrors = opt === 2 || opt === 3 || opt === 6 || opt === 7;
  // Options 0-3 skip a cell that is itself a SUBTOTAL or AGGREGATE call and 4-7 do NOT — the
  // half of the options table that has nothing to do with hidden rows or errors. Over a column
  // whose second cell holds `=SUBTOTAL(9,…)`, `AGGREGATE(9,0,…)` is 18 and `AGGREGATE(9,4,…)`
  // is 38.
  const ignoreTotals = opt <= 3;

  let ranges = (ignoreHidden
    ? refs.map(r => FormulaContext.filterHidden(r))
    : refs
  );
  if (ignoreTotals) ranges = ranges.map(r => FormulaContext.filterTotals(r));

  if (ignoreErrors) {
    ranges = ranges.map(r => r.filter((v: Scalar) => !FormulaError.isError(v)));
  } else if (code !== 2 && code !== 3) {
    // Errors propagate except for the count codes, which count like COUNT/COUNTA.
    for (const range of ranges) {
      if (range.hasError()) return range.firstError()!;
    }
  }

  // Pad with empty, not `concat`'s default #N/A: arguments of differing widths must not add
  // phantom members.
  const combined = ranges.reduce((acc, r) => acc.concat(r, IRange.Axis.Row, null));
  const agg: Readonly<IRangeStats.Aggregates> = combined.getStats().getAggregates();
  const sorted = () => combined.getStats().getSortedNumbers();

  switch (code) {
    case 1: {
      const n = agg.numericalCount ?? 0;
      if (n === 0) throw FormulaError.BuiltIn.Div0!;
      return combined.getStats().getSnappedSum() / n;
    }
    case 2:  return agg.numericalCount ?? 0;
    case 3:  return combined.getStats().getCount();
    case 4:  return agg.max ?? 0;
    case 5:  return agg.min ?? 0;
    case 6: {
      let product = 1; let found = false;
      combined.forEach((v: Scalar) => { if (typeof v === 'number') { product *= v; found = true; } });
      return found ? product : 0;
    }
    case 7:  { if ((agg.numericalCount ?? 0) < 2) throw FormulaError.BuiltIn.Div0!; return agg.stdDev!; }
    case 8:  { if ((agg.numericalCount ?? 0) < 1) throw FormulaError.BuiltIn.Div0!; return agg.stdDevP!; }
    case 9:  return combined.getStats().getSnappedSum();
    case 10: { if ((agg.numericalCount ?? 0) < 2) throw FormulaError.BuiltIn.Div0!; return agg.var!; }
    case 11: { if ((agg.numericalCount ?? 0) < 1) throw FormulaError.BuiltIn.Div0!; return agg.varP!; }
    case 12: return sorted().getPercentile(0.5) ?? FormulaError.BuiltIn.Num!;
    case 13: {
      const freq = combined.getStats().getFrequencies({ filterFn: v => typeof v === 'number' });
      const first = freq.getValueCounts({ sortBy: 'frequency', descending: true }).next();
      // MODE.SNGL is #N/A when nothing REPEATS, which includes an empty set.
      if (first.done || (first.value[1] as number) < 2) return FormulaError.BuiltIn.NA!;
      return first.value[0];
    }
    // LARGE and SMALL take a 1-based rank, and a FRACTIONAL one is not truncated the way the
    // `options` slot is: the rank becomes a 0-based INDEX first and the index is what truncates.
    // `AGGREGATE(14,…,2.1)` is the third largest and `AGGREGATE(15,…,2.9)` is the second
    // smallest, which is `trunc(n - k)` on one side and `trunc(k - 1)` on the other. The domain
    // is checked on the RAW k, so 0.5 is #NUM! where its index would have been legal.
    case 14: return rankAt(sorted().getValues(), k, true);
    case 15: return rankAt(sorted().getValues(), k, false);
    // PERCENTILE codes take k as a 0..1 fraction; QUARTILE codes take 0..4 and TRUNCATE it.
    case 16: return sorted().getPercentile(k) ?? FormulaError.BuiltIn.Num!; // #NUM!
    case 17: return sorted().getPercentile(Math.trunc(k) / 4) ?? FormulaError.BuiltIn.Num!; // #NUM!
    case 18: return sorted().getPercentile(k, true) ?? FormulaError.BuiltIn.Num!; // #NUM!
    case 19: return sorted().getPercentile(Math.trunc(k) / 4, true) ?? FormulaError.BuiltIn.Num!; // #NUM!
    default: return FormulaError.BuiltIn.Value!;
  }
}

/**
 * Converts a Roman numeral to Arabic.
 * @param text is the Roman numeral you want to convert.
 */
export function ARABIC(text: string): number {
  if (text.length > NumeralTextMax) throw new FormulaError.Value('Roman numeral too long in ARABIC evaluation.');
  // A space, tab, newline or carriage return at either end is dropped; a vertical tab, a form
  // feed and a non-breaking space are not, so `ARABIC(" MCMXC ")` is 1990 and
  // `ARABIC(CHAR(160)&"I")` is #VALUE!. DECIMAL, reading the same kind of text, drops only a
  // space or a tab and only at the FRONT.
  const body = text.replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, '');
  const negative = body.startsWith('-');
  const digits = negative ? body.slice(1) : body;
  if (negative && digits === '') throw FormulaError.BuiltIn.Num;
  // Excel reads a numeral RIGHT TO LEFT against the largest value seen so far, which is why it
  // answers for spellings the regular grammar refuses: "MMMM" is 4000, "IIII" is 4, "IC" is 99
  // and "IIX" is 8 — where reading each digit against only its NEIGHBOUR would make it 10.
  let total = 0;
  let highest = 0;
  for (let i=digits.length - 1; i>=0; i--) {
    const value = RomanDigits[digits[i].toUpperCase()];
    if (value === undefined) {
      throw new FormulaError.Value('Invalid roman numeral in ARABIC evaluation.');
    }
    if (value < highest) {
      total -= value;
    } else {
      total += value;
      highest = value;
    }
  }
  return negative ? -total : total;
}

/**
 * Converts a number into a text representation with the given radix (base).
 * @param number is the number that you want to convert.
 * @param radix is the base Radix that you want to convert the number into.
 * @param minLength is the minimum length of the returned string.
 *
 * @remarks
 * Zero has NO digits and `min_length` only pads them: `BASE(0,16,0)` is the empty string, and
 * `BASE(0,16)` is "0" because an ABSENT `min_length` is 1 where an empty slot is 0.
 *
 * `number` and `min_length` are refused on the RAW argument, before the truncation each of them
 * takes, so `BASE(-0.5,16)` is `#NUM!`. The pad reaches 255 characters and no further.
 */
export function BASE(
  number: number,
  radix: number,
  minLength: Omittable<number>=1
): string | number {
  if (number < 0 || minLength < 0) return Number.NaN;
  const value = Math.trunc(number);
  const base = Math.trunc(radix);
  const pad = Math.trunc(minLength);

  if (value >= 2 ** 53) return Number.NaN;
  if (base < 2 || base > 36) return Number.NaN;
  if (pad > NumeralTextMax) return Number.NaN;

  const digits = value === 0 ? '' : value.toString(base).toUpperCase();
  return digits.padStart(pad, '0');
}

/**
 * Rounds a number up, to the nearest multiple of significance.
 * @param number is the value you want to round.
 * @param significance is the multiple to which you want to round.
 * @category Compatibility
 */
export function CEILING(
  number: number,
  significance: number
): number {
  if (significance === 0) return 0;
  // A SUBNORMAL significance is #DIV/0! and a ZERO one is not — the two are different rules, and
  // only the subnormal reaches the division (memory: subnormal-flush-is-the-operator). It
  // outranks the sign refusal below: `CEILING(1,-EXP(-745))` is #DIV/0!, not #NUM!. All eight
  // spellings agree, and they agree by funnelling through here and through FLOOR.
  if (flushSubnormal(significance) === 0) throw FormulaError.BuiltIn.Div0!;
  // Mixed signs are #NUM!, even for an exact multiple.
  if (number > 0 && significance < 0) return Number.NaN;

  const absSignificance = Math.abs(significance!);
  const quotient = round15(Math.abs(number) / absSignificance);
  // Every answer is rebuilt from the 15-digit quotient; the operand is never echoed back, not even
  // when it is already an exact multiple. That is what makes `CEILING(0.7+0.1,0.1)` 0.8,
  // `CEILING(2^53,1)` 9007199254740990 and `CEILING(1E-300,1E307)` 0.
  if (quotient % 1 === 0) return (number < 0 ? -1 : 1) * quotient * absSignificance;

  const times = Math.floor(quotient);
  if (number < 0) {
    // round down, away from zero
    const roundDown = significance! < 0;
    return roundDown ? -absSignificance * (times + 1) : -absSignificance * (times);
  } else {
    return (times + 1) * absSignificance;
  }
}

/**
 * Rounds a number up, to the nearest integer or to the nearest multiple of significance.
 * @name CEILING.MATH
 * @param number is the real number you want to round.
 * @param significance is the multiple to which you want to round.
 * @param mode when given and nonzero this function will round away from zero.
 */
export function CEILING_MATH(
  number: number,
  significance?: Omittable<number>,
  mode: number=0
): number {
  significance = Math.abs(significance ?? 1);
  if (significance === 0)  return 0;

  const up = CEILING(number, significance);
  // mode does not affect a positive number, and it does not affect an EXACT multiple at either
  // sign: `CEILING.MATH(-9,3,1)` is -9, not -12.
  if (number >= 0 || !mode || up === number) return up;
  // nonzero mode rounds away from zero
  return up - significance;
}

/**
 * Rounds a number up to the nearest integer or to the nearest multiple of significance.
 * @name CEILING.PRECISE
 * @param number is the real number you want to round.
 * @param significance is the multiple to which you want to round.
 * @category Compatibility
 */
export function CEILING_PRECISE(
  number: number,
  significance: Omittable<number>=1
): number {
  if (significance === 0)  return 0;

  // always round up
  return CEILING(number, Math.abs(significance));
};

/**
 * Rounds a number up, to the nearest multiple of significance.
 * @name ECMA.CEILING
 * @param number is the value you want to round.
 * @param significance is the multiple to which you want to round.
 * @category Compatibility
 */
export function ECMA_CEILING(
  number: number,
  significance: number
): number {
  return CEILING(number, significance);
};

/**
 * Returns the number of combinations for a given number of items.
 * @param number is the total number of items.
 * @param numberChosen is the number of items in each combination.
 */
export function COMBIN(
  number: number,
  numberChosen: number
): number {
  // The sign is refused on the RAW arguments, where COMBINA truncates first: `COMBIN(-0.5,-0.5)`
  // is #NUM! and `COMBINA(-0.5,0)` is 1.
  if (number < 0 || numberChosen < 0) return Number.NaN;
  // Truncate before comparing: COMBIN(5.1, 5.9) is COMBIN(5, 5).
  const total = Math.trunc(number);
  const chosen = Math.trunc(numberChosen);
  if (total > CombinMax || total < chosen) return Number.NaN;
  return binomialKernel(total, chosen);
};

/**
 * Returns the number of combinations with repetitions for a given number of items.
 * @param number is the total number of items.
 * @param numberChosen is the number of items in each combination.
 */
export function COMBINA(
  number: number,
  numberChosen: number
): number {
  const items = Math.trunc(number);
  const chosen = Math.trunc(numberChosen);
  // The zero special case runs on the TRUNCATED pair and BEFORE the sign check, which is the
  // whole difference from COMBIN's reading order: `COMBINA(-0.5,-0.5)` is 1 and
  // `COMBINA(5,-0.5)` is #NUM!.
  if (chosen === 0 && (items === 0 || items === 1)) return 1;
  if (number < 0 || numberChosen < 0) return Number.NaN;
  // The bound applies to the SHIFTED total, which is why `COMBINA(1,2^31-1)` is #NUM!.
  const total = items + chosen - 1;
  if (total > CombinMax || total < chosen) return Number.NaN;
  return binomialKernel(total, chosen);
};

/**
 * Converts a text representation of a number in a given base into a decimal number.
 * @param number is the number that you want to convert.
 * @param radix is the base Radix of the number you are converting.
 */
export function DECIMAL(
  number: string,
  radix: number
): number {
  const base = Math.trunc(radix);
  if (base < 2 || base > 36) return Number.NaN;
  if (number.length > NumeralTextMax) throw FormulaError.BuiltIn.Value;
  // A leading SPACE or TAB is skipped; nothing else is, at either end. `DECIMAL(" FF",16)` is
  // 255, `DECIMAL("FF ",16)` is #NUM!, and so is a leading newline — where ARABIC, reading the
  // same kind of text, drops a newline and keeps a non-breaking space.
  let text = number.replace(/^[ \t]+/, '');
  // Base sixteen alone takes a `0x` prefix, and takes it as a TERMINATOR: everything up to and
  // including the first `x` is dropped, so `DECIMAL("00x1",16)` and `DECIMAL("x1",16)` are both
  // 1 and `DECIMAL("0xx1",16)` is #NUM!. No other radix does, because from radix 34 up `x` is an
  // ordinary digit worth 33.
  if (base === 16) {
    const marker = text.search(/[xX]/);
    if (marker >= 0) text = text.slice(marker + 1);
  }
  // No digits at all is zero, which is what makes `DECIMAL("",16)` and `DECIMAL("0x",16)` 0.
  let result = 0;
  for (let i=0; i<text.length; i++) {
    // Every character must be a valid digit for the radix; `parseInt` would accept a valid prefix
    // and would round the whole text at once rather than digit by digit.
    const digit = parseInt(text[i], 36);
    if (!(digit >= 0) || digit >= base) return Number.NaN;
    result = result * base + digit;
  }
  return result;
};

/**
 * Converts radians to degrees.
 * @param angle is the angle in radians that you want to convert.
 */
export function DEGREES(angle: number): number {
  return angle * (180 / Math.PI);
};

/**
 * Rounds a positive number up and negative number down to the nearest even integer.
 * @param number is the value to round.
 */
export function EVEN(number: number): number {
  // Away from zero on the raw double, not CEILING's 15-digit reading: `EVEN(2+2^-51)` is 4.
  let temp = Math.ceil(Math.abs(number));
  temp = (temp & 1) ? temp + 1 : temp;
  return (number < 0) ? -temp : temp;
};

/**
 * Returns e raised to the power of a given number.
 * @param number is the exponent applied to the base e. The constant e equals 2.71828182845904, the base of the natural logarithm.
 */
export function EXP(number: number): number {
  return Math.exp(number);
};

/**
 * Returns the factorial of a number, equal to 1*2*3*...* Number.
 * @param number is the nonnegative number you want the factorial for.
 *
 * @remarks
 * Alone among the combinatorial functions, FACT reads its argument at fifteen significant
 * digits before truncating it: `FACT(0.0006*10000)` is 720, the factorial of 6, where the
 * double is 5.999999999999999 and FACTDOUBLE, COMBIN, GCD, LCM, BASE and ROMAN all answer for
 * 5. The sign is refused BEFORE that truncation, so `FACT(-0.5)` is `#NUM!` where the truncated
 * argument would be zero.
 *
 * 170 is the last factorial that fits a double.
 */
export function FACT(number: number): number {
  if (number < 0) return Number.NaN;
  const count = Math.trunc(round15(number));
  if (count > 170) return Number.NaN;
  return factorialKernel(count);
};

/**
 * Returns the double factorial of a number.
 * @param number is the value for which to return the double factorial.
 *
 * @remarks
 * `FACTDOUBLE(TRUE)` is `#VALUE!` and `FACTDOUBLE(A1:A3)` is `#VALUE!`, where FACT coerces the
 * boolean and spills the reference — the two sit in one family and are declared differently.
 *
 * The bound is on the RAW argument (`FACTDOUBLE(-1.5)` is `#NUM!` and `FACTDOUBLE(-0.9)` is 1),
 * and the odd tail runs to 301 before it overflows, two steps past the even one.
 */
export function FACTDOUBLE(number: NoLift<Omittable<AcceptError<Scalar>>>): number {
  const value = atpNumber(number);
  if (value < -1) return Number.NaN;
  const count = Math.trunc(value);
  let product = 1;
  for (let i = count; i > 1; i -= 2) {
    product *= i;
    if (!Number.isFinite(product)) return Number.NaN; // an overflowed count would loop forever
  }
  return product;
};

/**
 * Rounds a number down to the nearest multiple of significance.
 * @param number is the real number you want to round.
 * @param significance is the multiple to which you want to round. Number and Significance must either both be positive or both be negative.
 * @category Compatibility
 */
export function FLOOR(
  number: number,
  // Required and not Omittable: a blank significance is 0, which is #DIV/0!.
  significance: number
): number {
  if (number === 0) return 0;
  if (significance === 0) throw FormulaError.BuiltIn.Div0!;
  // A subnormal significance is #DIV/0! here too, and for FLOOR the zero already was.
  if (flushSubnormal(significance) === 0) throw FormulaError.BuiltIn.Div0!;

  significance = significance ?? (number > 0 ? 1 : -1);
  if (number > 0 && significance < 0) return Number.NaN; // #NUM!
  const absSignificance = Math.abs(significance);
  const quotient = round15(Math.abs(number) / absSignificance);
  // Rebuilt from the 15-digit quotient even for an exact multiple — see CEILING.
  if (quotient % 1 === 0) return (number < 0 ? -1 : 1) * quotient * absSignificance;

  const times = Math.floor(quotient);
  if (number < 0) {
    // round down, away from zero
    const roundDown = significance < 0;
    return roundDown ? -absSignificance * times : -absSignificance * (times + 1);
  } else {
    // toward zero
    return times * absSignificance;
  }
};

/**
 * Rounds a number down, to the nearest integer or to the nearest multiple of significance.
 * @name FLOOR.MATH
 * @param number is the real number you want to round.
 * @param significance is the multiple to which you want to round.
 * @param mode when given and nonzero this function will round towards zero.
 */
export function FLOOR_MATH(
  number: number,
  significance: Omittable<number> = (number > 0 ? 1 : -1),
  mode: Omittable<number> = 0
): Scalar {
  if (significance === 0) return 0; // unlike FLOOR, which is #DIV/0!

  // Both slots are read through |significance| — the sign of the multiple never reaches the
  // answer here, which is the whole difference from the legacy FLOOR.
  const step = Math.abs(significance);
  const down = FLOOR(number, step);
  // mode does not affect a positive number, and it does not affect an EXACT multiple at either
  // sign: `FLOOR.MATH(-9,3,1)` is -9, not -6.
  if (number >= 0 || !mode || down === number) return down;
  // toward zero
  return down + step;
};

/**
 * Rounds a number down to the nearest integer or to the nearest multiple of significance.
 * @name FLOOR.PRECISE
 * @param number is the real number you want to round.
 * @param significance is the multiple to which you want to round.
 */
export function FLOOR_PRECISE(
  number: number,
  significance: Omittable<number>=1
): number {
  if (significance === 0) return 0;
  // always round down
  return FLOOR(number, Math.abs(significance));
};

/**
 * Returns the greatest common divisor.
 * @param number are 1 to 255 values.
 */
export function GCD(number: NoFilter<number>[]): number {
  _atpArity(number);
  let x: number = number[0];
  if (x < 0 || x > _binaryStein64) {
    return Number.NaN; // #NUM!
  }
  x = Math.abs(Math.trunc(x));

  let y: number;
  const numberLength = number.length;
  for (let i=1; i<numberLength; i++) {
    y = number[i];
    if (y < 0 || y > _binaryStein64) {
      return Number.NaN; // #NUM!
    }
    y = Math.abs(Math.trunc(y));
    // Modulo rather than a bitwise Stein's GCD: JS bitwise ops truncate to 32 bits.
    while (x && y) {
      (x > y) ? x %= y : y %= x;
    }
    x += y;
  }

  return x;
};

/**
 * Rounds a number down to the nearest integer.
 * @param number is the real number you want to round down to an integer.
 */
export function INT(number: number): number {
  // The 15-digit reading only decides whether the value sits on an integer (`INT((0.1+0.7)*10)`
  // is 8); otherwise the raw operand is floored, so `INT(2^53+2)` keeps all its digits.
  const nearest = Math.round(number);
  if (round15(number) === round15(nearest)) return nearest;
  return Math.floor(number);
};

/**
 * Rounds a number up to the nearest integer.
 * @name ISO.CEILING
 * @param number is the real number you want to round up to an integer.
 * @param significance is the multiple to which you want to round number.
 * @category Compatibility
 */
export function ISO_CEILING(
  number: number,
  significance: Omittable<number> = 1
): number {
  return CEILING_PRECISE(number, significance);
};

/**
 * Returns the least common multiple.
 * @param number are 1 to 255 values for which you want the least common multiple.
 */
export function LCM(number: NoFilter<number>[]): number {
  _atpArity(number);
  let x = number[0];
  if (x < 0 || x > _binaryStein64) {
    return Number.NaN; // #NUM!
  }
  x = Math.abs(Math.trunc(x));

  let y: number;
  let a: number;
  let b: number;
  const numberLength = number.length;
  for (let i=1; i<numberLength; i++) {
    const n = number[i];
    if (n < 0 || n > _binaryStein64) {
      return Number.NaN; // #NUM!
    }

    y = Math.abs(Math.trunc(n));
    if (x === 0 || y === 0) {
      x = 0;
      continue;
    }
    // consume copies so x and y survive the divide below
    a = x;
    b = y;
    while (a && b) {
      a > b ? a %= b : b %= a;
    }
    // divide before multiplying so the intermediate stays in range
    x = (x / (a + b)) * y;
    // the running result is bounded too, not just the arguments
    if (x > _binaryStein64) {
      return Number.NaN; // #NUM!
    }
  }
  return x;
};

/**
 * Returns the natural logarithm of a number.
 * @param number is the positive real number for which you want the natural logarithm.
 */
export function LN(number: number): number {
  if (number <= 0) return Number.NaN;
  return Math.log(number);
};

/**
 * Returns the logarithm of a number to the base you specify.
 * @param number is the positive real number for which you want the logarithm.
 * @param base is the base of the logarithm.
 *
 * @remarks
 * An OMITTED base is 0 and therefore `#NUM!` — `LOG(8,)` does not fall back to 10 the way an
 * absent one does, and neither does a blank cell. An absent one is `LOG10` exactly, which is not
 * the same double as `LN(number)/LN(10)`.
 */
export function LOG(
  number: number,
  base?: number
): number {
  if (number <= 0) return Number.NaN;
  // An ABSENT base is the base-10 logarithm itself, not `LN(n)/LN(10)`: `LOG(8)` equals
  // `LOG10(8)` exactly where the ratio is one ulp below it. An OMITTED base is not absent — it
  // coerces like a blank cell, which is 0, and reaches the refusal below.
  if (base === undefined) return Math.log10(number);
  if (base === 1) throw FormulaError.BuiltIn.Div0!; // log(1) is 0 — the divisor
  if (base <= 0) return Number.NaN;
  // `LN(n)/LN(base)`, never `LOG10(n)/LOG10(base)`: the two differ, and Excel is the first
  // (`LOG(243,3)` is 4.999999999999999 where the base-10 ratio is exactly 5).
  return Math.log(number) / Math.log(base);
};

/**
 * Returns the base-10 logarithm of a number.
 * @param number is the positive real number for which you want the base-10 logarithm.
 */
export function LOG10(number: number): number {
  if (number <= 0) return Number.NaN;
  return Math.log10(number);
};

/**
 * Every member of a matrix argument, or the fault of the first that is not a number.
 *
 * MDETERM, MINVERSE and MMULT share one rule: text, numeric text, an empty string, a boolean and
 * a BLANK cell are each `#VALUE!`, in a reference and in an array constant alike, and only an
 * error member keeps its own identity. The scan is row-major, so the FIRST fault is the answer.
 */
const matrixValues = (array: IRange): number[][] | FormulaError.Known => {
  const m = array.getValues<number>();
  for (const row of m) {
    for (const v of row) {
      if (typeof v === 'number') continue;
      return FormulaError.isError(v) ? v : FormulaError.BuiltIn.Value!;
    }
  }
  return m as number[][];
};

/**
 * Returns the matrix determinant of an array.
 * @param array is a numeric array with an equal number of rows and columns, either a cell range or an array constant.
 *
 * @remarks
 * A scalar and a single cell are a 1x1 matrix, so `MDETERM(5)` is 5; any other shape that is not
 * square is `#VALUE!`, a whole-column reference and a union included.
 *
 * The answer of a SINGULAR matrix is not zero. It is whatever the elimination leaves —
 * `MDETERM({1,2,3;4,5,6;7,8,9})` is 6.661338147750939E-16 and its transpose is exactly 0 — so
 * there is no tolerance anywhere in the body.
 */
export function MDETERM(
  array: IRange
): Scalar { // number
  if (array.hasError()) return array.firstError()!; // a member error outranks the shape
  const { rows, columns } = array.getShape();
  if (rows !== columns) return FormulaError.BuiltIn.Value!;

  const m = matrixValues(array);
  if (!Array.isArray(m)) return m;
  return determinant(m);
}

/**
 * Returns the inverse matrix for the matrix stored in an array.
 * @param array is a numeric array with an equal number of rows and columns, either a cell range or an array constant.
 *
 * @remarks
 * A zero PIVOT is `#NUM!` and nothing else is: a matrix that is merely close to singular
 * inverts, and answers the large numbers that follow from it — the exactly singular
 * `{1,2,3;4,5,6;7,8,9}` inverts to entries near 9E15 rather than being refused.
 *
 * Like MDETERM, it is a 1x1 matrix that a scalar and a single cell describe (`MINVERSE(5)` is
 * 0.2), and any non-numeric member is `#VALUE!`.
 */
export function MINVERSE(
  array: IRange
): Scalar[][] {
  if (array.hasError()) return array.firstError() as unknown as Scalar[][]; // outranks the shape
  const { rows, columns } = array.getShape();
  if (rows !== columns) return FormulaError.BuiltIn.Value as unknown as Scalar[][];

  const m = matrixValues(array);
  if (!Array.isArray(m)) return m as unknown as Scalar[][];

  const inverse = invert(m);
  if (inverse === null) return FormulaError.BuiltIn.Num as unknown as Scalar[][];
  return inverse;
}

/**
 * Returns the matrix product of two arrays, an array with the same number of rows as array1 and columns as array2.
 * @param array1 is the first array of numbers to multiply and must have the same number of columns as Array2 has rows.
 * @param array2 is the second array of numbers to multiply and must have the same number of columns as Array1 has rows.
 *
 * @remarks
 * The shape rule is the INNER dimensions, not squareness, so a 2x2 against a 2x3 answers a 2x3.
 * Two scalars are two 1x1 matrices and multiply, while a scalar against a matrix is `#VALUE!` —
 * there is no broadcast here.
 *
 * Each cell is a SEQUENTIAL sum from zero, left to right, which is observable wherever the terms
 * cancel: `MMULT({1,1E16,-1E16},{1;1;1})` is 0 and the same three numbers reordered are 1.
 */
export function MMULT(
  array1: IRange,
  array2: IRange
): Scalar[][] {
  // The arguments are read ONE AT A TIME, whole, and in order: a non-numeric member of `array1`
  // outranks an error member of `array2` (`MMULT({1,2;"x",4},{#N/A,2;3,4})` is `#VALUE!`) and a
  // member of either outranks the inner-dimension check. Letting the engine reject the errors
  // first would answer `#N/A` for that row, so both slots accept them and the scan is here.
  const a = matrixValues(array1);
  if (!Array.isArray(a)) return a as unknown as Scalar[][];
  const b = matrixValues(array2);
  if (!Array.isArray(b)) return b as unknown as Scalar[][];

  const { rows: aNumRows, columns: aNumCols } = array1.getShape();
  const { rows: bNumRows, columns: bNumCols } = array2.getShape();
  if (aNumCols !== bNumRows) return FormulaError.BuiltIn.Value as unknown as Scalar[][];

  const m = new Array(aNumRows);
  for (let r=0; r<aNumRows; r++) {
    m[r] = new Array(bNumCols);
    for (let c=0; c<bNumCols; c++) {
      let sum = 0;
      for (let i=0; i<aNumCols; i++) sum += a[r][i] * b[i][c];
      // One overflowed cell is the whole answer: the PRODUCT is `#NUM!` rather than a matrix
      // carrying an error in one place.
      if (!Number.isFinite(sum)) return FormulaError.BuiltIn.Num as unknown as Scalar[][];
      m[r][c] = sum;
    }
  }
  return m;
};

/**
 * Returns the remainder after a number is divided by a divisor.
 * @param number is the number for which you want to find the remainder after the division is performed.
 * @param divisor is the number by which you want to divide Number.
 */
export function MOD(
  number: number,
  divisor: number
): number {
  // A SUBNORMAL divisor is #DIV/0! and not merely a small one: the divisor is tested against zero
  // AFTER the flush, so `MOD(1,EXP(-745))` is #DIV/0! where `EXP(-745)=0` is FALSE.
  if (flushSubnormal(divisor) === 0) throw FormulaError.BuiltIn.Div0!;
  // A SUBNORMAL NUMERATOR is #NUM!, which the ratio cut below does not reach:
  // `MOD(EXP(-740),1)` and `MOD(EXP(-745),1E-300)` are both #NUM! at ratios nowhere near 2^40,
  // and `MOD(2^-1022,1)` — the smallest NORMAL double — answers. The divisor rule outranks it
  // (`MOD(EXP(-745),EXP(-745))` is #DIV/0!), which is why it is second.
  if (number !== 0 && flushSubnormal(number) === 0) return Number.NaN; // #NUM!
  // Excel refuses rather than return a remainder it cannot resolve: the cut is on the RATIO and
  // it is 2^40 exactly — `MOD(2^40,1)` is 0 and `MOD(2^41,1)` is #NUM!, and so are the same two
  // ratios reached as `MOD(2^41*0.001,0.001)` and `MOD(1,2^-41)`.
  if (Math.abs(number / divisor) > ModRatioMax) return Number.NaN; // #NUM!

  // The EXACT remainder, not `number - divisor * INT(number / divisor)`: `MOD(1,0.1)` is
  // 0.09999999999999995 because ten of the doubles nearest 0.1 overshoot 1, and the floored
  // quotient answers 0. This is the split INT sits on the other side of — INT reads its operand
  // at 15 significant digits and MOD does not (`MOD(4.35*100,1)` is 0.9999999999999432).
  let remainder = number % divisor;
  if (remainder !== 0 && (remainder < 0) !== (divisor < 0)) remainder += divisor;
  // The sign correction can land exactly ON the divisor when the remainder is too small to
  // survive the addition (`MOD(-1E-20,1)`), and a remainder equal to the divisor is zero.
  return remainder === divisor ? 0 : remainder;
};

/** The largest `|number / divisor|` MOD will answer for; above it the answer is `#NUM!`. */
const ModRatioMax = 1099511627776; // 2^40

/**
 * Reads an Analysis-ToolPak scalar slot — one declared `any` — as a number.
 *
 * The declaration decides the coercion, not the family, and an `any` slot reaches the body
 * untouched: a BOOLEAN is `#VALUE!` where the native `CEILING(TRUE,3)` is 3, an OMITTED argument
 * is `#N/A` where CEILING's is 0, and only a blank cell still reads 0. Numeric text parses as it
 * does everywhere.
 *
 * The slots also carry `AcceptError`, because the body owns the READING ORDER: arguments are
 * read left to right and a coercion failure in the first slot beats an error in the second, so
 * `QUOTIENT("x",NA())` is `#VALUE!`. Letting the engine propagate would answer `#N/A`.
 */
function atpNumber(value: AcceptError<Scalar> | undefined): number {
  if (value === undefined) throw FormulaError.BuiltIn.NA!;
  if (value === null) return 0; // a blank CELL is a value the caller supplied
  if (typeof value === 'boolean') throw FormulaError.BuiltIn.Value!;
  if (FormulaError.isError(value)) throw value;
  return FormulaContext.parseAsNumber(value);
}

/**
 * How far below a half MROUND still rounds up, on the quotient.
 *
 * Unlike the rest of the rounding family, which reads its operand at 15 significant digits,
 * MROUND's boundary is a fixed absolute tolerance: `MROUND(50*0.57,1)` is 29 while
 * `MROUND(6.05,0.1)` is 6.
 */
const MRoundHalfTolerance = 5e-15;

/**
 * Returns a number rounded to the desired multiple.
 * @param number is the value to round.
 * @param multiple is the multiple to which you want to round number.
 * @remarks
 * `MROUND(A1:A3,3)` is `#VALUE!` where the native `MOD(A1:A3,3)` spills three results, and an
 * ARRAY constant still lifts at the same slot (`MROUND({1.5;-2.5},3)` spills two).
 */
export function MROUND(
  number: NoLift<Omittable<AcceptError<Scalar>>>,
  multiple: NoLift<Omittable<AcceptError<Scalar>>>
): number {
  const value = atpNumber(number);
  const step = atpNumber(multiple);
  if (step === 0) return 0;
  if (value > 0 && step < 0 || value < 0 && step > 0) return Number.NaN; // #NUM!
  // An exact multiple is rebuilt from the quotient rather than echoing the operand, which is what
  // makes `MROUND(0.07*100,0.1)` 7 and `MROUND(1E-300,1E307)` 0. Unlike CEILING and FLOOR the
  // quotient here is the raw one, so `MROUND(2^53,1)` keeps all seventeen digits of 2^53.
  const quotient = value / step;
  if (quotient % 1 === 0) return quotient * step;

  // Signs match by here, so the quotient is positive and rounding it up at the half is away from zero.
  const whole = Math.floor(quotient);
  const times = (quotient - whole >= 0.5 - MRoundHalfTolerance) ? whole + 1 : whole;
  return times * step;
};

/**
 * Returns the multinomial of a set of numbers.
 * @param number are 1 to 255 values for which you want the multinomial.
 */
export function MULTINOMIAL(number: NoFilter<number>[]): number {
  _atpArity(number);
  const counts: number[] = [];
  let total = 0;
  const numberLength = number.length;
  for (let i=0; i<numberLength; i++) {
    const num = number[i];
    if (num < 0) return Number.NaN;
    const count = Math.trunc(num);
    counts.push(count);
    total += count;
  }
  // The SUM carries the factorial's bound, so a set summing past 170 is #NUM! whatever its parts.
  if (total > 170) return Number.NaN;
  let denominator = 1;
  for (let i=0; i<counts.length; i++) denominator *= factorialKernel(counts[i]);
  return factorialKernel(total) / denominator;
};

/**
 * Returns the unit matrix for the specified dimension.
 * @param dimension is an integer specifying the dimension of the unit matrix that you want to return.
 *
 * @remarks
 * The dimension is the RAW double, truncated: `MUNIT(0.0006*10000)` is the 5x5 identity, where
 * SEQUENCE and RANDARRAY read the same expression at fifteen significant digits and build six.
 * A dimension that truncates to zero or below is `#VALUE!`.
 *
 * A dimension too large to build is neither an error nor a matrix — it is an EMPTY array, whose
 * `ROWS`, `COLUMNS`, `COUNT` and `SUM` are all 0.
 */
export function MUNIT(dimension: number): IRange {
  const size = Math.trunc(dimension);
  if (size <= 0) return FormulaError.BuiltIn.Value!; // #VALUE!
  const entireCoords = FormulaContext.getEntireCoords();
  const max = Math.min(entireCoords.rowEnd, entireCoords.colEnd) + 1;
  if (size > max) return FormulaContext.createRange();
  // The off-diagonal is ZERO, not blank: `INDEX(MUNIT(3),1,3)` is 0, and MDETERM and MMULT
  // refuse a blank member. A 0-filled range stores nothing, so only the diagonal is written.
  const builder = FormulaContext.createRange(size, size, 0).sparseBuilder();
  for (let i=0; i<size; i++) {
    builder.pushAt(i, i, 1);
  }
  return builder.build();
};

/**
 * Rounds a positive number up and negative number down to the nearest odd integer.
 * @param number is the value to round.
 */
export function ODD(number: number): number {
  if (number === 0) return 1;
  // Raw double, like EVEN: `ODD(1+2^-52)` is 3.
  let temp = Math.ceil(Math.abs(number));
  temp = (temp & 1) ? temp : temp + 1;
  return (number > 0) ? temp : -temp;
};

/**
 * Returns the percentage of a subset of a given data set.
 * @param dataSubset is the subset.
 * @param dataAll is the data set.
 */
export function PERCENTOF(
  // The two channels differ: a DIRECT error propagates with its identity (`PERCENTOF(NA(),A1:A3)`
  // is #N/A — the engine's, before the body) while an error MEMBER is remapped to #NUM!
  // (`PERCENTOF(A1,B1:B3)` over a #DIV/0! member is #NUM!, not #DIV/0!). The remap is the
  // body's, below.
  dataSubset: ReportType<IRange<number>>,
  dataAll: ReportType<IRange<number>>
): number {
  dataSubset = FormulaContext.flattenAreas(dataSubset); // a union sums over every area
  dataAll = FormulaContext.flattenAreas(dataAll);
  // Only a CONTAINER's members are remapped. A direct scalar reaches a typed range slot through
  // coercion and arrives holding the #VALUE! that coercion failed with, which is the answer and
  // not the body's to rewrite: `PERCENTOF("abc",A1:A3)` is #VALUE! where `PERCENTOF(A1,B1:B3)`
  // over a #DIV/0! member is #NUM!. `getRawAt` separates the two — a Scalar there means the
  // argument IS a value — and the scan is in argument order.
  const args = FormulaContext.getArgs();
  const ranges = [dataSubset, dataAll];
  for (let i=0; i<2; i++) {
    if (!ranges[i].hasError()) continue;
    if ((args.getRawAt(i) as IRange)?.isIRange === true) throw FormulaError.BuiltIn.Num!;
    throw ranges[i].errors().next().value!.value;
  }
  // Both sums carry the cancellation snap, so a cancelling denominator is #DIV/0!.
  const subsetSum = dataSubset.getStats().getSnappedSum();
  const allSum = dataAll.getStats().getSnappedSum();
  // A SUBNORMAL denominator is #DIV/0! as well: a divisor is tested against zero after the flush,
  // which is why `1/A1` is #DIV/0! for an `A1` holding EXP(-745) that `A1=0` calls FALSE.
  if (flushSubnormal(allSum) === 0) throw FormulaError.BuiltIn.Div0!;
  return flushSubnormal(subsetSum / allSum);
}

/**
 * Returns the value of Pi, 3.14159265358979, accurate to 15 digits.
 */
export function PI(): number {
  return Math.PI;
};

/**
 * The largest integer exponent Excel takes by repeated squaring; past it an exponent is treated
 * as fractional, and a negative base there is `#NUM!` (`POWER(-1,2^32-2)` is 1 and
 * `POWER(-1,2^32-1)` is `#NUM!`).
 */
const MaxIntegerExponent = 4294967294; // 2^32 - 2

/**
 * `base ^ power` for a NEGATIVE base, where the answer is not a power function at all but a
 * rule about the exponent.
 *
 * An integer exponent is ordinary. A fractional one answers only when its RECIPROCAL is an odd
 * integer — an odd root of a negative number is real, an even one is not — and the reciprocal is
 * read at 15 significant digits, the same reading the rest of this category applies to a double:
 * `POWER(-8,1/3)` answers where `POWER(-8,0.3333333333333)` is `#NUM!`, and `1/(1/3)` is
 * 3.0000000000000004 in binary and 3 at fifteen digits. `1/1000001` answers and `1/1000000`
 * does not, which is the parity half of the same rule.
 */
function negativeBasePower(base: number, power: number): number {
  if (Number.isInteger(power) && Math.abs(power) <= MaxIntegerExponent) return base ** power;
  const reciprocal = Number((1 / power).toPrecision(15));
  if (!Number.isInteger(reciprocal) || Math.abs(reciprocal % 2) !== 1) return Number.NaN;
  return -((-base) ** power);
}

/**
 * Returns the result of a number raised to a power.
 * @param number is the base number, any real number.
 * @param power is the exponent, to which the base number is raised.
 */
export function POWER(
  number: number,
  power: number
): number {
  if (number === 0) {
    if (power < 0) throw FormulaError.BuiltIn.Div0!; // `POWER(0,-1)` is #DIV/0!, not #NUM!
    if (power === 0) return Number.NaN;
  }
  if (number < 0) return negativeBasePower(number, power);
  return number ** power;
};

/**
 * Multiplies all the numbers given as arguments.
 * @param number are 1 to 255 numbers, logical values, or text representations of numbers that you want to multiply.
 *
 * @remarks
 * The EMPTY product is 0 rather than 1: `PRODUCT(A1:A3)` over three blank or three text cells is
 * 0, and so is `PRODUCT(A1)` on a blank cell. The identity only appears once something numeric
 * has been multiplied, so `PRODUCT(A1:A3,2)` over the same three cells is 2.
 *
 * The accumulation is left to right and nothing rescues an intermediate overflow:
 * `PRODUCT(1E200,1E200,1E-200)` is `#NUM!` where the same three in the other order answer 1E200.
 */
export function PRODUCT(number: IRange<number>[]): number {
  // The accumulator STARTS at the first member rather than at 1, because the identity step is
  // observable: multiplying flushes a subnormal, so a `1 * v` opening would zero a lone
  // `EXP(-745)` that is returned whole (`PRODUCT(A1)` is 5E-324 and `PRODUCT(A1,1)` is 0).
  let product = 0;
  let multiplied = false;
  for (const range of number) {
    for (const value of range.values<number>()) {
      product = multiplied ? flushSubnormal(product * value) : value;
      multiplied = true;
    }
  }
  return multiplied ? product : 0;
}

/**
 * Returns the integer portion of a division.
 * @param numerator is the dividend.
 * @param denominator is the divisor.
 * @remarks
 * `QUOTIENT(A1:A3,3)` is `#VALUE!` where the native `MOD(A1:A3,3)` spills; an array constant
 * still lifts.
 */
export function QUOTIENT(
  numerator: NoLift<Omittable<AcceptError<Scalar>>>,
  denominator: NoLift<Omittable<AcceptError<Scalar>>>
): number {
  const top = atpNumber(numerator);
  const bottom = atpNumber(denominator);
  if (bottom === 0) throw FormulaError.BuiltIn.Div0!;
  // The RAW quotient: QUOTIENT is on the other side of the category's 15-digit split from every
  // rounder around it — `QUOTIENT(4.35*100,1)` is 434 where `INT(4.35*100)` is 435.
  return Math.trunc(top / bottom);
};

/**
 * Converts degrees to radians.
 * @param angle is an angle in degrees that you want to convert.
 */
export function RADIANS(angle: number): number {
  // `angle * (PI/180)`, with the constant folded FIRST. `angle / 180 * PI` differs in the last
  // bit on some arguments, and Excel is this form.
  return angle * (Math.PI / 180);
};

/**
 * Returns a random number greater than or equal to 0 and less than 1, evenly distributed (changes on recalculation).
 *
 * @remarks
 * The draw carries 53 bits — it is a multiple of 2^-53, not of 2^-32 — and never reaches 1.
 */
export function RAND(): Volatile<number> {
  return FormulaContext.getRandom();
};

/**
 * Returns an array of random numbers.
 * @param rows the number of rows in the returned array.
 * @param columns the number of columns in the returned array.
 * @param min the minimum number you would like returned.
 * @param max the maximum number you would like returned.
 * @param integer return an integer or a decimal value. TRUE for an integer, FALSE for a decimal number.
 *
 * @remarks
 * `integer` is a LOGICAL slot and reads like one: a number coerces (0 is FALSE, anything else
 * TRUE) and TEXT does not, numeric text included, where every other slot here parses it. Absent,
 * omitted and blank all mean FALSE.
 *
 * In integer mode a bound that is not a whole number is `#VALUE!` rather than being truncated,
 * and both ends are INCLUSIVE; the decimal mode's `max` is not (`RANDARRAY(1,1,0,1)` never
 * answers 1). `min` above `max` is `#VALUE!` in both modes.
 */
export function RANDARRAY(
  rows: Omittable<number>=1,
  columns: Omittable<number>=1,
  min: Omittable<number>=0,
  max: Omittable<number>=1,
  integer: Omittable<boolean>=false
): Volatile<IRange> {
  const rowCount = spillCount(rows);
  if (typeof rowCount !== 'number') return rowCount;
  const columnCount = spillCount(columns);
  if (typeof columnCount !== 'number') return columnCount;
  const whole = integer === true;
  if (min > max) return FormulaError.BuiltIn.Value!;
  if (whole && (min !== Math.trunc(min) || max !== Math.trunc(max))) return FormulaError.BuiltIn.Value!;


  return FormulaContext.createRange(rowCount, columnCount, (): number => {
    if (!whole) return min + FormulaContext.getRandom() * (max - min);
    const value = min + Math.floor(FormulaContext.getRandom() * (max - min + 1));
    return value > max ? max : value;
  });
};

/**
 * Returns a random number between the numbers you specify.
 * @param bottom is the smallest integer RANDBETWEEN will return.
 * @param top is the largest integer RANDBETWEEN will return.
 *
 * @remarks
 * Both bounds are taken to their CEILING, and the raw double is what is read:
 * `RANDBETWEEN(2.2,2.2)` is 3 and `RANDBETWEEN(0.07*100,0.07*100)` is 8, where the rounding
 * family's fifteen-digit reading would say 7. The refusal is decided BEFORE that ceiling, on the
 * arguments as given — `RANDBETWEEN(2.5,2.2)` is `#NUM!` although both ends ceil to 3.
 *
 * The arguments are read RIGHT TO LEFT, so a fault in `top` outranks one in `bottom`.
 */
export function RANDBETWEEN(
  bottom: NoLift<Omittable<AcceptError<Scalar>>>,
  top: NoLift<Omittable<AcceptError<Scalar>>>
): Volatile<number> {
  const topNum = atpNumber(top);
  const bottomNum = atpNumber(bottom);
  if (bottomNum > topNum) return Number.NaN;
  const low = Math.ceil(flushSubnormal(bottomNum));
  const high = Math.ceil(flushSubnormal(topNum));
  return low + Math.floor(FormulaContext.getRandom() * (high - low + 1));
};

/**
 * Converts an Arabic numeral to Roman, as text.
 * @param number is the Arabic numeral you want to convert.
 * @param form is the number specifying the type of Roman numeral you want.
 *
 * @remarks
 * `form` runs 0 (classic) to 4 (most concise) and is also read as a LOGICAL: `ROMAN(499,TRUE)`
 * is the classic "CDXCIX" and `ROMAN(499,FALSE)` is "ID". Anything outside 0..4 is `#VALUE!`.
 *
 * A concise form replaces a four-of-a-kind by a subtraction from a larger numeral, and repeats
 * that at most `form` times: 499 is "CDXCIX", "LDVLIV", "XDIX", "VDIV", "ID" as the form rises.
 */
export function ROMAN(
  number: number,
  form: Omittable<Scalar>=0
): Scalar {
  const style = typeof form === 'boolean' ? (form ? 0 : 4)
    : Math.trunc(form === null ? 0 : FormulaContext.parseAsNumber(form));
  number = Math.trunc(number);
  if (number < 0 || number > 3999) return FormulaError.BuiltIn.Value;
  if (style < 0 || style > 4) return FormulaError.BuiltIn.Value;
  if (number === 0) return '';

  let value = number;
  let roman = '';
  // Walk the four decimal positions (M, C, X, I). A digit of 4 or 9 is written as a subtraction
  // from the next numeral up, and `style` says how many further steps that subtraction may take
  // toward a smaller subtrahend, provided the shorter spelling still covers the remainder.
  for (let place=0; place<=RomanMaxIndex / 2; place++) {
    let index = 2 * place;
    const digit = Math.floor(value / RomanValues[index]);
    if (digit % 5 === 4) {
      let from = digit === 4 ? index - 1 : index - 2;
      let steps = 0;
      while (steps < style && index < RomanMaxIndex) {
        steps++;
        if (RomanValues[from] - RomanValues[index + 1] <= value) index++;
        else steps = style;
      }
      roman += RomanChars[index] + RomanChars[from];
      value = value + RomanValues[index] - RomanValues[from];
    } else {
      if (digit > 4) {
        roman += RomanChars[index - 1];
        value -= RomanValues[index - 1];
      }
      let repeat = Math.floor(value / RomanValues[index]);
      value -= repeat * RomanValues[index];
      for (; repeat > 0; repeat--) roman += RomanChars[index];
    }
  }
  return roman;
};

/**
 * Rounds a number to a specified number of digits.
 * @param number is the number you want to round.
 * @param numDigits is the number of digits to which you want to round. Negative rounds to the left of the decimal point to the nearest integer.
 */
export function ROUND(
  number: number,
  numDigits: number
): number {
  // Unlike its siblings ROUND reads the count shifted (`excelCount`): `ROUND(1.25,0.9999998)` is 1.3.
  const digits = excelCount(numDigits);
  if (digits >= RoundDigitsMax) return 0;
  const sign = number > 0 ? 1 : -1;
  const abs = Math.abs(number);
  if (digits === 0) return sign * Math.round(round15(abs));
  const multiplier = roundScale(digits);
  if (multiplier === undefined) return digits > 0 ? number : 0;
  if (digits > 0) {
    const scaled = round15(round15(abs) * multiplier);
    if (!Number.isFinite(scaled)) return number;
    return sign * round15(Math.round(scaled) / multiplier);
  }
  return sign * Math.round(round15(abs / multiplier)) * multiplier;
};

/**
 * Rounds a number down, toward zero.
 * @param number is any real number that you want rounded down.
 * @param numDigits is the number of digits to which you want to round. Negative rounds to the left of the decimal point to the nearest integer.
 */
export function ROUNDDOWN(
  number: number,
  numDigits: number
): number {
  const digits = roundDigits(numDigits);
  const sign = number > 0 ? 1 : -1;
  const abs = Math.abs(number);
  if (digits === 0) return sign * Math.floor(round15(abs));
  const multiplier = roundScale(digits);
  if (multiplier === undefined) return digits > 0 ? number : 0;
  if (digits > 0) {
    const scaled = round15(round15(abs) * multiplier);
    if (!Number.isFinite(scaled)) return number;
    return sign * round15(Math.floor(scaled) / multiplier);
  }
  return sign * Math.floor(round15(abs / multiplier)) * multiplier;
};

/**
 * Rounds a number up, away from zero.
 * @param number is any real number that you want rounded up.
 * @param numDigits is the number of digits to which you want to round. Negative rounds to the left of the decimal point to the nearest integer.
 */
export function ROUNDUP(
  number: number,
  numDigits: number
): number {
  // ROUNDUP is ROUNDDOWN plus one unit in the last place kept — not a ceiling of the scaled
  // operand. The two differ by an ulp and the difference is Excel's: `ROUND(2.675,2)` is 2.68
  // while `ROUNDUP(2.675,2)` is 2.6799999999999997, which is `2.67 + 0.01` in double. A value
  // whose 15-digit reading already stops at `numDigits` is returned as that reading rather than
  // stepped.
  const digits = roundDigits(numDigits);
  const down = ROUNDDOWN(number, digits);
  if (down === round15(number)) return down;
  const stepped = down + Math.sign(number) * Math.pow(10, -digits);
  return Number.isFinite(stepped) ? stepped : Number.NaN; // #NUM!
};

/**
 * The tolerance below which SEQUENCE and RANDARRAY read a negative dimension as zero.
 *
 * `SEQUENCE(-0.1)` is `#VALUE!` and `SEQUENCE(-1E-300)` is `#CALC!` — the refusal is not the
 * double's sign but its magnitude against a single-precision epsilon. MUNIT has no such
 * tolerance: every value at or below zero is `#VALUE!` there.
 */
const SpillCountZeroTolerance = 1.1920928955078125e-7; // 2^-23

/**
 * A spill DIMENSION as SEQUENCE and RANDARRAY read it: at fifteen significant digits, then
 * truncated. `SEQUENCE(0.0006*10000)` is six rows, where MUNIT — whose count slot looks the same
 * — builds five from the raw double.
 *
 * Zero is `#CALC!` and a negative count is `#VALUE!`, and BOTH axes are bounded by the sheet's
 * ROW count rather than by its columns: `SEQUENCE(1,16385)` spills 16,385 columns, well past the
 * grid's own width, and only 1048577 is refused.
 */
const spillCount = (value: number): number | FormulaError.Known => {
  if (value <= -SpillCountZeroTolerance) return FormulaError.BuiltIn.Value!;
  const count = Math.trunc(round15(value));
  if (count <= 0) return FormulaError.BuiltIn.Calc!;
  if (count > FormulaContext.getEntireCoords().rowEnd + 1) return FormulaError.BuiltIn.Value!;
  return count;
};

/**
 * Returns a sequence of numbers.
 * @param rows the number of rows to return.
 * @param columns the number of columns to return.
 * @param start the first number in the sequence.
 * @param step the amount to increment each subsequent value in the sequence.
 *
 * @remarks
 * The values ACCUMULATE rather than being computed from the index: `SEQUENCE(1,3,1,0.1)` ends at
 * 1.2000000000000002, which `start + i * step` does not produce, and a two-dimensional answer is
 * the same running sum read in row-major order.
 */
export function SEQUENCE(
  rows: Omittable<number>,
  columns: Omittable<number>=1,
  start: Omittable<number>=1,
  step: Omittable<number>=1
): IRange {
  rows ??= 1; // omitted is one row; a blank cell coerces to 0 and is #CALC! below
  const rowCount = spillCount(rows);
  if (typeof rowCount !== 'number') return rowCount;
  const columnCount = spillCount(columns);
  if (typeof columnCount !== 'number') return columnCount;

  let currentValue = start;
  return FormulaContext.createRange(rowCount, columnCount, (): number => {
    const value = currentValue;
    currentValue += step;
    return value;
  });
}

/**
 * Returns the sum of a power series based on the formula.
 * @param x is the input value to the power series.
 * @param n is the initial power to which you want to raise x.
 * @param m is the step by which to increase n for each term in the series.
 * @param coefficients is a set of coefficients by which each successive power of x is multiplied.
 *
 * @remarks
 * `n` and `m` are REAL exponents, not counts — `SERIESSUM(2,-0.5,1,{12,18,24})` answers.
 *
 * Coefficients are taken in row-major order from a range of any shape, and a BLANK member is
 * skipped rather than read as zero, so it does not consume a power: three cells holding 12,
 * blank, 18 are the series `12·x^n + 18·x^(n+m)`. A member that is text — numeric text included
 * — is `#VALUE!`, where the same text in GCD, LCM or MULTINOMIAL would be coerced.
 *
 * A term whose power is undefined contributes NOTHING rather than failing the sum:
 * `SERIESSUM(-2,1,0.5,{12,18,24})` is 72, the first and third terms alone, where the second
 * raises a negative base to a fractional power. A power that OVERFLOWS is still `#NUM!`, and so
 * is a zero base at a non-positive exponent.
 */
export function SERIESSUM(
  x: NoLift<Omittable<AcceptError<Scalar>>>,
  n: NoLift<Omittable<AcceptError<Scalar>>>,
  m: NoLift<Omittable<AcceptError<Scalar>>>,
  coefficients: Omittable<AcceptError<IRange>>
): number {
  const base = atpNumber(x);
  const first = atpNumber(n);
  const step = atpNumber(m);
  // The coefficients carry `AcceptError` so the body owns the READING ORDER: each argument is
  // validated fully, left to right, so even a refusal the declaration cannot express beats a bare
  // error here — `SERIESSUM(TRUE,1,1,1/0)` is #VALUE! (the boolean refusal at `x`), and
  // `SERIESSUM(NA(),1,1,1/0)` is #N/A — where the engine would answer #DIV/0! first.
  if (coefficients === undefined) throw FormulaError.BuiltIn.NA!;
  if (FormulaError.isError(coefficients)) throw coefficients;
  // A single value or one-cell reference is parsed as a number rather than read as a member.
  const raw = FormulaContext.getArgs().getRawAt(3);
  const asRange = raw as IRange;
  const isContainer = asRange?.isIRange === true;
  const isOneCell = isContainer && asRange.size === 1 &&
    (asRange as unknown as { isIReferenceRange?: boolean }).isIReferenceRange === true;
  if (!isContainer || isOneCell) {
    const value: Scalar = isContainer ? asRange.getValueAt(0, 0) ?? null : raw as Scalar;
    const coefficient = value === null ? 0 : FormulaContext.parseAsNumber(value);
    return coefficient * seriesPower(base, first);
  }

  let result: number = 0;
  let i: number = 0;
  for (const coefficient of coefficients.values(_optionsRowAxis)) {
    if (coefficient === null) continue; // a blank member does not consume a power
    if (FormulaError.isError(coefficient)) throw coefficient;
    if (typeof coefficient !== 'number') throw FormulaError.BuiltIn.Value;
    result += coefficient * seriesPower(base, first + i * step);
    i++;
  }
  return result;
};

/** One term's `x^e`: undefined is zero, overflowed and zero-to-a-non-positive-power are `#NUM!`. */
const seriesPower = (x: number, e: number): number => {
  if (x === 0 && e <= 0) throw FormulaError.BuiltIn.Num; // `0^0` is #NUM! in Excel, 1 in JavaScript
  const power = Math.pow(x, e);
  if (Number.isNaN(power)) return 0;
  if (!Number.isFinite(power)) throw FormulaError.BuiltIn.Num;
  return power;
};

/**
 * Returns the sign of a number: 1 if the number is positive, zero if the number is zero, or -1 if the number is negative.
 * @param number is any real number.
 */
export function SIGN(number: number): number {
  // A SUBNORMAL is zero here. The test is against the smallest NORMAL double, not against 0:
  // `SIGN(EXP(-745))` is 0 while `SIGN(2^-1022)` is 1, and the value itself survives everywhere
  // else (`ABS` and `N` of that same subnormal keep it). `2^-1074` cannot see the rule — the `^`
  // operator has already flushed it.
  const value = flushSubnormal(number);
  return value > 0 ? 1 : value === 0 ? 0 : -1;
};

/**
 * Returns the square root of a number.
 * @param number is the number for which you want the square root.
 */
export function SQRT(number: number): number {
  return Math.sqrt(number);
};

/**
 * Returns the square root of (number * Pi).
 * @param number is the number by which p is multiplied.
 * @remarks
 * The category's one Analysis ToolPak name, and it behaves like one where its native neighbors
 * do not: `SQRTPI(TRUE)` is `#VALUE!` where `SQRT(TRUE)` is 1, and `SQRTPI(A1:A3)` is `#VALUE!`
 * where every native sibling spills three results. An array CONSTANT still lifts.
 *
 * The product is taken before the root, so a `number` whose `number * Pi` overflows is `#NUM!`
 * even though its own square root is ordinary: `SQRTPI(1E307*17)` is `#NUM!` and
 * `SQRT(1E307*17)` is 1.3E154.
 */
export function SQRTPI(number: NoLift<Omittable<AcceptError<Scalar>>>): number {
  const value = atpNumber(number);
  if (value < 0) return Number.NaN;
  return Math.sqrt(value * Math.PI);
};

/**
 * The calculation SUBTOTAL performs; 101-111 leave out hidden rows.
 *
 * @remarks
 * Declared `ReportType`, as every numeric built-in enum is: the argument is TRUNCATED (`9.9`
 * is SUM), which an enum's gate does not do, so the body keeps the verdict. 101-111 are
 * labeled with the bare function name, as 1-11 are; a member name keys the descriptor and the
 * language packs, so each must be unique.
 */
enum SubtotalFunction {
  /**
   * The average of the values.
   * @name AVERAGE
   */
  Average = 1,
  /**
   * How many values are numbers.
   * @name COUNT
   */
  Count = 2,
  /**
   * How many values are not empty.
   * @name COUNTA
   */
  CountA = 3,
  /**
   * The largest value.
   * @name MAX
   */
  Max = 4,
  /**
   * The smallest value.
   * @name MIN
   */
  Min = 5,
  /**
   * The product of the values.
   * @name PRODUCT
   */
  Product = 6,
  /**
   * The standard deviation of a sample.
   * @name STDEV
   */
  Stdev = 7,
  /**
   * The standard deviation of a whole population.
   * @name STDEVP
   */
  StdevP = 8,
  /**
   * The sum of the values.
   * @name SUM
   */
  Sum = 9,
  /**
   * The variance of a sample.
   * @name VAR
   */
  Var = 10,
  /**
   * The variance of a whole population.
   * @name VARP
   */
  VarP = 11,
  /**
   * The average of the values, leaving out hidden rows.
   * @name AVERAGE (visible rows)
   */
  AverageVisible = 101,
  /**
   * How many values are numbers, leaving out hidden rows.
   * @name COUNT (visible rows)
   */
  CountVisible = 102,
  /**
   * How many values are not empty, leaving out hidden rows.
   * @name COUNTA (visible rows)
   */
  CountAVisible = 103,
  /**
   * The largest value, leaving out hidden rows.
   * @name MAX (visible rows)
   */
  MaxVisible = 104,
  /**
   * The smallest value, leaving out hidden rows.
   * @name MIN (visible rows)
   */
  MinVisible = 105,
  /**
   * The product of the values, leaving out hidden rows.
   * @name PRODUCT (visible rows)
   */
  ProductVisible = 106,
  /**
   * The standard deviation of a sample, leaving out hidden rows.
   * @name STDEV (visible rows)
   */
  StdevVisible = 107,
  /**
   * The standard deviation of a whole population, leaving out hidden rows.
   * @name STDEVP (visible rows)
   */
  StdevPVisible = 108,
  /**
   * The sum of the values, leaving out hidden rows.
   * @name SUM (visible rows)
   */
  SumVisible = 109,
  /**
   * The variance of a sample, leaving out hidden rows.
   * @name VAR (visible rows)
   */
  VarVisible = 110,
  /**
   * The variance of a whole population, leaving out hidden rows.
   * @name VARP (visible rows)
   */
  VarPVisible = 111,
}

/**
 * Returns a subtotal in a list or database.
 * @param functionNum is the number 1 to 11 that specifies the summary function for the subtotal.
 * @param ref are 1 to 254 ranges or references for which you want the subtotal.
 *
 * @remarks
 * Nested SUBTOTAL and AGGREGATE results within ref are always excluded.
 */
export function SUBTOTAL(
  functionNum: ReportType<SubtotalFunction>,
  ref: IReferenceRange[]
): Scalar { // number
  const num = Math.trunc(functionNum);
  const ignoreHidden = num >= 101;
  const code = ignoreHidden ? num - 100 : num;

  // Strip hidden rows, then strip nested totals. `filterTotals` works per cell, since a subtotal
  // row usually sits inside the range it summarizes rather than being a whole argument.
  const hidden = ignoreHidden ? undefined : _ONLY_WHILE_FILTERED;
  let ranges = ref
    .map(r => FormulaContext.filterHidden(r, hidden))
    .map(r => FormulaContext.filterTotals(r));

  // Errors propagate except for the count codes, and only from visible rows, so the scan runs
  // after the hidden filter (hence AcceptError on the params).
  if (code !== 2 && code !== 3) {
    for (const range of ranges) {
      if (range.hasError()) return range.firstError()!;
    }
  }

  // Pad is empty, not `concat`'s default #N/A; see AGGREGATE.
  const combined = ranges.reduce((acc, r) => acc.concat(r, IRange.Axis.Row, null));
  const agg: Readonly<IRangeStats.Aggregates> = combined.getStats().getAggregates();

  switch (code) {
    // SUM and AVERAGE carry the cancellation snap; AVERAGE snaps the sum, then divides.
    case 1: {                                       // AVERAGE → #DIV/0! if no numbers
      const n = agg.numericalCount ?? 0;
      if (n === 0) throw FormulaError.BuiltIn.Div0!;
      return combined.getStats().getSnappedSum() / n;
    }
    case 2:  return agg.numericalCount ?? 0;        // COUNT
    case 3:  return combined.getStats().getCount(); // COUNTA
    case 4:  return agg.max ?? 0;                   // MAX
    case 5:  return agg.min ?? 0;                   // MIN
    case 6: {                                       // PRODUCT
      let product = 1;
      let found = false;
      combined.forEach((v: Scalar) => { if (typeof v === 'number') { product *= v; found = true; } });
      return found ? product : 0;
    }
    case 7: { if ((agg.numericalCount ?? 0) < 2) throw FormulaError.BuiltIn.Div0!; return agg.stdDev!; }  // STDEV
    case 8:  { if ((agg.numericalCount ?? 0) < 1) throw FormulaError.BuiltIn.Div0!; return agg.stdDevP!; } // STDEVP
    case 9:  return combined.getStats().getSnappedSum(); // SUM
    case 10: { if ((agg.numericalCount ?? 0) < 2) throw FormulaError.BuiltIn.Div0!; return agg.var!; }      // VAR
    case 11: { if ((agg.numericalCount ?? 0) < 1) throw FormulaError.BuiltIn.Div0!; return agg.varP!; } // VARP
    default: return FormulaError.BuiltIn.Value!;
  }
}

/**
 * Adds all the numbers in a range of cells.
 * @param number are 1 to 255 numbers to sum. Logical values and text are ignored in cells, included if typed as arguments.
 */
export function SUM(number: IRange<number>[]): number {
  // The cancellation snap is judged on the last range that contributed numbers.
  let sum: number = 0;
  let last: IRangeStats | null = null;
  for (const range of number) {
    const stats = range.getStats();
    const agg = stats.getAggregates();
    sum += agg.sum ?? 0;
    if (agg.numericalCount > 0) last = stats;
  }
  return last ? last.getSnappedSum(sum) : sum;
}

/**
 * Adds the cells specified by a given condition or criteria.
 * @param range is the range of cells you want evaluated.
 * @param criteria is the condition or criteria in the form of a number, expression, or text that defines which cells will be added.
 * @param sumRange are the actual cells to sum. If omitted, the cells in range are used.
 */
export function SUMIF(
  range: IReferenceRange,
  criteria: AcceptError<Scalar>,
  sumRange?: IReferenceRange
): Scalar {
  const sumIf = rejectMatchedError((accumulator: Scalar, value: Scalar) => {
    if (accumulator === null) accumulator = 0;
    if (typeof value !== 'number') return accumulator;
    return (accumulator as number) + value;
  });
  return reduceIf(range, criteria, sumRange, sumIf, ignoreBlanks);
};

/**
 * Adds the cells specified by a given set of conditions or criteria.
 * @param sumRange are the actual cells to sum.
 * @param criteria the ranges to evaluate and the conditions to evaluate them against.
 * @param criteria.criteriaRange is the range of cells you want evaluated for the particular condition.
 * @param criteria.criteria is the condition or criteria in the form of a number, expression, or text that defines which cells will be added.
 */
export function SUMIFS(
  // A REFERENCE, as SUMIF's two range slots are: `SUMIFS(9,…)` and `SUMIFS({1,2,3},…)` are
  // refused at entry rather than answered.
  sumRange: IReferenceRange,
  criteria: Repeating<[criteriaRange: IReferenceRange, criteria: AcceptError<Scalar>]>
): Scalar {
  return aggregateIFS(FormulaContext, criteria,
    rejectMatchedError((acc, val) => {
      if (typeof val !== 'number') return acc; // skip text and booleans; errors never get here
      return acc === null ? val : (acc as number) + val;
    }),
    sumRange,
    0, // noMatchDefault
    ignoreBlanks
  ) as unknown as Scalar;
}

/**
 * Returns the sum of the products of corresponding ranges or arrays.
 * @param array are 2 to 255 arrays for which you want to multiply and then add components. All arrays must have the same dimensions.
 */
export function SUMPRODUCT(
  array: IRange[]
): number {
  // `array` is untyped on purpose: every non-numeric argument or member (text, numeric-looking
  // text, booleans) is a zero term (`SUMPRODUCT("3",2)` is 0), where a number-typed read would
  // coerce direct scalars. Member errors still propagate.
  //
  // Each ARGUMENT is one rectangle: a union is `#VALUE!` where SUM adds every area. The
  // marshaller hands a rest range slot one entry per area, so the body asks what each argument
  // WAS.
  const args = FormulaContext.getArgs().getRepeatingArgsAt(0);
  for (let i = 0, length = args.getLength(); i < length; i++) {
    const raw = args.getRawAt(i);
    if (!Array.isArray(raw)) continue;
    // A 3-D span (`Alpha:Gamma!A1`) is one argument over several sheets, and is `#REF!`.
    if ((raw as { isSheetSpan?: true }).isSheetSpan) throw FormulaError.BuiltIn.Ref;
    throw FormulaError.BuiltIn.Value;
  }
  // A member error outranks the shape mismatch, first in argument order, row-major within.
  for (let i = 0; i < array.length; i++) {
    if (array[i].hasError()) throw array[i].firstError()!;
  }
  const array1 = array[0];
  const rest = array.slice(1);
  const rows = array1.getRowCount();
  const cols = array1.getColumnCount();
  const restLength = rest.length;
  for (let i=0; i<restLength; i++) {
    if (rest[i].getRowCount() !== rows || rest[i].getColumnCount() !== cols) {
      throw FormulaError.BuiltIn.Value;
    }
  }
  // A lone blank cell argument is #VALUE!; blank members of larger arguments are zero terms.
  if (rows === 1 && cols === 1) {
    if (array1.getValueAt(0, 0) === null) throw FormulaError.BuiltIn.Value;
    for (let i=0; i<restLength; i++) {
      if (rest[i].getValueAt(0, 0) === null) throw FormulaError.BuiltIn.Value;
    }
  }
  if (restLength === 0) {
    let sum = 0;
    for (const value of array1.values()) {
      if (typeof value === 'number') sum += value;
    }
    return sum;
  }
  // Lockstep merge over all arguments; a position where any argument is non-numeric is a zero product.
  return sumAligned(array1, rest, productKernel);
};

/**
 * Returns the sum of the squares of the arguments. The arguments can be numbers, arrays, names, or references to cells that contain numbers.
 * @param number are 1 to 255 numbers, arrays, names, or references to arrays for which you want the sum of the squares.
 */
export function SUMSQ(number: IRange<number>[]): number {
  let sum: number = 0;
  for (const range of number) {
    for (const value of range.values<number>()) {
      // The SQUARE is a multiply and flushes; the running sum is an add and does not.
      sum += flushSubnormal(value as number ** 2);
    }
  }
  return sum;
}

/**
 * Sums the differences between the squares of two corresponding ranges or arrays.
 * @param arrayX is the first range or array of numbers and can be a number or name, array, or reference that contains numbers.
 * @param arrayY is the second range or array of numbers and can be a number or name, array, or reference that contains numbers.
 */
export function SUMX2MY2(
  arrayX: IRange,
  arrayY: IRange
): number {
  return sumPaired(arrayX, arrayY, (x, y) => flushSubnormal(x ** 2) - flushSubnormal(y ** 2));
};

/**
 * Returns the sum total of the sums of squares of numbers in two corresponding ranges or arrays.
 * @param arrayX is the first range or array of numbers and can be a number or name, array, or reference that contains numbers.
 * @param arrayY is the second range or array of numbers and can be a number or name, array, or reference that contains numbers.
 */
export function SUMX2PY2(
  arrayX: IRange,
  arrayY: IRange
): number {
  return sumPaired(arrayX, arrayY, (x, y) => flushSubnormal(x ** 2) + flushSubnormal(y ** 2));
};

/**
 * Sums the squares of the differences in two corresponding ranges or arrays.
 * @param arrayX is the first range or array of numbers and can be a number or name, array, or reference that contains numbers.
 * @param arrayY is the second range or array of numbers and can be a number or name, array, or reference that contains numbers.
 */
export function SUMXMY2(
  arrayX: IRange,
  arrayY: IRange
): number {
  return sumPaired(arrayX, arrayY, (x, y) => flushSubnormal((x - y) ** 2));
};

/**
 * Truncates a number to an integer by removing the decimal, or fractional, part of the number.
 * @param number is the number you want to truncate.
 * @param numDigits is a number specifying the precision of the truncation.
 */
export function TRUNC(
  number: number,
  numDigits: number=0
): number {
  const digits = roundDigits(numDigits);
  if (digits === 0) return Math.trunc(round15(number));

  // Scale by a positive power of ten, never a reciprocal, which would cost a digit.
  const multiplier = roundScale(digits);
  if (multiplier === undefined) return digits > 0 ? number : 0;
  if (digits > 0) {
    const scaled = round15(round15(number) * multiplier);
    if (!Number.isFinite(scaled)) return number;
    return round15(Math.trunc(scaled) / multiplier);
  }
  return Math.trunc(round15(number / multiplier)) * multiplier;
};

// helpers

/*
 * `round15` is `_utils/Arithmetic`'s. The rounding family applies it to the operand, then to the
 * SCALED operand (`n * 10^d`) so it tracks the digit being rounded, and again on the way back
 * down, because the descale is a division that can land a ulp off the multiple it is meant to
 * name (`ROUND(2^53,2)` is 9007199254740990, not ...989). The operand pass matters when its 16th
 * digit is a 5: `8.94-8` is 0.9399999999999995, whose 15-digit reading is 0.94, but `* 100`
 * lands a ulp under the half and reads as 93.9999999999999 — `ROUNDDOWN(8.94-8,2)` is 0.94.
 */

/**
 * `num_digits` as ROUNDUP, ROUNDDOWN and TRUNC read it: truncated toward zero. ROUND itself
 * shifts the count first (`excelCount`).
 *
 * `ROUNDDOWN(PI(),2.9)` is 3.14 and `ROUNDDOWN(PI(),-2.9)` is 0 — the same count as 2 and -2. It is a
 * truncation of the RAW double, not of its 15-digit reading, and it is a per-slot fact: the
 * operand beside it is read at 15 digits and this one is not.
 */
const roundDigits = (numDigits: number): number => Math.trunc(numDigits);

/**
 * The largest count ROUND still rounds at. At `2^31 - 1` — INT_MAX exactly — ROUND answers 0
 * where ROUNDUP, ROUNDDOWN and TRUNC all return the operand unchanged, so Excel's ROUND reads
 * the count through a 32-bit integer that has one value of headroom less than its siblings'.
 */
const RoundDigitsMax = 2147483646;

/**
 * `10^n` for a rounding scale, or `undefined` when the scale has run out of exponent.
 *
 * An overflowed scale is not carried into the answer: a count large enough that `x·10^n`
 * is infinite returns the operand untouched, and one small enough that `x/10^|n|` underflows
 * returns 0 — except in ROUNDUP, where the rebuilt `10^|n|` is itself the answer and an
 * infinite one is `#NUM!`.
 */
const roundScale = (digits: number): number | undefined => {
  const scale = Math.pow(10, Math.abs(digits));
  return Number.isFinite(scale) ? scale : undefined;
};

/** Roman numerals, largest first — the order both ROMAN and ARABIC read them in. */
const RomanChars = ['M', 'D', 'C', 'L', 'X', 'V', 'I'];
const RomanValues = [1000, 500, 100, 50, 10, 5, 1];
const RomanMaxIndex = RomanValues.length - 1;
const RomanDigits: Record<string, number> =
  Object.fromEntries(RomanChars.map((c, i) => [c, RomanValues[i]]));

/**
 * The longest text BASE will pad to, DECIMAL will read, and ARABIC will accept.
 *
 * Past it BASE and DECIMAL are `#NUM!` and ARABIC is `#VALUE!`.
 */
const NumeralTextMax = 255;

const productKernel = (values: number[]): number => {
  let product = values[0];
  const length = values.length;
  for (let i=1; i<length; i++) {
    product = flushSubnormal(product * values[i]);
  }
  return product;
}

/**
 * Sums `kernel(members)` across aligned positions, skipping any position with a non-numeric
 * member. No cancellation snap.
 */
const sumAligned = (first: IRange, others: (IRange | null)[], kernel: (values: number[]) => number): number => {
  return first.alignReduce<Scalar, number>(others, (acc, values) => {
    const length = values.length;
    for (let i=0; i<length; i++) {
      if (typeof values[i] !== 'number') return acc; // any non-numeric member skips the position
    }
    return acc + kernel(values as number[]);
  }, 0);
}

/**
 * Argument-shape rules shared by the ATP functions GCD, LCM and MULTINOMIAL: an omitted first
 * argument is #N/A and an empty list is #VALUE!.
 */
const _atpArity = (members: number[]): void => {
  if (FormulaContext.getArgs().getRepeatingArgsAt(0).getKindAt(0) === ValueKind.Omitted) throw FormulaError.BuiltIn.NA;
  if (members.length === 0) throw FormulaError.BuiltIn.Value;
};

/**
 * A 1x1 argument that is not ARRAY-kind is a SCALAR argument, and its own value is settled before
 * the two sizes are compared: a blank cell is #VALUE! and an error propagates, both against a
 * partner of any length. A 1x1 array is an array and takes the size rule instead — `SUMXMY2(A1,
 * B1:B3)` over an `A1` holding #DIV/0! is #DIV/0! where `SUMXMY2({#DIV/0!},B1:B3)` is #N/A, and
 * the COMPUTED `TRANSPOSE({#DIV/0!})` pads like the literal: the
 * split is the argument's KIND, asked of the declaration surface, not its literalness.
 */
const _scalarArgument = (range: IRange, index: number): void => {
  if (range.getRowCount() !== 1 || range.getColumnCount() !== 1) return;
  if (FormulaContext.getArgs().getKindAt(index) === ValueKind.Array) return;
  const value = range.getValueAt(0, 0);
  if (value === null) throw FormulaError.BuiltIn.Value;
  if (FormulaError.isError(value)) throw value;
};

/**
 * Shared evaluation contract for the SUMX2MY2 family:
 *
 * 1. A 1x1 non-literal argument is settled first (see `_scalarArgument`).
 * 2. Sizes are then compared by count, not shape, pairing by row-major ordinal; a mismatch is
 *    #N/A. This check runs before MEMBER errors, which is why the params declare `AcceptError`.
 * 3. Member errors then propagate in argument order, all of X before Y.
 * 4. A pair with a non-numeric member on either side is skipped; zero qualifying pairs is #DIV/0!.
 * 5. No cancellation snap.
 */
const sumPaired = (arrayX: IRange, arrayY: IRange, callbackFn: (x: number, y: number) => number): number => {
  _scalarArgument(arrayX, 0);
  _scalarArgument(arrayY, 1);
  const rowsX = arrayX.getRowCount();
  const colsX = arrayX.getColumnCount();
  if (rowsX * colsX !== arrayY.getRowCount() * arrayY.getColumnCount()) {
    throw FormulaError.BuiltIn.NA;
  }
  if (rowsX !== arrayY.getRowCount() || colsX !== arrayY.getColumnCount()) {
    // same count, different shape: pair by flattened ordinal
    arrayY = arrayY.reshape(rowsX, colsX);
  }
  for (const v of arrayX.values(_optionsRowAxis)) {
    if (FormulaError.isError(v)) throw pairedMemberError(v);
  }
  for (const v of arrayY.values(_optionsRowAxis)) {
    if (FormulaError.isError(v)) throw pairedMemberError(v);
  }
  let pairs = 0;
  const sum = arrayX.alignReduce<Scalar, number>([arrayY], (acc, values) => {
    if (typeof values[0] !== 'number' || typeof values[1] !== 'number') return acc;
    pairs++;
    return acc + callbackFn(values[0] as number, values[1] as number);
  }, 0);
  if (pairs === 0) throw FormulaError.BuiltIn.Div0;
  return sum;
}

/** `SUBTOTAL` 1-11's read of hidden rows: only while the range's sheet is filtered. */
const _ONLY_WHILE_FILTERED: IFormulaContext.FilterHiddenOptions = { onlyWhileFiltered: true };

const _optionsRowAxis: IRange.IteratorOptions = {
  axis: IRange.Axis.Row
};

// Inclusive bound (2^53) on GCD/LCM arguments and on the running LCM result.
const _binaryStein64 = 9007199254740992;
