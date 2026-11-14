/* cspell: disable */
import {
  Scalar, FormulaContext, FormulaError, ScalarType, ValueKind, WildCard,
  type IRange, type IReferenceRange, type AcceptError, type Flatten, type Omittable, type Repeating
} from '@sheetxl/primitives';

import { readFirstOrMembers } from '../_utils/FirstCell';
import { COUNT_EPSILON, excelCount } from '../_utils/Arithmetic';
import { toFullWidth, toHalfWidth } from '../_utils/CharWidth';

/**
 * The whitespace {@link NUMBERVALUE}'s scanner drops, ANYWHERE in the text — space, tab, CR, LF.
 *
 * @remarks
 * A no-break space is deliberately NOT here: it is not whitespace to the scanner, so it survives
 * the scan and is then refused by the number parser.
 */
const NUMBERVALUE_WHITESPACE: ReadonlySet<number> = new Set([0x20, 0x09, 0x0d, 0x0a]);

/**
 * The text ceiling shared with every other text-to-number path -- longer than this is #VALUE!
 * before anything is parsed.
 *
 * @remarks
 * It is on the INPUT, not on what the scan produces: `REPT(" ",300)&"1"` is #VALUE! even though
 * the scan would drop all three hundred spaces and hand over a bare "1".
 */
const NUMBERVALUE_MAX_LENGTH = 255;

/**
 * Converts a string to full-width characters to half-width. Uses the double-byte character set (DBCS).
 * @deprecated DBCS
 * @param text is a text or a reference to a cell containing text.
 *
 * @remarks
 * Returns the text unchanged unless the workbook's language uses a double-byte character set —
 * see {@link DBCS}.
 */
export function ASC(text: string): string {
  return isDBCSLanguage() ? toHalfWidth(text) : text;
}

/**
 * Returns a text representation of an array.
 * @param array the array to represent as text.
 * @param format 0 for relaxed format, 1 for strict format.
 */
export function ARRAYTOTEXT(
  array: IRange,
  format: number=0
): string | null {
  format = Math.floor(format);
  if (format !== 0 && format !== 1) {
    throw FormulaError.BuiltIn.Value;
  }
  const strict = format === 1;
  /*
   * A single value is not rendered the way a member is. An error MEMBER becomes its label
   * (`ARRAYTOTEXT(BE1:BE3)` is "x, #DIV/0!, z"), but an error handed in on its own PROPAGATES, and
   * a blank CELL on its own is #VALUE! rather than the empty string — where VALUETOTEXT spells
   * both. A blank ARRAY member on its own is still a member: `MAKEARRAY(1,1,LAMBDA(r,c,A1))` and
   * `CHOOSECOLS(A1:B1,1)` give "" (strict "{}"), as two blanks give ", ".
   */
  if (array.size === 1) {
    const only = array.getValueAt(0, 0);
    if (only !== null && FormulaError.isError(only)) throw only;
    if (only === null) {
      if ((array as IReferenceRange).isIReferenceRange === true) throw FormulaError.BuiltIn.Value;
      return strict ? '{}' : '';
    }
  }

  let results: string | null = null;
  // relaxed
  if (!strict) {
    if (array.size === 1) {
      return VALUETOTEXT(array.getValueAt(0, 0), format);
    }
    const { rows, columns } = array.getShape();
    const parts: string[] = [];
    for (let i=0; i<rows; i++) {
      for (let j=0; j<columns; j++) {
        parts.push(VALUETOTEXT(array.getValueAt(i, j), format));
      }
    }
    return parts.join(', ');
  }

  // strict — over the SHAPE, as relaxed is: blank members are members (`{;}` for two blank rows).
  const { rows, columns } = array.getShape();
  results = '{';
  for (let i=0; i<rows; i++) {
    for (let j=0; j<columns; j++) {
      results += VALUETOTEXT(array.getValueAt(i, j), format);
      if (j < columns - 1) {
        results += ',';
      }
    }
    if (i < rows - 1) {
      results += ';';
    }
  }
  if (strict) {
    results += '}';
  }
  return results;
}

/**
 * Returns the character specified by the code number from the character set for your computer.
 * @param number is a number between 1 and 255 specifying which character you want.
 */
export function CHAR(number: number): string {
  /*
   * The code is a Windows-1252 byte, as desktop Excel reads it: CHAR(128) is the euro sign and
   * CHAR(149) a bullet. The five codes 1252 leaves unassigned (129, 141, 143, 144, 157) are
   * themselves.
   *
   * The range is checked after the code is read, and the code is one of the SHIFTED counts
   * (`excelCount`): CHAR(255.9) is "ÿ" but CHAR(255.9999999) is #VALUE!, because it counts as 256.
   * UNICHAR does not shift — `UNICHAR(0.9999999)` is #VALUE! where `CHAR(0.9999999)` is the first
   * control character.
   */
  const code = excelCount(number);
  if (!(code >= 1 && code <= 255)) // negated so a NaN falls out here rather than downstream
    throw FormulaError.BuiltIn.Value;
  return String.fromCharCode(_CP1252_TO_UNICODE.get(code) ?? code);
}

/**
 * Removes all nonprintable characters from text.
 * @param text is the text you want to clean.
 */
export function CLEAN(text: string): string {
  // Both control blocks, C0 and C1. CHAR never makes a C1 (its 128-159 are 1252 punctuation), but
  // UNICHAR and typed text can.
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x1F\x80-\x9F]/g, '');
}

/**
 * Returns a numeric code for the first character in a text string, in the Windows-1252 character
 * set.
 * @param text is the text for which you want the code of the first character.
 */
export function CODE(text: string): number {
  // The inverse of CHAR: a 1252 byte. A code unit below 256 is itself, 1252's punctuation is its
  // byte (`CODE("€")` is 128), and anything the page cannot hold is 63, the code of "?" — an
  // astral character's surrogate and a combining mark included.
  if (text.length === 0)
    throw FormulaError.BuiltIn.Value;
  const unit = text.charCodeAt(0);
  if (unit < 256) return unit;
  return _UNICODE_TO_CP1252.get(unit) ?? 63;
}

/** Windows-1252's 0x80-0x9F, where it differs from Latin-1: byte → UTF-16 code unit. */
const _CP1252_TO_UNICODE: ReadonlyMap<number, number> = new Map([
  [128, 0x20AC], [130, 0x201A], [131, 0x0192], [132, 0x201E], [133, 0x2026], [134, 0x2020],
  [135, 0x2021], [136, 0x02C6], [137, 0x2030], [138, 0x0160], [139, 0x2039], [140, 0x0152],
  [142, 0x017D], [145, 0x2018], [146, 0x2019], [147, 0x201C], [148, 0x201D], [149, 0x2022],
  [150, 0x2013], [151, 0x2014], [152, 0x02DC], [153, 0x2122], [154, 0x0161], [155, 0x203A],
  [156, 0x0153], [158, 0x017E], [159, 0x0178]
]);

const _UNICODE_TO_CP1252: ReadonlyMap<number, number> = new Map(
  [..._CP1252_TO_UNICODE].map(([byte, unit]): [number, number] => [unit, byte])
);

/**
 * Concatenates a list or range of text strings.
 * @param text are 1 to 252 text strings or ranges to be joined.
 */
export function CONCAT(text: Repeating<IRange<string>, 254>): string {
  let result: string = '';
  for (const range of text) {
    for (const value of range.values<string>()) {
      result += value;
      if (result.length > Scalar.MAX_TEXT_LENGTH) throw FormulaError.BuiltIn.Calc;
    }
  }
  return result;
}

/**
 * Treats each CONCATENATE argument exactly like an `&` operand: NumPy-style broadcast
 * (singleton dimensions replicate), misaligned cells become #N/A, and error members stay
 * per-cell. Mirrors `_optionsBroadcastConcat` in the sdk's `Operators.ts`.
 */
const _optionsBroadcastConcat: IRange.BroadcastOptions = {
  type: ScalarType.String,
  coerce: [ScalarType.Boolean, ScalarType.Number],
  onError: 'value',
  misalignValue: FormulaError.BuiltIn.NA
};

/**
 * Joins several text strings into one text string.
 * @param text is the first text string or range to be joined.
 * @category Compatibility
 *
 */
// A bare error at an argument is a VALUE here: the call lifts over its ranges and the error
// broadcasts into every position (`CONCATENATE(A1:A3,1/0)` is three rows of #DIV/0!).
export function CONCATENATE(text: AcceptError<IRange>[]): Scalar {
  let result: IRange = FormulaContext.createRange(1, 1, '');
  for (const arg of text) {
    // A raw error broadcasts like the one value it is.
    const range = FormulaError.isError(arg) ? FormulaContext.createRange(1, 1, arg) : arg;
    result = result.broadcast<Scalar>(range, (a: Scalar, b: Scalar): Scalar => {
      if (a !== null && FormulaError.isError(a)) return a;
      if (b !== null && FormulaError.isError(b)) return b;
      const combined = ((a as string) ?? '') + ((b as string) ?? '');
      if (combined.length <= Scalar.MAX_TEXT_LENGTH) return combined;
      // The limit still counts code UNITS (see the header note), but the cut must not land inside a
      // surrogate pair — half a pair is a lone surrogate, which no XML escaping can carry.
      let cut = Scalar.MAX_TEXT_LENGTH;
      const last = combined.charCodeAt(cut - 1);
      const next = combined.charCodeAt(cut);
      if (last >= 0xD800 && last <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF) cut--;
      return combined.slice(0, cut);
    }, _optionsBroadcastConcat);
  }
  // A 1×1 answer is the SCALAR it holds — `TYPE(CONCATENATE("a","b"))` is 2, not 64;
  // only a genuinely lifted call answers an array.
  if (result.getRowCount() === 1 && result.getColumnCount() === 1) {
    return result.getValueAt(0, 0) ?? '';
  }
  return result as unknown as Scalar;
}

