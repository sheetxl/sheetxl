/* cspell: disable */
import jStat from 'jstat';

/**
 * @summary Returns the error function
 * @param lowerLimit is the lower bound for integrating ERF
 * @param upperLimit is the upper bound for integrating ERF
 */
export function ERF(lowerLimit: number, upperLimit: number=0): number {
  // TODO - not using upperLimit, need to check if it is needed
  return jStat.erf(lowerLimit);
}

/**
 * @name ERF.PRECISE
 * @summary Returns the error function
 * @param x is the lower bound for integrating ERF.PRECISE
 */
export function ERF_PRECISE(x: number): number {
  // TODO - this is probably not the correct implementation
  return jStat.erf(x);
}

/**
 * @summary Returns the complementary error function
 * @param x is the lower bound for integrating ERF
 */
export function ERFC(x: number): number {
  return jStat.erfc(x);
}