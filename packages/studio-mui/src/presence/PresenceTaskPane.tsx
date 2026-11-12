import React, { memo, useState } from 'react';

import { Box, Button, ButtonBase, Link, Tab, Tabs, Typography } from '@mui/material';

import {
  DEFAULT_ANNOTATION_STYLES, PresenceMessages, usePresenceCommits, usePresenceSnapshot, type PresenceCommit,
  type PresenceLogEntry, type PresenceStore, type RangeAnnotation, type TaskPaneProps
} from '@sheetxl/react';
import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';
import { SimpleTooltip } from '@sheetxl/utils-mui';

import { ItemCard, ItemCardAction } from '../itemsPanel/ItemCard';
import type { ItemBodyProps } from '../itemsPanel/ItemsDescriptor';
import { ItemsSearchField } from '../itemsPanel/ItemsSearchField';
import { PresetChip } from '../conditionalFormat/PresetChip';

import { Timeline, TimelineEntry } from './Timeline';

/** The intent's color as the grid's chip wears it, so a card and its chip read as one thing. */
const chipColor = (finding: RangeAnnotation): string =>
  (DEFAULT_ANNOTATION_STYLES[finding.intent] ?? DEFAULT_ANNOTATION_STYLES.finding).chip;

/** How far back the history walks the commit log. */
const HISTORY_COMMITS = 1000;

/** The built-in card actions are all the list's; the agent's cards carry their own. */
const NO_CARD_KEYS = {};

type AgentTab = 'review' | 'history';

/** A finding as a card shows it. */
interface FindingItem {
  finding: RangeAnnotation;
  /** 1-based place in the review; `0` when it is not walked (stale). */
  ordinal: number;
}

/** A titled list, headed as the Studio item panes head theirs. */
const Section: React.FC<{ title: string; className: string; children: React.ReactNode }> = ({ title, className, children }) => (
  <Box className={className} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
    <Typography variant="body2">{title}</Typography>
    {children}
  </Box>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="body2" sx={{ color: 'text.secondary', pl: 1 }}>{children}</Typography>
);

/** The finding's media is a marker, not a preview: small, centered on the label and range beside it. */
const MEDIA_SIZE = 20;

/**
 * The finding's media, in the grid chip's colors: filled with the intent, its place in the review in
 * white.
 */
const FindingMedia: React.FC<ItemBodyProps<FindingItem>> = ({ item }) => (
  <PresetChip
    className="sxl-agent-finding-media"
    sx={{
      width: 'auto',
      minWidth: MEDIA_SIZE,
      height: MEDIA_SIZE,
      px: 0.5,
      fontSize: 11,
      background: chipColor(item.finding),
      borderColor: chipColor(item.finding),
      color: '#fff',
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
      opacity: item.finding.status === 'stale' ? 0.5 : 1
    }}
  >
    {item.ordinal > 0 ? item.ordinal : <DynamicIcon iconKey={item.finding.intent === 'question' ? 'Help' : 'CheckSuccess'} size={14} ariaHidden />}
  </PresetChip>
);

/** Today's changes need only the time; older ones the date as well. */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  return date.toDateString() === today.toDateString() ? date.toLocaleTimeString() : date.toLocaleString();
}

/**
 * A finding as a Studio card, wearing its grid chip's colors: the chip's fill on the media, its
 * outline when current. A card because it is live — walked and dismissed; the history records it as
 * an entry from the moment it is raised. Clicking it reveals the range; its one action dismisses it.
 */
const FindingCard: React.FC<{
  item: FindingItem;
  isCurrent?: boolean;
  onSelect?: () => void;
  onDismiss: () => void;
}> = ({ item, isCurrent, onSelect, onDismiss }) => {
  const t = useTranslator();
  const { finding } = item;
  return (
    <ItemCard
      className="sxl-agent-finding"
      item={item}
      messageKeys={NO_CARD_KEYS}
      title={finding.label ?? finding.range}
      selected={isCurrent}
      onSelect={onSelect}
      // The range is reported, not edited: a quiet line beside the media (or why it is gone).
      caption={finding.status === 'stale' ? t(PresenceMessages.findingsStale) : finding.range}
      sx={{ '&.Mui-selected': { outline: `2px solid ${chipColor(finding)}` } }}
      Media={FindingMedia}
      actions={<ItemCardAction title={t(PresenceMessages.dismiss)} iconKey="Close" onClick={onDismiss} />}
    />
  );
};

