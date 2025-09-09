import type { IWorkbook } from '@sheetxl/sdk';


// Re-export all types from @sheetxl/io
export type * from '@sheetxl/io';

// Import specific types we need locally
import type {
  ReadWorkbookOptions, WorkbookHandle, ReadFormatType, WriteFormatType, WriteWorkbookOptions
} from '@sheetxl/io';

import { IReactNotifier } from '@sheetxl/utils-react';

// Copied from @sheetxl/io
const DEFAULT_LOAD_TYPES: ReadFormatType[] = [
  {
    key: 'SheetXL',
    description: 'SheetXL',
    mimeType: '.sxl',
    exts: ['sxl'],
    handler: null,
    isDefault: true
  },
  {
    key: 'CSV',
    description: 'Comma Delimited',
    mimeType: 'text/csv',
    exts: ['csv'],
    handler: null
  },
  {
    key: 'Excel',
    description: 'Excel Workbook',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    exts: [
      'xlsx', // Excel Workbook
      'xls', // Excel 97-2003 Workbook
      'xlsm', // Excel Macro-Enabled Workbook
      // 'xlsb', // Excel Binary Workbook
      // 'xltx', // Excel Template
      // 'xltm' // Excel Macro-Enabled Template
    ],
    handler: null
  }
];

const DEFAULT_SAVE_TYPES: WriteFormatType[] = [
  { key: 'SheetXL', mimeType: 'application/vnd.sheetxl.sheet', description: 'SheetXL', ext: 'sxl', handler: null, isDefault: true }, // our json extension. Note - We will be adding a compressed flavor with only .sxlz
  { key: 'CSV', mimeType: 'text/csv', description: 'Comma Delimited', ext: 'csv', handler: null },
  { key: 'Excel', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', description: 'Excel Workbook', ext: 'xlsx', tags: ['SheetJS Pro'], handler: null }
];

/**
 * Wraps the IO WorkbookIO class to provide lazy import.
 *
 * Documented
 */
export class _WorkbookIO {

  private _readFormatType: readonly ReadFormatType[] = [];
  private _writeFormatType: readonly WriteFormatType[] = [];

  constructor(readFormatType: ReadFormatType[]=DEFAULT_LOAD_TYPES, writeFormatType: WriteFormatType[]=DEFAULT_SAVE_TYPES) {
    this._readFormatType = Object.freeze([...readFormatType]);
    this._writeFormatType = Object.freeze([...writeFormatType]);
  }

  // TODO - make this a promise
  getReadFormats(): readonly ReadFormatType[] {
    return this._readFormatType;
  }

  // TODO - make this a promise
  getWriteFormats(): readonly WriteFormatType[] {
    return this._writeFormatType;
  }

  /**
   * A string array of all the mimeTYpes. Used for the input accept attribute.
   *
   * @returns An array of strings for the input types.
   */
  getAllReadFormatTypeAsString(): string[] {
    const inputTypes:string[] = [];
    const types = this._readFormatType;
    for (let i=0; i<types.length; i++) {
      // inputTypes.push(types[i].mimeType);
      for (let j=0; j<types[i].exts.length; j++) {
        inputTypes.push('.' + types[i].exts[j]);
      }
    }
    return inputTypes;
  }

  /**
   * Exports to the local file system attempting to use the fileName provided. This will
   * use the exportType to determine the export handler to use.
   *
   * @returns a Promise indicating success or failure.
   */
  async writeFile(fileName: string | null, workbook: IWorkbook, options?: WriteWorkbookOptions): Promise<boolean> {
    if (!workbook || !fileName) {
      throw new Error('Workbook model or file name must be provided.');
    }
    try {
      const moduleIO = await import(/* webpackChunkName: "io" */'@sheetxl/io');
      return moduleIO.WorkbookIO.writeFile(
        fileName,
        workbook,
        options
      )
    } catch (error: any) {
      throw new Error('Unable to load io library', { cause: error });
    }
  }

  /**
   * Returns A record that includes a title and a promise for the workbook.
   *
   * @param options {@link ReadWorkbookOptions}
   */
  async read(
    options: ReadWorkbookOptions,
    notifier?: IReactNotifier
  ): Promise<WorkbookHandle> {
    let hideBusyReading:any;
    let ioModule:any;
    const hideBusyOpening = await notifier?.showBusy?.(`Opening${options.name ? ` ${options.name}` : ''}...`);
    try {
      ioModule = await import(/* webpackChunkName: "io" */'@sheetxl/io');
    } catch (error) {
      throw error;
    }
    try {
      const retValue:WorkbookHandle = await ioModule.WorkbookIO.read({
        ...options,
        progress: {
          async onStart(name: string): Promise<void> {
            await options?.progress?.onStart?.(name);
            hideBusyReading = await notifier?.showBusy?.(`Opening '${name}'...`);
          }
        }
      });
      return retValue;
    } catch (error: any) {
      // before rethrow
      hideBusyOpening?.();
      hideBusyReading?.();
      throw error;
      // If the error is a string, we can assume it's
    } finally {
      hideBusyOpening?.();
      hideBusyReading?.();
    }
  }
}

/**
 * A Singleton instance that lazy wraps '@sheetxl/io/WorkbookIO'.
 */
export const WorkbookIO = new _WorkbookIO();