/**
 * Detects the language of a given text.
 * @hidden Unimplemented Connectivity
 * @param text is the text to detect the language for.
 */
export function DETECTLANGUAGE(text: string): Scalar {
  // https://learn.microsoft.com/en-us/connectors/translatorv2/
  // TODO - use MS language service for Excel compatibility or AI hook?
  return FormulaError.BuiltIn.NA;
}

/**
 * Changes half-width characters to full-width characters. Uses the double-byte character set (DBCS).
 * @deprecated DBCS
 * @param text is a text or a reference to a cell containing text.
 *
 * @remarks
 * Only a language that uses a double-byte character set — Japanese, Chinese or Korean — has two
 * widths to convert between. Under any other language this returns the text unchanged.
 */
export function DBCS(text: string): string {
  return isDBCSLanguage() ? toFullWidth(text) : text;
}

/**
 * Converts a number to text in currency format.
 * @param number is the number to convert.
 * @param decimals is the number of digits to the right of the decimal point.
 */
export function DOLLAR(
  number: number,
  decimals: number=2
): string {
  decimals = Math.trunc(decimals);
  if (decimals > MAX_SPELLED_DECIMALS) throw FormulaError.BuiltIn.Value;
  number = roundLikeExcel(number, decimals < 0 ? decimals : Math.min(decimals, 15));
  if (decimals < 0) {
    decimals = 0;
    number = number || 0; // a zero rounded to the LEFT is unsigned: `DOLLAR(-1,-1)` is `$0`
  }
  const runtime = FormulaContext.getRuntime();
  const currency = runtime.getLocaleProfile().currencySymbol;
  // Format codes are canonical; the renderer substitutes the locale's separators.
  const decimalPart = decimals > 0 ? `.${'0'.repeat(decimals)}` : '';
  const negativeSection = `(${currency}#,##0${decimalPart})`;
  // A negative that rounds to zero is still spelled negative — `DOLLAR(-0.004)` is `($0.00)` — and
  // the format engine would read the -0 the rounding leaves as plain zero.
  const formatText = Object.is(number, -0) ? negativeSection : `${currency}#,##0${decimalPart}_);${negativeSection}`;
  if (spelledLength(number, decimals, true, currency.length) > MAX_SPELLED_LENGTH) throw FormulaError.BuiltIn.Value;
  return FormulaContext.getNumberFormat(formatText, number)!.trim(); // well-formed literal format; never null
}

/**
 * Checks whether two text strings are exactly the same, and returns TRUE or FALSE. EXACT is case-sensitive.
 * @param text1 is the first text string.
 * @param text2 is the second text string.
 *
 * @remarks
 * Both sides are rendered as text before comparing, so `EXACT(1,"1")` is TRUE and
 * `EXACT(TRUE,"TRUE")` is TRUE, while a blank cell equals the empty string. The comparison is by
 * code unit and does no Unicode normalization: a composed character and its decomposed spelling
 * look identical and are not equal.
 */
export function EXACT(
  text1: string,
  text2: string
): boolean {
  return text1 === text2;
}

/**
 * Returns the starting position of one text string within another text string. FIND is case-sensitive.
 * @param findText Returns the starting position of one text string within another text string. FIND is case-sensitive.
 * @param withinText is the text you want to search.
 * @param startNum specifies the character at which to start the search. The first character in withinText is character number 1.
 *
 * @remarks
 * Case-sensitive, and wildcards are literal here — `FIND("*","a*b")` is 2 — which is the
 * difference from SEARCH. Positions are in code points (UTF-16 units under compatibility version
 * 1), so they compose with LEN and MID over astral text. `startNum` may be one past the end of the text, which matters only for an empty
 * `findText`: that matches wherever it starts and reports it (`FIND("","hello",6)` is 6), while a
 * real one simply finds nothing. Outside that bound, and when the text is not found, the answer is
 * #VALUE!. A fractional `startNum` is shifted before truncating, as LEFT's count is.
 */
export function FIND(
  findText: string,
  withinText: string,
  startNum: number=1
): number {
  startNum = excelCount(startNum);
  const astral = countsByCodePoint(withinText);
  const length = astral ? codePointLength(withinText) : withinText.length;
  // LEN + 1, one further than there is text; SEARCH's bound is LEN.
  if (startNum < 1 || startNum > length + 1)
    throw FormulaError.BuiltIn.Value;
  const from = astral ? unitOffsetOf(withinText, startNum - 1) : startNum - 1;
  const res = withinText.indexOf(findText, from);
  if (res === -1)
    throw FormulaError.BuiltIn.Value;
  return astral ? codePointIndexOf(withinText, res) + 1 : res + 1;
}

/**
 * Finds the starting position of one text string with another text string. FINDB is case-sensitive. Use with double-byte characters.
 * @deprecated DBCS
 * @param findText is the text you want to find.
 * @param withinText is the text you want to search.
 * @param startNum is the position in withinText to start searching.
 *
 * @remarks
 * {@link FIND} with its positions and its start counted in UTF-16 units, which differs only where
 * the text holds an astral character.
 */
export function FINDB(
  findText: string,
  withinText: string,
  startNum: number=1
): number {
  // Positions and bounds in code UNITS (see LENB): `FINDB("b","a" & UNICHAR(128512) & "b")` is 4
  // where FIND says 3. Everything else is FIND's.
  startNum = excelCount(startNum);
  if (startNum < 1 || startNum > withinText.length + 1)
    throw FormulaError.BuiltIn.Value;
  const res = withinText.indexOf(findText, startNum - 1);
  if (res === -1)
    throw FormulaError.BuiltIn.Value;
  return res + 1;
}

/**
 * Rounds a number to the specified number of decimals and returns the result as text with or without commas
 * @param number is the number you want to round and convert to text.
 * @param decimals is the number of digits to the right of the decimal point.
 * @param noCommas is a logical value: do not display commas in the returned text = TRUE; do display commas in the returned text = FALSE.
 */
export function FIXED(
  number: number,
  decimals: Omittable<number>=2,
  noCommas: boolean=false
): string {
  decimals = Math.trunc(decimals);
  if (decimals > MAX_SPELLED_DECIMALS) throw FormulaError.BuiltIn.Value;
  // The rounding is the FUNCTION's, not the format's: a format rounds the double it is handed, and
  // the function rounds the number first (see `roundLikeExcel`). A negative `decimals` rounds to the LEFT
  // of the point and then spells no decimals at all, at any magnitude.
  number = roundLikeExcel(number, decimals < 0 ? decimals : Math.min(decimals, 15));
  if (decimals < 0) decimals = 0;
  // Format codes are canonical; the renderer substitutes the locale's separators.
  const comma = noCommas ? '' : '#,';
  const decimalPart = decimals > 0 ? `.${'0'.repeat(decimals)}` : '';
  const formatText = `${comma}##0${decimalPart}`;
  if (spelledLength(number, decimals, !noCommas, 0) > MAX_SPELLED_LENGTH) throw FormulaError.BuiltIn.Value;
  return FormulaContext.getNumberFormat(formatText, number)!.trim(); // well-formed literal format; never null
}

/**
 * Concatenates elements of an array or range with a delimiter.
 * @param delimiter The delimiter to place between values.
 * @param value The array or range to join.
 * @category Sheets
 */
export function JOIN(delimiter: string, value: IRange<string>): Scalar {
  // One delimiter, not TEXTJOIN's cycling list: this is the Google Sheets function, and there it
  // takes a single separator.
  return TEXTJOIN([delimiter], true, [value]);
}

/**
 * Returns the specified number of characters from the start of a text string.
 * @param text is the text string from which you want to extract characters.
 * @param numChars specifies how many characters you want LEFT to extract.
 *
 * @remarks
 * A character is a CODE POINT, so an astral character is one and the cut never splits it. A
 * negative count is #VALUE! at any magnitude (`-1E-9` included); a count of zero, or one that
 * rounds down to zero, is the empty string; a count past the end is the whole text, with no upper
 * limit — where MID has one. A fractional count is shifted by a small constant before truncating,
 * which is why `LEFT("hello",4.9999999)` is the whole word and `LEFT("hello",4.999999)` is "hell".
 */
