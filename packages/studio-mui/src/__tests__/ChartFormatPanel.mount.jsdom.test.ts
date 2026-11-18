import { describe, it, expect, beforeAll, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type IChart, type IWorksheet } from '@sheetxl/sdk';

import { WorkbookProvider } from '@sheetxl/react';

import { ChartFormatPanel } from '../chart/ChartFormatPanel';
import { registerChartElementFormat } from '../chart/format/ChartElementFormat';

/**
 * The format pane for a chart, mounted on a real chart: the format editor on whichever element is
 * selected in the chart, with the tabs that element's type has. Asserted against the chart, not the
 * DOM, wherever a control writes.
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

  /** Mounts the pane; `rerender` draws it again as another call that opens it would, with what that call asks for. */
  const mountWith = async (workbook: Workbook, sheet: IWorksheet, chart: IChart): Promise<{ container: HTMLDivElement, rerender: (args?: { tab?: string }) => Promise<void> }> => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rerender = async (args?: { tab?: string }): Promise<void> => {
      await act(async () => {
        root.render(createElement(WorkbookProvider as never, { workbook } as never,
          createElement(ChartFormatPanel as never, { movable: chart.getMovable()!, sheet, args } as never)));
      });
    };
    await rerender();
    return { container, rerender };
  };

  const mount = async (workbook: Workbook, sheet: IWorksheet, chart: IChart): Promise<HTMLDivElement> =>
    (await mountWith(workbook, sheet, chart)).container;

  const select = async (sheet: IWorksheet, element: IChart.IElement): Promise<void> => {
    await act(async () => { sheet.getView().getChartElementSelection().select([element]); });
  };

  /** What the editor says it formats. */
  const title = (container: HTMLElement): string | undefined =>
    container.querySelector('[data-format-target]')!.firstElementChild!.textContent?.trim();

  /** The names on the tab strip; none when the target has one tab. */
  const tabs = (container: HTMLElement): (string | undefined)[] =>
    Array.from(container.querySelectorAll('[role="tab"]')).map(each => each.textContent?.trim());

  /** The key of the tab shown. */
  const shown = (container: HTMLElement): string | null =>
    container.querySelector('[data-format-tab]')?.getAttribute('data-format-tab') ?? null;

  const showTab = async (container: HTMLElement, label: string): Promise<void> => {
    const tab = Array.from(container.querySelectorAll('[role="tab"]')).find(each => each.textContent?.trim() === label) as HTMLElement;
    expect(tab, `tab '${label}' (saw: ${tabs(container).join(', ')})`).toBeTruthy();
    await act(async () => { tab.click(); });
  };

  const body = (container: HTMLElement): HTMLElement => container.querySelector('[data-format-tab]') as HTMLElement;

  const checkbox = (within: HTMLElement, label: string): HTMLInputElement => {
    const field = Array.from(within.querySelectorAll('label')).find(each => each.textContent?.trim() === label);
    expect(field, `checkbox '${label}'`).toBeTruthy();
    return field!.querySelector('input[type="checkbox"]') as HTMLInputElement;
  };

  const dropdown = (within: HTMLElement, label: string): HTMLElement => {
    const control = Array.from(within.querySelectorAll('.MuiFormControl-root'))
      .find(each => each.querySelector('label')?.textContent?.trim() === label);
    expect(control, `dropdown '${label}'`).toBeTruthy();
    return control!.querySelector('[role="combobox"]') as HTMLElement;
  };

  const choose = async (combo: HTMLElement, label: string): Promise<void> => {
    await act(async () => { combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    const items = Array.from(document.querySelectorAll('[role="option"]')) as HTMLElement[];
    const item = items.find(li => li.textContent?.trim() === label);
    expect(item, `option '${label}' (saw: ${items.map(li => li.textContent?.trim()).join(', ')})`).toBeTruthy();
    await act(async () => { item!.click(); });
  };

  const input = (within: HTMLElement, label: string): HTMLInputElement => {
    const control = Array.from(within.querySelectorAll('.MuiFormControl-root, .MuiTextField-root'))
      .find(each => each.querySelector('label')?.textContent?.trim() === label);
    expect(control, `field '${label}'`).toBeTruthy();
    return control!.querySelector('input') as HTMLInputElement;
  };

  const commit = async (field: HTMLInputElement, text: string): Promise<void> => {
    await act(async () => { field.focus(); });
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, text);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); });
  };

  it('formats the chart area while nothing in the chart is selected', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    expect(title(container)).toBe('Chart Area');
    expect(tabs(container)).toEqual(['Fill & Line', 'Text', 'Options']);
    expect(shown(container)).toBe('fillLine');
    await showTab(container, 'Options');
    const rounded = checkbox(body(container), 'Rounded corners');
    await act(async () => { rounded.click(); });
    expect(chart.getChartArea().getRoundedCorners()).toBe(true);
  });

  it('follows the selection, with the tabs the element\'s type has', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    await select(sheet, chart.getLegend());
    expect(title(container)).toBe('Legend');
    await showTab(container, 'Options');
    await choose(dropdown(body(container), 'Position'), 'Top');
    expect(chart.getLegend().getPosition()).toBe('top');

    // Gridlines are a line and nothing else: one tab, so no strip.
    await select(sheet, chart.getAxes().getValueAxis()!.getMajorGridlines());
    expect(tabs(container)).toEqual([]);
    expect(shown(container)).toBe('fillLine');
    expect(body(container).textContent).not.toContain('Fill Type');
  });

  it('stays on a tab from one element to the next, where the next has it', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    await select(sheet, chart.getLegend());
    await showTab(container, 'Text');
    await select(sheet, chart.getTitle());
    expect(shown(container)).toBe('text');
    const bold = checkbox(body(container), 'Bold');
    await act(async () => { bold.click(); });
    expect(chart.getTitle().getStyle().getFont().getBold()).toBe(true);
    // A series has no text: the first tab it has.
    await select(sheet, chart.getSeries()[0]);
    expect(shown(container)).toBe('fillLine');
  });

  it('leaves an axis\'s bound to the axis when it is emptied', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    const axis = chart.getAxes().getValueAxis()!;
    await select(sheet, axis);
    await showTab(container, 'Options');
    expect(input(body(container), 'Minimum').value).toBe('');
    await commit(input(body(container), 'Minimum'), '5');
    expect(axis.getMinimum()).toBe(5);
    expect(axis.isMinimumAuto()).toBe(false);
    await commit(input(body(container), 'Minimum'), '');
    expect(axis.isMinimumAuto()).toBe(true);
    expect(input(body(container), 'Minimum').value).toBe('');
  });

  it('sets a value axis\'s units, display units, scale and tick marks', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    const axis = chart.getAxes().getValueAxis()!;
    await select(sheet, axis);
    expect(tabs(container)).toEqual(['Fill & Line', 'Labels', 'Options']);
    await showTab(container, 'Options');
    expect(input(body(container), 'Major').value).toBe('');
    await commit(input(body(container), 'Major'), '4');
    expect(axis.getMajorUnit()).toBe(4);
    expect(axis.isMajorUnitAuto()).toBe(false);
    await commit(input(body(container), 'Major'), '');
    expect(axis.isMajorUnitAuto()).toBe(true);

    // The base is a logarithmic axis's alone.
    expect(body(container).textContent).not.toContain('Log base');
    await choose(dropdown(body(container), 'Scale'), 'Logarithmic');
    expect(axis.getScaleType()).toBe('logarithmic');
    expect(input(body(container), 'Log base').value).toBe('10');

    await choose(dropdown(body(container), 'Major type'), 'Cross');
    expect(axis.getMajorTickMark()).toBe('cross');

    await choose(dropdown(body(container), 'Crossing axis crosses at'), 'Maximum');
    expect(axis.getCrosses()).toBe('maximum');

    // The unit its numbers are shown in is said with its labels.
    expect(body(container).textContent).not.toContain('Display units');
    await showTab(container, 'Labels');
    await choose(dropdown(body(container), 'Display units'), 'Thousands');
    expect(axis.getDisplayUnit()).toBe('thousands');
    await act(async () => { checkbox(body(container), 'Show display units label').click(); });
    expect(axis.getShowDisplayUnitLabel()).toBe(false);
  });

  it('sets where an axis\'s labels sit, what they show and how they read, on a tab of their own', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    const axis = chart.getAxes().getCategoryAxis()!;
    await select(sheet, axis);
    await showTab(container, 'Labels');
    expect(shown(container)).toBe('labels');
    await act(async () => { checkbox(body(container), 'Multi-level category labels').click(); });
    expect(axis.getMultiLevel()).toBe(false);
    await act(async () => { checkbox(body(container), 'Bold').click(); });
    expect(axis.getStyle().getFont().getBold()).toBe(true);
    await choose(dropdown(body(container), 'Label position'), 'Low');
    expect(axis.getTickLabelPosition()).toBe('low');
    await commit(input(body(container), 'Distance from axis'), '300');
    expect(axis.getOffset()).toBe(300);
    await commit(input(body(container), 'Interval between labels'), '2');
    expect(axis.getTickLabelSpacing()).toBe(2);
    await choose(dropdown(body(container), 'Text direction'), 'Custom angle');
    expect(axis.getTextOrientation()).toBe(0);
    await commit(input(body(container), 'Angle'), '45');
    expect(axis.getTextOrientation()).toBe(45);

    // A category axis has what a text axis has: its type, where its categories stand, no bounds.
    await showTab(container, 'Options');
    expect(body(container).textContent).not.toContain('Bounds');
    await choose(dropdown(body(container), 'Axis position'), 'On tick marks');
    expect(axis.getIsBetweenCategories()).toBe(false);
    await choose(dropdown(body(container), 'Axis type'), 'Date axis');
    expect(axis.getCategoryType()).toBe('dateAxis');
    expect(body(container).textContent).toContain('Base unit');

    const value = chart.getAxes().getValueAxis()!;
    await select(sheet, value);
    await showTab(container, 'Labels');
    expect(value.getLinkNumberFormat()).toBe(true);
    await commit(input(body(container), 'Number format'), '0.0');
    expect(value.getNumberFormat()).toBe('0.0');
    expect(checkbox(body(container), 'Linked to source').checked).toBe(false);
    await act(async () => { checkbox(body(container), 'Linked to source').click(); });
    expect(value.getLinkNumberFormat()).toBe(true);
  });

  it('opens on the tab the call that opened it names, once', async () => {
    const { workbook, sheet, chart } = await newChart();
    const { container, rerender } = await mountWith(workbook, sheet, chart);
    const axis = chart.getAxes().getValueAxis()!;
    await select(sheet, axis);
    expect(shown(container)).toBe('fillLine');
    const asked = { tab: 'labels' };
    await rerender(asked);
    expect(shown(container)).toBe('labels');
    // The same call is not answered again: the tab chosen since stays.
    await showTab(container, 'Options');
    await rerender(asked);
    expect(shown(container)).toBe('options');
    // Another call asking for the same tab is.
    await rerender({ tab: 'labels' });
    expect(shown(container)).toBe('labels');
  });

  it('offers a series\' labels the places its type has, and what joins their parts', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    const labels = chart.getSeries()[0].getDataLabels();
    await act(async () => { labels.setVisible(true); });
    await select(sheet, labels);
    await showTab(container, 'Options');
    const position = dropdown(body(container), 'Position');
    await act(async () => { position.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    const offered = Array.from(document.querySelectorAll('[role="option"]')).map(each => each.textContent?.trim());
    expect(offered).toEqual(['Center', 'Inside end', 'Inside base', 'Outside end']);
    await act(async () => { (Array.from(document.querySelectorAll('[role="option"]'))[1] as HTMLElement).click(); });
    expect(labels.getPosition()).toBe('insideEnd');
    await choose(dropdown(body(container), 'Separator'), 'New line');
    expect(labels.getSeparator()).toBe('\n');
    await commit(input(body(container), 'Number format'), '0.00');
    expect(labels.getNumberFormat()).toBe('0.00');
    // A share of the whole is a pie's to show.
    expect(body(container).textContent).not.toContain('Percentage');
  });

  it('stacks every series from one series\' options, while they are drawn one way', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    await select(sheet, chart.getSeries()[1]);
    await showTab(container, 'Options');
    await choose(dropdown(body(container), 'Stacking'), 'Stacked');
    expect(chart.getChartType()).toBe('columnStacked');
    expect(chart.getSeries().map(series => series.getChartType())).toEqual(['columnStacked', 'columnStacked']);
    await select(sheet, chart.getSeries()[1]);
    await showTab(container, 'Options');
    await act(async () => { chart.getSeries()[1].setChartType('lineMarkers'); });
    expect(body(container).textContent).not.toContain('Stacking');
  });

  it('gives a series the tabs of how it is drawn, and says who shares its group\'s settings', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    const south = chart.getSeries()[1];
    await select(sheet, south);
    expect(title(container)).toBe('Series "South"');
    expect(tabs(container)).toEqual(['Fill & Line', 'Options']);
    await showTab(container, 'Options');
    expect(body(container).textContent).toContain('Shared with North');

    // Drawn as a line it has no fill, and has markers.
    await act(async () => { south.setChartType('lineMarkers'); });
    expect(tabs(container)).toEqual(['Line', 'Marker', 'Options']);
    await showTab(container, 'Marker');
    await choose(dropdown(body(container), 'Symbol'), 'Diamond');
    expect(south.getMarker().getSymbol()).toBe('diamond');
    // The marker pressed in the chart is its series' Marker tab.
    await showTab(container, 'Line');
    await select(sheet, south.getMarker());
    expect(title(container)).toBe('Series "South"');
    expect(shown(container)).toBe('marker');
  });

  it('formats a point with its marker and its label as tabs, and its first setting makes it custom', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    const point = chart.getSeries()[0].getPoints().getAt(2)!;
    await select(sheet, point);
    expect(title(container)).toContain('Point 3');
    expect(tabs(container)).toEqual(['Fill & Line', 'Label', 'Options']);
    expect(point.isOverridden()).toBe(false);
    await showTab(container, 'Options');
    await act(async () => { checkbox(body(container), 'Invert if negative').click(); });
    expect(point.getInvertIfNegative()).toBe(true);
    expect(point.isOverridden()).toBe(true);

    await showTab(container, 'Label');
    await act(async () => { checkbox(body(container), 'Show a label on this point').click(); });
    expect(point.getHasDataLabel()).toBe(true);
    // Its label pressed in the chart is the point's Label tab.
    await showTab(container, 'Fill & Line');
    await select(sheet, point.getDataLabel());
    expect(title(container)).toContain('Point 3');
    expect(shown(container)).toBe('label');
  });

  it('takes a host\'s format for a type of element', async () => {
    const { workbook, sheet, chart } = await newChart();
    const restore = registerChartElementFormat('plotArea', () => [
      { key: 'host', label: 'Host', fields: () => [{ type: 'flag', key: 'probe', label: 'Probe', get: () => false, set: () => {} }] }
    ]);
    try {
      const container = await mount(workbook, sheet, chart);
      await select(sheet, chart.getPlotArea());
      expect(shown(container)).toBe('host');
      expect(checkbox(body(container), 'Probe')).toBeTruthy();
    } finally {
      restore();
    }
  });
});
