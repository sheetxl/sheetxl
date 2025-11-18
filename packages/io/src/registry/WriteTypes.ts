import type { IWorkbook } from '@sheetxl/sdk';

import type { WriteWorkbookOptions, WriteFormatType } from '../types';

export const DefaultWriteTypes: WriteFormatType[] = [
  { key: 'SheetXL', mimeType: 'application/vnd.sheetxl.sheet', description: 'SheetXL', ext: 'sxl', isDefault: true,
    async handler(workbook: IWorkbook, options?: WriteWorkbookOptions): Promise<ArrayBufferLike> {
      const handlers = await import('../handlers/json');
      return handlers.toBufferJSON(workbook, options);
    }
   }, // our json extension. Note - We will be adding a compressed flavor with only .sxlz
  { key: 'CSV', mimeType: 'text/csv', description: 'Comma Delimited', ext: 'csv',
    async handler(workbook: IWorkbook, options?: WriteWorkbookOptions): Promise<ArrayBufferLike> {
      const handlers = await import('../handlers/csv');
      return handlers.toBufferCSV(workbook, options);
    }
  },
  { key: 'Excel', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', description: 'Excel Workbook', ext: 'xlsx', tags: ['SheetJS Pro'],
    async handler(workbook: IWorkbook, options?: WriteWorkbookOptions): Promise<ArrayBufferLike> {
      const handlers = await import('@sheetxl/io-xlsx');
      return handlers.toBuffer(workbook, options);
    }
   }
];