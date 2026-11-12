/*
 * The probability distributions the statistical functions answer from — the thin layer over
 * `SpecialFunctions.ts`, seeded from jStat 1.9.6 (MIT; the notice is in `SpecialFunctions.ts`).
 *
 * The mass functions call `Combinatorics.ts` rather than reaching `n!` and `C(n,k)` through the
 * gamma function: those kernels follow Excel's own accumulation order, and they carry
 * BINOM.DIST further than the closed forms do.
 *
 * The target is Excel. These bodies are free to be replaced by whatever reproduces its answer.
 */
import {
  betaln, betafn, erfc, erfcinv, gammaLogPdf, gammaln, ibeta, ibetaAt, ibetainv, lowRegGamma,
  upRegGamma, gammapinv, StirlingFloor
} from './SpecialFunctions';
import { factorialKernel, binomialKernel } from './Combinatorics';

/* ── continuous ──────────────────────────────────────────────────────────────────── */

export const normalPdf = (x: number, mean: number, std: number): number =>
  Math.exp(-0.5 * Math.log(2 * Math.PI) - Math.log(std) - Math.pow(x - mean, 2) / (2 * std * std));

/**
 * Taken through `erfc` rather than `1 + erf`: below about `-6` standard deviations the latter is
 * one plus a value one ulp short of minus one, so the whole lower tail cancels away to zero
 * where it should carry out to 1E-300.
 */
export const normalCdf = (x: number, mean: number, std: number): number =>
  0.5 * erfc(-(x - mean) / Math.sqrt(2 * std * std));

export const normalInv = (p: number, mean: number, std: number): number =>
  -1.41421356237309505 * std * erfcinv(2 * p) + mean;

export function lognormalPdf(x: number, mu: number, sigma: number): number {
  if (x <= 0) return 0;
  return Math.exp(-Math.log(x) - 0.5 * Math.log(2 * Math.PI) - Math.log(sigma)
    - Math.pow(Math.log(x) - mu, 2) / (2 * sigma * sigma));
}

export function lognormalCdf(x: number, mu: number, sigma: number): number {
  if (x < 0) return 0;
  return 0.5 * erfc(-(Math.log(x) - mu) / Math.sqrt(2 * sigma * sigma));
}

export const lognormalInv = (p: number, mu: number, sigma: number): number =>
  Math.exp(-1.41421356237309505 * sigma * erfcinv(2 * p) + mu);

export function gammaPdf(x: number, shape: number, scale: number): number {
  if (x < 0) return 0;
  if (x === 0 && shape === 1) return 1 / scale;
  // Past the floor the direct form is a difference of terms the size of `shape * ln(shape)` and
  // holds seven digits; `gammaLogPdf` is the same density with that cancellation taken out.
  if (shape >= StirlingFloor) return Math.exp(gammaLogPdf(shape, x / scale)) / scale;
  return Math.exp((shape - 1) * Math.log(x) - x / scale - gammaln(shape) - shape * Math.log(scale));
}

export function gammaCdf(x: number, shape: number, scale: number): number {
  if (x < 0) return 0;
  return lowRegGamma(shape, x / scale);
}

export const gammaInv = (p: number, shape: number, scale: number): number =>
  gammapinv(p, shape) * scale;

export function chisquarePdf(x: number, dof: number): number {
  if (x < 0) return 0;
  return (x === 0 && dof === 2) ? 0.5
    : Math.exp((dof / 2 - 1) * Math.log(x) - x / 2 - (dof / 2) * Math.log(2) - gammaln(dof / 2));
}

export function chisquareCdf(x: number, dof: number): number {
  if (x < 0) return 0;
  return lowRegGamma(dof / 2, x / 2);
}

/** `1 - chisquareCdf`, taken from the tail itself rather than by subtracting it from one. */
export function chisquareCdfUpper(x: number, dof: number): number {
  if (x < 0) return 1;
  return upRegGamma(dof / 2, x / 2);
}

export const chisquareInv = (p: number, dof: number): number => 2 * gammapinv(p, 0.5 * dof);

export function centralFPdf(x: number, df1: number, df2: number): number {
  if (x < 0) return 0;
  if (x === 0 && df1 < 2) return Infinity;
  if (x === 0 && df1 === 2) return 1;
  if (df1 < 512 && df2 < 512) {
    return (1 / betafn(df1 / 2, df2 / 2)!)
      * Math.pow(df1 / df2, df1 / 2)
      * Math.pow(x, (df1 / 2) - 1)
      * Math.pow((1 + (df1 / df2) * x), -(df1 + df2) / 2);
  }
  return Math.exp((df1 / 2) * Math.log(df1 / df2) + ((df1 / 2) - 1) * Math.log(x)
    - ((df1 + df2) / 2) * Math.log(1 + (df1 / df2) * x) - betaln(df1 / 2, df2 / 2));
}

export function centralFCdf(x: number, df1: number, df2: number): number {
  if (x < 0) return 0;
  const denominator = df1 * x + df2;
  return ibetaAt((df1 * x) / denominator, df2 / denominator, df1 / 2, df2 / 2);
}