export function LEFT(
  text: string,
  numChars: number=1
): string {
  // The sign is decided on the RAW value — `-1E-9` is #VALUE! where its narrowed truncation would
  // be a harmless 0 — and the count on the narrowed one (see `excelCount`).
  if (numChars < 0)
    throw FormulaError.BuiltIn.Value;
  numChars = excelCount(numChars);
  if (!hasSurrogatePair(text)) {
    if (numChars > text.length)
      return text;
    return text.slice(0, numChars);
  }
  return text.slice(0, unitOffsetOf(text, numChars));
}

/**
 * Returns the leftmost numBytes characters from text. Uses double-byte characters.
 * @deprecated DBCS
 * @param text is the text string from which you want to extract characters.
 * @param numBytes is the number of bytes to extract.
 */
export function LEFTB(
  text: string,
  numBytes: number=1
): string {
  return LEFT(text, numBytes);
}

/**
 * Returns the number of characters in a text string.
 * @param text is the text whose length you want to find. Spaces count as characters.
 *
 * @remarks
 * Counts CODE POINTS, so an astral character counts once; under compatibility version 1 it counts
 * UTF-16 units, so the same character counts twice. Numbers and booleans are rendered first,
 * in the same General form a cell shows (`LEN(1/3)` is 17, `LEN(TRUE)` is 4), and a blank cell is
 * 0. An unpaired high surrogate at the very end of the text counts as nothing — it is half a
 * character; one anywhere else counts.
 */
export function LEN(text: string): number {
  // The slow path is taken for a trailing HIGH surrogate as well as for a pair, because that one
  // is not counted either (see `codePointLength`) — and a string can end in one without holding a
  // pair at all, which is what MIDB produces.
  return RE_COUNTS_BY_CODE_POINT.test(text) && countsCharacters() ? codePointLength(text) : text.length;
}

/**
 * Returns the number of bytes in a text string. Uses double-byte characters.
 * @param text is the text string from which you want to extract characters.
 *
 * @remarks
 * Counts the UTF-16 units the text is stored in, which is one per character for every alphabet a
 * single-byte language has — and two for an astral character, so `LENB` and {@link LEN} disagree
 * there even outside a DBCS language.
 */
export function LENB(text: string): number {
  // NOT LEN, even under a single-byte language. The B functions count the units a DBCS string is
  // stored in, and a JavaScript string is UTF-16: an astral character is two of them, so
  // `LENB(UNICHAR(128512))` is 2 where `LEN` is 1.
  return text.length;
}

/**
 * Converts all letters in a text string to lowercase.
 * @param text is the text you want to convert to lowercase. Characters in Text that are not letters are not changed.
 */
export function LOWER(text: string): string {
  return mapCase(text, false);
}

/**
 * Returns the characters from the middle of a text string, given a starting position and length.
 * @param text is the text string from which you want to extract characters.
 * @param startNum is the position of the first character you want to extract.
 * @param numChars specifies how many characters to return from Text.
 *
 * @remarks
 * A character is a CODE POINT, as in LEFT; under compatibility version 1 it is a UTF-16 unit, and
 * the cut can return half of an astral character. The two counts are read from the double as they stand —
 * LEFT's `4.9999999`-is-five shift does not happen here (`MID("hello",0.9999999,1)` is #VALUE!) —
 * and both are judged before truncation, so a `startNum` under 1 or a negative `numChars` is
 * #VALUE! even where truncation would have made them 0. A start past the end is the empty string
 * rather than an error. Excel additionally refuses counts above its 32-bit internals (a `numChars`
 * past 2^31-1, a `startNum` past 2^31); we have no such limit and answer.
 */
export function MID(
  text: string,
  startNum: number,
  numChars: number
): Scalar {
  // The domain is decided BEFORE truncation, so a `numChars` of −0.9 is #VALUE! rather than the −0
  // it truncates to.
  if (startNum < 1 || numChars < 0) return FormulaError.BuiltIn.Value; // throw FormulaError.BuiltIn.Value;
  startNum = Math.trunc(startNum);
  numChars = Math.trunc(numChars);
  if (!countsByCodePoint(text)) {
    if (startNum > text.length)
      return '';
    return text.slice(startNum - 1, startNum + numChars - 1);
  }
  const start = unitOffsetOf(text, startNum - 1);
  if (start >= text.length)
    return '';
  return text.slice(start, unitOffsetOf(text, startNum - 1 + numChars));
}

/**
 * Returns characters from the middle of a text string. Uses double-byte characters.
 * @deprecated DBCS
 * @param text is the text string from which you want to extract characters.
 * @param startNum is the position of the first character you want to extract.
 * @param numBytes is the number of bytes to extract.
 *
 * @remarks
 * Positions and counts are in UTF-16 units where {@link MID}'s are characters, so a cut can land
 * inside an astral character and return half of one — as Excel's does. Otherwise MID's rules.
 */
export function MIDB(
  text: string,
  startNum: number,
  numBytes: number
): Scalar {
  /*
   * Indexes by code UNIT, where MID indexes by code point (see LENB). The two differ only on an
   * astral character, and there MIDB really does cut a surrogate pair in half:
   * `MIDB("a" & UNICHAR(128512) & "b",2,1)` is a lone high surrogate — a string whose LEN is 0 and
   * whose LENB is 1 — and re-joining the halves restores the character.
   */
  if (startNum < 1 || numBytes < 0) return FormulaError.BuiltIn.Value;
  startNum = Math.trunc(startNum);
  numBytes = Math.trunc(numBytes);
  if (startNum > text.length) return '';
  return text.slice(startNum - 1, startNum - 1 + numBytes);
}

/**
 * Converts text to number in a locale-independent manner.
 * @param text is the text string you want to convert.
 * @param decimalSeparator is the character that separates the integer part from the decimal part of the number.
 * @param groupSeparator is the character that separates groups of thousands.
 */
export function NUMBERVALUE(
  text: string,
  decimalSeparator?: string,
  groupSeparator?: string
): Scalar {

  // An EMPTY separator is #VALUE! even for empty text, so this is ahead of the empty-text answer.
  if (decimalSeparator?.length === 0 || groupSeparator?.length === 0) throw FormulaError.BuiltIn.Value;
  if (text.length > NUMBERVALUE_MAX_LENGTH) throw FormulaError.BuiltIn.Value;
  if (text.length === 0) return 0;

  const runtime = FormulaContext.getRuntime();
  const profile = runtime.getLocaleProfile();
  const decimal = decimalSeparator !== undefined ? decimalSeparator[0] : profile.decimal;
  let group = groupSeparator !== undefined ? groupSeparator[0] : profile.group;
  if (decimal === group) {
    // Given explicitly, a collision is refused; arrived at by default, the group steps aside.
    if (groupSeparator !== undefined) throw FormulaError.BuiltIn.Value;
    group = profile.decimal;
  }

  const scanned: string[] = [];
  let seenDecimal = false;
  let at = 0;
  while (at < text.length) {
    if (NUMBERVALUE_WHITESPACE.has(text.charCodeAt(at))) {
      at += 1;
    } else if (!seenDecimal && text.startsWith(group, at)) {
      at += group.length; // a group separator BEFORE the decimal is thousands punctuation
    } else if (text.startsWith(decimal, at)) {
      seenDecimal = true;
      scanned.push(profile.decimal); // rewritten to what `parseAsNumber` will be reading
      at += decimal.length;
    } else {
      const codePoint = String.fromCodePoint(text.codePointAt(at)!);
      scanned.push(codePoint);
      at += codePoint.length;
    }
  }
  // TRAILING percent signs, and they STACK: "3.5%%" is 0.00035 where `VALUE` refuses a second one.
  let percents = 0;
  while (scanned.length > 0 && scanned[scanned.length - 1] === '%') {
    scanned.pop();
    percents += 1;
  }
  // Nothing but whitespace is zero, the same answer as empty text.
  if (scanned.length === 0) return 0;

  let value = FormulaContext.parseAsNumber(scanned.join(''));
  for (let i = 0; i < percents; i++) {
    value = value / 100;
  }
  return value;
}

/**
 * Converts the first letter of each word in a text string to uppercase.
 * @param text is the text string you want to convert.
 */
export function PROPER(text: string): string {
  /*
   * Word boundaries are Unicode-aware — an accented letter is a letter, so it neither starts a new
   * word nor gets capitalized mid-word. The case mapping is `mapCase` rather than JavaScript's,
   * so a sharp s does not become two letters and an astral letter is left alone.
   */
  text = mapCase(text, false);
  return text.replace(/(^|\P{L})(\p{L})/gu, (_match, boundary, letter) => boundary + mapCase(letter, true));
}

/**
 * Replaces part of a text string with a different text string.
 * @param oldText is the text string to be changed.
 * @param startNum is the position of the first character you want to replace.
 * @param numChars is the number of characters to replace.
 * @param newText is the text string that will replace oldText.
 */
