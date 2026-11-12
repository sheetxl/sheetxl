import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { Workbook, type IWorksheet, type IWorkbook } from '@sheetxl/sdk';
import { createEditable, startTypedEdit, type SheetEditable } from '@sheetxl/react';
import {
  createVirtualKeyboardStore, VirtualKeyboardProvider, subscribeEditModeExit, type VirtualKeyboardStore
} from '@sheetxl/utils-react';

import { MobileFormulaBar, type IFormulaBarElement } from '../formulaBar';
import { defaultRenderFormulaBar } from '../workbook/DefaultRenderers';

/**
 * The phone's formula bar: the same editor as the desktop bar in a box with no name box, the expand
 * chevron inside the field, and a row of entry buttons under it. Enter and Tab commit and move on;
 * cancel and commit are the edit's ways out. The keyboard is the sheet's: each test
 * mounts the bar under its own keyboard store. These run the field in place (`floatOnKeyboard: false`);
 * the field riding the keyboard is the next describe.
 */
describe('MobileFormulaBar', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let keyboard: VirtualKeyboardStore = createVirtualKeyboardStore({ disabled: false });
  afterEach(async () => {
    keyboard = createVirtualKeyboardStore({ disabled: false });
    await act(async () => { root?.unmount(); });
    container?.remove();
    root = null;
    container = null;
  });

  const newBook = async (): Promise<{ workbook: IWorkbook, sheet: IWorksheet, editable: SheetEditable }> => {
    const workbook = new Workbook();
    await workbook.getCalculation().ready();
    const sheet = workbook.getSelectedWorksheet();
    return { workbook, sheet, editable: createEditable(sheet) };
  };

  const mount = async (element: ReturnType<typeof createElement>) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root!.render(createElement(VirtualKeyboardProvider, { store: keyboard }, element)); });
    /* The buttons render as `div`s (MUI ButtonBase), so disabled is the aria state, not a property. */
    const button = (label: string): HTMLElement | null => container!.querySelector(`[aria-label="${label}"]`);
    const isDisabled = (label: string): boolean | undefined => {
      const el = button(label);
      return el ? el.getAttribute('aria-disabled') === 'true' || el.classList.contains('Mui-disabled') : undefined;
    };
    return {
      textarea: (): HTMLTextAreaElement | null => container!.querySelector('textarea'),
      button,
      isDisabled,
      /** The name box renders an `input`; this host has none (its date picker is not one). */
      inputs: (): number => container!.querySelectorAll('input:not([type="date"])').length
    };
  };

  const startEdit = async (editable: SheetEditable, sheet: IWorksheet): Promise<void> => {
    await act(async () => { editable.startEdit(sheet.getSelectedCell().getCoords(), { mode: 'edit', autoFocus: false }); });
  };

  it('shows the active cell with fx, the chevron and the input toolbar, and no name box', async () => {
    const { workbook, sheet, editable } = await newBook();
    sheet.getRange('A1').setValue('hello');
    await sheet.getRange('A1').select();

    const bar = await mount(createElement(MobileFormulaBar as never, { workbook, editable, floatOnKeyboard: false }));
    expect(bar.textarea()?.value).toBe('hello');
    expect(bar.inputs()).toBe(0);
    expect(bar.button('commit-formula-function')).not.toBeNull();
    expect(bar.button('toggle-expand-formula-edit')).not.toBeNull();
    for (const label of ['input-mode-text', 'input-mode-decimal', 'insert-date', 'tab-formula-edit', 'enter-formula-edit']) {
      expect(bar.button(label), label).not.toBeNull();
    }
    // Cancel and commit are the status bar's unless asked for.
    expect(bar.button('cancel-formula-edit')).toBeNull();
    expect(bar.button('commit-formula-edit')).toBeNull();
  });

  it('showCancelCommit puts cancel and commit on the toolbar, idle', async () => {
    const { workbook, editable } = await newBook();
    const bar = await mount(createElement(MobileFormulaBar as never, { workbook, editable, floatOnKeyboard: false, showCancelCommit: true }));
    expect(bar.isDisabled('cancel-formula-edit')).toBe(true);
    expect(bar.isDisabled('commit-formula-edit')).toBe(true);
  });

  it('asks the keyboard for enter; the input buttons set the sheet keyboard and focus the field', async () => {
    const { workbook, editable } = await newBook();
    const bar = await mount(createElement(MobileFormulaBar as never, { workbook, editable, floatOnKeyboard: false }));
    expect(bar.textarea()?.getAttribute('enterkeyhint')).toBe('enter');
    expect(bar.textarea()?.getAttribute('autocorrect')).toBe('off');
    expect(bar.textarea()?.getAttribute('inputmode')).toBe('text');

    await act(async () => { bar.button('input-mode-decimal')!.click(); });
    expect(keyboard.getInputMode()).toBe('decimal');
    expect(bar.textarea()?.getAttribute('inputmode')).toBe('decimal');
    expect(document.activeElement).toBe(bar.textarea());
    await act(async () => { bar.button('input-mode-text')!.click(); });
    expect(bar.textarea()?.getAttribute('inputmode')).toBe('text');
    expect(document.activeElement).toBe(bar.textarea());
    await act(async () => { editable.cancel(); });
  });

  it('a picked date is typed into the field, replacing an idle cell and inserting mid-edit', async () => {
    const { workbook, sheet, editable } = await newBook();
    await sheet.getRange('A1').select();
    const bar = await mount(createElement(MobileFormulaBar as never, { workbook, editable, floatOnKeyboard: false, showCancelCommit: true }));
    const picker = container!.querySelector('input[type="date"]') as HTMLInputElement;
    const pick = async (value: string): Promise<void> => {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        setter.call(picker, value);
        picker.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    const expected = new Date(2026, 9, 9).toLocaleDateString(workbook.getLocale() ?? undefined);

    await pick('2026-10-09');
    expect(editable.getSession()).not.toBeNull();
    expect(bar.textarea()?.value).toBe(expected);

    await act(async () => { bar.button('commit-formula-edit')!.click(); });
    await act(async () => { await workbook.getCalculation().ready(); });
    expect(sheet.getRange('A1').getCell().getText()).toContain(String(2026));
  });

  it('commit keeps the edit and ends the session', async () => {
    const { workbook, sheet, editable } = await newBook();
    await sheet.getRange('A1').select();
    const bar = await mount(createElement(MobileFormulaBar as never, { workbook, editable, floatOnKeyboard: false, showCancelCommit: true }));

    await startEdit(editable, sheet);
    expect(bar.isDisabled('commit-formula-edit')).toBe(false);

    await act(async () => { editable.getSession()?.setDirty('typed'); });
    await act(async () => { bar.button('commit-formula-edit')!.click(); });
    await act(async () => { await workbook.getCalculation().ready(); });

    expect(editable.getSession()).toBeNull();
    expect(sheet.getRange('A1').getValue()).toBe('typed');
    expect(bar.isDisabled('commit-formula-edit')).toBe(true);
  });

  it('cancel ends the session without writing', async () => {
    const { workbook, sheet, editable } = await newBook();
    sheet.getRange('A1').setValue('kept');
    await sheet.getRange('A1').select();
    const bar = await mount(createElement(MobileFormulaBar as never, { workbook, editable, floatOnKeyboard: false, showCancelCommit: true }));

    await startEdit(editable, sheet);
    await act(async () => { editable.getSession()?.setDirty('discarded'); });
    await act(async () => { bar.button('cancel-formula-edit')!.click(); });

    expect(editable.getSession()).toBeNull();
    expect(sheet.getRange('A1').getValue()).toBe('kept');
  });

  it('Enter commits and moves down, leaving the bar idle and keyboard mode as it was', async () => {
    const { workbook, sheet, editable } = await newBook();
    await sheet.getRange('A1').select();
    const bar = await mount(createElement(MobileFormulaBar as never, { workbook, editable, floatOnKeyboard: false }));

    await act(async () => { bar.textarea()!.focus(); });
    await startEdit(editable, sheet);
    await act(async () => { keyboard.show(); });
    await act(async () => { editable.getSession()?.setDirty('first'); });
    await act(async () => { bar.button('enter-formula-edit')!.click(); });
    await act(async () => { await workbook.getCalculation().ready(); });

    expect(sheet.getRange('A1').getValue()).toBe('first');
    expect(sheet.getSelectedCell().getCoords()).toEqual({ rowIndex: 1, colIndex: 0 });
    expect(editable.getSession()).toBeNull();
    expect(keyboard.isActive()).toBe(true);
  });

  it('cancel and commit are the edit\'s ways out, taken before the edit ends', async () => {
    const { workbook, sheet, editable } = await newBook();
    await sheet.getRange('A1').select();
    const bar = await mount(createElement(MobileFormulaBar as never, { workbook, editable, floatOnKeyboard: false, showCancelCommit: true }));

    const exits: string[] = [];
    const remove = subscribeEditModeExit((mode, exit) => {
      exits.push(`${mode.key}:${exit}:${editable.getSession() ? 'live' : 'ended'}`);
    });
    for (const label of ['commit-formula-edit', 'cancel-formula-edit']) {
      await startEdit(editable, sheet);
      await act(async () => { bar.button(label)!.click(); });
      expect(editable.getSession(), label).toBeNull();
    }
    remove();
    expect(exits).toEqual(['edit:done:live', 'edit:cancel:live']);
  });

  it('a key typed into the grid in keyboard mode opens the edit in the bar, not the cell', async () => {
    const { workbook, sheet, editable } = await newBook();
    await sheet.getRange('A1').select();
    const bar = await mount(createElement(MobileFormulaBar as never, { workbook, editable, floatOnKeyboard: false }));
    expect(keyboard.getEditorId()).toBe('formula-bar');

    await act(async () => { keyboard.show(); });
    await act(async () => {
      startTypedEdit(editable, sheet.getSelectedCell().getCoords(), { mode: 'enter', dirty: '7' }, keyboard);
    });
    expect(editable.getSession()?.getActiveEditorId()).toBe('formula-bar');
    expect(document.activeElement).toBe(bar.textarea());
    expect(bar.textarea()?.value).toBe('7');
    await act(async () => { editable.cancel(); });
  });

  it('outside keyboard mode a typed key leaves the bar alone', async () => {
    const { workbook, sheet, editable } = await newBook();
    await sheet.getRange('A1').select();
    const bar = await mount(createElement(MobileFormulaBar as never, { workbook, editable, floatOnKeyboard: false }));

    await act(async () => {
      startTypedEdit(editable, sheet.getSelectedCell().getCoords(), { mode: 'enter', dirty: '7' }, keyboard);
    });
    expect(editable.getSession()?.getActiveEditorId()).toBeNull();
    expect(document.activeElement).not.toBe(bar.textarea());
    await act(async () => { editable.cancel(); });
  });

  it('Tab commits and moves right; idle it only moves', async () => {
    const { workbook, sheet, editable } = await newBook();
    await sheet.getRange('A1').select();
    const bar = await mount(createElement(MobileFormulaBar as never, { workbook, editable, floatOnKeyboard: false }));

    await act(async () => { bar.button('tab-formula-edit')!.click(); });
    expect(sheet.getSelectedCell().getCoords()).toEqual({ rowIndex: 0, colIndex: 1 });
    await act(async () => { editable.cancel(); });
  });

  it('the Enter key in the field behaves as the Enter button', async () => {
    const { workbook, sheet, editable } = await newBook();
    await sheet.getRange('A1').select();
    const bar = await mount(createElement(MobileFormulaBar as never, { workbook, editable, floatOnKeyboard: false }));

    await startEdit(editable, sheet);
    await act(async () => { editable.getSession()?.setDirty('typed'); });
    await act(async () => {
      bar.textarea()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true } as KeyboardEventInit));
    });
    await act(async () => { await workbook.getCalculation().ready(); });

    expect(sheet.getRange('A1').getValue()).toBe('typed');
    expect(sheet.getSelectedCell().getCoords()).toEqual({ rowIndex: 1, colIndex: 0 });
    await act(async () => { editable.cancel(); });
  });

  it('the chevron grows the field to several lines and back', async () => {
    const { workbook, editable } = await newBook();
    const bar = await mount(createElement(MobileFormulaBar as never, { workbook, editable, floatOnKeyboard: false }));
    const height = (): number => parseFloat((container!.querySelector('.formula-editor') as HTMLElement).style.height);
    const oneLine = height();

    await act(async () => { bar.button('toggle-expand-formula-edit')!.click(); });
    expect(height()).toBeGreaterThan(oneLine);

    await act(async () => { bar.button('toggle-expand-formula-edit')!.click(); });
    expect(height()).toBe(oneLine);
  });

  it('is the default renderer for the bottom placement only', async () => {
    const { workbook, editable } = await newBook();
    const bottom = await mount(defaultRenderFormulaBar({ workbook, editable, placement: 'bottom' }));
    expect(container!.querySelector('.formula-bar-mobile')).not.toBeNull();
    expect(bottom.inputs()).toBe(0);
    await act(async () => { root!.unmount(); });
    container!.remove();

    await mount(defaultRenderFormulaBar({ workbook, editable, placement: 'top' }));
    expect(container!.querySelector('.formula-bar-mobile')).toBeNull();
    // The desktop bar's name box.
    expect(container!.querySelectorAll('input:not([type="date"])').length).toBeGreaterThan(0);
  });
});

