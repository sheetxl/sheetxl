/*
 * The combinatorial kernels — `n!` and `C(n,k)` as EXCEL accumulates them, which is not how the
 * closed forms do.
 *
 * They live here rather than beside FACT and COMBIN because an exported helper in a category
 * directory is a registered formula function, and these have three callers: the two functions
 * themselves, MULTINOMIAL, and the discrete distributions' mass functions.
 */

/**
 * `n!` the way Excel accumulates it: a DESCENDING double product, `n · (n-1) · … · 2`.
 *
 * The order is the whole of the rule. Ascending gives a different double on twenty-two of the
 * integers in range, and the correctly rounded value is a third answer again.
 */
export const factorialKernel = (n: number): number => {
  let product = 1;
  for (let i=n; i>=2; i--) product *= i;
  return product;
};

/** The largest `number` COMBIN accepts: `2^31 - 2`, one short of INT_MAX. */
export const CombinMax = 2147483646;

/**
 * `C(n,k)` as a multiplicative product rather than a ratio of factorials.
 *
 * That is why `COMBIN(171,85)` answers where `FACT(171)` is `#NUM!`, and why the refusal is on
 * the ANSWER rather than the arguments: `COMBIN(1029,514)` is 1.43E308 and `COMBIN(1030,514)` is
 * `#NUM!`. Dividing before multiplying keeps the running value in range, and the smaller of
 * `k` and `n-k` decides the step count — `COMBIN(170,84)` and `COMBIN(170,86)` are the same
 * double, not merely the same number.
 */
export const binomialKernel = (n: number, k: number): number => {
  const steps = Math.min(k, n - k);
  let result = 1;
  for (let i=1; i<=steps; i++) {
    result = result / i * (n - steps + i);
    if (!Number.isFinite(result)) return Number.NaN;
  }
  return result;
};
