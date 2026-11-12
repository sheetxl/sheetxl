import { type IWorkbookIO } from '@sheetxl/sdk';

import { IOPlugin as ExcelPlugin } from '@sheetxl/io-xlsx';

import { SXLPlugin, CSVPlugin } from './formats';

/**
 * Registers all built-in read and write formats with the provided WorkbookIO registry.
 *
 * @param registry - The WorkbookIO instance to register formats with. Defaults to the global WorkbookIO.
 */
export const IOPlugin: IWorkbookIO.Plugin = {
  name: '@sheetxl/io',
  version: typeof __BUILD_VERSION__ !== 'undefined' ? __BUILD_VERSION__ : '0.0.0',
  description: 'Built-in I/O formats for SheetXL',
  author: 'SheetXL',
  async register(registry: IWorkbookIO.Registry): Promise<void> {
    await SXLPlugin.register(registry);
    await CSVPlugin.register(registry);
    await ExcelPlugin.register(registry);
  }
};