import { describe, it, expect } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type IWorksheet, type IWorkbook } from '@sheetxl/sdk';
import { createEditable } from '@sheetxl/react';

import { FormulaBar, MobileFormulaBar } from '../formulaBar';

/**
 * The bar follows the active cell's CONTENT, not only the selection.
 *
 * @remarks
 * The bar reads the active cell lazily, so it has to be told when that cell changes. The selection
 * is not that signal: `IRangeSelection.updateCoords` returns early when the coords are equal, so
 * every write that leaves the selection where it is - pasting onto the selected cell, a script
 * `setValue` - announced nothing the bar heard and left it showing the old value. Nor is the
 * workbook: its notifications fire for a commit that wrote the WORKBOOK's state record, and a cell
 * edit writes the sheet's.
 *
 * Both hosts share the session hook, so both are held to it.
 */
/* What the user reads: the editor's textarea, or the phone bar's read-only copy while its field
 * rides the keyboard. */
const textareaShown = (container: HTMLElement): string | null => container.querySelector('textarea')?.value ?? null;
const displayShown = (container: HTMLElement): string | null =>
  container.querySelector('.formula-bar-display')?.textContent ?? null;

describe.each([
  ['FormulaBar', FormulaBar, {}, textareaShown],
  ['MobileFormulaBar (inline)', MobileFormulaBar, { floatOnKeyboard: false }, textareaShown],
  ['MobileFormulaBar (on the keyboard)', MobileFormulaBar, {}, displayShown]
] as const)('%s follows the active cell content', (_name, Host, hostProps, read) => {

  const mount = async (workbook: IWorkbook, sheet: IWorksheet) => {
    const editable = createEditable(sheet);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(Host as never, { workbook, editable, ...hostProps }));
    });
    return {
      shown: (): string | null => read(container),
      unmount: async (): Promise<void> => {
        await act(async () => { root.unmount(); });
        container.remove();
        workbook.close();
      }
    };
  };

  /* Range listeners are delivered after the commit settles, on a macrotask. */
  const settle = async (workbook: IWorkbook, change?: () => unknown): Promise<void> => {
    await act(async () => {
      await change?.();
      await workbook.getCalculation().ready();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  const newBook = async (): Promise<{ workbook: IWorkbook, sheet: IWorksheet }> => {
    const workbook = new Workbook();
    await workbook.getCalculation().ready();
    return { workbook, sheet: workbook.getSelectedWorksheet() };
  };

  it('refreshes on a paste that lands on the selected cell', async () => {
    const { workbook, sheet } = await newBook();
    sheet.getRange('A1').setValue('copied');
    sheet.getRange('A2').setValue('before');
    await sheet.getRange('A2').select();

    const bar = await mount(workbook, sheet);
    expect(bar.shown()).toBe('before');

    /* The selection is already A2 and the paste lands on A2, so the selection never moves. */
    const snapshot = sheet.getRange('A1').getSnapshot();
    await act(async () => { await sheet.getRange('A2').copyFrom(snapshot); });
    await settle(workbook);

    expect(bar.shown()).toBe('copied');
    await bar.unmount();
  });

  it('refreshes on a write to the active cell that moves no selection', async () => {
    const { workbook, sheet } = await newBook();
    sheet.getRange('A1').setValue('before');
    await sheet.getRange('A1').select();

    const bar = await mount(workbook, sheet);
    expect(bar.shown()).toBe('before');

    await settle(workbook, () => sheet.getRange('A1').setValue('after'));

    expect(bar.shown()).toBe('after');
    await bar.unmount();
  });

  it('shows a formula rather than its value', async () => {
    const { workbook, sheet } = await newBook();
    sheet.getRange('A1').setValue(10);
    await sheet.getRange('A2').select();

    const bar = await mount(workbook, sheet);
    expect(bar.shown()).toBe('');

    await settle(workbook, () => sheet.getRange('A2').setValue('=A1*2'));

    expect(bar.shown()).toBe('=A1*2');
    await bar.unmount();
  });

  it('ignores a change to a cell that is not the active one', async () => {
    const { workbook, sheet } = await newBook();
    sheet.getRange('A1').setValue('before');
    await sheet.getRange('A1').select();

    const bar = await mount(workbook, sheet);

    await settle(workbook, () => sheet.getRange('D9').setValue('elsewhere'));

    expect(bar.shown()).toBe('before');
    await bar.unmount();
  });

  it('still follows the selection', async () => {
    const { workbook, sheet } = await newBook();
    sheet.getRange('A1').setValue('first');
    sheet.getRange('B1').setValue('second');
    await sheet.getRange('A1').select();

    const bar = await mount(workbook, sheet);
    expect(bar.shown()).toBe('first');

    await act(async () => { await sheet.getRange('B1').select(); });
    await settle(workbook);

    expect(bar.shown()).toBe('second');
    await bar.unmount();
  });
});
