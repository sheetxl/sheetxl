import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type IWorkbook, type IWorksheet } from '@sheetxl/sdk';

import { WorksheetProtectionPanel } from '../protection/WorksheetProtectionPanel';

/**
 * The Sheet tab of Manage Protection.
 *
 * @remarks
 * Two things worth pinning. The **three-state** reading: `isLocked()` is false while paused, which
 * is right for enforcement and wrong for chrome, so the panel answers "protected?" and "paused?"
 * separately — get that wrong and pausing makes the sheet look unprotected, with the only way back
 * being to press Protect on a sheet that already is.
 *
 * And that **nothing here has an Apply button**. Every control commits when it is used, so the
 * interesting cases are the three ways an option checkbox can behave: kept by the unprotected sheet
 * for its next lock, written through when protected without a password, and refused when protected
 * with one.
 *
 * Password hashing is real here, so every lock uses a low spin count.
 */
describe('WorksheetProtectionPanel', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  const FAST = { algorithm: 'SHA-512', spinCount: 10 };

  const mount = async (sheet: IWorksheet) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(WorksheetProtectionPanel as never, { sheet }));
    });
    const switches = (): HTMLInputElement[] =>
      Array.from(container.querySelectorAll('input[type="checkbox"].PrivateSwitchBase-input'))
        .filter((el) => (el as HTMLElement).closest('.MuiSwitch-root')) as HTMLInputElement[];
    const rerender = async (): Promise<void> => {
      await act(async () => { root.render(createElement(WorksheetProtectionPanel as never, { sheet })); });
    };
    /* The options live behind a disclosure — fifteen checkboxes are a rare edit, and letting them
       push the toggles off the top made the common controls the hard ones. */
    const expandOptions = async (): Promise<void> => {
      const summary = container.querySelector('.MuiAccordionSummary-root') as HTMLElement;
      await act(async () => { summary.click(); });
    };
    /* Pause is a button rather than a switch: an act (with a password behind it, when the sheet has
       one) and its undo, not a setting. Found by its label, which flips with the state. */
    const pauseButton = (): HTMLButtonElement =>
      (Array.from(container.querySelectorAll('button')) as HTMLButtonElement[])
        .find((b) => /^(Pause|Resume) protection$/.test(b.textContent ?? ''))!;
    return {
      container,
      text: () => container.textContent ?? '',
      /** Protect, Highlight — in the order the panel lays them out. */
      switches,
      pauseButton,
      /** The option checkboxes: Excel's 15, then Show formulas. */
      options: (): HTMLInputElement[] =>
        (Array.from(container.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[])
          .filter((el) => !el.closest('.MuiSwitch-root')),
      expandOptions,
      rerender,
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  const newSheet = (): { workbook: IWorkbook; sheet: IWorksheet } => {
    const workbook = new Workbook();
    return { workbook, sheet: workbook.getWorksheetAt(0)! };
  };

  it('shows every option, at the defaults, on an unprotected sheet', async () => {
    const { sheet } = newSheet();
    const panel = await mount(sheet);
    await panel.expandOptions();

    const options = panel.options();
    expect(options.length).toEqual(16);
    // Excel's own default — both select boxes on — plus formulas shown.
    expect(options.filter((o) => o.checked).length).toEqual(3);
    expect(options[0].checked, 'select locked cells').toBe(true);
    expect(options[1].checked, 'select unlocked cells').toBe(true);
    expect(options[2].checked, 'format cells').toBe(false);
    expect(options[15].checked, 'show formulas').toBe(true);

    await panel.unmount();
  });

  it('reads protected while PAUSED, and offers the way back', async () => {
    const { sheet } = newSheet();
    const protection = sheet.getProtection();
    await protection.lock({}, 'hunter2', FAST.algorithm, FAST.spinCount);
    await protection.pause('hunter2');
    // The state the panel has to disambiguate: not locked, but protected.
    expect(protection.isLocked()).toBe(false);
    expect(protection.isPaused()).toBe(true);

    const panel = await mount(sheet);
    const [protect] = panel.switches();

    expect(protect.checked, 'Protect must not flip off on a pause').toBe(true);
    expect(panel.pauseButton().textContent).toEqual('Resume protection');
    expect(panel.text()).toContain('Protection is paused');

    await panel.unmount();
  });

  it('offers Pause on any protected sheet, and asks for nothing when there is no password', async () => {
    const { sheet } = newSheet();
    const protection = sheet.getProtection();

    // Unprotected: nothing to pause.
    let panel = await mount(sheet);
    expect(panel.pauseButton().disabled).toBe(true);
    await panel.unmount();

    // Protected without a password: pauses on the spot. Not the same as unprotecting — the lock
    // is still configured, and resume brings it back without touching the document.
    await protection.lock({ sort: true });
    panel = await mount(sheet);
    expect(panel.switches()[0].checked).toBe(true);
    expect(panel.pauseButton().disabled).toBe(false);
    await act(async () => { panel.pauseButton().click(); });
    expect(protection.isPaused()).toBe(true);
    expect(protection.isLocked()).toBe(false);
    expect(panel.switches()[0].checked, 'still reads protected').toBe(true);
    expect(panel.pauseButton().textContent).toEqual('Resume protection');

    await act(async () => { panel.pauseButton().click(); });
    expect(protection.isPaused()).toBe(false);
    expect(protection.isLocked()).toBe(true);
    expect(protection.isSortAllowed()).toBe(true);
    await panel.unmount();
  });

  it('reads the options off a locked sheet, and follows a change made elsewhere', async () => {
    const { sheet } = newSheet();
    const protection = sheet.getProtection();
    await protection.lock({ sort: true, formatCells: true });

    const panel = await mount(sheet);
    await panel.expandOptions();
    expect(panel.options()[2].checked, 'format cells').toBe(true);
    expect(panel.options()[10].checked, 'sort').toBe(true);
    // never set on this lock, so they read their defaults
    expect(panel.options()[0].checked, 'select locked cells').toBe(true);
    expect(panel.options()[15].checked, 'show formulas').toBe(true);

    // The panel keeps no draft — the model is the only source, so a change made elsewhere shows up
    // here with nothing to reconcile.
    await act(async () => {
      await protection.unlock();
      await protection.setProperties({ deleteRows: true });
    });
    await panel.rerender();
    expect(panel.options()[2].checked, 'format cells').toBe(false);
    expect(panel.options()[9].checked, 'delete rows').toBe(true);

    await panel.unmount();
  });

  it('keeps options on the unprotected sheet, and protects with them', async () => {
    const { sheet } = newSheet();
    const panel = await mount(sheet);
    await panel.expandOptions();

    // Turn on "format cells" while unprotected — the sheet keeps it — then protect.
    await act(async () => { panel.options()[2].click(); });
    const protection = sheet.getProtection();
    expect(protection.isLocked()).toBe(false);
    expect(protection.getProperties()?.formatCells).toBe(true);

    await act(async () => { panel.switches()[0].click(); });

    expect(protection.isLocked()).toBe(true);
    expect(protection.isFormatCellsAllowed()).toBe(true);
    expect(protection.isSortAllowed()).toBe(false);
    expect(protection.isShowFormulasAllowed()).toBe(true);
    // No password was set, so it locks without one.
    expect(protection.hasPassword()).toBe(false);

    await panel.unmount();
  });

  it('still shows the options after unprotecting', async () => {
    const { sheet } = newSheet();
    const protection = sheet.getProtection();
    await protection.lock({ sort: true });

    const panel = await mount(sheet);
    await panel.expandOptions();
    await act(async () => { panel.switches()[0].click(); });

    expect(protection.isLocked()).toBe(false);
    expect(panel.options()[10].checked, 'sort').toBe(true);

    await panel.unmount();
  });

  it('reads Show formulas off the sheet, and writes it through while unprotected', async () => {
    const { sheet } = newSheet();
    const protection = sheet.getProtection();
    await protection.setProperties({ showFormulas: false });

    const panel = await mount(sheet);
    await panel.expandOptions();
    const showFormulas = (): HTMLInputElement => panel.options()[15];
    expect(showFormulas().checked).toBe(false);

    await act(async () => { showFormulas().click(); });
    expect(protection.getProperties()?.showFormulas).toBe(true);

    await panel.unmount();
  });

  it('disables the options and the password on a locked sheet, and opens the options while paused', async () => {
    // The model refuses both until the sheet is unprotected — Excel's answer too. A pause already
    // asked for the password, so it takes option changes; only a lock writes a new password.
    const { sheet } = newSheet();
    const protection = sheet.getProtection();
    await protection.lock({}, 'hunter2', FAST.algorithm, FAST.spinCount);

    const panel = await mount(sheet);
    await panel.expandOptions();
    const passwordButtons = (): HTMLButtonElement[] =>
      (Array.from(panel.container.querySelectorAll('button')) as HTMLButtonElement[])
        .filter((b) => /^(Set|Change|Clear)/.test(b.textContent ?? ''));

    expect(panel.options().every((o) => o.disabled)).toBe(true);
    expect(passwordButtons().length).toEqual(2);
    expect(passwordButtons().every((b) => b.disabled)).toBe(true);
    expect(panel.text()).toContain('Unprotect the sheet');

    await act(async () => { await protection.pause('hunter2'); });
    await panel.rerender();
    expect(panel.options().every((o) => !o.disabled)).toBe(true);
    expect(passwordButtons().every((b) => b.disabled)).toBe(true);

    await act(async () => { panel.options()[2].click(); });
    expect(protection.getProperties()?.formatCells).toBe(true);

    await panel.unmount();
  });

  it('offers no password input — that is the dialog', async () => {
    const { sheet } = newSheet();
    const panel = await mount(sheet);

    expect(panel.container.querySelectorAll('input[type="password"]').length).toEqual(0);
    expect(panel.text()).toContain('No password.');

    await panel.unmount();
  });
});
