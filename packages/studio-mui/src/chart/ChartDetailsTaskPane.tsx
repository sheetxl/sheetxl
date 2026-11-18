import type React from 'react';
import { useEffect, useReducer } from 'react';

import { type Theme } from '@mui/material';
import { Paper } from '@mui/material';

import { type IChart } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import { type TaskPaneProps, TaskPaneEmpty, useWorksheet } from '@sheetxl/react';

import { ChartDetailsPanel } from './ChartDetailsPanel';

/**
 * The **Chart Details** task pane: the details of the chart that is selected, following the
 * selection from one chart to the next. With no chart selected it says so.
 */
export const ChartDetailsTaskPane = (props: TaskPaneProps): React.ReactElement => {
  const {
    model: _model,
    entryKey: _entryKey,
    args: _args,
    frame: _frame,
    ref,
    ...rest
  } = props;

  const sheet = useWorksheet();
  const t = useTranslator();

  const [, refresh] = useReducer((s: number) => s + 1, 0);
  useEffect(() => sheet?.getView().addListeners({ onMovableSelectionChange: refresh }), [sheet]);

  const movable = sheet?.getView().getMovableSelection().getActive() ?? null;
  const content = movable?.getContent();
  const chart = content?.getType() === 'chart' ? content as IChart : null;

  return (
    <Paper
      square
      ref={ref}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'auto',
        // The padding is inside the pane's height: outside it, the pane is taller than its host and both scroll.
        boxSizing: 'border-box',
        padding: (theme: Theme) => theme.spacing(1, 2, 2)
      }}
      {...rest}
    >
      {sheet && movable && chart
        ? <ChartDetailsPanel key={chart.getId()} movable={movable} sheet={sheet}/>
        : <TaskPaneEmpty>{t('chart.details.empty')}</TaskPaneEmpty>}
    </Paper>
  );
};

export default ChartDetailsTaskPane;
