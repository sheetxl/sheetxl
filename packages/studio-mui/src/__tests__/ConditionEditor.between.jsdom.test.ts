import { describe, it, expect } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type IConditionalFormat, type IWorkbook } from '@sheetxl/sdk';

import { useModelSync, WorkbookProvider } from '@sheetxl/react';

import { ConditionEditor } from '../conditions';

/**
 * The ConditionalFormatEditorPanel wiring in miniature: the model's condition in, `setCondition`
 * out, re-rendered on every model change. Guards the between editor's keystroke loop — clearing a
 * bound must not flip the SELECTOR (Number → Any → Number …) or otherwise walk the condition.
 */
describe('ConditionEditor between (mount)', () => {

  /** Every selector the host ever rendered with — a transient null here IS the reported flicker. */
  const renderedSelectors: (string | null)[] = [];

  /** The panel's shape: condition from the model, setCondition back into it, model-synced. */
  const Host = ({ format }: { format: IConditionalFormat }) => {
    useModelSync(format as never, 'onAnyChange');
    const condition = format.getCondition();
    renderedSelectors.push(condition?.getSelector()?.getName() ?? null);
    return createElement(ConditionEditor as never, {
      selectorTitle: 'Highlight',
      condition,
      onConditionChange: (next: unknown) => { format.setCondition(next as never); }
    });
  };

  const mount = async (workbook: IWorkbook, format: IConditionalFormat): Promise<{ container: HTMLDivElement; unmount: () => Promise<void> }> => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    // Inside the real workbook context — a FormulaField without one degrades to a plain text
    // field, which is not the field the app runs.
    await act(async () => {
      root.render(createElement(WorkbookProvider as never, { workbook } as never,
        createElement(Host, { format })));
    });
    return {
      container,
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  /**
   * Type `text` into an input the way a user would (React onChange fires), then finish the edit
   * with Enter: an operand reaches the condition when the edit is done, not per keystroke.
   */
  const typeInto = async (input: HTMLInputElement, text: string): Promise<void> => {
    await act(async () => { input.focus(); });
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
  };

  const newFormat = async (): Promise<{ workbook: IWorkbook, format: IConditionalFormat }> => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().ready();
    const sheet = workbook.getWorksheetAt(0)!;
    // The items panel's shape: a DETACHED draft (`createItem`), not a live rule.
    const format = sheet.getConditionalFormats().createItem() as unknown as IConditionalFormat;
    format.setCondition({ selector: 'number', operator: 'between', param: { from: 3, to: 5 } } as never);
    return { workbook, format };
  };

  it('keeps the selector through clearing and retyping a between bound', async () => {
    const { workbook, format } = await newFormat();
    const { container, unmount } = await mount(workbook, format);

    // Two between bounds render as text inputs holding the committed values.
    const inputs = Array.from(container.querySelectorAll('input'))
      .filter((el) => el instanceof HTMLInputElement && el.type === 'text') as HTMLInputElement[];
    const from = inputs.find((el) => el.value === '3')!;
    expect(from).toBeTruthy();

    // Clear the bound — the selector must hold, and the field stays EMPTY (no snap-back to a 0
    // the user never typed; the cleared bound is a null param).
    await typeInto(from, '');
    expect(format.getCondition()?.getSelector()?.getName()).toBe('number');
    expect(format.getCondition()?.getOperator()?.getName()).toBe('between');
    expect(format.getCondition()?.getParam()?.from ?? null).toBeNull();
    expect(from.value).toBe('');

    // …and every following edit too.
    await typeInto(from, '4');
    expect(format.getCondition()?.getSelector()?.getName()).toBe('number');
    const param = format.getCondition()?.getParam();
    expect(param?.from).toBe(4);
    expect(param?.to).toBe(5);

    await typeInto(from, '42');
    expect(format.getCondition()?.getSelector()?.getName()).toBe('number');
    expect(format.getCondition()?.getParam()?.from).toBe(42);

    // No render — not even a transient one — ever saw the selector dropped.
    expect(renderedSelectors.filter((name) => name !== 'number')).toEqual([]);

    // The UI never flips the visible selector to "Any" either.
    expect(container.textContent).toContain('Number');

    await unmount();
  });

  /**
   * The reported flip (2026-08-21): pick the selector through the UI AFTER the editor rendered,
   * THEN edit a bound. The param editor's memoized change handler closed over the previous
   * render's selector, so every edit emitted the one-behind value — Number → Any → Number …
   */
  it('keeps a selector picked through the UI when a bound is then edited', async () => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().ready();
    const sheet = workbook.getWorksheetAt(0)!;
    const format = sheet.getConditionalFormats().createItem() as unknown as IConditionalFormat;
    // The fresh-rule shape: Cell Value (no selector), between.
    format.setCondition({ operator: 'between', param: { from: 0, to: 0 } } as never);
    renderedSelectors.length = 0;
    const { container, unmount } = await mount(workbook, format);

    // Pick "Number" in the Highlight select (MUI Select: mousedown opens the portal menu).
    const combo = container.querySelector('[role="combobox"]') as HTMLElement;
    await act(async () => {
      combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    const numberItem = Array.from(document.querySelectorAll('li'))
      .find((li) => li.textContent?.trim() === 'Number') as HTMLElement;
    expect(numberItem).toBeTruthy();
    await act(async () => { numberItem.click(); });
    expect(format.getCondition()?.getSelector()?.getName()).toBe('number');

    // Now edit the FROM bound — before the fix, this edit emitted the pre-pick selector.
    const inputs = Array.from(container.querySelectorAll('input'))
      .filter((el) => el instanceof HTMLInputElement && el.type === 'text') as HTMLInputElement[];
    const from = inputs.find((el) => el.value === '0')!;
    await typeInto(from, '3');
    expect(format.getCondition()?.getSelector()?.getName()).toBe('number');
    await typeInto(from, '');
    expect(format.getCondition()?.getSelector()?.getName()).toBe('number');
    await typeInto(from, '4');
    expect(format.getCondition()?.getSelector()?.getName()).toBe('number');
    expect(format.getCondition()?.getParam()?.from).toBe(4);

    // Once picked, no later render ever saw the selector dropped again.
    const afterPick = renderedSelectors.slice(renderedSelectors.indexOf('number'));
    expect(afterPick.filter((name) => name !== 'number')).toEqual([]);

    await unmount();
  });

});
