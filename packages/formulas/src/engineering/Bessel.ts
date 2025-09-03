/* cspell: disable */
import bessel from 'bessel';

/**
 * @summary Returns the modified Bessel function In(x)
 * @param x is the value at which to evaluate the function
 * @param n is the order of the Bessel function
 */
export function BESSELI(x: number, n: number): number {
  n = Math.trunc(n);
  if (n < 0) return Number.NaN;
  return bessel.besseli(x, n);
}

/**
 * @summary Returns the Bessel function Jn(x)
 * @param x is the value at which to evaluate the function
 * @param n is the order of the Bessel function
 */
export function BESSELJ(x: number, n: number): number {
  n = Math.trunc(n);
  if (n < 0) return Number.NaN;
  return bessel.besselj(x, n);
}

/**
 * @summary Returns the modified Bessel function Kn(x)
 * @param x is the value at which to evaluate the function
 * @param n is the order of the function
 */
export function BESSELK(x: number, n: number): number {
  n = Math.trunc(n);
  if (n < 0) return Number.NaN;
  return bessel.besselk(x, n);
}

/**
 * @summary Returns the Bessel function Yn(x)
 * @param x is the value at which to evaluate the function
 * @param n is the order of the function
 */
export function BESSELY(x: number, n: number): number {
  n = Math.trunc(n);
  if (n < 0) return Number.NaN;
  return bessel.bessely(x, n);
}
