import { describe, it, expect, beforeAll, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type IChart, type IWorksheet } from '@sheetxl/sdk';

import { WorkbookProvider } from '@sheetxl/react';

import { ChartFormatPanel } from '../chart/ChartFormatPanel';

/**
 * The format pane for a chart, mounted on a real chart and driven as a user drives it: an element is
 * chosen from the chart's elements, and each control writes through that element. Asserted against
 * the chart, not the DOM, wherever a control writes.
 */
describe('ChartFormatPanel (mount)', () => {
  // The fill and line previews resolve the grid's color scheme through `prefers-color-scheme`.
  beforeAll(() => {
    if (typeof window.matchMedia === 'function') return;
    (window as any).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false
    });
  });

  afterEach(() => { document.body.innerHTML = ''; });

  const newChart = async (): Promise<{ workbook: Workbook, sheet: IWorksheet, chart: IChart }> => {
    const workbook = new Workbook();
    await workbook.getCalculation().ready();
    const sheet = workbook.getWorksheets().getItems()[0];
    sheet.getRange('A1:C5').setValues([
      [null, 'North', 'South'],
      ['Q1', 10, 4],
      ['Q2', 12, 6],
      ['Q3', 9, 8],
      ['Q4', 14, 7]
    ]);
    const chart = await sheet.getCharts().add('A1:C5', { type: 'columnClustered' });
    return { workbook, sheet, chart };
  };

  const mount = async (workbook: Workbook, sheet: IWorksheet, chart: IChart): Promise<HTMLDivElement> => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(WorkbookProvider as never, { workbook } as never,
        createElement(ChartFormatPanel as never, { movable: chart.getMovable()!, sheet } as never)));
    });
    return container;
  };

  /** The element picker: the pane's first dropdown. */
  const picker = (container: HTMLElement): HTMLElement => container.querySelector('[role="combobox"]') as HTMLElement;

  const options = async (combo: HTMLElement): Promise<HTMLElement[]> => {
    await act(async () => { combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    return Array.from(document.querySelectorAll('[role="option"]')) as HTMLElement[];
  };

  const choose = async (combo: HTMLElement, label: string): Promise<void> => {
    const items = await options(combo);
    const item = items.find(li => li.textContent?.trim() === label);
    expect(item, `option '${label}' (saw: ${items.map(li => li.textContent?.trim()).join(', ')})`).toBeTruthy();
    await act(async () => { item!.click(); });
  };

  /** The checkbox of the option labeled `label`. */
  const checkbox = (container: HTMLElement, label: string): HTMLInputElement => {
    const row = Array.from(container.querySelectorAll('label')).find(each => each.textContent?.trim() === label);
    expect(row, `checkbox '${label}'`).toBeTruthy();
    return row!.querySelector('input[type="checkbox"]') as HTMLInputElement;
  };

  it('offers the elements the chart shows, by Excel\'s names, starting at the chart area', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    expect(picker(container).textContent?.trim()).toBe('Chart Area');
    const labels = (await options(picker(container))).map(li => li.textContent?.trim());
    expect(labels).toEqual([
      'Chart Area', 'Chart Title', 'Legend', 'Plot Area', 'Horizontal (Category) Axis', 'Vertical (Value) Axis',
      'Vertical (Value) Axis Major Gridlines', 'Series "North"', 'Series "South"'
    ]);
  });

  it('writes through the element chosen, and keeps it chosen once hidden', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    await choose(picker(container), 'Chart Title');
    const shown = checkbox(container, 'Shown');
    expect(shown.checked).toBe(true);
    await act(async () => { shown.click(); });
    expect(chart.getTitle().getVisible()).toBe(false);
    expect(picker(container).textContent?.trim()).toBe('Chart Title');
    expect(checkbox(container, 'Shown').checked).toBe(false);
  });

  it('sets an element\'s own options: the legend\'s place', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    await choose(picker(container), 'Legend');
    const position = Array.from(container.querySelectorAll('[role="combobox"]'))
      .find(each => each.textContent?.trim() === 'Bottom') as HTMLElement;
    expect(position, 'the legend position dropdown').toBeTruthy();
    await choose(position, 'Top');
    expect(chart.getLegend().getPosition()).toBe('top');
  });

  it('shows the text style of an element with text', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    await choose(picker(container), 'Vertical (Value) Axis');
    const bold = checkbox(container, 'Bold');
    expect(bold.checked).toBe(false);
    await act(async () => { bold.click(); });
    expect(chart.getAxes().getValueAxis()!.getStyle().getFont().getBold()).toBe(true);
  });
});
