import { describe, expect, it } from 'vitest';

import { Workbook, WorkbookIO } from '@sheetxl/sdk';

import { IOPlugin } from '..';

WorkbookIO.install(IOPlugin);

/**
 * An explicit `format` wins over the source's file name: a host holding bytes in another format
 * than the document they belong to (VS Code's `.sxl` hot-exit backup of an `.xlsx`) reads them as
 * what they are, and the workbook keeps the document's name.
 */
describe('read format', () => {
  it('reads by the explicit format, not the name\'s extension', async () => {
    const workbook = new Workbook();
    (workbook.getSheets()[0] as any).getRange('A1').setValues([[42]]);
    const sxl = await WorkbookIO.writeArrayBuffer(workbook, { format: 'sxl' });
    workbook.close();

    const back = (await WorkbookIO.read({ source: new File([sxl as ArrayBuffer], 'book.xlsx'), format: 'sxl' }))!;
    try {
      expect((back.getSheets()[0] as any).getRange('A1').getValues()).toEqual([[42]]);
      expect(back.getOrigin().getPath()).toMatch(/book\.xlsx$/);
    } finally {
      back.close();
    }
  });
});
