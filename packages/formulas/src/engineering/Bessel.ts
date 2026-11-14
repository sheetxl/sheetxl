/* cspell: disable */
import bessel from 'bessel';

import {
  FormulaContext, FormulaError,
  type AcceptError, type Omittable, type Scalar, type NoLift
} from '@sheetxl/primitives';

import { flushSubnormal } from '../_utils/Arithmetic';

/**
 * The largest ORDER the four Bessel functions answer at; above it the answer is `#NUM!`.
 *
 * @remarks
 * Ten million exactly — an order of `1E7` answers and `1.1E7` does not, on both `BESSELI` and
 * `BESSELJ`. It is a cap on the order alone and not an overflow: the answers on the way up to it
 * are 0, having underflowed a hundred orders earlier.
 *
 * `BESSELK` and `BESSELY` never reach it, because they GROW — they overflow to `#NUM!` around an
 * order of 170 at small `x`, and that boundary moves with `x` (an order of 169 is `#NUM!` at
 * `x = 1.5` and answers at `x = 10`), so it is the arithmetic's rather than a cap. The guard is
 * shared anyway: without it a large order is not a wrong answer but a WALK that never returns,
 * because the series is iterated once per order.
 */
const MaxBesselOrder = 1e7;

/**
 * The largest ARGUMENT `BESSELJ` and `BESSELY` answer at; above it the answer is `#NUM!`.
 *
 * @remarks
 * The bound is exact to the integer: 134217729 answers and 134217730 does not, on both names and whatever the order. It is `2^27 + 1` — one past the
 * bound `SIN`, `COS` and `TAN` carry, which is a coincidence of size and not the same check,
 * since theirs refuses AT `2^27` and this one is still answering there.
 *
 * `BESSELI` and `BESSELY`'s siblings never reach it: `BESSELI` has overflowed to `#NUM!` and
 * `BESSELK` underflowed to 0 long before, both by an argument of 1000.
 */
const MaxBesselArgument = 2 ** 27 + 1;

/**
 * A slot of the four names: a blank CELL is zero, an OMITTED argument is `#N/A`, and an error
 * arrives as a VALUE so that the reads can run LEFT TO RIGHT.
 *
 * @remarks
 * The order matters because the four take their errors as values: `BESSELI("zz",NA())` is
 * `#VALUE!` and not the `#N/A` the second slot would raise, so the coercion of `x` has to
 * run before `n` is looked at.
 */
const besselArgument = (value: Scalar | undefined): number => {
  if (FormulaError.isError(value)) throw value;
  if (value === undefined) throw FormulaError.BuiltIn.NA;
  if (value === null) return 0;
  return FormulaContext.parseAsNumber(value);
};

/**
 * The order as the four names read it: non-negative as written (`BESSELK(1,-0.001)` is #NUM!,
 * not the order 0 it truncates to), truncated, and under the cap.
 */
const besselOrder = (n: number): number => {
  if (n < 0) return Number.NaN;
  const order = Math.trunc(n);
  if (order < 0 || order > MaxBesselOrder) return Number.NaN;
  return order;
};

/**
 * Returns the modified Bessel function In(x).
 * @param x is the value at which to evaluate the function.
 * @param n is the order of the Bessel function.
 */
export function BESSELI(
  x: NoLift<Omittable<AcceptError<Scalar>>>,
  n: NoLift<Omittable<AcceptError<Scalar>>>
): number {
  const value = besselArgument(x); // left to right
  const order = besselOrder(besselArgument(n));
  if (Number.isNaN(order)) return Number.NaN;
  // I is EVEN in `x` at an even order and odd at an odd one — `BESSELI(-10,0)` is `BESSELI(10,0)`
  // and `BESSELI(-10,1)` is its negative. The kernel walks its recurrence upward from a negative
  // argument and comes back with neither.
  const answer = besselI(Math.abs(value), order);
  return (value < 0 && order % 2 === 1) ? -answer : answer;
}

/**
 * I0 at a non-negative argument: a polynomial in `(x/3.75)^2` below 3.75 and in `3.75/x` above
 * it, each good to about seven digits.
 *
 * @remarks
 * The seven digits are the answer's: `BESSELI(30,0)` is 781672297823.98 where I0(30) is
 * 781672297823.87, and every order above the first carries the same factor.
 */
