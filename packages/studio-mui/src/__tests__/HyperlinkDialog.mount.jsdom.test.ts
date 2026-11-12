import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook } from '@sheetxl/sdk';

import { getReferenceMode, WorkbookProvider } from '@sheetxl/react';

import { HyperlinkDialog } from '../dialog/HyperlinkDialog';

/**
 * Mount/interaction tests for the hyperlink dialog's REFERENCE flow: the in-document field is a
 * reference-mode producer (like the argument form's fields), and the link-type toggle must hand it
 * focus ARMED — the user goes straight from the dropdown to picking on the grid.
 */
describe('HyperlinkDialog (mount)', () => {
  const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = [];

  afterEach(async () => {
    for (const { root, container } of mounted.splice(0)) {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });

  const open = async (props: Record<string, unknown>, workbook: Workbook): Promise<void> => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    await act(async () => {
      root.render(createElement(WorkbookProvider as never, { workbook } as never,
        createElement(HyperlinkDialog as never, { open: true, ...props })));
    });
  };

  /** Pick a link type from the (portaled) dropdown, the way the browser drives MUI's Select. */
  const pickLinkType = async (value: 'url' | 'document'): Promise<void> => {
    const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
    expect(combobox).toBeTruthy();
    // MUI's Select opens on MOUSEDOWN, not click.
    await act(async () => {
      combobox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    const option = document.querySelector(`[role="option"][data-value="${value}"]`) as HTMLElement;
    expect(option).toBeTruthy();
    await act(async () => { option.click(); });
    // The guaranteed hand-off rides the menu's exit transition (`onExited`) — let it play out.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 600)); });
  };

  it('arms POINT mode when the link-type toggle reveals the reference field', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    await open({ initialValue: 'https://example.com', onInput: () => {} }, workbook);

    // Starts as a web link — no reference field, nothing on the bus.
    expect(getReferenceMode()?.mode).toBeUndefined();

    await pickLinkType('document');

    // The reveal hands the field focus…
    const input = document.querySelector('input.autoFocus') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(document.activeElement).toBe(input);
    // …ARMED: a reference-grammar field arms outright on engage (RefEdit), so grid clicks pick
    // rather than falling on the dialog's modality (which would close it).
    expect(getReferenceMode()?.mode).toBe('point');
  }, 30_000);

  it('arms the same way when the CURRENT type is re-picked', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    await open({ initialValue: '#Sheet1!A1', onInput: () => {} }, workbook);

    await pickLinkType('document');
    const input = document.querySelector('input.autoFocus') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(getReferenceMode()?.mode).toBe('point');
  }, 30_000);

  it('disabled shows the link with its fields off, and Cancel as the only way out', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const inputs: unknown[] = [];
    await open({ initialValue: '#Sheet1!A1', disabled: true, onInput: (value: unknown) => inputs.push(value) }, workbook);

    const fields = [...document.querySelectorAll<HTMLInputElement>('input:not([aria-hidden="true"])')];
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) expect(field.disabled).toBe(true);
    expect(document.querySelector('[role="combobox"]')?.getAttribute('aria-disabled')).toBe('true');
    // Nothing arms: a disabled reference field never takes grid picks.
    expect(getReferenceMode()?.mode).toBeUndefined();

    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.MuiDialogActions-root button')];
    expect(buttons.map((button) => button.textContent)).toEqual([expect.stringMatching(/cancel/i)]);
    expect(buttons[0].disabled).toBe(false);

    await act(async () => { buttons[0].click(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
    expect(inputs).toEqual([]);
  }, 30_000);
});
