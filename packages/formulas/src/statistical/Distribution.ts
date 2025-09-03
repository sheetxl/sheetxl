/* cspell: disable */
import jStat from 'jstat';

import { ScalarType, FormulaError, IRange } from '@sheetxl/primitives';

import { AVERAGE, AVERAGEA } from './Statistical';
import { COMBIN } from '../mathTrig/Math';

function toEqualArray(
  knownYs: IRange,
  knownXs: IRange=null
): number[][] {
  const ysLength:number = knownYs.size;
  const ys:number[] = new Array(ysLength);
  let xs:number[] = new Array(ysLength);
  let index:number = 0;
  if (knownXs) {
    if (knownXs.size !== ysLength) throw FormulaError.BuiltIn.Ref;
    for (const value of knownXs.values({ includeEmpty: true })) {
      if (!(typeof value === 'number')) throw FormulaError.BuiltIn.Value;
      xs[index++] = value;
    }
  } else {
    for (let i=0; i<ysLength; i++) {
      xs[i] = i+1;
    }
  }
  index = 0;
  for (const value of knownYs.values()) {
    if (!(typeof value === 'number')) throw FormulaError.BuiltIn.Value;
    ys[index++] = value;
  }
  return [ys, xs];
}

/**
 * @name BETA.DIST
 * @summary Returns the beta probability distribution function
 * @param x is the value between A and B at which to evaluate the function
 * @param alpha is a parameter to the distribution and must be greater than 0
 * @param beta is a parameter to the distribution and must be greater than 0
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability density function, use FALSE
 * @param a lower bound to the interval of x
 * @param b upper bound to the interval of x
 */
export function BETA_DIST(
  x: number,
  alpha: number,
  beta: number,
  cumulative: boolean,
  a: number=0,
  b: number=1
): number {
  if (alpha <= 0 || beta <= 0 || x < a || x > b || a === b) return Number.NaN;

  x = (x - a) / (b - a);
  return cumulative ? jStat.beta.cdf(x, alpha, beta) : jStat.beta.pdf(x, alpha, beta) / (b - a);
}

/**
 * @summary Returns the cumulative beta probability density function
 * @param x is the value between A and B at which to evaluate the function
 * @param alpha is a parameter to the distribution and must be greater than 0
 * @param beta is a parameter to the distribution and must be greater than 0
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability density function, use FALSE
 * @param a lower bound to the interval of x
 * @param b upper bound to the interval of x
 * @category Compatibility
 */
export function BETADIST(
  x: number,
  alpha: number,
  beta: number,
  cumulative: boolean,
  a: number=0,
  b: number=1
): number {
  // TODO validate
  return  BETA_DIST(x, alpha, beta, true/*guess*/, a, b);
}

/**
 * @name BETA.INV
 * @summary Returns the inverse of the cumulative beta probability density function (BETA.DIST)
 * @param probability is a probability associated with the beta distribution
 * @param alpha is a parameter to the distribution and must be greater than 0
 * @param beta is a parameter to the distribution and must be greater than 0
 * @param a lower bound to the interval of x
 * @param b upper bound to the interval of x
 */
export function BETA_INV(
  probability: number,
  alpha: number,
  beta: number,
  a: number=0,
  b: number=1
): number {
  if (alpha <= 0 || beta <= 0 || probability <= 0 || probability > 1) return Number.NaN;

  return jStat.beta.inv(probability, alpha, beta) * (b - a) + a;
}

/**
 * @category Compatibility
 * @summary Returns the inverse of the cumulative beta probability density function (BETADIST)
 * @param probability is a probability associated with the beta distribution
 * @param alpha is a parameter to the distribution and must be greater than 0
 * @param beta is a parameter to the distribution and must be greater than 0
 * @param a lower bound to the interval of x
 * @param b upper bound to the interval of x
 */
export function BETAINV(
  probability: number,
  alpha: number,
  beta: number,
  a: number=0,
  b: number=1
): number {
  return BETA_INV(probability, alpha, beta, a, b);
}

/**
 * @name BINOM.DIST
 * @summary Returns the individual term binomial distribution probability
 * @param numberS is the number of successes in trials
 * @param trials is the number of independent trials
 * @param probabilityS is the probability of success on each trial
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability mass function, use FALSE
 */
export function BINOM_DIST(
  numberS: number,
  trials: number,
  probabilityS: number,
  cumulative: boolean
): number {
  if (trials < 0 || probabilityS < 0 || probabilityS > 1 || numberS < 0 || numberS > trials) return Number.NaN;

  return cumulative
    ? jStat.binomial.cdf(numberS, trials, probabilityS)
    : jStat.binomial.pdf(numberS, trials, probabilityS);
}

/**
 * @category Compatibility
 * @summary Returns the individual term binomial distribution probability
 * @param numberS is the number of successes in trials
 * @param trials is the number of independent trials
 * @param probabilityS is the probability of success on each trial
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability mass function, use FALSE
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
 * @name BINOM.DIST.RANGE
 * @summary Returns the probability of a trial result using a binomial distribution
 * @param trials is the number of independent trials
 * @param probabilityS is the probability of success on each trial
 * @param numberS is the number of successes in trials
 * @param numberS2 if provided this function returns the probability that the number of successful trials shall lie between number_s and number_s2
 */
export function BINOM_DIST_RANGE(
  trials: number,
  probabilityS: number,
  numberS: number,
  numberS2: number=numberS,
): number {
  if (trials < 0 || probabilityS < 0 || probabilityS > 1 || numberS < 0 || numberS > trials || numberS2 < numberS || numberS2 > trials)
    return Number.NaN;

  let result = 0;
  for (let i = numberS; i <= numberS2; i++) {
    result += COMBIN(trials, i) * Math.pow(probabilityS, i) * Math.pow(1 - probabilityS, trials - i);
  }
  return result;
}

/**
 * @name BINOM.INV
 * @summary Returns the smallest value for which the cumulative binomial distribution is greater than or equal to a criterion value
 * @param trials is the number of Bernoulli trials
 * @param probabilityS is the probability of success on each trial, a number between 0 and 1 inclusive
 * @param alpha is the criterion value, a number between 0 and 1 inclusive
 */
export function BINOM_INV(
  trials: number,
  probabilityS: number,
  alpha: number
): number {
  if (trials < 0 || probabilityS < 0 || probabilityS > 1 || alpha < 0 || alpha > 1) return Number.NaN;

  let x = 0;
  while (x <= trials) {
    if (jStat.binomial.cdf(x, trials, probabilityS) >= alpha) {
      return x;
    }
    x++;
  }
}

/**
 * @name CHISQ.DIST
 * @summary Returns the left-tailed probability of the chi-squared distribution
 * @param x is the value at which you want to evaluate the distribution, a nonnegative number
 * @param degFreedom is the number of degrees of freedom, a number between 1 and 10^10, excluding 10^10
 * @param cumulative is a logical value for the function to return: the cumulative distribution function = TRUE; the probability density function = FALSE
 */
export function CHISQ_DIST(
  x: number,
  degFreedom: number,
  cumulative: boolean=false
): number {
  if (x < 0 || degFreedom < 1 || degFreedom > 10 ** 10) return Number.NaN;

  return cumulative
    ? jStat.chisquare.cdf(x, degFreedom)
    : jStat.chisquare.pdf(x, degFreedom);
}

/**
 * @category Compatibility
 * @summary Returns the right-tailed probability of the chi-squared distribution
 * @param x is the value at which you want to evaluate the distribution, a nonnegative number
 * @param degFreedom is the number of degrees of freedom, a number between 1 and 10^10, excluding 10^10
 */
export function CHIDIST(
  x: number,
  degFreedom: number
): number {
  // Is this correct?
  return CHISQ_DIST(x, degFreedom);
}

/**
 * @name CHISQ.DIST.RT
 * @summary Returns the right-tailed probability of the chi-squared distribution
 * @param x is the value at which you want to evaluate the distribution, a nonnegative number
 * @param degFreedom is the number of degrees of freedom, a number between 1 and 10^10, excluding 10^10
 */
export function CHISQ_DIST_RT(
  x: number,
  degFreedom: number
): number {
  degFreedom = Math.trunc(degFreedom);
  if (x < 0 || degFreedom < 1 || degFreedom > 10 ** 10) return Number.NaN;

  return 1 - jStat.chisquare.cdf(x, degFreedom);
}

/**
 * @name CHISQ.INV
 * @summary Returns the inverse of the left-tailed probability of the chi-squared distribution
 * @param probability is a probability associated with the chi-squared distribution, a value between 0 and 1 inclusive
 * @param degFreedom is the number of degrees of freedom, a number between 1 and 10^10, excluding 10^10
 */
export function CHISQ_INV(
  probability: number,
  degFreedom: number
): number {
  degFreedom = Math.trunc(degFreedom);
  if (probability < 0 || probability > 1 || degFreedom < 1 || degFreedom > 10 ** 10) return Number.NaN;

  return jStat.chisquare.inv(probability, degFreedom);
}

/**
 * @category Compatibility
 * @summary Returns the inverse of the right-tailed probability of the chi-squared distribution
 * @param probability is a probability associated with the chi-squared distribution, a value between 0 and 1 inclusive
 * @param degFreedom is the number of degrees of freedom, a number between 1 and 10^10, excluding 10^10
 */
export function CHIINV(
  probability: number,
  degFreedom: number
): number {
  return CHISQ_INV(probability, degFreedom);
}

/**
 * @name CHISQ.INV.RT
 * @summary Returns the right-tailed probability of the chi-squared distribution
 * @param probability is a probability associated with the chi-squared distribution, a value between 0 and 1 inclusive
 * @param degFreedom is the number of degrees of freedom, a number between 1 and 10^10, excluding 10^10
 */