/** The quiet line's parts, dot-separated: type first, then when, then the links (where, and soon the code). */
const Meta: React.FC<{ parts: React.ReactNode[] }> = ({ parts }) => (
  <>
    {parts.filter((part) => part !== null && part !== undefined && part !== false).map((part, index) => (
      <React.Fragment key={index}>{index > 0 ? ' · ' : null}{part}</React.Fragment>
    ))}
  </>
);

/**
 * A link to cells inside an entry: selects them. Stops its click from reaching the row, which has a
 * job of its own. Inline text (not a button element, which is an atomic box): when the line runs out
 * of room the line's ellipsis cuts into the address instead of dropping it whole.
 */
const RangeLink: React.FC<{ range: string; onSelect: () => void }> = ({ range, onSelect }) => {
  const t = useTranslator();
  const select = (e: React.SyntheticEvent): void => { e.stopPropagation(); onSelect(); };
  return (
    <Link
      component="span"
      role="link"
      tabIndex={0}
      underline="hover"
      title={t(PresenceMessages.promptGoto, { range })}
      onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
      onClick={select}
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(e); } }}
      sx={{ cursor: 'pointer' }}
    >
      {range}
    </Link>
  );
};

/**
 * An agent commit as a history entry — a record, not a card. Reverting is the undo history's job;
 * the code that made the change will link from here.
 */
const CommitEntry: React.FC<{ commit: PresenceCommit }> = ({ commit }) => {
  const t = useTranslator();
  return (
    <TimelineEntry
      className="sxl-agent-commit"
      dotColor="primary.main"
      primary={commit.description ?? t(PresenceMessages.changesUntitled)}
      secondary={<Meta parts={[t(PresenceMessages.historyKindChange), formatTime(commit.timestamp)]} />}
    />
  );
};

/**
 * A finding as the history records it: when it was raised and where. Clicking it takes the user to
 * the cells — as the open finding while it is one.
 */
const LoggedFindingEntry: React.FC<{
  finding: PresenceLogEntry;
  onSelect?: () => void;
  onSelectRange?: () => void;
}> = ({ finding, onSelect, onSelectRange }) => {
  const t = useTranslator();
  return (
    <TimelineEntry
      className="sxl-agent-logged-finding"
      dotColor={chipColor(finding)}
      primary={finding.label ?? finding.range}
      secondary={
        <Meta
          parts={[
            finding.intent === 'question' ? t(PresenceMessages.historyKindQuestion) : t(PresenceMessages.historyKindFinding),
            formatTime(finding.raisedAt),
            onSelectRange ? <RangeLink range={finding.range} onSelect={onSelectRange} /> : finding.range
          ]}
        />
      }
      onClick={onSelect}
    />
  );
};

/**
 * What the agent pointed at for the user to review. Its changes are not repeated here: the undo
 * history is where a change is, and the History tab records them. What the agent is waiting on, or
 * doing, is the pane's status — at the bottom, where it comes and goes without moving the list.
 */