/**
 * `1 - centralFCdf`, as the incomplete beta's OTHER tail — argument and parameters both swapped,
 * so the small quantity is the one computed. Subtracting the lower tail from one instead loses
 * the whole answer once the tail is under an ulp of one.
 */
export function centralFCdfUpper(x: number, df1: number, df2: number): number {
  if (x < 0) return 1;
  const denominator = df1 * x + df2;
  return ibetaAt(df2 / denominator, (df1 * x) / denominator, df2 / 2, df1 / 2);
}

export const centralFInv = (p: number, df1: number, df2: number): number =>
  df2 / (df1 * (1 / ibetainv(p, df1 / 2, df2 / 2) - 1));

export function studenttPdf(x: number, dof: number): number {
  dof = dof > 1e100 ? 1e100 : dof;
  return (1 / (Math.sqrt(dof) * betafn(0.5, dof / 2)!))
    * Math.pow(1 + ((x * x) / dof), -((dof + 1) / 2));
}

/**
 * The argument is `dof/(dof + x^2)` rather than `(x + sqrt(x^2+dof))/(2 sqrt(x^2+dof))`: the
 * latter is one minus a value the size of the ANSWER, so at `x = 1E7` it arrives as `1 - 2.5E-15`
 * and the tail is gone before the kernel is called. Both spell the same function.
 */
export function studenttCdf(x: number, dof: number): number {
  if (!Number.isFinite(x * x)) return Number.NaN;                 // #NUM! — see studenttCdfUpper
  const half = 0.5 * studenttTail(x, dof);
  return (x > 0) ? 1 - half : half;
}

/**
 * `1 - studenttCdf`, from the tail itself — see {@link studenttCdf} for the argument.
 *
 * An `x` whose square overflows is refused rather than read as the limit. Excel refuses it too
 * (`T.DIST(1E307,5,TRUE)` is `#NUM!` while `T.DIST(2^31,5,TRUE)` is 1), and the boundary is the
 * same one: `x^2` past a double.
 */
export function studenttCdfUpper(x: number, dof: number): number {
  if (!Number.isFinite(x * x)) return Number.NaN;                 // #NUM!
  const half = 0.5 * studenttTail(x, dof);
  return (x > 0) ? half : 1 - half;
}

/** `2 P(T > |x|)` — both the argument and its complement in closed form, for {@link ibetaAt}. */
function studenttTail(x: number, dof: number): number {
  const denominator = dof + x * x;
  return ibetaAt(dof / denominator, (x * x) / denominator, dof / 2, 0.5);
}

export function studenttInv(p: number, dof: number): number {
  let x = ibetainv(2 * Math.min(p, 1 - p), 0.5 * dof, 0.5);
  x = Math.sqrt(dof * (1 - x) / x);
  return (p > 0.5) ? x : -x;
}

/** The last factorial that fits a double, and so the last term either discrete walk can reach. */
const FactorialMax = 170;

/** The negative binomial's mean is `r(1-p)/p`, so a small `p` puts its mass past any fixed walk. */
const NegbinMaxSteps = 100000;

export function poissonPdf(k: number, l: number): number {
  if (l < 0 || (k % 1) !== 0 || k < 0) return 0;
  // The factorial is a walk of `k` steps and cannot hold past 170, so it is not asked above.
  const direct = k <= FactorialMax ? Math.pow(l, k) * Math.exp(-l) / factorialKernel(k) : Infinity;
  if (Number.isFinite(direct)) return direct;
  // The direct form runs out at `k = 171`, where the factorial overflows, and at a large mean,
  // where the power does — both while the mass itself is an ordinary small number. Taking the
  // three factors through logarithms reaches those, and is used ONLY there.
  if (l === 0) return k === 0 ? 1 : 0;
  return Math.exp(k * Math.log(l) - l - gammaln(k + 1));
}

/**
 * The CDF sums the mass function term by term, and adds the terms BACK TO FRONT.
 *
 * `x` is the caller's argument and the mass function divides by `k!`, so the walk answers only
 * while every term is finite: past 170 the factorial overflows and a term is `Infinity`, `NaN`
 * or a silently truncated tail. Where the walk cannot answer, the complementary regularized
 * gamma is the same function in closed form.
 *
 * The ORDER is the one place this differs from the rest of the category, which accumulates
 * forward. It is kept because nothing separates the two orders: only nine of the family's rows
 * move at all and they split between them, and a summation order should not be changed on a
 * coin toss.
 */
export function poissonCdf(x: number, l: number): number {
  if (x < 0) return 0;
  if (x <= FactorialMax) {
    const sumarr: number[] = [];
    for (let k = 0; k <= x; k++) sumarr.push(poissonPdf(k, l));
    if (sumarr.every(Number.isFinite)) {
      let sum = 0;
      for (let i = sumarr.length - 1; i >= 0; i--) sum += sumarr[i]!;
      return sum;
    }
  }
  return 1 - lowRegGamma(Math.floor(x) + 1, l);
}

