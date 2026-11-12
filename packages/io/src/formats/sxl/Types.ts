import { type IWorkbook, type IWorkbookIO } from '@sheetxl/sdk';

/**
 * Options for exporting to JSON file format.
 */
export interface WriteJSONOptions extends IWorkbookIO.WriteOptions {
  /**
   * If set to a number then JSON will add white space to make the JSON more human readable.
   *
   * @defaultValue `0` for the `SheetXL` (`.sxl`) format, `2` for `JSON` (`.json`)
   *
   * @remarks
   * Setting this to a non `0` values maybe greatly increase the JSON size.
   */
  whiteSpace?: number;
  /**
   * If implemented called after json and before serializing.
   *
   * @remarks
   * Any changes made to the json will be serialized.
   */
  beforeWrite?(source: IWorkbook, json: IWorkbook.JSON): void;
  /**
   * Indicates if file should be compressed using gzip.
   *
   * @defaultValue `true` for the `SheetXL` (`.sxl`) format, `false` for `JSON` (`.json`)
   *
   * @remarks
   * `.json` is never compressed by default: it exists to be readable in a text editor. Reading is
   * unaffected either way — the reader sniffs the gzip magic number.
   */
  compress?: boolean;// | string;
}