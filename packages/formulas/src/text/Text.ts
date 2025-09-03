/* cspell: disable */
import {
  Scalar, ScalarType, IRange, IReferenceRange, FormulaContext, FormulaError
} from '@sheetxl/primitives';

import { WildCard } from '../_utils';

// full-width and half-width converter
const charSets = {
  latin: { halfRE: /[!-~]/g, fullRE: /[！-～]/g, delta: 0xFEE0 },
  hangul1: { halfRE: /[ﾡ-ﾾ]/g, fullRE: /[ᆨ-ᇂ]/g, delta: -0xEDF9 },
  hangul2: { halfRE: /[ￂ-ￜ]/g, fullRE: /[ᅡ-ᅵ]/g, delta: -0xEE61 },
  kana: {
    delta: 0,
    half: "｡｢｣､･ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝﾞﾟ",
    full: "。「」、・ヲァィゥェォャュョッーアイウエオカキクケコサシ" +
      "スセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン゛゜"
  },
  extras: {
    delta: 0,
    half: "¢£¬¯¦¥₩\u0020|←↑→↓■°",
    full: "￠￡￢￣￤￥￦\u3000￨￩￪￫￬￭￮"
  }
};

const toFull = set => c => set.delta ?
  String.fromCharCode(c.charCodeAt(0) + set.delta) :
  [...set.full][[...set.half].indexOf(c)];

const toHalf = set => c => set.delta ?
  String.fromCharCode(c.charCodeAt(0) - set.delta) :
  [...set.half][[...set.full].indexOf(c)];

const re = (set: string[], way: string): string => set[way + "RE"] || new RegExp("[" + set[way] + "]", "g");
const sets = Object.keys(charSets).map(i => charSets[i]);
const toFullWidth = (str0: string): string => {
  return sets.reduce((str, set) => str.replace(re(set, "half"), toFull(set)), str0);
}
const toHalfWidth = (str0: string): string =>
  sets.reduce((str, set) => str.replace(re(set, "full"), toHalf(set)), str0);

// Utility function to escape special characters in regex
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @hidden DBCS
 * @summary Converts a string to full-width characters to half-width. Uses the double-byte character set (DBCS).
 * @param text is a text or a reference to a cell containing text
 */
export function ASC(text: string): string {
  return toHalfWidth(text);
}

/**
 * @summary Returns a text representation of an array
 * @param array the array to represent as text
 * @param format 0 for relaxed format, 1 for strict format
 */
export function ARRAYTOTEXT(
  array: IRange,
  format: number=0
): string {
  format = Math.floor(format);
  if (format !== 0 && format !== 1) {
    throw FormulaError.BuiltIn.Value;
  }
  const strict = format === 1;
  let results: string = null;
  // relaxed
  if (!strict) {
    for (const value of array.values({ orientation: IRange.Orientation.Row })) {
      results = results === null ? '' : results + ', ';
      results += VALUETOTEXT(value, format);
    }
    return results; // may be null thats good
  }

  // strict
  const asArray = array.getValues();
  results = '{';
  for (let i=0; i<asArray.length; i++) {
    const row = asArray[i];
    for (let j=0; j<row.length; j++) {
      results += VALUETOTEXT(row[j], format);
      if (j < row.length - 1) {
        results += ',';
      }
    }
    if (i < asArray.length - 1) {
      results += ';';
    }
  }
  if (strict) {
    results += '}';
  }
  return results;
}

/**
 * @summary Returns the character specified by the code number from the character set for your computer
 * @param number is a number between 1 and 255 specifying which character you want
 */
export function CHAR(number: number): string {
  if (number > 255 || number < 1)
    throw FormulaError.BuiltIn.Value;
  return String.fromCharCode(number);
}

/**
 * @summary Removes all nonprintable characters from text
 * @param text is the text you want to clean
 */
export function CLEAN(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x1F]/g, '');
}

/**
 * @summary Returns the Unicode value of the first character in a text string
 * @param text is the text string whose Unicode value you want
 */
// TODO - this is slightly different from the Excel version which uses OS to determine character set
export function CODE(text: string): number {
  if (text.length === 0)
    throw FormulaError.BuiltIn.Value;
  return text.charCodeAt(0);
}

