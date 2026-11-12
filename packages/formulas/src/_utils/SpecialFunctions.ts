/*
 * Special functions — the log-gamma, error and incomplete gamma/beta kernels the statistical
 * distributions and the engineering error functions are built on.
 *
 * Derived from jStat 1.9.6 (https://github.com/jstat/jstat), MIT licensed:
 *
 *   Copyright (c) 2013 jStat
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of this
 *   software and associated documentation files (the "Software"), to deal in the Software
 *   without restriction, including without limitation the rights to use, copy, modify, merge,
 *   publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
 *   to whom the Software is furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all copies or
 *   substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 *   INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
 *   PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
 *   FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 *   OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 *   DEALINGS IN THE SOFTWARE.
 *
 * This is a SEED, not a fork: only what the formulas call is carried, and there is no upstream
 * to re-sync with. The file is deliberately GENERIC — every body here is ordinary numerical
 * analysis with no Excel semantics in it, which is what makes it shareable. The distributions
 * built on top live in `Distributions.ts`, Excel's own combinatorial accumulation orders in
 * `Combinatorics.ts`, and neither belongs here.
 *
 * **The target is Excel, not jStat.** Every body below is free to be replaced by whatever
 * reproduces Excel's answer; agreement with the library these started life in is not a property
 * worth keeping, and several of the constants still in place are known to be the wrong ones.
 * They are Numerical Recipes' SECOND edition and several are single-precision: `betacf` stops at
 * `|delta - 1| < 3e-7`, {@link ibetainv} and {@link gammapinv} at `1e-8` after ten and twelve
 * Newton steps, {@link gammaln} is a six-coefficient Lanczos, and {@link erfc} is `1 - erf`,
 * which cancels the far tail away rather than computing it. Those four are why the distributions
 * hold eight or nine significant digits where Excel holds fifteen. They are what the library
 * returns until the kernels match Excel's, and no longer than that.
 */

const LanczosCof = [
  57.1562356658629235, -59.5979603554754912, 14.1360979747417471,
  -0.491913816097620199, 0.339946499848118887e-4, 0.465236289270485756e-4,
  -0.983744753048795646e-4, 0.158088703224912494e-3, -0.210264441724104883e-3,
  0.217439618115212643e-3, -0.164318106536763890e-3, 0.844182239838527433e-4,
  -0.261908384015814087e-4, 0.368991826595316234e-5
];

/**
 * Log-gamma. Lanczos with `g = 671/128` and fourteen coefficients.
 *
 * The six-coefficient form this was seeded with holds about ten digits, and every function here
 * reads its answer through an `exp`, so those ten were the ceiling under the whole distribution
 * library — `ibetainv` cannot find a root more accurately than the `ibeta` it is inverting.
 */
export function gammaln(x: number): number {
  let y = x;
  let tmp = x + 5.24218750000000000;
  tmp = (x + 0.5) * Math.log(tmp) - tmp;
  let ser = 0.999999999999997092;
  for (let j = 0; j < 14; j++) ser += LanczosCof[j]! / ++y;
  return tmp + Math.log(2.5066282746310005 * ser / x);
}

/** Gamma, by the rational approximation — `Infinity` past the double's last representable value. */
export function gammafn(x: number): number {
  const p = [
    -1.716185138865495, 24.76565080557592, -379.80425647094563,
    629.3311553128184, 866.9662027904133, -31451.272968848367,
    -36144.413418691176, 66456.14382024054
  ];
  const q = [
    -30.8402300119739, 315.35062697960416, -1015.1563674902192,
    -3107.771671572311, 22538.118420980151, 4755.8462775278811,
    -134659.9598649693, -115132.2596755535
  ];
  let fact: number | false = false;
  let n = 0;
  let xden = 1;
  let xnum = 0;
  let y = x;
  let z: number;
  let res: number;
  if (x > 171.6243769536076) return Infinity;
  if (y <= 0) {
    res = y % 1 + 3.6e-16;
    if (res) {
      fact = (!((y as any) & 1) ? 1 : -1) * Math.PI / Math.sin(Math.PI * res);
      y = 1 - y;
    } else {
      return Infinity;
    }
  }
  const yi = y;
  if (y < 1) {
    z = y++;
  } else {
    z = (y -= n = (y | 0) - 1) - 1;
  }
  for (let i = 0; i < 8; ++i) {
    xnum = (xnum + p[i]!) * z;
    xden = xden * z + q[i]!;
  }
  res = xnum / xden + 1;
  if (yi < y) {
    res /= yi;
  } else if (yi > y) {
    for (let i = 0; i < n; ++i) {
      res *= y;
      y++;
    }
  }
  if (fact) res = fact / res;
  return res;
}

