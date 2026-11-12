import { describe, expect, it } from 'vitest';

import { Workbook } from '@sheetxl/sdk';

import { writeCSV } from '../formats/csv/CSVWriter';

/**
 * Excel's Save As CSV writes each cell as it is displayed, number format applied - not the formula
 * bar's text. A format's literal spaces are written as spaces, not the NBSP the grid paints.
 */
describe('writeCSV writes the displayed text', () => {

  const decode = (buffer: ArrayBufferLike): string =>
    new TextDecoder().decode(new Uint8Array(buffer)).replace(/\r\n/g, '\n').trim();

  it('applies the number format', async () => {
    const workbook = new Workbook();
    const sheet = workbook.getSelectedWorksheet();
    sheet.getRange('A1:E1').setValues([[45292.625, 1234.5, 0.125, 'text', true]]);
    sheet.getRange('A1').getStyle().setNumberFormat('Short DateTime');
    sheet.getRange('B1').getStyle().setNumberFormat('0.00');
    sheet.getRange('C1').getStyle().setNumberFormat('0%');

    const csv = decode(await writeCSV(workbook, {}) as ArrayBufferLike);
    expect(csv).toBe('1/1/2024 15:00,1234.50,13%,text,TRUE');
  });
});
