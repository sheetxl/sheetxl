import { defineLazyModule } from '@sheetxl/utils';

import { DefaultCommandButtonRegistry, type CommandButtonProps } from '@sheetxl/utils-react';
import { DefaultTaskPaneRegistry, TaskPaneKey, registerMovablePane } from '@sheetxl/react';
import { lazyPanel } from '@sheetxl/utils-mui';

import { ChangeChartTypeCommandButton, ChartColorsCommandButton, ChartStyleCommandButton } from './command';

const ChartDetailsTaskPane = lazyPanel(
  defineLazyModule('studio:chartDetailsTaskPane', () => import('./ChartDetailsTaskPane'), {
    select: (m) => ({ default: m.ChartDetailsTaskPane })
  }).load
);

/**
 * The studio's additions to charts: widgets react has no MUI for, added through the chart kind's
 * contribution points as any host's would be.
 */
export const ChartPlugin = (): (() => void) => {
  // What the chart has and what each part reads: its own pane, as a table's details are.
  const removeDetails = DefaultTaskPaneRegistry.registerTaskPane({
    key: TaskPaneKey.ChartDetails,
    component: ChartDetailsTaskPane
  }, true);

  // The format pane's body for a chart: the format editor on the element selected in the chart.
  const removeFormat = registerMovablePane('chart', () => import('./ChartFormatPanel').then((m) => m.ChartFormatPanel));

  // The chart's galleries, at the head of the chart's tab, which is react's: how the chart is drawn,
  // the style it is drawn in, then its colors. They are contributed as a table's style gallery is to its tab.
  const removeChangeType = DefaultCommandButtonRegistry.register({
    key: 'chartChangeTypeOptions',
    contributions: { chartToolbar: { order: -3 } },
    render: (props: CommandButtonProps) => <ChangeChartTypeCommandButton {...(props as any)}/>
  }, true);
  const removeStyle = DefaultCommandButtonRegistry.register({
    key: 'chartStyleOptions',
    contributions: { chartToolbar: { order: -2 } },
    render: (props: CommandButtonProps) => <ChartStyleCommandButton {...(props as any)}/>
  }, true);
  const removeColors = DefaultCommandButtonRegistry.register({
    key: 'chartColorsOptions',
    contributions: { chartToolbar: { order: -1, divider: 'after' } },
    render: (props: CommandButtonProps) => <ChartColorsCommandButton {...(props as any)}/>
  }, true);

  return (): void => {
    removeDetails();
    removeFormat();
    removeChangeType();
    removeStyle();
    removeColors();
  };
};