/** The beta function. */
export function betafn(x: number, y: number): number | undefined {
  if (x <= 0 || y <= 0) return undefined;
  return (x + y > 170) ? Math.exp(betaln(x, y)) : gammafn(x) * gammafn(y) / gammafn(x + y);
}

/**
 * `ln G(x) - ((x - 1/2) ln x - x + ln(2pi)/2)` — Stirling's remainder, as its own asymptotic
 * series in `1/x`. Every term is small, so nothing here cancels; it is what lets
 * {@link lgammaDelta} take a DIFFERENCE of two log-gammas without ever forming either at full
 * size. Asked only above {@link StirlingFloor}, where the series is at the double's precision.
 */
const StirlingCof = [1 / 12, -1 / 360, 1 / 1260, -1 / 1680, 1 / 1188, -691 / 360360, 1 / 156];

/** The argument above which {@link stirlerr}'s series is good to the last bit. */
export const StirlingFloor = 30;

function stirlerr(x: number): number {
  const z = 1 / (x * x);
  let s = 0;
  for (let i = StirlingCof.length - 1; i >= 0; i--) s = (s + StirlingCof[i]!) * z;
  return s * x;
}

/**
 * `ln G(x + d) - ln G(x)`, for a large `x` and a `d` that is small beside it.
 *
 * Written out, the two log-gammas share a `(x - 1/2) ln x - x` that is ENORMOUS next to their
 * difference — at `x = 5E9` it is 1E11, whose last bit is already 2E-5 — so subtracting them as
 * computed values leaves five digits. Cancelling that term symbolically first leaves a
 * difference every part of which is the size of the answer.
 */
function lgammaDelta(x: number, d: number): number {
  return d * Math.log(x) + (x + d - 0.5) * Math.log1p(d / x) - d
    + stirlerr(x + d) - stirlerr(x);
}

/**
 * `ln B(x, y)`.
 *
 * `ln G(x) + ln G(y) - ln G(x + y)` is a difference of large numbers whenever either argument is
 * large, and the answer is not large — the loss is total enough to be the whole story behind the
 * F and t families' five-digit plateau at a degrees of freedom of 1E10. Above
 * {@link StirlingFloor} the larger argument is folded into {@link lgammaDelta} instead, which
 * never forms it. Below it the expression is the original one, so nothing else changes.
 */
export const betaln = (x: number, y: number): number => {
  const smaller = (x < y) ? x : y;
  const larger = (x < y) ? y : x;
  if (larger < StirlingFloor) return gammaln(x) + gammaln(y) - gammaln(x + y);
  return gammaln(smaller) - lgammaDelta(larger, smaller);
};

const ERF_COF = [
  -1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2,
  -9.561514786808631e-3, -9.46595344482036e-4, 3.66839497852761e-4,
  4.2523324806907e-5, -2.0278578112534e-5, -1.624290004647e-6,
  1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8,
  6.529054439e-9, 5.059343495e-9, -9.91364156e-10,
  -2.27365122e-10, 9.6467911e-11, 2.394038e-12,
  -6.886027e-12, 8.94487e-13, 3.13092e-13,
  -1.12708e-13, 3.81e-16, 7.106e-15,
  -1.523e-15, -9.4e-17, 1.21e-16,
  -2.8e-17
];

/**
 * The Chebyshev approximation, which computes `erfc(x)` for a NON-NEGATIVE `x` — the quantity
 * both {@link erf} and {@link erfc} are read off, and the one neither may reconstruct from the
 * other. Past about `x = 6` the true value is smaller than an ulp of one, so `1 - erf(x)` is
 * exactly zero while this is not.
 */
function erfcCheb(x: number): number {
  let d = 0;
  let dd = 0;
  const t = 2 / (2 + x);
  const ty = 4 * t - 2;
  for (let j = ERF_COF.length - 1; j > 0; j--) {
    const tmp = d;
    d = ty * d - dd + ERF_COF[j]!;
    dd = tmp;
  }
  return t * Math.exp(-x * x + 0.5 * (ERF_COF[0]! + ty * d) - dd);
}

/** The error function, by Chebyshev approximation. */
export const erf = (x: number): number => (x >= 0) ? 1 - erfcCheb(x) : erfcCheb(-x) - 1;

/** The complementary error function. */
export const erfc = (x: number): number => (x >= 0) ? erfcCheb(x) : 2 - erfcCheb(-x);

