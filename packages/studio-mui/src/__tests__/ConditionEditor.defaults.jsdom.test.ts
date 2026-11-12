import { describe, it, expect } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, Condition, ICondition, type IWorkbook } from '@sheetxl/sdk';

import { WorkbookProvider, useModelSync } from '@sheetxl/react';

import { ConditionEditor } from '../conditions';
import { buildDefaultParam, filterBySelector, resolveSelectorChange, type OperatorParam } from '../conditions/ConditionUtils';

const Ops = ICondition.BuiltInOperatorNames;
const Selectors = Condition.BuiltInSelectors;
const operators = Object.values(Condition.BuiltInOperators) as ICondition.IOperator[];

/**
 * What a condition holds after its type changes: never the empty "add condition"
 * state when the type has a default, and nothing lost by switching away and back.
 */
describe('ConditionEditor type changes', () => {

  const between3to5: OperatorParam = { operator: Ops.Between, param: { from: 3, to: 5 } };

  it('shows the type\'s default operator on a first choice', () => {
    const next = resolveSelectorChange({ from: null, to: Selectors.Number, current: null, operators });
    expect(next?.operator).toBe(Ops.Between);
  });

  it('takes the new type\'s default when the operator no longer applies', () => {
    // CF's report: Number → Text used to clear the operator and leave the "add condition" button.
    const next = resolveSelectorChange({ from: Selectors.Number, to: Selectors.Text, current: between3to5, operators });
    expect(next?.operator).toBe(Ops.TextContains);
  });

  it('restores what the type last held when switching back', () => {
    const next = resolveSelectorChange({
      from: Selectors.Text, to: Selectors.Number,
      current: { operator: Ops.TextContains, param: 'a' },
      remembered: between3to5,
      operators
    });
    expect(next).toEqual(between3to5);
  });

  it('keeps an operator and its values that still apply', () => {
    const next = resolveSelectorChange({ from: Selectors.Number, to: Selectors.Whole, current: between3to5, operators });
    expect(next).toEqual(between3to5);
  });

  it('uses a default param only where the type gives one', () => {
    const next = resolveSelectorChange({ from: null, to: Selectors.Logical, current: null, operators });
    expect(next).toEqual({ operator: Ops.EqualTo, param: true });
  });

  it('seeds a set from the values in the covered cells', async () => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().ready();
    const sheet = workbook.getWorksheetAt(0)!;
    sheet.getRange('A1:A4').setValues([['No'], ['Yes'], ['No'], [null]]);
    const param = buildDefaultParam(Condition.BuiltInOperators.InSet, operators, null, { ranges: sheet.getRanges('A1:A4') });
    expect(param).toEqual({ items: ['No', 'Yes'] });
  });

  it('offers membership under every type, and keeps a set across a type change', () => {
    for (const selector of [null, ...Object.values(Selectors)] as (ICondition.ISelector | null)[]) {
      const offered = filterBySelector(selector, operators).map((op) => op.getName());
      expect(offered, selector?.getName() ?? 'any').toContain(Ops.InSet);
    }
    const oneOf: OperatorParam = { operator: Ops.InSet, param: { items: [1, 2, 3] } };
    expect(resolveSelectorChange({ from: null, to: Selectors.Whole, current: oneOf, operators })).toBe(oneOf);
  });

  describe('focus after a type choice (mount)', () => {
    /** The panels' shape: the model's condition in, `setCondition` out, re-rendered on change. */
    const Host = ({ format }: { format: any }) => {
      useModelSync(format as never, 'onAnyChange');
      return createElement(ConditionEditor as never, {
        condition: format.getCondition(),
        ranges: format.getRanges(),
        onConditionChange: (next: unknown) => { format.setCondition(next as never); }
      });
    };

    const pickType = async (container: HTMLElement, title: string): Promise<void> => {
      const combo = container.querySelector('[role="combobox"]') as HTMLElement;
      await act(async () => { combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); });
      const item = Array.from(document.querySelectorAll('li'))
        .find((li) => li.textContent?.trim() === title) as HTMLElement;
      expect(item, title).toBeTruthy();
      await act(async () => { item.click(); });
    };

    it('puts the cursor in the first value field, its contents selected', async () => {
      const workbook: IWorkbook = new Workbook();
      await workbook.getCalculation().ready();
      const format = workbook.getWorksheetAt(0)!.getConditionalFormats().createItem();
      format.setCondition(null);
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(createElement(WorkbookProvider as never, { workbook } as never, createElement(Host, { format })));
      });

      await pickType(container, 'Number');
      expect(format.getCondition()?.getOperator()?.getName()).toBe(Ops.Between);
      const focused = document.activeElement as HTMLInputElement;
      expect(container.contains(focused)).toBe(true);
      expect(focused.tagName).toBe('INPUT');
      // `between` starts with both bounds empty, as Excel's dialog does.
      expect(format.getCondition()?.getParam()).toEqual({ from: null, to: null });
      expect(focused.value).toBe('');
      expect([focused.selectionStart, focused.selectionEnd]).toEqual([0, focused.value.length]);

      await pickType(container, 'Text');
      expect(format.getCondition()?.getOperator()?.getName()).toBe(Ops.TextContains);
      expect(container.contains(document.activeElement)).toBe(true);
      expect((document.activeElement as HTMLElement).tagName).toBe('INPUT');

      await act(async () => { root.unmount(); });
      container.remove();
    });
  });

  describe('Ignore Blanks (mount)', () => {
    const mount = async (includeBlanks: boolean, emitted: any[]) => {
      const workbook: IWorkbook = new Workbook();
      await workbook.getCalculation().ready();
      const format = workbook.getWorksheetAt(0)!.getConditionalFormats().createItem();
      format.setCondition({ selector: 'number', operator: 'between', param: { from: 1, to: 5 }, includeBlanks } as never);
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(createElement(WorkbookProvider as never, { workbook } as never,
          createElement(ConditionEditor as never, {
            condition: format.getCondition(),
            showIncludeBlanks: true,
            onConditionChange: (next: unknown) => { emitted.push(next); }
          })));
      });
      const checkbox = Array.from(container.querySelectorAll('input[type="checkbox"]')).pop() as HTMLInputElement;
      return {
        checkbox,
        unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
      };
    };

    it('is checked when blanks are let through, as Excel\'s allowBlank reads', async () => {
      const emitted: any[] = [];
      const { checkbox, unmount } = await mount(true, emitted);
      expect(checkbox.checked).toBe(true);
      await act(async () => { checkbox.click(); });
      expect(emitted.at(-1)?.includeBlanks).toBe(false);
      await unmount();
    });

    it('is unchecked when blanks are tested', async () => {
      const { checkbox, unmount } = await mount(false, []);
      expect(checkbox.checked).toBe(false);
      await unmount();
    });
  });

});
