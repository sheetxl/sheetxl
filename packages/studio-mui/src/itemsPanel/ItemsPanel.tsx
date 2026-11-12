import type React from 'react';
import {
  useRef, useState, memo, forwardRef, useReducer, useMemo, useEffect, useCallback
} from 'react';

import clsx from 'clsx';
import { useMergeRefs } from 'react-merge-refs';

import { type Theme } from '@mui/material';
import { IconButton, Box, Button, Typography } from '@mui/material';

import { type IWorkbook } from '@sheetxl/sdk';

import { type ItemsPaneArgs } from '@sheetxl/react';

import {
  DynamicIcon, useTranslator, useNotifier, NotifierType, type IReactNotifier
} from '@sheetxl/utils-react';

import { SimpleTooltip } from '@sheetxl/utils-mui';

import { type ItemsDescriptor } from './ItemsDescriptor';
import { ItemCard } from './ItemCard';
import { ItemsSearchField } from './ItemsSearchField';
import { EditorPanel } from './EditorPanel';
import { SortableCards, SortableCard, useReorderFlip } from './SortableCards';

import styles from './Items.module.css';

export interface ItemsPanelProps<T=any, D=T> extends React.HTMLAttributes<HTMLDivElement> {
  workbook: IWorkbook;
  descriptor: ItemsDescriptor<T, D>;
  /**
   * The task pane's activation argument. A `draft` in it opens the panel editing a new item seeded
   * from it (via {@link ItemsDescriptor.createSeededDraft}) instead of on the list; an `insert`
   * opens the same editor on an unseeded one.
   *
   * @remarks
   * One activation's worth, so it is consumed on ARRIVAL, not on presence: the panel acts when the
   * value changes identity and never again, or every re-render would reopen the editor.
   */
  args?: ItemsPaneArgs;
  /**
   * Rendered in the list header, left of the insert button — filters, view toggles.
   *
   * @remarks
   * A prop rather than part of the descriptor: these controls own view state that also feeds
   * `descriptor.getItems`, so the feature panel holds both and rebuilds the descriptor.
   */
  headerActions?: React.ReactNode;
  /**
   * Rendered right-aligned under the search field — view toggles that qualify what the list shows
   * (a hidden-items switch) and should read as secondary to it, not as a peer of the heading.
   *
   * @remarks
   * Kept reachable when the list is empty, for the same reason as {@link headerActions}: an empty
   * list is a state these controls can produce.
   */
  listActions?: React.ReactNode;
  /**
   * Rendered under the list, in every state including an empty one — an action on the collection
   * as a whole rather than on any card (a cleanup of what the list does not show).
   */
  footer?: React.ReactNode;
  /**
   * Enables drag reordering of the cards, and animates every reorder — dropped drags and the
   * move up/down buttons alike.
   *
   * Only meaningful for an ordered list: without {@link ItemsDescriptor.moveBy} (or when the list
   * is read-only) the flag is inert.
   *
   * @defaultValue false
   */
  dragReorder?: boolean;
}

/* The list pads itself by this (theme spacing units) so a card's focus outline is not clipped.
   The header controls above it inset by the same amount to line up with the cards. */
const LIST_INSET = 0.5;

/* Stable identity keys so list order changes (reorder, DnD later) animate correctly. */
let _nextItemKey: number = 0;
const _itemKeys = new WeakMap<object, string>();
const itemKey = (item: object): string => {
  let key = _itemKeys.get(item);
  if (key === undefined) {
    key = `item-${_nextItemKey++}`;
    _itemKeys.set(item, key);
  }
  return key;
};

interface EditingState<T, D> {
  draft: D;
  /** The item being edited, or `null` when adding. */
  target: T | null;
}

/**
 * Generic task-pane panel for a listable collection: a card list with add/edit/delete (and
 * optionally duplicate/reorder), plus an in-place editor over a draft with save/cancel.
 *
 * Everything feature-specific — where items come from, what a draft is, how a save is committed,
 * the card and editor content — comes from an {@link ItemsDescriptor}.
 */
