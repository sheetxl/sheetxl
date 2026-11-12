import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type IPivotTable, type IWorkbook } from '@sheetxl/sdk';

import { WorkbookProvider } from '@sheetxl/react';

import { PivotTableHeader } from '../pivot/PivotTableHeader';

/**
 * Mount tests for the PivotTable Fields pane's header: a name and a source committed with Enter
 * change the table, and nothing changes before the commit.
 */
describe('PivotTableHeader (mount)', () => {
  const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = [];

  afterEach(async () => {
    for (const { root, container } of mounted.splice(0)) {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });

  /** Sales by Region on `Report`, from `Data!A1:B3`; `Data!A1:B4` holds one more row. */
  const seed = async (): Promise<{ workbook: IWorkbook; pivot: IPivotTable }> => {
    const workbook = new Workbook();
    const data = workbook.getWorksheets().getItems()[0];
    data.setName('Data');
    data.getRange('A1:B4').setValues([['Region', 'Sales'], ['East', 10], ['West', 20], ['North', 30]] as any);
    const sheet = workbook.getWorksheets().add('Report');
    await workbook.whenCalculationReady();
    const pivot = await sheet.getPivotTables().add('Data!A1:B3', 'A3', { rows: ['Region'], values: ['Sales'] });
    return { workbook, pivot };
  };

  const open = async (workbook: IWorkbook, pivot: IPivotTable): Promise<void> => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    await act(async () => {
      root.render(createElement(WorkbookProvider as never, { workbook } as never,
        createElement(PivotTableHeader as never, {
          pivot,
          name: pivot.getName(),
          source: pivot.getSource(),
          onError: (error: unknown) => { throw error; }
        } as never)));
    });
  };

  const settle = async (): Promise<void> => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
  };

  /** Name, then source. */
  const inputs = (): HTMLInputElement[] => Array.from(document.querySelectorAll<HTMLInputElement>('.sxl-pivot-table-header input'));

  const type = async (input: HTMLInputElement, text: string): Promise<void> => {
    await act(async () => { input.focus(); });
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  const enter = async (input: HTMLInputElement): Promise<void> => {
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    });
    await settle();
  };

  it('shows the name and the source', async () => {
    const { workbook, pivot } = await seed();
    await open(workbook, pivot);
    const [name, source] = inputs();
    expect(name.value).toBe('PivotTable1');
    expect(source.value).toBe('Data!A1:B3');
  });

  it('renames the table on Enter, not before', async () => {
    const { workbook, pivot } = await seed();
    await open(workbook, pivot);
    await type(inputs()[0], 'Regions');
    expect(pivot.getName()).toBe('PivotTable1');
    await enter(inputs()[0]);
    expect(pivot.getName()).toBe('Regions');
  });

  it('changes the source on Enter, not before', async () => {
    const { workbook, pivot } = await seed();
    await open(workbook, pivot);
    await type(inputs()[1], 'Data!A1:B4');
    expect(pivot.getSource()).toBe('Data!A1:B3');
    await enter(inputs()[1]);
    expect(pivot.getSource()).toBe('Data!A1:B4');
    expect(pivot.getRange().getA1()).toBe('A3:B7');
  });
});
