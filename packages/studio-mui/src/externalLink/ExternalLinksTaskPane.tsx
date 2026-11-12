import type React from 'react';
import { useState, memo } from 'react';

import { Box, Tab, Tabs } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { type IWorkbook } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import { type TaskPaneProps, type ExternalLinksPaneArgs } from '@sheetxl/react';

import { ExternalLinksPanel } from './ExternalLinksPanel';
import { ExternalLinkSettingsTab } from './ExternalLinkSettingsTab';

const TAB_MESSAGE_KEYS: Record<ExternalLinksPaneArgs.Tab, string> = {
  links: messageKey('externalLink.tab.links'),
  settings: messageKey('externalLink.tab.settings')
};

const TABS = Object.keys(TAB_MESSAGE_KEYS) as ExternalLinksPaneArgs.Tab[];

/**
 * `args` arrives from command surfaces this pane does not control, so an activation value that
 * names no tab is ignored rather than handed to `Tabs`, which renders NO tab for a value it does
 * not know.
 */
const asTab = (tab: unknown): ExternalLinksPaneArgs.Tab | null =>
  (TABS as unknown[]).includes(tab) ? tab as ExternalLinksPaneArgs.Tab : null;

export interface ExternalLinksTaskPaneProps extends TaskPaneProps<IWorkbook, ExternalLinksPaneArgs> {
  /** The tab shown when the pane opens with no `args`. @defaultValue `'links'` */
  defaultTab?: ExternalLinksPaneArgs.Tab;
}

/**
 * **Workbook Links** — every workbook this one links to, and what should happen to their cached
 * values when it is opened, as two tabs of one pane.
 *
 * @remarks
 * Same shape as Manage Protection, and for the same reason: the Links list is a full-height items
 * panel with its own scroll, and stacking a settings block under it would put two scrolling
 * regions in one column.
 */
export const ExternalLinksTaskPane = memo((props: ExternalLinksTaskPaneProps) => {
  const {
    model: workbook,
    args,
    defaultTab = 'links',
    entryKey: _entryKey,
    frame: _frame,
    ref,
    ...rest
  } = props;

  const t = useTranslator();

  const [activeTab, setActiveTab] = useState<ExternalLinksPaneArgs.Tab>(() => asTab(args?.tab) ?? defaultTab);
  // `args` is scoped to one activation, so react to it CHANGING — reacting to its presence would
  // replay the requested tab on every render and pin the pane there.
  const [lastArgs, setLastArgs] = useState<ExternalLinksPaneArgs | undefined>(args);
  if (args !== lastArgs) {
    setLastArgs(args);
    const requested = asTab(args?.tab);
    if (requested) setActiveTab(requested);
  }

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
           shrink-wraps its widest control and leaves the rest of the frame empty. */
        width: '100%',
        minWidth: 0,
        flex: '1 1 auto',
        height: '100%',
        minHeight: 0,
        // A path is the widest thing here and it wraps; nothing scrolls sideways.
        overflowX: 'hidden'
      }}
    >
      <Tabs
        value={activeTab}
        onChange={(_e, next) => setActiveTab(next as ExternalLinksPaneArgs.Tab)}
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
        {TABS.map((tab: ExternalLinksPaneArgs.Tab) => (
          <Tab key={tab} value={tab} label={t(TAB_MESSAGE_KEYS[tab])} />
        ))}
      </Tabs>

      {/* Only the active tab is mounted: the Links panel subscribes to the calculation, and a
          subscription that fires on every pass has no business running behind a tab nobody is
          looking at. */}
      <Box sx={{ flex: '1 1 auto', minHeight: 0, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'links' ? (
          <ExternalLinksPanel
            workbook={workbook}
            style={{ flex: '1 1 auto', minHeight: 0, minWidth: 0, width: '100%' }}
          />
        ) : null}
        {activeTab === 'settings' ? (
          <ExternalLinkSettingsTab
            workbook={workbook}
            style={{ flex: '1 1 auto', minHeight: 0, minWidth: 0, width: '100%' }}
          />
        ) : null}
      </Box>
    </Box>
  );
});

ExternalLinksTaskPane.displayName = 'ExternalLinksTaskPane';

export default ExternalLinksTaskPane;