const besselI0 = (x: number): number => {
  if (x < 3.75) {
    const y = (x / 3.75) ** 2;
    return 1.0 + y * (3.5156229 + y * (3.0899424 + y * (1.2067492
      + y * (0.2659732 + y * (0.360768e-1 + y * 0.45813e-2)))));
  }
  const y = 3.75 / x;
  return (Math.exp(x) / Math.sqrt(x)) * (0.39894228 + y * (0.1328592e-1
    + y * (0.225319e-2 + y * (-0.157565e-2 + y * (0.916281e-2
    + y * (-0.2057706e-1 + y * (0.2635537e-1 + y * (-0.1647633e-1
    + y * 0.392377e-2))))))));
};

/** I1 at a non-negative argument, the companion of {@link besselI0}. */
const besselI1 = (x: number): number => {
  if (x < 3.75) {
    const y = (x / 3.75) ** 2;
    return x * (0.5 + y * (0.87890594 + y * (0.51498869 + y * (0.15084934
      + y * (0.2658733e-1 + y * (0.301532e-2 + y * 0.32411e-3))))));
  }
  const y = 3.75 / x;
  let answer = 0.2282967e-1 + y * (-0.2895312e-1 + y * (0.1787654e-1 - y * 0.420059e-2));
  answer = 0.39894228 + y * (-0.3988024e-1 + y * (-0.362018e-2
    + y * (0.163801e-2 + y * (-0.1031555e-1 + y * answer))));
  return answer * (Math.exp(x) / Math.sqrt(x));
};

/**
 * In at a non-negative argument.
 *
 * @remarks
 * Orders 0 and 1 are the two polynomials. Every higher order is a DOWNWARD recurrence started
 * above the order and scaled at the end by I0, which is what keeps it stable where the upward
 * walk loses everything to cancellation — and what gives every order I0's seven digits rather
 * than the recurrence's sixteen: `BESSELI(30,2)` is 730436904437.17 where I2(30) is
 * 730436828561.38.
 */
const besselI = (x: number, order: number): number => {
  if (order === 0) return besselI0(x);
  if (order === 1) return besselI1(x);
  if (x === 0) return 0;
  const twoOverX = 2 / x;
  let above = 0;
  let current = 1;
  let answer = 0;
  for (let j = 2 * (order + Math.trunc(Math.sqrt(40 * order))); j > 0; j--) {
    const below = above + j * twoOverX * current;
    above = current;
    current = below;
    if (Math.abs(current) > 1e10) { // rescaled, so the walk cannot overflow
      answer *= 1e-10;
      current *= 1e-10;
      above *= 1e-10;
    }
    if (j === order) answer = above;
  }
  return answer * (besselI0(x) / current);
};

/**
 * Returns the Bessel function Jn(x).
 * @param x is the value at which to evaluate the function.
 * @param n is the order of the Bessel function.
 */
export function BESSELJ(
  x: NoLift<Omittable<AcceptError<Scalar>>>,
  n: NoLift<Omittable<AcceptError<Scalar>>>
): number {
  const value = besselArgument(x); // left to right
  const order = besselOrder(besselArgument(n));
  if (Number.isNaN(order)) return Number.NaN;
  if (Math.abs(value) > MaxBesselArgument) return Number.NaN;
  return besselJ(value, order);
}

/**
 * J0: a rational function of `x^2` below 8 and the two-series asymptotic form above it.
 *
 * @remarks
 * Above 8 the second coefficient of the cosine series is `-0.1098628267E-2`. The textbook value
 * is `…8627`; the transposed digits are Excel's, and they are what make `BESSELJ(10,0)`
 * -0.2459357644412996 where J0(10) is -0.2459357644513483.
 */
const besselJ0 = (x: number): number => {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const top = 57568490574.0 + y * (-13362590354.0 + y * (651619640.7
      + y * (-11214424.18 + y * (77392.33017 + y * -184.9052456))));
    const bottom = 57568490411.0 + y * (1029532985.0 + y * (9494680.718
      + y * (59272.64853 + y * (267.8532712 + y))));
    return top / bottom;
  }
  const z = 8 / ax;
  const y = z * z;
  const phase = ax - 0.785398164;
  const p = 1.0 + y * (-0.1098628267e-2 + y * (0.2734510407e-4
    + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
  const q = -0.1562499995e-1 + y * (0.1430488765e-3
    + y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934935152e-7)));
  return Math.sqrt(0.636619772 / ax) * (Math.cos(phase) * p - z * Math.sin(phase) * q);
};

