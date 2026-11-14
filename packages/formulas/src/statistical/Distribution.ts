/* cspell: disable */
import {
  ScalarType, FormulaError, FormulaContext, IRange, ValueKind,
  type Scalar, type Omittable, type IReferenceRange, type ReportType, type Repeating
} from '@sheetxl/primitives';

import { AVERAGE } from './Statistical';

import { COMBIN } from '../mathTrig/Math';

import { flushSubnormal } from '../_utils/Arithmetic';
import { coerceAValue, isReferenceRange } from '../_utils/AValues';
import { pairedMemberError, pairedRangeError } from '../_utils/Errors';

import { gammafn, gammaln } from '../_utils/SpecialFunctions';
import { CombinMax } from '../_utils/Combinatorics';
import {
  betaCdf, betaInv, betaPdf, binomialCdf, binomialPdf, centralFCdf, centralFCdfUpper,
  centralFInv, centralFInvUpper, centralFPdf,
  chisquareCdf, chisquareCdfUpper, chisquareInv, chisquareInvUpper, chisquarePdf, exponentialCdf, exponentialPdf,
  gammaCdf, gammaInv,
  gammaPdf, lognormalCdf, lognormalInv, lognormalPdf, negbinCdf, negbinPdf, normalCdf,
  normalConfidence, normalInv, normalPdf, poissonCdf, poissonPdf, studenttCdf, studenttCdfUpper,
  studenttConfidence, studenttInv, studenttPdf
} from '../_utils/Distributions';

/**
 * The largest degrees of freedom the t, F and chi-square families accept: exactly 10^10, read
 * after truncation (`1E10+0.5` is 10^10 and answers; `1E10+1` is refused). The chi-square
 * RIGHT-tail inverse is the one member with no such ceiling.
 */
const DegFreedomMax = 1e10;

/** The probability under which `1 - p` has too few digits left to carry a quantile. */
const FarTail = 1e-4;

/** The smallest normal double, 2^-1022: below it a value is zero, because there are no subnormals. */
const MinNormal = 2.2250738585072014e-308;

/*
 * These reducers read a whole column before they fold it, and they accumulate LEFT TO RIGHT.
 *
 * The order is worth a bit: over 2^53, 1, 1, 1, 100 the mean is
 * 1801439850948218.5, which is the forward sum divided by five — folding the same column from the
 * back gives a different last bit. The values are collected first rather than summed in place
 * because the mean has to be known before the deviations are taken.
 */
const sumForward = (values: readonly number[]): number => {
  let total = 0;
  for (let i = 0; i < values.length; i++) total += values[i]!;
  return total;
};

const arithmeticMean = (values: readonly number[]): number => sumForward(values) / values.length;

const geomean = (values: readonly number[]): number => Math.exp(arithmeticMean(values.map(Math.log)));

const stdev = (values: readonly number[], sample?: boolean): number => {
  const m = arithmeticMean(values);
  let total = 0;
  for (let i = 0; i < values.length; i++) {
    const d = values[i]! - m;
    total += d * d;
  }
  return Math.sqrt(total / (values.length - (sample ? 1 : 0)));
};

/** The tolerance a COUNT slot is made whole with — exactly 2^-22, as at TDIST's `tails`. */
const TailsTolerance = 2 ** -22;

/**
 * The smallest whole count from 0 to `trials` whose cumulative binomial passes `alpha`, or `NaN`
 * when none does — the search behind BINOM.INV and CRITBINOM.
 *
 * The cumulative is non-decreasing in the count, so the answer is found by bisection rather than
 * by stepping. The cost is then the LOGARITHM of `trials`, which is what lets an answer exist at
 * all when `trials` is astronomically large; the candidates searched are the same ones a step
 * would visit, and the cumulative is evaluated against `trials` exactly as given.
 *
 * Past 2^53 consecutive whole numbers are no longer distinct, so the midpoint eventually stops
 * separating the two ends. The search stops there rather than spinning, and answers for the
 * count it has reached.
 */
const smallestCountAbove = (trials: number, probabilityS: number, alpha: number): number => {
  let lo = 0;
  let hi = Math.floor(trials);
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    const passes = binomialCdf(mid, trials, probabilityS) > alpha;
    const nextLo = passes ? lo : mid + 1;
    const nextHi = passes ? mid : hi;
    if (nextLo === lo && nextHi === hi) break;
    lo = nextLo;
    hi = nextHi;
  }
  return binomialCdf(lo, trials, probabilityS) > alpha ? lo : Number.NaN;
};

/**
 * Returns the beta probability distribution function.
 * @name BETA.DIST
 * @param x is the value between A and B at which to evaluate the function.
 * @param alpha is a parameter to the distribution and must be greater than 0.
 * @param beta is a parameter to the distribution and must be greater than 0.
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability density function, use FALSE.
 * @param a lower bound to the interval of x.
 * @param b upper bound to the interval of x.
 */
export function BETA_DIST(
  x: number,
  alpha: number,
  beta: number,
  cumulative: boolean,
  a: number=0,
  b: Omittable<number>=1
): number {
  if (alpha <= 0 || beta <= 0 || x < a || x > b || a === b) return Number.NaN; // #NUM!

  if (!cumulative) {
    // The density's two refusals read `x` itself, not its place in the interval: 0 where
    // `alpha` is 1 or less and 1 where `beta` is — `BETA.DIST(0,1,1,FALSE,-1,1)` is #NUM! in
    // the middle of its interval, and `BETA.DIST(1,2,1,FALSE,1,3)` is #NUM! at its lower end.
    if ((x === 0 && alpha <= 1) || (x === 1 && beta <= 1)) return Number.NaN; // #NUM!
    // Otherwise either end of the interval is 0, whatever the shape:
    // `BETA.DIST(0.6,1,1,FALSE,0.6,0.7)` is 0 where the uniform density is 10.
    if (x === a || x === b) return 0;
  }
  x = (x - a) / (b - a);
  return cumulative ? betaCdf(x, alpha, beta) : betaPdf(x, alpha, beta) / (b - a);
}

/**
 * Returns the cumulative beta probability density function.
 * @param x is the value between A and B at which to evaluate the function.
 * @param alpha is a parameter to the distribution and must be greater than 0.
 * @param beta is a parameter to the distribution and must be greater than 0.
 * @param a lower bound to the interval of x.
 * @param b upper bound to the interval of x.
 * @category Compatibility
 */
export function BETADIST(
  x: number,
  alpha: number,
  beta: number,
  a: number=0,
  b: Omittable<number>=1
): number {
  return BETA_DIST(x, alpha, beta, true, a, b);
}

/**
 * Returns the inverse of the cumulative beta probability density function (BETA.DIST).
 * @name BETA.INV
 * @param probability is a probability associated with the beta distribution.
 * @param alpha is a parameter to the distribution and must be greater than 0.
 * @param beta is a parameter to the distribution and must be greater than 0.
 * @param a lower bound to the interval of x.
 * @param b upper bound to the interval of x.
 */
export function BETA_INV(
  probability: number,
  alpha: number,
  beta: number,
  a: number=0,
  b: Omittable<number>=1
): number {
  // The interval is refused for itself here: BETA.DIST reaches the same refusal through `x`,
  // which the inverse has no equivalent of. The probability is OPEN at both ends — 0 and 1 are
  // refused, although the quantiles there are the bounds themselves.
  if (alpha <= 0 || beta <= 0 || probability <= 0 || probability >= 1 || a >= b) return Number.NaN; // #NUM!

  return betaInv(probability, alpha, beta) * (b - a) + a;
}

/**
 * Returns the inverse of the cumulative beta probability density function (BETADIST).
 * @param probability is a probability associated with the beta distribution.
 * @param alpha is a parameter to the distribution and must be greater than 0.
 * @param beta is a parameter to the distribution and must be greater than 0.
 * @param a lower bound to the interval of x.
 * @param b upper bound to the interval of x.
 * @category Compatibility
 */
export function BETAINV(
  probability: number,
  alpha: number,
  beta: number,
  a: number=0,
  b: Omittable<number>=1
): number {
  return BETA_INV(probability, alpha, beta, a, b);
}

/**
 * Returns the individual term binomial distribution probability.
 * @name BINOM.DIST
 * @param numberS is the number of successes in trials.
 * @param trials is the number of independent trials.
 * @param probabilityS is the probability of success on each trial.
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability mass function, use FALSE.
 */
export function BINOM_DIST(
  numberS: number,
  trials: number,
  probabilityS: number,
  cumulative: boolean
): number {
  // A negative count is refused as written: `BINOM.DIST(-0.00001,1,1,FALSE)` is #NUM!, not the
  // zero successes it truncates to.
  if (numberS < 0 || trials < 0) return Number.NaN; // #NUM!
  // Both counts are made whole before they are compared with each other or with the ceiling.
  numberS = Math.trunc(numberS);
  trials = Math.trunc(trials);
  if (trials < 0 || probabilityS < 0 || probabilityS > 1 || numberS < 0 || numberS > trials) return Number.NaN; // #NUM!
  if (trials > CombinMax) return Number.NaN; // #NUM! — a count stops one short of INT_MAX
  // The mass at no successes under a certain one is refused, where every other corner answers:
  // `BINOM.DIST(0,5,1,FALSE)` is #NUM!, `BINOM.DIST(5,5,1,FALSE)` is 1, `BINOM.DIST(0,5,0,FALSE)` is 1
  // and so is no success in no trials, `BINOM.DIST(0,0,1,FALSE)`.
  if (!cumulative && numberS === 0 && trials > 0 && probabilityS === 1) return Number.NaN; // #NUM!

  return cumulative
    ? binomialCdf(numberS, trials, probabilityS)
    : binomialPdf(numberS, trials, probabilityS);
}

/**
 * Returns the individual term binomial distribution probability.
 * @param numberS is the number of successes in trials.
 * @param trials is the number of independent trials.
 * @param probabilityS is the probability of success on each trial.
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability mass function, use FALSE.
 * @category Compatibility
 */
export function BINOMDIST(
  numberS: number,
  trials: number,
  probabilityS: number,
  cumulative: boolean
): number {
  return BINOM_DIST(numberS, trials, probabilityS, cumulative);
}

/**
 * Returns the probability of a trial result using a binomial distribution.
 * @name BINOM.DIST.RANGE
 * @param trials is the number of independent trials.
 * @param probabilityS is the probability of success on each trial.
 * @param numberS is the number of successes in trials.
 * @param numberS2 if provided this function returns the probability that the number of successful trials shall lie between number_s and number_s2.
 */
export function BINOM_DIST_RANGE(
  trials: number,
  probabilityS: number,
  numberS: number,
  numberS2: Omittable<number>=numberS,
): number {
  // The three counts are made whole BEFORE they are compared with each other: `number_s` of
  // 5.999999999999999 against a `number_s2` of 5 is the single term 5, not an inverted range.
  trials = Math.trunc(trials);
  numberS = Math.trunc(numberS);
  numberS2 = Math.trunc(numberS2);
  if (trials < 0 || probabilityS < 0 || probabilityS > 1 || numberS < 0 || numberS > trials || numberS2 < numberS || numberS2 > trials)
    return Number.NaN;
  if (trials > CombinMax) return Number.NaN; // #NUM! — a count stops one short of INT_MAX

  // The mass is taken from the shared binomial rather than from a bare binomial coefficient: the
  // coefficient alone overflows a double at a few thousand trials, where the mass it belongs to
  // is an ordinary small number and the range is an ordinary answer.
  // The walk is bounded: a range past `RangeWalkMax` terms is the difference of two cumulatives,
  // which is the same number, rather than two billion masses added one by one.
  if (numberS2 - numberS > RangeWalkMax) {
    return binomialCdf(numberS2, trials, probabilityS)
      - (numberS > 0 ? binomialCdf(numberS - 1, trials, probabilityS) : 0);
  }
  let result = 0;
  for (let i = numberS; i <= numberS2; i++) result += binomialPdf(i, trials, probabilityS);
  return result;
}

/** The longest range BINOM.DIST.RANGE sums term by term. */
const RangeWalkMax = 100000;

/**
 * Returns the smallest value for which the cumulative binomial distribution is greater than or equal to a criterion value.
 * @name BINOM.INV
 * @param trials is the number of Bernoulli trials.
 * @param probabilityS is the probability of success on each trial, a number between 0 and 1 inclusive.
 * @param alpha is the criterion value, a number between 0 and 1 inclusive.
 */
export function BINOM_INV(
  trials: number,
  probabilityS: number,
  alpha: number
): number {
  // The count is taken WHOLE, as its legacy spelling CRITBINOM does: `BINOM.INV(2.5,0.5,0.99)`
  // is 2 under both names — and it is a count, so it stops one short of INT_MAX. Both
  // probabilities are OPEN intervals: a certain or impossible success is refused, not answered
  // with a degenerate count.
  trials = Math.floor(trials);
  if (trials < 0 || trials > CombinMax) return Number.NaN; // #NUM!
  if (probabilityS <= 0 || probabilityS >= 1 || alpha <= 0 || alpha >= 1) return Number.NaN; // #NUM!

  return smallestCountAbove(trials, probabilityS, alpha);
}

/**
 * Returns the left-tailed probability of the chi-squared distribution.
 * @name CHISQ.DIST
 * @param x is the value at which you want to evaluate the distribution, a nonnegative number.
 * @param degFreedom is the number of degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @param cumulative is a logical value for the function to return: the cumulative distribution function = TRUE; the probability density function = FALSE.
 */
export function CHISQ_DIST(
  x: number,
  degFreedom: number,
  cumulative: boolean
): number {
  // The degrees of freedom are read RAW and truncated — 2.9999999999999996 is two.
  degFreedom = Math.trunc(degFreedom);
  if (x < 0 || degFreedom < 1 || degFreedom > DegFreedomMax) return Number.NaN; // #NUM!

  return cumulative
    ? chisquareCdf(x, degFreedom)
    : chisquarePdf(x, degFreedom);
}