/**
 * @summary Concatenates a list or range of text strings
 * @param text text1,text2,... are 1 to 252 text strings or ranges to be joined
 */
export function CONCAT(...text: IRange[]): string {
  let result: string = '';
  let count: number = 0;
  for (const range of text) {
    for (const value of range.values<string>({ type: ScalarType.String, coerce: true, orientation: IRange.Orientation.Row })) {
      if (count++ > 254)
        throw FormulaError.Value;
      result += value;
    }
  }
  return result;
}

/**
 * @summary Joins several text strings into one text string
 * @category Compatibility
 * @param text text1, text2,... are 1 to 252 text strings or ranges to be joined
 *
 * @remarks
 * Similar to CONCAT, but only uses the first argument in a range.
 */
export function CONCATENATE(...text: IRange[]): string {
  let result:string = '';
  let count: number = 0;
  for (const range of text) {
    // skip empty to get the top left?
    const value = range.getValueAt<string>(0, 0, { type: ScalarType.String, coerce: true });
    if (count++ > 254)
      throw FormulaError.Value;
    result += value;
  }

  return result;
}

/**
 * @hidden Unimplemented
 * @summary Detects the language of a given text.
 * @param text is the text to detect the language of
 */
// TODO - use AI? (Or even MS language service)
// https://learn.microsoft.com/en-us/connectors/translatorv2/
export function DETECTLANGUAGE(text: string): string {
  return undefined;
}

/**
 * @hidden DBCS
 * @summary Changes half-width characters to full-width characters. Uses the double-byte character set (DBCS).
 * @param text is a text or a reference to a cell containing text
 */
export function DBCS(text: string): string {
  return toFullWidth(text);
}

/**
 * @summary Converts a number to text in currency format
 * @param number is the number to convert
 * @param decimals is the number of digits to the right of the decimal point
 */
export function DOLLAR(
  number: number,
  decimals: number=2
): string {
  const decimalString = Array(decimals).fill('0').join('');
  const runtime = FormulaContext.getRuntime();
  const currency = runtime.getCurrencySymbol();
  const group = runtime.getNumberGroupSeparator();
  const decimal = runtime.getNumberDecimalSeparator();
  const formatText = `${currency}#${group}##0${decimal}${decimalString}_);(${currency}#${group}##0${decimal}${decimalString})`;
  return FormulaContext.getNumberFormat(formatText, number).trim();
}

/**
 * @summary Checks whether two text strings are exactly the same, and returns TRUE or FALSE. EXACT is case-sensitive
 * @param text1 is the first text string
 * @param text2 is the second text string
 */
export function EXACT(text1: string, text2: string): boolean {
  return text1 === text2;
}

/**
 * @summary Returns the starting position of one text string within another text string. FIND is case-sensitive
 * @param findText Returns the starting position of one text string within another text string. FIND is case-sensitive
 * @param withinText is the text you want to search
 * @param startNum specifies the character at which to start the search. The first character in Within_text is character number 1
 */
export function FIND(
  findText: string,
  withinText: string,
  startNum: number=1
): number {
  if (startNum < 1 || startNum > withinText.length)
    throw FormulaError.BuiltIn.Value;
  const res = withinText.indexOf(findText, startNum - 1);
  if (res === -1)
    throw FormulaError.BuiltIn.Value;
  return res + 1;
}

/**
 * @hidden DBCS
 * @summary Finds the starting position of one text string with another text string. FINDB is case-sensitive. Use with double-byte characters.
 * @param findText is the text you want to find
 * @param withinText is the text you want to search
 * @param startNum is the position in within_text to start searching
 */
export function FINDB(findText: string, withinText: string, startNum: number=1): number {
  return FIND(findText, withinText, startNum);
}

/**
 * @summary Rounds a number to the specified number of decimals and returns the result as text with or without commas
 * @param number is the number you want to round and convert to text
 * @param decimals is the number of digits to the right of the decimal point
 * @param noCommas is a logical value: do not display commas in the returned text = TRUE; do display commas in the returned text = FALSE
 */
