import type React from 'react';

import { type IWorksheet, type IAnchored } from '@sheetxl/sdk';

import { type ItemMessageKeys } from '../itemsPanel';

import { type ReanchorableItem } from './AnchoredRangeField';

/**
 * The contract an item must satisfy to be listed in an {@link AnchorItemsPanel}.
 *
 * @remarks
 * Data validations and conditional formats satisfy this via `AnchoredConditional`; protected
 * ranges satisfy it directly.
 *
 * This is the *anchored* shape specifically — an item that occupies ranges on one sheet and
 * carries an index within that sheet's collection. A list whose items are none of those things
 * does not belong here: defined names are aggregated from the registries that own them, have no
 * anchor and no order, and bind to the model-agnostic `ItemsDescriptor` instead.
 */
export interface AnchorItem extends ReanchorableItem {
  /**
   * Returns the index of this item within its container.
   */
  getIndex(): number;
  /**
   * Sets the index of this item within its container.
   */
  setIndex(index: number): unknown;
}

/**
 * The slice of a collection the panel needs. `IDataValidationCollection` and
 * `IConditionalFormatCollection` satisfy this structurally.
 */
export interface AnchorItemCollection<T extends AnchorItem> {
  getItems(): readonly T[];
  add(item: T, options?: IAnchored.AddOptions): unknown;
  createItem(template?: T): T;
}

/**
 * The catalog keys an anchored feature declares — the same set every list declares, since the
 * generic panel is what renders them.
 *
 * @see {@link ItemMessageKeys}
 */
export type AnchorItemMessageKeys = ItemMessageKeys;

/**
 * Props for the per-feature slots rendered inside the generic card and editor.
 */
export interface AnchorItemBodyProps<T extends AnchorItem> {
  item: T;
}

/**
 * Describes one anchored-item feature (data validation, conditional format, …) to the
 * generic {@link AnchorItemsPanel}: where its collection lives, which sheet events signal
 * change, and the feature-specific card/editor content.
 */
export interface AnchorItemsDescriptor<T extends AnchorItem> {
  /**
   * Class-name slug, e.g. `'data-validation'`. Rendered as `sxl-<key>-details` on the panel.
   */
  key: string;
  /**
   * The catalog keys the generic components render, e.g. `messageKey('dataValidation.moveUp')`.
   */
  messageKeys: AnchorItemMessageKeys;
  /**
   * Returns the feature's collection for a sheet.
   */
  getCollection(sheet: IWorksheet): AnchorItemCollection<T>;
  /**
   * Sheet events that signal the collection changed (add/remove/reorder/anchor moves),
   * e.g. `['onDataValidationsChange']`. `onProtectionChange`/`onInvalidated` are always handled.
   */
  changeEvents: (keyof IWorksheet.IListeners)[];
  /**
   * Read-only predicate. Defaults to `!sheet.getProtection().isObjectsAllowed()`.
   */
  isReadOnly?(sheet: IWorksheet): boolean;
  /**
   * If `false` the move up/down affordances are hidden, for a collection whose evaluation does
   * not depend on order.
   *
   * @defaultValue true
   */
  reorderable?: boolean;
  /**
   * Flushes any editor state that cannot be written to the temporary item synchronously, before
   * either save path reads it.
   *
   * @remarks
   * Both save paths (`collection.add` and {@link applyUpdate}) serialize the temporary item, so
   * everything the editor collected must already be on it. Most editors write straight through and
   * need nothing here — protected ranges do, because hashing a password is asynchronous.
   */
  beforeSave?(edited: T): Promise<void> | void;
  /**
   * Whether the temporary item can be saved as it is — see `ItemsDescriptor.validate`.
   *
   * @returns A message key naming the problem, or `null`.
   */
  validate?(edited: T): string | null;
  /**
   * Applies the edited (temporary) item back onto the existing collection item on save.
   * The add path (`index === -1`) uses `collection.add` and does not call this.
   *
   * @remarks
   * The ranges are not this method's: the panel carries an edited anchor across after it returns.
   */
  applyUpdate(target: T, edited: T): void;
  /**
   * Writes what a NEW item starts with onto a fresh draft, for a feature whose authoring defaults
   * differ from the model's (a data validation starts as Excel's dialog does: Stop, alert shown,
   * blanks ignored). Runs before {@link applySeed}; never on a draft of an existing item.
   */
  applyNewDefaults?(draft: T): void;
  /**
   * Writes an activation seed onto a fresh draft, for a feature that can be opened already editing
   * a new item — see `ItemsDescriptor.createSeededDraft`, which this supplies the body of.
   *
   * @param draft A temporary item anchored to the current selection, as the add button would mint.
   * @param seed The feature's properties, from the task pane's `ItemsPaneArgs.draft`.
   *
   * @remarks
   * Only the WRITE is per-feature — minting the draft is the collection's job, and the adapter's.
   * Omit to opt out of seeding entirely.
   */
  applySeed?(draft: T, seed: any): void;
  /**
   * The one-line card header, e.g. the condition string.
   */
  getCardTitle(item: T, t: (key: string, options?: any) => string): string;
  /**
   * Leading visual at the card's top-left, before the title — a preview swatch, an icon.
   */
  CardMedia?: React.ComponentType<AnchorItemBodyProps<T>>;
  /**
   * Card content below the ranges line. Optional — the generic card always shows the ranges.
   */
  CardBody?: React.ComponentType<AnchorItemBodyProps<T>>;
  /**
   * Renders the ranges line, for a feature that lets them be edited from the card. Without it the
   * card shows `getRanges().toString()` as plain text.
   */
  CardSubtitle?: React.ComponentType<AnchorItemBodyProps<T>>;
  /**
   * The feature editor rendered inside the save/cancel {@link EditorPanel} shell.
   */
  EditorBody: React.ComponentType<AnchorItemBodyProps<T>>;
}
