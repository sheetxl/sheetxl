import { describe, it, expect, beforeAll, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type IChart, type IWorksheet } from '@sheetxl/sdk';

import { WorkbookProvider } from '@sheetxl/react';

import { ChartDetailsPanel } from '../chart/ChartDetailsPanel';

/**
 * The details of a chart, mounted on a real chart and driven as a user drives it: the chart is a
 * tree of rows, each opened by its header, shown or hidden by its toggle, and added to or removed
 * from its list. Asserted against the chart, not the DOM, wherever a control writes.
 */
describe('ChartDetailsPanel (mount)', () => {
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
        createElement(ChartDetailsPanel as never, { movable: chart.getMovable()!, sheet } as never)));
    });
    return container;
  };

  /** The row with `id`: an element's path, for a row that is the element's alone. */
  const row = (container: HTMLElement, id: string): HTMLElement => {
    const found = Array.from(container.querySelectorAll('[data-row]')).find(each => each.getAttribute('data-row') === id);
    expect(found, `row '${id}'`).toBeTruthy();
    return found as HTMLElement;
  };

  /** The head of the pane: the chart as a whole. */
  const source = (container: HTMLElement): HTMLElement => container.querySelector('[data-section="source"]') as HTMLElement;

  /** The button that opens and closes a row, or selects the element of a row with nothing inside it. */
  const header = (container: HTMLElement, id: string): HTMLButtonElement =>
    row(container, id).firstElementChild!.querySelector('button') as HTMLButtonElement;

  const open = async (container: HTMLElement, id: string): Promise<void> => {
    await act(async () => { header(container, id).click(); });
  };

  /** A row's body, or `null` while it has never been opened. */
  const body = (id: string): HTMLElement | null => document.getElementById(`chart-pane-body:${id}`);

  /** The toggle on a row's header, or `null` for a row with none. */
  const toggle = (container: HTMLElement, id: string): HTMLInputElement | null =>
    row(container, id).firstElementChild!.querySelector('input[type="checkbox"]');

  /** The labels of the rows directly under the list with `id`. */
  const labels = (container: HTMLElement, id: string): (string | undefined)[] => {
    const list = Array.from(container.querySelectorAll('[data-list]')).find(each => each.getAttribute('data-list') === id);
    expect(list, `list '${id}'`).toBeTruthy();
    return Array.from(list!.children)
      .filter(each => each.hasAttribute('data-row'))
      .map(each => each.firstElementChild!.querySelector('button')?.textContent?.trim());
  };

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

  /** The checkbox of the field labeled `label`, inside `within`. */
  const checkbox = (within: HTMLElement, label: string): HTMLInputElement => {
    const field = Array.from(within.querySelectorAll('label')).find(each => each.textContent?.trim() === label);
    expect(field, `checkbox '${label}'`).toBeTruthy();
    return field!.querySelector('input[type="checkbox"]') as HTMLInputElement;
  };

  it('lists the chart as closed rows under Series, Axes and Elements, with no element picker', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    // The chart as a whole comes first, with no heading and nothing to open.
    expect(container.firstElementChild!.firstElementChild!.getAttribute('data-section')).toBe('source');
    expect(container.querySelector('[data-row="dataSource"]')).toBeNull();
    expect(labels(container, 'section/series')).toEqual(['North', 'South']);
    expect(labels(container, 'section/axes')).toEqual(['Horizontal (Category) Axis', 'Vertical (Value) Axis']);
    expect(labels(container, 'section/elements')).toEqual(['Title', 'Legend', 'Data Table', 'Plot Area']);
    // No picker of elements: the only dropdowns on the closed tree are the series' types.
    expect(container.querySelectorAll('[role="combobox"]').length).toBe(2);
    // A closed row has built nothing but its header.
    expect(body('title')).toBeNull();
    expect(body('series/0')).toBeNull();
  });

  it('gives each kind of row its control: a toggle, nothing, or a remove button', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    expect(row(container, 'title').getAttribute('data-row-kind')).toBe('toggle');
    expect(toggle(container, 'title')!.checked).toBe(true);
    expect(toggle(container, 'dataTable')!.checked).toBe(false);
    expect(row(container, 'plotArea').getAttribute('data-row-kind')).toBe('always');
    expect(toggle(container, 'plotArea')).toBeNull();
    expect(row(container, 'plotArea').querySelector('button[aria-label^="Remove"]')).toBeNull();
    expect(row(container, 'title').querySelector('button[aria-label^="Remove"]')).toBeNull();
    expect(row(container, 'series/0').getAttribute('data-row-kind')).toBe('item');
    expect(toggle(container, 'series/0')).toBeNull();
    expect(row(container, 'series/0').firstElementChild!.querySelector('button[aria-label^="Remove"]')).toBeTruthy();
  });

  it('hides an element from its header and still opens its row', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    await act(async () => { toggle(container, 'title')!.click(); });
    expect(chart.getTitle().getVisible()).toBe(false);
    expect(toggle(container, 'title')!.checked).toBe(false);
    await open(container, 'title');
    expect(header(container, 'title').getAttribute('aria-expanded')).toBe('true');
    expect(body('title'), 'the hidden title\'s settings').toBeTruthy();
    // Shown again, it has lost nothing.
    await act(async () => { toggle(container, 'title')!.click(); });
    expect(chart.getTitle().getVisible()).toBe(true);
  });

  it('holds no formatting: a row with nothing to say of its data does not open', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    for (const id of ['legend', 'dataTable', 'plotArea']) {
      expect(header(container, id).hasAttribute('aria-expanded'), id).toBe(false);
    }
    await open(container, 'legend');
    expect(body('legend')).toBeNull();
    // A series says what it reads and which axis it is on, and nothing of how it is drawn.
    await open(container, 'series/0');
    const fields = Array.from(body('series/0')!.querySelectorAll(':scope > [data-field], :scope > div > label')).length;
    expect(fields).toBeGreaterThan(0);
    expect(body('series/0')!.textContent).not.toContain('Fill');
    expect(body('series/0')!.textContent).not.toContain('Gap width');
    expect(body('series/0')!.textContent).not.toContain('Shared with');
  });

  it('gives every row of an element a format button, which selects the element', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    const selection = sheet.getView().getChartElementSelection();
    const button = (id: string): HTMLButtonElement | null => row(container, id).firstElementChild!.querySelector('button[aria-label^="Format"]');
    expect(button('legend')!.getAttribute('aria-label')).toBe('Format Legend');
    await act(async () => { button('legend')!.click(); });
    expect(selection.getActive()).toBe(chart.getLegend());
    await act(async () => { button('series/1')!.click(); });
    expect(selection.getActive()).toBe(chart.getSeries()[1]);
    // The chart area is the chart itself: it has no row, and is formatted from the head's toolbar,
    // with nothing inside the chart selected.
    expect(container.querySelector('[data-row="chartArea"]')).toBeNull();
    const area = source(container).querySelector('[role="toolbar"] button[aria-label="Format Chart Area"]') as HTMLButtonElement;
    await act(async () => { area.click(); });
    expect(selection.getActive()).toBeNull();
  });

  it('nests an axis\'s labels, title and gridlines as rows of their own', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    await open(container, 'axes/primary/value');
    const inner = Array.from(body('axes/primary/value')!.querySelectorAll('[data-row]'))
      .map(each => each.firstElementChild!.querySelector('button')?.textContent?.trim());
    expect(inner).toEqual(['Labels', 'Title', 'Major Gridlines', 'Minor Gridlines']);
    // An axis's labels are there or not: off is the position that draws none.
    const labels = toggle(container, 'axes/primary/value:labels')!;
    expect(labels.checked).toBe(true);
    await act(async () => { labels.click(); });
    expect(chart.getAxes().getValueAxis()!.getTickLabelPosition()).toBe('none');
    await act(async () => { toggle(container, 'axes/primary/value:labels')!.click(); });
    expect(chart.getAxes().getValueAxis()!.getTickLabelPosition()).toBe('nextToAxis');
    expect(toggle(container, 'axes/primary/value/majorGridlines')!.checked).toBe(true);
    const minor = toggle(container, 'axes/primary/value/minorGridlines')!;
    expect(minor.checked).toBe(false);
    await act(async () => { minor.click(); });
    expect(chart.getAxes().getValueAxis()!.getMinorGridlines().getVisible()).toBe(true);
  });

  it('opens rows independently', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    await open(container, 'series/0');
    await open(container, 'series/1');
    expect(header(container, 'series/0').getAttribute('aria-expanded')).toBe('true');
    expect(header(container, 'series/1').getAttribute('aria-expanded')).toBe('true');
  });

  it('sets how hidden and empty cells are read, under Data', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    expect(labels(container, 'section/data')).toEqual(['Hidden and Empty Cells']);
    // It is of the chart as a whole: there is no element to format or to show.
    expect(row(container, 'data/cells').querySelector('button[aria-label^="Format"]')).toBeNull();
    expect(toggle(container, 'data/cells')).toBeNull();
    await open(container, 'data/cells');
    const combo = (): HTMLElement => body('data/cells')!.querySelector('[role="combobox"]') as HTMLElement;
    expect(combo().textContent?.trim()).toBe('Gaps');
    await choose(combo(), 'Zero');
    expect(chart.getDisplayBlanksAs()).toBe('zero');

    const hidden = checkbox(body('data/cells')!, 'Show data in hidden rows and columns');
    expect(hidden.checked).toBe(false);
    await act(async () => { hidden.click(); });
    expect(chart.getPlotVisibleOnly()).toBe(false);

    const na = checkbox(body('data/cells')!, 'Show #N/A as an empty cell');
    expect(na.checked).toBe(true);
    await act(async () => { na.click(); });
    expect(chart.getDisplayNaAsBlank()).toBe(false);

    // Columns have no line to draw across a blank; lines do.
    expect((await options(combo())).map(li => li.textContent?.trim())).toEqual(['Gaps', 'Zero']);
    await act(async () => { chart.setChartType('line'); });
    await choose(combo(), 'Connect data points with line');
    expect(chart.getDisplayBlanksAs()).toBe('interplotted');
  });

  it('adds to a list from its heading and removes an item from its row', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    const north = chart.getSeries()[0];
    await open(container, 'series/0');
    const add = body('series/0')!.querySelector('button[aria-label="Add trendline"]') as HTMLButtonElement;
    expect(add, 'the trendlines\' add button').toBeTruthy();
    await act(async () => { add.click(); });
    expect(north.getTrendlines().length).toBe(1);
    expect(labels(container, 'series/0/trendlines')).toEqual(['Trendline 1']);
    expect(row(container, 'series/0/trendlines/0').getAttribute('data-row-kind')).toBe('item');
    const remove = row(container, 'series/0/trendlines/0').querySelector('button[aria-label^="Remove"]') as HTMLButtonElement;
    await act(async () => { remove.click(); });
    expect(north.getTrendlines().length).toBe(0);
    expect(labels(container, 'series/0/trendlines')).toEqual([]);
  });

  it('lists the secondary axes once a series uses them', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    await open(container, 'series/1');
    const secondary = checkbox(body('series/1')!, 'Plot on the secondary axis');
    await act(async () => { secondary.click(); });
    expect(chart.getSeries()[1].getAxisGroup()).toBe('secondary');
    expect(labels(container, 'section/axes')).toContain('Secondary Vertical (Value) Axis');
    expect(row(container, 'axes/secondary/value').getAttribute('data-row-kind')).toBe('derived');
    await act(async () => { secondary.click(); });
    expect(labels(container, 'section/axes')).toEqual(['Horizontal (Category) Axis', 'Vertical (Value) Axis']);
  });

  /** The input of the field labeled `label`, inside `within`. */
  const input = (within: HTMLElement, label: string): HTMLInputElement => {
    const control = Array.from(within.querySelectorAll('.MuiFormControl-root, .MuiTextField-root'))
      .find(each => each.querySelector('label')?.textContent?.trim() === label);
    expect(control, `field '${label}'`).toBeTruthy();
    return control!.querySelector('input') as HTMLInputElement;
  };

  /** Types `text` over a field's text and commits it with Enter. */
  const commit = async (field: HTMLInputElement, text: string): Promise<void> => {
    await act(async () => { field.focus(); });
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, text);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); });
  };

  /** A drag event React will take, with the little of a `DataTransfer` the pane uses. */
  const dragEvent = (type: string): Event => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { dataTransfer: { effectAllowed: 'none', dropEffect: 'none', setData: () => {}, getData: () => '' } });
    return event;
  };

  it('shows a series\' color and type on its header, and draws it as another type from there', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    const head = row(container, 'series/1').firstElementChild as HTMLElement;
    expect(head.querySelector('[data-swatch]')!.getAttribute('data-swatch'), 'the series\' color').not.toBe('');
    const picker = head.querySelector('[role="combobox"]') as HTMLElement;
    expect(picker.getAttribute('aria-label')).toBe('Chart type of Series "South"');
    await choose(picker, 'Line with Markers Chart');
    expect(chart.getSeries()[1].getChartType()).toBe('lineMarkers');
    expect(chart.getSeries()[0].getChartType()).toBe('columnClustered');
    // A line's marker is a part of it that is there or not: a toggle, and nothing to open.
    await open(container, 'series/1');
    await open(container, 'series/0');
    expect(body('series/0')!.querySelector('[data-row="series/0/marker"]')).toBeNull();
    const marker = toggle(container, 'series/1/marker')!;
    expect(marker.checked).toBe(true);
    expect(header(container, 'series/1/marker').hasAttribute('aria-expanded')).toBe(false);
    await act(async () => { marker.click(); });
    expect(chart.getSeries()[1].getMarker().getSymbol()).toBe('none');
  });

  it('states a series\' cells first, and a category chart\'s labels on the axis', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    const north = chart.getSeries()[0];
    await open(container, 'series/0');
    const series = body('series/0')!;
    expect(input(series, 'Name').value).toBe('=Sheet1!$B$1');
    expect(input(series, 'Values').value).toBe('=Sheet1!$B$2:$B$5');
    expect(Array.from(series.querySelectorAll('label')).map(each => each.textContent?.trim())).not.toContain('X values');

    await commit(input(series, 'Values'), '=Sheet1!$C$2:$C$5');
    expect(north.getValuesFormula()).toBe('Sheet1!$C$2:$C$5');
    // A name is text, or a cell with a leading `=`.
    await commit(input(body('series/0')!, 'Name'), 'Total');
    expect(north.getName()).toBe('Total');
    expect(north.getNameFormula()).toBeNull();

    await open(container, 'axes/primary/category');
    const labelsField = input(body('axes/primary/category')!, 'Categories');
    expect(labelsField.value).toBe('=Sheet1!$A$2:$A$5');
    await commit(labelsField, '=Sheet1!$A$2:$A$4');
    expect(chart.getSeries().map(each => each.getCategoriesFormula())).toEqual(['Sheet1!$A$2:$A$4', 'Sheet1!$A$2:$A$4']);
  });

  it('adds a series from the section\'s heading, opens its row, and removes one from its header', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    const add = container.querySelector('button[aria-label="Add series"]') as HTMLButtonElement;
    await act(async () => { add.click(); });
    expect(chart.getSeries().length).toBe(3);
    const added = chart.getSeries()[2];
    expect(header(container, added.getPath()).getAttribute('aria-expanded')).toBe('true');
    await commit(input(body(added.getPath())!, 'Values'), '=Sheet1!$C$2:$C$5');
    expect(added.getValuesFormula()).toBe('Sheet1!$C$2:$C$5');

    const remove = row(container, 'series/0').firstElementChild!.querySelector('button[aria-label^="Remove"]') as HTMLButtonElement;
    await act(async () => { remove.click(); });
    expect(chart.getSeries().length).toBe(2);
    expect(labels(container, 'section/series')[0]).toBe('South');
  });

  it('moves a series to another place by a drag, or with Alt and an arrow', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    const names = (): (string | null)[] => chart.getSeries().map(each => each.getName());
    expect(names()).toEqual(['North', 'South']);
    await act(async () => {
      header(container, 'series/0').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true, cancelable: true }));
    });
    expect(names()).toEqual(['South', 'North']);
    expect(labels(container, 'section/series')).toEqual(['South', 'North']);

    // North (now second) dragged onto South's row takes South's place.
    const dragged = row(container, 'series/0').firstElementChild as HTMLElement;
    const target = row(container, 'series/1').firstElementChild as HTMLElement;
    await act(async () => { dragged.dispatchEvent(dragEvent('dragstart')); });
    await act(async () => { target.dispatchEvent(dragEvent('dragover')); });
    await act(async () => { target.dispatchEvent(dragEvent('drop')); });
    expect(names()).toEqual(['North', 'South']);
  });

  /** The dropdown of the field labeled `label`, inside `within`. */
  const dropdown = (within: HTMLElement, label: string): HTMLElement => {
    const control = Array.from(within.querySelectorAll('.MuiFormControl-root'))
      .find(each => each.querySelector('label')?.textContent?.trim() === label);
    expect(control, `dropdown '${label}'`).toBeTruthy();
    return control!.querySelector('[role="combobox"]') as HTMLElement;
  };

  it('starts with the chart as a whole: its name, its block of cells, which way it is read, and its type', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    expect(input(source(container), 'Name').value).toBe(chart.getName());
    expect(input(source(container), 'Data range').value).toBe('=Sheet1!$A$1:$C$5');
    expect(source(container).querySelector('[data-series-by]')!.getAttribute('data-series-by')).toBe('columns');
    expect(source(container).querySelector('[data-chart-type]')!.getAttribute('data-chart-type')).toBe('columnClustered');

    await commit(input(source(container), 'Name'), 'Sales by quarter');
    expect(chart.getName()).toBe('Sales by quarter');

    // The same cells read the other way, from the button beside them.
    const swap = source(container).querySelector('button[aria-label="Switch Row/Column"]') as HTMLButtonElement;
    // Beside the range, not among the presets.
    expect(swap.closest('[role="toolbar"]')).toBeNull();
    expect(swap.disabled).toBe(false);
    await act(async () => { swap.click(); });
    expect(chart.getSeriesBy()).toBe('rows');
    expect(chart.getSeries().length).toBe(4);
    expect(source(container).querySelector('[data-series-by]')!.getAttribute('data-series-by')).toBe('rows');
    expect(input(source(container), 'Data range').value).toBe('=Sheet1!$A$1:$C$5');

    await commit(input(source(container), 'Data range'), '=Sheet1!$A$1:$B$5');
    expect(chart.getSeries().map(each => each.getValuesFormula())).toEqual(['Sheet1!$B$2:$B$5']);
    expect(labels(container, 'section/series')).toEqual(['North']);

    await act(async () => { chart.setChartType('line'); });
    expect(source(container).querySelector('[data-chart-type]')!.getAttribute('data-chart-type')).toBe('line');
  });

  it('offers the chart\'s preset styles beside its type, on a button that shows the one it is in', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    const button = (): HTMLElement => source(container).querySelector('[data-chart-style-button]') as HTMLElement;
    expect(button().getAttribute('data-chart-style-button')).toBe('2');
    // In the chart's toolbar: its type, its style, then its colors.
    const toolbar = button().closest('[role="toolbar"]')!;
    const members = Array.from(toolbar.querySelectorAll('[data-chart-type], [data-chart-style-button], [data-chart-colors-button]'));
    expect(members.map(each => ['data-chart-type', 'data-chart-style-button', 'data-chart-colors-button'].find(name => each.hasAttribute(name))))
      .toEqual(['data-chart-type', 'data-chart-style-button', 'data-chart-colors-button']);
    const colors = (): string | null => source(container).querySelector('[data-chart-colors-button]')!.getAttribute('data-chart-colors-button');
    expect(colors()).toBe('10');
    await act(async () => { chart.setColorScheme(14); });
    expect(colors()).toBe('14');
    // A style clears the colors the series state, so they are in no set.
    await act(async () => { chart.setChartStyle(5); });
    expect(button().getAttribute('data-chart-style-button')).toBe('5');
    expect(colors()).toBe('');
  });

  it('says the type is combo and the data custom once the series no longer agree', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);

    await act(async () => { chart.getSeries()[1].setChartType('line'); });
    expect(source(container).querySelector('[data-chart-type]')!.getAttribute('data-chart-type')).toBe('combo');
    await act(async () => { chart.setChartType('barClustered'); });
    expect(source(container).querySelector('[data-chart-type]')!.getAttribute('data-chart-type')).toBe('barClustered');

    await act(async () => { chart.getSeries()[0].setValues('Sheet1!$C$2:$C$5'); });
    expect(chart.getDataRange()).toBeNull();
    expect(input(source(container), 'Data range').value).toBe('');
    expect(input(source(container), 'Data range').getAttribute('placeholder')).toBe('Customized by series');
    // With no block there is no other way to read it: the button stays, and does nothing.
    expect((source(container).querySelector('button[aria-label="Switch Row/Column"]') as HTMLButtonElement).disabled).toBe(true);
    expect(source(container).querySelector('[data-series-by]')).toBeNull();
    await commit(input(source(container), 'Data range'), '=Sheet1!$A$1:$C$5');
    expect(chart.getDataRange()).not.toBeNull();
    expect(input(source(container), 'Data range').value).toBe('=Sheet1!$A$1:$C$5');
  });

  it('lists the points formatted on their own under their series, and hands one back from its row', async () => {
    const { workbook, sheet, chart } = await newChart();
    const south = chart.getSeries()[1];
    south.getPoints().getAt(1)!.getStyle().setFill('#C00000');
    const container = await mount(workbook, sheet, chart);
    await open(container, 'series/1');
    await open(container, 'series/0');
    // As long as the points that state something, not as the series.
    expect(labels(container, 'series/1/points')).toEqual(['Point 2: 6']);
    expect(labels(container, 'series/0/points')).toEqual([]);
    expect(row(container, 'series/1/points/1').getAttribute('data-row-kind')).toBe('item');
    // Its label is a part of it that is there or not: a toggle inside its row.
    await open(container, 'series/1/points/1');
    const label = toggle(container, 'series/1/points/1/dataLabel')!;
    expect(label.checked).toBe(false);
    await act(async () => { label.click(); });
    expect(south.getPoints().getAt(1)!.getHasDataLabel()).toBe(true);
    // A column has no marker to show.
    expect(body('series/1/points/1')!.querySelector('[data-row$="/marker"]')).toBeNull();

    // The list is outlined with its heading, and closes as a row does once it has something in it.
    const list = (id: string): HTMLElement => Array.from(container.querySelectorAll('[data-list]')).find(each => each.getAttribute('data-list') === id) as HTMLElement;
    const heading = (id: string): HTMLButtonElement => list(id).firstElementChild!.querySelector('button') as HTMLButtonElement;
    expect(heading('series/1/points').getAttribute('aria-expanded')).toBe('true');
    expect(heading('series/0/points').hasAttribute('aria-expanded')).toBe(false);
    await act(async () => { heading('series/1/points').click(); });
    expect(labels(container, 'series/1/points')).toEqual([]);
    await act(async () => { heading('series/1/points').click(); });
    expect(labels(container, 'series/1/points')).toEqual(['Point 2: 6']);

    const remove = row(container, 'series/1/points/1').firstElementChild!.querySelector('button[aria-label^="Remove"]') as HTMLButtonElement;
    await act(async () => { remove.click(); });
    expect(south.getPoints().getAt(1)!.isOverridden()).toBe(false);
    expect(south.getPoints().getAt(1)!.getHasDataLabel()).toBe(false);
  });

  it('lists a point once it states something, not when it is selected', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    const selection = sheet.getView().getChartElementSelection();
    const north = chart.getSeries()[0];
    const point = north.getPoints().getAt(2)!;
    await act(async () => { selection.select([point]); });
    // The row it is part of opens; it has none of its own yet.
    expect(header(container, 'series/0').getAttribute('aria-expanded')).toBe('true');
    expect(labels(container, 'series/0/points')).toEqual([]);
    await act(async () => { point.setInvertIfNegative(true); });
    expect(labels(container, 'series/0/points')).toEqual(['Point 3: 9']);
    expect(row(container, 'series/0/points/2').getAttribute('data-row-kind')).toBe('item');
  });

  it('adds a point from the list\'s heading: the first that states nothing, listed, selected and open', async () => {
    const { workbook, sheet, chart } = await newChart();
    const north = chart.getSeries()[0];
    north.getPoints().getAt(0)!.getStyle().setFill('#C00000');
    const container = await mount(workbook, sheet, chart);
    const selection = sheet.getView().getChartElementSelection();
    await open(container, 'series/0');
    const add = body('series/0')!.querySelector('button[aria-label="Add a custom point"]') as HTMLButtonElement;
    await act(async () => { add.click(); });
    expect(north.getPoints().getAt(1)!.isOverridden()).toBe(true);
    expect(selection.getActive()).toBe(north.getPoints().getAt(1));
    expect(labels(container, 'series/0/points')).toEqual(['Point 1: 10', 'Point 2: 12']);
    expect(header(container, 'series/0/points/1').getAttribute('aria-expanded')).toBe('true');
  });

  it('says a chart has no axes, where it has none', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    const axes = (): HTMLElement => container.querySelector('[data-list="section/axes"]') as HTMLElement;
    expect(axes().querySelector('[data-empty]')).toBeNull();
    await act(async () => { chart.setChartType('pie'); });
    expect(labels(container, 'section/axes')).toEqual([]);
    expect(axes().querySelector('[data-empty]')!.textContent).toBe('No axes');
  });

  it('follows the chart\'s selection both ways', async () => {
    const { workbook, sheet, chart } = await newChart();
    const container = await mount(workbook, sheet, chart);
    const selection = sheet.getView().getChartElementSelection();
    // Pressing a row selects its element, as opening one does.
    await open(container, 'legend');
    expect(selection.getActive()).toBe(chart.getLegend());
    await open(container, 'title');
    expect(selection.getActive()).toBe(chart.getTitle());
    // An element selected in the chart opens its row and the rows it is inside.
    const labelsOfSouth = chart.getSeries()[1].getDataLabels();
    await act(async () => { labelsOfSouth.setVisible(true); });
    await act(async () => { selection.select([labelsOfSouth]); });
    expect(header(container, 'series/1').getAttribute('aria-expanded')).toBe('true');
    expect(row(container, 'series/1/dataLabels')).toBeTruthy();
    // The row opened before stays open.
    expect(header(container, 'title').getAttribute('aria-expanded')).toBe('true');
  });
});