export function REPLACE(
  oldText: string,
  startNum: number,
  numChars: number,
  newText: string
): Scalar {
  /*
   * Both positions are shifted before truncating (`excelCount`), which MID does not do:
   * `REPLACE("hello",0.9999999,1,"X")` replaces the first character where
   * `MID("hello",0.9999999,1)` is #VALUE!. The count's SIGN is judged on the SHIFTED value, so a
   * `numChars` of −1E-9 is a harmless zero where −0.9 is #VALUE! — LEFT, whose count is shifted
   * too, judges the sign on the raw value and refuses −1E-9.
   */
  if (numChars + COUNT_EPSILON < 0) return FormulaError.BuiltIn.Value;
  startNum = excelCount(startNum);
  numChars = excelCount(numChars);
  if (startNum < 1) return FormulaError.BuiltIn.Value;
  if (!countsByCodePoint(oldText))
    return oldText.slice(0, startNum - 1) + newText + oldText.slice(startNum - 1 + numChars);
  return oldText.slice(0, unitOffsetOf(oldText, startNum - 1)) + newText +
    oldText.slice(unitOffsetOf(oldText, startNum - 1 + numChars));
}

/**
 * Replaces part of a text string with a different text string using the number of bytes. Uses the double-byte character set (DBCS).
 * @deprecated DBCS
 * @param oldText is the text string to be changed.
 * @param startNum is the position of the first character you want to replace.
 * @param numBytes is the number of bytes to replace.
 * @param newText is the text string that will replace oldText.
 */
export function REPLACEB(
  oldText: string,
  startNum: number,
  numBytes: number,
  newText: string
): Scalar {
  // Positions and counts in code UNITS, like MIDB and for the same reason (see LENB): the cut can
  // land inside an astral character and leave half of one behind, as MIDB's does.
  if (numBytes + COUNT_EPSILON < 0) return FormulaError.BuiltIn.Value;
  startNum = excelCount(startNum);
  numBytes = excelCount(numBytes);
  if (startNum < 1) return FormulaError.BuiltIn.Value;
  return oldText.slice(0, startNum - 1) + newText + oldText.slice(startNum - 1 + numBytes);
}

/**
 * Repeats text a given number of times.
 * @param text is the text you want to repeat.
 * @param numberTimes is the number of times you want to repeat text.
 */
export function REPT(
  text: string,
  numberTimes: number
): Scalar {
  numberTimes = Math.floor(numberTimes);
  if (numberTimes < 0) return FormulaError.BuiltIn.Value;
  if (text.length * numberTimes > Scalar.MAX_TEXT_LENGTH) return FormulaError.BuiltIn.Value;
  return text.repeat(numberTimes);
}

/**
 * Returns the specified number of characters from the end of a text string.
 * @param text is the text string that contains the characters you want to extract.
 * @param numChars specifies how many characters you want to extract.
 *
 * @remarks
 * LEFT's rules, from the other end: a code point is the unit, a negative count is #VALUE!, a count
 * past the end is the whole text, and a fractional count is shifted before truncating.
 */
export function RIGHT(
  text: string,
  numChars: number=1
): string {
  if (numChars < 0) throw FormulaError.BuiltIn.Value;
  // Truncated BEFORE the cut, not by the cut: `slice` truncates the offset it is handed, and for a
  // right cut that offset is `len - numChars`, which rounds a fractional count the wrong way.
  numChars = excelCount(numChars);
  if (!hasSurrogatePair(text)) {
    const len = text.length;
    if (numChars > len)
      return text;
    return text.slice(len - numChars);
  }
  const len = codePointLength(text);
  if (numChars >= len)
    return text;
  return text.slice(unitOffsetOf(text, len - numChars));
}

/**
 * Returns the rightmost numBytes characters from text. Uses double-byte characters.
 * @param text is the text string from which you want to extract characters.
 * @param numBytes is the number of bytes to extract.
 */
export function RIGHTB(
  text: string,
  numBytes: number=1
): string {
  return RIGHT(text, numBytes);
}

/**
 * Returns the number of the character at which a specific character or text string is first found, reading left to right (not case-sensitive).
 * @param findText is the text you want to find.
 * @param withinText is the text in which you want to search for findText.
 * @param startNum is the character number in withinText, counting from the left, at which you want to start searching.
 *
 * @remarks
 * FIND's case-insensitive, wildcard-aware half: `?` matches any one character INCLUDING a line
 * break, `*` any run, and `~` escapes those two and itself. A `~` before anything else is dropped
 * rather than matched, so `SEARCH("~b","abc")` is 2. Unlike FIND, `startNum` must be within the
 * text — so an empty `withinText` is always #VALUE!, and `SEARCH("","hello",6)` is too where FIND
 * answers 6. Case-insensitivity follows Windows' case table rather than Unicode's full folding: it
 * folds the letterlike symbols (a KELVIN SIGN matches `k`, a capital sharp S matches `ß`) but not
 * a MICRO SIGN to `μ` or a dotted capital `İ` to `i`.
 */
export function SEARCH(
  findText: string,
  withinText: string,
  startNum: number=1
): number {
  startNum = excelCount(startNum);
  const astral = countsByCodePoint(withinText);
  const length = astral ? codePointLength(withinText) : withinText.length;
  // LEN, where FIND's bound is LEN + 1.
  if (startNum < 1 || startNum > length) throw FormulaError.BuiltIn.Value;

  // Compiled through the wildcard compiler ALWAYS, not only when a `*` or `?` is present: `~` is
  // part of the pattern language whether or not there is a wildcard to escape, and an unescaped
  // one is dropped (`SEARCH("~b","abc")` is 2).
  const findTextRegex = WildCard.toRegex(foldLetterlike(findText), 'i');
  const from = astral ? unitOffsetOf(withinText, startNum - 1) : startNum - 1;
  // The fold is one code unit for one code unit, so an offset into the folded copy addresses the
  // original — which a real case mapping would not (`İ` lower-cases to two units).
  const res = foldLetterlike(withinText).slice(from).search(findTextRegex);
  if (res === -1) throw FormulaError.BuiltIn.Value;
  return astral ? codePointIndexOf(withinText, from + res) + 1 : res + startNum;
}

/**
 * Returns the number of the character at which a specific character or text string is first found, reading left to right (not case-sensitive). Uses the double-byte character set (DBCS).
 * @deprecated DBCS
 * @param findText is the text you want to find.
 * @param withinText is the text in which you want to search for findText.
 * @param startBytes is the character number in withinText, counting from the left, at which you want to start searching.
 *
 * @remarks
 * {@link SEARCH} with its positions and its start counted in UTF-16 units, which differs only
 * where the text holds an astral character.
 */
export function SEARCHB(
  findText: string,
  withinText: string,
  startBytes: number=1
): number {
  // SEARCH in code UNITS (see LENB). A `?` already matches one unit rather than one character in
  // both — `SEARCH("a?b","a" & UNICHAR(128512) & "b")` is #VALUE! — so only the reported
  // position and the bound move.
  startBytes = excelCount(startBytes);
  if (startBytes < 1 || startBytes > withinText.length) throw FormulaError.BuiltIn.Value;
  const findTextRegex = WildCard.toRegex(foldLetterlike(findText), 'i');
  const res = foldLetterlike(withinText).slice(startBytes - 1).search(findTextRegex);
  if (res === -1) throw FormulaError.BuiltIn.Value;
  return res + startBytes;
}

/**
 * Splits text around a specified delimiter.
 * @param text The text to split.
 * @param delimiter The character or string to split around.
 * @param splitByEach Whether to split around each character in delimiter individually. Default TRUE.
 * @param removeEmptyText Whether to remove empty strings from results. Default TRUE.
 * @category Sheets
 */
export function SPLIT(
  text: string,
  delimiter: string,
  splitByEach: boolean = true,
  removeEmptyText: boolean = true
): Scalar[][] {
  const delimiters = splitByEach
    ? delimiter.split('')       // each character is its own delimiter
    : [delimiter];              // treat the whole string as one delimiter

  return _textSplit(text, delimiters, [], removeEmptyText, 0, () => FormulaError.BuiltIn.NA!);
}

/**
 * Replaces existing text with new text in a text string.
 * @param text is the text or the reference to a cell containing text in which you want to substitute characters.
 * @param oldText is the existing text you want to replace. If the case of oldText does not match the case of text, SUBSTITUTE will not replace the text.
 * @param newText is the text you want to replace oldText with.
 * @param instanceNum specifies which occurrence of oldText you want to replace. If omitted, every instance of oldText is replaced.
 */