/** The inverse of {@link erfc}. */
export function erfcinv(p: number): number {
  if (p >= 2) return -100;
  if (p <= 0) return 100;
  const pp = (p < 1) ? p : 2 - p;
  const t = Math.sqrt(-2 * Math.log(pp / 2));
  let x = -0.70711 * ((2.30753 + t * 0.27061) / (1 + t * (0.99229 + t * 0.04481)) - t);
  for (let j = 0; j < 2; j++) {
    const err = erfc(x) - pp;
    x += err / (1.12837916709551257 * Math.exp(-x * x) - x * err);
  }
  return (p < 1) ? x : -x;
}

/**
 * The lower regularized incomplete gamma, `P(a, x)`.
 *
 * The iteration count is a formula rather than a convergence test — both branches simply run
 * `ITMAX` times. The cap is sized from the shape, so both also stop as soon as the accumulator
 * has stopped moving; without that a large shape walks the cap one term at a time for no gain
 * (a shape of 1e9 takes ten seconds).
 *
 * Past {@link TemmeShape} neither branch is asked at all — see {@link temmeQ}.
 */
export const lowRegGamma = (a: number, x: number): number => regGamma(a, x, false);

/**
 * `Q(a, x) = 1 - P(a, x)`, on the branch that does not cancel.
 *
 * The continued fraction computes `Q` and the series computes `P`, so spelling either one as
 * `1 -` the other throws the smaller of the two away — for a far tail that is the entire answer.
 */
export const upRegGamma = (a: number, x: number): number => regGamma(a, x, true);

/**
 * The shape past which the series needs more terms than a double has digits and the continued
 * fraction has not started converging — the two meet at `x ~ a`, which is exactly where neither
 * works. {@link temmeQ} is asked instead. Chosen where its own next term falls under an ulp
 * (see there); below it the classical pair still answers, so nothing else changes.
 */
const TemmeShape = 1e8;

/**
 * `Q(a, x)` by Temme's uniform asymptotic expansion — the form Excel uses; its leading term alone
 * gives `GAMMA.DIST(1E10,1E10,1,TRUE)` exactly.
 *
 * ```
 *   Q(a, x) = erfc(eta sqrt(a/2))/2 + exp(-a eta^2/2)/sqrt(2 pi a) * (C0(eta) + C1(eta)/a + ...)
 *   eta = sign(l - 1) sqrt(2 (l - 1 - ln l)),  l = x/a
 * ```
 *
 * `eta` and `C0 = 1/(l-1) - 1/eta` both read as zero over zero as `l` approaches one, which is
 * the case that matters most, so both are taken from `w`, the series
 * `2 (u - ln(1+u))/u^2 - 1` in `u = l - 1`: `eta = u sqrt(1+w)` and `C0 = (w/u) / (r (r+1))`
 * for `r = sqrt(1+w)`. Nothing in either is a difference of two nearly equal numbers.
 *
 * Only `C0` is carried. `C1` tends to `-1/540`, so what it would add is under
 * `1/(540 a sqrt(2 pi a))` — below an ulp of the answer for every `a` past {@link TemmeShape},
 * and the reason that is where the threshold sits.
 */
/**
 * `(2 (u - ln(1+u))/u^2 - 1) / u`, the series both {@link temmeQ} and {@link gammaLogPdf} are
 * written in terms of. It is finite at `u = 0` (where it is `-2/3`), and taking it as a series
 * there is what keeps `u - ln(1+u)` — a difference that loses everything as `u` goes to zero —
 * out of both of them.
 */
function wOverU(u: number): number {
  if (Math.abs(u) < 0.03) {
    let s = 0;
    for (let j = 14; j >= 0; j--) s = s * u + 2 * ((j % 2 === 0) ? -1 : 1) / (j + 3);
    return s;
  }
  return (2 * (u - Math.log1p(u)) / (u * u) - 1) / u;
}

/**
 * `ln` of the `Gamma(a, 1)` density at `x`, written so that nothing in it cancels.
 *
 * The direct spelling `(a-1) ln x - x - ln G(a)` is a sum of terms the size of `a ln a` — 1.6E8
 * at a shape of 1E7 — that has to come out near zero, so it holds seven digits there whatever
 * `ln G` is asked. Folding Stirling's form for `ln G(a)` in symbolically leaves
 *
 * ```
 *   -a (u - ln(1+u)) - ln(1+u) - ln(a)/2 - ln(2 pi)/2 - stirlerr(a),   u = x/a - 1
 * ```
 *
 * whose every term is the size of the answer. It is Excel's form: `GAMMA.DIST(1E7,1E7,1,FALSE)`
 * is exactly the value this returns.
 */
