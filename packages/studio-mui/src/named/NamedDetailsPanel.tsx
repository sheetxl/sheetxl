import type React from 'react';
import { memo, forwardRef, useCallback, useEffect, useMemo, useState } from 'react';

import { Box, Button, Chip, Typography, type Theme } from '@mui/material';

import {
  type IWorkbook, type INamed, type INamedCollection, type ICellRanges, type INamedRange
} from '@sheetxl/sdk';

import { messageKey } from '@sheetxl/utils';
import { useTranslator, useNotifier, NotifierType } from '@sheetxl/utils-react';
import { SimpleTooltip } from '@sheetxl/utils-mui';

import { type ItemsPaneArgs } from '@sheetxl/react';

import {
  ItemsPanel, type ItemsDescriptor, type ItemsSubscriber,
  type ItemBodyProps, type ItemEditorProps
} from '../itemsPanel';

import {
  type NamedDraft, createNamedDraft, saveNamedDraft, expressionOf
} from './NamedDraft';
import { NamedEditorPanel } from './NamedEditorPanel';
import { NamedExpressionField } from './NamedExpressionField';
import { NamedKindChip, namedKindOf } from './NamedKindChip';

/**
 * How many cells and names read `item`, as the engine answers — a validation list, a conditional
 * format and a chart count, not only cell formulas. `null` for an item that cannot answer (a table)
 * and until it has.
 *
 * @remarks
 * Asked again whenever the workbook finishes calculating: a formula elsewhere that starts or stops
 * naming the item changes the answer without touching the item.
 */
const useReferenceCount = (item: INamed, workbook: IWorkbook): number | null => {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const named = item as { getDirectDependents?: () => Promise<ICellRanges | null> };
    if (typeof named.getDirectDependents !== 'function') return;
    let live = true;
    const ask = (): void => {
      named.getDirectDependents!().then((ranges: ICellRanges | null): void => {
        if (live) setCount(countReaders(ranges));
      }).catch(() => {});
    };
    ask();
    const remove = workbook.getCalculation().addListeners({ onComplete: ask }, { transactional: false });
    return () => {
      live = false;
      remove?.();
    };
  }, [item, workbook]);
  return count;
};

/** Excel's built-in names: `_xlnm.Print_Area`, `_xlnm.Print_Titles`, `_xlnm._FilterDatabase`. */
const _BuiltInName = /^_xlnm\./i;

/** Cells and names in a dependents answer: a name counts once, however many cells read it. */
const countReaders = (ranges: ICellRanges | null): number => {
  if (!ranges) return 0;
  const coords = ranges.getCoords();
  let readers = 0;
  for (let i=0; i<ranges.getCount(); i++) {
    if ((ranges.at(i) as INamedRange).isINamedRange) {
      readers++;
      continue;
    }
    const c = coords[i];
    readers += (c.rowEnd - c.rowStart + 1) * (c.colEnd - c.colStart + 1);
  }
  return readers;
};

/**
 * The card's detail line: the scope and whether the name is hidden, with how many cells and names
 * read it as a count at the right. The KIND (table, range, formula) is not repeated here — the chip
 * already says it.
 *
 * @remarks
 * No count where none would be honest: a table cannot answer, and a built-in name (a print area, an
 * autofilter's range) is read by the sheet itself, which no count of formulas describes.
 */
const NamedCardBody: React.FC<ItemBodyProps<INamed> & { workbook: IWorkbook }> = ({ item, workbook }) => {
  const t = useTranslator();
  const references = useReferenceCount(item, workbook);
  const scope = item.getScope();
  const comment = item.getComment();
  const counted = references !== null && !_BuiltInName.test(item.getName());
  const details: string[] = [
    scope ? t('named.scopedTo', { scope }) : t('named.scopeWorkbook')
  ];
  if (item.isHidden()) {
    details.push(t('named.hidden'));
  }
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography
          variant="caption"
          sx={{ flex: '1 1 auto', color: (theme: Theme) => theme.palette.text.secondary }}
        >
          {details.join(' · ')}
        </Typography>
        {counted ? (
          <SimpleTooltip disableInteractive title={t('named.references', { count: references })}>
            <Chip
              size="small"
              variant="outlined"
              label={references!.toLocaleString()}
              aria-label={t('named.references', { count: references })}
              // Nothing reads it: present, but quiet.
              sx={{ height: 20, color: references === 0 ? 'text.disabled' : undefined }}
            />
          </SimpleTooltip>
        ) : null}
      </Box>
      {comment ? (
        <Typography
          variant="caption"
          sx={{
            color: (theme: Theme) => theme.palette.text.secondary,
            fontStyle: 'italic',
          }}
        >
          {comment}
        </Typography>
      ) : null}
    </>
  );
};

