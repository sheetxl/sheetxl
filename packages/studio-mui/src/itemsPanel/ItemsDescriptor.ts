import type React from 'react';

import { type IWorkbook } from '@sheetxl/sdk';

/**
 * How an {@link ItemsPanel} is told that what it is showing has changed.
 */
export interface ItemsSubscriber {
  /**
   * The list changed — items added, removed, reordered, renamed, or otherwise re-rendered.
   */
  onChange(): void;
  /**
   * The underlying model was restored beneath the panel (undo/redo).
   *
   * @remarks
   * Closes any open editor as well as re-reading the list: a draft taken from state that has since
   * been rolled back would be saved back over the restored model.
   */
  onInvalidated(): void;
}

/**
 * Props for the per-feature card body.
 */
export interface ItemBodyProps<T> {
  item: T;
}

/**
 * Props for the per-feature editor body.
 */
export interface ItemEditorProps<D> {
  /**
   * The editor's working value — see {@link ItemsDescriptor.createDraft}.
   */
  draft: D;
  /**
   * The workbook the draft will be saved into.
   *
   * @remarks
   * An editor commonly needs more than the draft to render its fields — the sheet list behind a
   * scope picker, say. The panel already holds it, so it is passed rather than re-resolved.
   */
  workbook: IWorkbook;
}

/**
 * The catalog keys the generic panel, card and editor render for one feature.
 *
 * @remarks
 * Each feature declares these literally — `messageKey('dataValidation.moveUp')` — rather than the
 * generic components building `` `${ns}.moveUp` `` at render. Extraction only sees literal keys, so a
 * composed key is invisible to it and the next `pnpm i18n:extract` would drop the string from the
 * English catalog while it is still in use.
 */
export interface ItemMessageKeys {
  /** Empty-list text when nothing can be added (read-only, or an unauthorable list). */
  none: string;
  /**
   * Empty-list text inviting the first item. Required for an AUTHORABLE list — see
   * {@link ItemsDescriptor.createDraft}.
   */
  addPrompt?: string;
  /** List header. Omit when the pane's own chrome (a tab, a section title) already names the list. */
  heading?: string;
  /** Tooltip on the header's add affordance. Authorable lists only. */
  insert?: string;
  /** Label of the empty-list add button. Authorable lists only. */
  new?: string;
  /** Card action tooltips. `edit` is for authorable lists only. */
  edit?: string;
  delete: string;
  /** Card duplicate tooltip. Required when the feature supplies {@link ItemsDescriptor.duplicate}. */
  duplicate?: string;
  /** Editor buttons. Authorable lists only. */
  cancel?: string;
  save?: string;
  /** Card reorder tooltips. Required when the feature supplies {@link ItemsDescriptor.moveBy}. */
  moveUp?: string;
  moveDown?: string;
  /**
   * Search field placeholder, its clear-button tooltip, and the text shown when a query matches
   * nothing. Required when the feature supplies {@link ItemsDescriptor.getSearchText}.
   */
  search?: string;
  clearSearch?: string;
  noMatches?: string;
}

/**
 * Describes one listable feature to the generic {@link ItemsPanel}: where its items come from,
 * what signals change, and the feature-specific card and editor content.
 *
 * @typeParam T - The listed item.
 * @typeParam D - The editor's working value. Often `T` itself (a detached model the feature can
 * mutate freely), but it does not have to be — see {@link createDraft}.
 *
 * @remarks
 * Deliberately says nothing about *how* items are stored. Anchored collections (data validations,
 * conditional formats, protected ranges) reach it through an adapter over `AnchorItemsDescriptor`;
 * defined names bind to it directly. Neither shape is privileged here.
 */