export function SUBSTITUTE(
  text: string,
  oldText: string,
  newText: string,
  // Declared `any` rather than `number` because Excel REFUSES a boolean here — `SUBSTITUTE(...,
  // TRUE)` is #VALUE! where `LEFT("hello",TRUE)` is "h" — and a declared number would have been
  // coerced to 1 before the body could see it. Numeric text is still accepted through
  // `parseAsNumber`, so `"42"` and `" 42 "` both read as 42.
  instanceNum?: Scalar
): Scalar { // string
  // `instanceNum` is read BEFORE the empty-`oldText` shortcut — `SUBSTITUTE("hello","","Z",0)` is
  // #VALUE!, not the text back — and is shifted like FIND's start, so `0.9999999` is a valid first
  // instance.
  let instance = -1;
  if (instanceNum !== undefined) {
    // A blank cell is #VALUE! rather than the absent slot: only leaving the argument off entirely
    // replaces every occurrence.
    if (instanceNum === null) return FormulaError.BuiltIn.Value!;
    instance = excelCount(FormulaContext.parseAsNumber(instanceNum));
    if (instance <= 0) return FormulaError.BuiltIn.Value!;
  }

  if (!text || !oldText) return text;

  let result = text;
  let currentIndex = 0;
  let count = 0;

  while ((currentIndex = result.indexOf(oldText, currentIndex)) !== -1) {
    ++count;
    if (count === instance || instance === -1) {
      result = result.substring(0, currentIndex) + newText + result.substring(currentIndex + oldText.length);
      // but bail here so a widening replace over a near-limit string can't balloon before the backstop sees it.
      if (result.length > Scalar.MAX_TEXT_LENGTH) return FormulaError.BuiltIn.Value!;
      if (instance !== -1) break;
      currentIndex += newText.length;
    } else {
      // Counting for `instanceNum` advances ONE character rather than one match, so overlapping
      // candidates each count: the second "aa" of "aaaa" starts at position 2, and instance 2
      // replaces there. Replacing ALL of them is the non-overlapping scan above.
      currentIndex += 1;
    }
  }
  return result;
}

/**
 * Checks whether a value is text, and returns the text if it is, or returns double quotes (empty text) if it is not.
 * @param value is the value to test.
 */
export function T(value: IRange | Scalar): string {
  const container = (value as IRange)?.isIRange === true ? value as IRange : null;
  if (container) return readFirstOrMembers(container, asText) as string;
  return asText(value as Scalar);
}

/** `T`'s per-value reading: text is itself, everything else is the empty string. */
const asText = (value: Scalar): string => (typeof value === 'string' ? value : '');

/**
 * Converts a value to text in a specific number format.
 * @param value is a number, a formula that evaluates to a numeric value, or a reference to a cell containing a numeric value.
 * @param formatText is a text string that defines the number format to use.
 */
export function TEXT(
  value: Scalar,
  formatText: string
): Scalar {
  // A blank argument is a literal 0, not empty text — it takes the format's ZERO section
  // (`TEXT(<blank>,"0;-0;""zero"";""txt""")` → "zero"), never its text section, and does so for
  // every format kind including General and dates. `""` is what routes to the text section.
  if (value === null) value = 0;
  // An EMPTY format is the empty string, not the value unformatted — and an omitted slot arrives
  // here as one. A negative number keeps its sign: `TEXT(-5,"")` is "-".
  if (formatText === '') return (typeof value === 'number' && value < 0) ? '-' : '';
  // Past 255 characters a format is not a format at all.
  if (formatText.length > 255) return FormulaError.BuiltIn.Value;
  // Coerce numeric-looking text FIRST, trimming surrounding spaces — only true text
  // reaches a format's text section: TEXT("6  ","0") → "6", TEXT("6","0;;;\\0") → "6",
  // TEXT("x","0;;;\\0") → "0".
  if (typeof value === 'string' && value.trim() !== '') {
    try {
      value = FormulaContext.parseAsNumber(value.trim());
    } catch (e) { /* true text — routes to the format's text section */ }
  }
  try {
    const formatted = FormulaContext.getNumberFormat(formatText, value);
    // a null return (as opposed to a throw) would otherwise escape as a blank instead of #VALUE!
    if (formatted == null) return FormulaError.BuiltIn.Value;
    return formatted;
  } catch (e) {
    return FormulaError.BuiltIn.Value;
  }
}

/**
 * Returns text that's after delimiting characters.
 * @param text The text you want to search for the delimiter.
 * @param delimiter The character or string to use as a delimiter.
 * @param instanceNum The desired occurrence of delimiter. The default is 1. A negative number searches from the end.
 * @param matchMode Searches the text for a delimiter match. By default, a case-sensitive match is done.
 * @param matchEnd Whether to match the delimiter against the end of text. By default, they're not matched.
 * @param ifNotFound Returned if no match is found. By default, #N/A is returned.
 */
export function TEXTAFTER(
  text: string,
  // A SET of delimiters rather than one, because an array or a range at this slot is a list of
  // alternatives rather than something to lift over (see `delimiterSpans`).
  delimiter: Flatten<string>,
  // No default: the bound on `instanceNum` is only applied to one that was SUPPLIED, so absent
  // and an explicit 1 have to be distinguishable.
  instanceNum?: Omittable<number>,
  matchMode: number=0,
  matchEnd: number=0,
  // `AcceptError` because the fallback is only READ when the delimiter is missing:
  // `TEXTAFTER("1","1",1,1,1,1/0)` is `""`, not `#DIV/0!`.
  // An unconsulted fallback must not propagate — the shape `FILTER.ifEmpty` and
  // `IFNA.valueIfNA` already have.
  ifNotFound?: Omittable<AcceptError<string>>
): Scalar {
  return textAroundDelimiter(text, delimiter, instanceNum ?? 1, instanceNum !== undefined,
    matchMode, matchEnd, ifNotFound, true);
}

/**
 * Returns text that's before delimiting characters.
 * @param text The text you want to search for the delimiter.
 * @param delimiter The character or string to use as a delimiter.
 * @param instanceNum The desired occurrence of delimiter. The default is 1. A negative number searches from the end.
 * @param matchMode Whether to use case-sensitive (0) or case-insensitive (1) match (defaults to `0`).
 * @param matchEnd Whether to match the delimiter against the end of text. By default, they're not matched.
 * @param ifNotFound Returned if no match is found. By default, #N/A is returned.
 */
export function TEXTBEFORE(
  text: string,
  // A SET of delimiters rather than one, because an array or a range at this slot is a list of
  // alternatives rather than something to lift over (see `delimiterSpans`).
  delimiter: Flatten<string>,
  // No default: the bound on `instanceNum` is only applied to one that was SUPPLIED, so absent
  // and an explicit 1 have to be distinguishable.
  instanceNum?: Omittable<number>,
  matchMode: number=0,
  matchEnd: number=0,
  // `AcceptError` because the fallback is only READ when the delimiter is missing:
  // `TEXTAFTER("1","1",1,1,1,1/0)` is `""`, not `#DIV/0!`.
  // An unconsulted fallback must not propagate — the shape `FILTER.ifEmpty` and
  // `IFNA.valueIfNA` already have.
  ifNotFound?: Omittable<AcceptError<string>>
): Scalar {
  return textAroundDelimiter(text, delimiter, instanceNum ?? 1, instanceNum !== undefined,
    matchMode, matchEnd, ifNotFound, false);
}

/**
 * Concatenates a list or range of text strings using a delimiter.
 * @param delimiter Character or string to insert between each text item.
 * @param ignoreEmpty if TRUE(default), ignores empty cells.
 * @param text are 1 to 252 text strings or ranges to be joined.
 */
export function TEXTJOIN(
  // A LIST of delimiters rather than one, cycled across the gaps —
  // `TEXTJOIN({"-","+"},TRUE,"a","b","c")` is "a-b+c" — so an array here is not something to lift
  // over, and a list longer than the gaps simply runs out unused.
  delimiter: Flatten<string>,
  ignoreEmpty: Omittable<boolean, true>,
  text: Repeating<IRange<string>, 254>
): Scalar {
  let result: string = '';
  let gap = 0;
  for (const range of text) {
    for (const value of range.values<string>({
        includeEmpty: !ignoreEmpty
      })) {
      if (value.length === 0 && ignoreEmpty) continue; // An empty string is not considered empty for ranges.
      if (gap > 0 && delimiter.length > 0) result += delimiter[(gap - 1) % delimiter.length];
      result += value;
      if (result.length > Scalar.MAX_TEXT_LENGTH) return FormulaError.BuiltIn.Calc;
      gap += 1;
    }
  }
  return result;
}

/** Every member of a TEXTSPLIT delimiter argument in order, blank cells and errors included. */
const _delimiterMembers = (areas: AcceptError<IRange>[] | undefined): AcceptError<Scalar>[] => {
  const members: AcceptError<Scalar>[] = [];
  if (!areas) return members;
  for (const area of areas) {
    if (area === null || area === undefined) continue;
    if (FormulaError.isError(area)) { members.push(area); continue; }
    const { rows, columns } = area.getShape();
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        members.push(area.getValueAt(row, column, _OptionsRawMember) ?? null);
      }
    }
  }
  return members;
};
const _OptionsRawMember: IRange.ValueOptions = Object.freeze({ type: null });

/**
 * TEXTSPLIT's pad, read only where the split is ragged.
 *
 * @remarks
 * The pad keeps its TYPE: `FALSE` pads with the logical, 5 with the number, `""` with the empty
 * string, and an error with itself. An absent argument is `#N/A`; an empty one (`…,0,)`) and a
 * blank cell are the number 0. It has to be ONE value that is not an array — a multi-cell
 * reference and an array constant, `{7}` included, are `#VALUE!`.
 */
