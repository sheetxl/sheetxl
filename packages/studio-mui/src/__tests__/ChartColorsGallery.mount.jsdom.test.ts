import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type IChart } from '@sheetxl/sdk';

import { ChartColorsGallery } from '../chart/command/ChartColorsCommandButton';

/**
 * The gallery of color sets (Excel's Change Colors), mounted on a real chart: the colorful sets and
 * the sets of one color, each drawn in the chart's theme, with the set the chart is in marked.
 */
describe('ChartColorsGallery (mount)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  const newChart = async (): Promise<{ workbook: Workbook, chart: IChart }> => {
    const workbook = new Workbook();
    await workbook.getCalculation().ready();
    const sheet = workbook.getWorksheets().getItems()[0];
    sheet.getRange('A1:C5').setValues([[null, 'North', 'South'], ['Q1', 10, 4], ['Q2', 12, 6], ['Q3', 9, 8], ['Q4', 14, 7]]);
    const chart = await sheet.getCharts().add('A1:C5', { type: 'columnClustered' });
    return { workbook, chart };
  };

  const mount = async (chart: IChart, onSelectScheme: (scheme: number) => void): Promise<HTMLDivElement> => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(ChartColorsGallery, { chart, onSelectScheme })); });
    return container;
  };

  const sets = (container: HTMLElement): HTMLElement[] => Array.from(container.querySelectorAll('[data-chart-colors]'));
  const squares = (set: HTMLElement): (string | null)[] => Array.from(set.querySelectorAll('svg rect')).map(rect => rect.getAttribute('fill'));
  const marked = (container: HTMLElement): (string | null)[] =>
    sets(container).filter(each => each.classList.contains('Mui-selected')).map(each => each.getAttribute('data-chart-colors'));

  it('lists the colorful sets, then the sets of one color, by Excel\'s names', async () => {
    const { workbook, chart } = await newChart();
    const container = await mount(chart, () => {});
    expect(sets(container).map(each => each.getAttribute('data-chart-colors'))).toEqual(Array.from({ length: 17 }, (_, index) => String(10 + index)));
    expect(sets(container).map(each => each.getAttribute('aria-label'))).toEqual([
      ...[1, 2, 3, 4].map(index => `Colorful Palette ${index}`),
      ...Array.from({ length: 13 }, (_, index) => `Monochromatic Palette ${index + 1}`)
    ]);
    expect(Array.from(container.querySelectorAll('[role="listbox"]')).map(each => each.getAttribute('aria-label'))).toEqual(['Colorful', 'Monochromatic']);
    workbook.close();
  });

  it('draws each set as six of its colors, in the chart\'s theme', async () => {
    const { workbook, chart } = await newChart();
    const container = await mount(chart, () => {});
    const first = squares(sets(container)[0]);
    expect(first).toEqual(chart.getColorSchemePreview(10, 6).map(color => color.toCSS()));
    expect(new Set(first).size).toBe(6);
    // Colors that are different things are chips; shades of one color are a ramp.
    expect(sets(container).map(each => each.querySelector('svg')!.getAttribute('data-variant')))
      .toEqual([...Array(4).fill('chips'), ...Array(13).fill('ramp')]);
    // One color dark to light is the same squares as light to dark, the other way round.
    expect(squares(sets(container)[11])).toEqual([...squares(sets(container)[4])].reverse());
    workbook.close();
  });

  it('marks the set the chart is in, and hands back the one pressed', async () => {
    const { workbook, chart } = await newChart();
    const pressed: number[] = [];
    const container = await mount(chart, scheme => { pressed.push(scheme); });
    expect(marked(container)).toEqual(['10']);
    await act(async () => { sets(container)[5].click(); });
    expect(pressed).toEqual([15]);
    // Pressing is the caller's to act on: the chart is as it was.
    expect(chart.getColorScheme()).toBe(10);
    workbook.close();
  });

  it('marks none where the series are in colors of their own', async () => {
    const { workbook, chart } = await newChart();
    chart.getSeries()[0].getStyle().setFill({ type: 'solid', color: '#FF0000' } as never);
    const container = await mount(chart, () => {});
    expect(marked(container)).toEqual([]);
    workbook.close();
  });
});
