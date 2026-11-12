import { registerMovablePane } from '@sheetxl/react';

/**
 * The studio's additions to charts: widgets react has no MUI for, added through the chart kind's
 * contribution points as any host's would be.
 */
export const ChartPlugin = (): (() => void) => {
  // The format pane's body for a chart: one chart element at a time, chosen as Excel's Chart Elements list offers them.
  return registerMovablePane('chart', () => import('./ChartFormatPanel').then((m) => m.ChartFormatPanel));
};