const _padValue = (padWith: AcceptError<IRange> | undefined): Scalar => {
  const args = FormulaContext.getArgs();
  if (padWith === undefined) {
    return args.getLength() > 5 && args.getKindAt(5) === ValueKind.Omitted ? 0 : FormulaError.BuiltIn.NA!;
  }
  if (FormulaError.isError(padWith)) return padWith;
  if (padWith.size !== 1 || args.getKindAt(5) === ValueKind.Array) throw FormulaError.BuiltIn.Value;
  return padWith.getValueAt(0, 0) ?? 0;
};

/**
 * Splits text into rows or columns using delimiters.
 * @param text The text to split.
 * @param colDelimiter The column delimiter(s) - can be string or array of strings.
 * @param rowDelimiter The row delimiter(s), null/undefined means no row splitting.
 * @param ignoreEmpty Whether to ignore empty values (defaults to `false`).
 * @param matchMode Whether to use case-sensitive (0) or case-insensitive (1) match (defaults to `0`).
 * @param padWith Value to use for padding if matrix is uneven (defaults to `#N/A`).
 */
export function TEXTSPLIT(
  text: string,
  // Taken as ranges, so a blank cell inside a delimiter range is still a member to refuse.
  colDelimiter: Omittable<Flatten<AcceptError<IRange>>>,
  rowDelimiter?: Omittable<Flatten<AcceptError<IRange>>>,
  ignoreEmpty: boolean=false,
  matchMode: number=0,
  // `AcceptError` for the same reason `TEXTAFTER.ifNotFound` has it — the pad is only READ where
  // the split is ragged: a square split ignores an error pad entirely, and a ragged one PADS
  // WITH IT (`TEXTSPLIT("a,b;c",",",";",FALSE,0,1/0)` fills the missing cell with `#DIV/0!`), so
  // the error must reach the body raw either way.
  padWith?: Omittable<AcceptError<IRange>>
): Scalar[][] { // IRange
  return _textSplit(text, _delimiterMembers(colDelimiter), _delimiterMembers(rowDelimiter),
    ignoreEmpty, matchMode, () => _padValue(padWith));
}

/** TEXTSPLIT over its delimiters' members; `pad` is asked only where the split is ragged. */
const _textSplit = (
  text: string,
  colMembers: AcceptError<Scalar>[],
  rowMembers: AcceptError<Scalar>[],
  ignoreEmpty: boolean,
  matchMode: number,
  pad: () => Scalar
): Scalar[][] => {
  // An empty text is #VALUE!, not an empty result — Excel refuses the call rather than returning
  // one empty cell, and refuses it before it looks at the delimiters.
  if (!text) throw FormulaError.BuiltIn.Value;
  // Truncated first, as TEXTAFTER's is: 0.5 is case-sensitive rather than #VALUE!.
  matchMode = Math.trunc(matchMode);
  if (matchMode !== 0 && matchMode !== 1) throw FormulaError.BuiltIn.Value;
  // Nothing to split BY is #VALUE! rather than the text back: at least one of the two delimiters
  // has to be there, though either alone is enough.
  if (colMembers.length === 0 && rowMembers.length === 0)
    throw FormulaError.BuiltIn.Value;
  // An error standing ALONE at a delimiter slot is the call's: `TEXTSPLIT(t,<blank>,<#NAME?>)`
  // is #NAME?, ahead of the empty delimiter before it. Among several members the first fault in
  // order wins instead (`buildDelimiterRegex`).
  for (const delimiters of [colMembers, rowMembers]) {
    if (delimiters?.length === 1 && FormulaError.isError(delimiters[0])) throw delimiters[0];
  }

  const buildDelimiterRegex = (members: AcceptError<Scalar>[]): RegExp | null => {
    if (members.length === 0) return null; // No split if no delimiters provided
    // An EMPTY delimiter is #VALUE!, not "split between every character" — including one empty
    // member among several, and including the blank cell that reaches here as one. Members are
    // judged in order, so a blank ahead of an error is #VALUE! and an error ahead of it is that
    // error.
    const delimiters: string[] = [];
    for (const member of members) {
      if (FormulaError.isError(member)) throw member;
      const delimiter = member === null || member === undefined ? '' : FormulaContext.toText(member as Scalar);
      if (delimiter.length === 0) throw FormulaError.BuiltIn.Value;
      delimiters.push(delimiter);
    }
    // Overlapping delimiters resolve LONGEST-first, not first-listed: `TEXTSPLIT("aXXb",{"X","XX"})`
    // is two columns, so "XX" wins where it starts, as TEXTAFTER's delimiter set does. Regex
    // alternation takes the first branch that matches, so branch order is the rule — and it is not
    // the order the author wrote.
    const byLongest = [...delimiters].sort((a, b) => b.length - a.length);
    return new RegExp(byLongest.map(d => escapeRegex(d)).join('|'), matchMode === 1 ? 'i' : '');
  };
  const splitByDelimiters = (input: string, regex: RegExp | null): string[] => {
    return regex ? input.split(regex) : [input];
  };
  const colRegex = buildDelimiterRegex(colMembers);

  // Split rows first if rowMembers is provided
  let rows: string[] = [text];
  if (rowMembers.length > 0) {
    rows = splitByDelimiters(text, buildDelimiterRegex(rowMembers));
  }

  // Filter empty rows if ignoreEmpty is true
  if (ignoreEmpty) {
    const filtered = [];
    for (let i=0; i<rows.length; i++) {
      const row = rows[i];
      if (row.length > 0) {
        filtered.push(row);
      }
    }
    rows = filtered;
  }

  // Split each row into columns
  const result: Scalar[][] = [];
  let maxColumns = 0;
  let minColumns = Number.MAX_SAFE_INTEGER;

  for (let i=0; i<rows.length; i++) {
    const row = rows[i];
    let columns = splitByDelimiters(row, colRegex);
    if (ignoreEmpty) {
      const filtered = [];
      for (let i=0; i<columns.length; i++) {
        const value = columns[i];
        if (value.length > 0) {
          filtered.push(value);
        }
      }
      columns = filtered;
    }

    if (columns.length > 0 || !ignoreEmpty) {
      result.push(columns);
      maxColumns = Math.max(maxColumns, columns.length);
      minColumns = Math.min(minColumns, columns.length);
    }
  }

  // Pad rows to ensure rectangular result
  if (result.length > 0 && minColumns !== maxColumns) {
    const padValue = pad();
    for (let i=0; i<result.length; i++) {
      const row = result[i];
      while (row.length < maxColumns) {
        row.push(padValue);
      }
    }
  }

  return result.length > 0 ? result : [[""]]; // Return at least an empty cell
};

/**
 * Translate a text string from one language to another using the Microsoft Translator service.
 * @hidden Unsupported Connectivity
 * @param text The text to translate.
 * @param sourceLanguage Specifiy the source language your text is currently in. Expressed as a two-letter language code.
 * @param targetLanguage Specifiy the source language you want your text to be translated to. Expressed as a two-letter language code.
 */
