import { memo, useEffect, useReducer, useState } from 'react';

import { type IChart } from '@sheetxl/sdk';

import { IconButton } from '@mui/material';
import { Tooltip } from '@mui/material';

import { DynamicIcon, useCommands, useTranslator } from '@sheetxl/utils-react';

import { TaskPaneKey, type MovablePaneArgs, type MovablePaneProps } from '@sheetxl/react';

import { FormatEditor } from '../format';

import { registerChartElementFormats, resolveChartFormat } from './format/ChartElementFormat';

/* The activations already answered. The pane's body is made anew for another chart while the host
   still holds the last activation's arguments, which must not be answered twice. */
const answered = new WeakSet<MovablePaneArgs>();

/**
 * The body of the format pane for a chart: the format editor on whichever element is selected in
 * the chart, or on the chart area when none is.
 *
 * @remarks
 * What the chart has, and what each part reads, is the Chart Details pane's; this formats one
 * element at a time. An element is chosen by pressing it in the chart or by the format button on its
 * row in Chart Details. Each type of element says which tabs it has
 * (`registerChartElementFormat`); a part with none of its own opens what it is part of on its tab,
 * so a point's label is its point's Label. A call that opens the pane may name the tab too
 * (`MovablePaneArgs.tab`): an axis's Labels row asks for the axis's Labels.
 *
 * The button beside the element's name goes the other way: it shows Chart Details, on the row of
 * the element being formatted. A host without that pane has no button.
 */
export const ChartFormatPanel = memo((props: MovablePaneProps) => {
  const { movable, sheet, args } = props;
  const t = useTranslator();
  const chart = movable.getContent<IChart>();
  registerChartElementFormats();

  // Live apply: what the pane shows follows what it just wrote, and any other write to the chart.
  const [, refresh] = useReducer((s: number) => s + 1, 0);
  useEffect(() => chart.addListeners({ onAnyChange: refresh }), [chart]);

  const selection = sheet.getView().getChartElementSelection();
  useEffect(() => selection.addListeners({ onChange: refresh }), [selection]);
  const active = selection.getChart() === chart ? selection.getActive() : null;

  const { target, tab } = resolveChartFormat(chart, active, t);
  // The tab a part is shown on is asked for once, when the part is selected; a tab the opening call
  // names is asked for once too, and after it, so it is the one shown where both ask.
  const [request, setRequest] = useState<{ tab: string } | null>(null);
  useEffect(() => {
    if (tab) setRequest({ tab });
  }, [active, tab]);
  useEffect(() => {
    if (!args?.tab || answered.has(args)) return;
    answered.add(args);
    setRequest({ tab: args.tab });
  }, [args]);

  // Chart Details follows the chart's selection too, so it opens on the row of what is formatted here.
  const [detailsCommand] = useCommands([TaskPaneKey.ChartDetails]);
  const detailsLabel = detailsCommand?.getLabel();
  const detailsIcon = detailsCommand?.getIcon();
  const details = detailsCommand ? (
    <Tooltip title={detailsLabel}>
      <span>
        <IconButton
          size="small"
          data-chart-details
          aria-label={detailsLabel}
          disabled={detailsCommand.disabled()}
          onClick={() => { void detailsCommand.execute(); }}
          sx={{ borderRadius: 1 }}
        >
          {typeof detailsIcon === 'string' ? <DynamicIcon iconKey={detailsIcon} size={18} ariaHidden/> : detailsIcon}
        </IconButton>
      </span>
    </Tooltip>
  ) : null;

  return <FormatEditor target={target} sheet={sheet} request={request} actions={details}/>;
});

ChartFormatPanel.displayName = 'ChartFormatPanel';