/**
 * Returns the right-tailed probability of the chi-squared distribution.
 * @param x is the value at which you want to evaluate the distribution, a nonnegative number.
 * @param degFreedom is the number of degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @category Compatibility
 */
export function CHIDIST(
  x: number,
  degFreedom: number
): number {
  return CHISQ_DIST_RT(x, degFreedom);
}

/**
 * Returns the right-tailed probability of the chi-squared distribution.
 * @name CHISQ.DIST.RT
 * @param x is the value at which you want to evaluate the distribution, a nonnegative number.
 * @param degFreedom is the number of degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 */
export function CHISQ_DIST_RT(
  x: number,
  degFreedom: number
): number {
  degFreedom = Math.trunc(degFreedom);
  if (x < 0 || degFreedom < 1 || degFreedom > DegFreedomMax) return Number.NaN;

  return chisquareCdfUpper(x, degFreedom);
}

/**
 * Returns the inverse of the left-tailed probability of the chi-squared distribution.
 * @name CHISQ.INV
 * @param probability is a probability associated with the chi-squared distribution, a value between 0 and 1 inclusive.
 * @param degFreedom is the number of degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 */
export function CHISQ_INV(
  probability: number,
  degFreedom: number
): number {
  degFreedom = Math.trunc(degFreedom);
  // The probability is half-open: 0 answers 0, and 1 is refused — the quantile there is infinite.
  if (probability < 0 || probability >= 1 || degFreedom < 1 || degFreedom > DegFreedomMax) return Number.NaN;

  return chisquareInv(probability, degFreedom);
}

/**
 * Returns the inverse of the right-tailed probability of the chi-squared distribution.
 * @param probability is a probability associated with the chi-squared distribution, a value between 0 and 1 inclusive.
 * @param degFreedom is the number of degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @category Compatibility
 */
export function CHIINV(
  probability: number,
  degFreedom: number
): number {
  return CHISQ_INV_RT(probability, degFreedom);
}

/**
 * Returns the inverse of the right-tailed probability of the chi-squared distribution.
 * @name CHISQ.INV.RT
 * @param probability is a probability associated with the chi-squared distribution, a value between 0 and 1 inclusive.
 * @param degFreedom is the number of degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 */
export function CHISQ_INV_RT(
  probability: number,
  degFreedom: number
): number {
  degFreedom = Math.trunc(degFreedom);
  // 1 answers 0 and 0 is refused. Under a half the search runs on the tail as given:
  // `CHISQ.INV.RT(1E-12,5)` is 65.2386362133678, where `1 - 1E-12` has four of its digits left.
  if (probability <= 0 || probability > 1 || degFreedom < 1) return Number.NaN;
  if (probability >= 0.5) return chisquareInv(1 - probability, degFreedom);
  // At ONE degree of freedom the tail is the one `1 - probability` leaves behind in a double:
  // `CHISQ.INV.RT(1E-12,1)` is 50.8441713, the quantile of 0.99997788E-12, and a probability
  // under 2^-54 leaves nothing and is refused.
  if (degFreedom === 1) {
    probability = 1 - (1 - probability);
    if (probability === 0) return Number.NaN;
  }
  return chisquareInvUpper(probability, degFreedom);
}

/**
 * Returns the test for independence: the value from the chi-squared distribution for the statistic and the appropriate degrees of freedom.
 * @name CHISQ.TEST
 * @param actualRange is the range of data that contains observations to test against expected values.
 * @param expectedRange is the range of data that contains the ratio of the product of row totals and column totals to the grand total.
 */
export function CHISQ_TEST(
  actualRange: IRange,
  expectedRange: IRange
): Scalar {
  const single = _singleCellReference(actualRange) ?? _singleCellReference(expectedRange);
  if (single) return single;

  const rows = actualRange.getRowCount();
  const cols = actualRange.getColumnCount();
  // The COUNT check outranks a member error and nothing else does, so the parameters accept
  // errors and the scan runs here, between the two: a 3-cell actual holding an error against a
  // 2-cell expected is #N/A, while the same error against a 1x1 pair, or against a zero expected
  // value, is the error. Argument order, unlike the `_twoRangeStats` family below.
  if (rows * cols !== expectedRange.getRowCount() * expectedRange.getColumnCount())
    throw FormulaError.BuiltIn.NA;
  if (actualRange.hasError()) return pairedRangeError(actualRange);
  if (expectedRange.hasError()) return pairedRangeError(expectedRange);
  if (rows === 1 && cols === 1) throw FormulaError.BuiltIn.NA;
  if (expectedRange.getRowCount() !== rows || expectedRange.getColumnCount() !== cols) {
    expectedRange = expectedRange.reshape(rows, cols);
  }

  // The degrees of freedom come from the ACTUAL range's shape, cells and all — a 2x3 block
  // against the same six values as a column is dof 2 against dof 5, and a position dropped for a
  // non-numeric member still counts.
  let dof: number;
  if (rows === 1) dof = cols - 1;
  else if (cols === 1) dof = rows - 1;
  else dof = (rows - 1) * (cols - 1);

  // A position where either member is non-numeric contributes nothing; an error member
  // propagates; a zero expected value under a numeric actual is #DIV/0!, and so is having no
  // numeric position at all.
  let xsqr = 0;
  let used = 0;
  for (const [values] of actualRange.alignValues([expectedRange])) {
    const actual = values[0];
    const expected = values[1];
    if (typeof actual !== 'number' || typeof expected !== 'number') continue;
    if (expected === 0) return FormulaError.BuiltIn.Div0!;
    xsqr += ((actual - expected) ** 2) / expected;
    used++;
  }
  if (used === 0) return FormulaError.BuiltIn.Div0!;
  if (!Number.isFinite(xsqr)) return FormulaError.BuiltIn.Num!;

  return CHISQ_DIST_RT(xsqr, dof);
}

/**
 * Returns the test for independence: the value from the chi-squared distribution for the statistic and the appropriate degrees of freedom.
 * @param actualRange is the range of data that contains observations to test against expected values.
 * @param expectedRange is the range of data that contains the ratio of the product of row totals and column totals to the grand total.
 * @category Compatibility
 */
export function CHITEST(
  actualRange: IRange,
  expectedRange: IRange
): Scalar {
  return CHISQ_TEST(actualRange, expectedRange);
}

/**
 * Returns the confidence interval for a population mean, using a normal distribution.
 * @name CONFIDENCE.NORM
 * @param alpha is the significance level used to compute the confidence level, a number greater than 0 and less than 1.
 * @param standardDev is the population standard deviation for the data range and is assumed to be known. Standard_dev must be greater than 0.
 * @param size is the sample size.
 */
export function CONFIDENCE_NORM(
  alpha: number,
  standardDev: number,
  size: number
): number {
  size = Math.trunc(size);
  if (alpha <= 0 || alpha >= 1 || standardDev <= 0 || size < 1) return Number.NaN;  // #NUM!
  // The quantile is taken at `1 - alpha/2`, formed in double: an alpha whose half is under
  // 2^-54 reaches the normal inverse as 1 and is refused with it, where the t form is not.
  if (1 - alpha / 2 === 1) return Number.NaN; // #NUM!

  return normalConfidence(alpha, standardDev, size);
}

/**
 * Returns the confidence interval for a population mean, using a normal distribution.
 * @param alpha is the significance level used to compute the confidence level, a number greater than 0 and less than 1.
 * @param standardDev is the population standard deviation for the data range and is assumed to be known. Standard_dev must be greater than 0.
 * @param size is the sample size.
 * @category Compatibility
 */
export function CONFIDENCE(
  alpha: number,
  standardDev: number,
  size: number
): number {
  return CONFIDENCE_NORM(alpha, standardDev, size);
}

/**
 * Returns the confidence interval for a population mean, using a Student's T distribution.
 * @name CONFIDENCE.T
 * @param alpha is the significance level used to compute the confidence level, a number greater than 0 and less than 1.
 * @param standardDev is the population standard deviation for the data range and is assumed to be known. Standard_dev must be greater than 0.
 * @param size is the sample size.
 */
export function CONFIDENCE_T(
  alpha: number,
  standardDev: number,
  size: number
): number {
  size = Math.trunc(size);
  if (alpha <= 0 || alpha >= 1 || standardDev <= 0 || size < 1) return Number.NaN; // #NUM!
  if (size === 1) throw FormulaError.BuiltIn.Div0!;
  if (size - 1 > DegFreedomMax) return Number.NaN; // #NUM! — the t's own ceiling, on `size - 1`
  // The quantile is taken at `alpha/2`, and a half that falls below the smallest normal double
  // is zero — there are no subnormals — which the t inverse refuses.
  if (alpha / 2 < MinNormal) return Number.NaN; // #NUM!

  return studenttConfidence(alpha, standardDev, size);
}

/**
 * Returns the correlation coefficient between two data sets.
 * @param array1 is a cell range of values. The values should be numbers, names, arrays, or references that contain numbers.
 * @param array2 is a second cell range of values. The values should be numbers, names, arrays, or references that contain numbers.
 */
export function CORREL(
  array1: IRange,
  array2: IRange
): Scalar {
  const s = _twoRangeStats(array1, array2);
  if (FormulaError.isError(s)) return s;
  if (s === null) return FormulaError.BuiltIn.NA; // #N/A — counts differ
  // A sum of squares past the double is #NUM! — never the 0 that dividing by it would give.
  if (!Number.isFinite(s.ssX) || !Number.isFinite(s.ssY)) return FormulaError.BuiltIn.Num!;
  if (s.ssX === 0 || s.ssY === 0) return FormulaError.BuiltIn.Div0!;
  return s.ssXY / Math.sqrt(s.ssX * s.ssY);
}

/**
 * Returns population covariance, the average of the products of deviations for each data point pair in two data sets.
 * @param array1 is the first cell range of integers and must be numbers, arrays, or references that contain numbers.
 * @param array2 is the second cell range of integers and must be numbers, arrays, or references that contain numbers.
 * @category Compatibility
 *
 */
export function COVAR(
  array1: IRange,
  array2: IRange
): Scalar {
  return COVARIANCE_P(array1, array2);
}

/**
 * Returns population covariance, the average of the products of deviations for each data point pair in two data sets.
 * @name COVARIANCE.P
 * @param array1 is the first cell range of integers and must be numbers, arrays, or references that contain numbers.
 * @param array2 is the second cell range of integers and must be numbers, arrays, or references that contain numbers.
 */
export function COVARIANCE_P(
  array1: IRange,
  array2: IRange
): Scalar {
  const s = _twoRangeStats(array1, array2);
  if (FormulaError.isError(s)) return s;
  if (s === null) return FormulaError.BuiltIn.NA; // counts differ
  if (s.n === 0) return FormulaError.BuiltIn.Div0!; // no numeric pairs
  if (!Number.isFinite(s.ssXY)) return FormulaError.BuiltIn.Num!;
  return s.ssXY / s.n;
}

/**
 * Returns sample covariance, the average of the products of deviations for each data point pair in two data sets.
 * @name COVARIANCE.S
 * @param array1 is the first cell range of integers and must be numbers, arrays, or references that contain numbers.
 * @param array2 is the second cell range of integers and must be numbers, arrays, or references that contain numbers.
 */
export function COVARIANCE_S(
  array1: IRange,
  array2: IRange
): Scalar {
  const s = _twoRangeStats(array1, array2);
  if (FormulaError.isError(s)) return s;
  if (s === null) return FormulaError.BuiltIn.NA; // #N/A — counts differ
  if (s.n <= 1) return FormulaError.BuiltIn.Div0!;
  if (!Number.isFinite(s.ssXY)) return FormulaError.BuiltIn.Num!;
  return s.ssXY / (s.n - 1);
}

/**
 * Returns the smallest value for which the cumulative binomial distribution is greater than or equal to a criterion value.
 * @param trials is the number of Bernoulli trials.
 * @param probabilityS is the probability of success on each trial, a number between 0 and 1 inclusive.
 * @param alpha is the criterion value, a number between 0 and 1 inclusive.
 * @category Compatibility
 */
export function CRITBINOM(
  trials: number,
  probabilityS: number,
  alpha: number
): number {
  return BINOM_INV(trials, probabilityS, alpha);
}

/**
 * Returns the sum of squares of deviations of data points from their sample mean.
 * @param number are 1 to 255 arguments, or an array or array reference, on which you want DEVSQ to calculate.
 */
export function DEVSQ(number: IRange<number>[]): number {
  let sum = 0;
  let numbers = [];
  for (const range of number) {
    for (const value of range.values()) {
      sum += value;
      numbers.push(value);
    }
  }

  const n = numbers.length;
  if (n === 0) throw FormulaError.BuiltIn.Num!; // where AVERAGE is #DIV/0! and HARMEAN is #N/A
  const mean = sum / n;
  sum = 0;
  for (let i=0; i<n; i++) {
    sum += flushSubnormal((numbers[i] - mean) ** 2);
  }
  return sum;
}

/**
 * Returns the exponential distribution.
 * @name EXPON.DIST
 * @param x is the value of the function, a nonnegative number.
 * @param lambda is the parameter value, a positive number.
 * @param cumulative is a logical value for the function to return: the cumulative distribution function = TRUE; the probability density function = FALSE.
 */
export function EXPON_DIST(
  x: number,
  lambda: number,
  cumulative: boolean
): number {
  if (x < 0 || lambda <= 0) return Number.NaN;
  // The exponent is `lambda * x`, and past a double it is a refusal rather than a limit.
  if (!Number.isFinite(lambda * x)) return Number.NaN; // #NUM!

  return cumulative ? exponentialCdf(x, lambda) : exponentialPdf(x, lambda);
}

/**
 * Returns the exponential distribution.
 * @param x is the value of the function, a nonnegative number.
 * @param lambda is the parameter value, a positive number.
 * @param cumulative is a logical value for the function to return: the cumulative distribution function = TRUE; the probability density function = FALSE.
 * @category Compatibility
 */