export function FIXED(
  number: number,
  decimals: number=2,
  noCommas: boolean=false
): string {
  const decimalString = Array(decimals).fill('0').join('');
  const runtime = FormulaContext.getRuntime();
  const group = runtime.getNumberGroupSeparator();
  const decimal = runtime.getNumberDecimalSeparator();
  const comma = noCommas ? '' : `#${group}`;
  const formatText = `${comma}##0${decimal}${decimalString}_);(${comma}##0${decimal}${decimalString})`;
  return FormulaContext.getNumberFormat(formatText, number).trim();
}

/**
 * @summary Returns the specified number of characters from the start of a text string
 * @param text is the text string from which you want to extract characters
 * @param numChars specifies how many characters you want LEFT to extract
 */
export function LEFT(text: string, numChars: number=1): string {
  if (numChars < 0)
    throw FormulaError.BuiltIn.Value;
  if (numChars > text.length)
    return text;
  return text.slice(0, numChars);
}

/**
 * @hidden DBCS
 * @summary Returns the leftmost num_bytes characters from text. Uses double-byte characters.
 * @param text is the text string from which you want to extract characters
 * @param numBytes is the number of bytes to extract
 */
export function LEFTB(text: string, numBytes: number=1): string {
  return LEFT(text, numBytes);
}

/**
 * @summary Returns the number of characters in a text string
 * @param text is the text whose length you want to find. Spaces count as characters
 */
export function LEN(text: string): number {
  return text.length;
}

/**
 * @summary Returns the number of bytes in a text string. Uses double-byte characters.
 * @param text is the text string from which you want to extract characters
 */
export function LENB(text: string): number {
  return text.length;
}

/**
 * @summary Converts all letters in a text string to lowercase
 * @param text is the text you want to convert to lowercase. Characters in Text that are not letters are not changed
 */
export function LOWER(text: string): string {
  return text.toLowerCase();
}

/**
 * @summary Returns the characters from the middle of a text string, given a starting position and length
 * @param text is the text string from which you want to extract characters
 * @param startNum is the position of the first character you want to extract
 * @param numChars specifies how many characters to return from Text
 */
export function MID(text: string, startNum: number, numChars: number): string {
  if (startNum > text.length)
    return '';
  if (startNum < 1 || numChars < 1)
    throw FormulaError.BuiltIn.Value;
  return text.slice(startNum - 1, startNum + numChars - 1);
}

/**
 * @hidden DBCS
 * @summary Returns characters from the middle of a text string. Uses double-byte characters.
 * @param text is the text string from which you want to extract characters
 * @param startNum is the position of the first character you want to extract
 * @param numBytes is the number of bytes to extract
 */
export function MIDB(text: string, startNum: number, numBytes: number): string {
  return MID(text, startNum, numBytes);
}

/**
 * @summary Converts text to number in a locale-independent manner
 * @param text is the text string you want to convert
 * @param decimalSeparator is the character that separates the integer part from the decimal part of the number
 * @param groupSeparator is the character that separates groups of thousands
 */
// TODO: support reading system locale and set separators
export function NUMBERVALUE(
  text: string,
  decimalSeparator: string='.',
  groupSeparator: string=','
): number {
  if (text.length === 0)
    return 0;
  if (decimalSeparator.length === 0 || groupSeparator.length === 0)
    throw FormulaError.BuiltIn.Value;
  decimalSeparator = decimalSeparator[0];
  groupSeparator = groupSeparator[0];
  if (decimalSeparator === groupSeparator
    || text.indexOf(decimalSeparator) < text.lastIndexOf(groupSeparator))
    throw FormulaError.BuiltIn.Value;

  const res = text.replace(groupSeparator, '')
    .replace(decimalSeparator, '.')
    // remove chars that not related to number
    .replace(/[^\-0-9.%()]/g, '')
    .match(/([(-]*)([0-9]*[.]*[0-9]+)([)]?)([%]*)/);
  if (!res)
    throw FormulaError.BuiltIn.Value;
  // ["-123456.78%%", "(-", "123456.78", ")", "%%"]
  const leftParenOrMinus = res[1].length, rightParen = res[3].length, percent = res[4].length;
  let number = Number(res[2]);
  if (leftParenOrMinus > 1 || leftParenOrMinus && !rightParen
    || !leftParenOrMinus && rightParen || isNaN(number))
    throw FormulaError.BuiltIn.Value;
  number = number / 100 ** percent;
  return leftParenOrMinus ? -number : number;
}

