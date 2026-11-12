import type React from 'react';
import { memo, forwardRef, useMemo } from 'react';

import { type IWorkbook, type IWorksheet, type IAnchored } from '@sheetxl/sdk';

import { type ItemsPaneArgs } from '@sheetxl/react';

import {
  ItemsPanel, type ItemsDescriptor, type ItemsSubscriber, type ItemEditorProps
} from '../itemsPanel';

import {
  type AnchorItem, type AnchorItemsDescriptor
} from './AnchorItemsDescriptor';

export interface AnchorItemsPanelProps<T extends AnchorItem=AnchorItem> extends React.HTMLAttributes<HTMLDivElement> {
  workbook: IWorkbook;
  descriptor: AnchorItemsDescriptor<T>;
  /**
   * The task pane's activation argument, forwarded to the generic panel — see
   * `ItemsPanelProps.args`.
   */
  args?: ItemsPaneArgs;
  /**
   * Enables drag reordering of the cards and animates every reorder (drag or the move up/down
   * buttons). Inert when the descriptor is not `reorderable`.
   *
   * @defaultValue false
   */
  dragReorder?: boolean;
}

/**
 * Adapts an {@link AnchorItemsDescriptor} — a per-sheet collection of anchored items with a
 * `createItem` draft — onto the model-agnostic {@link ItemsDescriptor}.
 *
 * @remarks
 * The anchored shape is one way to back a list, not the only one: defined names are aggregated
 * from registries that own them, have no index and no anchor, and bind to `ItemsDescriptor`
 * directly. This adapter is what keeps that generalization from reaching the three anchored
 * features (data validations, conditional formats, protected ranges).
 *
 * @internal Exported for tests.
 */
