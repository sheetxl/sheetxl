import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type ICellRanges, type IWorkbook } from '@sheetxl/sdk';

import { WorkbookProvider, type CommandContext } from '@sheetxl/react';

import { PivotTableNewDialog } from '../dialog/PivotTableNewDialog';

/**
 * Mount tests for the New PivotTable dialog: what it hands back, a name kept as a name, and a location
 * in use refused before Ok.
 */
describe('PivotTableNewDialog (mount)', () => {
  const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = [];

  afterEach(async () => {
    for (const { root, container } of mounted.splice(0)) {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });

  /** A source on `Data`, as a range and as the table `Sales`; `Report` selected. */
  const seed = async (): Promise<IWorkbook> => {
    const workbook = new Workbook();
    const data = workbook.getWorksheets().getItems()[0];
    data.setName('Data');
    data.getRange('A1:B3').setValues([['Region', 'Sales'], ['East', 10], ['West', 20]] as any);
    data.getTables().add('A1:B3', { hasHeader: true, properties: { name: 'Sales' } } as any);
    const report = workbook.getWorksheets().add('Report');
    await workbook.whenCalculationReady();
    await report.select();
    return workbook;
  };

  // The command's check, in short: any value in the empty table's 18 x 3 cells.
  const target: CommandContext.PivotTableTarget = {
    validateName: (name: string): void => { if (name.length === 0) throw new Error('empty'); },
    checkLocation: (location: ICellRanges): string | null => {
      const { rowStart, colStart } = location.at(0).getCoords();
      const block = location.at(0).getWorksheet().getRange({ rowStart, colStart, rowEnd: rowStart + 17, colEnd: colStart + 2 });
      return block.getValues().flat().some((value) => value !== null) ? 'error.pivotTable.destinationOccupied' : null;
    }
  };

  const open = async (workbook: IWorkbook): Promise<{ emitted: CommandContext.NewPivotTable[] }> => {
    const emitted: CommandContext.NewPivotTable[] = [];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    const source = workbook.getWorksheets().getByName('Data')!.getRanges('A1:B3').getFixed(true);
    await act(async () => {
      root.render(createElement(WorkbookProvider as never, { workbook } as never,
        createElement(PivotTableNewDialog as never, {
          open: true,
          initialValue: { source, location: null, name: 'PivotTable1' },
          context: () => target,
          onInput: (input: CommandContext.NewPivotTable) => { emitted.push(input); }
        } as never)));
    });
    return { emitted };
  };

  const settle = async (): Promise<void> => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
  };

  /** Name, source, location, in that order. */
  const inputs = (): HTMLInputElement[] => Array.from(document.querySelectorAll<HTMLInputElement>('input'));

  const type = async (input: HTMLInputElement, text: string): Promise<void> => {
    await act(async () => { input.focus(); });
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  const ok = async (): Promise<void> => {
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('button.defaultOption'));
    expect(buttons.length).toBeGreaterThan(0);
    await act(async () => { buttons[buttons.length - 1].click(); });
    await settle();
  };

  it('opens with the name and the source, and the location blank', async () => {
    const workbook = await seed();
    await open(workbook);
    const [name, source, location] = inputs();
    expect(name.value).toBe('PivotTable1');
    expect(source.value).toBe('$A$1:$B$3');
    expect(location.value).toBe('');
  });

  it('hands back nothing while the location is blank', async () => {
    const workbook = await seed();
    const { emitted } = await open(workbook);
    await ok();
    expect(emitted).toEqual([]);
  });

  it('hands back the source as a range and the location on the sheet it opened on', async () => {
    const workbook = await seed();
    const { emitted } = await open(workbook);
    await type(inputs()[2], 'H3');
    await ok();
    expect(emitted).toHaveLength(1);
    const [value] = emitted;
    expect(value.name).toBe('PivotTable1');
    expect((value.source as ICellRanges).at(0).getWorksheet().getName()).toBe('Data');
    expect((value.source as ICellRanges).at(0).getA1()).toBe('$A$1:$B$3');
    expect(value.location!.at(0).getWorksheet().getName()).toBe('Report');
    expect(value.location!.at(0).getA1()).toBe('Report!H3');
  });

  it('keeps a table named as the source as its name', async () => {
    const workbook = await seed();
    const { emitted } = await open(workbook);
    await type(inputs()[1], 'Sales');
    await type(inputs()[2], 'H3');
    await ok();
    expect(emitted.map((each) => each.source)).toEqual(['Sales']);
  });

  it('refuses a location whose cells hold a value, and says why', async () => {
    const workbook = await seed();
    workbook.getWorksheets().getByName('Report')!.getRange('I5').setValue('in the way');
    const { emitted } = await open(workbook);
    await type(inputs()[2], 'H3');
    await settle();
    expect(document.body.textContent).toMatch(/hold values|destinationOccupied/);
    await ok();
    expect(emitted).toEqual([]);
  });
});
