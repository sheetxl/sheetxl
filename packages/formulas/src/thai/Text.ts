/* cspell: disable */
// Change number to Thai pronunciation string
import { bahttext } from 'bahttext';

/**
 * Converts a number to baht (Thai) text.
 * @param number is the number to convert.
 * @Category Baht
 * @hidden Thai
 */
export function BAHTTEXT(number: number): string {
  try {
    return bahttext(number);
  } catch (e: any) {
    throw Error(`Error in https://github.com/jojoee/bahttext \n${e.toString()}`)
  }
}

// 368	BAHTTEXT	Converts number to Thai Baht text (The only one officially supported globally).
// 369	THAIDAYOFWEEK	Returns the Thai name of the day of the week (THAIDOW).
// 370	THAIDIGIT	Converts Arabic numerals to Thai numerals (1 → ๑).
// 371	THAIMONTHOFYEAR	Returns the Thai name of the month (THAIMOY).
// 372	THAINUMSOUND	Returns the pronunciation/sound of the number in Thai.
// 373	THAINUMSTRING	Converts number to Thai text (similar to BAHTTEXT but without "Baht").
// 374	THAISTRINGLENGTH	Counts length of Thai strings (handling multi-part characters).
// 375	ISTHAIDIGIT	Returns TRUE if the character is a Thai digit.
// 376	ROUNDBAHTDOWN	Rounds a number down to the nearest baht.
// 377	ROUNDBAHTUP	Rounds a number up to the nearest baht.
// 378	THAIYEAR	Converts a Western year to the Thai Buddhist Era (Year + 543).