export const binomialPdf = (k: number, n: number, p: number): number => {
  if (p === 0 || p === 1) return (n * p) === k ? 1 : 0;
  const direct = binomialKernel(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
  if (Number.isFinite(direct)) return direct;
  // The coefficient overflows a double at a few thousand trials while the mass itself is an
  // ordinary small number. Taking the three factors through logarithms reaches those, and is
  // used ONLY where the direct product cannot be formed.
  return Math.exp(gammaln(n + 1) - gammaln(k + 1) - gammaln(n - k + 1)
    + k * Math.log(p) + (n - k) * Math.log(1 - p));
};

/**
 * The upper tail of the incomplete beta, `I_{1-p}(n-x, x+1)`, taken from the small side so a
 * cumulative far into either tail keeps its digits: Excel answers `BINOM.DIST(0,1000,0.5,TRUE)`
 * with the 9.33E-302 the mass has, not with zero.
 */
export function binomialCdf(x: number, n: number, p: number): number {
  if (x < 0) return 0;
  if (x >= n) return 1;
  if (p < 0 || p > 1 || n <= 0) return Number.NaN;
  if (p === 0) return 1;
  if (p === 1) return 0;

  x = Math.floor(x);
  return ibetaAt(1 - p, p, n - x, x + 1);
}

export function negbinPdf(k: number, r: number, p: number): number {
  // Past the 32-bit range the mass underflows to zero, and zero is the answer.
  if (k !== k >>> 0) return 0;
  if (k < 0) return 0;
  const direct = binomialKernel(k + r - 1, r - 1) * Math.pow(1 - p, k) * Math.pow(p, r);
  if (Number.isFinite(direct)) return direct;
  // As for the binomial: the coefficient overflows while the mass is an ordinary number.
  return Math.exp(gammaln(k + r) - gammaln(k + 1) - gammaln(r) + k * Math.log1p(-p) + r * Math.log(p));
}

/**
 * `x` is the caller's argument, so the walk needs both an exit and a fallback: it stops once the
 * tail has underflowed — the mass is unimodal, so a zero term is followed only by zero terms and
 * the sum can no longer move — and hands over to the regularized incomplete beta, the same
 * function in closed form, when a term overflows or the tail has not arrived by `NegbinMaxSteps`.
 * A walk that never saw a NONZERO term hands over too: `p^r` underflows well before the answer
 * does, so an all-zero walk measures the mass function's range and not the distribution.
 */
export function negbinCdf(x: number, r: number, p: number): number {
  if (x < 0) return 0;
  let sum = 0;
  let seen = false;
  const steps = Math.min(x, NegbinMaxSteps);
  for (let k = 0; k <= steps; k++) {
    const term = negbinPdf(k, r, p);
    if (!Number.isFinite(term)) return ibeta(p, r, Math.floor(x) + 1);
    if (term === 0 && seen) return sum;                  // unimodal: a zero tail stays zero
    if (term !== 0) seen = true;
    sum += term;
  }
  if (!seen) return ibeta(p, r, Math.floor(x) + 1);
  return (x <= NegbinMaxSteps) ? sum : ibeta(p, r, Math.floor(x) + 1);
}

export const exponentialPdf = (x: number, rate: number): number =>
  (x < 0 ? 0 : rate * Math.exp(-rate * x));

export const exponentialCdf = (x: number, rate: number): number =>
  (x < 0 ? 0 : 1 - Math.exp(-rate * x));

export function betaPdf(x: number, alpha: number, beta: number): number {
  if (x > 1 || x < 0) return 0;
  if (alpha === 1 && beta === 1) return 1;
  if (alpha < 512 && beta < 512) {
    return (Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1)) / betafn(alpha, beta)!;
  }
  return Math.exp((alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - betaln(alpha, beta));
}

export const betaCdf = (x: number, alpha: number, beta: number): number =>
  ((x > 1 || x < 0) ? ((x > 1) ? 1 : 0) : ibeta(x, alpha, beta));

export const betaInv = (p: number, alpha: number, beta: number): number => ibetainv(p, alpha, beta);

/**
 * Half-width of the confidence interval around a mean, from the normal quantile.
 *
 * The `(1 + h) - 1` round trip is not redundant: it rounds the half-width against a unit
 * magnitude, which moves the answer on most shapes.
 */
export function normalConfidence(alpha: number, standardDev: number, size: number): number {
  const halfWidth = Math.abs(normalInv(alpha / 2, 0, 1) * standardDev / Math.sqrt(size));
  return (1 + halfWidth) - 1;
}

/** The same half-width from Student's t on `size - 1` degrees of freedom. */
export function studenttConfidence(alpha: number, standardDev: number, size: number): number {
  const halfWidth = Math.abs(studenttInv(alpha / 2, size - 1) * standardDev / Math.sqrt(size));
  return (1 + halfWidth) - 1;
}
