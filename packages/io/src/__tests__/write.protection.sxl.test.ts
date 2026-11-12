import { describe, expect, it } from 'vitest';

import { Workbook, WorkbookIO, type IWorkbook } from '@sheetxl/sdk';

import { IOPlugin } from '..';

WorkbookIO.install(IOPlugin);

/**
 * Every piece of protection survives the SheetXL formats: sheet protection and its options, cell
 * protection on styles, unlocked ranges, the Highlight Locked Cells view setting, and workbook
 * protection.
 */
describe('Protection in SheetXL files', () => {

  const build = async (): Promise<IWorkbook> => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().ready();
    const sheet = workbook.getWorksheetAt(0)!;
    sheet.getRange('A1').setValue(2);
    sheet.getRange('B1').setValue('=A1*2');
    sheet.getRange('C1').setValue('=A1*3');
    await workbook.getCalculation().ready();

    sheet.getRange('B2:C3').getStyle().getProtection().setAlwaysUnlocked(true);
    sheet.getRange('C1').getStyle().getProtection().setShowFormulas(true);
    sheet.getProtectedRanges().add('E1:E4', { name: 'Inputs' });
    sheet.getView().setShowLockedShading(true);
    await sheet.getProtection().lock({ sort: true, showFormulas: false }, 'sheetpw', 'SHA-512', 10);
    await workbook.getProtection().lock({ structure: false, windows: true });
    return workbook;
  };

  for (const format of ['SheetXL', 'JSON']) {
    it(`round-trips through ${format}`, async () => {
      const bytes = await WorkbookIO.writeArrayBuffer(await build(), { format });
      const reread = (await WorkbookIO.read({ source: bytes, format }))!;
      await reread.getCalculation().ready();
      const sheet = reread.getWorksheetAt(0)!;
      const protection = sheet.getProtection();

      expect(protection.isLocked()).toBe(true);
      expect(protection.hasPassword()).toBe(true);
      expect(protection.isSortAllowed()).toBe(true);
      expect(protection.isFormatCellsAllowed()).toBe(false);
      expect(protection.isShowFormulasAllowed()).toBe(false);

      expect(sheet.getRange('B2').getCell().getProtection().isAlwaysUnlocked()).toBe(true);
      expect(sheet.getRange('A1').getCell().getProtection().isAlwaysUnlocked()).toBe(false);
      expect(sheet.getRange('B2').getCell().isEditAllowed()).toBe(true);
      expect(sheet.getRange('A2').getCell().isEditAllowed()).toBe(false);

      // hidden, but calculated and saved
      expect(sheet.getRange('B1').getCell().isFormulaHidden()).toBe(true);
      expect(sheet.getRange('B1').getValue()).toEqual(4);
      expect(sheet.getRange('C1').getCell().getFormulaText()).toEqual('=A1*3');

      expect(sheet.getRange('E2').getUnlocked().map((item) => item.getName())).toEqual(['Inputs']);
      expect(sheet.getView().isShowLockedShading()).toBe(true);

      const workbookProtection = reread.getProtection();
      expect(workbookProtection.isLocked()).toBe(true);
      expect(workbookProtection.isStructureAllowed()).toBe(false);
      expect(workbookProtection.isWindowsAllowed()).toBe(true);

      await protection.unlock('sheetpw');
      expect(sheet.getRange('B1').getCell().getFormulaText()).toEqual('=A1*2');
    });

    it(`keeps the options of unprotected sheets and workbooks through ${format}`, async () => {
      const workbook = await build();
      await workbook.getWorksheetAt(0)!.getProtection().unlock('sheetpw');
      await workbook.getProtection().unlock();
      const bytes = await WorkbookIO.writeArrayBuffer(workbook, { format });
      const reread = (await WorkbookIO.read({ source: bytes, format }))!;
      const protection = reread.getWorksheetAt(0)!.getProtection();

      expect(protection.isLocked()).toBe(false);
      expect(protection.hasPassword()).toBe(false);
      await protection.lock();
      expect(protection.isSortAllowed()).toBe(true);
      expect(protection.isShowFormulasAllowed()).toBe(false);

      const workbookProtection = reread.getProtection();
      expect(workbookProtection.isLocked()).toBe(false);
      await workbookProtection.lock();
      expect(workbookProtection.isStructureAllowed()).toBe(false);
      expect(workbookProtection.isWindowsAllowed()).toBe(true);
    });
  }

});