/**
 * Binds defined names to the generic {@link ItemsPanel}.
 *
 * @remarks
 * Bound directly rather than through `AnchorItemsDescriptor`: a name has no anchor and no index,
 * and its collection aggregates registries that own their items — so there is no per-sheet
 * collection to read, and no temporary item to edit. See {@link NamedDraft}.
 */
const createNamedItemsDescriptor = (
  workbook: IWorkbook
): ItemsDescriptor<INamed, NamedDraft> => ({
  key: 'named',
  // `duplicate`/`moveUp`/`moveDown` are absent — names are unordered and a copy of a name is
  // just another name, so neither affordance is offered below.
  messageKeys: {
    none: messageKey('named.none'),
    addPrompt: messageKey('named.addPrompt'),
    heading: messageKey('named.heading'),
    insert: messageKey('named.insert'),
    new: messageKey('named.new'),
    edit: messageKey('named.edit'),
    delete: messageKey('named.delete'),
    cancel: messageKey('named.cancel'),
    save: messageKey('named.save'),
    search: messageKey('named.search'),
    clearSearch: messageKey('named.clearSearch'),
    noMatches: messageKey('named.noMatches')
  },

  /* The WORKBOOK's collection — every scope, which is what a name manager lists. (A sheet's would
     hide other sheets' scoped names and resolve shadowing, both wrong here.) A scope filter
     (global / sheet / selection, as Excel has) goes in the panel header and narrows this.

     Hidden names are not listed, as in Excel: a legacy model carries them by the ten thousand, and
     what a user does with those is remove them (the panel's footer), not read them one by one. */
  getItems: (workbook: IWorkbook) => workbook.getNames().getItems(),

  subscribe: (workbook: IWorkbook, subscriber: ItemsSubscriber): () => void => {
    const listeners: INamedCollection.IListeners = {
      onCollectionChange: () => subscriber.onChange(),
      /* Both channels: an undo of a table rename moves nothing the collection holds (its name is
         read off the table), so it arrives only as a restore. */
      onInvalidated: () => subscriber.onChange()
    };
    const removeNames = workbook.getNames().addListeners(listeners, { transactional: false });
    const removeWorkbook = workbook.addListeners({
      // Sheets carry scopes, so adding/removing/renaming one changes what the rows say.
      onSheetsChange: () => subscriber.onChange(),
      onProtectionChange: () => subscriber.onChange()
    }, { transactional: false });
    return () => {
      removeNames?.();
      removeWorkbook?.();
    };
  },

  isReadOnly: (workbook: IWorkbook) => !workbook.getProtection().isStructureAllowed(),
  isItemReadOnly: (item: INamed, workbook: IWorkbook) => {
    if (!workbook.getProtection().isStructureAllowed()) return true;
    // A derived name (a table's) is listed but not editable here — see `isEditableNamed`.
    return namedKindOf(item) === 'table' || item.isReadOnly();
  },
  getItemKey: (item: INamed) => item.getId(),
  subscribeItem: (item: INamed, onChange: () => void) => item.addListeners({
    onAnyChange: () => onChange(),
    onInvalidated: () => onChange()
  }, { transactional: false }),

  createDraft: createNamedDraft,
  save: saveNamedDraft,
  delete: (item: INamed) => { item.delete?.(); },
  /* No `duplicate` (a copy of a name is just another name) and no `moveBy` — names are unordered;
     the collection sorts them by type then name. */

  // A range or a table has cells to go to. A formula name has none, and `select` on one is already
  // a no-op — it selects the name's ranges, and there are none — so nothing here guards on kind.
  // Selection is async (it may switch sheets); a failure is not the user's doing, so the click
  // simply does nothing.
  select: (item: INamed) => {
    Promise.resolve(item.select()).catch(() => {});
  },

  // Everything a name is remembered by: what it is called, what it points at, where, and why.
  getSearchText: (item: INamed, t) => [
    item.getName(),
    expressionOf(item),
    item.getScope() ?? t('named.scopeWorkbook'),
    item.getComment() ?? ''
  ].join('\n'),

  getCardTitle: (item: INamed) => item.getName(),
  /* The kind glyph leads the card, where a conditional format shows its preview — a table, a
     range or a formula is the first thing a reader wants to know about a name. */
  CardMedia: ({ item }: ItemBodyProps<INamed>) => (
    <NamedKindChip kind={namedKindOf(item)} size={32} />
  ),
  /* The expression is a field, not a caption: re-pointing a name is the edit users reach for
     most, and it needs none of the editor. A table's name shows its range, disabled. */
  CardSubtitle: ({ item }: ItemBodyProps<INamed>) => (
    <NamedExpressionField named={item} label={null} helperText={null} />
  ),
  CardBody: (props: ItemBodyProps<INamed>) => <NamedCardBody {...props} workbook={workbook} />,
  EditorBody: ({ draft, workbook }: ItemEditorProps<NamedDraft>) => (
    <NamedEditorPanel draft={draft} workbook={workbook} />
  )
});

