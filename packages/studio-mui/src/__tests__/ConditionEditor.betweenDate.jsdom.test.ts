import { describe, it, expect } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type IDataValidation, type IWorkbook } from '@sheetxl/sdk';

import { useModelSync, WorkbookProvider } from '@sheetxl/react';

import { ConditionEditor } from '../conditions';

/**
 * A between rule's bounds under a date or time type: typed as a cell entry is, held as serials,
 * shown back as dates. Excel's dialog reads `9/23/95` into a Start date the same way and reads it
 * back as `9/23/1995`.
 *
 * An operand is live, but only text that makes one reaches the condition — `09/` and `=NOW(` never
 * do — and the field keeps the text as typed until the edit ends.
 */
describe('ConditionEditor between, date and time bounds (mount)', () => {

  /** The data validation editor's shape: the draft's condition in, `setCondition` out. */
  const Host = ({ validation, writes }: { validation: IDataValidation, writes: unknown[] }) => {
    useModelSync(validation as never, 'onAnyChange');
    return createElement(ConditionEditor as never, {
      condition: validation.getCondition(),
      ranges: validation.getRanges(),
      onConditionChange: (next: unknown) => { writes.push(next); validation.setCondition(next as never); }
    });
  };

  const mount = async (condition: unknown): Promise<{
    validation: IDataValidation;
    /** Every condition the editor wrote. */
    writes: unknown[];
    bounds: () => HTMLInputElement[];
    unmount: () => Promise<void>;
  }> => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().ready();
    const validation = workbook.getWorksheetAt(0)!.getDataValidations().createItem() as unknown as IDataValidation;
    validation.setCondition(condition as never);
    const writes: unknown[] = [];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(WorkbookProvider as never, { workbook } as never, createElement(Host, { validation, writes })));
    });
    return {
      validation,
      writes,
      // The two bound fields, not the selects' own hidden value inputs.
      bounds: () => Array.from(container.querySelectorAll<HTMLInputElement>('.sxl-formula-field input')),
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  const setText = async (input: HTMLInputElement, text: string): Promise<void> => {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  /** One keystroke at a time, as the field sees typing. Nothing is committed. */
  const typeInto = async (input: HTMLInputElement, text: string): Promise<void> => {
    await act(async () => { input.focus(); });
    for (let i=1; i<=text.length; i++) await setText(input, text.substring(0, i));
  };

  const pressEnter = async (input: HTMLInputElement): Promise<void> => {
    await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  };

  const blurTo = async (input: HTMLInputElement, next: HTMLInputElement): Promise<void> => {
    await act(async () => { next.focus(); });
  };

  const EmptyDateBetween = { selector: 'date', operator: 'between', param: { from: null, to: null } };

  /** The `from` bound of every condition the editor wrote. */
  const fromsOf = (writes: unknown[]): unknown[] => writes.map((w: any) => w?.param?.from);

  it('holds a typed date as its serial, sending only the prefixes that are dates', async () => {
    const { validation, writes, bounds, unmount } = await mount(EmptyDateBetween);
    const [from, to] = bounds();
    expect([from.value, to.value]).toEqual(['', '']);

    await typeInto(from, '09/23/95');
    expect(from.value).toBe('09/23/95'); // as typed — no re-imaging under the caret
    expect(validation.getCondition()?.getParam()?.from).toBe(34965);
    // `09/` and `09/23/` are not dates, so no write ever held text.
    expect(fromsOf(writes).every((v) => typeof v === 'number')).toBe(true);
    await pressEnter(from);
    expect(from.value).toBe('9/23/1995'); // the edit is done: shown as the date it was read as
    expect(validation.getCondition()?.getParam()?.from).toBe(34965);

    await typeInto(to, '12/31/1995');
    await blurTo(to, from); // leaving the field commits too
    expect(validation.getCondition()?.getParam()).toEqual({ from: 34965, to: 35064 });
    expect(validation.getCondition()?.getSelector()?.getName()).toBe('date');

    await unmount();
  });

  it('shows serials back as dates, and as times under a time type', async () => {
    const dates = await mount({ selector: 'date', operator: 'between', param: { from: 34965, to: 35064 } });
    expect(dates.bounds().map((el) => el.value)).toEqual(['9/23/1995', '12/31/1995']);
    await dates.unmount();

    const times = await mount({ selector: 'time', operator: 'between', param: { from: 0.25, to: 0.75 } });
    expect(times.bounds().map((el) => el.value)).toEqual(['6:00:00 AM', '6:00:00 PM']);
    const [from] = times.bounds();
    await typeInto(from, '9:30');
    await pressEnter(from);
    expect(times.validation.getCondition()?.getParam()?.from).toBeCloseTo(9.5 / 24, 10);
    expect(from.value).toBe('9:30:00 AM'); // read back as the time it was understood as
    await times.unmount();
  });

  it('keeps a formula bound a formula, committed whole', async () => {
    const { validation, writes, bounds, unmount } = await mount(EmptyDateBetween);
    const [from] = bounds();
    await typeInto(from, '=TODAY()');
    // `=`, `=TODAY(` do not parse, so every write held a formula that does.
    expect(fromsOf(writes).every((v: any) => v?.isIFormula && v.isValid())).toBe(true);
    await pressEnter(from);
    const value = validation.getCondition()?.getParam()?.from;
    expect(value?.isIFormula ? value.getExpression() : value).toMatch(/^=?TODAY\(\)$/);
    expect(bounds()[0].value).toBe('=TODAY()');
    await unmount();
  });

  it('outlines finished text that is not a date, and never sends it', async () => {
    const { validation, bounds, unmount } = await mount(EmptyDateBetween);
    const [from] = bounds();
    await typeInto(from, 'soon');
    expect(from.getAttribute('aria-invalid')).toBe('false'); // still being typed
    await pressEnter(from);
    expect(validation.getCondition()?.getParam()?.from).toBeNull();
    expect(from.value).toBe('soon');
    expect(from.getAttribute('aria-invalid')).toBe('true');

    await typeInto(from, '9/23/95');
    await pressEnter(from);
    expect(from.getAttribute('aria-invalid')).toBe('false');
    await unmount();
  });

  it('leaves a number bound a number', async () => {
    const { validation, bounds, unmount } = await mount({ selector: 'number', operator: 'between', param: { from: null, to: null } });
    const [from] = bounds();
    await typeInto(from, '09');
    expect(from.value).toBe('09');
    await pressEnter(from);
    expect(validation.getCondition()?.getParam()?.from).toBe(9);
    await unmount();
  });

});