const ReviewPanel: React.FC<{ store: PresenceStore }> = ({ store }) => {
  const t = useTranslator();
  const { findings, navigable, current } = usePresenceSnapshot(store);

  // Review findings grouped by walk, newest walk first (the store already orders them so).
  const walks: RangeAnnotation[][] = [];
  for (const finding of findings) {
    if (finding.intent === 'working') continue;
    const last = walks[walks.length - 1];
    if (last && last[0].walk === finding.walk) last.push(finding); else walks.push([finding]);
  }

  return (
    <>
      <Section className="sxl-agent-findings" title={t(PresenceMessages.sectionFindings)}>
        {walks.length === 0 ? (
          <Empty>{t(PresenceMessages.findingsNone)}</Empty>
        ) : (
          <>
            {walks.map((walk) => (
              <Box key={walk[0].walk} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {walk.map((finding) => (
                  <FindingCard
                    key={finding.id}
                    item={{ finding, ordinal: navigable.indexOf(finding) + 1 }}
                    isCurrent={finding === current}
                    onSelect={finding.status === 'stale' ? undefined : () => store.goTo(finding.id)}
                    onDismiss={() => store.dismiss(finding.id)}
                  />
                ))}
              </Box>
            ))}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="small" onClick={() => store.dismissAll()} sx={{ textTransform: 'none' }}>
                {t(PresenceMessages.dismissAll)}
              </Button>
            </Box>
          </>
        )}
      </Section>
    </>
  );
};

/**
 * One line of the pane's status: a colored mark, what is happening, and a click that goes there. A
 * button when it has somewhere to go.
 */
const StatusLine: React.FC<{ className: string; color: string; text: string; onClick?: () => void }> = ({ className, color, text, onClick }) => (
  <ButtonBase
    className={className}
    disabled={!onClick}
    onClick={onClick}
    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 1, width: '100%', borderRadius: 1, px: 0.5, py: 0.25, '&:hover': { bgcolor: 'action.hover' } }}
  >
    <Box component="span" aria-hidden sx={{ flex: '0 0 auto', width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
    <Typography variant="caption" noWrap sx={{ color: 'text.primary', minWidth: 0 }}>{text}</Typography>
  </ButtonBase>
);

/** The strip's working mark, at status-bar size: its tooltip says where; a click goes there. */
const WorkingDot: React.FC<{ store: PresenceStore; working: RangeAnnotation }> = ({ store, working }) => {
  const t = useTranslator();
  const where = working.label ? `${working.label} (${working.range})` : working.range;
  return (
    <SimpleTooltip disableInteractive title={t(PresenceMessages.working, { where })}>
      <ButtonBase
        className="sxl-agent-status-working"
        aria-label={t(PresenceMessages.working, { where })}
        onClick={() => store.goTo(working.id)}
        sx={{ width: 16, height: 16, borderRadius: '50%' }}
      >
        <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: DEFAULT_ANNOTATION_STYLES.working.chip }} />
      </ButtonBase>
    </SimpleTooltip>
  );
};

/**
 * The pane's status, at its foot: what the agent is waiting on (its question — answered in the
 * prompt's window, not here), and how many tool calls it has made, led by the strip's working dot
 * while the agent has its cursor up. Each comes and goes on its own; the list above never moves.
 */
