import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type IChart } from '@sheetxl/sdk';

import { ChartStyleGallery } from '../chart/command/ChartStyleCommandButton';

/**
 * The gallery of preset chart styles, mounted on a real chart: every style the chart's file can
 * name, drawn as the chart's theme draws it, with the chart's own marked.
 */
describe('ChartStyleGallery (mount)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  const newChart = async (): Promise<{ workbook: Workbook, chart: IChart }> => {
    const workbook = new Workbook();
    await workbook.getCalculation().ready();
    const sheet = workbook.getWorksheets().getItems()[0];
    sheet.getRange('A1:C3').setValues([[null, 'North', 'South'], ['Q1', 10, 4], ['Q2', 12, 6]]);
    const chart = await sheet.getCharts().add('A1:C3', { type: 'columnClustered' });
    return { workbook, chart };
  };

  const mount = async (chart: IChart, onSelectStyle: (style: number) => void, selectedStyle?: number): Promise<HTMLDivElement> => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(ChartStyleGallery, { chart, onSelectStyle, selectedStyle })); });
    return container;
  };

  const styles = (container: HTMLElement): HTMLElement[] => Array.from(container.querySelectorAll('[data-chart-style]'));

  /** The colors of a swatch's three bars. */
  const bars = (swatch: HTMLElement): (string | null)[] =>
    Array.from(swatch.querySelectorAll('svg rect')).filter(rect => rect.getAttribute('width') === '6').map(rect => rect.getAttribute('fill'));

  it('offers the 48 styles by name, and hands back the one pressed', async () => {
    const { workbook, chart } = await newChart();
    const pressed: number[] = [];
    const container = await mount(chart, style => { pressed.push(style); });
    expect(styles(container).map(each => each.getAttribute('data-chart-style'))).toEqual(Array.from({ length: 48 }, (_, index) => String(index + 1)));
    expect(styles(container)[4].getAttribute('aria-label')).toBe('Style 5');
    await act(async () => { styles(container)[4].click(); });
    expect(pressed).toEqual([5]);
    // Pressing is the caller's to act on: the chart is as it was.
    expect(chart.getChartStyle()).toBe(2);
    workbook.close();
  });

  it('draws each style in its own colors: the grays, the theme\'s colors, then one accent each', async () => {
    const { workbook, chart } = await newChart();
    const container = await mount(chart, () => {});
    const swatches = styles(container).map(bars);
    expect(swatches[0]).toHaveLength(3);
    expect(swatches[0]).not.toEqual(swatches[1]);
    expect(swatches[1]).toEqual(chart.getChartStylePreview(2).seriesColors.map(color => color.toCSS()));
    // Three bars of one accent are three shades of it.
    expect(new Set(swatches[2]).size).toBe(3);
    // The fifth row fills the plot area; the first does not.
    const plotFill = (swatch: HTMLElement): boolean => Array.from(swatch.querySelectorAll('svg rect')).some(rect => rect.getAttribute('width') === '26' && rect.getAttribute('height') === '15');
    expect(plotFill(styles(container)[1])).toBe(false);
    expect(plotFill(styles(container)[33])).toBe(true);
    workbook.close();
  });

  it('marks the style it is told is the chart\'s', async () => {
    const { workbook, chart } = await newChart();
    const container = await mount(chart, () => {}, 7);
    const marked = styles(container).filter(each => each.classList.contains('Mui-selected')).map(each => each.getAttribute('data-chart-style'));
    expect(marked).toEqual(['7']);
    workbook.close();
  });
});