export function EXPONDIST(
  x: number,
  lambda: number,
  cumulative: boolean
): number {
  return EXPON_DIST(x, lambda, cumulative);
}

/**
 * Returns the (left-tailed) F probability distribution (degree of diversity) for two data sets.
 * @name F.DIST
 * @param x is the value at which to evaluate the function, a nonnegative number.
 * @param degFreedom1 is the numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @param degFreedom2 is the denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @param cumulative is a logical value for the function to return: the cumulative distribution function = TRUE; the probability density function = FALSE.
 */
export function F_DIST(
  x: number,
  degFreedom1: number,
  degFreedom2: number,
  cumulative: boolean
): number {
  // If x is negative, F.DIST returns the #NUM! error value.
  // If degFreedom1 < 1, F.DIST returns the #NUM! error value.
  // If degFreedom2 < 1, F.DIST returns the #NUM! error value.
  if (x < 0 || degFreedom1 < 1 || degFreedom2 < 1) return Number.NaN;

  // If degFreedom1 or degFreedom2 is not an integer, it is truncated.
  degFreedom1 = Math.trunc(degFreedom1);
  degFreedom2 = Math.trunc(degFreedom2);
  if (degFreedom1 > DegFreedomMax || degFreedom2 > DegFreedomMax) return Number.NaN; // #NUM!

  return cumulative ? centralFCdf(x, degFreedom1, degFreedom2) : centralFPdf(x, degFreedom1, degFreedom2);
}

/**
 * Returns the (right-tailed) F probability distribution (degree of diversity) for two data sets.
 * @param x is the value at which to evaluate the function, a nonnegative number.
 * @param degFreedom1 is the numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @param degFreedom2 is the denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @category Compatibility
 */
export function FDIST(
  x: number,
  degFreedom1: number,
  degFreedom2: number
): number {
  return F_DIST_RT(x, degFreedom1, degFreedom2);
}

/**
 * Returns the (right-tailed) F probability distribution (degree of diversity) for two data sets.
 * @name F.DIST.RT
 * @param x is the value at which to evaluate the function, a nonnegative number.
 * @param degFreedom1 is the numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @param degFreedom2 is the denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 */
export function F_DIST_RT(
  x: number,
  degFreedom1: number,
  degFreedom2: number
): number {
  // If degFreedom1 < 1 F.DIST.RT returns the #NUM! error value.
  // If degFreedom2 < 1 F.DIST.RT returns the #NUM! error value.
  // If x is negative, F.DIST.RT returns the #NUM! error value.
  if (x < 0 || degFreedom1 < 1 || degFreedom2 < 1) return Number.NaN;

  // If degFreedom1 or degFreedom2 is not an integer, it is truncated.
  degFreedom1 = Math.trunc(degFreedom1);
  degFreedom2 = Math.trunc(degFreedom2);
  if (degFreedom1 > DegFreedomMax || degFreedom2 > DegFreedomMax) return Number.NaN; // #NUM!

  return centralFCdfUpper(x, degFreedom1, degFreedom2);
}

/**
 * Returns the inverse of the (left-tailed) F probability distribution: if p = F.DIST(x,...), then F.INV(p,...) = x
 * @name F.INV
 * @param probability is a probability associated with the F cumulative distribution, a number between 0 and 1 inclusive.
 * @param degFreedom1 is the numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @param degFreedom2 is the denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 */
export function F_INV(
  probability: number,
  degFreedom1: number,
  degFreedom2: number
): number {
  // If probability < 0 or probability > 1, F.INV returns the #NUM! error value.
  if (probability < 0.0 || probability > 1.0) return Number.NaN;
  // If degFreedom1 < 1, or degFreedom2 < 1, F.INV returns the #NUM! error value.
  if (degFreedom1 < 1.0 || degFreedom2 < 1.0) return Number.NaN;

  // If degFreedom1 or degFreedom2 is not an integer, it is truncated.
  degFreedom1 = Math.trunc(degFreedom1);
  degFreedom2 = Math.trunc(degFreedom2);
  if (degFreedom1 > DegFreedomMax || degFreedom2 > DegFreedomMax) return Number.NaN; // #NUM!

  return centralFInv(probability, degFreedom1, degFreedom2);
}

/**
 * Returns the inverse of the (right-tailed) F probability distribution: if p = FDIST(x,...), then FINV(p,...) = x.
 * @param probability is a probability associated with the F cumulative distribution, a number between 0 and 1 inclusive.
 * @param degFreedom1 is the numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @param degFreedom2 is the denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @category Compatibility
 */
export function FINV(
  probability: number,
  degFreedom1: number,
  degFreedom2: number
): number {
  return F_INV_RT(probability, degFreedom1, degFreedom2);
}

/**
 * Returns the inverse of the (right-tailed) F probability distribution: if p = F.DIST.RT(x,...), then F.INV.RT(p,...) = x.
 * @name F.INV.RT
 * @param probability is a probability associated with the F cumulative distribution, a number between 0 and 1 inclusive.
 * @param degFreedom1 is the numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @param degFreedom2 is the denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 */
export function F_INV_RT(
  probability: number,
  degFreedom1: number,
  degFreedom2: number
): number {
  // If Probability is < 0 or probability is > 1, F.INV.RT returns the #NUM! error value.
  if (probability < 0.0 || probability > 1.0) return Number.NaN;
  if (degFreedom1 < 1.0 || degFreedom2 < 1.0) return Number.NaN;

  // If Deg_freedom1 or Deg_freedom2 is not an integer, it is truncated.
  degFreedom1 = Math.trunc(degFreedom1);
  degFreedom2 = Math.trunc(degFreedom2);
  if (degFreedom1 > DegFreedomMax || degFreedom2 > DegFreedomMax) return Number.NaN; // #NUM!

  // A far tail is searched as given: `F.INV.RT(1E-13,1,1)` is 4.05E+25, and `1 - 1E-13` cannot
  // say which quantile that far out is meant.
  return probability < FarTail
    ? centralFInvUpper(probability, degFreedom1, degFreedom2)
    : centralFInv(1.0 - probability, degFreedom1, degFreedom2);
}

/**
 * Returns the result of an F-test, the two-tailed probability that the variances in Array1 and Array2 are not significantly different.
 * @name F.TEST
 * @param array1 is the first array or range of data and can be numbers or names, arrays, or references that contain numbers (blanks are ignored).
 * @param array2 is the second array or range of data and can be numbers or names, arrays, or references that contain numbers (blanks are ignored).
 *
 * @help https://en.wikipedia.org/wiki/F-test_of_equality_of_variances
 */
export function F_TEST(
  array1: IRange,
  array2: IRange
): Scalar {
  const single = _singleCellReference(array1) ?? _singleCellReference(array2);
  if (single) return single;
  // A member error wins in ARGUMENT order — the whole of array1 before array2 — and outranks the
  // too-few-points check. The paired-statistics lockstep rule is NOT this family's.
  if (array1.hasError()) return pairedRangeError(array1);
  if (array2.hasError()) return pairedRangeError(array2);
  // Each range filters its non-numeric members independently,
  // and the two ranges may have different sizes.
  const x1: number[] = [];
  const x2: number[] = [];
  for (const [range, into] of [[array1, x1], [array2, x2]] as const) {
    range.forEach((v: Scalar) => {
      if (typeof v !== 'number') return;
      into.push(v);
    });
  }
  if (x1.length <= 1 || x2.length <= 1) return FormulaError.BuiltIn.Div0!;

  let x1Mean = 0;
  let x2Mean = 0;
  for (let i=0; i<x1.length; i++) x1Mean += x1[i];
  for (let i=0; i<x2.length; i++) x2Mean += x2[i];
  x1Mean /= x1.length;
  x2Mean /= x2.length;
  let s1 = 0;
  let s2 = 0; // sample variance S^2
  for (let i=0; i<x1.length; i++) {
    s1 += (x1Mean - x1[i]) ** 2
  }
  s1 /= x1.length - 1;
  for (let i=0; i<x2.length; i++) {
    s2 += (x2Mean - x2[i]) ** 2
  }
  s2 /= x2.length - 1;
  // A variance that comes out subnormal is a zero one (the squares are flushed): three values
  // of order 1E-154 are #DIV/0!, not a probability.
  s1 = flushSubnormal(s1);
  s2 = flushSubnormal(s2);
  if (s1 === 0 || s2 === 0) return FormulaError.BuiltIn.Div0!; // zero variance
  if (!Number.isFinite(s1) || !Number.isFinite(s2)) return FormulaError.BuiltIn.Num!;

  // Two-tailed and symmetric in its arguments — double the SMALLER tail.
  const cdf = centralFCdf(s1 / s2, x1.length - 1, x2.length - 1);
  return 2 * Math.min(cdf, 1 - cdf);
}

/**
 * Returns the result of an F-test, the two-tailed probability that the variances in Array1 and Array2 are not significantly different.
 * @param array1 is the first array or range of data and can be numbers or names, arrays, or references that contain numbers (blanks are ignored).
 * @param array2 is the second array or range of data and can be numbers or names, arrays, or references that contain numbers (blanks are ignored).
 * @category Compatibility
 */
export function FTEST(
  array1: IRange,
  array2: IRange
): Scalar {
  return F_TEST(array1, array2);
}

/**
 * Returns the Fisher transformation.
 * @param x is the value for which you want the transformation, a number between -1 and 1, excluding -1 and 1.
 */
export function FISHER(x: number): number {
  // The transform is defined on the OPEN interval and refuses BOTH ends rather than answering an
  // infinity: 0.9999999999999999 answers 17.616361586450413 and 1.0000000000000002 does not.
  if (!(x > -1 && x < 1)) return Number.NaN; // #NUM!
  return Math.log((1 + x) / (1 - x)) / 2;
}

/**
 * Returns the inverse of the Fisher transformation: if y = FISHER(x), then FISHERINV(y) = x.
 * @param y is the value for which you want to perform the inverse of the transformation.
 */
export function FISHERINV(y: number): number {
  const e2y = Math.exp(2 * y);
  // Past about 355 the exponential overflows and the quotient is indeterminate, where the value
  // it stands for is 1. The negative end needs no such care: the exponential underflows to zero
  // and the quotient is -1 already.
  if (e2y === Number.POSITIVE_INFINITY) return 1;
  return (e2y - 1) / (e2y + 1);
}

/**
 * Calculates, or predicts, a future value along a linear trend by using existing values.
 * @param x is the data point for which you want to predict a value and must be a numeric value.
 * @param knownYs is the dependent array or range of numeric data.
 * @param knownXs is the independent array or range of numeric data. The variance of Known_x's must not be zero.
 * @category Compatibility
 */
export function FORECAST(
  x: number,
  knownYs: IRange,
  knownXs: IRange
): Scalar {
  return FORECAST_LINEAR(x, knownYs, knownXs);
}

/**
 * Calculates, or predicts, a future value along a linear trend by using existing values.
 * @name FORECAST.LINEAR
 * @param x is the data point for which you want to predict a value and must be a numeric value.
 * @param knownYs is the dependent array or range of numeric data.
 * @param knownXs is the independent array or range of numeric data. The variance of Known_x's must not be zero.
 */
export function FORECAST_LINEAR(
  x: number,
  knownYs: IRange,
  knownXs: IRange
): Scalar {
  const s = _twoRangeStats(knownYs, knownXs);
  if (FormulaError.isError(s)) return s;
  if (s === null) return FormulaError.BuiltIn.NA;                 // counts differ
  // No surviving pair and a zero spread in x are the same #DIV/0! — the fit has no slope.
  if (s.n === 0 || s.ssX === 0) return FormulaError.BuiltIn.Div0!;
  if (!Number.isFinite(s.ssX)) return FormulaError.BuiltIn.Num!;
  const b = s.ssXY / s.ssX;
  const a = s.yMean - b * s.xMean;
  const result = a + b * x;
  return Number.isFinite(result) ? result : FormulaError.BuiltIn.Num!;
}

/**
 * Calculates how often values occur within a range of values and then returns a vertical array of numbers having one more element than Bins_array.
 * @param dataArray is an array of or reference to a set of values for which you want to count frequencies (blanks and text are ignored).
 * @param binsArray is an array of or reference to intervals into which you want to group the values in data_array.
 */
export function FREQUENCY(
  dataArray: ReportType<IRange>,
  binsArray: ReportType<IRange>
): number[][] {
  // The two slots read DIFFERENTLY, which is the fact worth stating: an error member of
  // `data_array` propagates, while a non-numeric member of `bins_array` — an ERROR included — is
  // simply dropped. Text, booleans and empties skip on both sides.
  dataArray = FormulaContext.flattenAreas(dataArray); // a union bins every area
  binsArray = FormulaContext.flattenAreas(binsArray);
  if (dataArray.hasError()) throw dataArray.firstError()!;

  const binsArrayFiltered: number[] = [];
  for (const value of binsArray.values()) {
    if (typeof value !== "number") continue;
    binsArrayFiltered.push(value);
  }
  // Once every bin has been dropped there is still ONE, and it is zero: over 1,2,3,4,10 an empty
  // bins range, a blank cell, a text and a boolean all answer 0 then 5 rather than the single
  // total a bin-less reading would give.
  if (binsArrayFiltered.length === 0) binsArrayFiltered.push(0);

  const dataNumbers: number[] = [];
  for (const value of dataArray.values()) {
    if (typeof value !== "number") continue;
    dataNumbers.push(value);
  }

  // Each bin counts values in (previous smaller bin, bin]; results map back to
  // the bins' ORIGINAL positions (bins need not be sorted), with the overflow count (> max bin)
  // appended last. Sort bin INDICES numerically (Array.sort's default lexicographic compare
  // mis-orders numbers, e.g. [2, 10] -> [10, 2]).
  const order = binsArrayFiltered.map((_, i) => i)
    .sort((a, b) => binsArrayFiltered[a] - binsArrayFiltered[b]);

  const result: number[][] = [];
  for (let j=0; j<=binsArrayFiltered.length; j++) {
    result[j] = [0];
  }
  let prev = -Infinity;
  for (let k=0; k<order.length; k++) {
    const binIndex = order[k];
    const bound = binsArrayFiltered[binIndex];
    let count = 0;
    for (let i=0; i<dataNumbers.length; i++) {
      const curr = dataNumbers[i];
      if (curr > prev && curr <= bound) count++;
    }
    result[binIndex][0] = count;
    prev = bound;
  }
  // overflow bucket: everything above the largest bin
  let overflow = 0;
  for (let i=0; i<dataNumbers.length; i++) {
    if (dataNumbers[i] > prev) overflow++;
  }
  result[binsArrayFiltered.length][0] = overflow;
  // return a 2d array
  return result;
}

