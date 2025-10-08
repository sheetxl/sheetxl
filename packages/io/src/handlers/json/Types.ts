import { IWorkbook } from '@sheetxl/sdk';

import { WriteWorkbookOptions } from '../../types';

/**
 * Options for exporting to JSON file format.
 */
export interface WriteJSONOptions extends WriteWorkbookOptions {
  /**
   * If set to a number then JSON will add white space to make the JSON more human readable.
   *
   * @defaultValue - `2` in dev and `0` in prod
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
   * @defaultValue - 'false' in 'dev' and 'true' in 'prod'
   */
  compress?: boolean;// | string;
}