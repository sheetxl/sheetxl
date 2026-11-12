import { type FormulaError } from './FormulaError';
import { type IRichData } from './IRichData';

/**
 * The fundamental value type of the spreadsheet engine.
 *
 * `Scalar` is what cells hold and what formula functions receive and return.
 * It covers every native spreadsheet type — numbers (including dates, which
 * are stored as serial numbers), strings, booleans, errors, rich data objects,
 * and blank (`null`).
 *
 * Use `Scalar` wherever a value could be any cell-compatible type. When you
 * need to accept a JavaScript `Date` at an API boundary, use {@link InteropScalar}
 * instead.
 *
 * @remarks
 * Dates are not a distinct `Scalar` variant — they are numbers with a format
 * applied. `FormulaContext.parseAsDate` / `toSerialDate` convert between the
 * two representations.
 *
 * @see {@link InteropScalar} for a version that includes `Date`.
 * @see {@link ScalarType} for the companion enum that identifies which variant a value is.
 */
export type Scalar = number | boolean | string | FormulaError.Known | IRichData | null;

export namespace Scalar {
  /**
   * The most characters a text scalar (and therefore a cell) can hold.
   */
  export const MAX_TEXT_LENGTH = 32767;

  /**
   * The most significant digits a number parsed FROM TEXT can carry.
   */
  export const MAX_SIGNIFICANT_DIGITS = 15;

  /**
   * Applies the 15-digit entry rule to numeric text: every significand digit past the
   * 15th becomes `0`, so the text parses to the double a cell stores.
   *
   * @param text Numeric text in any accepted form — signed, grouped, percent,
   * currency-affixed, or scientific. The scan is locale-blind: only digit
   * characters count toward significance (separators pass through untouched),
   * leading zeros carry none, and the scan stops at an exponent marker so `E5`
   * keeps its magnitude. Excess digits are zeroed rather than dropped so the
   * text's shape (decimal places, grouping) survives for format inference.
   *
   * @remarks
   * Callers apply this to every text→number path and to nothing else. It is
   * truncation, not rounding: `1234567890.123456789` stores `…345`, never `…346`.
   */
  export function truncateNumberText(text: string): string {
    const length = text.length;
    if (length <= MAX_SIGNIFICANT_DIGITS) return text; // cannot hold more than 15 digits
    let significant = 0;
    let out: string[] | null = null;
    for (let i = 0; i < length; i++) {
      const code = text.charCodeAt(i);
      if (code >= 0x30 && code <= 0x39) { // '0'-'9'
        if (significant === 0 && code === 0x30) continue; // leading zeros are not significant
        significant++;
        if (significant > MAX_SIGNIFICANT_DIGITS) {
          (out ??= text.split(''))[i] = '0';
        }
      } else if ((code === 0x45 || code === 0x65) && significant > 0) { // 'E' | 'e'
        break; // exponent digits are magnitude, not significand
      }
    }
    return out === null ? text : out.join('');
  }

  /**
   * The smallest magnitude a stored number can have: the smallest normal double. A smaller one is
   * stored as `0`.
   */
  export const MIN_NUMBER = 2.2250738585072014e-308;

  /**
   * Applies the stored-number floor to a number entering a workbook — typed, parsed from text, written
   * through the API or loaded from a file: a magnitude below {@link MIN_NUMBER} becomes `0`.
   */
  export function flushSubnormal(value: number): number {
    return (value > -MIN_NUMBER && value < MIN_NUMBER) ? 0 : value;
  }

