/* cspell: disable */
// Change number to Thai pronunciation string
import { bahttext } from 'bahttext';

/**
 * @summary Converts a number to baht (Thai) text
 * @param number is the number to convert
 */
export function BAHTTEXT(number: number): string {
  try {
    return bahttext(number);
  } catch (e) {
    throw Error(`Error in https://github.com/jojoee/bahttext \n${e.toString()}`)
  }
}

// '=ISTHAIDIGIT
// '=THAIDIGIT
// '=THAIDOW
// '=THAIMOY
// '=THAINUMSOUND
// '=THAINUMSTRING
// '=THAISTRINGLENGTH
// '=THAIYEAR
