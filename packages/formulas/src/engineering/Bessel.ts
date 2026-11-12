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

/** The order as the four names read it: truncated, non-negative, and under the cap. */
const besselOrder = (n: number): number => {
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
  const answer = bessel.besseli(Math.abs(value), order);
  return (value < 0 && order % 2 === 1) ? -answer : answer;
}

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
  return bessel.besselj(value, order);
}

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