export function CHISQ_INV_RT(
  probability: number,
  degFreedom: number
): number {
  degFreedom = Math.trunc(degFreedom);
  if (probability < 0 || probability > 1 || degFreedom < 1 || degFreedom > 10 ** 10) return Number.NaN;

  return jStat.chisquare.inv(1 - probability, degFreedom);
}

/**
 * @name CHISQ.TEST
 * @summary Returns the test for independence: the value from the chi-squared distribution for the statistic and the appropriate degrees of freedom
 * @param actualRange is the range of data that contains observations to test against expected values
 * @param expectedRange is the range of data that contains the ratio of the product of row totals and column totals to the grand total
 */
export function CHISQ_TEST(
  actualRange: any[][],
  expectedRange: any[][]
): number {
  if (actualRange.length !== expectedRange.length
     || actualRange[0].length !== expectedRange[0].length
     || actualRange.length === 1 && actualRange[0].length === 1)
    throw FormulaError.BuiltIn.NA;

  const row = actualRange.length;
  const col = actualRange[0].length;
  let dof = (row - 1) * (col - 1);
  if (row === 1)
    dof = col - 1;
  else
    dof = row - 1;
  let xsqr = 0;

  for (let i=0; i<row; i++) {
    for (let j = 0; j < col; j++) {
      if (typeof actualRange[i][j] !== "number" || typeof expectedRange[i][j] !== "number")
        continue;
      if (expectedRange[i][j] === 0) return Infinity;
      xsqr += Math.pow((actualRange[i][j] - expectedRange[i][j]), 2) / expectedRange[i][j];
    }
  }

  // Get independent by X square and its degree of freedom
  let p = Math.exp(-0.5 * xsqr);
  if ((dof % 2) === 1) {
    p = p * Math.sqrt(2 * xsqr / Math.PI);
  }
  let k = dof;
  while (k >= 2) {
    p = p * xsqr / k;
    k = k - 2;
  }
  let t = p, a = dof;
  while (t > 0.000000000000001 * p) {
    a = a + 2;
    t = t * xsqr / a;
    p = p + t;
  }
  return 1 - p;
}

/**
 * @category Compatibility
 * @summary Returns the test for independence: the value from the chi-squared distribution for the statistic and the appropriate degrees of freedom
 * @param actualRange is the range of data that contains observations to test against expected values
 * @param expectedRange is the range of data that contains the ratio of the product of row totals and column totals to the grand total
 */
export function CHITEST(
  actualRange: any[][],
  expectedRange: any[][]
): number {
  return CHISQ_TEST(actualRange, expectedRange);
}

/**
 * @name CONFIDENCE.NORM
 * @summary Returns the confidence interval for a population mean, using a normal distribution
 * @param alpha is the significance level used to compute the confidence level, a number greater than 0 and less than 1
 * @param standardDev is the population standard deviation for the data range and is assumed to be known. Standard_dev must be greater than 0
 * @param size is the sample size
 */
export function CONFIDENCE_NORM(
  alpha: number,
  standardDev: number,
  size: number
): number {
  size = Math.trunc(size);
  if (alpha <= 0 || alpha >= 1 || standardDev <= 0 || size < 1) return Number.NaN;

  return jStat.normalci(1, alpha, standardDev, size)[1] - 1;
}

/**
 * @category Compatibility
 * @summary Returns the confidence interval for a population mean, using a normal distribution
 * @param alpha is the significance level used to compute the confidence level, a number greater than 0 and less than 1
 * @param std is the population standard deviation for the data range and is assumed to be known. Standard_dev must be greater than 0
 * @param dev is the population standard deviation for the data range and is assumed to be known. Standard_dev must be greater than 0
 * @param size is the sample size
 */
// TODO - excel doesn't have a dev param?
export function CONFIDENCE(
  alpha: number,
  std: number,
  dev: number,
  size: number
): number {
  size = Math.trunc(size);
  if (alpha <= 0 || alpha >= 1 || std <= 0 || size < 1) return Number.NaN;
  // TODO - validate
  return jStat.normalci(dev, alpha, std, size)[1] - 1;
}

/**
 * @name CONFIDENCE.T
 * @summary Returns the confidence interval for a population mean, using a Student's T distribution
 * @param alpha is the significance level used to compute the confidence level, a number greater than 0 and less than 1
 * @param standardDev is the population standard deviation for the data range and is assumed to be known. Standard_dev must be greater than 0
 * @param size is the sample size
 */
export function CONFIDENCE_T(
  alpha: number,
  standardDev: number,
  size: number
): number {
  size = Math.trunc(size);
  if (alpha <= 0 || alpha >= 1 || standardDev <= 0 || size < 1) return Number.NaN;
  if (size === 1) Infinity;

  return jStat.tci(1, alpha, standardDev, size)[1] - 1;
}

/**
 * @summary Returns the correlation coefficient between two data sets
 * @param array1 is a cell range of values. The values should be numbers, names, arrays, or references that contain numbers
 * @param array2 is a second cell range of values. The values should be numbers, names, arrays, or references that contain numbers
 */
export function CORREL(
  array1: any[],
  array2: any[]
): number {
  if (array1.length !== array2.length)
    throw FormulaError.BuiltIn.NA;

  // filter out values that are not number
  const filterArr1 = [];
  const filterArr2 = [];
  for (let i=0; i<array1.length; i++) {
    if (typeof array1[i] !== "number" || typeof array2[i] !== "number")
      continue;
    filterArr1.push(array1[i]);
    filterArr2.push(array2[i]);
  }
  if (filterArr1.length <= 1) return Infinity;

  return jStat.corrcoeff(filterArr1, filterArr2);
}

/**
 * @name COVARIANCE.P
 * @summary Returns population covariance, the average of the products of deviations for each data point pair in two data sets
 * @param array1 is the first cell range of integers and must be numbers, arrays, or references that contain numbers
 * @param array2 is the second cell range of integers and must be numbers, arrays, or references that contain numbers
 */
export function COVARIANCE_P(
  array1: any[],
  array2: any[]
): number {
  if (array1.length !== array2.length)
    throw FormulaError.BuiltIn.NA;

  // filter out values that are not number
  const filterArr1 = [];
  const filterArr2 = [];
  for (let i=0; i<array1.length; i++) {
    if (typeof array1[i] !== "number" || typeof array2[i] !== "number")
      continue;
    filterArr1.push(array1[i]);
    filterArr2.push(array2[i]);
  }
  const mean1 = jStat.mean(filterArr1), mean2 = jStat.mean(filterArr2);
  let result = 0;
  for (let i=0; i<filterArr1.length; i++) {
    result += (filterArr1[i] - mean1) * (filterArr2[i] - mean2);
  }
  return result / filterArr1.length;
}

/**
 * @category Compatibility
 * @summary Returns population covariance, the average of the products of deviations for each data point pair in two data sets
 * @param array1 is the first cell range of integers and must be numbers, arrays, or references that contain numbers
 * @param array2 is the second cell range of integers and must be numbers, arrays, or references that contain numbers
 */
export function COVARIANCE(
  array1: any[],
  array2: any[]
): number {
  // TODO - validate
  return COVARIANCE_P(array1, array2);
}

/**
 * @name COVARIANCE.S
 * @summary Returns sample covariance, the average of the products of deviations for each data point pair in two data sets
 * @param array1 is the first cell range of integers and must be numbers, arrays, or references that contain numbers
 * @param array2 is the second cell range of integers and must be numbers, arrays, or references that contain numbers
 */
export function COVARIANCE_S(
  array1: any[],
  array2: any[]
): number {
  if (array1.length !== array2.length)
    throw FormulaError.BuiltIn.NA;

  // filter out values that are not number
  const filterArr1 = [];
  const filterArr2 = [];
  for (let i=0; i<array1.length; i++) {
    if (typeof array1[i] !== "number" || typeof array2[i] !== "number")
      continue;
    filterArr1.push(array1[i]);
    filterArr2.push(array2[i]);
  }

  if (filterArr1.length <= 1) return Infinity;

  return jStat.covariance(filterArr1, filterArr2);
}

/**
 * @hidden Unimplemented
 * @category Compatibility
 * @summary Returns the smallest value for which the cumulative binomial distribution is greater than or equal to a criterion value
 * @param trails is the number of Bernoulli trials
 * @param probabilityS is the probability of success on each trial, a number between 0 and 1 inclusive
 * @param alpha is the criterion value, a number between 0 and 1 inclusive
 */
export function CRITBINOM(
  trails: any[][],
  probabilityS: number,
  alpha: number
): number {
  // not sure
  return undefined
}

/**
 * @summary Returns the sum of squares of deviations of data points from their sample mean
 * @param number number1,number2,... are 1 to 255 arguments, or an array or array reference, on which you want DEVSQ to calculate
 */
export function DEVSQ(...number: IRange<number>[]): number {
  let sum = 0;
  let numbers = [];
  for (const range of number) {
    for (const value of range.values()) {
      sum += value;
      numbers.push(value);
    }
  }

  const n = numbers.length;
  const mean = sum / n;
  sum = 0;
  for (let i=0; i<n; i++) {
    sum += (numbers[i] - mean) ** 2;
  }
  return sum;
}

/**
 * @name EXPON.DIST
 * @summary Returns the exponential distribution
 * @param x is the value of the function, a nonnegative number
 * @param lambda is the parameter value, a positive number
 * @param cumulative is a logical value for the function to return: the cumulative distribution function = TRUE; the probability density function = FALSE
 */
