import type React from 'react';
import { memo, forwardRef, useMemo } from 'react';

import { Box, Button } from '@mui/material';

import {
  type ICalculation, type IExternalBook, type IExternalBookCollection, type IWorkbook,
  externalBookFileName
} from '@sheetxl/sdk';

import { messageKey } from '@sheetxl/utils';
import { useNotifier, useTranslator, NotifierType } from '@sheetxl/utils-react';

import {
  ItemsPanel, type ItemsDescriptor, type ItemsSubscriber, type ItemBodyProps
} from '../itemsPanel';

import { ExternalLinkCardBody } from './ExternalLinkCardBody';
import { ExternalLinkChip } from './ExternalLinkChip';
import { ExternalLinkLocation } from './ExternalLinkLocation';

const createExternalLinkDescriptor = (): ItemsDescriptor<IExternalBook> => ({
  key: 'external-link',
  /* No authoring members (`createDraft` / `save` / `EditorBody`) and none of their strings: a link
     is made by TYPING a formula that cites a book, and the book itself is an immutable snapshot —
     so this list is acted on, never authored. See `ItemsDescriptor.createDraft`. */
  messageKeys: {
    none: messageKey('externalLink.none'),
    delete: messageKey('externalLink.breakLink'),
    search: messageKey('externalLink.search'),
    clearSearch: messageKey('externalLink.clearSearch'),
    noMatches: messageKey('externalLink.noMatches')
  },

  /* The MODELED books. A DDE/OLE slot has no source, no cache and no dependents — there is
     nothing for a row to say about one — so it is left out, and the `[n]` each row carries is
     what keeps the numbering honest across a slot that is not listed. */
  getItems: (workbook: IWorkbook) => workbook.getExternalBooks().getItems(),

  subscribe: (workbook: IWorkbook, subscriber: ItemsSubscriber): () => void => {
    const books: IExternalBookCollection.IListeners = {
      onCollectionChange: () => subscriber.onChange()
    };
    const removeBooks = workbook.getExternalBooks().addListeners(books, { transactional: false });
    /* The dependent COUNT is derived from the compiled formulas, so it turns over on a
       calculation pass rather than on anything the collection emits. */
    const calculation: ICalculation.IListeners = {
      onComplete: () => subscriber.onChange()
    };
    const removeCalculation =
      workbook.getCalculation().addListeners(calculation, { transactional: false });
    const removeWorkbook = workbook.addListeners({
      onProtectionChange: () => subscriber.onChange()
    }, { transactional: false });
    return () => {
      removeBooks?.();
      removeCalculation?.();
      removeWorkbook?.();
    };
  },

  /* Breaking a link rewrites cells across the workbook and drops a slot every later `[n]` is
     numbered against, so it is structure, not content. */
  isReadOnly: (workbook: IWorkbook) => !workbook.getProtection().isStructureAllowed(),
  getItemKey: (item: IExternalBook) => item.getId(),

  /** Excel's Break Link: every citing formula becomes its values, then the slot goes. One undo. */
  delete: (item: IExternalBook, workbook: IWorkbook) => {
    item.breakLink();
  },

  /* No `select`: nothing on the grid IS a link. The row's real actions — Open Source, Change
     Source, Refresh — all need a resolver and arrive with phase E, and until then the only thing
     a click could do is hunt for the formulas that cite the book, which is a different question
     from the one this list answers. */

  // Everything a link is remembered by: the file, the folder it was found in, and its sheets.
  getSearchText: (item: IExternalBook) => [
    externalBookFileName(item),
    item.getDisplayName(),
    ...item.getSheetNames(),
    ...item.getSources().map((source: IExternalBook.SourceEntry) => source.target)
  ].join('\n'),

  CardMedia: () => (<ExternalLinkChip size={32} />),
  /* The file name, which is what a link is recognized by. NOT the `[n]`: that is the book's
     position in the persisted list, it renumbers when another link is broken, and nothing else
     the user can see spells it — a formula images its path (`externalBookClosedName`). */
  getCardTitle: (item: IExternalBook) => externalBookFileName(item),
  /* WHERE the file is — the one fact a links pane exists to answer. Not `getDisplayName()`, which
     is a formula SPELLING of the book's own recorded path: a book recording a relative path spells
     as `[Book.xlsx]`, which only repeats the title (design doc §2.2's `alternateUrls` shape, where
     the absolute companion is the entry that locates the file). */
  CardSubtitle: ExternalLinkLocation,
  CardBody: (props: ItemBodyProps<IExternalBook>) => (
    <ExternalLinkCardBody {...props} />
  )
});

export interface ExternalLinksPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  workbook: IWorkbook;
}

/**
 * The **Links** tab: every workbook this one links to, what of each is cached, and how many
 * formulas cite it — with Break link per row, and Refresh all and Break all above them.
 */
export const ExternalLinksPanel =
  memo(forwardRef<HTMLDivElement, ExternalLinksPanelProps>((props, refForwarded) => {
  const {
    workbook,
    ...rest
  } = props;

  const t = useTranslator();
  const notifier = useNotifier();

  const descriptor = useMemo(() => createExternalLinkDescriptor(), []);

  const isReadOnly = !workbook.getProtection().isStructureAllowed();
  const hasBooks = workbook.getExternalBooks().getCount() > 0;

  /* Beside the heading rather than under the search field: both act on the whole list, not on
     what a query narrowed it to. Break all is one undoable step, so it asks for no confirmation.
     Refresh all is Excel's, enabled as Excel enables it; until a host installs a resolver every
     book answers 'unavailable', and the message says so rather than the button hiding. */
  const headerActions = useMemo(() => {
    const buttonSx = { flex: '0 0 auto', textTransform: 'none', whiteSpace: 'nowrap' };
    return (
      <Box sx={{ display: 'flex', gap: 0.5, flex: '0 0 auto' }}>
        <Button
          size="small"
          disabled={isReadOnly || !hasBooks}
          sx={buttonSx}
          onClick={() => {
            void workbook.getExternalBooks().refreshAll().then((results) => {
              const counts = { refreshed: 0, failed: 0, unavailable: 0 };
              for (const result of results) counts[result.status]++;
              if (counts.refreshed === 0 && counts.failed === 0) {
                notifier.showMessage?.(t('externalLink.refreshUnavailable'), { type: NotifierType.Warning });
              } else {
                notifier.showMessage?.(t('externalLink.refreshSummary', counts), { type: counts.failed ? NotifierType.Warning : NotifierType.Info });
              }
            }, (error: any) => {
              notifier.showMessage?.(error.message, { type: NotifierType.Error });
            });
          }}
        >
          {t('externalLink.refreshAll')}
        </Button>
        <Button
          size="small"
          disabled={isReadOnly || !hasBooks}
          sx={buttonSx}
          onClick={() => {
            try {
              workbook.getExternalBooks().breakAll();
            } catch (error: any) {
              notifier.showMessage?.(error.message, { type: NotifierType.Error });
            }
          }}
        >
          {t('externalLink.breakAll')}
        </Button>
      </Box>
    );
  }, [workbook, isReadOnly, hasBooks, notifier, t]);

  return (
    <ItemsPanel
      ref={refForwarded}
      workbook={workbook}
      descriptor={descriptor}
      headerActions={headerActions}
      {...rest}
    />
  );
}));

ExternalLinksPanel.displayName = 'ExternalLinksPanel';
