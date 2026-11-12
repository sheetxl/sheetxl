import { FormulaError, type Scalar } from '@sheetxl/primitives';

/**
 * Converts a standard date code into a localized text string.
 * @hidden Unimplemented Japanese.
 * @param number A numeric value representing a date code.
 */
export function DATESTRING(number: number): Scalar {
  // In Japanese Locales: It converts a date into a format like R5.1.1 (representing Reiwa 5, January 1st).
  // In English/Standard Locales: The function is not implemented in the standard Excel global binaries.
  // Consequently, it almost always returns #N/A.
  return FormulaError.BuiltIn.NA!; // built-in errors are always registered
}

/**
 * Converts a number into Japanese Kanji words.
 * @hidden Unimplemented Japanese.
 * @param number A numeric value representing a date code.
 * @param number2 A numeric value representing a date code.
 */
export function NUMBERSTRING(number: number, number2: number): Scalar {
  // TEXT(A1, "[$-ja-JP]ggge.m.d")
  return FormulaError.BuiltIn.NA!; // built-in errors are always registered
}