export function EXPON_DIST(
  x: number,
  lambda: number,
  cumulative: boolean
): number {
  if (x < 0 || lambda <= 0) return Number.NaN;

  return cumulative ? jStat.exponential.cdf(x, lambda) : jStat.exponential.pdf(x, lambda);
}

/**
 * @category Compatibility
 * @summary Returns the exponential distribution
 * @param x is the value of the function, a nonnegative number
 * @param lambda is the parameter value, a positive number
 * @param cumulative is a logical value for the function to return: the cumulative distribution function = TRUE; the probability density function = FALSE
 *
 */
export function EXPONDIST(
  x: number,
  lambda: number,
  cumulative: boolean
): number {
  return EXPON_DIST(x, lambda, cumulative);
}

/**
 * @name F.DIST
 * @summary Returns the (left-tailed) F probability distribution (degree of diversity) for two data sets
 * @param x is the value at which to evaluate the function, a nonnegative number
 * @param degFreedom1 is the numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10
 * @param degFreedom2 is the denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10
 * @param cumulative is a logical value for the function to return: the cumulative distribution function = TRUE; the probability density function = FALSE
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

  return cumulative ? jStat.centralF.cdf(x, degFreedom1, degFreedom2) : jStat.centralF.pdf(x, degFreedom1, degFreedom2);
}

/**
 * @category Compatibility
 * @summary Returns the (left-tailed) F probability distribution (degree of diversity) for two data sets
 * @param x is the value at which to evaluate the function, a nonnegative number
 * @param degFreedom1 is the numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10
 * @param degFreedom2 is the denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10
 */
export function FDIST(
  x: number,
  degFreedom1: number,
  degFreedom2: number
): number {
  // TODO - validate
  return F_DIST(x, degFreedom1, degFreedom2, true/*guess*/);
}

/**
 * @name F.DIST.RT
 * @summary Returns the (right-tailed) F probability distribution (degree of diversity) for two data sets
 * @param x is the value at which to evaluate the function, a nonnegative number
 * @param degFreedom1 is the numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10
 * @param degFreedom2 is the denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10
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

  return 1 - jStat.centralF.cdf(x, degFreedom1, degFreedom2);
}

/**
 * @name F.INV
 * @summary Returns the inverse of the (left-tailed) F probability distribution: if p = F.DIST(x,...), then F.INV(p,...) = x
 * @param probability is a probability associated with the F cumulative distribution, a number between 0 and 1 inclusive
 * @param degFreedom1 is the numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10
 * @param degFreedom2 is the denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10
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

  return jStat.centralF.inv(probability, degFreedom1, degFreedom2);
}

/**
 * @category Compatibility
 * @summary Returns the inverse of the (left-tailed) F probability distribution: if p = F.DIST(x,...), then F.INV(p,...) = x
 * @param probability is a probability associated with the F cumulative distribution, a number between 0 and 1 inclusive
 * @param degFreedom1 is the numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10
 * @param degFreedom2 is the denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10
 */
export function FINV(
  probability: number,
  degFreedom1: number,
  degFreedom2: number
): number {
  // TODO - validate
  return F_INV(probability, degFreedom1, degFreedom2);
}

/**
 * @name F.INV.RT
 * @summary Returns the inverse of the (right-tailed) F probability distribution: if p = F.DIST.RT(x,...), then F.INV.RT(p,...) = x
 * @param probability is a probability associated with the F cumulative distribution, a number between 0 and 1 inclusive
 * @param degFreedom1 is the numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10
 * @param degFreedom2 is the denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10
 */
export function F_INV_RT(
  probability: number,
  degFreedom1: number,
  degFreedom2: number
): number {
  // If Probability is < 0 or probability is > 1, F.INV.RT returns the #NUM! error value.
  if (probability < 0.0 || probability > 1.0) return Number.NaN;
  // If Deg_freedom1 is < 1, or Deg_freedom2 is < 1, F.INV.RT returns the #NUM! error value.
  if (degFreedom1 < 1.0 || degFreedom1 >= Math.pow(10, 10)) return Number.NaN;
  // If Deg_freedom2 is < 1 or Deg_freedom2 is ≥ 10^10, F.INV.RT returns the #NUM! error value.
  if (degFreedom2 < 1.0 || degFreedom2 >= Math.pow(10, 10)) return Number.NaN;

  // If Deg_freedom1 or Deg_freedom2 is not an integer, it is truncated.
  degFreedom1 = Math.trunc(degFreedom1);
  degFreedom2 = Math.trunc(degFreedom2);

  return jStat.centralF.inv(1.0 - probability, degFreedom1, degFreedom2);
}

/**
 * @name F.TEST
 * @summary Returns the result of an F-test, the two-tailed probability that the variances in Array1 and Array2 are not significantly different
 * @param array1 is the first array or range of data and can be numbers or names, arrays, or references that contain numbers (blanks are ignored)
 * @param array2 is the second array or range of data and can be numbers or names, arrays, or references that contain numbers (blanks are ignored)
 *
 * @help https://en.wikipedia.org/wiki/F-test_of_equality_of_variances
 */
export function F_TEST(array1: any[], array2: any[]): number {
  // filter out values that are not number
  const x1 = [];
  const x2 = [];
  let x1Mean = 0;
  let x2Mean = 0;
  for (let i=0; i<Math.max(array1.length, array2.length); i++) {
    if (typeof array1[i] === "number") {
      x1.push(array1[i]);
      x1Mean += array1[i];
    }
    if (typeof array2[i] === "number") {
      x2.push(array2[i]);
      x2Mean += array2[i];
    }
  }
  if (x1.length <= 1 || x2.length <= 1) return Infinity;

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
  // P(F<=f) one-tail * 2
  return jStat.centralF.cdf(s1 / s2, x1.length - 1, x2.length - 1) * 2;
}

/**
 * @category Compatibility
 * @summary Returns the result of an F-test, the two-tailed probability that the variances in Array1 and Array2 are not significantly different
 * @param array1 is the first array or range of data and can be numbers or names, arrays, or references that contain numbers (blanks are ignored)
 * @param array2 is the second array or range of data and can be numbers or names, arrays, or references that contain numbers (blanks are ignored)
 */
export function FTEST(array1: any[], array2: any[]): number {
  // TODO - validate
  return F_TEST(array1, array2);
}

/**
 * @summary Returns the Fisher transformation
 * @param x is the value for which you want the transformation, a number between -1 and 1, excluding -1 and 1
 */
export function FISHER(x: number): number {
  // If x ≤ -1 or if x ≥ 1, FISHER returns the #NUM! error value.
  if (x <= -1 || x >= 1) return Number.NaN;

  return Math.log((1 + x) / (1 - x)) / 2;
}

/**
 * @summary Returns the inverse of the Fisher transformation: if y = FISHER(x), then FISHERINV(y) = x
 * @param y is the value for which you want to perform the inverse of the transformation
 */
export function FISHERINV(y: number): number {
  const e2y = Math.exp(2 * y);
  return (e2y - 1) / (e2y + 1);
}

/**
 * @category Compatibility
 * @summary Calculates, or predicts, a future value along a linear trend by using existing values
 * @param x is the data point for which you want to predict a value and must be a numeric value
 * @param knownYs is the dependent array or range of numeric data
 * @param knownXs is the independent array or range of numeric data. The variance of Known_x's must not be zero
 */
// TODO - incorrect
export function FORECAST(
  x: number,
  knownYs: any[]=null,
  knownXs: any[]=null
): number {
  const knownYsLength = knownYs.length;
  if (knownXs.length !== knownYsLength) throw FormulaError.BuiltIn.NA;

  // filter out values that are not number
  const filteredY = [];
  const filteredX = [];
  let xAllEqual = true;
  for (let i=0; i<knownYsLength; i++) {
    if (typeof knownYs[i] !== "number" || typeof knownXs[i] !== "number")
      continue;
    filteredY.push(knownYs[i]);
    filteredX.push(knownXs[i]);
    if (knownXs[i] !== knownXs[0])
      xAllEqual = false;
  }
  if (xAllEqual) return Infinity;

  const yMean = jStat.mean(filteredY);
  const xMean = jStat.mean(filteredX);
  let numerator = 0, denominator = 0;
  const filteredYLength = filteredY.length;
  for (let i=0; i<filteredYLength; i++) {
    numerator += (filteredX[i] - xMean) * (filteredY[i] - yMean);
    denominator += (filteredX[i] - xMean) ** 2;
  }
  const b = numerator / denominator;
  const a = yMean - b * xMean;
  return a + b * x;
}

/**
 * @hidden Unimplemented
 * @name FORECAST.ETS
 * @summary Returns the forecasted value for a specific future target date using exponential smoothing method
 * @param targetDate is the data point for which you want to predict a value. It should carry on the pattern of values in the timeline
 * @param values is the array or range of numberic data you're predicting
 * @param timeline is the independent array or range of numberic data. The dtes in the timeline must have a consistent step between them and can't be zero.
 * @param seasonality is a number value that indicates the length of the seasonal pattern in the data. It must be between 0 and 1, where 0 means no seasonality and 1 means full seasonality
 * @param dataCompletion is a number value that indicates how much of the data is complete. It must be between 0 and 1, where 0 means no data is complete and 1 means all data is complete
 * @param aggregation is a number value that indicates how the data should be aggregated. It must be between 0 and 1, where 0 means no aggregation and 1 means full aggregation
 */
export function FORECAST_ETS(
  targetDate: number,
  values: IRange, //[] union?
  timeline: IRange, //[] union?
  seasonality: number=0.95, // 0-1
  dataCompletion: number=1,
  aggregation: number=1
): number {
  // skip, not yet possible to implement, may need tensorflow.js ?
  return undefined;
}

