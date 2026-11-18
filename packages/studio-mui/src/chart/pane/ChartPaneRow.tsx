import type React from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { ButtonBase } from '@mui/material';
import { Collapse } from '@mui/material';
import { IconButton } from '@mui/material';
import { ListItemIcon } from '@mui/material';
import { MenuItem } from '@mui/material';
import { Select } from '@mui/material';
import { Switch } from '@mui/material';
import { Typography } from '@mui/material';

import { type IChart, type IWorksheet } from '@sheetxl/sdk';

import { DynamicIcon } from '@sheetxl/utils-react';

import { chartIconKey } from '@sheetxl/react';

import { FormatFields, panelSx, type RunEdit } from '../../format';

import { type ChartPaneList, type ChartPaneNode, isChartPaneList, type Translate } from './ChartPaneModel';

/** What every row of the pane is drawn with. */
export interface ChartPaneContext {
  sheet: IWorksheet;
  t: Translate;
  disabled: boolean;
  run: RunEdit;
  /** The ids of the rows that are open. */
  open: ReadonlySet<string>;
  /** Opens or closes a row, as its header was pressed; a row with nothing inside it is selected instead. */
  onToggleOpen: (node: ChartPaneNode) => void;
  /** Opens or closes a list inside a row, as its heading was pressed. */
  onToggleList: (list: ChartPaneList) => void;
  /** Selects a row's element and brings up the format editor on it. */
  onFormat: (node: ChartPaneNode) => void;
  /** The id of the row whose body is the innermost pointed at, or else focused; `null` for none. */
  lit: string | null;
  /** The element selected in the chart, whose row is marked. */
  active: IChart.IElement | null;
  /** Hands the pane a row's header, to scroll to. */
  registerRow: (id: string, header: HTMLElement | null) => void;
  /** Adds an item to a list, as its heading's button was pressed. */
  onAdd: (list: ChartPaneList) => void;
  /** The row being dragged to another place in its list, and the list it is of. */
  drag: { current: { node: ChartPaneNode, listId: string } | null };
  /** The id of the row a dragged row would be dropped on. */
  dropTarget: string | null;
  setDropTarget: (id: string | null) => void;
}

/** The picker on a series' header: how the series is drawn, shown as its icon. */
const TypePicker = (props: { type: NonNullable<ChartPaneNode['type']>, label: string, disabled: boolean, run: RunEdit }): React.ReactElement => {
  const { type, label, disabled, run } = props;
  const options = type.options();
  const icon = (type: string): React.ReactNode => <DynamicIcon iconKey={chartIconKey(type)} size={16}/>;
  return (
    <Select
      variant="standard"
      disableUnderline
      size="small"
      disabled={disabled}
      value={type.get()}
      onChange={event => { const next = event.target.value; run(() => type.set(next)); }}
      SelectDisplayProps={{ 'aria-label': label }}
      renderValue={(value) => (
        <span title={options.find(each => each.type === value)?.label ?? value} style={{ display: 'inline-flex' }}>{icon(value)}</span>
      )}
      sx={{ flex: 'none', maxWidth: 96, marginInline: 0.5, '& .MuiSelect-select': { display: 'flex', alignItems: 'center', paddingBlock: 0.25 } }}
    >
      {options.map(option => (
        <MenuItem key={option.type} value={option.type}>
          <ListItemIcon>{icon(option.type)}</ListItemIcon>
          {option.label}
        </MenuItem>
      ))}
    </Select>
  );
};

/**
 * The width a row's toggle takes at the right edge, so the toggles line up down the pane. A row
 * without one keeps no room for it: its remove button sits at the edge, under its list's add.
 */
const TOGGLE_SLOT = 44;

/** The space after a row's last control, in px. */
const ROW_END = 6;
/** How far a section's rows are set in from its outline, and a nested list's from its own, in px. */
const SECTION_INSET = 8;
const NESTED_INSET = 8;

/** Where an open row's bracket drops from, from the row's leading edge: the middle of its chevron. */
const BRACKET_INSET = 12;
/** The turn of the bracket under the body, in px. */
const BRACKET_RADIUS = '4px';