export const ItemsPanel =
  memo(forwardRef<HTMLDivElement, ItemsPanelProps<any, any>>((props, refForwarded) => {

  const {
    title: propTitle,
    workbook,
    descriptor,
    args,
    headerActions,
    listActions,
    footer,
    dragReorder = false,
    className: propClassName,
    ...rest
  } = props;

  const t = useTranslator();
  const notifier: IReactNotifier = useNotifier();
  const messageKeys = descriptor.messageKeys;

  /* An authorable list supplies `createDraft`, `save`, `EditorBody` and the editor's own strings
     as a SET (see `ItemsDescriptor.createDraft`). Reading them through one gate is what keeps an
     unauthorable list — external links, which are made by typing a formula and never edited —
     from reaching the editor at all, rather than each site testing a different member. */
  const authoring = useMemo(() => {
    const { createDraft, save, EditorBody } = descriptor;
    if (!createDraft || !save || !EditorBody) return null;
    if (!messageKeys.cancel || !messageKeys.save) return null;
    return {
      createDraft,
      commit: save,
      EditorBody,
      keys: { cancel: messageKeys.cancel, save: messageKeys.save }
    };
  }, [descriptor, messageKeys]);

  const [hasFocus, setHasFocus] = useState<boolean>(false);
  const [editing, setEditing] = useState<EditingState<any, any> | null>(null);
  /* The search text. View state like the header's toggles, but generic — every list is searched
     the same way, so it lives here rather than in each feature panel. */
  const [query, setQuery] = useState<string>('');

  const refLocal = useRef<HTMLDivElement>(null);
  const refList = useRef<HTMLDivElement>(null);
  const [renderNonce, forceRender] = useReducer((s:number) => s + 1, 0);

  useEffect(() => {
    return descriptor.subscribe(workbook, {
      onChange: () => forceRender(),
      onInvalidated: () => {
        setEditing(null);
        forceRender();
      }
    });
  }, [workbook, descriptor]);

  /* An arriving `args` is an EVENT, not state: the ref marks the value consumed so a re-render (or
     a workbook swap, which re-runs this effect) cannot reopen the editor on a seed already spent.
     Starting `undefined` also makes the no-args mount — every pane opened from the ribbon — a
     single equality check that does nothing. */
  const refSeededArgs = useRef<ItemsPaneArgs | undefined>(undefined);
  useEffect(() => {
    if (refSeededArgs.current === args) return;
    refSeededArgs.current = args;
    const seed = args?.draft;
    try {
      let draft: any = null;
      let target: any = null;
      if (seed !== undefined) {
        // A seed is a new item too, refused wherever `insert` is.
        if (!descriptor.isReadOnly(workbook)) draft = descriptor.createSeededDraft?.(workbook, seed) ?? null;
      } else if (args?.insert && authoring && !descriptor.isReadOnly(workbook)) {
        // `insert` asks for the add button, from a command — so it mints what the add button does,
        // and is refused where the add button is not offered at all.
        draft = authoring.createDraft(workbook);
      } else if (args?.edit !== undefined && authoring && !descriptor.isReadOnly(workbook)) {
        // `edit` asks for a card's edit action, from a command that holds the item.
        target = args.edit;
        draft = authoring.createDraft(workbook, target);
      }
      if (draft) setEditing({ draft, target });
    } catch (error: any) {
      notifier.showMessage?.(error.message, { type: NotifierType.Error });
    }
  }, [args, workbook, descriptor, authoring, notifier]);

  /* An open edit belongs to the workbook it was drafted from — the draft, and the target it would
     save through, are that workbook's objects. The studio can swap the workbook under a mounted
     pane (opening a file), which leaves the editor bound to a document that is being closed, so the
     edit is dropped back to the list rather than carried across. Render-time, not an effect: the
     draft must not reach the editor for even one frame. */
  const refEditingWorkbook = useRef<IWorkbook>(workbook);
  if (refEditingWorkbook.current !== workbook) {
    refEditingWorkbook.current = workbook;
    if (editing !== null) setEditing(null);
  }

  const isReadOnly = descriptor.isReadOnly(workbook);
  /* Two different denials: a read-only list offers no action at all, an unauthorable one offers
     every action except making and editing an item. */
  const canAdd = !isReadOnly && authoring !== null;
  const dragEnabled = dragReorder && !isReadOnly && !!descriptor.moveBy;

  /* Button (and add/delete) reorders animate through useReorderFlip; a DROP's layout change is
     dnd-kit's to animate, so the flag hands that one change over. */
  const refSkipFlip = useRef<boolean>(false);
  useReorderFlip(refList, dragEnabled, refSkipFlip);

  const handleDragMove = useCallback((indexFrom: number, indexTo: number) => {
    // Re-read rather than closing over the memoized array — a drop after any other change must
    // move the item the user actually dragged.
    const item = descriptor.getItems(workbook)[indexFrom];
    if (item === undefined) return;
    refSkipFlip.current = true;
    try {
      descriptor.moveBy!(item, indexTo - indexFrom, workbook);
    } catch (error: any) {
      refSkipFlip.current = false;
      notifier.showMessage?.(error.message, { type: NotifierType.Error });
    }
  }, [descriptor, workbook, notifier]);

  const handleSave = useCallback(async () => {
    if (!editing || !authoring) return;
    try {
      // Give the editor a chance to land anything it could not write synchronously (a hashed
      // password, say) — `save` reads the draft, not the editor.
      await descriptor.beforeSave?.(editing.draft);
      const problem = descriptor.validate?.(editing.draft) ?? null;
      if (problem) {
        notifier.showMessage?.(t(problem), { type: NotifierType.Error });
        return;
      }
      await authoring.commit(workbook, editing.draft, editing.target);
    } catch (error: any) {
      // Left open on failure so the edit is not lost — a rejected name is the common case.
      notifier.showMessage?.(error.message, { type: NotifierType.Error });
      return;
    }
    setEditing(null);
  }, [editing, descriptor, authoring, workbook, notifier, t]);

  const elements = useMemo(() => {
    const allItems = descriptor.getItems(workbook);
    const searchable = !!descriptor.getSearchText;
    const needle = searchable ? query.trim().toLowerCase() : '';
    const asArray = needle
      ? allItems.filter((item: any) => descriptor.getSearchText!(item, t).toLowerCase().includes(needle))
      : allItems;
    /* Cards keep their move buttons while filtered (a move is relative to the real order), but a
       drag is not offered: dropping onto a neighbor the filter hid would move the item somewhere
       the user cannot see. */
    const dragActive = dragEnabled && !needle;

    const retValue: React.ReactNode[] = [];
    if (allItems.length === 0) {
      retValue.push(<Box key="spacer-top" sx={{ flex: '1 1 0' }} />);
      retValue.push(
        <Box
          key="no-items"
          sx={{
            display: 'flex',
            flex: '0 0 auto',
            flexDirection: 'column',
            alignItems: 'center',
            alignSelf: 'center',
            gap: (theme: Theme) => theme.spacing(2.5),
            maxWidth: 'min(360px, 90%)',
          }}
        >
          <Typography
            variant="body2"
            align="center"
          >
            {canAdd && messageKeys.addPrompt
              ? t(messageKeys.addPrompt)
              : t(messageKeys.none)}
          </Typography>
          {canAdd && messageKeys.new && (
            <Button
              variant="contained"
              sx={{
                textTransform: 'none',
              }}
              onClick={() => {
                setEditing({ draft: authoring!.createDraft(workbook), target: null });
              }}
            >
              {t(messageKeys.new)}
            </Button>
          )}
        </Box>
      );
      retValue.push(<Box key="spacer-bottom" sx={{ flex: '1.5 1 0' }} />);
      /* The header carries the view controls (the hidden toggle, later the scope filter). An empty
         list is a state those controls can produce, so they have to stay reachable to undo it. */
      if (headerActions || listActions) {
        retValue.unshift(
          <Box
            key="header-actions"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              flex: '0 0 auto',
            }}
          >
            {headerActions}
            {listActions}
          </Box>
        );
      }
      return retValue;
    }

    retValue.push(
      <Box
        key="add-new"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Box
          sx={{
            flex: '1 1 100%',
            // padding: (theme: Theme) => theme.spacing(1),
          }}
        >
          {messageKeys.heading ? (
            <Typography
              variant="body2"
            >
              {t(messageKeys.heading)}
            </Typography>
          ) : null}
        </Box>
        {headerActions}
        {canAdd && messageKeys.insert && (
        <SimpleTooltip
          disableInteractive
          title={t(messageKeys.insert)}
          key="add-new"
        >
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              setEditing({ draft: authoring!.createDraft(workbook), target: null });
            }}
          >
            <DynamicIcon iconKey="Insert" />
          </IconButton>
        </SimpleTooltip>
        )}
        {/* TODO - add removeAll to Collection for a 'delete all' affordance */}
      </Box>
    );

    if (searchable) {
      retValue.push(
        <ItemsSearchField
          key="search"
          value={query}
          onChange={setQuery}
          placeholder={messageKeys.search ? t(messageKeys.search) : undefined}
          clearLabel={messageKeys.clearSearch ? t(messageKeys.clearSearch) : undefined}
          // Inset to the cards' own edge — the list pads for its focus outline, so a field flush
          // with the panel reads as wider than what it filters. The column's stretch does the
          // sizing, not `fullWidth`: a width of 100% plus side margins overhangs the column, so
          // the field would be shifted right rather than inset on both edges.
          sx={{ flexShrink: 0, mx: LIST_INSET }}
        />
      );
    }

    if (listActions) {
      retValue.push(
        <Box
          key="list-actions"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flex: '0 0 auto',
            mx: LIST_INSET,
            // Tucked under the field it qualifies rather than spaced as a row of its own.
            mt: -0.5
          }}
        >
          {listActions}
        </Box>
      );
    }

    if (asArray.length === 0) {
      // Every item hidden by the query. The field stays where it is, so the query can be changed.
      retValue.push(<Box key="spacer-top" sx={{ flex: '1 1 0' }} />);
      retValue.push(
        <Typography
          key="no-matches"
          variant="body2"
          align="center"
          sx={{ color: 'text.secondary', alignSelf: 'center', maxWidth: 'min(360px, 90%)' }}
        >
          {messageKeys.noMatches ? t(messageKeys.noMatches) : null}
        </Typography>
      );
      retValue.push(<Box key="spacer-bottom" sx={{ flex: '1.5 1 0' }} />);
      return retValue;
    }

    const ids: string[] = asArray.map((item: any) => descriptor.getItemKey?.(item) ?? itemKey(item));
    const list: React.ReactNode[] = [];
    asArray.forEach((item: any, index: number) => {
      const itemReadOnly = descriptor.isItemReadOnly?.(item, workbook) ?? isReadOnly;
      // Position in the REAL order — a move is relative to that, not to what the filter shows.
      const fullIndex = needle ? allItems.indexOf(item) : index;
      const card = (
        <ItemCard
          key={ids[index]}
          item={item}
          messageKeys={messageKeys}
          title={descriptor.getCardTitle(item, t)}
          subtitle={descriptor.getCardSubtitle?.(item, t)}
          Subtitle={descriptor.CardSubtitle}
          readOnly={itemReadOnly}
          canMoveUp={fullIndex > 0}
          canMoveDown={fullIndex < allItems.length - 1}
          onMoveBy={descriptor.moveBy
            ? (delta: number) => descriptor.moveBy!(item, delta, workbook)
            : undefined}
          onDuplicate={descriptor.duplicate
            ? () => {
                try {
                  descriptor.duplicate!(item, workbook);
                } catch (error: any) {
                  notifier.showMessage?.(error.message, { type: NotifierType.Error });
                }
              }
            : undefined}
          onDelete={() => {
            try {
              descriptor.delete(item, workbook);
            } catch (error: any) {
              notifier.showMessage?.(error.message, { type: NotifierType.Error });
            }
          }}
          onEdit={authoring
            ? () => setEditing({ draft: authoring.createDraft(workbook, item), target: item })
            : undefined}
          onSelect={descriptor.select
            ? () => {
                try {
                  descriptor.select!(item, workbook);
                } catch (error: any) {
                  notifier.showMessage?.(error.message, { type: NotifierType.Error });
                }
              }
            : undefined}
          subscribeItem={descriptor.subscribeItem}
          Media={descriptor.CardMedia}
          Body={descriptor.CardBody}
        />
      );
      list.push(dragActive ? (
        <SortableCard
          key={ids[index]}
          id={ids[index]}
          disabled={itemReadOnly}
        >
          {card}
        </SortableCard>
      ) : card);
    });

    const listContainer = (
      <Box
        key="list-container"
        ref={refList}
        sx={{
          display: 'flex',
          flex: '1 1 auto',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'visible',
          // required for outline
          paddingLeft: (theme: Theme) => theme.spacing(LIST_INSET),
          paddingRight: (theme: Theme) => theme.spacing(LIST_INSET),
          paddingTop: (theme: Theme) => theme.spacing(LIST_INSET),
          paddingBottom: (theme: Theme) => theme.spacing(LIST_INSET),
          gap: (theme: Theme) => theme.spacing(1.5),
        }}
      >
        {list}
      </Box>
    );

    retValue.push(dragActive ? (
      <SortableCards
        key="list-container"
        ids={ids}
        onMove={handleDragMove}
        scrollRef={refList}
      >
        {listContainer}
      </SortableCards>
    ) : listContainer);

    return retValue;
  }, [renderNonce, t, isReadOnly, canAdd, authoring, workbook, descriptor, headerActions, listActions, notifier, dragEnabled, handleDragMove, query]);

  const className = useMemo(() => {
    return clsx('sxl-items-details', 'sxl-anchor-items-details', `sxl-${descriptor.key}-details`, propClassName, {
      ['editing']: editing !== null,
      ['sxl-has-focus']: hasFocus,
      ['sxl-read-only']: isReadOnly
    }, styles['details-panel'])
  }, [propClassName, hasFocus, isReadOnly, editing, descriptor]);

  // Render editor when in edit mode
  const refMerged = useMergeRefs([refLocal, refForwarded]);
  if (editing !== null && authoring) {
    const EditorBody = authoring.EditorBody;
    return (
      <Box
        onFocus={() => setHasFocus(true)}
        onBlur={(e: React.FocusEvent<Element>) => {
          if (!((refLocal?.current?.contains(e.relatedTarget)))) {
            setHasFocus(false);
          }
        }}
        ref={refMerged as React.RefObject<HTMLDivElement>}
        sx={{
          paddingLeft: (theme: Theme) => theme.spacing(1.5),
          paddingRight: (theme: Theme) => theme.spacing(1.5),
          paddingTop: (theme: Theme) => theme.spacing(1.5),
          paddingBottom: (theme: Theme) => theme.spacing(1.5)
        }}
        className={className}
        {...rest}
      >
        <EditorPanel
          messageKeys={authoring.keys}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        >
          <EditorBody draft={editing.draft} workbook={workbook} />
        </EditorPanel>
      </Box>
    );
  }

  return (
    <Box
      onFocus={() => setHasFocus(true)}
      onBlur={(e: React.FocusEvent<Element>) => {
        if (!((refLocal?.current?.contains(e.relatedTarget)))) {
          setHasFocus(false);
        }
      }}
      ref={refMerged as React.RefObject<HTMLDivElement>}
      sx={{
        gap: (theme: Theme) => theme.spacing(1),
        paddingLeft: (theme: Theme) => theme.spacing(1.5),
        paddingRight: (theme: Theme) => theme.spacing(1.5),
        paddingTop: (theme: Theme) => theme.spacing(1.5),
        paddingBottom: (theme: Theme) => theme.spacing(1.5)
      }}
      className={className}
      {...rest}
    >
      {elements}
      {/* Edge to edge: the panel's own padding is given back, so the divider spans the pane. */}
      {footer ? (
        <Box
          sx={{
            flex: '0 0 auto',
            mx: -1.5,
            mb: -1.5,
            px: 1.5,
            py: 0.5,
            borderTop: 1,
            borderColor: 'divider'
          }}
        >
          {footer}
        </Box>
      ) : null}
    </Box>
  );
}));

ItemsPanel.displayName = 'ItemsPanel';
