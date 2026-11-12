import { type IWorkbookIO, type IWorkbook } from '@sheetxl/sdk';

import { defineLazyModule } from '@sheetxl/utils';

import { type ReadCSVOptions, type WriteCSVOptions } from './Types';

const CSVReaderModule = defineLazyModule('io:csvReader', () => import('./CSVReader'));
const CSVWriterModule = defineLazyModule('io:csvWriter', () => import('./CSVWriter'));

const ReadFormat: IWorkbookIO.ReadFormatType = {
  key: 'CSV',
  description: 'Comma Separated Values',
  mimeType: 'text/csv',
  exts: ['csv'],
  async handler(arrayBuffer: ArrayBuffer, options?: ReadCSVOptions): Promise<IWorkbook> {
    const module = await CSVReaderModule.load();
    return module.readCSV(arrayBuffer, options);
  }
}

const WriteFormat: IWorkbookIO.WriteFormatType = {
  key: 'CSV',
  mimeType: 'text/csv',
  description: 'Comma Separated Values',
  exts: ['csv'],
  async handler(workbook: IWorkbook, options?: WriteCSVOptions): Promise<ArrayBufferLike> {
    const module = await CSVWriterModule.load();
    return module.writeCSV(workbook, options);
  }
}

/**
 * Registers all built-in read and write formats with the provided WorkbookIO registry.
 *
 * @param registry - The WorkbookIO instance to register formats with. Defaults to the global WorkbookIO.
 */
export const CSVPlugin: IWorkbookIO.Plugin = {
  name: 'CSVPlugin',
  version: typeof __BUILD_VERSION__ !== 'undefined' ? __BUILD_VERSION__ : '0.0.0',
  description: 'Import and export CSV format',
  author: 'SheetXL',
  async register(registry: IWorkbookIO.Registry): Promise<void> {
    await registry.registerReadFormat(ReadFormat);
    await registry.registerWriteFormat(WriteFormat);
  }
};
