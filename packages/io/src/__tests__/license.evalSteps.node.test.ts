import { afterEach, describe, expect, it } from 'vitest';

import { LicenseManager, Workbook, WorkbookIO } from '@sheetxl/sdk';

import { IOPlugin } from '..';

WorkbookIO.install(IOPlugin);

/**
 * The evaluation steps through the real write path, for an unlicensed build. In grace every export
 * is refused while `.sxl` still saves; once stopped, a workbook still opens — with the values it was
 * last calculated with — and still saves as `.sxl`, so no one is locked out of their own work.
 */

const DAY = 24 * 60 * 60 * 1000;
const builtDaysAgo = (days: number): void => {
  (globalThis as any).__BUILD_DATE__ = new Date(Date.now() - days * DAY).toISOString();
};

/** How many days after its build date this build enters grace, and stops. */
const steps = async (): Promise<{ grace: number; stopped: number }> => {
  builtDaysAgo(0);
  const details = await LicenseManager.getDetails();
  const built = Date.parse((globalThis as any).__BUILD_DATE__);
  return {
    grace: Math.round((details.getEvalPeriodEnd()!.getTime() - built) / DAY),
    stopped: Math.round((details.getEvalStopDate()!.getTime() - built) / DAY),
  };
};

/** An xlsx with a value and a formula, made while the build is still in its evaluation. */
const makeXlsx = async (): Promise<ArrayBufferLike> => {
  builtDaysAgo(1);
  const workbook = new Workbook();
  await workbook.whenCalculationReady();
  const sheet = workbook.getSheets()[0] as any;
  sheet.getRange('A1:A2').setValues([[2], [3]]);
  sheet.getRange('A3').setFormulas([['=A1*A2']]);
  await workbook.whenCalculationReady();
  const bytes = await WorkbookIO.writeArrayBuffer(workbook, { format: 'Excel' });
  workbook.close();
  return bytes;
};

describe('evaluation steps on the write path', () => {
  afterEach(() => {
    delete (globalThis as any).__BUILD_DATE__;
  });

  it('in grace, exports are refused and .sxl still saves', async () => {
    const xlsx = await makeXlsx();
    builtDaysAgo((await steps()).grace + 5);
    const workbook = (await WorkbookIO.read({ source: xlsx, format: 'Excel' }))!;
    try {
      await expect(WorkbookIO.writeArrayBuffer(workbook, { format: 'Excel' })).rejects.toThrow(/cannot export/);
      await expect(WorkbookIO.writeArrayBuffer(workbook, { format: 'csv' })).rejects.toThrow(/cannot export/);
      const sxl = await WorkbookIO.writeArrayBuffer(workbook, { format: 'sxl' });
      expect(sxl.byteLength).toBeGreaterThan(0);
    } finally {
      workbook.close();
    }
  });

  it('once stopped, a workbook still opens with its last values and saves as .sxl', async () => {
    const xlsx = await makeXlsx();
    builtDaysAgo((await steps()).stopped + 5);
    const workbook = (await WorkbookIO.read({ source: xlsx, format: 'Excel' }))!;
    try {
      const sheet = workbook.getSheets()[0] as any;
      expect(sheet.isClosed()).toBe(false);
      expect(sheet.getRange('A1:A3').getValues()).toEqual([[2], [3], [6]]);

      // No calculation: an edit lands, but the formula keeps its last value.
      await workbook.whenCalculationReady().catch(() => {});
      sheet.getRange('A1').setValues([[10]]);
      expect(sheet.getRange('A1:A3').getValues()).toEqual([[10], [3], [6]]);
      await expect(workbook.getScripts().run('return 1;')).resolves.toMatchObject({ ok: false });
      await expect(WorkbookIO.writeArrayBuffer(workbook, { format: 'Excel' })).rejects.toThrow(/no longer calculates/);

      const sxl = await WorkbookIO.writeArrayBuffer(workbook, { format: 'sxl' });
      const reopened = (await WorkbookIO.read({ source: sxl, format: 'sxl' }))!;
      expect((reopened.getSheets()[0] as any).getRange('A3').getValues()).toEqual([[6]]);
      reopened.close();
    } finally {
      workbook.close();
    }
  });
});
