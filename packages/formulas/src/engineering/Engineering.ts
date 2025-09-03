/* cspell: disable */

/**
 * @summary Tests whether two numbers are equal
 * @param number1 is the first number
 * @param number2 is the second number
 */
export function DELTA(number1: number, number2: number=0): number {
  return number1 === number2 ? 1 : 0;
}

/**
 * @summary Tests whether a number is greater than a threshold value
 * @param number is the value to test against step
 * @param step is the threshold value
 */
export function GESTEP(number: number, step: number=0): number {
  return number >= step ? 1 : 0;
}