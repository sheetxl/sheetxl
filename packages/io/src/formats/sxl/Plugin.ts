import { type IWorkbookIO, type IWorkbook } from '@sheetxl/sdk';

import { defineLazyModule } from '@sheetxl/utils';

import { type WriteJSONOptions } from './Types';

const SXLReaderModule = defineLazyModule('io:sxlReader', () => import('./SXLReader'));
const SXLWriterModule = defineLazyModule('io:sxlWriter', () => import('./SXLWriter'));

/**
 * Both SheetXL formats decode with the same reader — the payload is identical and `readSXL` sniffs
 * the gzip magic number, so a compressed `.json` or a plain `.sxl` still opens. Only the *write*
 * side is opinionated (see below).
 */
const readHandler = async (arrayBuffer: ArrayBuffer, options?: IWorkbookIO.ReadOptions): Promise<IWorkbook> => {
  const module = await SXLReaderModule.load();
  return module.readSXL(arrayBuffer, options);
}

/**
 * Builds a write handler carrying per-format defaults. An explicit caller option always wins, so a
 * programmatic `writeArrayBuffer(wb, { format: 'JSON', compress: true })` is still honored.
 */
const writeHandler = (
  defaults: Pick<WriteJSONOptions, 'compress' | 'whiteSpace'>
): IWorkbookIO.WriteHandler =>
  async (workbook: IWorkbook, options?: WriteJSONOptions): Promise<ArrayBufferLike> => {
    const module = await SXLWriterModule.load();
    return module.writeSXL(workbook, {
      ...options,
      compress: options?.compress ?? defaults.compress,
      whiteSpace: options?.whiteSpace ?? defaults.whiteSpace
    });
  }

const ReadFormat: IWorkbookIO.ReadFormatType = {
  key: 'SheetXL',
  description: 'SheetXL Workbook',
  mimeType: 'application/vnd.sheetxl.sheet',
  exts: ['sxl'],
  handler: readHandler
}

const ReadFormatJSON: IWorkbookIO.ReadFormatType = {
  key: 'JSON',
  description: 'SheetXL Workbook (JSON)',
  mimeType: 'application/json',
  exts: ['json'],
  handler: readHandler
}

/** `.sxl` is the shipping container: compressed and minified. */
const WriteFormat: IWorkbookIO.WriteFormatType = {
  key: 'SheetXL',
  mimeType: 'application/vnd.sheetxl.sheet',
  description: 'SheetXL Workbook',
  exts: ['sxl'],
  handler: writeHandler({ compress: true, whiteSpace: 0 })
}

/**
 * `.json` is the shop window: never compressed, always pretty-printed. It exists to show that the
 * file format is open, and for development — both of which require it to stay readable in a text
 * editor.
 *
 * @remarks
 * This is why the two are registered as separate formats rather than one format with two
 * extensions: the compression/whitespace decision *is* the difference between them, and a format
 * that cannot say which of its extensions it is writing cannot make that decision. Excel gives each
 * format exactly one extension for the same reason.
 *
 * `advanced` for the same reason it exists: the audience that wants a readable `.json` is the one
 * that already knows to ask for it, so it stays in the save picker's type dropdown and out of the
 * Save As menu, where it would otherwise sit next to `'SheetXL Workbook'` inviting a choice whose
 * stakes are invisible.
 */
const WriteFormatJSON: IWorkbookIO.WriteFormatType = {
  key: 'JSON',
  mimeType: 'application/json',
  description: 'SheetXL Workbook (JSON)',
  exts: ['json'],
  advanced: true,
  handler: writeHandler({ compress: false, whiteSpace: 2 })
}

/**
 * Registers all built-in read and write formats with the provided WorkbookIO registry.
 *
 * @param registry - The WorkbookIO instance to register formats with. Defaults to the global WorkbookIO.
 */
export const SXLPlugin: IWorkbookIO.Plugin = {
  name: 'SXLPlugin',
  version: typeof __BUILD_VERSION__ !== 'undefined' ? __BUILD_VERSION__ : '0.0.0',
  description: 'Import and export SXL format',
  author: 'SheetXL',
  async register(registry: IWorkbookIO.Registry): Promise<void> {
    await registry.registerReadFormat(ReadFormat);
    await registry.registerReadFormat(ReadFormatJSON);
    await registry.registerWriteFormat(WriteFormat);
    await registry.registerWriteFormat(WriteFormatJSON);
  }
};
