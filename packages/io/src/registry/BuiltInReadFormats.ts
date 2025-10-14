import type { IWorkbook } from '@sheetxl/sdk';

import type { ReadCSVOptions, ReadXLSXOptions } from '../handlers';
import type { ReadFormatType, ReadWorkbookOptions } from '../types';

// Note - Chrome open dialog doesn't give all extensions or a nice drop down for windows like native applications.
// Note - WebFileSystem API
// TODO - use mime-types/mime-db library for this?
// TODO - merge import export registries?
export const BuiltinReadFormats: ReadFormatType[] = [
  {
    key: 'SheetXL',
    description: 'SheetXL',
    mimeType: '.sxl',
    exts: ['sxl', 'json'],
    isDefault: true,
    async handler(arrayBuffer: ArrayBuffer, options?: ReadWorkbookOptions): Promise<IWorkbook> {
      const handlers = await import('../handlers/sxl/Handler');
      return handlers.readBufferSXL(arrayBuffer, options);
    }
  }, // our json extension. Note - We will be adding a compressed flavor with only .sxlz
  { key: 'CSV',
    description: 'Comma Delimited',
    mimeType: 'text/csv',
    exts: ['csv'],
    async handler(arrayBuffer: ArrayBuffer, options?: ReadCSVOptions): Promise<IWorkbook> {
      const handlers = await import('../handlers/csv/Handler');
      return handlers.readBufferCSV(arrayBuffer, options);
    }
  },
  { key: 'Excel',
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
    async handler(arrayBuffer: ArrayBuffer, options?: ReadXLSXOptions): Promise<IWorkbook> {
      const handlers = await import('../handlers/xlsx/Handler');
      return handlers.readBufferXLSX(arrayBuffer, options);
    }
  }
];