export interface ItemsDescriptor<T=any, D=T> {
  /**
   * Class-name slug, e.g. `'data-validation'`. Rendered as `sxl-<key>-details` on the panel.
   */
  key: string;
  /**
   * The catalog keys the generic components render, e.g. `messageKey('dataValidation.moveUp')`.
   */
  messageKeys: ItemMessageKeys;
  /**
   * The items to list, in display order.
   */
  getItems(workbook: IWorkbook): readonly T[];
  /**
   * Subscribes to everything that can change {@link getItems} or the read-only state.
   *
   * @returns An unsubscribe callback.
   *
   * @remarks
   * Implementations must pass `{ transactional: false }` to `addListeners`. A UI subscription left
   * transactional lands in the bucket that is only visited inside a commit — and is reverted by an
   * undo, leaving the panel permanently silent.
   */
  subscribe(workbook: IWorkbook, subscriber: ItemsSubscriber): () => void;
  /**
   * Whether the list as a whole cannot be modified — hides add, and every card's actions.
   */
  isReadOnly(workbook: IWorkbook): boolean;
  /**
   * Per-item override of {@link isReadOnly}, for a list that mixes editable and derived items.
   *
   * @defaultValue The list-level {@link isReadOnly}.
   */
  isItemReadOnly?(item: T, workbook: IWorkbook): boolean;
  /**
   * A stable React key for an item.
   *
   * @defaultValue An identity key held against the item object, so reorders animate correctly.
   */
  getItemKey?(item: T): string;
  /**
   * Subscribes to one item's own events, to re-render just its card.
   *
   * @returns An unsubscribe callback.
   */
  subscribeItem?(item: T, onChange: () => void): () => void;
  /**
   * Creates the editor's working value.
   *
   * @param template The item being edited or duplicated; absent when adding.
   *
   * @remarks
   * What a "draft" is belongs to the feature. An anchored collection mints a detached model via
   * `createItem` and edits that. A collection with no such notion — defined names are
   * aggregated from registries that own them, so there is nothing to detach — returns a plain
   * object instead, and {@link save} applies it. The panel only ever hands it back.
   *
   * **Omit it, with {@link save} and {@link EditorBody}, for a list that can be ACTED ON but not
   * AUTHORED** — external links are made by typing a formula, and each one is an immutable
   * snapshot, so the list offers Go to and Break link and no editor at all. The panel then shows
   * no add affordance and no edit action, and the card title is plain text rather than a way in.
   * This is not the same as {@link isReadOnly}, which hides every action including delete.
   */
  createDraft?(workbook: IWorkbook, template?: T): D;
  /**
   * Creates a draft from an ACTIVATION seed — the `draft` of the task pane's `ItemsPaneArgs`, put
   * there by whatever opened the pane (a conditional-format preset command, say). The panel opens
   * straight into the editor on what this returns, exactly as if the user had pressed add.
   *
   * @returns The seeded draft, or `null` to ignore a seed this feature does not recognize.
   *
   * @remarks
   * The seed is the feature's PROPERTIES, not a model object: the caller is a command that knows
   * the shape but holds none of the panel's models, and nothing is committed until save.
   *
   * Omit to opt out — a pane with nothing to seed ignores the argument.
   */
  createSeededDraft?(workbook: IWorkbook, seed: any): D | null;
  /**
   * Flushes editor state that could not be written to the draft synchronously, before
   * {@link save} reads it (hashing a password, say).
   */
  beforeSave?(draft: D): Promise<void> | void;
  /**
   * Whether the draft can be saved as it is.
   *
   * @returns A message key naming the problem, or `null`. The problem is shown and the editor stays
   * open on the draft.
   *
   * @remarks
   * Asked after the editor's fields have committed what they still held and after
   * {@link beforeSave}, so it reads the draft as {@link save} would. For what a single field
   * cannot take, the field refuses the save itself (`useEditorCommit`); this is for what only the
   * whole draft can answer — bounds the wrong way around, a condition missing an operand.
   */
  validate?(draft: D): string | null;
  /**
   * Persists the draft.
   *
   * @param target The item being edited, or `null` when adding.
   *
   * @remarks
   * The single write point, so the feature — not the panel — decides how the change is committed.
   * Whatever spans more than one model write belongs in one transaction here, or undo unwinds a
   * single edit a field at a time.
   */
  save?(workbook: IWorkbook, draft: D, target: T | null): Promise<void> | void;
  /**
   * Removes an item. For a list whose items are not deleted so much as retired — breaking an
   * external link turns its formulas into values first — this is that operation, and
   * {@link ItemMessageKeys.delete} names it.
   */
  delete(item: T, workbook: IWorkbook): void;
  /**
   * Copies an item. Omit to hide the duplicate affordance.
   */
  duplicate?(item: T, workbook: IWorkbook): void;
  /**
   * Moves an item by `delta` positions. Omit for an unordered list (defined names) to hide the
   * move affordances.
   */
  moveBy?(item: T, delta: number, workbook: IWorkbook): void;
  /**
   * Selects what an item designates on the grid. Invoked by a click on the card's SURFACE — not on
   * its title, its actions, or a field it carries, which act for themselves.
   *
   * @remarks
   * Omit when nothing on the grid corresponds to an item. An item that sometimes has nothing to
   * select (a name holding a constant) simply does nothing.
   */
  select?(item: T, workbook: IWorkbook): void;
  /**
   * The text a search query is matched against — everything a user might remember an item by.
   *
   * @remarks
   * Supplying it puts a search field over the list. Matching is a case-insensitive substring
   * test the panel performs; the feature only says what is searchable.
   */
  getSearchText?(item: T, t: (key: string, options?: any) => string): string;
  /**
   * The one-line card header.
   */
  getCardTitle(item: T, t: (key: string, options?: any) => string): string;
  /**
   * The emphasized line below the header — the ranges, the expression. `null` renders nothing.
   */
  getCardSubtitle?(item: T, t: (key: string, options?: any) => string): string | null;
  /**
   * Leading visual at the card's top-left, before the title — a preview swatch, an icon.
   */
  CardMedia?: React.ComponentType<ItemBodyProps<T>>;
  /**
   * Card content below the subtitle.
   */
  CardBody?: React.ComponentType<ItemBodyProps<T>>;
  /**
   * Renders the subtitle line instead of {@link getCardSubtitle}, for a feature whose subtitle is
   * a control rather than a string.
   */
  CardSubtitle?: React.ComponentType<ItemBodyProps<T>>;
  /**
   * The feature editor, rendered inside the save/cancel shell. Omit for an unauthorable list —
   * see {@link createDraft}.
   */
  EditorBody?: React.ComponentType<ItemEditorProps<D>>;
}
