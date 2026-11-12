import type React from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { Box, Button, IconButton, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';

import { CoordUtils, messageKey, type CellCoords } from '@sheetxl/utils';

import { type IComment, type IRangeSelection, type IWorksheet, type IWorkbook } from '@sheetxl/sdk';

import { DynamicIcon, usePersistentState, useTranslator } from '@sheetxl/utils-react';

import { SimpleTooltip } from '@sheetxl/utils-mui';

import {
  getCommentCoords, useModelListener, useSheetComments,
  type CommentsPaneArgs, type TaskPaneProps
} from '@sheetxl/react';

import { CommentCard } from './CommentCard';

/** Which threads the pane lists. */
export type CommentsFilter = 'all' | 'open' | 'resolved';

const FILTER_MESSAGE_KEYS: Record<CommentsFilter, string> = {
  all: messageKey('comment.filter.all'),
  open: messageKey('comment.filter.open'),
  resolved: messageKey('comment.filter.resolved')
};

const FILTERS = Object.keys(FILTER_MESSAGE_KEYS) as CommentsFilter[];

/** Persistence key for the filter the pane was last left on. */
export const COMMENTS_FILTER_KEY = 'comments.filter';

const MESSAGE_KEYS = {
  add: messageKey('comment.new'),
  addPrompt: messageKey('comment.addPrompt'),
  noMatches: messageKey('comment.noMatches')
} as const;

export interface CommentsTaskPaneProps extends TaskPaneProps<IWorkbook, CommentsPaneArgs> {
  /** The filter the pane opens with when none has been chosen before. @defaultValue `'all'` */
  defaultFilter?: CommentsFilter;
}

/** A card the pane lists: a thread, or the draft on a cell that has none. */
interface Listed {
  key: string;
  coords: CellCoords;
  comment: IComment | null;
}

const compareListed = (a: Listed, b: Listed): number => {
  return (a.coords.rowIndex - b.coords.rowIndex) || (a.coords.colIndex - b.coords.colIndex);
};

/**
 * **Comments** — every threaded comment on the active sheet, in cell order, each as a
 * {@link CommentCard}.
 *
 * @remarks
 * Clicking a card selects its cell, and selecting a cell scrolls to its card and marks it. A new
 * comment is a draft card on the selected cell that writes nothing until it is posted. Notes are
 * not listed: a note is edited in its box on the sheet.
 */
export const CommentsTaskPane = memo((props: CommentsTaskPaneProps) => {
  const {
    model: workbook,
    args,
    defaultFilter = 'all',
    entryKey: _entryKey,
    frame: _frame,
    ref,
    ...rest
  } = props;

  const t = useTranslator();

  const [sheet, setSheet] = useState<IWorksheet | null>(() => workbook?.getSelectedWorksheet() ?? null);
  useModelListener<IWorkbook, IWorkbook.IListeners>(workbook, {
    onSheetsChange(): void {
      setSheet(workbook?.getSelectedWorksheet() ?? null);
    }
  });

  // The filter is a preference, remembered across openings. A stored value from another build falls
  // back to the default.
  const [persistedFilter, setPersistedFilter] = usePersistentState<CommentsFilter>(COMMENTS_FILTER_KEY, defaultFilter);
  // A thread a command went to is shown whatever the preference is, without changing it.
  const [showAll, setShowAll] = useState<boolean>(false);
  const filter: CommentsFilter = showAll ? 'all' : FILTERS.includes(persistedFilter) ? persistedFilter : defaultFilter;
  const threads = useSheetComments(sheet, { resolved: filter === 'all' ? undefined : filter === 'resolved' });
  // Unfiltered, for what the selected cell holds: a resolved thread hidden by the filter is still there.
  const allThreads = useSheetComments(sheet);

  const [draft, setDraft] = useState<CellCoords | null>(null);
  const [focus, setFocus] = useState<{ key: string, request: number } | null>(null);
  const [activeCell, setActiveCell] = useState<CellCoords | null>(null);
  const refRequests = useRef<number>(0);
  const refCards = useRef<Map<string, HTMLDivElement>>(new Map());

  useModelListener<IRangeSelection, IRangeSelection.IListeners>(sheet?.getSelection(), {
    onChange(): void {
      setActiveCell(sheet?.getSelectedCell().getCoords() ?? null);
    }
  });

  // A draft belongs to the sheet it was started on.
  const [draftSheet, setDraftSheet] = useState<IWorksheet | null>(sheet);
  if (draftSheet !== sheet) {
    setDraftSheet(sheet);
    setDraft(null);
    setFocus(null);
  }

  const keyOf = (coords: CellCoords): string => `${coords.rowIndex},${coords.colIndex}`;
  const takeCaret = (key: string): void => {
    setFocus({ key, request: ++refRequests.current });
  };

  /** A draft on the selected cell, or the caret in the thread it already has. A note's cell has neither. */
  const startOnSelectedCell = (): void => {
    if (!sheet) return;
    const cell = sheet.getSelectedCell();
    const coords = cell.getCoords();
    if (!coords) return;
    const existing = cell.getComments();
    if (existing?.isNote()) return;
    if (existing) {
      setShowAll(true);
      takeCaret(keyOf(getCommentCoords(existing)));
      return;
    }
    setDraft(coords);
    takeCaret(keyOf(coords));
  };

  // `args` is scoped to one activation, so react to it CHANGING, not to its presence.
  const [lastArgs, setLastArgs] = useState<CommentsPaneArgs | undefined>(undefined);
  if (args !== lastArgs) {
    setLastArgs(args);
    const focused = args?.focus;
    if (focused && !focused.isDeleted() && !focused.isNote()) {
      setShowAll(true);
      takeCaret(keyOf(getCommentCoords(focused)));
    } else if (args?.insert) {
      startOnSelectedCell();
    }
  }

  const listed = useMemo((): Listed[] => {
    const retValue: Listed[] = threads.map((comment: IComment): Listed => {
      const coords = getCommentCoords(comment);
      return { key: keyOf(coords), coords, comment };
    });
    if (draft && !allThreads.some((comment: IComment) => keyOf(getCommentCoords(comment)) === keyOf(draft))) {
      retValue.push({ key: keyOf(draft), coords: draft, comment: null });
      retValue.sort(compareListed);
    }
    return retValue;
  }, [threads, allThreads, draft]);

  const activeKey = activeCell ? keyOf(activeCell) : null;
  const focusKey = focus?.key ?? null;
  const focusRequest = focus?.request ?? 0;

  // The selected cell's card, and the one a command asked for, are brought into view.
  useEffect(() => {
    if (activeKey) refCards.current.get(activeKey)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeKey]);
  useEffect(() => {
    if (focusKey) refCards.current.get(focusKey)?.scrollIntoView?.({ block: 'nearest' });
  }, [focusKey, focusRequest]);

  // The host always supplies a workbook; the prop is optional on the generic pane contract.
  if (!workbook || !sheet) return null;

  const selectedComment = sheet.getSelectedCell().getComments();
  // Nothing to filter yet, so the empty state's own button stands in for the header.
  const empty = listed.length === 0 && allThreads.length === 0;

  return (
    <Box
      ref={ref as React.Ref<HTMLDivElement>}
      {...rest}
      className="sxl-comments-pane"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        // The pane host is a flex ROW, so a pane with no width shrink-wraps its widest control.
        width: '100%',
        minWidth: 0,
        flex: '1 1 auto',
        height: '100%',
        minHeight: 0,
        overflowX: 'hidden'
      }}
    >
      {empty ? null : <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: '0 0 auto', px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <ToggleButtonGroup
          className="sxl-comments-filter"
          size="small"
          exclusive
          value={filter}
          onChange={(_e: React.MouseEvent<HTMLElement>, next: CommentsFilter | null) => { if (!next) return; setShowAll(false); setPersistedFilter(next); }}
        >
          {FILTERS.map((each: CommentsFilter) => (
            <ToggleButton key={each} value={each} sx={{ textTransform: 'none', py: 0.25, px: 1 }}>
              {t(FILTER_MESSAGE_KEYS[each])}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Box sx={{ flex: '1 1 auto' }} />
        <SimpleTooltip disableInteractive title={t(MESSAGE_KEYS.add)}>
          <span>
            <IconButton
              className="sxl-comments-add"
              aria-label={t(MESSAGE_KEYS.add)}
              // A cell holds one comment: its thread takes the reply, and a note is not a thread.
              disabled={!!selectedComment?.isNote()}
              onClick={startOnSelectedCell}
            >
              <DynamicIcon iconKey="Insert" />
            </IconButton>
          </span>
        </SimpleTooltip>
      </Box>}

      <Box
        className="sxl-comments-list"
        sx={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, p: 1.5, pl: empty ? 1.5 : 3.5 }}
      >
        {empty ? (
          // The same empty state as the items panes (Conditional Formatting, Names, ...).
          <>
            <Box sx={{ flex: '1 1 0' }} />
            <Box
              className="sxl-comments-empty"
              sx={{
                display: 'flex',
                flex: '0 0 auto',
                flexDirection: 'column',
                alignItems: 'center',
                alignSelf: 'center',
                gap: 2.5,
                maxWidth: 'min(360px, 90%)'
              }}
            >
              <Typography variant="body2" align="center">
                {t(MESSAGE_KEYS.addPrompt)}
              </Typography>
              <Button
                variant="contained"
                sx={{ textTransform: 'none' }}
                disabled={!!selectedComment?.isNote()}
                onClick={startOnSelectedCell}
              >
                {t(MESSAGE_KEYS.add)}
              </Button>
            </Box>
            <Box sx={{ flex: '1.5 1 0' }} />
          </>
        ) : listed.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t(MESSAGE_KEYS.noMatches)}
          </Typography>
        ) : null}
        {listed.map((each: Listed) => (
          <CommentCard
            // A draft and the thread it becomes are one card: posting keeps its place and its state.
            key={each.key}
            ref={(element: HTMLDivElement | null) => {
              if (element) refCards.current.set(each.key, element);
              else refCards.current.delete(each.key);
            }}
            sheet={sheet}
            coords={each.coords}
            comment={each.comment}
            highlighted={each.key === activeKey}
            focusRequest={each.key === focusKey ? focusRequest : 0}
            // A comment's own range is anchored ($B$2); the selection is of plain cells.
            onSelect={() => { void sheet.getRange(CoordUtils.cellToRange(each.coords)!).select(); }}
            onClose={() => setDraft(null)}
            onPosted={() => setDraft(null)}
          />
        ))}
      </Box>
    </Box>
  );
});

CommentsTaskPane.displayName = 'CommentsTaskPane';

export default CommentsTaskPane;
