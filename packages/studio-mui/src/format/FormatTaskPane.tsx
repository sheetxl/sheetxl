import type React from 'react';
import { memo, useEffect } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { Paper } from '@mui/material';
import { Tab } from '@mui/material';
import { Tabs } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { type IWorkbook, type IWorksheet, NumberFormat } from '@sheetxl/sdk';

import { useTranslator, usePersistentState } from '@sheetxl/utils-react';

import { type TaskPaneProps, useModelSync } from '@sheetxl/react';

import { useFormatSelection } from './useFormatSelection';
import { FormatCellPreview } from './FormatCellPreview';
import { NumberFormatPanel } from './NumberFormatPanel';
import { AlignmentPanel } from './AlignmentPanel';
import { FontPanel } from './FontPanel';
import { FillPanel, fillSelectionOf } from './FillPanel';
import { BorderPanel } from './BorderPanel';

/** The pane's tabs, in Excel's own order (with Fill where Excel keeps Patterns). */
export const FormatTab = {
  Number: 'number',
  Alignment: 'alignment',
  Font: 'font',
  Border: 'border',
  Fill: 'fill'
} as const;
export type FormatTab = typeof FormatTab[keyof typeof FormatTab];

/**
 * What a command may ask the format pane to open on — `activateTaskPane('formatCells', { args })`.
 */
export interface FormatPaneArgs {
  /** The tab to show. Omit to reopen on whichever tab the user was last on. */
  tab?: FormatTab;
}

/** Persistence key for {@link FormatPaneArgs.tab | the tab} an argument-less activation returns to. */
export const FORMAT_TAB_KEY = 'format.tab';

/**
 * The pane's left/right gutter, in theme spacing units.
 *
 * @remarks
 * One line the eye can trace: the preview, the tab body, and every panel control below start on it.
 * Anything wanting to sit further in adds its own padding on top rather than redefining the edge.
 * Kept small enough that the panels still lay out at the pane's 280px minimum.
 */
const GUTTER = 2;

const TAB_ORDER: readonly FormatTab[] = Object.freeze([
  FormatTab.Number, FormatTab.Alignment, FormatTab.Font, FormatTab.Border, FormatTab.Fill
]);

/**
 * The **Format Cells** task pane: one preview over five tabs, applying live to the selection.
 *
 * @remarks
 * Modeled on Excel Online's format pane, with two deliberate departures.
 *
 * The **preview is shared**. Excel Online gives each of its panels its own sample, which means the
 * font sample cannot show you the number format and the number sample cannot show you the fill.
 * One preview of the actual anchor cell answers every tab at once — and since the pane applies
 * live, it is not a mock of the result, it IS the result.
 *
 * There is a **Fill tab**, which Excel Online has no equivalent for: the model carries pattern and
 * gradient fills, and burying them the way desktop Excel does (a "Fill Effects" sub-dialog) is not
 * worth copying. See {@link FillPanel}.
 */
export const FormatTaskPane = memo((props: TaskPaneProps<IWorkbook, FormatPaneArgs>) => {
  const workbook = props.model as IWorkbook;
  const t = useTranslator();
  // The pane formats a worksheet's selection; it follows the active tab, and a sheet of another
  // kind has no cells to format.
  useModelSync<IWorkbook.IListeners>(workbook, 'onSelectedSheetChange');
  const sheet = workbook.getSelectedWorksheet();
  if (!sheet) {
    const { model: _model, args: _args, entryKey: _entryKey, frame: _frame, ref, ...rest } = props;
    return (
      <Paper square ref={ref} sx={{ display: 'flex', flex: '1 1 auto', padding: (theme: Theme) => theme.spacing(2, GUTTER) }} {...rest}>
        {t('format.noWorksheet')}
      </Paper>
    );
  }
  return <FormatTaskPaneBody {...props} sheet={sheet}/>;
});

FormatTaskPane.displayName = 'FormatTaskPane';