export const toItemsDescriptor = <T extends AnchorItem>(
  descriptor: AnchorItemsDescriptor<T>
): ItemsDescriptor<T, T> => {
  // The selected worksheet's items, or none while the active tab is another kind of sheet.
  const collectionOf = (workbook: IWorkbook) => {
    const sheet = workbook.getSelectedWorksheet();
    return sheet ? descriptor.getCollection(sheet) : null;
  };
  // An edit is only offered on a worksheet (`isReadOnly`); this throws naming the tab otherwise.
  const editableCollectionOf = (workbook: IWorkbook) =>
    descriptor.getCollection(workbook.getWorksheet());

  return {
    key: descriptor.key,
    messageKeys: descriptor.messageKeys,

    getItems: (workbook: IWorkbook) => collectionOf(workbook)?.getItems() ?? [],

    subscribe: (workbook: IWorkbook, subscriber: ItemsSubscriber): () => void => {
      /* The collection belongs to the SELECTED sheet, so the sheet subscription is re-pointed
         whenever that changes — a listener left on the previous sheet reports on a list this
         panel is no longer showing. */
      let removeSheet: (() => void) | null = null;
      const wireSheet = (): void => {
        removeSheet?.();
        const listeners: IWorksheet.IListeners = {
          onProtectionChange: () => subscriber.onChange(),
          onInvalidated: () => subscriber.onInvalidated()
        };
        // handles reorder or add/remove
        for (const event of descriptor.changeEvents) {
          (listeners as any)[event] = () => subscriber.onChange();
        }
        removeSheet = workbook.getSelectedWorksheet()?.addListeners(listeners, { transactional: false }) ?? null;
      };
      wireSheet();

      const removeWorkbook = workbook.addListeners({
        onSelectedSheetChange: () => {
          wireSheet();
          subscriber.onChange();
        }
      }, { transactional: false });

      return () => {
        removeSheet?.();
        removeWorkbook?.();
      };
    },

    isReadOnly: (workbook: IWorkbook) => {
      const sheet = workbook.getSelectedWorksheet();
      if (!sheet) return true;
      return descriptor.isReadOnly?.(sheet) ?? !sheet.getProtection().isObjectsAllowed();
    },
    isItemReadOnly: (item: T, workbook: IWorkbook) => {
      const sheet = workbook.getSelectedWorksheet();
      if (!sheet) return true;
      const collectionReadOnly = descriptor.isReadOnly?.(sheet)
        ?? !sheet.getProtection().isObjectsAllowed();
      return collectionReadOnly || item.isProtected();
    },
    subscribeItem: (item: T, onChange: () => void) => {
      const listeners: IAnchored.IListeners = {
        onInvalidated: () => onChange(),
        onProtectedChange: () => onChange()
      };
      return item.addListeners(listeners, { transactional: false });
    },

    createDraft: (workbook: IWorkbook, template?: T) => {
      const draft = editableCollectionOf(workbook).createItem(template);
      if (!template) descriptor.applyNewDefaults?.(draft);
      return draft;
    },
    /* Minting is the collection's (a temporary item anchored to the selection, exactly what add
       gives); only writing the seed onto it is per-feature. A descriptor with no `applySeed` leaves
       this undefined, which is how the panel knows the feature does not take a seed at all. */
    createSeededDraft: descriptor.applySeed
      ? (workbook: IWorkbook, seed: any): T => {
          const draft = editableCollectionOf(workbook).createItem();
          descriptor.applyNewDefaults?.(draft);
          descriptor.applySeed!(draft, seed);
          return draft;
        }
      : undefined,
    beforeSave: descriptor.beforeSave,
    validate: descriptor.validate,
    save: (workbook: IWorkbook, draft: T, target: T | null): void => {
      if (target === null) {
        /* A new item goes first; `replaceExisting` lets the collection redefine the top item
           instead when it is the same one on the same ranges (Excel: re-applying a data bar to
           the selection swaps it). */
        editableCollectionOf(workbook).add(draft, { replaceExisting: true });
      } else {
        descriptor.applyUpdate(target, draft);
        /* The anchor is not part of any item's `update()` — it lives in the sheet's spatial index,
           not the item's properties — and a detached draft has no container to write through, so
           this is the only point at which a range edited in the editor reaches the real item. */
        const ranges = draft.getRanges();
        if (!ranges.isInvalid() && ranges.toString() !== target.getRanges().toString()) {
          target.setRanges(ranges);
        }
      }
    },

    delete: (item: T) => item.delete(),
    duplicate: (item: T, workbook: IWorkbook) => {
      const collection = editableCollectionOf(workbook);
      // The copy lands beside its source rather than at the top of the list.
      collection.add(collection.createItem(item), { index: item.getIndex() });
    },
    moveBy: (descriptor.reorderable ?? true)
      ? (item: T, delta: number) => { item.setIndex(item.getIndex() + delta); }
      : undefined,

    getCardTitle: descriptor.getCardTitle,
    getCardSubtitle: (item: T) => item.getRanges().toString(),
    CardSubtitle: descriptor.CardSubtitle,
    CardMedia: descriptor.CardMedia,
    CardBody: descriptor.CardBody,
    /* `AnchorItemBodyProps` names the value `item`; the generic editor names it `draft`. Same
       object either way — an anchored draft IS a (detached) item. */
    EditorBody: ({ draft }: ItemEditorProps<T>) => {
      const Body = descriptor.EditorBody;
      return <Body item={draft} />;
    }
  };
};

/**
 * Task-pane panel for a sheet's anchored-item collections (data validations, conditional
 * formats, protected ranges): a card list with add/edit/duplicate/delete/reorder, and an in-place
 * editor over a temporary item with save/cancel.
 *
 * A thin binding over the generic {@link ItemsPanel} — see {@link toItemsDescriptor}.
 */
export const AnchorItemsPanel =
  memo(forwardRef<HTMLDivElement, AnchorItemsPanelProps<any>>((props, refForwarded) => {

  const {
    workbook,
    descriptor,
    args,
    dragReorder,
    ...rest
  } = props;

  const itemsDescriptor = useMemo(() => toItemsDescriptor(descriptor), [descriptor]);

  return (
    <ItemsPanel
      ref={refForwarded}
      workbook={workbook}
      descriptor={itemsDescriptor}
      args={args}
      dragReorder={dragReorder}
      {...rest}
    />
  );
}));

AnchorItemsPanel.displayName = 'AnchorItemsPanel';