/**
 * Returns the Gamma function value.
 * @param x is the value for which you want to calculate Gamma.
 */
export function GAMMA(x: number): number {
  if (x === 0 || (x < 0 && x === Math.trunc(x))) return Number.NaN; // #NUM!

  return gammafn(x);
}

/**
 * Returns the gamma distribution.
 * @name GAMMA.DIST
 * @param x is the value at which you want to evaluate the distribution, a nonnegative number.
 * @param alpha is a parameter to the distribution, a positive number.
 * @param beta is a parameter to the distribution, a positive number. If beta = 1, GAMMA.DIST returns the standard gamma distribution.
 * @param cumulative is a logical value: return the cumulative distribution function = TRUE; return the probability mass function = FALSE.
 */
export function GAMMA_DIST(
  x: number,
  alpha: number,
  beta: number,
  cumulative: boolean
): number {
  if (x < 0 || alpha <= 0 || beta <= 0) return Number.NaN;
  // Two intermediates have to fit a double: the shape's log-gamma, and the scaled argument
  // DOUBLED — the kernel forms `2 * (x / beta)`, so the refusal sits at half a double, not at one.
  if (!Number.isFinite(gammaln(alpha)) || !Number.isFinite(2 * (x / beta))) return Number.NaN; // #NUM!
  // The density at zero is refused for a shape of 1 or less, the exponential's finite 1/beta
  // included: `GAMMA.DIST(0,1,1,FALSE)` is #NUM! and `GAMMA.DIST(0,2,1,FALSE)` is 0.
  if (!cumulative && x === 0 && alpha <= 1) return Number.NaN; // #NUM!

  return cumulative
    ? gammaCdf(x, alpha, beta)
    : gammaPdf(x, alpha, beta);
}

/**
 * Returns the gamma distribution.
 * @param x is the value at which you want to evaluate the distribution, a nonnegative number.
 * @param alpha is a parameter to the distribution, a positive number.
 * @param beta is a parameter to the distribution, a positive number. If beta = 1, GAMMADIST returns the standard gamma distribution.
 * @param cumulative is a logical value: return the cumulative distribution function = TRUE; return the probability mass function = FALSE.
 * @category Compatibility
 */
export function GAMMADIST(
  x: number,
  alpha: number,
  beta: number,
  cumulative: boolean // REQUIRED — the legacy spelling takes the same four as GAMMA.DIST
): number {
  return GAMMA_DIST(x, alpha, beta, cumulative);
}

/**
 * Returns the inverse of the gamma cumulative distribution: if p = GAMMA.DIST(x,...), then GAMMA.INV(p,...) = x.
 * @name GAMMA.INV
 * @param probability is the probability associated with the gamma distribution, a number between 0 and 1, inclusive.
 * @param alpha is a parameter to the distribution, a positive number.
 * @param beta is a parameter to the distribution, a positive number. If beta = 1, GAMMA.DIST returns the standard gamma distribution.
 */
export function GAMMA_INV(
  probability: number,
  alpha: number,
  beta: number
): number {
  // The probability is half-open: 0 answers 0, and 1 is refused — the quantile there is infinite.
  // If alpha ≤ 0 or if beta ≤ 0, GAMMA.INV returns the #NUM! error value.
  if (probability < 0 || probability >= 1 || alpha <= 0 || beta <= 0) return Number.NaN;

  return gammaInv(probability, alpha, beta);
}

/**
 * Returns the inverse of the gamma cumulative distribution: if p = GAMMADIST(x,...), then GAMMAINV(p,...) = x.
 * @param probability is the value at which you want to evaluate the distribution, a nonnegative number.
 * @param alpha is a parameter to the distribution, a positive number.
 * @param beta is a parameter to the distribution, a positive number. If beta = 1, GAMMAINV returns the standard gamma distribution.
 * @category Compatibility
 */
export function GAMMAINV(
  probability: number,
  alpha: number,
  beta: number
): number {
  return GAMMA_INV(probability, alpha, beta);
}

/**
 * Returns the natural logarithm of the gamma function.
 * @param x is the value for which you want to calculate GAMMALN, a positive number.
 */
export function GAMMALN(x: number): number {
  if (x <= 0) return Number.NaN; // #NUM!

  return gammaln(x);
}

/**
 * Returns the natural logarithm of the gamma function.
 * @name GAMMALN.PRECISE
 * @param x is the value for which you want to calculate GAMMALN.PRECISE, a positive number.
 */
export function GAMMALN_PRECISE(x: number): number {
  if (x <= 0) return Number.NaN; // #NUM!

  return gammaln(x);
}

/**
 * Returns 0.5 less than the standard normal cumulative distribution.
 * @param x is the value for which you want the distribution.
 */
export function GAUSS(x: number): number {
  return normalCdf(x, 0, 1) - 0.5;
}

/**
 * Returns the geometric mean of an array or range of positive numeric data.
 * @param number are 1 to 255 numbers or names, arrays, or references that contain numbers for which you want the mean.
 */
export function GEOMEAN(number: IRange<number>[]): number {
  const numbers = [];
  for (const range of number) {
    for (const value of range.values()) {
      if (value <= 0) return Number.NaN; // #NUM!
      numbers.push(value);
    }
  }

  return geomean(numbers);
}

/**
 * Returns the harmonic mean of a data set of positive numbers: the reciprocal of the arithmetic mean of reciprocals.
 * @param number are 1 to 255 numbers or names, arrays, or references that contain numbers for which you want the harmonic mean.
 */
export function HARMEAN(number: IRange<number>[]): number {
  let cnt = 0;
  let denominator = 0;
  for (const range of number) {
    for (const value of range.values()) {
      if (value <= 0) return Number.NaN; // #NUM!
      denominator += 1 / value;
      cnt++;
    }
  }
  if (cnt === 0) throw FormulaError.BuiltIn.NA!; // and not the family's #NUM!/#DIV/0!
  return cnt / denominator;
}

/**
 * Returns the hypergeometric distribution.
 * @name HYPGEOM.DIST
 * @param sampleS is the number of successes in the sample.
 * @param numberSample is the size of the sample.
 * @param populationS is the number of successes in the population.
 * @param numberPop is the population size.
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability density function, use FALSE.
 */
export function HYPGEOM_DIST(
  sampleS: number,
  numberSample: number,
  populationS: number,
  numberPop: number,
  cumulative: boolean
): number {
  // All four counts are read as whole numbers.
  sampleS = Math.trunc(sampleS);
  numberSample = Math.trunc(numberSample);
  populationS = Math.trunc(populationS);
  numberPop = Math.trunc(numberPop);

  // The refusals are only these: a negative count, a sample larger than the population, or more
  // successes in the population than the population holds. A `sample_s` that CANNOT occur is not
  // refused — it is a mass of zero, and a cumulative that has already collected every mass is 1,
  // which is what the documented "greater than the lesser of" and "less than the larger of"
  // bounds would turn into errors. The remaining ceiling is the binomial coefficient's own.
  if (sampleS < 0 || numberSample < 0 || populationS < 0 || numberPop < 0) return Number.NaN; // #NUM!
  if (numberSample > numberPop) return Number.NaN; // #NUM!
  if (populationS > numberPop) return Number.NaN; // #NUM!
  // Every count stops one short of INT_MAX, `sample_s` included — even where its mass would be 0.
  if (sampleS > CombinMax || numberPop > CombinMax) return Number.NaN; // #NUM!

  const pdf = (x: number): number => {
    // More successes than the sample or the population holds, or more failures than there are:
    // a combination that cannot occur, worth zero rather than an error.
    if (x > numberSample || x > populationS) return 0;
    if (numberSample - x > numberPop - populationS) return 0;
    const direct = COMBIN(populationS, x) * COMBIN(numberPop - populationS, numberSample - x)
      / COMBIN(numberPop, numberSample);
    if (Number.isFinite(direct)) return direct;
    // A binomial coefficient reports an argument it will not take and a value it cannot hold the
    // same way, so the ceiling is checked here rather than read off the result: past it the
    // answer is the refusal.
    if (numberPop > CombinMax) return Number.NaN; // #NUM!
    // Each coefficient overflows a double well before their RATIO does — a thousand draws from
    // ten thousand is an ordinary probability written as one enormous number over another. The
    // logarithms reach it, and are used only where the direct ratio cannot be formed.
    const lnC = (n: number, k: number): number =>
      gammaln(n + 1) - gammaln(k + 1) - gammaln(n - k + 1);
    return Math.exp(lnC(populationS, x) + lnC(numberPop - populationS, numberSample - x)
      - lnC(numberPop, numberSample));
  };

  if (!cumulative) return pdf(sampleS);

  // Every mass above `min(number_sample, population_s)` is zero, so the sum stops there however
  // large `sample_s` is — the answer is the same and the walk is bounded by the population.
  let total = 0;
  const last = Math.min(sampleS, numberSample, populationS);
  for (let i = 0; i <= last; i++) total += pdf(i);
  return total;
}

/**
 * Returns the hypergeometric distribution.
 * @param sampleS is the number of successes in the sample.
 * @param numberSample is the size of the sample.
 * @param populationS is the number of successes in the population.
 * @param numberPop is the population size.
 * @category Compatibility
 */
export function HYPGEOMDIST(
  sampleS: number,
  numberSample: number,
  populationS: number,
  numberPop: number
): number {
  return HYPGEOM_DIST(sampleS, numberSample, populationS, numberPop, false);
}

/**
 * Calculates the point at which a line will intersect the y-axis by using a best-fit regression line plotted through the known x-values and y-values.
 * @param knownYs is the dependent set of observations or data and can be numbers or names, arrays, or references that contain numbers.
 * @param knownXs is the independent set of observations or data and can be numbers or names, arrays, or references that contain numbers.
 */
export function INTERCEPT(
  knownYs: IRange,
  knownXs: IRange
): Scalar {
  // FORECAST_LINEAR's `a` term at x=0
  const s = _twoRangeStats(knownYs, knownXs);
  if (FormulaError.isError(s)) return s;
  if (s === null) return FormulaError.BuiltIn.NA; // #N/A — counts differ
  if (s.ssX === 0) return FormulaError.BuiltIn.Div0!;
  if (!Number.isFinite(s.ssX)) return FormulaError.BuiltIn.Num!;
  const b = s.ssXY / s.ssX;
  const result = s.yMean - b * s.xMean;
  return Number.isFinite(result) ? result : FormulaError.BuiltIn.Num!;
}

/**
 * Returns the kurtosis of a data set.
 * @param number are 1 to 255 numbers or names, arrays, or references that contain numbers for which you want the kurtosis.
 */
export function KURT(number: IRange<number>[]): number {
  let mean = 0;
  const numbers = [];

  for (const range of number) {
    for (const value of range.values()) {
      mean += value;
      numbers.push(value);
    }
  }
  const n = numbers.length;
  if (n < 4) throw FormulaError.BuiltIn.Div0!;
  mean /= n;
  let sigma = 0;
  for (let i=0; i<n; i++) {
    sigma += Math.pow(numbers[i] - mean, 4);
  }
  const sampleStdev = stdev(numbers, true);
  if (sampleStdev === 0) throw FormulaError.BuiltIn.Div0!;
  sigma = sigma / Math.pow(sampleStdev, 4);
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sigma - 3 * (n - 1) * (n - 1) / ((n - 2) * (n - 3));
}

/**
 * Returns the lognormal distribution of x, where ln(x) is normally distributed with parameters Mean and Standard_dev.
 * @name LOGNORM.DIST
 * @param x is the value at which to evaluate the function, a positive number.
 * @param mean is the mean of ln(x).
 * @param standardDev is the standard deviation of ln(x), a positive number.
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability density function, use FALSE.
 */
export function LOGNORM_DIST(
  x: number,
  mean: number,
  standardDev: number,
  cumulative: boolean
): number {
  if (x <= 0 || standardDev <= 0) return Number.NaN; // #NUM!

  return cumulative ? lognormalCdf(x, mean, standardDev) : lognormalPdf(x, mean, standardDev);
}

/**
 * Returns the cumulative lognormal distribution of x, where ln(x) is normally distributed with parameters Mean and Standard_dev.
 * @param x is the value at which to evaluate the function, a positive number.
 * @param mean is the mean of ln(x).
 * @param standardDev is the standard deviation of ln(x), a positive number.
 * @category Compatibility
 */
export function LOGNORMDIST(
  x: number,
  mean: number,
  standardDev: number
): number {
  return LOGNORM_DIST(x, mean, standardDev, true);
}

/**
 * Returns the inverse of the lognormal cumulative distribution function of x, where ln(x) is normally distributed with parameters Mean and Standard_dev.
 * @name LOGNORM.INV
 * @param probability is a probability associated with the lognormal distribution, a number between 0 and 1, inclusive.
 * @param mean is the mean of ln(x).
 * @param standardDev is the standard deviation of ln(x), a positive number.
 */
