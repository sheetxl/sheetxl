import type React from 'react';
import { useState, memo } from 'react';

import { type Theme } from '@mui/material';
import { Box, Tab, Tabs } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { type IWorkbook, type IWorksheet } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import {
  useModelSync, type TaskPaneProps, type ProtectionPaneArgs
} from '@sheetxl/react';

import { ProtectedRangeDetailsPanel } from '../protectedRange/ProtectedRangeDetailsPanel';

import { WorksheetProtectionPanel } from './WorksheetProtectionPanel';
import { ProtectedCellsPanel } from './ProtectedCellsPanel';
import { WorkbookProtectionTab } from './WorkbookProtectionTab';

/** In display order. */
const TAB_MESSAGE_KEYS: Record<ProtectionPaneArgs.Tab, string> = {
  sheet: messageKey('protection.tab.sheet'),
  ranges: messageKey('protection.tab.ranges'),
  cells: messageKey('protection.tab.cells'),
  workbook: messageKey('protection.tab.workbook')
};

const TABS = Object.keys(TAB_MESSAGE_KEYS) as ProtectionPaneArgs.Tab[];

/**
 * `args` arrives from command surfaces this pane does not control, so an activation value that
 * names no tab (a menu's per-item payload leaking through) is ignored rather than handed to `Tabs`,
 * which renders NO tab for a value it does not know.
 */
const asTab = (tab: unknown): ProtectionPaneArgs.Tab | null =>
  (TABS as unknown[]).includes(tab) ? tab as ProtectionPaneArgs.Tab : null;

export interface ManageProtectionTaskPaneProps extends TaskPaneProps<IWorkbook, ProtectionPaneArgs> {
  /** The tab shown when the pane opens with no `args`. @defaultValue `'sheet'` */
  defaultTab?: ProtectionPaneArgs.Tab;
}

/**
 * **Manage Protection** — sheet protection, the selected cells' protection, the ranges that stay
 * editable, and workbook protection, as four tabs of one pane.
 *
 * @remarks
 * Tabs rather than Excel online's collapsible sections: the Ranges list is a full-height
 * items panel with its own scroll, and stacking it under fifteen checkboxes would put two scrolling
 * regions in one column.
 *
 * The tab is an ACTIVATION argument, not pane state, so the three entry points that used to open
 * three separate surfaces each land where they mean to — and re-activating without one leaves the
 * pane where the user left it (the area delivers `args` per activation, so an arriving value is an
 * event; see {@link TaskPaneProps.args}).
 */
export const ManageProtectionTaskPane = memo((props: ManageProtectionTaskPaneProps) => {
  const {
    model: workbook,
    args,
    defaultTab = 'sheet',
    entryKey: _entryKey,
    frame: _frame,
    ref,
    ...rest
  } = props;

  const t = useTranslator();

  const [activeTab, setActiveTab] = useState<ProtectionPaneArgs.Tab>(() => asTab(args?.tab) ?? defaultTab);
  // `args` is scoped to one activation, so react to it CHANGING — reacting to its presence would
  // replay the requested tab on every render and pin the pane there.
  const [lastArgs, setLastArgs] = useState<ProtectionPaneArgs | undefined>(args);
  if (args !== lastArgs) {
    setLastArgs(args);
    const requested = asTab(args?.tab);
    if (requested) setActiveTab(requested);
  }

  // The Sheet tab is about the ACTIVE sheet, so it rebinds when that changes.
  useModelSync<IWorkbook.IListeners>(workbook!, ['onSelectedSheetChange']);
  const sheet: IWorksheet | null = workbook?.getSelectedWorksheet() ?? null;

  // The host always supplies a workbook; the prop is optional on the generic pane contract.
  if (!workbook) return null;

  return (
    <Box
      ref={ref as React.Ref<HTMLDivElement>}
      {...rest}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        /* The pane host (`.taskpane-frame-content`) is a flex ROW, so a pane with no width
           shrink-wraps its widest control and leaves the rest of the frame empty. Same contract as
           `ItemsPanel`'s `.details-panel`, which is the one that demonstrably lays out in this
           frame — `flex-basis: auto`, not `100%`, which resolves against a container that is itself
           sizing to this child. */
        width: '100%',
        minWidth: 0,
        flex: '1 1 auto',
        height: '100%',
        minHeight: 0,
        // A settings pane never scrolls sideways; a stray wide child wraps or clips instead.
        overflowX: 'hidden'
      }}
    >
      <Tabs
        value={activeTab}
        onChange={(_e, next) => setActiveTab(next as ProtectionPaneArgs.Tab)}
        variant="fullWidth"
        sx={{
          width: '100%',
          flex: '0 0 auto',
          minHeight: '36px',
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': { minHeight: '36px', textTransform: 'none', pt: 0.5, pb: 0.5, px: 0.5, minWidth: 0 }
        }}
      >
        {TABS.map((tab: ProtectionPaneArgs.Tab) => (
          <Tab key={tab} value={tab} label={t(TAB_MESSAGE_KEYS[tab])} />
        ))}
      </Tabs>

      {/* Only the active tab is mounted: the Ranges panel subscribes to the collection and
          the Sheet and Workbook tabs hold staged passwords, so keeping them all alive would keep
          drafts around for sheets the user has moved on from. */}
      <Box sx={{ flex: '1 1 auto', minHeight: 0, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'sheet' && sheet ? (
          <WorksheetProtectionPanel
            // Rebind on a sheet switch rather than reconciling a draft onto a different sheet.
            key={sheet.getId()}
            sheet={sheet}
            style={{ flex: '1 1 auto', minHeight: 0, minWidth: 0, width: '100%' }}
          />
        ) : null}
        {activeTab === 'cells' && sheet ? (
          <ProtectedCellsPanel
            key={sheet.getId()}
            sheet={sheet}
            style={{ flex: '1 1 auto', minHeight: 0, minWidth: 0, width: '100%' }}
          />
        ) : null}
        {activeTab === 'ranges' ? (
          <ProtectedRangeDetailsPanel
            workbook={workbook}
            args={args?.items}
            style={{ flex: '1 1 auto', minHeight: 0, minWidth: 0, width: '100%' }}
          />
        ) : null}
        {activeTab === 'workbook' ? (
          <WorkbookProtectionTab
            workbook={workbook}
            style={{ flex: '1 1 auto', minHeight: 0, minWidth: 0, width: '100%' }}
          />
        ) : null}
      </Box>
    </Box>
  );
});

ManageProtectionTaskPane.displayName = 'ManageProtectionTaskPane';

/**
 * Back-compat host for the retired `protectedRangeDetails` pane key — the same pane, opened on
 * Ranges.
 */
export const ProtectedRangeDetailsTaskPane = (props: TaskPaneProps<IWorkbook, ProtectionPaneArgs>) => (
  <ManageProtectionTaskPane {...props} defaultTab="ranges" />
);

export default ManageProtectionTaskPane;