/**
 * @hidden Unimplemented
 * @name FORECAST.ETS.CONFINT
 * @summary Retursn a confidence interval for the forecasted value at the specified target date
 * @param targetDate is the data point for which you want to predict a value. It should carry on the pattern of values in the timeline
 * @param values is the array or range of numberic data you're predicting
 * @param timeline is the independent array or range of numberic data. The dtes in the timeline must have a consistent step between them and can't be zero.
 * @param confiedenceLevel is a number value that indicates the confidence level for the forecasted value. It must be between 0 and 1, where 0 means no confidence and 1 means full confidence
 * @param seasonality is a number value that indicates the length of the seasonal pattern in the data. It must be between 0 and 1, where 0 means no seasonality and 1 means full seasonality
 * @param dataCompletion is a number value that indicates how much of the data is complete. It must be between 0 and 1, where 0 means no data is complete and 1 means all data is complete
 * @param aggregation is a number value that indicates how the data should be aggregated. It must be between 0 and 1, where 0 means no aggregation and 1 means full aggregation
 */
export function FORECAST_ETS_CONFINT(
  targetDate: number,
  values: IRange, //[] union?
  timeline: IRange, //[] union?
  confiedenceLevel: number=0.95, // 0-1
  seasonality: number=0.95, // 0-1
  dataCompletion: number=1,
  aggregation: number=1
): number {
  // skip
  return undefined;
}

/**
 * @hidden Unimplemented
 * @name FORECAST.ETS.SEASONALITY
 * @summary Returns the length of the repetitive pattern in the data for the specific time series.
 * @param values is the array or range of numberic data you're predicting
 * @param timeline is the independent array or range of numberic data. The dtes in the timeline must have a consistent step between them and can't be zero.
 * @param dataCompletion is a number value that indicates how much of the data is complete. It must be between 0 and 1, where 0 means no data is complete and 1 means all data is complete
 * @param aggregation is a number value that indicates how the data should be aggregated. It must be between 0 and 1, where 0 means no aggregation and 1 means full aggregation
 */
export function FORECAST_ETS_SEASONALITY(
  values: IRange, //[] union?
  timeline: IRange, //[] union?
  dataCompletion: number=1,
  aggregation: number=1
): number {
  // skip
  return undefined;
}

/**
 * @hidden Unimplemented
 * @name FORECAST.ETS.STAT
 * @summary Returns the requested statistic for the forecast
 * @param values is the array or range of numberic data you're predicting
 * @param timeline is the independent array or range of numberic data. The dtes in the timeline must have a consistent step between them and can't be zero.
 * @param statisticType is a number between 1 and 8 that indicates the type of statistic to return:
 * @param seasonality is a number value that indicates the length of the seasonal pattern in the data. It must be between 0 and 1, where 0 means no seasonality and 1 means full seasonality
 * @param dataCompletion is a number value that indicates how much of the data is complete. It must be between 0 and 1, where 0 means no data is complete and 1 means all data is complete
 * @param aggregation is a number value that indicates how the data should be aggregated. It must be between 0 and 1, where 0 means no aggregation and 1 means full aggregation
 */
export function FORECAST_ETS_STAT(
  values: IRange, //[] union?
  timeline: IRange, //[] union?
  statisticType: number, // 1- 8
  seasonality: number=1,
  dataCompletion: number=1,
  aggregation: number=1
): number {
  // skip
  return undefined;
}

/**
 * @hidden Unimplemented
 * @name FORECAST.LINEAR
 * @summary Calculates, or predicts, a future value along a linear trend by using existing values
 * @param x is the data point for which you want to predict a value and must be a numeric value
 * @param knownYs is the dependent array or range of numeric data
 * @param knownXs is the independent array or range of numeric data. The variance of Known_x's must not be zero
 */
export function FORECAST_LINEAR(
  x: number,
  knownYs: any[],
  knownXs: any[]=null
): number {
  return FORECAST(x, knownYs, knownXs);
}

// copied from Math. Determine a better place
function flatten2D(array2D: any[][], defaultValue: any=undefined): any[] {
  let retValue = [];
  for (let i=0; i<array2D.length; i++) {
    const row = array2D[i];
    for (let j=0; j<row.length; j++) {
      let value = row[j];
      if (value === undefined || value === null) {
        value = defaultValue;
      }
      retValue.push(value);
    }
  }
  return retValue;
}

/**
 * @summary Calculates how often values occur within a range of values and then returns a vertical array of numbers having one more element than Bins_array
 * @param dataArray is an array of or reference to a set of values for which you want to count frequencies (blanks and text are ignored)
 * @param binsArray is an array of or reference to intervals into which you want to group the values in data_array
 */
// flatten removes gaps in arrays which is sorta need
export function FREQUENCY(
  dataArray: any[][],
  binsArray: any[][]
): any[][] {
  let dataArrayFlattened = flatten2D(dataArray);
  let binsArrayFlattened = flatten2D(binsArray);

  const binsArrayFiltered = [];
  for (let i=0; i<binsArrayFlattened.length; i++) {
    if (typeof binsArrayFlattened[i] !== "number")
      continue;
    binsArrayFiltered.push(binsArrayFlattened[i]);
  }
  binsArrayFiltered.sort();
  binsArrayFiltered.push(Infinity);

  const result = [];
  for (let j=0; j<binsArrayFiltered.length; j++) {
    result[j] = [];
    result[j][0] = 0;
    for (let i=0; i<dataArrayFlattened.length; i++) {
      if (typeof dataArrayFlattened[i] !== "number") {
        continue;
      }
      const curr = dataArrayFlattened[i];
      if (curr <= binsArrayFiltered[j]) {
        result[j][0]++;
        dataArrayFlattened[i] = null;
      }
    }
  }
  // return a 2d array
  return result;
}

/**
 * @summary Returns the Gamma function value
 * @param x is the value for which you want to calculate Gamma
 */
export function GAMMA(x: number): number {
  // If Number is a negative integer or 0, GAMMA returns the #NUM! error value.
  if (x === 0 || (x < 0 && x === Math.trunc(x))) return Number.NaN;

  return jStat.gammafn(x);
}

/**
 * @name GAMMA.DIST
 * @summary Returns the gamma distribution
 * @param x is the value at which you want to evaluate the distribution, a nonnegative number
 * @param alpha is a parameter to the distribution, a positive number
 * @param beta is a parameter to the distribution, a positive number. If beta = 1, GAMMA.DIST returns the standard gamma distribution
 * @param cumulative is a logical value: return the cumulative distribution function = TRUE; return the probability mass function = FALSE
 */
export function GAMMA_DIST(
  x: number,
  alpha: number,
  beta: number,
  cumulative: boolean=false
): number {
  // If x < 0, GAMMA.DIST returns the #NUM! error value.
  // If alpha ≤ 0 or if beta ≤ 0, GAMMA.DIST returns the #NUM! error value.
  if (x < 0 || alpha <= 0 || beta <= 0) return Number.NaN;

  return cumulative
    ? jStat.gamma.cdf(x, alpha, beta, true)
    : jStat.gamma.pdf(x, alpha, beta, false);
}

/**
 * @name GAMMA.INV
 * @summary Returns the inverse of the gamma cumulative distribution: if p = GAMMA.DIST(x,...), then GAMMA.INV(p,...) = x
 * @param probability is the probability associated with the gamma distribution, a number between 0 and 1, inclusive
 * @param alpha is a parameter to the distribution, a positive number
 * @param beta is a parameter to the distribution, a positive number. If beta = 1, GAMMA.DIST returns the standard gamma distribution
 */
export function GAMMA_INV(
  probability: number,
  alpha: number,
  beta: number
): number {
  // If probability < 0 or probability > 1, GAMMA.INV returns the #NUM! error value.
  // If alpha ≤ 0 or if beta ≤ 0, GAMMA.INV returns the #NUM! error value.
  if (probability < 0 || probability > 1 || alpha <= 0 || beta <= 0) return Number.NaN;

  return jStat.gamma.inv(probability, alpha, beta);
}

/**
 * @summary Returns the natural logarithm of the gamma function
 * @param x is the value for which you want to calculate GAMMALN, a positive number
 */
export function GAMMALN(x: number): number {
  // If x is nonnumeric, GAMMALN returns the #VALUE! error value.
  // If x ≤ 0, GAMMALN returns the #NUM! error value.
  if (x <= 0) return Number.NaN;

  return jStat.gammaln(x);
}

/**
 * @name GAMMALN.PRECISE
 * @summary Returns the natural logarithm of the gamma function
 * @param x is the value for which you want to calculate GAMMALN.PRECISE, a positive number
 */
export function GAMMALN_PRECISE(x: number): number {
  // If x is nonnumeric, GAMMALN returns the #VALUE! error value.
  // If x ≤ 0, GAMMALN returns the #NUM! error value.
  if (x <= 0) return Number.NaN;

  return jStat.gammaln(x);
}

/**
 * @summary Returns 0.5 less than the standard normal cumulative distribution
 * @param x is the value for which you want the distribution
 */
export function GAUSS(x: number): number {
  // If z is not a valid number, GAUSS returns the #NUM! error value.
  // If z is not a valid data type, GAUSS returns the #VALUE! error value.
  return jStat.normal.cdf(x, 0, 1) - 0.5;
}

/**
 * @summary Returns the geometric mean of an array or range of positive numeric data
 * @param number number1,number2,... are 1 to 255 numbers or names, arrays, or references that contain numbers for which you want the mean
 */