export function LOGNORM_INV(
  probability: number,
  mean: number,
  standardDev: number
): number {
  if (probability <= 0 || probability >= 1) return Number.NaN; // #NUM!
  if (standardDev <= 0) return Number.NaN; // #NUM!

  return lognormalInv(probability, mean, standardDev);
}

/**
 * Returns the inverse of the lognormal normal distribution function of x, where ln(x) is normally distributed with parameters Mean and Standard_dev.
 * @param probability is a probability associated with the lognormal distribution, a number between 0 and 1, inclusive.
 * @param mean is the mean of ln(x).
 * @param standardDev is the standard deviation of ln(x), a positive number.
 * @category Compatibility
 */
export function LOGINV(
  probability: number,
  mean: number,
  standardDev: number
): number {
  return LOGNORM_INV(probability, mean, standardDev);
}

/**
 * `#VALUE!` when any ONE argument of a repeating slot is a reference union.
 *
 * @remarks
 * `MODE((DA1:DA5,DK1:DK2))` is `#VALUE!` while `MODE(DA1:DA5,DK1:DK2)` is the
 * mode of both — and a repeating slot takes the areas apart, so the body receives the identical
 * `IRange[]` either way. Only the ARGUMENT view separates them: one argument carrying two areas
 * versus two arguments carrying one each.
 */
const _refuseUnionArgument = (): FormulaError.Known | null => {
  const args = FormulaContext.getArgs().getRepeatingArgsAt(0);
  for (let i=0; i<args.getLength(); i++) {
    // A 3-D span (`Alpha:Gamma!A1`) is one argument over several sheets, and is `#REF!`.
    // Its members are areas too, so it is told from a union first.
    if (args.getKindAt(i) === ValueKind.Reference) {
      const raw = args.getRawAt(i);
      if (Array.isArray(raw) && (raw as { isSheetSpan?: true }).isSheetSpan) return FormulaError.BuiltIn.Ref!;
    }
    if (args.getAreaCountAt(i) > 1) return FormulaError.BuiltIn.Value!;
  }
  return null;
};

/**
 * Returns the most frequently occurring, or repetitive, value in an array or range of data.
 * @name MODE
 * @param number numbers or names, arrays, or references that contain numbers for which you want to find the mode.
 * @category Compatibility
 */
export function MODE(number: IRange[]): Scalar {
  return MODE_SNGL(number);
}

/**
 * MODE, MODE.SNGL and MODE.MULT refuse a BLANK CELL where the rest of the family tolerates one.
 *
 * `MODE(A1)` over an empty A1 is #VALUE! while `MODE(A1:A5)` over five empty cells is #N/A, and a
 * blank cell beside a good range is #VALUE! as well. The rule is a single-cell REFERENCE holding
 * nothing — not an empty range, and not a direct `""`, which is #N/A like any other value it
 * cannot count.
 */
const _refuseBlankCell = (ranges: readonly IRange[]): void => {
  for (const range of ranges) {
    if (range.size !== 1 || !isReferenceRange(range)) continue;
    if (range.entries({ includeEmpty: false }).next().done) throw FormulaError.BuiltIn.Value!;
  }
};

/**
 * Returns a vertical array of the most frequently occurring, or repetitive, values in an array or range of data.  For a horizontal array, use =TRANSPOSE(MODE.MULT(number1,number2,...)).
 * @name MODE.MULT
 * @param number numbers or names, arrays, or references that contain numbers for which you want to find the mode..
 */
export function MODE_MULT(number: Repeating<IRange, 254>): number[][] {
  const union = _refuseUnionArgument();
  if (union) throw union;
  for (const range of number) {
    if (range.hasError()) throw range.firstError()!; // argument order
  }
  _refuseBlankCell(number);

  const freq = new Map<number, { count: number; firstSeen: number }>();
  let order = 0;

  for (const range of number) {
    const iter = range.entries({ includeEmpty: false });
    let next = iter.next();
    while (!next.done) {
      const v = next.value.value;
      if (typeof v === 'number' && !Number.isNaN(v)) {
        const existing = freq.get(v);
        if (existing) {
          existing.count++;
        } else {
          freq.set(v, { count: 1, firstSeen: order++ });
        }
      }
      next = iter.next();
    }
  }

  // Find max frequency
  let maxCount = 2; // must appear more than once
  for (const { count } of freq.values()) {
    if (count > maxCount) maxCount = count;
  }

  // Collect all values at max frequency, sorted by first appearance
  const modes = [...freq.entries()]
    .filter(([, { count }]) => count === maxCount)
    .sort((a, b) => a[1].firstSeen - b[1].firstSeen)
    .map(([v]) => [v]);

  if (modes.length === 0) return FormulaError.BuiltIn.NA as any; // spills a single #N/A
  return modes;
}

/**
 * Returns the most frequently occurring, or repetitive, value in an array or range of data.
 * @name MODE.SNGL
 * @param number numbers or names, arrays, or references that contain numbers for which you want to find the mode.
 */
export function MODE_SNGL(number: Repeating<IRange, 254>): Scalar {
  const union = _refuseUnionArgument();
  if (union) return union;
  _refuseBlankCell(number);

  const freq = new Map<number, { count: number; firstSeen: number }>();
  let order = 0;

  for (const range of number) {
    if (range.hasError()) return range.firstError()!; // argument order
    const iter = range.entries({ includeEmpty: false });
    let next = iter.next();
    while (!next.done) {
      const v = next.value.value;
      if (typeof v === 'number' && !Number.isNaN(v)) {
        const existing = freq.get(v);
        if (existing) {
          existing.count++;
        } else {
          freq.set(v, { count: 1, firstSeen: order++ });
        }
      }
      next = iter.next();
    }
  }

  let bestValue: number | null = null;
  let bestCount = 1;
  let bestOrder = Infinity;

  for (const [v, { count, firstSeen }] of freq) {
    if (count < 2) continue; // must appear more than once
    if (count > bestCount || (count === bestCount && firstSeen < bestOrder)) {
      bestValue = v;
      bestCount = count;
      bestOrder = firstSeen;
    }
  }

  if (bestValue === null) return FormulaError.BuiltIn.NA; // #N/A — no repeats
  return bestValue;
}

/**
 * Returns the negative binomial distribution, the probability that there will be Number_f failures before the Number_s-th success, with Probability_s probability of a success.
 * @name NEGBINOM.DIST
 * @param numberF is the number of failures.
 * @param numberS is the threshold number of successes.
 * @param probabilityS is the probability of a success; a number between 0 and 1.
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability mass function, use FALSE.
 */
export function NEGBINOM_DIST(
  numberF: number,
  numberS: number,
  probabilityS: number,
  cumulative: boolean
): number {
  // The sign is tested BEFORE truncation: -0.5 failures is #NUM!, not 0.
  if (numberF < 0) return Number.NaN;
  // Number_f and numberS are truncated to integers.
  numberF = Math.trunc(numberF);
  numberS = Math.trunc(numberS);

  // If probabilityS <= 0 or if probability >= 1, NEGBINOM.DIST returns the #NUM! error value.
  if (probabilityS <= 0 || probabilityS >= 1) return Number.NaN;
  // If numberS < 1, NEGBINOM.DIST returns the #NUM! error value.
  if (numberS < 1) return Number.NaN;

  return cumulative
    ? negbinCdf(numberF, numberS, probabilityS)
    : negbinPdf(numberF, numberS, probabilityS);
}

/**
 * Returns the negative binomial distribution, the probability that there will be Number_f failures before the Number_s-th success, with Probability_s probability of a success.
 * @param numberF is the number of failures.
 * @param numberS is the threshold number of successes.
 * @param probabilityS is the probability of a success; a number between 0 and 1.
 * @category Compatibility
 */
export function NEGBINOMDIST(
  numberF: number,
  numberS: number,
  probabilityS: number
): number {
  return NEGBINOM_DIST(numberF, numberS, probabilityS, false);
}

/**
 * Returns the normal distribution for the specified mean and standard deviation.
 * @name NORM.DIST
 * @param x is the value for which you want the distribution.
 * @param mean is the arithmetic mean of the distribution.
 * @param standardDev is the standard deviation of the distribution, a positive number.
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability density function, use FALSE.
 */
export function NORM_DIST(
  x: number,
  mean: number,
  standardDev: number,
  cumulative: boolean
): number {
  if (standardDev <= 0) return Number.NaN; // #NUM!

  // If mean = 0, standardDev = 1, and cumulative = TRUE, NORM.DIST returns the standard normal distribution, NORM.S.DIST.
  if (cumulative) return normalCdf(x, mean, standardDev);
  // The density squares the STANDARDIZED value first, and past a double that is a refusal rather
  // than 0 — the same x answers 0 with a larger standard deviation.
  const z = (x - mean) / standardDev;
  if (!Number.isFinite(z * z)) return Number.NaN; // #NUM!
  return normalPdf(x, mean, standardDev);
}

/**
 * Returns the normal distribution for the specified mean and standard deviation.
 * @param x is the value for which you want the distribution.
 * @param mean is the arithmetic mean of the distribution.
 * @param standardDev is the standard deviation of the distribution, a positive number.
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability density function, use FALSE.
 * @category Compatibility
 */
export function NORMDIST(
  x: number,
  mean: number,
  standardDev: number,
  cumulative: boolean
): number {
  return NORM_DIST(x, mean, standardDev, cumulative);
}

/**
 * Returns the inverse of the normal cumulative distribution for the specified mean and standard deviation.
 * @name NORM.INV
 * @param probability is a probability corresponding to the normal distribution, a number between 0 and 1 inclusive.
 * @param mean is the arithmetic mean of the distribution.
 * @param standardDev is the standard deviation of the distribution, a positive number.
 */
export function NORM_INV(
  probability: number,
  mean: number,
  standardDev: number
): number {
  if (probability <= 0 || probability >= 1) return Number.NaN; // #NUM!
  if (standardDev <= 0) return Number.NaN; // #NUM!

  return normalInv(probability, mean, standardDev);
}

/**
 * Returns the inverse of the normal distribution function for the specified mean and standard deviation.
 * @param probability is a probability associated with the normal distribution, a number between 0 and 1, inclusive.
 * @param mean is the mean of the distribution.
 * @param standardDev is the standard deviation of the distribution, a positive number.
 * @category Compatibility
 */
export function NORMINV(
  probability: number,
  mean: number,
  standardDev: number
): number {
  return NORM_INV(probability, mean, standardDev);
}

/**
 * Returns the standard normal distribution (has a mean of zero and a standard deviation of one).
 * @name NORM.S.DIST
 * @param z is the value for which you want the distribution.
 * @param cumulative is a logical value for the function to return: the cumulative distribution function = TRUE; the probability density function = FALSE.
 */
export function NORM_S_DIST(z: number, cumulative: boolean): number {
  if (cumulative) return normalCdf(z, 0, 1);
  // The density squares z first, and past a double that is a refusal rather than 0.
  if (!Number.isFinite(z * z)) return Number.NaN; // #NUM!
  return normalPdf(z, 0, 1);
}

/**
 * Returns the standard normal cumulative distribution (has a mean of zero and a standard deviation of one).
 * @param z is the value for which you want the distribution.
 * @category Compatibility
 */
export function NORMSDIST(z: number): number {
  return NORM_S_DIST(z, true);
}

/**
 * Returns the inverse of the standard normal cumulative distribution (has a mean of zero and a standard deviation of one).
 * @name NORM.S.INV
 * @param probability is a probability corresponding to the normal distribution, a number between 0 and 1 inclusive.
 */
export function NORM_S_INV(probability: number): number {
  if (probability <= 0 || probability >= 1) return Number.NaN; // #NUM!

  return normalInv(probability, 0, 1);
}

/**
 * Returns the inverse of the standard normal cumulative distribution (has a mean of zero and a standard deviation of one).
 * @param probability is a probability corresponding to the normal distribution, a number between 0 and 1 inclusive.
 * @category Compatibility
 */
export function NORMSINV(probability: number): number {
  return NORM_S_INV(probability);
}

/**
 * Returns the Pearson product moment correlation coefficient, r.
 * @param array1 is a set of independent values.
 * @param array2 is a set of dependent values.
 */
export function PEARSON(
  array1: IRange,
  array2: IRange
): Scalar {
  return CORREL(array1, array2);
}

/**
 * Returns the k-th percentile of values in a range, where k is in the range 0..1, inclusive.
 * @param array is the array or range of data that defines relative standing.
 * @param k is the percentile value that is between 0 through 1, inclusive.
 * @category Compatibility
 */
export function PERCENTILE(
  array: ReportType<IRange<number>>,
  k: number
): number {
  array = FormulaContext.flattenAreas(array); // a union answers over every area
  return PERCENTILE_INC(array, k);
}

/**
 * Returns the k-th percentile of values in a range, where k is in the range 0..1, exclusive.
 * @name PERCENTILE.EXC
 * @param array is the array or range of data that defines relative standing.
 * @param k is the percentile value that is between 0 through 1, exclusive (must satisfy 1/(n+1) <= k <= n/(n+1)).
 */
export function PERCENTILE_EXC(
  array: ReportType<IRange<number>>,
  k: number
): number {
  array = FormulaContext.flattenAreas(array); // a union answers over every area
  if (array.hasError()) throw array.firstError()!; // outranks the k check
  if (k <= 0 || k >= 1) return Number.NaN; // #NUM!

  const result = array.getStats().getSortedNumbers().getPercentile(k, true);
  if (result === null) return Number.NaN; // #NUM! (empty range)

  return result;
}

/**
 * Returns the k-th percentile of values in a range, where k is in the range 0..1, inclusive.
 * @name PERCENTILE.INC
 * @param array is the array or range of data that defines relative standing.
 * @param k is the percentile value that is between 0 through 1, inclusive.
 */