  /**
   * Whether numeric text is inside the range accepted as a number, judged from the text as
   * written rather than the double it parses to.
   *
   * @param text Numeric text in any accepted form, as {@link truncateNumberText} takes it. Only
   * digits, `decimal` and an exponent marker are read.
   * @param decimal The decimal separator `text` is written with.
   * @returns `false` when the leading significant digit sits outside `1E-309` … `1E+307`
   * (`1E-310`, `0.00001E-305`, `1E+308`); for a zero mantissa, when its scale — exponent less
   * fraction digits — is outside ±308 (`0E-309`, `0.0E-308` and `0E+309`, but not `0E-308`,
   * `000E-308` or `0.0E+309`). Text out of range is not a number: a formula literal will not
   * commit, `VALUE` is `#VALUE!` and typed entry stays text.
   */
  export function isNumberTextInRange(text: string, decimal: string = '.'): boolean {
    const length = text.length;
    // A plain expansion needs 309 characters to reach either bound; only an exponent gets there sooner.
    if (length < 309 && text.indexOf('E') < 0 && text.indexOf('e') < 0) return true;
    const decimalCode = decimal.charCodeAt(0);
    let seenDigit = false;
    let seenPoint = false;
    let significant = false;
    let intDigits = 0; // from the first significant digit to the point
    let leadingFractionZeros = 0;
    let fractionDigits = 0;
    let i = 0;
    for (; i < length; i++) {
      const code = text.charCodeAt(i);
      if (code >= 0x30 && code <= 0x39) { // '0'-'9'
        seenDigit = true;
        if (seenPoint) {
          fractionDigits++;
          if (!significant) {
            if (code === 0x30) leadingFractionZeros++;
            else significant = true;
          }
        } else if (significant || code !== 0x30) {
          significant = true;
          intDigits++;
        }
      } else if (code === decimalCode) {
        seenPoint = true;
      } else if ((code === 0x45 || code === 0x65) && seenDigit) { // 'E' | 'e'
        break;
      }
    }
    let exponent = 0;
    if (i < length) {
      let j = i + 1;
      let negative = false;
      const sign = text.charCodeAt(j);
      if (sign === 0x2D) { negative = true; j++; } // '-'
      else if (sign === 0x2B) j++; // '+'
      let digits = 0;
      for (; j < length; j++) {
        const code = text.charCodeAt(j);
        if (code < 0x30 || code > 0x39) break;
        exponent = exponent * 10 + (code - 0x30);
        digits++;
      }
      if (digits === 0) return true; // not an exponent; not this rule's to refuse
      if (negative) exponent = -exponent;
    }
    if (significant) {
      const lead = intDigits > 0 ? intDigits - 1 : -(leadingFractionZeros + 1);
      const magnitude = lead + exponent;
      return magnitude >= -309 && magnitude <= 307;
    }
    const scale = exponent - fractionDigits;
    return scale >= -308 && scale <= 308;
  }

  /**
   * Encodings of `ScalarType` for persistence.
   */
  export type JSONType = 'n' | 's' | 'b' | 'e' | 'r' | 'z';

  /**
   * A value encoded as a number with an associated type.
   */
  export interface JSONTypedValue {
    t: JSONType; // If the type is null then the value is ignored. Generally nulls are not persisted.
    /**
     * The number, string id, error code or boolean flag; for `'r'`, the rich data's own JSON
     * (`IRichData.JSON`), which its registered kind reads back.
     */
    v: number | IRichData.JSON;
  }

  /**
   * JSON values whose type is implied by their JavaScript type.
   *
   * @remarks
   * What a string means is up to the container: a worksheet stores the id of the string in its
   * strings collection, while an external link cache stores the string itself.
   */
  export type JSONUnTypedValue = number | boolean | string;

  /**
   * For persisting a single scalar value and its type.
   */
  export type JSON = JSONUnTypedValue | JSONTypedValue;
}

/**
 * Represents a cell value in JavaScript, including `Date` for convenience.
 *
 * Extends `Scalar` to support `Date`.
 *
 * @remarks
 * ** IMPORTANT** Spreadsheets store dates internally as serial numbers (SerialDates) to optimize calculation performance. These are integer values representing
 * the number of days since either January 1, 1900, or January 1, 1904, depending on the container's settings.
 *
 * For type-safe date retrieval consider using the method, which returns null if the cell value is not a valid date.
 *
 * @see
 * Refer to the following resources for more details:
 * * {@link https://support.microsoft.com/en-us/office/date-systems-in-excel-e7fe7167-48a9-4b96-bb53-5612a800b487 | Date systems in Excel}
 * * {@link https://learn.microsoft.com/en-us/dotnet/api/system.datetime.tooadate?view=net-8.0 | DateTime.ToSerialDate Method}
 */
export type InteropScalar = Scalar | Date;