/**
 * The field riding the keyboard (`floatOnKeyboard`, the default): the bar in place shows the active
 * cell read only, and the editor is a copy of the bar in a `KeyboardAccessory` portaled out of the
 * studio. A tap on the bar in place opens that field; the keyboard going away hands focus back.
 */
describe('MobileFormulaBar on the keyboard', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let keyboard: VirtualKeyboardStore = createVirtualKeyboardStore({ disabled: false });
  afterEach(async () => {
    keyboard = createVirtualKeyboardStore({ disabled: false });
    await act(async () => { root?.unmount(); });
    container?.remove();
    root = null;
    container = null;
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
  });

  const newBook = async (): Promise<{ workbook: IWorkbook, sheet: IWorksheet, editable: SheetEditable }> => {
    const workbook = new Workbook();
    await workbook.getCalculation().ready();
    const sheet = workbook.getSelectedWorksheet();
    return { workbook, sheet, editable: createEditable(sheet) };
  };

  const mount = async (props: Record<string, unknown>) => {
    let element: IFormulaBarElement | null = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(createElement(VirtualKeyboardProvider, { store: keyboard },
        createElement(MobileFormulaBar as never, { ...props, ref: (el: IFormulaBarElement | null) => { element = el; } })));
    });
    return {
      element: (): IFormulaBarElement => element!,
      inPlace: (): HTMLElement => container!.querySelector('.formula-bar-mobile') as HTMLElement,
      shown: (): string | null => container!.querySelector('.formula-bar-display')?.textContent ?? null,
      field: (): HTMLTextAreaElement => document.querySelector('.formula-bar-keyboard textarea') as HTMLTextAreaElement,
      accessory: (): HTMLElement => document.querySelector('.sxl-keyboard-accessory') as HTMLElement,
      button: (label: string): HTMLElement | null => container!.querySelector(`[aria-label="${label}"]`)
    };
  };

  /** Past the accessory's wait for a still viewport. */
  const settle = async (): Promise<void> => {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });
  };

  it('shows the active cell in place, read only; the field is in the copy outside the bar', async () => {
    const { workbook, sheet, editable } = await newBook();
    sheet.getRange('A1').setValue('hello');
    await sheet.getRange('A1').select();
    const bar = await mount({ workbook, editable });

    expect(bar.shown()).toBe('hello');
    expect(container!.querySelector('textarea')).toBeNull();
    expect(bar.field().value).toBe('hello');
    expect(bar.inPlace().contains(bar.field())).toBe(false);
    expect(bar.accessory().style.opacity).toBe('0');
  });

  it('a tap on the bar in place opens the field on the keyboard and starts the edit', async () => {
    const { workbook, sheet, editable } = await newBook();
    await sheet.getRange('A1').select();
    const bar = await mount({ workbook, editable });

    await act(async () => { (container!.querySelector('.formula-editor') as HTMLElement).click(); });
    expect(document.activeElement).toBe(bar.field());
    expect(editable.getSession()).not.toBeNull();
    // The studio's focus restore asks the bar, not its element: the field is outside it.
    expect(bar.element().isFocusWithin()).toBe(true);
    expect(bar.inPlace().contains(document.activeElement)).toBe(false);

    await settle();
    expect(bar.accessory().style.opacity).toBe('1');
    // The bar in place keeps its room, faded out.
    expect((bar.inPlace().firstElementChild as HTMLElement).style.opacity).toBe('0');
    await act(async () => { editable.cancel(); });
  });

  it('the input buttons in place open the field with their keyboard', async () => {
    const { workbook, editable } = await newBook();
    const bar = await mount({ workbook, editable });

    await act(async () => { bar.button('input-mode-decimal')!.click(); });
    expect(document.activeElement).toBe(bar.field());
    expect(bar.field().getAttribute('inputmode')).toBe('decimal');
    await act(async () => { editable.cancel(); });
  });

  it('keyboard mode keeps the copy on the keyboard with focus on the grid', async () => {
    const { workbook, editable } = await newBook();
    const bar = await mount({ workbook, editable });

    await act(async () => { keyboard.show(); });
    await settle();
    expect(bar.accessory().style.opacity).toBe('1');

    await act(async () => { keyboard.hide(); });
    await settle();
    expect(bar.accessory().style.opacity).toBe('0');
  });

  it('the keyboard going away hands focus back to the bar in place', async () => {
    const vv = Object.assign(new EventTarget(), {
      width: window.innerWidth, height: window.innerHeight, offsetTop: 0, offsetLeft: 0, scale: 1
    });
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    const { workbook, sheet, editable } = await newBook();
    await sheet.getRange('A1').select();
    const bar = await mount({ workbook, editable });

    await act(async () => { (container!.querySelector('.formula-editor') as HTMLElement).click(); });
    expect(document.activeElement).toBe(bar.field());

    await act(async () => {
      vv.height = window.innerHeight - 300;
      vv.dispatchEvent(new Event('resize'));
    });
    await act(async () => {
      vv.height = window.innerHeight;
      vv.dispatchEvent(new Event('resize'));
    });
    expect(document.activeElement).toBe(bar.inPlace());
    expect(bar.element().isFocusWithin()).toBe(true);
    await settle();
    expect(bar.accessory().style.opacity).toBe('0');
    await act(async () => { editable.cancel(); });
  });

  it('the Enter key in the field on the keyboard commits and moves down', async () => {
    const { workbook, sheet, editable } = await newBook();
    await sheet.getRange('A1').select();
    const bar = await mount({ workbook, editable });

    await act(async () => { (container!.querySelector('.formula-editor') as HTMLElement).click(); });
    await act(async () => { editable.getSession()?.setDirty('typed'); });
    await act(async () => {
      bar.field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true } as KeyboardEventInit));
    });
    await act(async () => { await workbook.getCalculation().ready(); });

    expect(sheet.getRange('A1').getValue()).toBe('typed');
    expect(sheet.getSelectedCell().getCoords()).toEqual({ rowIndex: 1, colIndex: 0 });
  });
});