export function PERCENTILE_INC(
  array: ReportType<IRange<number>>,
  k: number
): number {
  array = FormulaContext.flattenAreas(array); // a union answers over every area
  if (array.hasError()) throw array.firstError()!; // outranks the k check
  if (k < 0 || k > 1) return Number.NaN; // #NUM!

  const result = array.getStats().getSortedNumbers().getPercentile(k, false/*exclusive*/);
  if (result === null) return Number.NaN; // #NUM!

  return result;
}

/**
 * Returns the rank of a value in a data set as a percentage (0..1, inclusive) of the data set.
 * @name PERCENTRANK
 * @param array is the array or range of data with numeric values that defines relative standing.
 * @param x is the value for which you want to know the rank.
 * @param significance is the number of decimal places to truncate the percentage to, at least 1. Defaults to 3.
 * @category Compatibility
 */
export function PERCENTRANK(
  array: ReportType<IRange<number>>,
  x: number,
  significance: Omittable<number> = 3
): Scalar {
  array = FormulaContext.flattenAreas(array); // a union answers over every area
  return PERCENTRANK_INC(array, x, significance);
}

/**
 * Returns the rank of a value in a data set as a percentage (0..1, exclusive) of the data set.
 * @name PERCENTRANK.EXC
 * @param array is the array or range of data with numeric values that defines relative standing.
 * @param x is the value for which you want to know the rank.
 * @param significance is the number of decimal places to truncate the percentage to, at least 1. Defaults to 3.
 */
export function PERCENTRANK_EXC(
  array: ReportType<IRange<number>>,
  x: number,
  significance: Omittable<number>=3
): Scalar {
  array = FormulaContext.flattenAreas(array); // a union answers over every area
  if (array.hasError()) return array.firstError()!;
  return array.getStats()
    .getSortedNumbers()
    .getPercentRankOf(x, true/*exclusive*/, significance) ?? FormulaError.BuiltIn.NA;
}

/**
 * Returns the rank of a value in a data set as a percentage (0..1, inclusive) of the data set.
 * @name PERCENTRANK.INC
 * @param array is the array or range of data with numeric values that defines relative standing.
 * @param x is the value for which you want to know the rank.
 * @param significance is the number of decimal places to truncate the percentage to, at least 1. Defaults to 3.
 */
export function PERCENTRANK_INC(
  array: ReportType<IRange<number>>,
  x: number,
  significance: Omittable<number>=3
): Scalar {
  array = FormulaContext.flattenAreas(array); // a union answers over every area
  if (array.hasError()) return array.firstError()!;
  return array.getStats()
    .getSortedNumbers()
    .getPercentRankOf(x, false/*exclusive*/, significance) ?? FormulaError.BuiltIn.NA;
}

/**
 * Returns the value of the density function for a standard normal distribution.
 * @param x is the number for which you want the density of the standard normal distribution.
 */
export function PHI(x: number): number {
  // The square is formed first, and past a double it is a refusal rather than a density of 0.
  if (!Number.isFinite(x * x)) return Number.NaN; // #NUM!
  return Math.exp(-0.5 * x * x) / SQRT2PI;
}

/**
 * Returns the Poisson distribution.
 * @name POISSON.DIST
 * @param x is the number of events.
 * @param mean is the expected numeric value, a positive number.
 * @param cumulative is a logical value: for the cumulative Poisson probability, use TRUE; for the Poisson probability mass function, use FALSE.
 */
export function POISSON_DIST(
  x: number,
  mean: number,
  cumulative: boolean
): number {
  // A mean of ZERO is legal: the whole mass sits at zero occurrences, so the density is 1 there
  // and 0 above it, and the distribution is 1 everywhere.
  // A NEGATIVE mean is refused only above zero occurrences: at zero both forms answer
  // `EXP(-mean)` as it stands — `POISSON.DIST(0,-1,FALSE)` is e.
  if (x < 0) return Number.NaN; // #NUM!
  x = Math.trunc(x);
  if (mean < 0) {
    const atZero = x === 0 ? Math.exp(-mean) : Number.NaN;
    return Number.isFinite(atZero) ? atZero : Number.NaN; // #NUM!
  }

  // The count's log-factorial has to fit a double; where it cannot, the answer is a refusal
  // rather than the limit the walk would settle on.
  if (!Number.isFinite(gammaln(x + 1))) return Number.NaN; // #NUM!

  return cumulative
    ? poissonCdf(x, mean)
    : poissonPdf(x, mean);
}

/**
 * Returns the Poisson distribution.
 * @param x is the number of events.
 * @param mean is the expected numeric value, a positive number.
 * @param cumulative is a logical value: for the cumulative Poisson probability, use TRUE; for the Poisson probability mass function, use FALSE.
 * @category Compatibility
 */
export function POISSON(
  x: number,
  mean: number,
  cumulative: boolean
): number {
  // The legacy body skips the mean check when x truncates to zero, answering the density
  // formula `e^-mean` as is — `POISSON(0.5,-1,FALSE)` is e.
  if (!cumulative && x >= 0 && x < 1 && mean < 0) return Math.exp(-mean);
  return POISSON_DIST(x, mean, cumulative);
}

/**
 * Returns the probability that values in a range are between two limits or equal to a lower limit.
 * @param xRange is the range of numeric values of x with which there are associated probabilities.
 * @param probRange is the set of probabilities associated with values in X_range, values between 0 and 1 and excluding 0.
 * @param lowerLimit is the lower bound on the value for which you want a probability.
 * @param upperLimit is the optional upper bound on the value. If omitted, PROB returns the probability that X_range values are equal to Lower_limit.
 */
export function PROB(
  xRange: IRange,
  probRange: IRange,
  lowerLimit: number,
  upperLimit?: Omittable<number>
): Scalar {
  // A 1x1 BLANK reference is #VALUE! here, exactly as it is at MODE's slot — a five-cell
  // all-blank range is an ordinary count mismatch (#N/A) and a 1x1 range holding a NUMBER is too.
  _refuseBlankCell([xRange, probRange]);

  // Members pair by flattened row-major ordinal, shape-blind -- a 2x1 against a 1x2 pairs
  // fully. Flattening both to a column first is what makes that the OFFSET alignment below.
  const xs = xRange.flatten();
  const ps = probRange.flatten();

  // PROB has TWO failure channels and they are not interchangeable. #N/A is the SHAPE one and
  // this is all of it: the two ranges hold a different number of CELLS, blanks counted.
  if (xs.getRowCount() !== ps.getRowCount()) return FormulaError.BuiltIn.NA;

  // ...and it is the one verdict that outranks a member error, which is why the parameters
  // accept errors and the scan runs here rather than in the engine. Everything below loses to
  // the error.
  if (xRange.hasError()) return pairedRangeError(xRange);
  if (probRange.hasError()) return pairedRangeError(probRange);

  // Everything else is the VALIDITY channel, and there is only ONE thing in it: the
  // probabilities must sum to 1. Values outside 0..1 are not checked at all so long as they do.
  //
  // The sum runs over the positions where BOTH members are numbers. A non-numeric member on
  // EITHER side — blank, text or boolean — simply excludes its position; it is never fatal in
  // itself. Both halves look like a #NUM! rule until the sum is arranged
  // to disagree with the total: `PROB({1,2,"x"},{0.4,0.6,0.5},1,1)` is 0.4 (the 0.5 is excluded,
  // so the sum is 1 while the total is 1.5) and `PROB({1,2,"x"},{0.4,0.1,0.5},1,1)` is #NUM!
  // (the total is 1 but the sum is 0.5). A text PROBABILITY drops out the same way.
  const upper = upperLimit ?? lowerLimit;
  let probSum = 0;
  let result = 0;
  for (const [[x, p]] of xs.alignValues([ps])) {
    if (typeof x !== 'number' || typeof p !== 'number') continue;
    probSum += p;
    if (x >= lowerLimit && x <= upper) result += p;
  }
  if (Math.round(probSum * 1e10) !== 1e10) return FormulaError.BuiltIn.Num!;

  return result;
}

/**
 * Returns the quartile of a data set, based on percentile values from 0..1, inclusive.
 * @param array is the array or cell range of numeric values for which you want the quartile value.
 * @param quart is a number: minimum value = 0; 1st quartile = 1; median value = 2; 3rd quartile = 3; maximum value = 4.
 * @category Compatibility
 */
export function QUARTILE(
  array: ReportType<IRange<number>>,
  quart: number
): number {
  array = FormulaContext.flattenAreas(array); // a union answers over every area
  return QUARTILE_INC(array, quart);
}

/**
 * Returns the quartile of a data set, based on percentile values from 0..1, exclusive.
 * @name QUARTILE.EXC
 * @param array is the array or cell range of numeric values for which you want the quartile value.
 * @param quart is a number: 1st quartile = 1; median value = 2; 3rd quartile = 3 (0 and 4 are invalid for EXC).
 */
export function QUARTILE_EXC(
  array: ReportType<IRange<number>>,
  quart: number
): number {
  array = FormulaContext.flattenAreas(array); // a union answers over every area
  if (array.hasError()) throw array.firstError()!; // outranks the quart check
  quart = Math.trunc(quart);
  if (quart < 1 || quart > 3) return Number.NaN; // #NUM!

  const k = quart / 4;
  const result = array.getStats().getSortedNumbers().getPercentile(k, true);
  if (result === null) return Number.NaN; // #NUM!

  return result;
}

/**
 * Returns the quartile of a data set, based on percentile values from 0..1, inclusive.
 * @name QUARTILE.INC
 * @param array is the array or cell range of numeric values for which you want the quartile value.
 * @param quart is a number: minimum value = 0; 1st quartile = 1; median value = 2; 3rd quartile = 3; maximum value = 4.
 */
export function QUARTILE_INC(
  array: ReportType<IRange<number>>,
  quart: number
): number {
  array = FormulaContext.flattenAreas(array); // a union answers over every area
  if (array.hasError()) throw array.firstError()!; // outranks the quart check
  quart = Math.trunc(quart);
  if (quart < 0 || quart > 4) return Number.NaN; // #NUM!

  const k = quart / 4;
  const result = array.getStats().getSortedNumbers().getPercentile(k, false);
  if (result === null) return Number.NaN; // #NUM!

  return result;
}

/**
 * Returns the rank of a number in a list of numbers. Legacy alias for RANK.EQ.
 * @name RANK
 * @param number is the number for which you want to find the rank.
 * @param ref is an array of, or a reference to, a list of numbers. Nonnumeric values are ignored.
 * @param order is a number: 0 or omitted ranks largest value as 1 (descending); any other value ranks smallest as 1 (ascending).
 * @category Compatibility
 */
export function RANK(
  number: number,
  ref: ReportType<IReferenceRange>,
  order: boolean = false
): Scalar {
  return RANK_EQ(number, ref, order);
}

/**
 * Returns the rank of a number in a list of numbers. Tied values receive the average of the rank positions they span.
 * @name RANK.AVG
 * @param number is the number for which you want to find the rank.
 * @param ref is an array of, or a reference to, a list of numbers. Nonnumeric values are ignored.
 * @param order is a number: 0 or omitted ranks largest value as 1 (descending); any other value ranks smallest as 1 (ascending).
 */
export function RANK_AVG(
  number: number,
  ref: ReportType<IReferenceRange>,
  order: boolean = false
): Scalar {
  const values = FormulaContext.flattenAreas(ref); // a union ranks over every area
  if (values.hasError()) return values.firstError()!;
  const result = values.getStats().getSortedNumbers().getRankOf(number, !order, true);
  if (result === null) return FormulaError.BuiltIn.NA ; // #N/A!
  return result;
}

/**
 * Returns the rank of a number in a list of numbers. Tied values all receive the top rank of that set.
 * @name RANK.EQ
 * @param number is the number for which you want to find the rank.
 * @param ref is an array of, or a reference to, a list of numbers. Nonnumeric values are ignored.
 * @param order is a number: 0 or omitted ranks largest value as 1 (descending); any other value ranks smallest as 1 (ascending).
 */
export function RANK_EQ(
  number: number,
  ref: ReportType<IReferenceRange>,
  order: boolean = false
): Scalar {
  const values = FormulaContext.flattenAreas(ref); // a union ranks over every area
  if (values.hasError()) return values.firstError()!;
  const result = values.getStats().getSortedNumbers().getRankOf(number, !order, false);
  if (result === null) return FormulaError.BuiltIn.NA; // #N/A!
  return result;
}

/**
 * Returns the square of the Pearson product moment correlation coefficient through the given data points.
 * @param knownYs is an array or range of data points and can be numbers or names, arrays, or references that contain numbers.
 * @param knownXs is an array or range of data points and can be numbers or names, arrays, or references that contain numbers.
 */
export function RSQ(
  knownYs: IRange,
  knownXs: IRange
): Scalar {
  const s = _twoRangeStats(knownYs, knownXs);
  if (FormulaError.isError(s)) return s;
  if (s === null) return FormulaError.BuiltIn.NA; // #N/A — counts differ
  if (!Number.isFinite(s.ssX) || !Number.isFinite(s.ssY)) return FormulaError.BuiltIn.Num!;
  if (s.ssX === 0 || s.ssY === 0) return FormulaError.BuiltIn.Div0!;
  const r = s.ssXY / Math.sqrt(s.ssX * s.ssY);
  return r * r;
}

/**
 * Returns the skewness of a distribution: a characterization of the degree of asymmetry of a distribution around its mean.
 * @param number are 1 to 255 numbers or names, arrays, or references that contain numbers for which you want the skewness.
 */