const PaneStatus: React.FC<{ store: PresenceStore }> = ({ store }) => {
  const t = useTranslator();
  const { promptQuestion, working, status } = usePresenceSnapshot(store);
  if (!promptQuestion && !working && status.meter === undefined) return null;
  return (
    <Box className="sxl-agent-status" sx={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 0.25, px: 1, py: 0.75, borderTop: 1, borderColor: 'divider' }}>
      {promptQuestion ? (
        <StatusLine
          className="sxl-agent-status-waiting"
          color="warning.main"
          text={t(PresenceMessages.waitingOnYou, { question: promptQuestion.header ?? promptQuestion.message })}
          onClick={promptQuestion.range ? () => store.reveal(promptQuestion.range!) : undefined}
        />
      ) : null}
      {working || status.meter !== undefined ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 0.5, minHeight: 20 }}>
          {working ? <WorkingDot store={store} working={working} /> : null}
          {status.meter !== undefined ? (
            <Typography className="sxl-agent-meter" variant="caption" sx={{ color: 'text.secondary' }}>
              {t(PresenceMessages.meter, { count: status.meter })}
            </Typography>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
};

/** One history entry: a finding the agent raised, or a change it made. */
type HistoryItem =
  | { kind: 'finding'; at: number; finding: PresenceLogEntry }
  | { kind: 'change'; at: number; commit: PresenceCommit };

/**
 * Everything the agent did this session as one log, newest first: the findings it raised (whatever
 * became of them) and the changes it made — searchable, nothing to remove.
 */
const HistoryPanel: React.FC<{ store: PresenceStore }> = ({ store }) => {
  const t = useTranslator();
  const { log, findings, workbook } = usePresenceSnapshot(store);
  const commits = usePresenceCommits(workbook, HISTORY_COMMITS);
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();
  const matches = (...texts: (string | null | undefined)[]): boolean =>
    !needle || texts.some((text) => !!text && text.toLowerCase().includes(needle));

  const all: HistoryItem[] = [
    ...log.map((finding): HistoryItem => ({ kind: 'finding', at: finding.raisedAt, finding })),
    ...commits.map((commit): HistoryItem => ({ kind: 'change', at: commit.timestamp, commit }))
  ].sort((a, b) => b.at - a.at);
  const shown = all.filter((item) => item.kind === 'finding'
    ? matches(item.finding.label, item.finding.range)
    : matches(item.commit.description ?? t(PresenceMessages.changesUntitled)));

  // The live annotation, while the finding is still one.
  const liveById = new Map(findings.map((f: RangeAnnotation) => [f.id, f]));

  return (
    <>
      <ItemsSearchField
        value={query}
        onChange={setQuery}
        placeholder={t(PresenceMessages.historySearch)}
        clearLabel={t(PresenceMessages.historyClearSearch)}
        sx={{ flexShrink: 0 }}
      />
      {all.length === 0 ? (
        <Empty>{t(PresenceMessages.historyNone)}</Empty>
      ) : shown.length === 0 ? (
        <Empty>{t(PresenceMessages.historyNoMatches)}</Empty>
      ) : (
        <Timeline className="sxl-agent-history">
          {shown.map((item) => {
            if (item.kind === 'change') return <CommitEntry key={item.commit.id} commit={item.commit} />;
            const { finding } = item;
            const live = liveById.get(finding.id);
            const open = !!live && live.status === 'open';
            return (
              <LoggedFindingEntry
                key={finding.id}
                finding={finding}
                onSelect={open
                  ? () => store.goTo(finding.id)
                  : live?.status === 'stale' ? undefined : () => store.select(finding.range)}
                onSelectRange={live?.status === 'stale' ? undefined : () => store.select(finding.range)}
              />
            );
          })}
        </Timeline>
      )}
    </>
  );
};

export interface PresenceTaskPaneProps extends TaskPaneProps {
  store: PresenceStore;
}

/**
 * **Agent** — two tabs. *Review*: what the agent pointed at for the user (live findings, as cards).
 * *History*: one log of every finding raised and every change made, searchable — anything that has
 * happened is a record, shown as a timeline rather than a card. Under both, the agent's status: what
 * it is waiting on and what it is working on.
 */
export const PresenceTaskPane = memo((props: PresenceTaskPaneProps) => {
  const {
    store,
    model: _model,
    args: _args,
    entryKey: _entryKey,
    frame: _frame,
    ref,
    ...rest
  } = props;
  const t = useTranslator();
  const [tab, setTab] = useState<AgentTab>('review');

  return (
    <Box
      ref={ref as React.Ref<HTMLDivElement>}
      {...rest}
      className="sxl-agent-pane"
      sx={{
        display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0,
        flex: '1 1 auto', height: '100%', minHeight: 0, overflowX: 'hidden'
      }}
    >
      <Tabs
        value={tab}
        onChange={(_e, next) => setTab(next as AgentTab)}
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
        <Tab value="review" label={t(PresenceMessages.tabReview)} />
        <Tab value="history" label={t(PresenceMessages.tabHistory)} />
      </Tabs>

      <Box sx={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, p: 1.5 }}>
        {tab === 'review' ? <ReviewPanel store={store} /> : <HistoryPanel store={store} />}
      </Box>

      <PaneStatus store={store} />
    </Box>
  );
});

PresenceTaskPane.displayName = 'PresenceTaskPane';
