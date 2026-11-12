// cspell:ignore papaparse, Unparse
import { type ParseConfig, type UnparseConfig } from 'papaparse';

import { type ICellRange, type IWorkbookIO } from '@sheetxl/sdk';

/**
 * Options for exporting to CSV file format.
 *
 * @remarks
 * The default options mimic Excel 2024.
 */
export interface WriteCSVOptions extends IWorkbookIO.WriteOptions {
  /**
   * Indicate whether hidden columns and rows are skipped in the CSV output.
   * @defaultValue false
   */
  ignoreHidden?: boolean;
  /**
   * Indicates whether the leading blank rows should be trimmed.
   *
   * @defaultValue false
   */
  trimLeadingBlankRow?: boolean;
  /**
   * Indicates whether the leading blank columns should be trimmed.
   *
   * @defaultValue true
   */
  trimLeadingBlankColumn?: boolean;
  /**
   * Specify the tab to export.
   *
   * @remarks
   *
   * CSV Will only export one tab. By default this is the active tab. To change this pass a SheetKey.
   *
   * @defaultValue 'the current active tab'
   */
  sheetKey?: string | number;
  /**
   * configuration for csv export
   *
   * @remarks
   *
   * CSV parse delegates to the excellent Papa Parse library.
   * All options are exposes via papParseConfig.
   *
   * @see
   * {@link https://www.papaparse.com/docs#unparse-config-default}
   *
   */
  papaParseConfig?: UnparseConfig;
}

/**
 * Options for importing from CSV file format.
 *
 * @remarks
 * The default options mimic Excel 2024.
 */
export interface ReadCSVOptions extends IWorkbookIO.ReadOptions {
  /**
   * Options specific for setting values.
   */
  setValuesOptions?: ICellRange.SetValuesOptions;
  /**
   * Options specific for csv parsing.
   *
   * @remarks
   * CSV parse delegates to the excellent Papa Parse library.
   *
   * @see
   * {@link https://www.papaparse.com/docs#config}
   */
  papaParseConfig?: ParseConfig;
}
