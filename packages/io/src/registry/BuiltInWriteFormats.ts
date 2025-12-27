import type { IWorkbook } from '@sheetxl/sdk';

import type { WriteJSONOptions, WriteCSVOptions, WriteXLSXOptions } from '../handlers';
import type { WriteFormatType } from '../types';

export const BuiltinWriteFormats: WriteFormatType[] = [
  {
    key: 'SheetXL',
    mimeType: 'application/vnd.sheetxl.sheet',
    description: 'SheetXL',
    exts: ['sxl', 'json'],
    isDefault: true,
    async handler(workbook: IWorkbook, options?: WriteJSONOptions): Promise<ArrayBufferLike> {
      if (options?.format === 'json') {
        options = {
          compress: false,
          ...options
        };
      }
      const handlers = await import('../handlers/sxl/Handler');
      return handlers.writeBufferSXL(workbook, options);
    }
   },
  {
    key: 'CSV',
    mimeType: 'text/csv',
    description: 'Comma Delimited',
    exts: ['csv'],
    async handler(workbook: IWorkbook, options?: WriteCSVOptions): Promise<ArrayBufferLike> {
      const handlers = await import('../handlers/csv/Handler');
      return handlers.writeBufferCSV(workbook, options);
    }
  },
  {
    key: 'Excel',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    description: 'Excel Workbook',
    exts: ['xlsx'],
    tags: ['SheetJS Pro'],
    async handler(workbook: IWorkbook, options?: WriteXLSXOptions): Promise<ArrayBufferLike> {
      const handlers = await import('../handlers/xlsx/Handler');
      return handlers.writeBufferXLSX(workbook, options);
    }
   }
];