export function gammaLogPdf(a: number, x: number): number {
  const u = x / a - 1;
  const w = wOverU(u) * u;
  return -a * u * u * (1 + w) / 2 - Math.log1p(u)
    - 0.5 * Math.log(a) - 0.5 * Math.log(2 * Math.PI) - stirlerr(a);
}

function temmeQ(a: number, x: number): number {
  const u = x / a - 1;
  const wu = wOverU(u);
  const w = wu * u;
  const r = Math.sqrt(1 + w);
  const y = a * u * u * (1 + w) / 2;                        // a eta^2 / 2, without squaring eta
  return 0.5 * erfc(Math.sign(u) * Math.sqrt(y))
    + Math.exp(-y) / Math.sqrt(2 * Math.PI * a) * (wu / (r * (r + 1)));
}

function regGamma(a: number, x: number, upper: boolean): number {
  if (x < 0 || a <= 0) return Number.NaN;
  if (a >= TemmeShape) {
    const q = temmeQ(a, x);
    return upper ? q : 1 - q;
  }

  const aln = gammaln(a);
  const ITMAX = -~(Math.log((a >= 1) ? a : 1 / a) * 8.5 + a * 0.4 + 17);

  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let i = 1; i <= ITMAX; i++) {
      const previous = sum;
      sum += del *= x / ++ap;
      if (sum === previous) break;
    }
    const p = sum * Math.exp(-x + a * Math.log(x) - aln);
    return upper ? 1 - p : p;
  }

  let b = x + 1 - a;
  let c = 1 / 1.0e-30;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= ITMAX; i++) {
    const previous = h;
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    c = b + an / c;
    d = 1 / d;
    h *= d * c;
    if (h === previous) break;
  }

  const q = h * Math.exp(-x + a * Math.log(x) - aln);
  return upper ? q : 1 - q;
}

/**
 * The Newton steps either inverse may take. Both stop on an ulp of `x`, so this bounds only the
 * approach; the seeded ten and twelve steps at a tolerance of `1e-8` were what held the inverses
 * to eight digits while the forward functions held fifteen.
 */
const NewtonMax = 100;

/** The inverse of {@link lowRegGamma} in its second argument. */
export function gammapinv(p: number, a: number): number {
  const EPS = 4 * Number.EPSILON;
  const a1 = a - 1;
  const gln = gammaln(a);
  let x: number;
  let lna1 = 0;
  let afac = 0;
  // The ends are the quantile's own limits, not a bracket for the search to stop at.
  if (p >= 1) return Infinity;
  if (p <= 0) return 0;
  if (a > 1) {
    lna1 = Math.log(a1);
    afac = Math.exp(a1 * (lna1 - 1) - gln);
    const pp = (p < 0.5) ? p : 1 - p;
    const t = Math.sqrt(-2 * Math.log(pp));
    x = (2.30753 + t * 0.27061) / (1 + t * (0.99229 + t * 0.04481)) - t;
    if (p < 0.5) x = -x;
    x = Math.max(1e-3, a * Math.pow(1 - 1 / (9 * a) - x / (3 * Math.sqrt(a)), 3));
  } else {
    const t = 1 - a * (0.253 + a * 0.12);
    if (p < t) x = Math.pow(p / t, 1 / a);
    else x = 1 - Math.log(1 - (p - t) / (1 - t));
  }

  for (let j = 0; j < NewtonMax; j++) {
    if (x <= 0) return 0;
    const err = lowRegGamma(a, x) - p;
    let t: number;
    if (a > 1) t = afac * Math.exp(-(x - a1) + a1 * (Math.log(x) - lna1));
    else t = Math.exp(-x + a1 * Math.log(x) - gln);
    const u = err / t;
    x -= (t = u / (1 - 0.5 * Math.min(1, u * ((a - 1) / x - 1))));
    if (x <= 0) x = 0.5 * (x + t);
    if (Math.abs(t) < EPS * x) break;
  }

  return x;
}

/**
 * The number of Lentz steps the incomplete beta's continued fraction may take. It stops on its
 * own the moment the ratio reaches one, so this only bounds the case that never gets there.
 */
const BetaCfMax = 1000;

/**
 * The continued fraction of the incomplete beta, by modified Lentz's method.
 *
 * The stop is an ulp of the ratio. The single-precision `3e-7` it was seeded with put a floor
 * under every F and t answer at about seven digits — visible wherever a body asked for eight.
 */
