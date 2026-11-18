import type React from 'react';
import { memo, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { IconButton } from '@mui/material';
import { Tooltip } from '@mui/material';
import { Typography } from '@mui/material';

import { type IChart } from '@sheetxl/sdk';

import { DynamicIcon, useCallbackRef, useCommands, useTranslator } from '@sheetxl/utils-react';

import { TaskPaneKey, chartIconKey, type ChartTypeDescriptor, type MovablePaneProps } from '@sheetxl/react';

import { FormatFields, panelSx } from '../format';

import { ChartColorsGalleryButton, ChartStyleGalleryButton, ChartTypeGalleryButton } from './command';
import { buildChartPane, buildChartSource, elementLabel, findChartPaneRow, type ChartPaneList, type ChartPaneNode } from './pane/ChartPaneModel';
import { ChartPaneRows, closedListId, type ChartPaneContext } from './pane/ChartPaneRow';

/**
 * The details of a chart: the chart as a tree of rows, how it reads its cells, its series, its axes
 * and the rest of its elements, each row saying that its element is there, what it reads and what
 * it references.
 *
 * @remarks
 * A row's controls say what kind of thing it is: a toggle shows or hides an element and loses
 * nothing; a remove button takes an item out of a list, whose heading adds one; a row with neither
 * is always there. Rows open independently, and a row opens whether or not its element is shown.
 *
 * Nothing here formats. A row's format button selects its element and brings up the format pane on
 * it, as pressing the element in the chart does; how an element looks, and the options that are its
 * own, are set there.
 *
 * A series' header is the chart's structure at a glance: its color, its name, how it is drawn and
 * its remove button. Its row is dragged to another series' place, or moved with Alt and an arrow.
 * Inside, its cells come first: its name, its values, and a scatter's x values; a category
 * chart's labels are on the axis, once. Its points are listed only where they state something of
 * their own.
 *
 * At the head, with no heading and always in view, is the chart as a whole: its name, the block of
 * cells every series is made of with a button beside it that reads the block the other way, and
 * under them a toolbar of what is done to the whole chart. The gallery of types every series is
 * drawn as, the ribbon's own; and the format of the chart area, which is the chart itself and has
 * no row. The range and the type say "custom" when the series no longer agree.
 *
 * The pane follows the chart's selection both ways: an element pressed in the chart opens the row
 * it is in, and pressing a row selects its element. Every control writes through the element's
 * setters, one step to undo each; what a chart refuses is said at the top.
 */
export const ChartDetailsPanel = memo((props: MovablePaneProps) => {
  const { movable, sheet } = props;
  const t = useTranslator();
  const chart = movable.getContent<IChart>();

  // Live apply: what the pane shows follows what it just wrote, and any other write to the chart.
  const [, refresh] = useReducer((s: number) => s + 1, 0);
  useEffect(() => chart.addListeners({ onAnyChange: refresh }), [chart]);

  const selection = sheet.getView().getChartElementSelection();
  useEffect(() => selection.addListeners({ onChange: refresh }), [selection]);
  const active = selection.getChart() === chart ? selection.getActive() : null;

  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const source = buildChartSource(chart, t);
  /** The chart area is the chart itself: with it chosen, nothing inside the chart is selected. */
  const select = useCallbackRef((element: IChart.IElement) => {
    try {
      if (element.getElementType() === 'chartArea') selection.clear();
      else selection.select([element]);
    } catch {
      // An element the chart does not draw has nothing to select.
    }
  }, [selection]);
  // The format pane follows the chart's selection, so formatting an element is selecting it and showing the pane.
  const [formatCommand] = useCommands([TaskPaneKey.Format]);
  const format = useCallbackRef((element: IChart.IElement, tab?: string) => {
    select(element);
    void formatCommand?.execute(tab);
  }, [select, formatCommand]);
  const sections = buildChartPane(chart, t, { active, select, format });

  // An element selected in the chart opens the rows around its row, and is scrolled to. An element
  // with no row of its own (a marker, a legend entry, a point that states nothing) shows the
  // nearest row it is part of.
  const rows = useRef(new Map<string, HTMLElement>());
  const scrollTo = useRef<string | null>(null);
  useEffect(() => {
    if (!active) return;
    let trail: string[] | null = null;
    for (let element: IChart.IElement | null = active; element && !trail; element = element.getParent()) {
      trail = findChartPaneRow(sections, element);
    }
    if (!trail) return;
    const found = trail;
    scrollTo.current = found[found.length - 1];
    setOpen((before) => {
      if (found.every(id => before.has(id))) return before;
      const next = new Set(before);
      for (const id of found) next.add(id);
      return next;
    });
  // Only a change of selection opens rows: a row closed by hand stays closed while it is selected.
  }, [active]);
  useLayoutEffect(() => {
    const id = scrollTo.current;
    if (id === null) return;
    const header = rows.current.get(id);
    if (!header) return;
    scrollTo.current = null;
    header.scrollIntoView?.({ block: 'nearest' });
  });

  const run = useCallbackRef((apply: () => void) => {
    try {
      apply();
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, []);

  const onToggleOpen = useCallbackRef((node: ChartPaneNode) => {
    if (node.leaf) {
      if (node.element) select(node.element);
      return;
    }
    const opening = !open.has(node.id);
    setOpen((before) => {
      const next = new Set(before);
      if (opening) next.add(node.id); else next.delete(node.id);
      return next;
    });
    if (!opening || !node.element) return;
    select(node.element);
  }, [open, select]);

  const onToggleList = useCallbackRef((list: ChartPaneList) => {
    const id = closedListId(list.id);
    setOpen((before) => {
      const next = new Set(before);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const onFormat = useCallbackRef((node: ChartPaneNode) => {
    if (node.element) format(node.element, node.tab);
  }, [format]);

  const registerRow = useCallbackRef((id: string, header: HTMLElement | null) => {
    if (header) rows.current.set(id, header);
    else rows.current.delete(id);
  }, []);

  // A new item's row opens: a series added has no data until its row says where it is.
  const onAdd = useCallbackRef((list: ChartPaneList) => {
    run(() => {
      const id = list.add?.();
      // What was added is in view: its list opens, and its row where it has one to open.
      if (typeof id === 'string') scrollTo.current = id;
      setOpen((before) => {
        const next = new Set(before);
        next.delete(closedListId(list.id));
        if (typeof id === 'string') next.add(id);
        return next;
      });
    });
  }, [run]);

  // The body pointed at, or else the one holding the focus: the innermost, not the ones around it.
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const bodyOf = (target: EventTarget | null): string | null =>
    (target as Element | null)?.closest?.('[data-row-body]')?.getAttribute('data-row-body') ?? null;

  const drag = useRef<{ node: ChartPaneNode, listId: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const context: ChartPaneContext = {
    sheet, t, disabled: chart.isReadOnly(), run, open, onToggleOpen, onToggleList, onFormat, lit: hovered ?? focused, active, registerRow, onAdd, drag, dropTarget, setDropTarget
  };

  const areaName = elementLabel(t, source.area);
  const onSelectType = useCallbackRef((descriptor: ChartTypeDescriptor) => {
    run(() => source.type.set(descriptor.type));
  }, [run, source]);
  const onSelectStyle = useCallbackRef((style: number) => {
    run(() => { chart.setChartStyle(style); });
  }, [run, chart]);
  const onSelectColors = useCallbackRef((scheme: number) => {
    run(() => { chart.setColorScheme(scheme); });
  }, [run, chart]);

  return (
    <Box
      onMouseOver={(event: React.MouseEvent) => { const id = bodyOf(event.target); if (id !== hovered) setHovered(id); }}
      onMouseLeave={() => { if (hovered !== null) setHovered(null); }}
      onFocus={(event: React.FocusEvent) => { const id = bodyOf(event.target); if (id !== focused) setFocused(id); }}
      onBlur={(event: React.FocusEvent) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null) && focused !== null) setFocused(null); }}
      sx={{ ...panelSx, gap: 1.5, paddingTop: (theme: Theme) => theme.spacing(1) }}
    >
      {error ? <Typography variant="caption" color="error" role="alert">{error}</Typography> : null}
      <Box data-section="source" sx={{ ...panelSx, gap: 0, minWidth: 0 }}>
        {/* Spaced as a table's name and range are: either may have a line under it saying what is wrong with it. */}
        <Box sx={{ ...panelSx, gap: 2.5, minWidth: 0, paddingTop: 0.5 }}>
          <FormatFields fields={source.fields.slice(0, 1)} sheet={sheet} disabled={context.disabled} run={run}/>
          {/* Reading the block the other way sits beside the block; it is to become an adornment of the field. */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
              <FormatFields fields={source.fields.slice(1)} sheet={sheet} disabled={context.disabled} run={run}/>
            </Box>
            <Tooltip title={source.seriesBy.switchLabel}>
              <span>
                <IconButton
                  size="small"
                  disabled={context.disabled || source.seriesBy.disabled}
                  data-series-by={source.seriesBy.disabled ? undefined : source.seriesBy.get()}
                  aria-label={source.seriesBy.switchLabel}
                  onClick={() => run(source.seriesBy.switch)}
                  sx={{ borderRadius: 1 }}
                >
                  <DynamicIcon iconKey="PivotAxis" size={18} ariaHidden/>
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
        {/* What is done to the chart as a whole, apart from where its data is: the presets, each
            writing every series, and the chart's own format. It stands clear of the range above it:
            it is about what is listed below. */}
        <Box
          role="toolbar"
          aria-label={t('chart.pane.chartType')}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, padding: 0.5, marginTop: 3.5, border: 1, borderColor: 'divider', borderRadius: 1 }}
        >
          <ChartTypeGalleryButton
            data-chart-type={source.type.get()}
            aria-label={t('chart.pane.chartType')}
            tip={{ label: t('chart.pane.chartType'), description: source.type.label }}
            icon={<DynamicIcon iconKey={chartIconKey(source.type.get())} size={18}/>}
            disabled={context.disabled}
            onSelectType={onSelectType}
          />
          <ChartStyleGalleryButton
            chart={chart}
            data-chart-style-button={chart.getChartStyle()}
            aria-label={t('chart.style.title')}
            tip={{ label: t('chart.style.title'), description: t('chart.style.name', { index: chart.getChartStyle() }) }}
            disabled={context.disabled}
            onSelectStyle={onSelectStyle}
          />
          <ChartColorsGalleryButton
            chart={chart}
            data-chart-colors-button={chart.getColorScheme() ?? ''}
            aria-label={t('chart.colors.title')}
            tip={{ label: t('chart.colors.title') }}
            disabled={context.disabled}
            onSelectScheme={onSelectColors}
          />
          <Box sx={{ flex: '1 1 auto' }}/>
          <Tooltip title={t('chart.pane.format', { name: areaName })}>
            <IconButton size="small" aria-label={t('chart.pane.format', { name: areaName })} onClick={() => format(source.area)} sx={{ borderRadius: 1 }}>
              <DynamicIcon iconKey="Format" size={18} ariaHidden/>
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      {sections.map(section => <ChartPaneRows key={section.id} list={section} context={context}/>)}
    </Box>
  );
});

ChartDetailsPanel.displayName = 'ChartDetailsPanel';
