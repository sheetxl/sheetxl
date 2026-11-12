import { describe, expect, it } from 'vitest';

import { Workbook, type IWorkbook } from '@sheetxl/sdk';

import { writeCSV } from '../formats/csv/CSVWriter';

/**
 * End-to-end proof that a `GetRangeOptions` value is sticky.
 *
 * `writeCSV` sets `ignoreHidden` ONCE, on `getUsedRange`, and never mentions it again — the option
 * has to survive `getUsedRange` → `getOffsetTo` → `forEach` on its own. It used to be dropped
 * silently (the range constructor never stored the options it was handed), so the flag was
 * documented, accepted, and inert. This test fails if that carrier breaks again.
 */
describe('WriteCSVOptions.ignoreHidden rides the range', () => {

  const decode = (buffer: ArrayBufferLike): string =>
    new TextDecoder().decode(new Uint8Array(buffer)).replace(/\r\n/g, '\n').trim();

  /** A 3x2 grid with row 2 and column B hidden. */
  const newWorkbook = (): IWorkbook => {
    const workbook = new Workbook();
    const sheet = workbook.getWorksheets().getByName('Sheet1')!;
    sheet.getRange('A1:B3').setValues([
      ['a1', 'b1'],
      ['a2', 'b2'],
      ['a3', 'b3']
    ]);
    sheet.getRowHeaders().updateHeaderPairs([{ address: '2:2', update: { hidden: true } }]);
    sheet.getColumnHeaders().updateHeaderPairs([{ address: 'B:B', update: { hidden: true } }]);
    return workbook;
  };

  it('writes hidden rows and columns by default', async () => {
    const csv = decode(await writeCSV(newWorkbook(), {}) as ArrayBufferLike);
    expect(csv).toBe('a1,b1\na2,b2\na3,b3');
  });

  it('omits them when ignoreHidden is set', async () => {
    const csv = decode(await writeCSV(newWorkbook(), { ignoreHidden: true }) as ArrayBufferLike);
    // Row 2 and column B are gone — two hops after the option was supplied.
    expect(csv).toBe('a1\na3');
  });
});