export function TRANSLATE(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Scalar {
  // https://learn.microsoft.com/en-us/connectors/translatorv2/
  // TODO - use MS language service for Excel compatibility or AI hook?
  return FormulaError.BuiltIn.NA;
}

/**
 * Removes all spaces from text except for single spaces between words.
 * @param text The text from which you want to remove extra spaces.
 */
export function TRIM(text: string): string {
  /*
   * TRIM acts on the ASCII space (0x20) ONLY. Non-breaking space
   * (U+00A0), tab and newline are left exactly where they are.
   */
  return text.replace(/ +/g, ' ').replace(/^ +| +$/g, '');
}

/**
 * Returns the Unicode character referenced by the given numeric value.
 * @param number is the Unicode number representing a character.
 */
export function UNICHAR(number: number): string {
  /*
   * Two error kinds, and the split is not arbitrary: a value outside the code space is
   * #VALUE!, while a code point that exists but can never stand for a character —
   * a surrogate or a noncharacter — is #N/A. That is why UNICHAR(1114111) fails: U+10FFFF
   * is a noncharacter, not out of range. The last accepted value is 1114109.
   *
   * The domain matters beyond conformance. A lone surrogate cannot be written to XML and
   * _xHHHH_ escaping cannot carry it either, so emitting one corrupts the cell to U+FFFD
   * on the next save/load. Rejecting these leaves every result XML-representable.
   */
  if (!(number >= 1)) // negated so a NaN errors here; fromCodePoint would THROW on one
    throw FormulaError.BuiltIn.Value;
  const code = Math.trunc(number);
  if (code > 0x10FFFF)
    throw FormulaError.BuiltIn.Value;
  const isSurrogate = code >= 0xD800 && code <= 0xDFFF;
  const isNoncharacter = (code >= 0xFDD0 && code <= 0xFDEF) || (code & 0xFFFF) >= 0xFFFE;
  if (isSurrogate || isNoncharacter)
    throw FormulaError.BuiltIn.NA;
  return String.fromCodePoint(code);
}

/**
 * Returns the number (code point) corresponding to the first character of the text.
 * @param text is the character that you want the Unicode value of.
 */
export function UNICODE(text: string): number {
  if (text.length === 0)
    throw FormulaError.BuiltIn.Value;
  /*
   * Unlike CODE this reads a whole code point, so a surrogate pair reports the astral value. An
   * unpaired surrogate can only be left over from a cut MIDB made, and the two halves do not
   * answer alike: a leading one is #VALUE! — the character it starts is not there — while a
   * trailing one reports its own unit.
   */
  const codePoint = text.codePointAt(0)!;
  if (codePoint >= 0xD800 && codePoint <= 0xDBFF)
    throw FormulaError.BuiltIn.Value;
  return codePoint;
}

/**
 * Converts a text string to all uppercase letters.
 * @param text is the text you want converted to uppercase, a reference or a text string.
 */
export function UPPER(text: string): string {
  return mapCase(text, true);
}

/**
 * Converts a text string that represents a number to a number.
 * @param text is the text enclosed in quotation marks or a reference to a cell containing the text you want to convert.
 */
export function VALUE(text: Scalar): number {
  if (text === null) return 0;
  return FormulaContext.parseAsNumber(text);
}

/**
 * Returns a text representation of a value.
 * @param value the value to represent as text.
 * @param format the format of the text.
 */
export function VALUETOTEXT(
  value: AcceptError<Scalar>, // renders errors as text — the receive population
  format: number=0
): string {
  format = Math.floor(format);
  if (format !== 0 && format !== 1) {
    throw FormulaError.BuiltIn.Value;
  }
  const strict = format === 1;
  // Text is the only type this renders itself, because only text is quoted in strict mode — and a
  // quote INSIDE the text is doubled, the way a spreadsheet writes one in a literal, so that the
  // strict form is text a person could type back: `VALUETOTEXT("a""b",1)` is `"a""b"`.
  if (typeof value === 'string') return strict ? '"' + value.replace(/"/g, '""') + '"' : value;
  return FormulaContext.toText(value);
}

// utils

/**
 * Whether half-width and full-width are two distinct forms of the same character here.
 */
const isDBCSLanguage = (): boolean => {
  const language = FormulaContext.getRuntime().getLocale().toLowerCase().split(/[-_]/)[0];
  return language === 'ja' || language === 'zh' || language === 'ko';
};

// Utility function to escape special characters in regex
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


/*
 * Formulas index text by CODE POINT; a JavaScript string indexes by UTF-16 code unit. The two agree
 * everywhere except a surrogate pair, which is one character to a formula and two positions to
 * JavaScript.
 * FIND reports code-point offsets, and MID/LEFT/RIGHT/REPLACE consume those same offsets and never
 * split a pair — so MID(s, FIND("A", s), 1) composes. Ours has to match on both ends at once or
 * composed formulas drift by one per astral character upstream.
 *
 * Splitting a pair does not just misplace a character, it destroys one: half a pair is a lone
 * surrogate, which XML cannot represent and `_xHHHH_` cannot escape, so it round-trips to U+FFFD.
 * That is the same corruption UNICHAR used to cause.
 *
 * These convert between the two index spaces. Every caller below tests for a pair first and keeps
 * its plain code-unit path when there is none — the overwhelmingly common case. The test is not a
 * wasted pass even for LEN, where it looks like it should be cheaper to just count: the native
 * regex scan beats the counting loop by enough that testing and then taking `text.length` is
 * ~4x faster than counting unconditionally. LEN is O(n) either way now, where it used to be O(1).
 */
const RE_SURROGATE_PAIR = /[\uD800-\uDBFF][\uDC00-\uDFFF]/;

const hasSurrogatePair = (text: string): boolean => RE_SURROGATE_PAIR.test(text);

/*
 * The workbook's compatibility version decides what LEN, MID, FIND, SEARCH and REPLACE count.
 * Under version 2 a surrogate pair is one character, as described above. Under version 1 it is its
 * two units: `LEN("ab" & UNICHAR(128514))` is 4, and `MID` of it at 3 for 1 is the lone high
 * surrogate. LEFT and RIGHT count characters under both versions and never split a pair.
 */
const countsCharacters = (): boolean => FormulaContext.getRuntime().getCompatibilityVersion() >= 2;

/** Whether positions in `text` differ from its UTF-16 offsets: it holds a pair, counted as one. */
const countsByCodePoint = (text: string): boolean => RE_SURROGATE_PAIR.test(text) && countsCharacters();

/** A pair, or a trailing high surrogate — the two cases where LEN is not the code-unit count. */
const RE_COUNTS_BY_CODE_POINT = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF]$/;

/*
 * ROUND, which FIXED and DOLLAR spell their number with: half AWAY from zero, decided on the
 * 15-significant-digit DECIMAL form rather than on the double. That second half is what makes
 * `FIXED(1.005,2)` "1.01" — 1.005 is 1.00499999999999989 in binary, so rounding the double gives
 * "1.00" and rounding its decimal spelling gives "1.01".
 *
 * The financial category reaches the same rule through `excelRound` in formulas-extended, which
 * this package cannot import; the two are four lines each and the rule is ROUND's, not either
 * package's.
 */
const roundLikeExcel = (value: number, digits: number): number => {
  if (digits < -308) return 0; // the scale underflows before the value could survive it
  const scale = 10 ** digits;
  const magnitude = Number(Math.abs(value).toPrecision(15));
  // TWICE to fifteen digits, not once: scaling reintroduces the binary error the first one
  // removed. 1.005 spells as 1.005, and 1.005 x 100 is 100.49999999999999 — which rounds the wrong
  // way until it is spelled again.
  const scaled = Number((magnitude * scale).toPrecision(15));
  if (!Number.isFinite(scaled)) return value; // too large to scale; the digits cannot matter
  return Math.sign(value) * Math.round(scaled) / scale;
};

/*
 * FIXED and DOLLAR refuse two things the format engine would happily do: more than 127 decimal
 * places, and a result too long to be a cell's text — `FIXED(1E150,2)` is 204 characters and
 * answers, `FIXED(1E200,2)` would be 271 and is #VALUE!.
 */
const MAX_SPELLED_DECIMALS = 127;
const MAX_SPELLED_LENGTH = 255;

/**
 * How long the spelled number WILL be, computed rather than counted after the fact — the format
 * engine cannot render a 300-digit number to count it, overflowing to an infinity first, and the
 * refusal has to happen either way.
 */
const spelledLength = (value: number, decimals: number, grouped: boolean, prefix: number): number => {
  const magnitude = Math.abs(value);
  const digits = magnitude < 1 ? 1 : Math.floor(Math.log10(magnitude)) + 1;
  return digits + (grouped ? Math.floor((digits - 1) / 3) : 0) +
    (decimals > 0 ? decimals + 1 : 0) + (value < 0 ? 1 : 0) + prefix;
};

/*
 * The characters the case-insensitive compare folds and a JavaScript `i` regex does not.
 *
 * `RegExp`'s canonicalization refuses any mapping that would take a non-ASCII character to an
 * ASCII one, and only applies `toUpperCase`, so it misses the letterlike symbols (a KELVIN SIGN
 * is not `k`, an OHM SIGN is not `ω`) and the capital sharp S. The compare follows Windows' case
 * table, which maps all four.
 *
 * Every mapping is one code unit to one code unit, which is what lets SEARCH fold both sides and
 * still report a position in the ORIGINAL string. That is also why the list stops here rather than
 * becoming Unicode simple folding: `İ` folds to two units, and is not folded.
 *
 * Windows' table is the narrower one in the other direction — it does not fold a MICRO SIGN to
 * `μ`, an iota subscript to `ι`, or the Cherokee cases, where a JS regex does. Those still match
 * here; Excel does not match them.
 */
// Keyed by CODE POINT rather than by character: three of the four are visually identical to the
// letter they fold to, so a literal table would read as a no-op.
const LETTERLIKE_FOLD = new Map<string, string>([
  [0x212A, 0x004B], // KELVIN SIGN -> capital K
  [0x212B, 0x00C5], // ANGSTROM SIGN -> capital A with ring above
  [0x2126, 0x03A9], // OHM SIGN -> capital omega
  [0x1E9E, 0x00DF], // capital sharp S -> small sharp s
].map(([from, to]) => [String.fromCharCode(from), String.fromCharCode(to)] as [string, string]));
const RE_LETTERLIKE_TEST = new RegExp(`[${[...LETTERLIKE_FOLD.keys()].join('')}]`);
const RE_LETTERLIKE_ALL = new RegExp(RE_LETTERLIKE_TEST.source, 'g');
const foldLetterlike = (text: string): string =>
  RE_LETTERLIKE_TEST.test(text) ? text.replace(RE_LETTERLIKE_ALL, (ch) => LETTERLIKE_FOLD.get(ch)!) : text;

/*
 * The case mapping is Windows', not Unicode's — Excel's, kept for compatibility — and the three
 * ways they differ are all visible in ordinary text.
 *
 * - It never EXPANDS. `UPPER("stra" & sharp-s & "e")` keeps the sharp s where JavaScript
 *   writes "SS", and a ligature stays one character. So a mapping that is not exactly one code
 *   unit long is not applied at all.
 * - It works on code UNITS, so a character outside the BMP is never cased — Deseret has cases and
 *   they are ignored.
 * - A few characters Unicode maps, Windows does not (the micro sign, the letterlike symbols, the
 *   capital sharp S), and one it maps differently: a dotted capital I lower-cases to plain "i"
 *   rather than to "i" followed by a combining dot.
 *
 * The exception table below is a known list, not a derivation of Windows' table: a character
 * outside it that Windows also declines to map is still mapped here.
 */
const NO_CASE_MAP = new Set([
  0x00B5, // MICRO SIGN
  0x1E9E, // capital sharp S — Windows has no lowercase for it
  0x2126, // OHM SIGN
  0x212A, // KELVIN SIGN
  0x212B, // ANGSTROM SIGN
]);
const LOWER_OVERRIDE = new Map<number, string>([
  [0x0130, 'i'], // dotted capital I -> plain i, where Unicode adds a combining dot
]);
const CAPITAL_SIGMA = 0x03A3;
const FINAL_SIGMA = String.fromCharCode(0x03C2);
// eslint-disable-next-line no-control-regex
const RE_ASCII_ONLY = /^[\x00-\x7F]*$/;

/** {@link UPPER} and {@link LOWER}, and the two halves of {@link PROPER}. */
const mapCase = (text: string, upper: boolean): string => {
  // Nothing above lands in ASCII, and almost all text is ASCII.
  if (RE_ASCII_ONLY.test(text)) return upper ? text.toUpperCase() : text.toLowerCase();
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = text.charCodeAt(i);
    if ((code >= 0xD800 && code <= 0xDFFF) || NO_CASE_MAP.has(code)) { out += ch; continue; }
    if (!upper) {
      const override = LOWER_OVERRIDE.get(code);
      if (override !== undefined) { out += override; continue; }
      // A capital sigma ENDING the text lower-cases to the final sigma unconditionally, where
      // JavaScript asks for a cased letter before it (so a lone sigma stays plain under `\u03C3`).
      if (code === CAPITAL_SIGMA && i === text.length - 1) { out += FINAL_SIGMA; continue; }
    }
    const mapped = upper ? ch.toUpperCase() : ch.toLowerCase();
    out += mapped.length === 1 ? mapped : ch;
  }
  return out;
};

