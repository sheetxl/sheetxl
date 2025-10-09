import type { IWorkbook } from '@sheetxl/sdk';

import type { WriteWorkbookOptions, WriteFormatType } from '../types';

export const BuiltinWriteFormats: WriteFormatType[] = [
  { key: 'SheetXL', mimeType: 'application/vnd.sheetxl.sheet', description: 'SheetXL', exts: ['sxl'], isDefault: true,
    async handler(workbook: IWorkbook, options?: WriteWorkbookOptions): Promise<ArrayBufferLike> {
      const handlers = await import('../handlers/sxl/Handler');
      return handlers.writeBufferSXL(workbook, options);
    }
   },
  { key: 'CSV', mimeType: 'text/csv', description: 'Comma Delimited', exts: ['csv'],
    async handler(workbook: IWorkbook, options?: WriteWorkbookOptions): Promise<ArrayBufferLike> {
      const handlers = await import('../handlers/csv/Handler');
      return handlers.writeBufferCSV(workbook, options);
    }
  },
  { key: 'Excel', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', description: 'Excel Workbook', exts: ['xlsx'], tags: ['SheetJS Pro'],
    async handler(workbook: IWorkbook, options?: WriteWorkbookOptions): Promise<ArrayBufferLike> {
      const handlers = await import('../handlers/xlsx/Handler');
      return handlers.writeBufferXLSX(workbook, options);
    }
   }
];