/**
 * @hidden Unimplemented
 * @summary Returns the percentage of a subset of a given data set
 * @param dataSubset is the subset
 * @param dataAll is the data set
 */
export function PERCENTOF(dataSubset: IRange, dataAll: IRange): IRange {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the phonetic spelling of a text string
 * @param reference Text string or a reference to a single cell or a range of cells that contain a furigana text string
 */
export function PHONETIC(reference: IReferenceRange/*CELL*/): any {
}

/**
 * @summary Converts the first letter of each word in a text string to uppercase
 * @param text is the text string you want to convert
 */
export function PROPER(text: string): string {
  text = text.toLowerCase();
  text = text.charAt(0).toUpperCase() + text.slice(1);
  return text.replace(/(?:[^a-zA-Z])([a-zA-Z])/g, letter => letter.toUpperCase());
}

/**
 * @hidden Unimplemented
 * @summary Extracts substrings of 'text' based on the provided REGEX 'pattern'
 * @param text is the text string from which you want to extract characters
 * @param pattern The regular expression to be applied
 * @param returnMode Specify which matches to return
 * @param caseSensitivity Whether the match is case sensitive
 */
export function REGEXEXTRACT(text: string, pattern: string, returnMode: number=0, caseSensitivity: boolean=false): string[] {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns 'text', with 'replacement' in place of matches with 'pattern'
 * @param text is the text string from which you want to extract characters
 * @param pattern The regular expression to be applied
 * @param replacement The replacement string
 * @param occurrence The occurrence of the match to replace
 * @param caseSensitivity Whether the match is case sensitive
 */
export function REGEXREPLACE(text: string, pattern: string, replacement: string, occurrence: number=0, caseSensitivity: boolean=false): string[] {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Checks whether the input matches the pattern, and returns TRUE or FALSE
 * @param text is the text string to be checked
 * @param pattern is the regular expression to be applied
 * @param caseSensitivity Whether the match is case sensitive
 */
export function REGEXTEST(text: string, pattern: string, caseSensitivity: boolean=false): boolean {
  return undefined;
}

/**
 * @summary Replaces part of a text string with a different text string
 * @param oldText is the text string to be changed
 * @param startNum is the position of the first character you want to replace
 * @param numChars is the number of characters to replace
 * @param newText is the text string that will replace old_text
 */
export function REPLACE(oldText: string, startNum: number, numChars: number, newText: string): string {
  let arr = oldText.split("");
  arr.splice(startNum - 1, numChars, newText);
  return arr.join("");
}

/**
 * @hidden DBCS
 * @summary Replaces part of a text string with a different text string using the number of bytes. Uses the double-byte character set (DBCS).
 * @param oldText is the text string to be changed
 * @param startNum is the position of the first character you want to replace
 * @param numBytes is the number of bytes to replace
 * @param newText is the text string that will replace old_text
 */
export function REPLACEB(oldText: string, startNum: number, numBytes: number, newText: string): string {
  return REPLACE(oldText, startNum, numBytes, newText);
}

/**
 * @summary Repeats text a given number of times
 * @param text is the text you want to repeat
 * @param numberTimes is the number of times you want to repeat text
 */
export function REPT(text: string, numberTimes: number): string {
  let str = "";
  for (let i=0; i<numberTimes; i++) {
    str += text;
  }
  return str;
}

/**
 * @summary Returns the specified number of characters from the end of a text string
 * @param text is the text string that contains the characters you want to extract
 * @param numChars specifies how many characters you want to extract
 */
export function RIGHT(text: string, numChars: number=1): string {
  if (numChars < 0) throw FormulaError.BuiltIn.Value;
  const len = text.length;
  if (numChars > len)
    return text;
  return text.slice(len - numChars);
}

/**
 * @summary Returns the rightmost num_bytes characters from text. Uses double-byte characters.
 * @param text is the text string from which you want to extract characters
 * @param numBytes is the number of bytes to extract
 */
export function RIGHTB(text: string, numBytes: number=1): string {
  return RIGHT(text, numBytes);
}

/**
 * @summary Returns the number of the character at which a specific character or text string is first found, reading left to right (not case-sensitive)
 * @param findText Returns the number of the character at which a specific character or text string is first found, reading left to right (not case-sensitive)
 * @param withinText is the text in which you want to search for Find_text
 * @param startNum is the character number in Within_text, counting from the left, at which you want to start searching
 */
export function SEARCH(
  findText: string,
  withinText: string,
  startNum: number=1
): number {
  if (startNum < 1 || startNum > withinText.length) throw FormulaError.BuiltIn.Value;

  // transform to js regex expression
  let findTextRegex = WildCard.isWildCard(findText) ? WildCard.toRegex(findText, 'i') : findText;
  const res = withinText.slice(startNum - 1).search(findTextRegex);
  if (res === -1)
    throw FormulaError.BuiltIn.Value;
  return res + startNum;
}

/**
 * @hidden DBCS
 * @summary Returns the number of the character at which a specific character or text string is first found, reading left to right (not case-sensitive). Uses the double-byte character set (DBCS).
 * @param findText Returns the number of the character at which a specific character or text string is first found, reading left to right (not case-sensitive)
 * @param withinText is the text in which you want to search for Find_text
 * @param startBytes is the character number in Within_text, counting from the left, at which you want to start searching
 */
export function SEARCHB(
  findText: string,
  withinText: string,
  startBytes: number=1
): number {
  return SEARCH(findText, withinText, startBytes);
}

/**
 * @summary Replaces existing text with new text in a text string
 * @param text is the text or the reference to a cell containing text in which you want to substitute characters
 * @param oldText is the existing text you want to replace. If the case of Old_text does not match the case of text, SUBSTITUTE will not replace the text
 * @param newText is the text you want to replace Old_text with
 * @param instanceNum specifies which occurrence of Old_text you want to replace. If omitted, every instance of Old_text is replaced
 */
export function SUBSTITUTE(
  text: string,
  oldText: string,
  newText: string,
  instanceNum?: number
): string {
  if (!text || !oldText) return text;

  if (instanceNum === undefined) {
    instanceNum = -1;
  } else {
    instanceNum = Math.floor(instanceNum);
    if (instanceNum <= 0) throw new FormulaError.Value();
  }

  let result = text;
  let currentIndex = 0;
  let count = 0;

  // Find the nth occurrence
  while ((currentIndex = result.indexOf(oldText, currentIndex)) !== -1) {
    ++count;
    if (count === instanceNum || instanceNum === -1) {
      // Build the result with the replacement
      result = result.substring(0, currentIndex) + newText + result.substring(currentIndex + oldText.length);
    }
    currentIndex += oldText.length;
  }
  return result;
}

/**
 * @summary Checks whether a value is text, and returns the text if it is, or returns double quotes (empty text) if it is not
 * @param value is the value to test
 */
export function T(value: Scalar): string {
  // extract the real parameter
  return (typeof value === "string") ? value : '';
}

// TODO - review
/**
 * @summary Converts a value to text in a specific number format
 * @param value is a number, a formula that evaluates to a numeric value, or a reference to a cell containing a numeric value
 * @param formatText is a text string that defines the number format to use
 */
export function TEXT(
  value: Scalar,
  formatText: string
): string {
  try {
    return FormulaContext.getNumberFormat(formatText, value);
  } catch (e) {
    throw FormulaError.BuiltIn.Value;
  }
}

/**
 * @summary Returns text that's after delimiting characters.
 * @param text The text you want to search for the delimiter.
 * @param delimiter The character or string to use as a delimiter.
 * @param instanceNum The desired occurrence of delimiter. The default is 1. A negative number searches from the end.
 * @param matchMode Searches the text for a delimiter match. By default, a case-sensitive match is done.
 * @param matchEnd Whether to match the delimiter against the end of text. By default, they're not matched.
 * @param ifNotFound Returned if no match is found. By default, #N/A is returned.
 */
export function TEXTAFTER(
  text: string,
  delimiter: string,
  instanceNum: number=1,
  matchMode: number=0,
  matchEnd: number=0,
  ifNotFound: string=undefined
): any { // string|FormulaError.Known
  if (!text || !delimiter) return FormulaError.BuiltIn.Value;
  instanceNum = Math.floor(instanceNum);
  if (instanceNum <= 0) {
    throw FormulaError.BuiltIn.Value;
  }

  // Adjust case sensitivity
  let searchText = text;
  let searchDelimiter = delimiter;
  if (matchMode === 1) {
    searchText = text.toLowerCase();
    searchDelimiter = delimiter.toLowerCase();
  }

  let position = -1;
  let count = 0;

  // Find the nth occurrence of the delimiter
  while (count < instanceNum) {
    position = searchText.indexOf(searchDelimiter, position + 1);
    if (position === -1) return ifNotFound ?? FormulaError.BuiltIn.NA;
    count++;
  }

  // Extract text after the delimiter
  const result = text.substring(position + delimiter.length);

  // If matchEnd is 1, return an empty string when at the end
  return matchEnd === 1 && result.length === 0 ? '' : result;
}

/**
 * @summary Concatenates a list or range of text strings using a delimiter
 * @param delimiter Character or string to insert between each text item
 * @param ignoreEmpty if TRUE(default), ignores empty cells
 * @param text text1,text2,... are 1 to 252 text strings or ranges to be joined
 */
export function TEXTJOIN(
  delimiter: string,
  ignoreEmpty: boolean,
  ...text: IRange[]
): string {
  let result: string = '';
  for (const range of text) {
    for (const value of range.values<string>({
        type: ScalarType.String,
        coerce: true,
        orientation: IRange.Orientation.Row,
        includeEmpty: !ignoreEmpty
      })) {
      if (value.length === 0 && ignoreEmpty) continue; // An empty string is not considered empty for ranges.
      if (result.length > 0) {
        result += delimiter;
      }
      result += value;
    }
  }
  return result;
}

/**
 * @summary Splits text into rows or columns using delimiters.
 * @param text The text to split
 * @param colDelimiter The column delimiter(s) - can be string or array of strings
 * @param rowDelimiter The row delimiter(s), null/undefined means no row splitting
 * @param ignoreEmpty Whether to ignore empty values (defaults to `false`)
 * @param matchMode Whether to use case-sensitive (0) or case-insensitive (1) match (defaults to `0`)
 * @param padWith Value to use for padding if matrix is uneven (defaults to `#N/A`)
 */
export function TEXTSPLIT(
  text: string,
  colDelimiter: string[],
  rowDelimiter: string[]=null,
  ignoreEmpty: boolean=false,
  matchMode: number=0,
  padWith: string=undefined
): any { // ((string|FormulaError.NA)[][])
  if (!text) return [[""]];
  if (matchMode !== 0 && matchMode !== 1) throw FormulaError.BuiltIn.Value;

  // Function to split text using multiple delimiters
  const splitByDelimiters = (input: string, delimiters: string[], caseInsensitive: boolean): string[] => {
    if (delimiters.length === 0) return [input]; // No split if no delimiters provided
    // TODO - create a last used regex cache
    const regex = new RegExp(delimiters.map(d => escapeRegex(d)).join('|'), caseInsensitive ? 'gi' : 'g');
    return input.split(regex);
  };

  // Split rows first if rowDelimiter is provided
  let rows: string[] = [text];
  if (rowDelimiter) {
    rows = splitByDelimiters(text, rowDelimiter, matchMode === 1);
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
  const result: (string|FormulaError.NA)[][] = [];
  let maxColumns = 0;
  let minColumns = Number.MAX_SAFE_INTEGER;

  for (let i=0; i<rows.length; i++) {
    const row = rows[i];
    let columns = splitByDelimiters(row, colDelimiter, matchMode === 1);
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
    const padValue = padWith || FormulaError.BuiltIn.NA;
    for (let i=0; i<result.length; i++) {
      const row = result[i];
      while (row.length < maxColumns) {
        row.push(padValue);
      }
    }
  }

  return result.length > 0 ? result : [[""]]; // Return at least an empty cell
}

/**
 * @summary Returns text that's before delimiting characters.
 * @param text The text you want to search for the delimiter.
 * @param delimiter The character or string to use as a delimiter.
 * @param instanceNum The desired occurrence of delimiter. The default is 1. A negative number searches from the end.
 * @param matchMode Whether to use case-sensitive (0) or case-insensitive (1) match (defaults to `0`)
 * @param matchEnd Whether to match the delimiter against the end of text. By default, they're not matched.
 * @param ifNotFound Returned if no match is found. By default, #N/A is returned.
 */
export function TEXTBEFORE(
  text: string,
  delimiter: string,
  instanceNum: number=1,
  matchMode: number=0,
  matchEnd: number=0,
  ifNotFound: string=undefined
): any { // (string | FormulaError.Known)
  if (!text || !delimiter) return FormulaError.BuiltIn.Value;
  instanceNum = Math.floor(instanceNum);
  if (instanceNum <= 0) {
    throw FormulaError.BuiltIn.Value;
  }

  // Adjust case sensitivity
  let searchText = text;
  let searchDelimiter = delimiter;
  if (matchMode === 1) {
    searchText = text.toLowerCase();
    searchDelimiter = delimiter.toLowerCase();
  }

  let position = -1;
  let count = 0;

  // Find the nth occurrence of the delimiter
  while (count < instanceNum) {
    position = searchText.indexOf(searchDelimiter, position + 1);
    if (position === -1) return ifNotFound ?? FormulaError.BuiltIn.NA;
    count++;
  }

  // Extract text before the delimiter
  const result = text.substring(0, position);

  // If matchEnd is 1 and the entire text is before the delimiter, return an empty string
  return matchEnd === 1 && result.length === 0 ? "" : result;
}

/**
 * @hidden Unimplemented
 * @summary Translate a text string from one language to another using the Microsoft Translator service.
 * @param text The text to translate.
 * @param sourceLanguage Specifiy the source language your text is currently in. Expressed as a two-letter language code.
 * @param targetLanguage Specifiy the source language you want your text to be translated to. Expressed as a two-letter language code.
 */
export function TRANSLATE(text: string, sourceLanguage: string, targetLanguage: string): string {
  return undefined;
}

/**
 * @summary Removes all spaces from text except for single spaces between words.
 * @param text The text from which you want to remove extra spaces.
 */
export function TRIM(text: string): string {
  return text.replace(/^\s+|\s+$/g, '')
}

/**
 * @summary Returns the Unicode character referenced by the given numeric value
 * @param number is the Unicode number representing a character
 */
export function UNICHAR(number: number): string {
  if (number <= 0)
    throw FormulaError.BuiltIn.Value;
  return String.fromCharCode(number);
}

/**
 * @summary Returns the number (code point) corresponding to the first character of the text
 * @param text is the character that you want the Unicode value of
 */
export function UNICODE(text: string): number {
  return CODE(text);
}

/**
 * @summary Converts a text string to all uppercase letters
 * @param text is the text you want converted to uppercase, a reference or a text string
 */
export function UPPER(text: string): string {
  return text.toUpperCase();
}

/**
 * @summary Converts a text string that represents a number to a number
 * @param text is the text enclosed in quotation marks or a reference to a cell containing the text you want to convert
 */
export function VALUE(text: string): number {
  // TODO - use our text parser as this doesn't capture all cases
  const number = Number(text);
  if (isNaN(number))
    throw FormulaError.BuiltIn.Value;
  return number;
}

/**
 * @summary Returns a text representation of a value
 * @param value the value to represent as text
 * @param format the format of the text
 */
export function VALUETOTEXT(
  value: Scalar,
  format: number=0
): string {
  format = Math.floor(format);
  if (format !== 0 && format !== 1) {
    throw FormulaError.BuiltIn.Value;
  }
  const strict = format === 1;
  if (value === null) {
    // do nothing
  } else if (typeof value === 'string') {
    return strict ? '"' + value + '"' : value;
  } else if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  } else {
    return value.toString();
  }
  return '';
}