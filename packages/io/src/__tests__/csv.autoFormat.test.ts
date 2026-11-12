import { describe, expect, it } from 'vitest';

import { type IWorkbook } from '@sheetxl/sdk';

import { readCSV } from '../formats/csv/CSVReader';

/**
 * A CSV cell is entered as if typed: a formula takes the format Excel gives it on entry, where a
 * script's setFormula keeps the cell's format.
 */
describe('readCSV formats formulas as typed', () => {

  const read = async (text: string, options?: Parameters<typeof readCSV>[1]): Promise<IWorkbook> => {
    const workbook = await readCSV(new TextEncoder().encode(text).buffer as ArrayBuffer, options);
    await workbook.getCalculation().ready();
    return workbook;
  };
  const numberFormat = (workbook: IWorkbook, address: string): string =>
    workbook.getSelectedWorksheet().getRange(address).getStyle().getNumberFormat().toString();

  it('gives a date or time formula its format', async () => {
    const workbook = await read('"=DATE(2026,10,17)","=TIME(18,0,0)",=NOW(),=1+1');
    try {
      expect(numberFormat(workbook, 'A1')).toBe('Short Date');
      expect(numberFormat(workbook, 'B1')).toBe('h:mm AM/PM');
      expect(numberFormat(workbook, 'C1')).toBe('Short DateTime');
      expect(numberFormat(workbook, 'D1')).toBe('General');
    } finally {
      workbook.close();
    }
  });

  it('leaves formulas unformatted when the caller opts out', async () => {
    const workbook = await read('=TODAY()', { setValuesOptions: { autoFormat: false } });
    try {
      expect(numberFormat(workbook, 'A1')).toBe('General');
    } finally {
      workbook.close();
    }
  });
});
