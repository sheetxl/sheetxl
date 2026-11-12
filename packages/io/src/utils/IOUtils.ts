// Names are validated against the strictest common ruleset (Windows) so that a
// name accepted here is portable across all platforms and cloud storage
// (OneDrive/SharePoint). A host-specific check would accept names that break the
// moment a file is moved to Windows, so this is deliberately not conditional.
const FILENAME_RESERVED_REGEX = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
// Not global: used only with `.test()`, where the `g` flag makes results stateful.
// eslint-disable-next-line no-control-regex
const FILENAME_CHAR_RESERVED_REGEX = /[<>:"/\\|?*\u0000-\u001F]/;

/** Maximum length, in characters, of a workbook name. */
export const MAX_WORKBOOK_NAME_SIZE = 96;

/**
 * Returns `true` if `char` is not allowed in a portable file name.
 *
 * @param char A single character (for example a keypress) to test.
 */
export const isReservedFileNameChar = (char: string): boolean => {
  return FILENAME_CHAR_RESERVED_REGEX.test(char);
}

/**
 * Returns `true` if `input` is a valid, portable file name.
 *
 * @remarks
 * Validation uses the strictest common ruleset (Windows) so the name is safe on
 * every platform and cloud storage, regardless of the current host.
 *
 * @param input The string to validate.
 */
export const isValidFileName = (input: string): boolean => {
  if (!input || input.length > 255) {
    return false;
  }

  if (FILENAME_CHAR_RESERVED_REGEX.test(input) || FILENAME_RESERVED_REGEX.test(input)) {
    return false;
  }

  if (input === '.' || input === '..') {
    return false;
  }

  return true;
}