/**
 * One row: a header that opens it, then, at the right edge, its format button, its remove button
 * and its toggle; and under the header, once open, its fields and the rows inside it.
 *
 * @remarks
 * The header opens a row whatever its toggle says: a hidden element can still be set up. The body
 * is not built until the row first opens. A row with nothing inside it has no chevron, and pressing
 * it selects its element. The format and remove buttons show while the row is pointed at or holds
 * the focus, and always where there is no pointer to hover with; a list's add button is always
 * drawn. A series' type picker follows its name.
 *
 * A press is not rippled: the button is the row's label, not the whole row, so a ripple would stop
 * short of the row's controls. The keyboard's focus is shown by an outline.
 *
 * Every row is outlined, so that each reads as a control whether or not it opens. A row of a
 * section is a `card` besides: a surface of its own on the section's ground. What is inside an open
 * row is bracketed by a rule that drops from its chevron and turns under the body, which says whose
 * it is. The bracket of the body pointed at, or holding the focus, is drawn in the primary color
 * with the chevron it drops from, and no bracket around it is. The row of the element selected in
 * the chart is outlined in that color, its chevron with it; its header is not filled.
 */
export const ChartPaneRow = (props: { node: ChartPaneNode, context: ChartPaneContext, listId?: string, count?: number, card?: boolean }): React.ReactElement => {
  const { node, context, listId = '', count = 0, card = false } = props;
  const { t, disabled, run, open, active, drag } = context;
  // A row with a place in its list is dragged to another row's place, or moved with Alt and an arrow.
  const order = disabled ? undefined : node.order;
  const dropsHere = (): boolean => {
    const dragged = drag.current;
    return !!order && !!dragged && dragged.listId === listId && dragged.node.id !== node.id && !!dragged.node.order;
  };
  const swatch = node.swatch?.();
  const isOpen = !node.leaf && open.has(node.id);
  const isActive = active !== null && active === node.element;
  // This row's body is the innermost pointed at or focused: its bracket and its chevron say so together.
  const isLit = context.lit === node.id;
  const shown = node.toggle ? node.toggle.get() : true;
  const bodyId = `chart-pane-body:${node.id}`;
  return (
    <Box
      data-row={node.id}
      data-row-kind={node.kind}
      data-row-active={isActive ? '' : undefined}
      sx={{
        minWidth: 0,
        border: 1,
        borderColor: isActive ? 'primary.main' : 'divider',
        borderRadius: 1,
        ...(card ? { backgroundColor: 'background.paper' } : null)
      }}
    >
      <Box
        ref={(header: HTMLElement | null) => context.registerRow(node.id, header)}
        draggable={order ? true : undefined}
        onDragStart={order ? (event: React.DragEvent) => {
          drag.current = { node, listId };
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', node.label);
        } : undefined}
        onDragEnd={order ? () => { drag.current = null; context.setDropTarget(null); } : undefined}
        onDragOver={order ? (event: React.DragEvent) => {
          if (!dropsHere()) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          if (context.dropTarget !== node.id) context.setDropTarget(node.id);
        } : undefined}
        onDrop={order ? (event: React.DragEvent) => {
          if (!dropsHere()) return;
          event.preventDefault();
          const dragged = drag.current!.node;
          drag.current = null;
          context.setDropTarget(null);
          run(() => dragged.order!.set(order.get()));
        } : undefined}
        sx={{
          display: 'flex',
          alignItems: 'center',
          minHeight: 36,
          borderRadius: 1,
          paddingInlineEnd: `${ROW_END}px`,
          '& .chart-pane-hover': { opacity: 0 },
          '&:hover .chart-pane-hover, &:focus-within .chart-pane-hover': { opacity: 1 },
          '@media (hover: none)': { '& .chart-pane-hover': { opacity: 1 } },
          boxShadow: (theme: Theme) => context.dropTarget === node.id ? `inset 0 2px 0 ${theme.palette.primary.main}` : 'none'
        }}
      >
        <ButtonBase
          disableRipple
          focusVisibleClassName="chart-pane-focus"
          aria-expanded={node.leaf ? undefined : isOpen}
          aria-controls={node.leaf ? undefined : bodyId}
          onClick={() => context.onToggleOpen(node)}
          onKeyDown={order ? (event: React.KeyboardEvent) => {
            if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
            event.preventDefault();
            const next = order.get() + (event.key === 'ArrowUp' ? -1 : 1);
            if (next >= 0 && next < count) run(() => order.set(next));
          } : undefined}
          sx={{ flex: node.type ? '0 1 auto' : '1 1 auto', minWidth: 0, minHeight: 36, justifyContent: 'flex-start', gap: 0.5, px: 0.5, borderRadius: 1, textAlign: 'start', '&.chart-pane-focus': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' } }}
        >
          {node.leaf ? <Box component="span" sx={{ flex: 'none', width: 18 }}/> : (
            <Box component="span" data-chevron-lit={isLit ? '' : undefined} sx={{ display: 'inline-flex', transition: 'transform 120ms, color 120ms', transform: isOpen ? 'none' : 'rotate(-90deg)', color: isActive || isLit ? 'primary.main' : 'inherit' }}>
              <DynamicIcon iconKey="ExpandMore" size={18} ariaHidden/>
            </Box>
          )}
          {node.swatch ? (
            <Box
              component="span"
              data-swatch={swatch ?? ''}
              sx={{ flex: 'none', width: 12, height: 12, borderRadius: 0.5, border: '1px solid', borderColor: 'divider', backgroundColor: swatch ?? 'transparent' }}
            />
          ) : null}
          <Typography variant="body2" component="span" noWrap sx={{ color: shown ? 'text.primary' : 'text.secondary' }}>
            {node.label}
          </Typography>
        </ButtonBase>
        {node.type ? (
          <>
            <TypePicker type={node.type} label={t('chart.pane.seriesType', { name: node.name })} disabled={disabled} run={run}/>
            {/* The rest of the header opens the row, as the label does. */}
            <Box aria-hidden onClick={() => context.onToggleOpen(node)} sx={{ flex: '1 1 auto', alignSelf: 'stretch', minWidth: 0, cursor: 'pointer' }}/>
          </>
        ) : null}
        {node.element ? (
          <IconButton className="chart-pane-hover" size="small" aria-label={t('chart.pane.format', { name: node.name })} onClick={() => context.onFormat(node)}>
            <DynamicIcon iconKey="Format" size={18} ariaHidden/>
          </IconButton>
        ) : null}
        {node.remove ? (
          <IconButton className="chart-pane-hover" size="small" disabled={disabled} aria-label={t('chart.pane.remove', { name: node.name })} onClick={() => run(node.remove!)}>
            <DynamicIcon iconKey="Delete" size={18} ariaHidden/>
          </IconButton>
        ) : null}
        {node.toggle ? (
          <Box sx={{ flex: 'none', width: TOGGLE_SLOT, display: 'flex', justifyContent: 'flex-end' }}>
            <Switch
              size="small"
              disabled={disabled}
              checked={shown}
              onChange={event => { const next = event.target.checked; run(() => node.toggle!.set(next)); }}
              slotProps={{ input: { 'aria-label': t('chart.pane.show', { name: node.name }) } }}
            />
          </Box>
        ) : null}
      </Box>
      {node.leaf ? null : (
        <Collapse in={isOpen} mountOnEnter unmountOnExit>
          <Box
            id={bodyId}
            data-row-body={node.id}
            sx={{
              ...panelSx,
              gap: 1,
              // Under the middle of the chevron: the header's padding and half the icon.
              marginInlineStart: `${BRACKET_INSET}px`,
              marginInlineEnd: 1,
              marginBottom: 1,
              paddingInlineStart: 1.5,
              paddingTop: 1,
              paddingBottom: 1,
              borderInlineStart: '1px solid',
              borderBottom: '1px solid',
              borderEndStartRadius: BRACKET_RADIUS,
              borderColor: isLit ? 'primary.main' : 'divider',
              transition: 'border-color 120ms'
            }}
          >
            <FormatFields fields={node.fields()} sheet={context.sheet} disabled={disabled} run={run}/>
            {node.children().map(child => isChartPaneList(child)
              ? <ChartPaneRows key={child.id} list={child} context={context} nested/>
              : <ChartPaneRow key={child.id} node={child} context={context}/>
            )}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

/**
 * A list inside a row (a series' own points, its trendlines): outlined as a row is, its heading and
 * its add button inside the outline. With nothing in it, it is its heading alone; with something,
 * it has a chevron and closes as a row does. It is open until it is closed.
 */
const ChartPaneNestedRows = (props: { list: ChartPaneList, context: ChartPaneContext }): React.ReactElement => {
  const { list, context } = props;
  const { disabled } = context;
  const items = list.items();
  const isOpen = items.length > 0 && !context.open.has(closedListId(list.id));
  return (
    <Box
      data-list={list.id}
      sx={{
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        paddingBottom: isOpen ? 1 : 0,
        '& > [data-row]': { marginInline: `${NESTED_INSET}px` }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 36, paddingInlineEnd: `${ROW_END + NESTED_INSET + 1}px` }}>
        <ButtonBase
          disableRipple
          focusVisibleClassName="chart-pane-focus"
          disabled={items.length === 0}
          aria-expanded={items.length > 0 ? isOpen : undefined}
          onClick={() => context.onToggleList(list)}
          sx={{ flex: '1 1 auto', minWidth: 0, minHeight: 36, justifyContent: 'flex-start', gap: 0.5, px: 0.5, borderRadius: 1, textAlign: 'start', '&.chart-pane-focus': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' } }}
        >
          {items.length === 0 ? <Box component="span" sx={{ flex: 'none', width: 18 }}/> : (
            <Box component="span" sx={{ display: 'inline-flex', transition: 'transform 120ms', transform: isOpen ? 'none' : 'rotate(-90deg)' }}>
              <DynamicIcon iconKey="ExpandMore" size={18} ariaHidden/>
            </Box>
          )}
          <Typography variant="body2" component="span" noWrap sx={{ color: 'text.primary' }}>{list.label}</Typography>
        </ButtonBase>
        {list.add ? (
          <IconButton size="small" disabled={disabled} aria-label={list.addLabel} onClick={() => context.onAdd(list)}>
            <DynamicIcon iconKey="Add" size={18} ariaHidden/>
          </IconButton>
        ) : null}
      </Box>
      {isOpen ? items.map(node => <ChartPaneRow key={node.id} node={node} context={context} listId={list.id} count={items.length}/>) : null}
    </Box>
  );
};

/** The id a list inside a row is held under while it is closed. */
export const closedListId = (id: string): string => `closed:${id}`;

/**
 * Rows under a heading: a section of the pane, or a list inside a row. A list that can be added to
 * has its add button on the heading. A section's rows sit on a ground of their own, each a card.
 */
export const ChartPaneRows = (props: { list: ChartPaneList, context: ChartPaneContext, nested?: boolean }): React.ReactElement => {
  const { list, context, nested } = props;
  const { disabled } = context;
  if (nested) return <ChartPaneNestedRows list={list} context={context}/>;
  const items = list.items();
  return (
    <Box sx={{ minWidth: 0 }}>
      {/* The heading starts over its rows' leading edge: past the section's outline and its inset. */}
      <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 32, paddingInlineStart: `${SECTION_INSET + 1}px`, paddingInlineEnd: `${ROW_END + SECTION_INSET + 2}px` }}>
        <Typography variant="subtitle2" component="div" sx={{ flex: '1 1 auto', minWidth: 0, color: 'text.primary' }}>
          {list.label}
        </Typography>
        {list.add ? (
          <IconButton size="small" disabled={disabled} aria-label={list.addLabel} onClick={() => context.onAdd(list)}>
            <DynamicIcon iconKey="Add" size={18} ariaHidden/>
          </IconButton>
        ) : null}
      </Box>
      <Box
        data-list={list.id}
        sx={{
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.75,
          padding: `${SECTION_INSET}px`,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          backgroundColor: 'action.hover'
        }}
      >
        {items.length === 0 && list.empty ? (
          <Typography variant="caption" component="div" data-empty sx={{ color: 'text.secondary', paddingBlock: 0.5, paddingInlineStart: 0.5 }}>{list.empty}</Typography>
        ) : null}
        {items.map(node => <ChartPaneRow key={node.id} node={node} context={context} listId={list.id} count={items.length} card/>)}
      </Box>
    </Box>
  );
};
