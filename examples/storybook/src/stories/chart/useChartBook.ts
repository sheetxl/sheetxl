import { useEffect, useState } from 'react';

import { Workbook, type IChart, type IWorksheet } from '@sheetxl/sdk';

/** Four months of three regions: what the category types chart. */
export const TABLE: (string | number | null)[][] = [
  [null, 'North', 'South', 'East'],
  ['Jan', 10, 20, 30],
  ['Feb', 14, 18, 26],
  ['Mar', 12, 25, 31],
  ['Apr', 18, 22, 28]
];
/** X with two Y series, for scatters. */
const XY: (string | number)[][] = [['X', 'Y1', 'Y2'], [1, 2, 5], [2, 4, 4], [3, 5, 6], [4, 7, 5], [5, 8, 7]];
/** X, Y and a size, for bubbles. */
const BUBBLES: (string | number)[][] = [['X', 'Y', 'Size'], [1, 2, 10], [2, 4, 20], [3, 5, 15], [4, 7, 30]];
/** Five days of a stock: its volume, open, high, low and close. */
const STOCK: (string | number)[][] = [
  ['Date', 'Volume', 'Open', 'High', 'Low', 'Close'],
  [45292, 1200, 20, 24, 19, 22], [45293, 1500, 22, 25, 21, 21], [45294, 900, 21, 23, 18, 19], [45295, 1800, 19, 26, 19, 25], [45296, 1100, 25, 27, 23, 24]
];
/** The cells a stock chart of each type is made of: its date and the series it takes, in order. */
const STOCK_SOURCES: Record<string, string> = { stockHLC: 'N1:N6,Q1:S6', stockOHLC: 'N1:N6,P1:S6', stockVHLC: 'N1:O6,Q1:S6', stockVOHLC: 'N1:S6' };

/** The cells a chart of `type` is made of. */
export const sourceOf = (type: string): string =>
  STOCK_SOURCES[type] ?? (type.startsWith('bubble') ? 'J1:L5' : type.startsWith('xyscatter') ? 'F1:H6' : 'A1:D5');

/** A workbook with the sample data in its first sheet. */
export const newBook = (): { workbook: Workbook, sheet: IWorksheet } => {
  const workbook = new Workbook();
  const sheet = workbook.getWorksheets().getItems()[0];
  sheet.setName('Data');
  sheet.getRange('A1:D5').setValues(TABLE);
  sheet.getRange('F1:H6').setValues(XY);
  sheet.getRange('J1:L5').setValues(BUBBLES);
  sheet.getRange('N1:S6').setValues(STOCK);
  sheet.getRange('N2:N6').setNumberFormat('m/d/yyyy');
  return { workbook, sheet };
};

export interface ChartBook {
  sheet: IWorksheet;
  chart: IChart;
}

/**
 * A workbook with the sample data and one chart of `type` on its first sheet, made once; `null`
 * until it is.
 */
export function useChartBook(type: IChart.Type | string, setup?: (chart: IChart) => void): ChartBook | null {
  const [book, setBook] = useState<ChartBook | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const { sheet } = newBook();
      const chart = await sheet.getCharts().add(sourceOf(type), { type });
      setup?.(chart);
      if (live) setBook({ sheet, chart });
    })();
    return () => { live = false; };
    // One workbook per story; the type is the story's starting point, changed through the chart.
  }, []);
  return book;
}