export function GEOMEAN(...number: IRange<number>[]): number {
  const numbers = [];
  for (const range of number) {
    for (const value of range.values()) {
      numbers.push(value);
    }
  }

  return jStat.geomean(numbers);
}

/**
 * @summary Returns numbers in an exponential growth trend matching known data points
 * @param knownYs is the set of y-values you already know in the relationship y = b*m^x, an array or range of positive numbers
 * @param knownXs is an optional set of x-values that you may already know in the relationship y = b*m^x, an array or range the same size as Known_y's
 * @param newXs  are new x-values for which you want GROWTH to return corresponding y-values
 * @param useConst is a logical value: the constant b is calculated normally if Const = TRUE; b is set equal to 1 if Const = FALSE
 */
// TODO - make ranges and error if not the same length
export function GROWTH(
  knownYs: any[],
  knownXs: any[]=null,
  newXs: any[][]=null,
  useConst: boolean=true
): number[][] {
  // Credits: Ilmari Karonen (http://stackoverflow.com/questions/14161990/how-to-implement-growth-function-in-javascript)
  // set to number and not needed
  const knownYsLength = knownYs.length;
  for (let i=0; i<knownYsLength; i++) {
    if (typeof knownYs[i] !== "number") throw FormulaError.BuiltIn.Value;
  }

  const isKnownXOmitted = knownXs === null;
  if (knownXs === null) {
    knownXs = [];
    for (let i=1; i<=knownYsLength; i++) {
      knownXs.push(i);
    }
  } else {
    const knownXsLength = knownXs.length;
    if (knownXsLength !== knownYsLength) throw FormulaError.BuiltIn.Ref;
    // set to number and not needed
    for (let i=0; i<knownXsLength; i++) {
      if (typeof knownXs[i] !== "number") throw FormulaError.BuiltIn.Value;
    }
  }

  if (newXs === null && isKnownXOmitted) {
    newXs = [];
    for (let i=1; i<=knownYsLength; i++) {
      newXs.push(i as any);
    }
    newXs = [newXs];
  } else if (newXs === null) {
    newXs = Array.isArray(knownXs[0]) ? knownXs : [knownXs];
  }

  // Calculate sums over the data:
  let avg_x = 0;
  let avg_y = 0;
  let avg_xy = 0;
  let avg_xx = 0;
  for (let i=0; i<knownYsLength; i++) {
    const x = knownXs[i];
    const y = Math.log(knownYs[i]);
    avg_x += x;
    avg_y += y;
    avg_xy += x * y;
    avg_xx += x * x;
  }
  avg_x /= knownYsLength;
  avg_y /= knownYsLength;
  avg_xy /= knownYsLength;
  avg_xx /= knownYsLength;

  // Compute linear regression coefficients:
  let beta: number;
  let alpha: number;
  if (useConst) {
    beta = (avg_xy - avg_x * avg_y) / (avg_xx - avg_x * avg_x);
    alpha = avg_y - beta * avg_x;
  } else {
    beta = avg_xy / avg_xx;
    alpha = 0;
  }

  // Compute and return result array:
  const new_y = [];
  const newXsLength = newXs.length;
  for (let i=0; i<newXsLength; i++) {
    new_y[i] = [];
    for (let j=0; j < newXs[0].length; j++) {
      if (typeof newXs[i][j] !== "number") throw FormulaError.BuiltIn.Value;
      new_y[i][j] = Math.exp(alpha + beta * newXs[i][j]);
    }
  }
  return new_y;
}

/**
 * @summary Returns the harmonic mean of a data set of positive numbers: the reciprocal of the arithmetic mean of reciprocals
 * @param number number1,number2,... are 1 to 255 numbers or names, arrays, or references that contain numbers for which you want the harmonic mean
 */
export function HARMEAN(...number: IRange<number>[]): number {
  let cnt = 0;
  let denominator = 0;
  for (const range of number) {
    for (const value of range.values()) {
      denominator += 1 / value;
      cnt++;
    }
  }
  return cnt / denominator;
}

/**
 * @name HYPGEOM.DIST
 * @summary Returns the hypergeometric distribution
 * @param sampleS is the number of successes in the sample
 * @param numberSample is the size of the sample
 * @param populationS is the number of successes in the population
 * @param numberPop is the population size
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability density function, use FALSE
 */
export function HYPGEOM_DIST(
  sampleS: number,
  numberSample: number,
  populationS: number,
  numberPop: number,
  cumulative: boolean
): number {
  // All arguments are truncated to integers.
  sampleS = Math.trunc(sampleS);
  numberSample = Math.trunc(numberSample);
  populationS = Math.trunc(populationS);
  numberPop = Math.trunc(numberPop);

  // // If numberPop ≤ 0, HYPGEOM.DIST returns the #NUM! error value.
  if (numberPop <= 0 || sampleS < 0 || numberSample <= 0 || populationS <= 0) return Number.NaN;
  // // If numberSample ≤ 0 or numberSample > numberPopulation, HYPGEOM.DIST returns the #NUM! error value.
  if (numberSample > numberPop) return Number.NaN;
  // // If populationS ≤ 0 or populationS > numberPopulation, HYPGEOM.DIST returns the #NUM! error value.
  if (populationS > numberPop) return Number.NaN;
  // If sampleS < 0 or sampleS is greater than the lesser of numberSample or populationS, HYPGEOM.DIST returns the #NUM! error value.
  // Google and Mircrosoft has different version on this funtion
  if (numberSample < sampleS || populationS < sampleS) return Number.NaN;
  // If sampleS is less than the larger of 0 or (numberSample - numberPopulation + populationS), HYPGEOM.DIST returns the #NUM! error value.
  if (sampleS < (numberSample - numberPop + populationS)) return Number.NaN;

  function pdf(x: number, n: number, M: number, N: number): number {
    return COMBIN(M, x) * COMBIN(N - M, n - x) / COMBIN(N, n);
  }

  function cdf(x: number, n: number, M: number, N: number): number {
    let result = 0;
    for (let i=0; i <= x; i++) {
      result += pdf(i, n, M, N);
    }
    return result;
  }

  return cumulative
    ? cdf(sampleS, numberSample, populationS, numberPop)
    : pdf(sampleS, numberSample, populationS, numberPop);
}

/**
 * @summary Calculates the point at which a line will intersect the y-axis by using a best-fit regression line plotted through the known x-values and y-values
 * @param knownYs is the dependent set of observations or data and can be numbers or names, arrays, or references that contain numbers
 * @param knownXs is the independent set of observations or data and can be numbers or names, arrays, or references that contain numbers
 */
export function INTERCEPT(
  knownYs: any[],
  knownXs: any[]
): number {
  // similar to FORECAST
  if (knownXs.length !== knownYs.length) throw FormulaError.BuiltIn.NA;

  // filter out values that are not number
  const filteredY = [];
  const filteredX = [];
  for (let i=0; i<knownYs.length; i++) {
    if (typeof knownYs[i] !== "number" || typeof knownXs[i] !== "number")
      continue;
    filteredY.push(knownYs[i]);
    filteredX.push(knownXs[i]);
  }
  if (filteredY.length <= 1) return Infinity;
  const yMean = jStat.mean(filteredY);
  const xMean = jStat.mean(filteredX);
  let numerator = 0, denominator = 0;
  for (let i=0; i<filteredY.length; i++) {
    numerator += (filteredX[i] - xMean) * (filteredY[i] - yMean);
    denominator += (filteredX[i] - xMean) ** 2;
  }
  const b = numerator / denominator;
  return yMean - b * xMean;
}

/**
 * @summary Returns the kurtosis of a data set
 * @param number number1,number2,... are 1 to 255 numbers or names, arrays, or references that contain numbers for which you want the kurtosis
 */
export function KURT(...number: IRange<number>[]): number {
  let mean = 0;
  const numbers = [];

  for (const range of number) {
    for (const value of range.values()) {
      mean += value;
      numbers.push(value);
    }
  }
  const n = numbers.length;
  mean /= n;
  let sigma = 0;
  for (let i=0; i<n; i++) {
    sigma += Math.pow(numbers[i] - mean, 4);
  }
  sigma = sigma / Math.pow(jStat.stdev(numbers, true), 4);
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sigma - 3 * (n - 1) * (n - 1) / ((n - 2) * (n - 3));
}

/**
 * @summary Returns statistics that describe a linear trend matching known data points, by fitting a straight line using the least squares method
 * @param knownYs is the set of y-values you already know in the relationship y = mx + b
 * @param knownXs is an optional set of x-values that you may already know in the relationship y = mx + b
 * @param constant is a logical value: the constant b is calculated normally if Const = TRUE; b is set equal to 0 if Const = FALSE
 * @param stats is a logical value: return additional regression statistics = TRUE; return m-coefficients and the constant b = FALSE
 */
// TODO - finish as constant and stats are not used
export function LINEST(
  knownYs: IRange,
  knownXs: IRange=null,
  constant: boolean=true,
  stats: boolean=false
): number[] {
  const ysLength:number = knownYs.size;
  const [ys, xs] = toEqualArray(knownYs, knownXs);

  const ymean:number = jStat.mean(ys);
  const xmean:number = jStat.mean(xs);

  let num:number = 0;
  let den:number = 0;

  for (let i=0; i <ysLength; i++) {
    num += (xs[i] - xmean) * (ys[i] - ymean);
    den += Math.pow(xs[i] - xmean, 2);
  }

  const m:number = num / den;
  const b:number = ymean - m * xmean;

  return [m, b];
}

