import { ReadWorkbookOptions, WriteWorkbookOptions } from '../../types';

/**
 * Options for exporting to XLSX file format.
 */
export interface WriteXLSXOptions extends WriteWorkbookOptions {
  password?: string;
}

/**
 * Options for importing from XLSX file format.
 */
export interface ReadXLSXOptions extends ReadWorkbookOptions {
  password?: string;
}