export function SKEW(
  number: IRange<number>[]
): Scalar {
  let n = 0;
  let sum = 0;
  for (const range of number) {
    if (range.hasError()) return range.firstError()!; // argument order; outranks the count check
    range.forEach((v: Scalar) => {
      if (typeof v !== 'number') return;
      sum += v;
      n++;
    });
  }
  if (n < 3) return FormulaError.BuiltIn.Div0!;

  const mean = sum / n;

  let ss = 0;
  for (const range of number) {
    range.forEach((v: Scalar) => {
      if (typeof v !== 'number') return;
      ss += flushSubnormal((v - mean) ** 2);
    });
  }
  const s = Math.sqrt(ss / (n - 1));
  if (s === 0 || !Number.isFinite(s)) return FormulaError.BuiltIn.Div0!;

  let skew = 0;
  for (const range of number) {
    range.forEach((v: Scalar) => {
      if (typeof v !== 'number') return;
      skew += ((v - mean) / s) ** 3;
    });
  }
  return (n / ((n - 1) * (n - 2))) * skew;
}

/**
 * Returns the skewness of a distribution based on a population: a characterization of the degree of asymmetry of a distribution around its mean.
 * @name SKEW.P
 * @param number are 1 to 254 numbers or names, arrays, or references that contain numbers for which you want the population skewness.
 */
export function SKEW_P(
  number: Repeating<IRange<number>, 254>
): Scalar {
  let n = 0;
  let sum = 0;
  for (const range of number) {
    if (range.hasError()) return range.firstError()!; // argument order; outranks the count check
    range.forEach((v: Scalar) => {
      if (typeof v !== 'number') return;
      sum += v;
      n++;
    });
  }
  if (n < 3) return FormulaError.BuiltIn.Div0!;

  const mean = sum / n;

  let ss = 0;
  for (const range of number) {
    range.forEach((v: Scalar) => {
      if (typeof v !== 'number') return;
      ss += flushSubnormal((v - mean) ** 2);
    });
  }
  const s = Math.sqrt(ss / n); // population std dev
  if (s === 0 || !Number.isFinite(s)) return FormulaError.BuiltIn.Div0!;

  let skew = 0;
  for (const range of number) {
    range.forEach((v: Scalar) => {
      if (typeof v !== 'number') return;
      skew += ((v - mean) / s) ** 3;
    });
  }
  return skew / n;
}

/**
 * Returns the slope of the linear regression line through the given data points.
 * @param knownYs is an array or cell range of numeric dependent data points and can be numbers or names, arrays, or references that contain numbers.
 * @param knownXs iis the set of independent data points and can be numbers or names, arrays, or references that contain numbers.
 */
export function SLOPE(
  knownYs: IRange,
  knownXs: IRange
): Scalar {
  const s = _twoRangeStats(knownYs, knownXs);
  if (FormulaError.isError(s)) return s;
  if (s === null) return FormulaError.BuiltIn.NA; // #N/A — counts differ
  if (s.ssX === 0) return FormulaError.BuiltIn.Div0!;
  if (!Number.isFinite(s.ssX)) return FormulaError.BuiltIn.Num!;
  const result = s.ssXY / s.ssX;
  return Number.isFinite(result) ? result : FormulaError.BuiltIn.Num!;
}

/**
 * Returns a normalized value from a distribution characterized by a mean and standard deviation.
 * @param x is the value you want to normalize.
 * @param mean is the arithmetic mean of the distribution.
 * @param standardDev is the standard deviation of the distribution, a positive number.
 */
export function STANDARDIZE(
  x: number,
  mean: number,
  standardDev: number
): number {
  if (standardDev <= 0) return Number.NaN; // #NUM!
  return (x - mean) / standardDev;
}

/**
 * Estimates standard deviation based on a sample (ignores logical values and text in the sample).
 * @name STDEV.S
 * @param number are 1 to 255 numbers corresponding to a sample of a population and can be numbers or references that contain numbers.
 */
export function STDEV_S(number: Repeating<IRange<number>, 254>): number {
  const v = VAR_S(number);
  const result = Math.sqrt(v);
  return result;
}

/**
 * Estimates standard deviation based on a sample, ignoring logical values and text in the sample.
 * @param number are 1 to 255 numbers corresponding to a sample of a population and can be numbers or references that contain numbers.
 * @category Compatibility
 */
export function STDEV(number: IRange<number>[]): number {
  return STDEV_S(number);
}

/**
 * Calculates standard deviation based on the entire population given as arguments (ignores logical values and text).
 * @name STDEV.P
 * @param number are 1 to 255 numbers corresponding to a population and can be numbers or references that contain numbers.
 */
export function STDEV_P(number: Repeating<IRange<number>, 254>): number {
  const v = VAR_P(number);
  const result = Math.sqrt(v);
  return result;
}

/**
 * Calculates standard deviation based on the entire population given as arguments (ignores logical values and text).
 * @param number are 1 to 255 numbers corresponding to a population and can be numbers or references that contain numbers.
 * @category Compatibility
 */
export function STDEVP(number: IRange<number>[]): number {
  return STDEV_P(number);
}

/**
 * Estimates standard deviation based on a sample, including logical values and text. Text and the logical value FALSE have the value 0; the logical value TRUE have the value 1.
 * @param value are 1 to 255 values corresponding to a sample of a population and can be values or names or references to values.
 */
export function STDEVA(value: IRange<number>[]): number {
  const v = VARA(value);
  const result = Math.sqrt(v);
  return result;
}

/**
 * Calculates standard deviation based on an entire population, including logical values and text. Text and the logical value FALSE have the value 0; the logical value TRUE have the value 1.
 * @param value are 1 to 255 values corresponding to a population and can be values, names, arrays, or references that contain values.
 */
export function STDEVPA(value: IRange<number>[]): number {
  const v = VARPA(value);
  const result = Math.sqrt(v);
  return result;
}

/**
 * Returns the standard error of the predicted y-value for each x in a regression.
 * @param knownYs is an array or range of dependent data points and can be numbers or names, arrays, or references that contain numbers.
 * @param knownXs is an array or range of independent data points and can be numbers or names, arrays, or references that contain numbers.
 */
export function STEYX(
  knownYs: IRange,
  knownXs: IRange
): Scalar {
  const s = _twoRangeStats(knownYs, knownXs);
  if (FormulaError.isError(s)) return s;
  if (s === null) return FormulaError.BuiltIn.NA; // counts differ
  if (s.n < 3) return FormulaError.BuiltIn.Div0!; // fewer than three pairs, none included
  if (s.ssX === 0) return FormulaError.BuiltIn.Div0!;
  if (!Number.isFinite(s.ssX) || !Number.isFinite(s.ssY)) return FormulaError.BuiltIn.Num!;
  return Math.sqrt((s.ssY - s.ssXY * s.ssXY / s.ssX) / (s.n - 2));
}

/**
 * Returns the left-tailed Student's t-distribution.
 * @name T.DIST
 * @param x is the numeric value at which to evaluate the distribution.
 * @param degFreedom is an integer indicating the number of degrees of freedom that characterize the distribution.
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability density function, use FALSE.
 */
export function T_DIST(
  x: number,
  degFreedom: number,
  cumulative: boolean
): number {
  // The degrees of freedom are read raw and truncated — 2.5 is two. Under one the cumulative is
  // #NUM!; over the ceiling, only the cumulative is refused.
  degFreedom = Math.trunc(degFreedom);
  if (degFreedom < 1) {
    // The density is taken as written: `1 + x^2/df` divides by a zero df, and is then raised
    // to a power — zero is #DIV/0! again (`T.DIST(1,-1,FALSE)`) and a negative is #NUM!.
    if (!cumulative && (degFreedom === 0 || 1 + (x * x) / degFreedom === 0)) throw FormulaError.BuiltIn.Div0;
    return Number.NaN; // #NUM!
  }
  if (cumulative && degFreedom > DegFreedomMax) return Number.NaN; // #NUM!

  if (cumulative) {
    if (x === 0) return 0.5; // exact by symmetry
    return studenttCdf(x, degFreedom);
  }
  // The density refuses the same `x` the cumulative does: one whose square overflows.
  if (!Number.isFinite(x * x)) return Number.NaN; // #NUM!
  return studenttPdf(x, degFreedom);
}

/**
 * Returns the Student's t-distribution: the right-tailed probability for tails = 1, twice that for tails = 2.
 * @param x is the numeric value at which to evaluate the distribution, a nonnegative number.
 * @param degFreedom is an integer indicating the number of degrees of freedom that characterize the distribution.
 * @param tails is the number of distribution tails to return. If tails = 1, TDIST returns the one-tailed distribution; if tails = 2, TDIST returns the two-tailed distribution.
 * @category Compatibility
 */
export function TDIST(
  x: number,
  degFreedom: number,
  tails: number
): number {
  if (x < 0) return Number.NaN; // #NUM!
  // `tails` is made whole with the count slot's tolerance — it FLOORS after 2^-22, so `2-2^-22`
  // selects two tails and `2-2^-21` selects one. The degrees of freedom beside it are read RAW,
  // with no tolerance at all: at CHISQ.DIST `2.9999999999999996` still means two.
  tails = Math.floor(tails + TailsTolerance);
  if (tails !== 1 && tails !== 2) return Number.NaN; // #NUM!
  return tails === 1 ? T_DIST_RT(x, degFreedom) : T_DIST_2T(x, degFreedom);
}

/**
 * Returns the two-tailed Student's t-distribution.
 * @name T.DIST.2T
 * @param x is the numeric value at which to evaluate the distribution.
 * @param degFreedom is an integer indicating the number of degrees of freedom that characterize the distribution.
 */
export function T_DIST_2T(
  x: number,
  degFreedom: number
): number {
  // The degrees of freedom are read raw and truncated — 2.5 is two.
  degFreedom = Math.trunc(degFreedom);
  if (degFreedom < 1 || x < 0 || degFreedom > DegFreedomMax) return Number.NaN; // #NUM!

  return studenttCdfUpper(x, degFreedom) * 2;
}

/**
 * Returns the right-tailed Student's t-distribution.
 * @name T.DIST.RT
 * @param x is the numeric value at which to evaluate the distribution.
 * @param degFreedom is an integer indicating the number of degrees of freedom that characterize the distribution.
 */
export function T_DIST_RT(
  x: number,
  degFreedom: number
): number {
  // The degrees of freedom are read raw and truncated — 2.5 is two.
  degFreedom = Math.trunc(degFreedom);
  if (degFreedom < 1 || degFreedom > DegFreedomMax) return Number.NaN; // #NUM!

  if (x === 0) return 0.5; // exact by symmetry
  return studenttCdfUpper(x, degFreedom);
}

/**
 * Returns the left-tailed inverse of the Student's t-distribution.
 * @name T.INV
 * @param probability is the probability associated with the two-tailed Student's t-distribution, a number between 0 and 1 inclusive.
 * @param degFreedom is a positive integer indicating the number of degrees of freedom to characterize the distribution.
 */
export function T_INV(
  probability: number,
  degFreedom: number
): number {
  // The Cauchy tail at 0 is a pole: `T.INV(0,1)` is #DIV/0! rather than #NUM!.
  if (probability === 0 && Math.trunc(degFreedom) === 1) throw FormulaError.BuiltIn.Div0;
  if (probability <= 0 || probability >= 1 || degFreedom < 1) return Number.NaN; // #NUM!
  degFreedom = Math.trunc(degFreedom);
  if (degFreedom > DegFreedomMax) return Number.NaN; // #NUM!

  if (degFreedom === 1) return Math.tan(Math.PI * (probability - 0.5)); // exact Cauchy
  return studenttInv(probability, degFreedom);
}

/**
 * Returns the two-tailed inverse of the Student's t-distribution.
 * @param probability is the probability associated with the two-tailed Student's t-distribution, a number between 0 and 1 inclusive.
 * @param degFreedom is a positive integer indicating the number of degrees of freedom to characterize the distribution.
 * @category Compatibility
 */
export function TINV(
  probability: number,
  degFreedom: number
): number {
  return T_INV_2T(probability, degFreedom);
}

/**
 * Returns the two-tailed inverse of the Student's t-distribution.
 * @name T.INV.2T
 * @param probability is the probability associated with the two-tailed Student's t-distribution, a number between 0 and 1 inclusive.
 * @param degFreedom is a positive integer indicating the number of degrees of freedom to characterize the distribution.
 */
export function T_INV_2T(
  probability: number,
  degFreedom: number
): number {
  if (probability === 0 && Math.trunc(degFreedom) === 1) throw FormulaError.BuiltIn.Div0; // see T.INV
  if (probability <= 0 || degFreedom < 1) return Number.NaN; // #NUM!
  degFreedom = Math.trunc(degFreedom);
  if (degFreedom > DegFreedomMax) return Number.NaN; // #NUM!

  // Exact Cauchy. A small probability is taken as a cotangent: `0.5 - 1E-12` keeps four digits
  // of the angle and `T.INV.2T(2E-12,1)` is 318309886183.79.
  if (degFreedom === 1) {
    return probability < 0.5 ? 1 / Math.tan(Math.PI * probability / 2) : Math.tan(Math.PI * (0.5 - probability / 2));
  }
  // T.INV.2T(p,df) = T.INV(1-p/2, df), taken on the LOWER side and reflected: `1 - p/2` is 1 for
  // any probability under 1E-16, and the whole answer is in the part that rounds away.
  return -studenttInv(probability / 2, degFreedom);
}

/**
 * Returns the mean of the interior portion of a set of data values.
 * @param array is the range or array of values to trim and average.
 * @param percent is the fractional number of data points to exclude from the top and bottom of the data set.
 */