export function betacf(x: number, a: number, b: number): number {
  const fpmin = Number.MIN_VALUE / Number.EPSILON;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;

  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= BetaCfMax; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1.0) <= Number.EPSILON) break;
  }

  return h;
}

/**
 * The regularized incomplete beta, `I_x(a, b)`.
 *
 * The front factor goes through {@link betaln}, which does not cancel at a large argument.
 */
export const ibeta = (x: number, a: number, b: number): number => ibetaAt(x, 1 - x, a, b);

/**
 * `I_x(a, b)` where the caller supplies `1 - x` as well as `x`.
 *
 * A caller that has both in closed form has a far better `1 - x` than the subtraction does: an
 * `x` of `dof/(dof + t^2)` is `1 - 2.25E-10` at a degrees of freedom of 1E10, and recovering
 * that complement by subtracting leaves six of its digits, which is the whole answer on this
 * branch. {@link ibeta} passes the subtraction, which is all there is to pass when `x` is what
 * the caller was given.
 */
export function ibetaAt(x: number, cx: number, a: number, b: number): number {
  if (x < 0 || x > 1) return Number.NaN;
  if (x < (a + 1) / (a + b + 2)) return ibetaFront(x, cx, a, b) * betacf(x, a, b) / a;
  return 1 - ibetaFront(cx, x, b, a) * betacf(cx, b, a) / b;
}

/**
 * `p^a q^b / B(a, b)`, the factor in front of either branch's continued fraction, for a `q` the
 * caller states is `1 - p`.
 *
 * `ln q` is read off whichever of the two is the SMALL one: below a half, `q` is within an ulp
 * of one and `log1p(-p)` is the only accurate spelling; at or above it, `q` carries the answer's
 * digits and is used as given.
 */
function ibetaFront(p: number, q: number, a: number, b: number): number {
  if (p === 0 || p === 1) return 0;
  const lnq = (p < 0.5) ? Math.log1p(-p) : Math.log(q);
  return Math.exp(a * Math.log(p) + b * lnq - betaln(a, b));
}

/** The inverse of {@link ibeta} in its first argument. */
export function ibetainv(p: number, a: number, b: number): number {
  // A parameter whose log-gamma overflows is refused, not answered. The stable {@link betaln}
  // would carry it — `B(2, 1E307)` is an ordinary `-1414` — but Excel refuses there
  // (`BETA.INV(0.4,2,1E307,0,1)` is `#NUM!` where a beta of 1E10 answers). The log-gamma
  // overflow is the boundary taken here.
  if (!Number.isFinite(gammaln(a)) || !Number.isFinite(gammaln(b))) return Number.NaN;
  const EPS = 4 * Number.EPSILON;
  const a1 = a - 1;
  const b1 = b - 1;
  let x: number;
  let t: number;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  if (a >= 1 && b >= 1) {
    const pp = (p < 0.5) ? p : 1 - p;
    t = Math.sqrt(-2 * Math.log(pp));
    x = (2.30753 + t * 0.27061) / (1 + t * (0.99229 + t * 0.04481)) - t;
    if (p < 0.5) x = -x;
    const al = (x * x - 3) / 6;
    const h = 2 / (1 / (2 * a - 1) + 1 / (2 * b - 1));
    const w = (x * Math.sqrt(al + h) / h)
      - (1 / (2 * b - 1) - 1 / (2 * a - 1)) * (al + 5 / 6 - 2 / (3 * h));
    x = a / (a + b * Math.exp(2 * w));
  } else {
    const lna = Math.log(a / (a + b));
    const lnb = Math.log(b / (a + b));
    t = Math.exp(a * lna) / a;
    const u = Math.exp(b * lnb) / b;
    const w = t + u;
    if (p < t / w) x = Math.pow(a * w * p, 1 / a);
    else x = 1 - Math.pow(b * w * (1 - p), 1 / b);
  }
  const afac = -betaln(a, b);
  for (let j = 0; j < NewtonMax; j++) {
    if (x === 0 || x === 1) return x;
    const err = ibeta(x, a, b) - p;
    t = Math.exp(a1 * Math.log(x) + b1 * Math.log1p(-x) + afac);
    const u = err / t;
    x -= (t = u / (1 - 0.5 * Math.min(1, u * (a1 / x - b1 / (1 - x)))));
    if (x <= 0) x = 0.5 * (x + t);
    if (x >= 1) x = 0.5 * (x + t + 1);
    if (Math.abs(t) < EPS * x && j > 0) break;
  }
  return x;
}
