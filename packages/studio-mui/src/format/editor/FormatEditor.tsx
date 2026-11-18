import type React from 'react';
import { useEffect, useState } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { Tab } from '@mui/material';
import { Tabs } from '@mui/material';
import { Typography } from '@mui/material';

import { type IWorksheet } from '@sheetxl/sdk';

import { useCallbackRef } from '@sheetxl/utils-react';

import { panelSx } from '../FormatPanelParts';

import { type FormatTarget } from './FormatField';
import { FormatFields } from './FormatFields';

export interface FormatEditorProps {
  /** What is formatted. */
  target: FormatTarget;
  /** The sheet the target is on: its styles, and the cells a field may pick. */
  sheet: IWorksheet;
  /**
   * A tab to show, by key. An event, not state: the editor moves to it when the object changes, and
   * the user is free to leave it.
   */
  request?: { tab: string } | null;
  /**
   * Drawn at the end of the title's line: where a host puts the way from this thing's format to
   * whatever else is done with it (a chart element's row in Chart Details).
   */
  actions?: React.ReactNode;
}

/**
 * Formats one thing: its tabs across the top, and under them the fields of the tab shown, each
 * applying as it is set.
 *
 * @remarks
 * The editor knows nothing of what it formats. A {@link FormatTarget} says what the thing is called,
 * which tabs its kind has and what is on each, so the same editor serves a shape, a chart's legend
 * and one point of a series. It is a component, not a pane: a host puts it where it wants one.
 *
 * It stays on the tab it was on when the target changes, where the new target has a tab of that
 * key: pressing one series after another keeps Fill and Line in view. A target with one tab shows
 * no tab strip. What a write is refused for is said above the fields.
 */
export const FormatEditor = (props: FormatEditorProps): React.ReactElement => {
  const { target, sheet, request, actions } = props;
  const [tabKey, setTabKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (request?.tab) setTabKey(request.tab);
  }, [request]);
  // What one thing refused says nothing of the next.
  useEffect(() => { setError(null); }, [target.id]);

  const run = useCallbackRef((apply: () => void) => {
    try {
      apply();
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, []);

  const tabs = target.tabs;
  const tab = tabs.find(each => each.key === tabKey) ?? tabs[0];

  return (
    <Box data-format-target={target.id} sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
      {target.title || actions ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, paddingBottom: 0.5 }}>
          <Typography variant="subtitle2" component="div" noWrap sx={{ flex: '1 1 auto', minWidth: 0 }}>{target.title}</Typography>
          {actions}
        </Box>
      ) : null}
      {tabs.length > 1 ? (
        <Tabs
          value={tab.key}
          onChange={(_event: React.SyntheticEvent, next: string) => setTabKey(next)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            minHeight: 0,
            flexShrink: 0,
            borderBottom: (theme: Theme) => `1px solid ${theme.palette.divider}`,
            '& .MuiTab-root': { textTransform: 'none', whiteSpace: 'nowrap', minHeight: 0, minWidth: 0, flex: '1 0 auto', padding: '8px 4px' }
          }}
        >
          {tabs.map(each => <Tab key={each.key} value={each.key} label={each.label}/>)}
        </Tabs>
      ) : null}
      {error ? <Typography variant="caption" color="error" role="alert" sx={{ paddingTop: 1 }}>{error}</Typography> : null}
      {tab ? (
        <Box data-format-tab={tab.key} sx={{ ...panelSx, gap: 2, paddingTop: (theme: Theme) => theme.spacing(tabs.length > 1 ? 2 : 1) }}>
          <FormatFields fields={tab.fields()} sheet={sheet} disabled={target.disabled} run={run}/>
        </Box>
      ) : null}
    </Box>
  );
};