export function TRIMMEAN(
  array: ReportType<IRange<number>>,
  percent: number,
): Scalar {
  array = FormulaContext.flattenAreas(array); // a union answers over every area
  if (array.hasError()) return array.firstError()!; // outranks the percent check
  if (percent < 0 || percent >= 1) return Number.NaN; // #NUM!

  // Row-major traversal.
  const values: number[] = [];
  for (const { value } of array.entries(_optionsRowAxis)) {
    if (typeof value === 'number') values.push(value);
  }

  // Rounds the number of EXCLUDED points down to the nearest multiple of 2, splitting them
  // evenly between the ends — over ten values, percent 0.2 through 0.39 all exclude 2 and 0.4
  // through 0.59 all exclude 4.
  const valuesLength = values.length;
  const trimCount = Math.floor(valuesLength * percent / 2);

  // The retained values are chosen by RANK but summed in their ORIGINAL order:
  // TRIMMEAN(A1:A3,0) over 0.1/0.2/-0.3 is 1.85037170770859E-17, which is the original-order sum
  // divided by 3, while summing the sorted values gives half that. Sorting and then folding the
  // sorted array selects the same population but a different float result, so the ordering is
  // part of the contract, not an implementation detail.
  let sum = 0;
  let count = 0;
  if (trimCount === 0) {
    for (let i=0; i<valuesLength; i++) sum += values[i];
    count = valuesLength;
  } else {
    // Rank the POSITIONS, so the ends can be dropped without disturbing the original order.
    // Ties break by position, which keeps the choice deterministic when equal values straddle
    // the cut (tie-break is not observable — the retained multiset is identical
    // either way, and only the float summation order could differ).
    const ranked = new Array<number>(valuesLength);
    for (let i=0; i<valuesLength; i++) ranked[i] = i;
    ranked.sort((a, b) => values[a] - values[b] || a - b);
    const trimmed = new Uint8Array(valuesLength);
    for (let i=0; i<trimCount; i++) {
      trimmed[ranked[i]] = 1;
      trimmed[ranked[valuesLength - 1 - i]] = 1;
    }
    for (let i=0; i<valuesLength; i++) {
      if (trimmed[i]) continue;
      sum += values[i];
      count++;
    }
  }

  if (count === 0) return Number.NaN; // #NUM! — the order statistics' answer, not AVERAGE's
  return sum / count;
}

const _optionsRowAxis: IRange.IteratorOptions = {
  axis: IRange.Axis.Row
};

/**
 * Calculates variance based on the entire population (ignores logical values and text in the population).
 * @name VAR.P
 * @param number are 1 to 255 numeric arguments corresponding to a population.
 */
export function VAR_P(number: Repeating<IRange<number>, 254>): number {
  let sigma = 0;
  let count = 0;

  const mean = AVERAGE(number);
  for (const range of number) {
    for (const value of range.values()) {
      sigma += Math.pow(value - mean, 2);
      count++;
    }
  }

  const result = sigma / count;
  if (isNaN(result)) {
    return Number.NaN; // Number.NaN;
  }
  return result;
}

/**
 * Calculates variance based on the entire population (ignores logical values and text in the population).
 * @param number are 1 to 255 numeric arguments corresponding to a population.
 * @category Compatibility
 */
export function VARP(number: IRange<number>[]): number {
  return VAR_P(number);
}

/**
 * Estimates variance based on a sample (ignores logical values and text in the sample).
 * @name VAR.S
 * @param number are 1 to 255 numeric arguments corresponding to a sample of a population.
 */
export function VAR_S(number: Repeating<IRange<number>, 254>): number {
  let sigma = 0;
  let count = 0;

  const mean = AVERAGE(number);
  for (const range of number) {
    for (const value of range.values({ type: ScalarType.Number, onError: 'value' })) {
      if (typeof value === 'number') {
        sigma += Math.pow(value - mean, 2);
        count++;
      }
    }
  }
  if (count < 2) throw FormulaError.BuiltIn.Div0!;
  return sigma / (count - 1);
}

/**
 * Estimates variance based on a sample (ignores logical values and text in the sample).
 * @param number are 1 to 255 numeric arguments corresponding to a sample of a population.
 * @category Compatibility
 */
export function VAR(number: IRange<number>[]): number {
  return VAR_S(number);
}

/**
 * Estimates variance based on a sample, including logical values and text. Text and the logical value FALSE have the value 0; the logical value TRUE have the value 1.
 * @param value are 1 to 255 value arguments corresponding to a sample of a population.
 */
/**
 * The sum of squared deviations the four A variances share, and the count behind it.
 *
 * The mean is taken from the SAME reading as the deviations rather than from AVERAGEA, because
 * AVERAGEA is the one A function that reads a text member of an ARRAY as 0 where these four skip
 * it — borrowing its mean made `VARA({1,"x",3,4,10})` a four-value spread about a five-value
 * centre.
 */
const _aDeviations = (
  value: readonly IRange<number>[]
): { sigma: number; count: number } => {
  const values: number[] = [];
  let sum = 0;
  for (const range of value) {
    const reference = isReferenceRange(range);
    for (const raw of range.values({ type: null })) {
      const v = coerceAValue(raw, reference);
      if (v === null) continue;
      values.push(v);
      sum += v;
    }
  }
  const count = values.length;
  const mean = sum / count;
  let sigma = 0;
  for (let i = 0; i < count; i++) sigma += (values[i]! - mean) ** 2;
  return { sigma, count };
};

export function VARA(value: IRange<number>[]): number {
  const { sigma, count } = _aDeviations(value);
  if (count < 2) throw FormulaError.BuiltIn.Div0!;
  return sigma / (count - 1);
}

/**
 * Calculates variance based on the entire population, including logical values and text. Text and the logical value FALSE have the value 0; the logical value TRUE have the value 1.
 * @param value are 1 to 255 value arguments corresponding to a population.
 */
export function VARPA(value: IRange<number>[]): number {
  const { sigma, count } = _aDeviations(value);
  if (count === 0) throw FormulaError.BuiltIn.Div0!; // one value is 0, none is #DIV/0!
  return sigma / count;
}

/**
 * Returns the Weibull distribution.
 * @name WEIBULL.DIST
 * @param x is the value at which to evaluate the function, a nonnegative number.
 * @param alpha is a parameter to the distribution, a positive number.
 * @param beta is a parameter to the distribution, a positive number.
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability mass function, use FALSE.
 */
export function WEIBULL_DIST(
  x: number,
  alpha: number,
  beta: number,
  cumulative: boolean
): number {
  if (x < 0 || alpha <= 0 || beta <= 0) return Number.NaN; // #NUM!

  if (!cumulative && x === 0) return 0; // PDF=0 at x=0
  // The distribution is `1 - exp(-(x/beta)^alpha)` and the density is
  // `alpha * x^(alpha-1) / beta^alpha * exp(-(x/beta)^alpha)`, each power formed on its own and
  // in that order: one that runs past a double is a refusal, not a distribution of 1 or a density
  // of 0, and a `beta^alpha` that underflows leaves the density a division by zero.
  const scaled = Math.pow(x / beta, alpha);
  if (!Number.isFinite(scaled)) return Number.NaN; // #NUM!
  if (cumulative) return 1 - Math.exp(-scaled);
  const numerator = alpha * Math.pow(x, alpha - 1);
  const scale = Math.pow(beta, alpha);
  if (!Number.isFinite(numerator) || !Number.isFinite(scale)) return Number.NaN; // #NUM!
  if (scale === 0) throw FormulaError.BuiltIn.Div0!;
  return numerator / scale * Math.exp(-scaled);
}

/**
 * Returns the Weibull distribution.
 * @param x is the value at which to evaluate the function, a nonnegative number.
 * @param alpha is a parameter to the distribution, a positive number.
 * @param beta is a parameter to the distribution, a positive number.
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability mass function, use FALSE.
 * @category Compatibility
 */
export function WEIBULL(
  x: number,
  alpha: number,
  beta: number,
  cumulative: boolean
): number {
  return WEIBULL_DIST(x, alpha, beta, cumulative);
}

/**
 * Returns the one-tailed P-value of a z-test.
 * @name Z.TEST
 * @param array is the array or range of data against which to test X.
 * @param x is the value to test.
 * @param sigma is the population (known) standard deviation. If omitted, the sample standard deviation is used.
 */
export function Z_TEST(
  array: ReportType<Omittable<IRange<number>>>,
  x: number,
  sigma?: Omittable<number, 0>,
): number {
  // The sample is the NUMERIC members — text, booleans and blanks are not counted, where a
  // DIRECT boolean or numeric text is one member and a direct text is #VALUE! (the typed slot's
  // rule). An omitted array reads as one zero, so it is one member short like any single value.
  const sample: number[] = [];
  if (array === undefined) {
    sample.push(0);
  } else {
    const values = FormulaContext.flattenAreas(array); // a union samples every area
    if (values.hasError()) throw values.firstError()!;
    for (const v of values.values()) if (typeof v === 'number') sample.push(v);
  }
  const n = sample.length;
  if (n === 0) throw FormulaError.BuiltIn.NA!;
  if (n === 1) throw FormulaError.BuiltIn.Div0!;

  let mean = 0;
  for (const v of sample) mean += v;
  mean /= n;

  if (sigma === undefined) {
    // The sample standard deviation is taken about the mean — a constant sample is a zero
    // deviation and #DIV/0! however large its members are, and one whose squared deviations
    // pass the double is #NUM!.
    let ss = 0;
    for (const v of sample) ss += (v - mean) * (v - mean);
    if (!Number.isFinite(ss)) throw FormulaError.BuiltIn.Num!;
    if (ss === 0) throw FormulaError.BuiltIn.Div0!;
    sigma = Math.sqrt(ss / (n - 1));
  } else if (!(sigma > 0)) {
    // A supplied sigma must be positive; zero — a blank cell, an empty argument — is #NUM!.
    throw FormulaError.BuiltIn.Num!;
  }
  return 1 - NORM_S_DIST((mean - x) / (sigma / Math.sqrt(n)), true);
}

/**
 * Returns the one-tailed P-value of a z-test.
 * @param array is the array or range of data against which to test X.
 * @param x is the value to test.
 * @param sigma is the population (known) standard deviation. If omitted, the sample standard deviation is used.
 * @category Compatibility
 */
export function ZTEST(
  array: ReportType<Omittable<IRange<number>>>,
  x: number,
  sigma?: Omittable<number, 0>,
): number {
  return Z_TEST(array, x, sigma);
}

// helpers

// used for PHI.
const SQRT2PI = 2.5066282746310002;

interface TwoRangeStats {
  n: number;
  xMean: number;
  yMean: number;
  ssX: number;   // Σ(xi - xMean)²
  ssY: number;   // Σ(yi - yMean)²
  ssXY: number;  // Σ(xi - xMean)(yi - yMean)
}

/**
 * A single-cell REFERENCE at a two-range slot reads like a direct argument, not like a range of
 * one: an error in it is raised ahead of everything else — ahead of the count check that a
 * multi-cell range's error member loses to — and an empty one is #VALUE!, the same answer an
 * omitted argument gets. A 1x1 array constant is an ordinary one-member range (`{#DIV/0!}`
 * against a five-cell range is #N/A), and a single text cell is a one-member range with no
 * usable pair.
 */
const _singleCellReference = (range: IRange): FormulaError.Known | null => {
  if (range.size !== 1 || !isReferenceRange(range)) return null;
  if (range.hasError()) return range.firstError()!;
  if (range.entries({ includeEmpty: false }).next().done) return FormulaError.BuiltIn.Value!;
  return null;
};

/**
 * The paired scan behind CORREL / COVARIANCE / SLOPE / INTERCEPT / RSQ / STEYX / FORECAST.
 *
 * The engine hands both ranges over whole, members and all, so this scan — the body's — decides
 * which error propagates, and it disagrees with argument order: with `#NAME?` in
 * the LAST row of argument 1 and `#NUM!` in the FIRST row of argument 2, Excel answers `#NUM!`.
 * This family walks the two ranges in LOCKSTEP and the first PAIR holding an error wins,
 * where the whole rest of the library — `SUM`, `SUMPRODUCT`, `AND`, `SKEW`, `PROB`, and the other
 * paired families `CHISQ.TEST` / `F.TEST` / `SUMX2MY2` — finishes argument 1 before looking at
 * argument 2 and answers `#NAME?`.
 *
 * Within one pair the order is argument 1 then argument 2 (`CORREL(C1:C4,E1:E4)` with both errors
 * in row 4 is `#NAME?`), which is why `y` is tested before `x` below.
 */
function _twoRangeStats(
  knownYs: IRange,
  knownXs: IRange
): TwoRangeStats | FormulaError.Known |null {
  const single = _singleCellReference(knownYs) ?? _singleCellReference(knownXs);
  if (single) return single;

  // Count-based length rule (positional pairing by flattened ordinal, shape-blind) — a
  // different shape with the same count pairs via reshape, exactly as sumPaired in mathTrig.
  const rowsY = knownYs.getRowCount();
  const colsY = knownYs.getColumnCount();
  if (rowsY * colsY !== knownXs.getRowCount() * knownXs.getColumnCount()) return null;
  if (knownXs.getRowCount() !== rowsY || knownXs.getColumnCount() !== colsY) {
    knownXs = knownXs.reshape(rowsY, colsY);
  }

  // Lockstep pairs (sparse — both-empty positions never visited), skipping any pair where
  // either side is non-numeric; an error member propagates with its identity, y before x.
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [values] of knownYs.alignValues([knownXs])) {
    const y = values[0];
    const x = values[1];
    if (FormulaError.isError(y)) return pairedMemberError(y);
    if (FormulaError.isError(x)) return pairedMemberError(x);
    if (typeof y !== 'number' || typeof x !== 'number') continue;
    ys.push(y);
    xs.push(x);
  }

  // n === 0 (no numeric pairs) still returns stats rather than null — callers disagree on it:
  // the paired statistics (CORREL, COVARIANCE, SLOPE, INTERCEPT) are #DIV/0! there,
  // FORECAST/STEYX are #N/A. Means are NaN at n=0; every caller gates on n/ssX before using them.
  const n = ys.length;

  let xSum = 0, ySum = 0;
  for (let i = 0; i < n; i++) { xSum += xs[i]; ySum += ys[i]; }
  const xMean = xSum / n;
  const yMean = ySum / n;

  let ssX = 0, ssY = 0, ssXY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    ssX  += dx * dx;
    ssY  += dy * dy;
    ssXY += dx * dy;
  }
  return { n, xMean, yMean, ssX, ssY, ssXY };
}