export interface NamedDetailsPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  workbook: IWorkbook;
  /**
   * The task pane's activation argument. `insert` opens the pane on a new name and `edit` on an
   * existing one — how the name box's "Define Name…" and "Edit…" reach this editor rather than a
   * dialog of their own. Nothing is seeded from properties: a name has no preset to hand over.
   */
  args?: ItemsPaneArgs<never, INamed>;
}

/**
 * How many hidden names nothing reads, and the action that removes them — asked again whenever the
 * names change or the workbook finishes calculating (a formula that starts or stops naming one
 * changes the answer). `0` while the workbook's structure is protected: there is nothing to offer.
 */
const useUnusedHidden = (workbook: IWorkbook): { count: number; remove: () => Promise<void> } => {
  const [count, setCount] = useState<number>(0);
  const [nonce, setNonce] = useState<number>(0);
  useEffect(() => {
    const bump = (): void => setNonce((n: number) => n + 1);
    const removeNames = workbook.getNames().addListeners({
      onCollectionChange: bump,
      onInvalidated: bump
    }, { transactional: false });
    const removeCalculation = workbook.getCalculation().addListeners({ onComplete: bump }, { transactional: false });
    return () => {
      removeNames?.();
      removeCalculation?.();
    };
  }, [workbook]);
  useEffect(() => {
    if (!workbook.getProtection().isStructureAllowed()) {
      setCount(0);
      return;
    }
    let live = true;
    workbook.getNames().removeUnused({ hiddenOnly: true, dryRun: true })
      .then((found: number): void => { if (live) setCount(found); })
      .catch(() => {});
    return () => { live = false; };
  }, [workbook, nonce]);
  const remove = useCallback(async (): Promise<void> => {
    await workbook.getNames().removeUnused({ hiddenOnly: true });
  }, [workbook]);
  return { count, remove };
};

/**
 * The managed-names task pane: every visible defined name in the workbook — across all scopes and
 * of every type — with add/edit/delete and search, and the removal of hidden names nothing reads.
 */
export const NamedDetailsPanel =
  memo(forwardRef<HTMLDivElement, NamedDetailsPanelProps>((props, refForwarded) => {
  const {
    workbook,
    args,
    ...rest
  } = props;

  const t = useTranslator();
  const notifier = useNotifier();
  const unusedHidden = useUnusedHidden(workbook);

  const descriptor = useMemo(() => createNamedItemsDescriptor(workbook), [workbook]);

  // Only when there is something to remove: on most workbooks there is not, and an always-present
  // button that does nothing would teach the user to ignore it.
  const footer = useMemo(() => unusedHidden.count === 0 ? null : (
    <Button
      size="small"
      sx={{ textTransform: 'none', width: '100%' }}
      onClick={() => {
        unusedHidden.remove().catch((error: any) => {
          notifier.showMessage?.(error.message, { type: NotifierType.Error });
        });
      }}
    >
      {t('named.removeUnusedHidden', { count: unusedHidden.count })}
    </Button>
  ), [unusedHidden, notifier, t]);

  return (
    <ItemsPanel
      ref={refForwarded}
      workbook={workbook}
      descriptor={descriptor}
      args={args}
      footer={footer}
      {...rest}
    />
  );
}));

NamedDetailsPanel.displayName = 'NamedDetailsPanel';
