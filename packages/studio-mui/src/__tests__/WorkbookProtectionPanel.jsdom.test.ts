import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { WorkbookProtectionPanel } from '../protection';

/**
 * The workbook protection panel.
 *
 * @remarks
 * The panel holds no password. It shows whether one is SET and hands the typing to
 * `PasswordDialog`, which is what removed the sentinel (`••••••••`) this file used to be about:
 * a hash cannot be read back, so an input over one could only ever show a stand-in, and every panel
 * then had to explain what an untouched stand-in, an emptied field and a typed value each meant.
 *
 * What it renders is booleans, and there is no Apply — every callback commits.
 */
describe('WorkbookProtectionPanel', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  const BLANK: WorkbookProtectionPanel.Value = {
    hasEncryptPassword: false,
    structure: false, hasStructurePassword: false,
    lockStructure: true, lockWindows: false,
    locksEditable: true
  };

  const mount = async (value: WorkbookProtectionPanel.Value) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const calls: string[] = [];
    await act(async () => {
      root.render(createElement(WorkbookProtectionPanel as never, {
        value,
        onEncryptPassword: (password: string) => calls.push(`encryptPassword:${password}`),
        onEncryptPasswordClear: () => calls.push('encryptPassword:clear'),
        onStructureChange: (enabled: boolean) => calls.push(`structure:${enabled}`),
        onStructurePassword: (password: string) => calls.push(`structurePassword:${password}`),
        onStructurePasswordClear: () => calls.push('structurePassword:clear'),
        onLocksChange: (locks: { lockStructure: boolean; lockWindows: boolean }) =>
          calls.push(`locks:${locks.lockStructure}/${locks.lockWindows}`)
      }));
    });
    return {
      container,
      text: () => container.textContent ?? '',
      calls: () => calls,
      /** Structure then encrypt: [Set…, Clear, Set…, Clear]. */
      buttons: (): HTMLButtonElement[] =>
        Array.from(container.querySelectorAll('button')) as HTMLButtonElement[],
      /** [structure, lockStructure, lockWindows]. */
      checkboxes: (): HTMLInputElement[] =>
        Array.from(container.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[],
      click: async (el: HTMLElement) => { await act(async () => { el.click(); }); },
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  it('never renders a password input', async () => {
    // The whole point of the redesign: there is nowhere on the panel to type one.
    const panel = await mount({ ...BLANK, hasEncryptPassword: true });
    expect(panel.container.querySelectorAll('input[type="password"]').length).toEqual(0);
    await panel.unmount();
  });

  it('reports a password that is set without disclosing it', async () => {
    const panel = await mount({ ...BLANK, hasEncryptPassword: true });
    expect(panel.text()).toContain('A password is set.');
    await panel.unmount();
  });

  it('encrypts by setting a password, with no switch in front of it', async () => {
    // Encryption IS its password: an unencrypted workbook must offer Set… directly.
    const panel = await mount(BLANK);
    expect(panel.text()).toContain('No password.');

    const [, , encryptSet, encryptClear] = panel.buttons();
    expect(encryptSet.textContent).toContain('Set');
    expect(encryptSet.disabled).toBe(false);
    expect(encryptClear.disabled).toBe(true);
    // the only checkboxes are structure's
    expect(panel.checkboxes().length).toBe(3);

    await panel.unmount();
  });

  it('commits on the control, with no Apply to press', async () => {
    // The pane is not a dialog: every control here is one unambiguous act.
    const panel = await mount({ ...BLANK, hasEncryptPassword: true });
    expect(panel.text()).not.toContain('Apply');

    const [, , , encryptClear] = panel.buttons();
    expect(encryptClear.disabled).toBe(false);
    await panel.click(encryptClear);

    expect(panel.calls()).toEqual(['encryptPassword:clear']);
    await panel.unmount();
  });

  it('offers the structure checkboxes while unprotected', async () => {
    const panel = await mount(BLANK);
    const [, lockStructure, lockWindows] = panel.checkboxes();
    expect(lockStructure.disabled).toBe(false);
    expect(lockWindows.disabled).toBe(false);
    await panel.unmount();
  });

  it('disables the structure checkboxes while protected, and says why', async () => {
    // Same rule as the Sheet tab's options: the model refuses them until the workbook is unprotected.
    const panel = await mount({
      ...BLANK, structure: true, hasStructurePassword: true, locksEditable: false
    });

    const [, lockStructure, lockWindows] = panel.checkboxes();
    expect(lockStructure.disabled).toBe(true);
    expect(lockWindows.disabled).toBe(true);
    expect(panel.text()).toContain('Unprotect the workbook');

    await panel.unmount();
  });

  it('reports both locks together, so neither is read as cleared', async () => {
    const panel = await mount({ ...BLANK, structure: true, lockStructure: true, lockWindows: false });
    const [, , lockWindows] = panel.checkboxes();

    await panel.click(lockWindows);

    expect(panel.calls()).toEqual(['locks:true/true']);
    await panel.unmount();
  });
});