/**
 * J1, the companion of {@link besselJ0}.
 *
 * @remarks
 * Above 8 the cosine series carries its third coefficient TWICE — six terms where the textbook
 * has five. That is Excel's too, and it is the whole of the sixth-digit error every order above
 * zero shows there: `BESSELJ(10,1)` is 0.0434722496522542 where J1(10) is 0.0434727461688614.
 */
const besselJ1 = (x: number): number => {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const top = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1
      + y * (-2972611.439 + y * (15704.48260 + y * -30.16036606)))));
    const bottom = 144725228442.0 + y * (2300535178.0 + y * (18583304.74
      + y * (99447.43394 + y * (376.9991397 + y))));
    return top / bottom;
  }
  const z = 8 / ax;
  const y = z * z;
  const phase = ax - 2.356194491;
  const p = 1.0 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (-0.3516396496e-4
    + y * (0.2457520174e-5 + y * -0.240337019e-6))));
  const q = 0.04687499995 + y * (-0.2002690873e-3
    + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  const answer = Math.sqrt(0.636619772 / ax) * (Math.cos(phase) * p - z * Math.sin(phase) * q);
  return x < 0 ? -answer : answer;
};

/**
 * Jn. Orders 0 and 1 are the two approximations; above them the recurrence runs UPWARD from
 * those two where the argument exceeds the order, and DOWNWARD from above the order otherwise,
 * normalized by the sum `J0 + 2(J2 + J4 + …) = 1`.
 */
const besselJ = (x: number, order: number): number => {
  if (order === 0) return besselJ0(x);
  if (order === 1) return besselJ1(x);
  const ax = Math.abs(x);
  if (ax === 0) return 0;
  const twoOverX = 2 / ax;
  let answer: number;
  if (ax > order) {
    let below = besselJ0(ax);
    let current = besselJ1(ax);
    for (let j = 1; j < order; j++) {
      const next = j * twoOverX * current - below;
      below = current;
      current = next;
    }
    answer = current;
  } else {
    const start = 2 * Math.floor((order + Math.floor(Math.sqrt(40 * order))) / 2);
    let even = false;
    let above = 0;
    let current = 1;
    let sum = 0;
    answer = 0;
    for (let j = start; j > 0; j--) {
      const below = j * twoOverX * current - above;
      above = current;
      current = below;
      if (Math.abs(current) > 1e10) { // rescaled, so the walk cannot overflow
        current *= 1e-10;
        above *= 1e-10;
        answer *= 1e-10;
        sum *= 1e-10;
      }
      if (even) sum += current;
      even = !even;
      if (j === order) answer = above;
    }
    answer /= 2 * sum - current;
  }
  return (x < 0 && order % 2 === 1) ? -answer : answer;
};

/**
 * Returns the modified Bessel function Kn(x).
 * @param x is the value at which to evaluate the function.
 * @param n is the order of the function.
 */
export function BESSELK(
  x: NoLift<Omittable<AcceptError<Scalar>>>,
  n: NoLift<Omittable<AcceptError<Scalar>>>
): number {
  const value = besselArgument(x); // left to right
  const order = besselOrder(besselArgument(n));
  if (Number.isNaN(order)) return Number.NaN;
  if (!(value > 0)) return bessel.besselk(value, order);
  // No subnormals, at the two seeds or in the recurrence's product: above x ≈ 705.117 every order
  // is 0, and near 700 the first step's `(2/x)·K1` is lost, so `BESSELK(700,2)` is K0's 4.6697…E-306
  // rather than the true 4.6831…E-306.
  let k0 = flushSubnormal(bessel.besselk(value, 0));
  if (order === 0) return k0;
  let k1 = flushSubnormal(bessel.besselk(value, 1));
  const twoOverX = 2 / value;
  for (let i = 1; i < order; i++) {
    const k2 = flushSubnormal(k1 * i * twoOverX) + k0;
    k0 = k1;
    k1 = k2;
  }
  return k1;
}

/**
 * Returns the Bessel function Yn(x).
 * @param x is the value at which to evaluate the function.
 * @param n is the order of the function.
 */
export function BESSELY(
  x: NoLift<Omittable<AcceptError<Scalar>>>,
  n: NoLift<Omittable<AcceptError<Scalar>>>
): number {
  const value = besselArgument(x); // left to right
  const order = besselOrder(besselArgument(n));
  if (Number.isNaN(order)) return Number.NaN;
  if (Math.abs(value) > MaxBesselArgument) return Number.NaN;
  return bessel.bessely(value, order);
}
