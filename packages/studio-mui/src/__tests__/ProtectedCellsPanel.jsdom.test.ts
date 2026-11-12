import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type IWorksheet } from '@sheetxl/sdk';

import { ProtectedCellsPanel } from '../protection/ProtectedCellsPanel';

/**
 * The Cells tab of Manage Protection: the protection format of the selected cells, read and written
 * the way a format control is — indeterminate when the selection is mixed, one write for all of it.
 */
describe('ProtectedCellsPanel', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  const mount = async (sheet: IWorksheet) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(ProtectedCellsPanel as never, { sheet }));
    });
    return {
      text: () => container.textContent ?? '',
      /** Always unlocked, then Show formulas. */
      checkboxes: (): HTMLInputElement[] =>
        Array.from(container.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[],
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  const newSheet = (): IWorksheet => new Workbook().getWorksheetAt(0)!;

  it('reads the defaults: no exceptions', async () => {
    const sheet = newSheet();
    const panel = await mount(sheet);
    const [alwaysUnlocked, showFormulas] = panel.checkboxes();
    expect(alwaysUnlocked.checked).toBe(false);
    expect(showFormulas.checked).toBe(false);
    await panel.unmount();
  });

  it('writes every selected cell', async () => {
    const sheet = newSheet();
    await act(async () => { sheet.getRange('B2:C3').select(); });
    const panel = await mount(sheet);

    await act(async () => { panel.checkboxes()[0].click(); });
    expect(sheet.getRange('B2').getCell().getProtection().isAlwaysUnlocked()).toBe(true);
    expect(sheet.getRange('C3').getCell().getProtection().isAlwaysUnlocked()).toBe(true);
    expect(sheet.getRange('D4').getCell().getProtection().isAlwaysUnlocked()).toBe(false);
    expect(panel.checkboxes()[0].checked, 'follows its own write').toBe(true);

    await act(async () => { panel.checkboxes()[1].click(); });
    expect(sheet.getRange('C3').getCell().getProtection().isShowFormulas()).toBe(true);

    await panel.unmount();
  });

  it('reads a mixed selection as indeterminate, and a click unlocks all of it', async () => {
    const sheet = newSheet();
    sheet.getRange('B2').getStyle().getProtection().setAlwaysUnlocked(true);
    await act(async () => { sheet.getRange('B2:B3').select(); });
    const panel = await mount(sheet);
    const alwaysUnlocked = (): HTMLInputElement => panel.checkboxes()[0];

    expect(alwaysUnlocked().getAttribute('data-indeterminate')).toEqual('true');
    await act(async () => { alwaysUnlocked().click(); });
    expect(sheet.getRange('B3').getCell().getProtection().isAlwaysUnlocked()).toBe(true);
    expect(alwaysUnlocked().getAttribute('data-indeterminate')).toEqual('false');

    await panel.unmount();
  });

  it('reads a whole-column selection as mixed', async () => {
    const sheet = newSheet();
    sheet.getRange('B2').getStyle().getProtection().setAlwaysUnlocked(true);
    await act(async () => { sheet.getRange('B:B').select(); });
    const panel = await mount(sheet);

    expect(panel.checkboxes()[0].getAttribute('data-indeterminate')).toEqual('true');
    expect(panel.checkboxes()[1].checked, 'no cell is an exception').toBe(false);

    await panel.unmount();
  });

  it('is disabled on a protected sheet, and says why', async () => {
    const sheet = newSheet();
    await sheet.getProtection().lock();
    const panel = await mount(sheet);

    expect(panel.checkboxes().every((c) => c.disabled)).toBe(true);
    expect(panel.text()).toContain('Unprotect the sheet');

    await panel.unmount();
  });

  it('is enabled on a paused sheet', async () => {
    const sheet = newSheet();
    await sheet.getProtection().lock();
    await sheet.getProtection().pause();
    const panel = await mount(sheet);

    expect(panel.checkboxes().every((c) => !c.disabled)).toBe(true);
    expect(panel.text()).not.toContain('Unprotect the sheet');

    await panel.unmount();
  });
});