/**
 * @hidden Unimplemented Buggy
 * @summary Returns statistics that describe an exponential curve matching known data points
 * @param knownYs is the set of y-values you already know in the relationship y = b*m^x
 * @param knownXs is an optional set of x-values that you may already know in the relationship y = b*m^x
 * @param constant is a logical value: the constant b is calculated normally if Const = TRUE; b is set equal to 1 if Const = FALSE
 * @param stats is a logical value: return additional regression statistics = TRUE; return m-coefficients and the constant b = FALSE
 */
// According to Microsoft:
// http://office.microsoft.com/en-us/starter-help/logest-function-HP010342665.aspx
// LOGEST returns are based on the following linear model:
// ln y = x1 ln m1 + ... + xn ln mn + ln b
// TODO - finish this.
export function LOGEST(
  knownYs: IRange,
  knownXs: IRange=null,
  constant: boolean=true,
  stats: boolean=false
): number[] {
  // TODO - this was modified from formula.js but is failing a unit test. Get formula.js to run and then revisit
  return undefined;
  // const ysLength:number = knownYs.size;
  // const ys:number[] = new Array(ysLength);
  // let xs:number[] = new Array(ysLength);
  // let index:number = 0;
  // if (knownXs) {
  //   if (knownXs.size !== ysLength) throw FormulaError.BuiltIn.Ref;
  //   for (const value of knownXs.values({ includeEmpty: true })) {
  //     if (!(typeof value === 'number')) throw FormulaError.BuiltIn.Value;
  //     xs[index++] = value;
  //   }
  // } else {
  //   for (let i=0; i<ysLength; i++) {
  //     xs[i] = i+1;
  //   }
  // }
  // index = 0;
  // let ysTest = [];
  // for (const value of knownYs.values()) {
  //   if (!(typeof value === 'number')) throw FormulaError.BuiltIn.Value;
  //   ysTest.push(value);
  //    ys[index++] = Math.log(value);
  // }

  // const ymean:number = jStat.mean(ys);
  // const xmean:number = jStat.mean(xs);

  // let num:number = 0;
  // let den:number = 0;

  // for (let i=0; i <ysLength; i++) {
  //   num += (xs[i] - xmean) * (ys[i] - ymean);
  //   den += Math.pow(xs[i] - xmean, 2);
  // }

  // const m:number = Math.round(Math.exp(num / den) * 1000000) / 1000000;
  // const b:number = Math.round(Math.exp(ymean - m * xmean) * 1000000) / 1000000;

  // return [m, b];
}


/**
 * @name LOGNORM.DIST
 * @summary Returns the lognormal distribution of x, where ln(x) is normally distributed with parameters Mean and Standard_dev
 * @param x is the value at which to evaluate the function, a positive number
 * @param mean is the mean of ln(x)
 * @param standardDev is the standard deviation of ln(x), a positive number
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability density function, use FALSE
 */
export function LOGNORM_DIST(
  x: number,
  mean: number,
  standardDev: number,
  cumulative: boolean
): number {
  // If x ≤ 0 or if standardDev ≤ 0, LOGNORM.DIST returns the #NUM! error value.
  if (x <= 0 || standardDev <= 0) return Number.NaN;

  return cumulative ? jStat.lognormal.cdf(x, mean, standardDev) : jStat.lognormal.pdf(x, mean, standardDev);
}

/**
 * @name LOGNORM.INV
 * @summary Returns the inverse of the lognormal cumulative distribution function of x, where ln(x) is normally distributed with parameters Mean and Standard_dev
 * @param probability is a probability associated with the lognormal distribution, a number between 0 and 1, inclusive
 * @param mean is the mean of ln(x)
 * @param standardDev is the standard deviation of ln(x), a positive number
 */
export function LOGNORM_INV(
  probability: number,
  mean: number,
  standardDev: number
): number {
  // If any argument is nonnumeric, LOGNORM.INV returns the #VALUE! error value.
  // If probability <= 0 or probability >= 1, LOGNORM.INV returns the #NUM! error value.
  if (probability <= 0 || probability >= 1) return Number.NaN;
  // If standardDev <= 0, LOGNORM.INV returns the #NUM! error value.
  if (standardDev <= 0) return Number.NaN;

  return jStat.lognormal.inv(probability, mean, standardDev);
}

/**
 * @hidden Unimplemented
 * @name MODE.MULT
 * @summary Returns a vertical array of the most frequently occurring, or repetitive, values in an array or range of data.  For a horizontal array, use =TRANSPOSE(MODE.MULT(number1,number2,...))
 * @param number <div class="param-538">number1,number2,... are 1 to 255 numbers, or names, arrays, or references that contain numbers for which you want the mode</div>
 */