const FormatTaskPaneBody = memo((props: TaskPaneProps<IWorkbook, FormatPaneArgs> & { sheet: IWorksheet }) => {
  const {
    model: _workbook,
    sheet,
    args,
    entryKey: _entryKey,
    frame: _frame,
    ref,
    ...rest
  } = props;

  const t = useTranslator();
  const selection = useFormatSelection(sheet);
  // The tab is remembered ACROSS openings: the menu entries activate the pane with no tab at all, and
  // Excel's own Format Cells reopens where you left it. A stored value from an older build (or a tab
  // that has since gone) falls back rather than rendering an empty body.
  const [persistedTab, setTab] = usePersistentState<FormatTab>(FORMAT_TAB_KEY, FormatTab.Number);
  const tab = TAB_ORDER.includes(persistedTab) ? persistedTab : FormatTab.Number;

  // `args` is an EVENT, not state (see `TaskPaneProps.args`): react to the args OBJECT changing — a
  // re-render passes the same one (so the user is not dragged back to the tab a long-finished
  // activation asked for), while every fresh activation mints a new one, including one asking for
  // the tab it asked for last time.
  useEffect(() => {
    const requested = args?.tab;
    if (requested) setTab(requested);
  }, [args]);

  const numberFormat = selection.style.getNumberFormat();
  const numberFormatCode = typeof numberFormat === 'number'
    ? NumberFormat.resolve(numberFormat)
    : (numberFormat ?? 'General');

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
        overflow: 'hidden'
      }}
      {...rest}
    >
      {/* The preview and the tab strip keep their height; only the content below scrolls. Both are
          flex children, and a flex child shrinks by default — the strip's `minHeight: 0` (which
          drops MUI's 48px floor) would otherwise let a short pane squash it. */}
      <Box sx={{ flexShrink: 0, padding: (theme: Theme) => theme.spacing(1.5, GUTTER) }}>
        <FormatCellPreview selection={selection}/>
      </Box>

      <Tabs
        value={tab}
        onChange={(_e: React.SyntheticEvent, next: FormatTab) => setTab(next)}
        // Scrollable, with the tabs told to GROW: when the five labels fit they share the width
        // (a strip, not a huddle left of a lot of empty rule), and when the pane is narrower than
        // the labels the strip scrolls instead. `fullWidth` split the width evenly regardless, and
        // a label wider than its fifth ran into the next one.
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          minHeight: 0,
          flexShrink: 0,
          borderBottom: (theme: Theme) => `1px solid ${theme.palette.divider}`,
          '& .MuiTab-root': {
            textTransform: 'none',
            whiteSpace: 'nowrap',
            minHeight: 0,
            minWidth: 0,
            flex: '1 0 auto',
            padding: '8px 4px'
          }
        }}
      >
        {TAB_ORDER.map((key) => (
          <Tab key={key} value={key} label={tabLabel(t, key)}/>
        ))}
      </Tabs>

      <Box
        sx={{
          flex: '1 1 auto',
          minHeight: 0,
          overflow: 'auto',
          // Extra above: the first control of a tab is often a dropdown, and a dropdown that starts
          // right under the tab underline reads as part of the tab strip.
          padding: (theme: Theme) => theme.spacing(2.5, GUTTER)
        }}
      >
        {tab === FormatTab.Number ? (
          <NumberFormatPanel
            hideSample
            showQuickFormats
            value={numberFormatCode}
            disabled={selection.disabled}
            context={() => selection.cell}
            onChange={(code: string) => {
              selection.applyStyle({ numberFormat: code }, messageKey('op.setNumberFormat'));
            }}
          />
        ) : null}
        {tab === FormatTab.Alignment ? <AlignmentPanel selection={selection}/> : null}
        {tab === FormatTab.Font ? <FontPanel selection={selection}/> : null}
        {tab === FormatTab.Fill ? <FillPanel selection={fillSelectionOf(selection)}/> : null}
        {tab === FormatTab.Border ? <BorderPanel selection={selection}/> : null}
      </Box>
    </Paper>
  );
});

FormatTaskPaneBody.displayName = 'FormatTaskPaneBody';

/** Localized tab name. Literal `t()` pairs, so the extractor can see every key. */
function tabLabel(t: (key: string) => string, tab: FormatTab): string {
  switch (tab) {
    case FormatTab.Number: return t('format.tabNumber');
    case FormatTab.Alignment: return t('format.tabAlignment');
    case FormatTab.Font: return t('format.tabFont');
    case FormatTab.Fill: return t('format.tabFill');
    case FormatTab.Border: return t('format.tabBorder');
    default: return tab;
  }
}

export default FormatTaskPane;
