import { describe, it, expect, afterEach, beforeAll } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type IDataValidation, type IWorkbook } from '@sheetxl/sdk';

import { WorkbookProvider } from '@sheetxl/react';

import { AnchorItemsPanel } from '../anchorItems';
import { DataValidationItemsDescriptor } from '../dataValidation/DataValidationDetailsPanel';

/**
 * Save is a button: it takes focus without any of an operand field's own commit points, so it ends
 * the edit the field still holds — writing a formula's repair — or is held back when the operand
 * cannot take the text.
 */
describe('DataValidation editor save with an operand still being typed', () => {

  beforeAll(() => {
    if (typeof window.matchMedia === 'function') return;
    (window as any).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false
    });
  });

  afterEach(() => { document.body.innerHTML = ''; });

  const mountEditing = async () => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().ready();
    const target = workbook.getSelectedWorksheet().getDataValidations().add('A1:A5', {
      condition: { selector: 'date', operator: 'between', param: { from: 34965, to: 35064 } }
    } as any) as IDataValidation;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(WorkbookProvider as never, { workbook } as never,
        createElement(AnchorItemsPanel as never, { workbook, descriptor: DataValidationItemsDescriptor, args: { edit: target } } as never)));
    });
    const editor = (): HTMLElement | null => container.querySelector('.sxl-items-editor');
    return {
      target,
      editor,
      /** Types into a bound (0 = from, 1 = to) and leaves the text there, uncommitted. */
      typeBound: async (index: number, text: string): Promise<HTMLInputElement> => {
        const input = editor()!.querySelectorAll('.sxl-formula-field[data-grammar="formula"] input')[index] as HTMLInputElement;
        await act(async () => { input.focus(); });
        await act(async () => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          setter?.call(input, text);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        return input;
      },
      save: async (): Promise<void> => {
        const buttons = Array.from(editor()!.querySelectorAll('button.MuiButton-contained')) as HTMLElement[];
        await act(async () => { buttons[buttons.length - 1].click(); });
      },
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  it('commits a date still being typed', async () => {
    const panel = await mountEditing();
    expect(panel.editor()).toBeTruthy();
    await panel.typeBound(0, '10/1/95');
    await panel.save();
    expect(panel.target.getCondition()?.getParam()).toEqual({ from: 34973, to: 35064 });
    expect(panel.editor()).toBeNull();
    await panel.unmount();
  });

  it('repairs and commits a formula still being typed', async () => {
    const panel = await mountEditing();
    await panel.typeBound(0, '=TODAY(');
    await panel.save();
    const from = panel.target.getCondition()?.getParam()?.from;
    expect(from?.isIFormula ? from.getExpression() : from).toMatch(/^=?TODAY\(\)$/);
    expect(panel.editor()).toBeNull();
    await panel.unmount();
  });

  it('refuses a rule the draft as a whole cannot be saved as', async () => {
    // Reversed bounds: each field takes its date; only the condition can see the order.
    const reversed = await mountEditing();
    await reversed.typeBound(0, '1/1/97');
    await reversed.save();
    expect(reversed.target.getCondition()?.getParam()).toEqual({ from: 34965, to: 35064 });
    expect(reversed.editor()).toBeTruthy();
    expect(reversed.target.getCondition()?.validate()).toBeNull(); // the target was never touched
    await reversed.unmount();

    // A bound cleared: the comparison is inert, and Excel's dialog does not save one.
    const cleared = await mountEditing();
    await cleared.typeBound(1, '');
    await cleared.save();
    expect(cleared.target.getCondition()?.getParam()).toEqual({ from: 34965, to: 35064 });
    expect(cleared.editor()).toBeTruthy();
    await cleared.unmount();
  });

  it('refuses text a date bound cannot hold, leaving the editor open on it', async () => {
    const panel = await mountEditing();
    const input = await panel.typeBound(0, 'soon');
    await panel.save();
    expect(panel.target.getCondition()?.getParam()).toEqual({ from: 34965, to: 35064 });
    expect(panel.editor()).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    await panel.unmount();
  });

});