/**
 * Number of code points, i.e. code units less one for each surrogate pair — and less the last unit
 * when that is a HIGH surrogate with nothing after it.
 *
 * The trailing rule is Excel's, and it shows on the halves MIDB cuts out of a pair: a lone high
 * surrogate alone is 0 characters and `"x"` before it is 1, while the same half with an `"x"`
 * AFTER it is 2. Only the end of the string is treated as an unfinished character; an unpaired
 * surrogate anywhere else counts (`LEN` of two lone highs is 1).
 */
const codePointLength = (text: string): number => {
  const units = text.length;
  let pairs = 0;
  for (let i = 0; i < units - 1; i++) {
    const hi = text.charCodeAt(i);
    if (hi < 0xD800 || hi > 0xDBFF) continue;
    const lo = text.charCodeAt(i + 1);
    if (lo >= 0xDC00 && lo <= 0xDFFF) { pairs++; i++; }
  }
  const last = units > 0 ? text.charCodeAt(units - 1) : 0;
  const danglingHigh = last >= 0xD800 && last <= 0xDBFF ? 1 : 0;
  return units - pairs - danglingHigh;
};

/**
 * Code-unit offset of the `count`th code point, clamped to the end of the string. `count` is
 * truncated rather than rejected, matching `String.slice`, so a caller passing a fractional
 * argument through gets the same answer on this path as on the plain one.
 */
const unitOffsetOf = (text: string, count: number): number => {
  const target = Math.trunc(count);
  const units = text.length;
  let offset = 0;
  for (let seen = 0; seen < target && offset < units; seen++) {
    const hi = text.charCodeAt(offset);
    const lo = offset + 1 < units ? text.charCodeAt(offset + 1) : 0;
    offset += (hi >= 0xD800 && hi <= 0xDBFF && lo >= 0xDC00 && lo <= 0xDFFF) ? 2 : 1;
  }
  return Math.min(offset, units);
};

/** Inverse of {@link unitOffsetOf}: how many code points precede a code-unit offset. */
const codePointIndexOf = (text: string, unitOffset: number): number =>
  codePointLength(text.slice(0, unitOffset));

/**
 * Delimiter match spans for TEXTAFTER/TEXTBEFORE, as `[start, end)` offsets into `text` ITSELF.
 *
 * - The delimiter is a SET. An array or range there is not lifted into one call per delimiter, it
 *   is a list of alternatives, and the match is the EARLIEST position — not the first listed:
 *   `TEXTAFTER("a-b+c",{"+","-"})` is "b+c" whichever order the two are written in. At the same
 *   position the LONGEST wins (`{"X","XX"}` over "aXXb" takes "XX").
 * - Matches do not OVERLAP: the second "aa" of "aaaa" starts at position 3, so
 *   `TEXTAFTER("aaaa","aa",2)` is the empty string. SUBSTITUTE's instance count is the opposite.
 * - Case-insensitive mode matches with a regex rather than folding the string first, because a
 *   case mapping can change LENGTH — `U+0130` lower-cases to two code units — so an offset found
 *   in a folded copy does not address the original, and everything after the first such character
 *   would be cut in the wrong place.
 */
const delimiterSpans = (text: string, delimiters: string[], matchMode: number): [number, number][] => {
  const spans: [number, number][] = [];
  const found = delimiters.filter((d) => d.length > 0);
  if (found.length === 0) return spans;
  const matchers = matchMode === 1
    ? found.map((d) => new RegExp(escapeRegex(d), 'gi'))
    : null;
  let pos = 0;
  while (pos <= text.length) {
    let best: [number, number] | null = null;
    for (let i = 0; i < found.length; i++) {
      let at: number;
      if (matchers) {
        matchers[i].lastIndex = pos;
        const match = matchers[i].exec(text);
        at = match ? match.index : -1;
      } else {
        at = text.indexOf(found[i], pos);
      }
      if (at === -1) continue;
      // Earliest wins; the longest of the alternatives that start there wins the tie.
      if (!best || at < best[0] || (at === best[0] && at + found[i].length > best[1])) {
        best = [at, at + found[i].length];
      }
    }
    if (!best) break;
    spans.push(best);
    pos = best[1] > best[0] ? best[1] : best[0] + 1;
  }
  return spans;
};

/**
 * The half of TEXTAFTER and TEXTBEFORE that is the same function. What the two share:
 *
 * - `matchMode` and `matchEnd` are 0 or 1 only. Each is truncated first (1.5 is 1) and anything
 *   else — 2, −1, a huge value, non-numeric text — is #VALUE!.
 * - `instanceNum` is shifted then FLOORED, so −0.9 counts as −1 where every other count in the
 *   category truncates toward zero, and it is bounded by the LENGTH of the text: an instance past
 *   that is #VALUE! rather than "not found". The bound is only applied to an instance that was
 *   actually SUPPLIED — `TEXTBEFORE("","-")` is #N/A, and the same call with an explicit 1 is
 *   #VALUE!.
 * - An EMPTY delimiter (or a set holding one) matches at the start for a positive instance and at
 *   the end for a negative one, and skips the bound entirely.
 * - `matchEnd` adds a virtual match, and WHICH end it adds depends on the direction being counted:
 *   at the end of the text for a positive instance, at the start for a negative one.
 */
const textAroundDelimiter = (
  text: string,
  delimiters: string[],
  instanceRaw: number,
  instanceSupplied: boolean,
  matchMode: number,
  matchEnd: number,
  ifNotFound: Scalar | undefined,
  after: boolean
): Scalar => {
  const mode = Math.trunc(matchMode);
  if (mode !== 0 && mode !== 1) return FormulaError.BuiltIn.Value;
  const end = Math.trunc(matchEnd);
  if (end !== 0 && end !== 1) return FormulaError.BuiltIn.Value;

  const instance = Math.floor(instanceRaw + COUNT_EPSILON);
  if (instance === 0) return FormulaError.BuiltIn.Value;

  if (delimiters.length === 0 || delimiters.some((d) => d.length === 0)) {
    // The empty delimiter matches once, at whichever end the count runs from — and an OMITTED
    // delimiter slot is the same thing, not a missing one.
    const atStart = instance > 0;
    return after === atStart ? text : '';
  }
  // The bound is the number of POSITIONS a delimiter could start at, not the length of the text:
  // `TEXTAFTER("a-b-c","-",5)` is a miss (#N/A) and 6 is #VALUE!, and a delimiter LONGER than the
  // text refuses even instance 1. The shortest of a set is the permissive one.
  const shortest = Math.min(...delimiters.map((d) => d.length));
  if (instanceSupplied && Math.abs(instance) > text.length - shortest + 1) return FormulaError.BuiltIn.Value;

  const spans = delimiterSpans(text, delimiters, mode);
  if (end === 1) {
    if (instance > 0) spans.push([text.length, text.length]);
    else spans.unshift([0, 0]);
  }
  const index = instance > 0 ? instance - 1 : spans.length + instance;
  if (index < 0 || index >= spans.length) return ifNotFound ?? FormulaError.BuiltIn.NA;

  return after ? text.substring(spans[index][1]) : text.substring(0, spans[index][0]);
};
