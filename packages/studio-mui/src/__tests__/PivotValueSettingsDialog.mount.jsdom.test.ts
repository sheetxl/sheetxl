import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type IPivotTable } from '@sheetxl/sdk';

import { WorkbookProvider, type CommandContext } from '@sheetxl/react';

import { PivotValueSettingsDialog } from '../pivot/PivotValueSettingsDialog';

/**
 * Mount tests for the value settings dialog: what it hands back has to be only what was changed, with
 * the caption following the function until it is typed over.
 */
describe('PivotValueSettingsDialog (mount)', () => {
  const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = [];

  afterEach(async () => {
    for (const { root, container } of mounted.splice(0)) {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });

  /** A table of Sales by Region on `Report`, its value `Sum of Sales`. */
  const seed = async (): Promise<{ workbook: Workbook; value: IPivotTable.IDataField }> => {
    const workbook = new Workbook();
    const data = workbook.getWorksheets().getItems()[0];
    data.setName('Data');
    data.getRange('A1:C5').setValues([
      ['Region', 'Year', 'Sales'],
      ['East', 2023, 10],
      ['East', 2024, 20],
      ['West', 2023, 30],
      ['West', 2024, 40]
    ] as any);
    const sheet = workbook.getWorksheets().add('Report');
    await workbook.whenCalculationReady();
    const pivot = await sheet.getPivotTables().add('Data!A1:C5', 'A3', { rows: ['Region'], columns: ['Year'], values: ['Sales'] });
    return { workbook, value: pivot.getDataField('Sum of Sales')! };
  };

  const open = async (workbook: Workbook, value: IPivotTable.IDataField): Promise<{ emitted: CommandContext.PivotValueSettings[] }> => {
    const emitted: CommandContext.PivotValueSettings[] = [];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    await act(async () => {
      root.render(createElement(WorkbookProvider as never, { workbook } as never,
        createElement(PivotValueSettingsDialog as never, {
          open: true,
          initialValue: { value },
          onInput: (input: CommandContext.PivotValueSettings) => { emitted.push(input); }
        } as never)));
    });
    return { emitted };
  };

  const settle = async (): Promise<void> => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
  };

  const click = async (element: Element | null | undefined): Promise<void> => {
    expect(element).toBeTruthy();
    await act(async () => { (element as HTMLElement).click(); });
  };

  const byText = (selector: string, text: string): HTMLElement | undefined =>
    Array.from(document.querySelectorAll<HTMLElement>(selector)).find((each) => each.textContent === text);

  /** Drive a MUI Select the way the browser does: it opens on mousedown, not click. */
  const pick = async (className: string, value: string): Promise<void> => {
    const combobox = document.querySelector(`.${className} [role="combobox"]`) as HTMLElement;
    expect(combobox).toBeTruthy();
    await act(async () => {
      combobox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    await click(document.querySelector(`[role="option"][data-value="${value}"]`));
    await settle();
  };

  const nameInput = (): HTMLInputElement => document.querySelector<HTMLInputElement>('.autoFocus input')!;

  const type = async (input: HTMLInputElement, text: string): Promise<void> => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  const ok = async (): Promise<void> => {
    const buttons = Array.from(document.querySelectorAll('button.defaultOption'));
    await click(buttons[buttons.length - 1]);
    await settle();
  };

  it('names the value after the function picked, and hands back the function alone', async () => {
    const { workbook, value } = await seed();
    const { emitted } = await open(workbook, value);
    expect(document.querySelector('.pivot-source-name')?.textContent).toBe('Source name: Sales');
    expect(nameInput().value).toBe('Sum of Sales');

    await click(byText('[role="option"]', 'Average'));
    expect(nameInput().value).toBe('Average of Sales');
    await ok();
    expect(emitted.map((each) => each.changes)).toEqual([{ function: 'average' }]);
    // The dialog only collects: the table is the window's caller's to change.
    expect(value.getFunction()).toBe('sum');
  });

  it('keeps a typed caption through a function, and hands back how the value is shown', async () => {
    const { workbook, value } = await seed();
    const { emitted } = await open(workbook, value);
    await type(nameInput(), 'Growth');
    await click(byText('[role="option"]', 'Max'));
    expect(nameInput().value).toBe('Growth');

    await click(byText('[role="tab"]', 'Show values as'));
    await pick('pivot-show-as', 'difference');
    await pick('pivot-base-field', 'Year');
    await ok();
    expect(emitted.map((each) => each.changes)).toEqual([{
      function: 'max',
      showAs: { kind: 'difference', baseField: 'Year', baseItem: '(previous)' },
      name: 'Growth'
    }]);
  });
});