export function MODE_MULT(...number: IRange[]): number {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @name MODE.SNGL
 * @summary Returns the most frequently occurring, or repetitive, value in an array or range of data
 * @param number number1,number2,... are 1 to 255 numbers, or names, arrays, or references that contain numbers for which you want the mode
 */
export function MODE_SNGL(...number: IRange[]): number {
  return undefined;
}

/**
 * @name NEGBINOM.DIST
 * @summary Returns the negative binomial distribution, the probability that there will be Number_f failures before the Number_s-th success, with Probability_s probability of a success
 * @param numberF is the number of failures
 * @param numberS is the threshold number of successes
 * @param probabilityS is the probability of a success; a number between 0 and 1
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability mass function, use FALSE
 */
export function NEGBINOM_DIST(
  numberF: number,
  numberS: number,
  probabilityS: number,
  cumulative: boolean
): number {
  // Number_f and numberS are truncated to integers.
  numberF = Math.trunc(numberF);
  numberS = Math.trunc(numberS);

  // If probabilityS < 0 or if probability > 1, NEGBINOM.DIST returns the #NUM! error value.
  if (probabilityS < 0 || probabilityS > 1) return Number.NaN;
  // If numberF < 0 or numberS < 1, NEGBINOM.DIST returns the #NUM! error value.
  if (numberF < 0 || numberS < 1) return Number.NaN;

  return cumulative
    ? jStat.negbin.cdf(numberF, numberS, probabilityS)
    : jStat.negbin.pdf(numberF, numberS, probabilityS);
}

/**
 * @name NORM.DIST
 * @summary Returns the normal distribution for the specified mean and standard deviation
 * @param x is the value for which you want the distribution
 * @param mean is the arithmetic mean of the distribution
 * @param standardDev is the standard deviation of the distribution, a positive number
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability density function, use FALSE
 */
export function NORM_DIST(
  x: number,
  mean: number,
  standardDev: number,
  cumulative: boolean
): number {
  // If mean or standardDev is nonnumeric, NORM.DIST returns the #VALUE! error value.
  // If standardDev ≤ 0, NORM.DIST returns the #NUM! error value.
  if (standardDev <= 0) return Number.NaN;

  // If mean = 0, standardDev = 1, and cumulative = TRUE, NORM.DIST returns the standard normal distribution, NORM.S.DIST.
  return cumulative
    ? jStat.normal.cdf(x, mean, standardDev)
    : jStat.normal.pdf(x, mean, standardDev);
}

/**
 * @name NORM.INV
 * @summary Returns the inverse of the normal cumulative distribution for the specified mean and standard deviation
 * @param probability is a probability corresponding to the normal distribution, a number between 0 and 1 inclusive
 * @param mean is the arithmetic mean of the distribution
 * @param standardDev is the standard deviation of the distribution, a positive number
 */
export function NORM_INV(
  probability: number,
  mean: number,
  standardDev: number
): number {
  // If probability <= 0 or if probability >= 1, NORM.INV returns the #NUM! error value.
  if (probability <= 0 || probability >= 1) return Number.NaN;
  // If standardDev ≤ 0, NORM.INV returns the #NUM! error value.
  if (standardDev <= 0) return Number.NaN;

  // If mean = 0 and standardDev = 1, NORM.INV uses the standard normal distribution (see NORMS.INV).
  // if(mean === 0 && standardDev === 1){
  // }
  return jStat.normal.inv(probability, mean, standardDev);
}

/**
 * @name NORM.S.DIST
 * @summary Returns the standard normal distribution (has a mean of zero and a standard deviation of one)
 * @param z is the value for which you want the distribution
 * @param cumulative is a logical value for the function to return: the cumulative distribution function = TRUE; the probability density function = FALSE
 */
export function NORM_S_DIST(z: number, cumulative: boolean): number {
  return (cumulative)
    ? jStat.normal.cdf(z, 0, 1)
    : jStat.normal.pdf(z, 0, 1);
}

/**
 * @name NORM.S.INV
 * @summary Returns the inverse of the standard normal cumulative distribution (has a mean of zero and a standard deviation of one)
 * @param probability is a probability corresponding to the normal distribution, a number between 0 and 1 inclusive
 */
export function NORM_S_INV(probability: number): number {
  // If probability <= 0 or if probability >= 1, NORMS.INV returns the #NUM! error value.
  if (probability <= 0 || probability >= 1) return Number.NaN;

  return jStat.normal.inv(probability, 0, 1);
}

/**
 * @summary Returns the Pearson product moment correlation coefficient, r
 * @param array1 is a set of independent values
 * @param array2 is a set of dependent values
 */
export function PEARSON(array1: IRange, array2: IRange): number {
  const a1Length:number = array1.size;
  const [a1, a2] = toEqualArray(array1, array2);

  const xmean:number = jStat.mean(a1);
  const ymean:number = jStat.mean(a2);

  let num:number = 0;
  let den1:number = 0;
  let den2:number = 0;

  for (let i=0; i<a1Length; i++) {
    num += (a1[i] - xmean) * (a2[i] - ymean);
    den1 += Math.pow(a1[i] - xmean, 2);
    den2 += Math.pow(a2[i] - ymean, 2);
  }

  return num / Math.sqrt(den1 * den2);
}

/**
 * @hidden Unimplemented
 * @name PERCENTILE.EXC
 * @summary Returns the k-th percentile of values in a range, where k is in the range 0..1, exclusive
 * @param array is the array or range of data that defines relative standing
 * @param k is the percentile value that is between 0 through 1, inclusive
 */
export function PERCENTILE_EXC(
  array: IRange,
  k: number
): IRange {
  // Returns the k-th percentile of values in a range,
  // where k is in the range 0..1, exclusive.
  return undefined;
}

/**
 * @hidden Unimplemented
 * @name PERCENTILE.INC
 * @summary Returns the k-th percentile of values in a range, where k is in the range 0..1, inclusive
 * @param array is the array or range of data that defines relative standing
 * @param k is the percentile value that is between 0 through 1, inclusive
 */
export function PERCENTILE_INC(
  array: IRange,
  k: number
): IRange {
  // Returns the k-th percentile of values in a range,
  // where k is in the range 0..1, inclusive.
  return undefined;
}

/**
 * @hidden Unimplemented
 * @name PERCENTRANK.EXC
 * @summary Returns the rank of a value in a data set as a percentage (0..1, exclusive) of the data set
 * @param array is the array or range of data with numeric values that defines relative standing
 * @param x is the value for which you want to know the rank
 * @param significance is an optional value that identifies the number of significant digits for the returned percentage
 */
export function PERCENTRANK_EXC(
  array: IRange,
  x: number,
  significance: number=3
): number {
  // Returns the rank of a value in a dat set as a percentage
  // (0...1, exclusive) of the data set.
  return undefined;
}

/**
 * @hidden Unimplemented
 * @name PERCENTRANK.INC
 * @summary Returns the rank of a value in a data set as a percentage (0..1, inclusive) of the data set
 * @param array is the array or range of data with numeric values that defines relative standing
 * @param x is the value for which you want to know the rank
 * @param significance is an optional value that identifies the number of significant digits for the returned percentage
 */
export function PERCENTRANK_INC(
  array: IRange,
  x: number,
  significance: number=3
): number {
  // Returns the rank of a value in a dat set as a percentage
  // (0...1, inclusive) of the data set.
  return undefined;
}

const SQRT2PI = 2.5066282746310002;
/**
 * @summary Returns the value of the density function for a standard normal distribution
 * @param x is the number for which you want the density of the standard normal distribution
 */
export function PHI(x: number): number {
  // If x is a numeric value that is not valid, PHI returns the #NUM! error value.
  return Math.exp(-0.5 * x * x) / SQRT2PI;
}

/**
 * @name POISSON.DIST
 * @summary Returns the Poisson distribution
 * @param x is the number of events
 * @param mean is the expected numeric value, a positive number
 * @param cumulative is a logical value: for the cumulative Poisson probability, use TRUE; for the Poisson probability mass function, use FALSE
 */
export function POISSON_DIST(
  x: number,
  mean: number,
  cumulative: boolean
): number {
  // If x < 0, POISSON.DIST returns the #NUM! error value.
  // If mean < 0, POISSON.DIST returns the #NUM! error value.
  if (x < 0 || mean < 0) return Number.NaN;

  // If x is not an integer, it is truncated.
  x = Math.trunc(x);

  return cumulative
    ? jStat.poisson.cdf(x, mean)
    : jStat.poisson.pdf(x, mean);
}

/**
 * @summary Returns the probability that values in a range are between two limits or equal to a lower limit
 * @param xRange is the range of numeric values of x with which there are associated probabilities
 * @param probRange is the set of probabilities associated with values in X_range, values between 0 and 1 and excluding 0
 * @param lowerLimit is the lower bound on the value for which you want a probability
 * @param upperLimit is the optional upper bound on the value. If omitted, PROB returns the probability that X_range values are equal to Lower_limit
 */
export function PROB(
  xRange: IRange,
  probRange: IRange,
  lowerLimit: number,
  upperLimit?: number
): number {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @name QUARTILE.EXC
 * @summary Returns the quartile of a data set, based on percentile values from 0..1, exclusive
 * @param array is the array or cell range of numeric values for which you want the quartile value
 * @param quart is a number: minimum value = 0; 1st quartile = 1; median value = 2; 3rd quartile = 3; maximum value = 4
 */
export function QUARTILE_EXC(
  array: IRange,
  quart: number
): number {
  // Returns the quartile of a data set, based on percentile values from 0..1, exclusive.
  return undefined;
}

/**
 * @hidden Unimplemented
 * @name QUARTILE.INC
 * @summary Returns the quartile of a data set, based on percentile values from 0..1, inclusive
 * @param array is the array or cell range of numeric values for which you want the quartile value
 * @param quart is a number: minimum value = 0; 1st quartile = 1; median value = 2; 3rd quartile = 3; maximum value = 4
 */
export function QUARTILE_INC(
  array: IRange,
  quart: number
): number {
  // Returns the quartile of a data set, based on percentile values from 0..1, inclusive.
  return undefined;
}

/**
 * @hidden Unimplemented
 * @name RANK.AVG
 * @summary Returns the rank of a number in a list of numbers: its size relative to other values in the list; if more than one value has the same rank, the average rank is returned
 * @param number is the number for which you want to find the rank
 * @param ref is an array of, or a reference to, a list of numbers. Nonnumeric values are ignored
 * @param order is a number: rank in the list sorted descending = 0; rank in the list sorted ascending = any nonzero value
 */
export function RANK_AVG(
  number: number,
  ref: IRange,
  order: number=0
): number {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @name RANK.EQ
 * @summary Returns the rank of a number in a list of numbers: its size relative to other values in the list; if more than one value has the same rank, the top rank of that set of values is returned
 * @param number is the number for which you want to find the rank
 * @param ref is an array of, or a reference to, a list of numbers. Nonnumeric values are ignored
 * @param order is a number: rank in the list sorted descending = 0; rank in the list sorted ascending = any nonzero value
 */
export function RANK_EQ(
  number: number,
  ref: IRange,
  order: number=0
): number {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the square of the Pearson product moment correlation coefficient through the given data points
 * @param knownYs is an array or range of data points and can be numbers or names, arrays, or references that contain numbers
 * @param knownXs is an array or range of data points and can be numbers or names, arrays, or references that contain numbers
 */
export function RSQ(
  knownYs: any[],
  knownXs: any[]
): number {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the skewness of a distribution: a characterization of the degree of asymmetry of a distribution around its mean
 * @param number number1,number2,... are 1 to 255 numbers or names, arrays, or references that contain numbers for which you want the skewness
 */
export function SKEW(
  ...number: IRange[]
): number {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @name SKEW.P
 * @summary Returns the skewness of a distribution based on a population: a characterization of the degree of asymmetry of a distribution around its mean
 * @param number number1,number2,... are 1 to 254 numbers or names, arrays, or references that contain numbers for which you want the population skewness
 */
export function SKEW_P(
  ...number: IRange[]
): number {
  return undefined;
}

/**
 * @summary Returns the slope of the linear regression line through the given data points
 * @param knownYs is an array or cell range of numeric dependent data points and can be numbers or names, arrays, or references that contain numbers
 * @param knownXs iis the set of independent data points and can be numbers or names, arrays, or references that contain numbers
 */
export function SLOPE(
  knownYs: IRange,
  knownXs: IRange
): number {
  const linear = LINEST(knownYs, knownXs);
  return linear[0];
}

/**
 * @summary Returns a normalized value from a distribution characterized by a mean and standard deviation
 * @param x is the value you want to normalize
 * @param mean is the arithmetic mean of the distribution
 * @param standardDev is the standard deviation of the distribution, a positive number
 */
export function STANDARDIZE(
  x: number,
  mean: number,
  standardDev: number
): number {
  // If standardDev ≤ 0, STANDARDIZE returns the #NUM! error value.
  if (standardDev <= 0) return Number.NaN;

  return (x - mean) / standardDev;
}

/**
 * @hidden Unimplemented
 * @name STDEV.P
 * @summary Calculates standard deviation based on the entire population given as arguments (ignores logical values and text)
 * @param number number1,number2,... are 1 to 255 numbers corresponding to a population and can be numbers or references that contain numbers
 */
export function STDEV_P(...number: IRange<number>[]): number {
  return undefined
}

/**
 * @name STDEV.S
 * @summary Estimates standard deviation based on a sample (ignores logical values and text in the sample)
 * @param number number1,number2,... are 1 to 255 numbers corresponding to a sample of a population and can be numbers or references that contain numbers
 */
export function STDEV_S(...number: IRange<number>[]): number {
  const v = VAR_S(...number);
  const result = Math.sqrt(v)
  return result;
}

/**
 * @hidden Unimplemented
 * @summary Estimates standard deviation based on a sample, including logical values and text. Text and the logical value FALSE have the value 0; the logical value TRUE has the value 1
 * @param value value1,value2,... are 1 to 255 values corresponding to a sample of a population and can be values or names or references to values
 */
export function STDEVA(...value: IRange[]): number {
  return undefined;
}

/**
 * @summary Calculates standard deviation based on an entire population, including logical values and text. Text and the logical value FALSE have the value 0; the logical value TRUE has the value 1
 * @param value value1,value2,... are 1 to 255 values corresponding to a population and can be values, names, arrays, or references that contain values
 * @hidden Unimplemented
 */
export function STDEVPA(...value: IRange[]): number {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the standard error of the predicted y-value for each x in a regression
 * @param knownYs is an array or range of dependent data points and can be numbers or names, arrays, or references that contain numbers
 * @param knownXs is an array or range of independent data points and can be numbers or names, arrays, or references that contain numbers
 */
export function STEYX(
  knownYs: any[],
  knownXs: any[]
): number {
  return undefined;
}

/**
 * @name T.DIST
 * @summary Returns the left-tailed Student's t-distribution
 * @param x is the numeric value at which to evaluate the distribution
 * @param degFreedom is an integer indicating the number of degrees of freedom that characterize the distribution
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability density function, use FALSE
 */
export function T_DIST(
  x: number,
  degFreedom: number,
  cumulative: boolean
): number {
  // If degFreedom < 1, T.DIST returns an error value. Deg_freedom needs to be at least 1.
  if (degFreedom < 1) return Number.NaN;

  return cumulative
    ? jStat.studentt.cdf(x, degFreedom)
    : jStat.studentt.pdf(x, degFreedom);
}

/**
 * @name T.DIST.2T
 * @summary Returns the two-tailed Student's t-distribution
 * @param x is the numeric value at which to evaluate the distribution
 * @param degFreedom is an integer indicating the number of degrees of freedom that characterize the distribution
 */
export function T_DIST_2T(
  x: number,
  degFreedom: number
): number {
  // If degFreedom < 1, T.DIST.2T returns the #NUM! error value.
  // If x < 0, then T.DIST.2T returns the #NUM! error value.
  if (degFreedom < 1 || x < 0) return Number.NaN;

  return (1 - jStat.studentt.cdf(x, degFreedom)) * 2;
}

/**
 * @name T.DIST.RT
 * @summary Returns the right-tailed Student's t-distribution
 * @param x is the numeric value at which to evaluate the distribution
 * @param degFreedom is an integer indicating the number of degrees of freedom that characterize the distribution
 */
export function T_DIST_RT(
  x: number,
  degFreedom: number
): number {
  // If degFreedom < 1, T.DIST.RT returns the #NUM! error value.
  if (degFreedom < 1) return Number.NaN;

  return 1 - jStat.studentt.cdf(x, degFreedom);
}

/**
 * @name T.INV
 * @summary Returns the left-tailed inverse of the Student's t-distribution
 * @param probability is the probability associated with the two-tailed Student's t-distribution, a number between 0 and 1 inclusive
 * @param degFreedom is a positive integer indicating the number of degrees of freedom to characterize the distribution
 */
export function T_INV(
  probability: number,
  degFreedom: number
): number {
  // If either argument is nonnumeric, T.INV returns the #VALUE! error value.
  // If probability <= 0 or if probability > 1, T.INV returns the #NUM! error value.
  // If degFreedom < 1, T.INV returns the #NUM! error value.
  if (probability <= 0 || probability > 1 || degFreedom < 1) return Number.NaN;

  // If degFreedom is not an integer, it is truncated.
  degFreedom = degFreedom % 1 === 0 ? degFreedom : Math.trunc(degFreedom);
  return jStat.studentt.inv(probability, degFreedom);
}

/**
 * @name T.INV.2T
 * @summary Returns the two-tailed inverse of the Student's t-distribution
 * @param probability is the probability associated with the two-tailed Student's t-distribution, a number between 0 and 1 inclusive
 * @param degFreedom is a positive integer indicating the number of degrees of freedom to characterize the distribution
 */
export function T_INV_2T(
  probability: number,
  degFreedom: number
): number {
  // If probability <= 0 or if probability > 1, T.INV.2T returns the #NUM! error value.
  // If degFreedom < 1, T.INV.2T returns the #NUM! error value.
  if (probability <= 0 || probability > 1 || degFreedom < 1) return Number.NaN;

  // If degFreedom is not an integer, it is truncated.
  degFreedom = degFreedom % 1 === 0 ? degFreedom : Math.trunc(degFreedom);

  return Math.abs(jStat.studentt.inv(probability / 2, degFreedom));
}

/**
 * @hidden Unimplemented
 * @name T.TEST
 * @summary Returns the probability associated with a Student's t-Test
 * @param array1 is the first data set
 * @param array2 is the second data set
 * @param tails specifies the number of distribution tails to return: one-tailed distribution = 1; two-tailed distribution = 2
 * @param type is the kind of t-test: paired = 1, two-sample equal variance (homoscedastic) = 2, two-sample unequal variance = 3
 */
export function T_TEST(
  array1: IRange,
  array2: IRange,
  tails : number, // 1 or 2
  type: number , // 1, 2, or 3
): number {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns numbers in a linear trend matching known data points, using the least squares method
 * @param knownYs is a range or array of y-values you already know in the relationship y = mx + b
 * @param knownXs is an optional range or array of x-values that you know in the relationship y = mx + b, an array the same size as Known_y's
 * @param newXs is a range or array of new x-values for which you want TREND to return corresponding y-values
 * @param consts is a logical value: the constant b is calculated normally if Const = TRUE; b is set equal to 0 if Const = FALSE
 */
export function TREND(
  knownYs: any[],
  knownXs: any[]=null,
  newXs: any[]=null,
  consts: boolean=true
): number[] {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the mean of the interior portion of a set of data values
 * @param array is the range or array of values to trim and average
 * @param percent is the fractional number of data points to exclude from the top and bottom of the data set
 */
export function TRIMMEAN(
  array: IRange,
  percent: IRange,
): number {
  return undefined;
}

/**
 * @name VAR.P
 * @summary Calculates variance based on the entire population (ignores logical values and text in the population)
 * @param number number1,number2,... are 1 to 255 numeric arguments corresponding to a population
 */
export function VAR_P(...number: IRange<number>[]): number {
  let sigma = 0;
  let count = 0;

  const mean = AVERAGE(...number);
  for (const range of number) {
    for (const value of range.values()) {
      sigma += Math.pow(value - mean, 2);
      count++;
    }
  }

  const result = sigma / count;
  if (isNaN(result)) {
    return FormulaError.BuiltIn.Num as any; // Number.NaN;
  }
  return result;
}

/**
 * @name VAR.S
 * @summary Estimates variance based on a sample (ignores logical values and text in the sample)
 * @param number number1,number2,... are 1 to 255 numeric arguments corresponding to a sample of a population
 */
export function VAR_S(...number: IRange<number>[]): number {
  let sigma = 0;
  let count = 0;

  const mean = AVERAGE(...number);
  for (const range of number) {
    for (const value of range.values({ type: ScalarType.Number, includeMistyped: true })) {
      if (typeof value === 'number') {
        sigma += Math.pow(value - mean, 2);
      }
      count++;
    }
  }
  return sigma / (count - 1);
}

/**
 * @summary Estimates variance based on a sample, including logical values and text. Text and the logical value FALSE have the value 0; the logical value TRUE has the value 1
 * @param value value1,value2,... are 1 to 255 value arguments corresponding to a sample of a population
 */
export function VARA(...value: IRange[]): number {
  let sigma = 0;
  let count = 0;

  const mean = AVERAGEA(...value);
  for (const range of value) {
    for (const value of range.values()) {
      if (typeof value === 'number') {
        sigma += Math.pow(value - mean, 2);
      } else if (value === true) {
        sigma += Math.pow(1 - mean, 2);
      } else {
        sigma += Math.pow(0 - mean, 2);
      }
      count++;
    }
  }
  return sigma / (count - 1);
}

/**
 * @summary Calculates variance based on the entire population, including logical values and text. Text and the logical value FALSE have the value 0; the logical value TRUE has the value 1
 * @param value value1,value2,... are 1 to 255 value arguments corresponding to a population
 */
export function VARPA(...value: IRange[]): number {
  const mean = AVERAGEA(...value);

  let sigma: number = 0;
  let cnt: number = 0;
  for (const range of value) {
    for (const v of range.values()) {
      cnt++;
      if (typeof v === 'number') {
        sigma += Math.pow(v - mean, 2)
      } else if (v === true) {
        sigma += Math.pow(1 - mean, 2)
      } else {
        sigma += Math.pow(0 - mean, 2)
      }
    }
  }
  return sigma / cnt;
}

/**
 * @name WEIBULL.DIST
 * @summary Returns the Weibull distribution
 * @param x is the value at which to evaluate the function, a nonnegative number
 * @param alpha is a parameter to the distribution, a positive number
 * @param beta is a parameter to the distribution, a positive number
 * @param cumulative is a logical value: for the cumulative distribution function, use TRUE; for the probability mass function, use FALSE
 */
export function WEIBULL_DIST(
  x: number,
  alpha: number,
  beta: number,
  cumulative: boolean
): number {
  // If x < 0, WEIBULL.DIST returns the #NUM! error value.
  // If alpha ≤ 0 or if beta ≤ 0, WEIBULL.DIST returns the #NUM! error value.
  if (x < 0 || alpha <= 0 || beta <= 0) return Number.NaN;

  return cumulative
    ? 1 - Math.exp(-Math.pow(x / beta, alpha))
    : Math.pow(x, alpha - 1) * Math.exp(-Math.pow(x / beta, alpha)) * alpha / Math.pow(beta, alpha);
}

/**
 * @name Z.TEST
 * @summary Returns the one-tailed P-value of a z-test
 * @param array is the array or range of data against which to test X
 * @param x is the value to test
 * @param sigma is the population (known) standard deviation. If omitted, the sample standard deviation is used
 */
export function Z_TEST(
  array: IRange,
  x: number,
  sigma: number=0,
): number {
  sigma = sigma || STDEV_S(array);
  const n = array.size;
  return 1 - NORM_S_DIST((AVERAGE(array) - x) / (sigma / Math.sqrt(n)), true)
}
