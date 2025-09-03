import { path } from '@sheetxl/io/lib/path';

export const WINDOW_FILENAME_RESERVED_REGEX =  /^(con|prn|aux|nul|com\d|lpt\d)$/i;
// TODO - this belongs is workbook io package
export const MAX_WORKBOOK_NAME_SIZE = 96;
// eslint-disable-next-line no-control-regex
export const WINDOW_FILENAME_CHAR_RESERVED_REGEX =  /[<>:"/\\|?*\u0000-\u001F]/g;

/**
 * Returns a boolean indicating the the string name is a valid windows filename.
 * @param input The string to validate.
 */
export const isValidWindowsFilename = (input: string): boolean => {
  if (!input || input.length > 255) {
    return false;
  }

  if (WINDOW_FILENAME_CHAR_RESERVED_REGEX.test(input) || WINDOW_FILENAME_RESERVED_REGEX.test(input)) {
    return false;
  }

  if (input === '.' || input === '..') {
    return false;
  }

  return true;
}

/**
 * Returns a single path string from the current folder and relative path.
 * If relativePath is already absolute (including URLs with different domains), returns it as-is.
 */
export const relativePath = (currentFolder: string, relativePath: string): string => {
  // Check if relativePath is already absolute (URL or absolute path)
  try {
    // If it's a valid URL, return it as-is
    new URL(relativePath);
    return relativePath;
  } catch {
    // Not a valid URL, continue with path resolution
  }

  // Check if it's an absolute file path (starts with / or Windows drive letter)
  if (relativePath.startsWith('/') || /^[a-zA-Z]:/.test(relativePath)) {
    return relativePath;
  }
  // Handle relative paths
  if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    // Browser context - use URL constructor for proper resolution
    try {
      let baseUrl = currentFolder.startsWith('http') ? currentFolder : `file:///${currentFolder.replace(/\\/g, '/')}`;
      // Ensure baseUrl is treated as a directory by adding trailing slash if not present
      if (!baseUrl.endsWith('/')) {
        baseUrl += '/';
      }
      const resolved = new URL(relativePath, baseUrl);
      return resolved.href;
    } catch {
      // Fallback to anchor element method
      const a = document.createElement('a');
      let baseUrl = currentFolder;
      if (!baseUrl.endsWith('/')) {
        baseUrl += '/';
      }
      a.href = new URL(relativePath, baseUrl).href;
      return a.href;
    }
  } else if (typeof require !== 'undefined' && typeof process !== 'undefined') {
    // Node.js context
    return path.resolve(currentFolder, relativePath);
  } else {
    throw new Error('Unsupported environment');
  }
}
