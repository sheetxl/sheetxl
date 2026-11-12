import { type IWorkbook, type IWorkbookIO } from '@sheetxl/sdk';

import {
  type ErrorPanelProps, type LoadingPanelProps, type RenderSlotFn, type VirtualKeyboardMode
} from '@sheetxl/utils-react';

import { type SxProps } from '@mui/system';

import { type Theme, type ThemeOptions } from '@mui/material';
import { type PaperProps } from '@mui/material';

import {
  type TaskPaneAreaProps, type ITaskPaneAreaElement,
  type IWorkbookElement, type WorkbookElementProps, type WorkbookLoadEvent, type WorkbookRenderSettledEvent,
  type SheetEditable,
  type ExplicitTokens
 } from '@sheetxl/react';
import { type DocumentTitleProps } from '../workbook';
import { type WorkbookToolbarsProps } from '../toolbar';
import { type FormulaBarProps, type IFormulaBarElement, type FormulaBarPlacement } from '../formulaBar';
import { type StatusBarProps } from '../statusBar';

/**
 * Properties for the Studio component.
 */
export interface StudioProps extends
  Omit<PaperProps, 'autoFocus' | 'ref'> {
  /**
   * The workbook for the studio — a live {@link IWorkbook}, a `Promise` for one, or
   * {@link IWorkbookIO.ReadOptions} the studio reads.
   *
   * @remarks
   * The workbook is the studio's value object: it carries its own identity — the
   * {@link IWorkbookIO.Origin | origin} (virtual file handle) and display name — so there is no
   * separate document wrapper to thread. The studio adds only session state (the dirty tracker).
   *
   * @see
   * * {@link IWorkbook}
   * * {@link IWorkbookIO.ReadOptions}
   */
  workbook?: IWorkbook | Promise<IWorkbook> | IWorkbookIO.ReadOptions;
  /**
   * Called when the studio's live workbook changes — e.g. when a workbook is opened (replacing the
   * current one) via the Studio's own file commands or drag-and-drop, or on unmount (`null`).
   *
   * @param workbook - The current workbook (carrying its origin + display name), or `null`.
   *
   * @remarks
   * The Studio owns Open/replace internally, so a host that manages window-level chrome (tab title,
   * `beforeunload`, see {@link @sheetxl/studio-mui!useStudioApp}) must observe *this* workbook rather
   * than the one it resolved initially — otherwise the title/dirty guard stay bound to the first
   * workbook after an in-app open. Pair with {@link StudioProps.onDirtyChange} for the unsaved flag.
   */
  onWorkbookChange?: (workbook: IWorkbook | null) => void;
  /**
   * Called if the document (a promise / read options) fails to resolve.
   *
   * @param error The error
   */
  onDocumentError?: (error: any) => void;
  /**
   * Customizations for the default error panel shown when the {@link StudioProps.document} fails to
   * resolve. Use {@link StudioProps.renderDocumentError} to replace the panel entirely.
   */
  propsDocumentError?: Partial<ErrorPanelProps>;
  /**
   * Replace the error panel shown when the {@link StudioProps.document} fails to resolve (or cannot be
   * rendered).
   *
   * @remarks
   * The failure is also reported programmatically via {@link StudioProps.onDocumentError}.
   *
   * @defaultValue StackTraceErrorPanel
   */
  renderDocumentError?: RenderSlotFn<ErrorPanelProps> | null;
  /**
   * Customizations for the default loading panel shown while the {@link StudioProps.document} resolves
   * (and the grid first paints). Use {@link StudioProps.renderDocumentLoading} to replace it entirely.
   */
  propsDocumentLoading?: Partial<LoadingPanelProps>;
  /**
   * Replace the loading panel shown while the {@link StudioProps.document} resolves / the grid paints.
   * `null` for none.
   */
  renderDocumentLoading?: RenderSlotFn<LoadingPanelProps> | null;
  /**
   * Customizations forwarded to the underlying (chromeless) workbook grid.
   *
   * @remarks
   * The studio composes its chrome (toolbar / formula bar / status bar / menus) *around* the grid
   * and forwards these to it. Grid-level concerns (sheet, tabs, context menus, scrollbars, etc.)
   * live here rather than flat on {@link StudioProps} — the same containment pattern
   * {@link WorkbookElementProps} uses for `propsSheet`.
   */
  propsWorkbook?: Partial<WorkbookElementProps>;
  /**
   * Called when the workbook grid first renders, before its pictures and charts have finished
   * drawing. Fires again for each workbook opened in the studio.
   */
  onWorkbookLoad?: (event: WorkbookLoadEvent) => void | Promise<void>;
  /**
   * Called when a workbook is shown: its first screen has finished drawing, or
   * `propsWorkbook.renderSettleTimeout` ran out. Fires again for each workbook opened in the studio.
   *
   * @see {@link WorkbookElementProps.onRenderSettled}
   */
  onRenderSettled?: (event: WorkbookRenderSettledEvent) => void;
  /**
   * Allow for customizations on TaskPaneArea.
   */
  propsTaskPaneArea?: Partial<TaskPaneAreaProps>;
  /**
   * Render the task pane area. Pass `props.ref` on to the {@link ITaskPaneAreaElement}.
   *
   * @param props The properties for the TaskPaneArea.
   */
  renderTaskPaneArea?: RenderSlotFn<TaskPaneAreaProps>;
  /**
   * Allow for a side of the taskpane.
   *
   * @defaultValue 'right'
   */
  taskPaneSide?: 'left' | 'right';
  /**
   * Custom logo.
   */
  logo?: React.ReactNode;
  /**
   * Called when the workbook's unsaved-changes (dirty) state changes.
   *
   * @param isDirty `true` when there are unsaved changes since the last save (or the workbook was
   *   created), `false` when saved or undone back to the saved state.
   *
   * @remarks
   * Use this to drive a host's "unsaved" affordances — a `beforeunload` close prompt, a tab marker,
   * etc. (see the studio example). Save state is computed from the transaction store, so undoing
   * back to the saved point reports clean again.
   */
  onDirtyChange?: (isDirty: boolean) => void;
  /**
   * Additional document-title (title bar) properties.
   *
   * @remarks
   * If onTitleChange or title is provided then the prop versions are ignored
   */
  propsDocumentTitle?: DocumentTitleProps;
  /**
   * Indicate if the formula bar should be showing.
   *
   * @defaultValue Workbook view model (but can be overridden).
   */
  showFormulaBar?: boolean;
  /**
   * Customizations for the formula bar.
   */
  propsFormulaBar?: Partial<FormulaBarProps>;
  /**
   * Render a custom formula bar (replaces the default).
   */
  renderFormulaBar?: RenderSlotFn<FormulaBarProps> | null;
  /**
   * Where the formula bar sits: above the grid, or below it directly above the status bar, the way
   * a phone spreadsheet lays it out.
   *
   * @defaultValue `'auto'` — `'bottom'` on a device whose primary pointer is a finger (a phone, a
   *   tablet), `'top'` everywhere else, including on the server.
   *
   * @remarks
   * `'auto'` reads the device's primary pointer once, not the live input: a tablet that gets a mouse
   * plugged in keeps its bar where it is. Force a value to develop the phone layout under device
   * emulation, or when the host knows better than the device test.
   */
  formulaBarPlacement?: FormulaBarPlacement | 'auto';
  /**
   * How the studio makes room for the virtual keyboard while the formula bar is at the bottom.
   *
   * - `'float'`: the studio stays as it is and never scrolls the page; the bar's field rides the top
   *   of the keyboard, while the bar in the studio stays in place. For a studio that is part of a
   *   page.
   * - `'resize'`: the studio shrinks to the part of the screen the keyboard leaves, so the grid, its
   *   scrollbars and the bar all stay in view above the keyboard. For a studio that is the page (what
   *   {@link @sheetxl/studio-mui!useStudioApp} sets up); in a page that scrolls it would fight the page.
   * - `'none'`: nothing; for a host that manages the keyboard itself.
   *
   * @defaultValue `'float'`
   *
   * @remarks
   * Ignored while the bar is at the top. The studio wires the two halves `@sheetxl/utils-react` offers
   * any host: `KeyboardAccessory` (what the formula bar's field rides the keyboard in) and
   * `useKeyboardResize` (the room a host that is the page gives up). A host without the studio's chrome
   * makes the same choice with the same parts.
   */
  virtualKeyboard?: VirtualKeyboardMode;
  /**
   * The shared cell editor. Supply a stable {@link SheetEditable} to drive the grid and
   * formula bar through one instance (free two-way sync); omit to let the studio auto-create one.
   */
  editable?: SheetEditable;
  /**
   * Shows the status bar.
   *
   * @defaultValue Workbook view model (but can be overridden).
   */
  showStatusBar?: boolean;
  /**
   * Customizations for the status bar.
   */
  propsStatusBar?: Partial<StatusBarProps>;
  /**
   * Render a custom status bar (replaces the default).
   */
  renderStatusBar?: RenderSlotFn<StatusBarProps> | null;
  /**
   * Customizations for the toolbar.
   */
  propsToolbar?: Partial<WorkbookToolbarsProps>;
  /**
   * Render a custom toolbar (replaces the default studio toolbar).
   */
  renderToolbar?: RenderSlotFn<WorkbookToolbarsProps> | null;
  /**
   * Slot rendered at the top-left of the toolbar (after the logo, before the title).
   *
   * @remarks
   * Application-level toolbar chrome the studio no longer hardcodes — e.g. a file menu. Inject a
   * {@link @sheetxl/studio-mui!StandaloneFileCommandButton} for the standalone file menu (open / save
   * / import / export); command availability is still governed by the active {@link WorkbookIO}
   * backing store's `canRead` / `canWrite`.
   */
  topLeft?: React.ReactNode;
  /**
   * Slot rendered at the top-right of the toolbar — e.g. an appearance (light/dark) menu. Inject an
   * {@link @sheetxl/studio-mui!AppearanceCommandButton} for the default appearance menu.
   */
  topRight?: React.ReactNode;
  /**
   * MUI theme customization (`ThemeOptions`) merged into Studio's built-in light and dark themes — shared
   * config (e.g. `typography`) plus **per-mode** overrides via MUI's native `colorSchemes: { light, dark }`
   * (the modern replacement for the former `lightTheme`/`darkTheme` props):
   *
   * ```ts
   * muiTheme={{
   *   typography: { fontFamily: '…' },                          // both modes
   *   colorSchemes: {
   *     light: { palette: { primary: { main: '#6d28d9' } } },   // light only
   *     dark:  { palette: { primary: { main: '#a78bfa' } } },   // dark only
   *   },
   * }}
   * ```
   *
   * @remarks
   * This is *config*, not state. Light/dark **mode** and the dark-grid/dark-image toggles are self-managed by
   * Studio as persisted preferences (see {@link @sheetxl/react!ThemeStateKey}), driven by the surrounding
   * `PersistentStateProvider` — not by props. {@link tokens} layers token values on top.
   */
  muiTheme?: ThemeOptions;
  /**
   * Explicit `--sxl-*` token values — the host's own colors, stated rather than derived. Addressed by
   * **cell**: a `(surface × mode)` pair, so a host can name the header paper without a new token existing:
   *
   * ```ts
   * tokens={{
   *   dark: {
   *     app: {
   *       'color-base-200': '#1f1f1f',                 // the chrome/desktop surface
   *       'color-input': '#313131',                    // the formula bar / name box field
   *       'color-input-border': '#3c3c3c',
   *     },
   *     header: { 'color-base-100': '#181818' },       // the row/column header paper
   *   },
   * }}
   * ```
   *
   * @remarks
   * Use this — not {@link muiTheme} — for anything the MUI palette has no slot for. Studio derives what you
   * leave unset (gridlines, the header hover step) from the five palette slots by *elevation* math, which
   * assumes "raised" means "lighter". A flat design language (VS Code, Fluent) names those surfaces outright
   * and does not follow that curve, so stating them here makes the derivation stand down for exactly those
   * cells and keeps deriving only the rest.
   *
   * The surfaces are `app` (the default cell everything inherits), `header` (row/column headers) and `grid`
   * (the cell body). These are emitted with Studio's own `sxl-app` layer, so they stay **surface-aware**. The
   * `app` cell also retints the MUI chrome (primary, background, text, radius, font). A stylesheet in
   * `@layer sxl-overrides` reaches the grid but not the MUI chrome.
   */
  tokens?: ExplicitTokens;
  /**
   * Also apply the MUI `CssBaseline` when theming.
   *
   * @defaultValue false
   */
  cssBaseline?: boolean;

  // TODO - on workbook element but I think we are going to have Studio not extend workbook
  /**
   * Autofocus on load. If loading multiple workbooks or using an a secondary component this
   * should be set to false.
   *
   * @defaultValue false
   */
  autoFocus?: boolean | FocusOptions;

  /**
   * Set the license key via a property
   * @remarks
   * This will only be used the first time.
   */
  licenseKey?: string;

  /**
   * Whether features are loaded ahead of use once the studio is showing, so their first use does
   * not wait on the network; see {@link WorkbookElementProps.prefetch}.
   *
   * @remarks
   * The script editor and its compiler are always loaded on first use.
   *
   * @defaultValue 'auto'
   */
  prefetch?: boolean | 'auto';

  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;
}

/**
 * The workbook-resolution lifecycle state, as read from {@link IStudioAttributes.getWorkbookState}.
 *
 * @remarks
 * This is the *resolution* layer — turning a source ({@link StudioProps.workbook} given as read
 * options / a promise) into an {@link IWorkbook}. `error` is also surfaced via
 * {@link StudioProps.onDocumentError} and the error panel. The grid's first-paint is a separate,
 * later event ({@link StudioProps.onWorkbookLoad}).
 */
export type WorkbookLoadState =
  | { status: 'loading' }
  | { status: 'loaded'; workbook: IWorkbook }
  | { status: 'error'; error: unknown };

/**
 * Studio-specific attributes beyond HTMLDivElement.
 *
 * @remarks
 * The Studio is the *chrome* layer (toolbar, formula bar, status bar, theming, file menu) that
 * surrounds a workbook grid. It is a distinct DOM element that *contains* an
 * {@link IWorkbookElement} rather than being one — reach the chrome-free grid via
 * {@link IStudioAttributes.getWorkbookElement}.
 */
/**
 * Options for {@link IStudioAttributes.save}.
 */
export interface StudioSaveOptions {
  /**
   * Decides on a write that would lose something, in place of the studio's own dialog.
   *
   * @remarks
   * For a host that cannot show the studio right now — an editor tab in the background, saved by
   * the host's "Save All" — and so asks the user its own way. Omitted, the studio shows its dialog.
   */
  onWarnings?: IWorkbookIO.WriteOptions['onWarnings'];
}

export interface IStudioAttributes {
  /**
   * For runtime type checking.
   */
  isStudioElement: () => true;
  /**
   * Saves the workbook exactly as the studio's own Save does — back to its origin, or asking where
   * when it has none — including the studio's dialog when the write would lose something.
   *
   * @returns The origin written, or `null` when the save was cancelled (a dismissed picker, a
   *   declined lossy write).
   *
   * @remarks
   * For a host that owns the save gesture (a VS Code extension's native Save) and needs the studio's
   * behavior plus the outcome. A failure rejects with the error rather than showing it, so the host
   * can report it its own way. Rejects when the active backing store cannot write.
   */
  save(options?: StudioSaveOptions): Promise<IWorkbookIO.Origin | null>;
  /**
   * Retrieve the chrome-free workbook grid element contained by this studio.
   *
   * @remarks
   * `undefined`/`null` until the workbook has resolved and rendered (e.g. while a loading or error
   * panel is shown).
   */
  getWorkbookElement: () => IWorkbookElement | null;
  /**
   * The studio's live workbook — carrying its origin and display name — or `null` while loading /
   * on error / before a workbook is set. The same instance pushed via
   * {@link StudioProps.onWorkbookChange}, but readable on demand.
   */
  getWorkbook: () => IWorkbook | null;
  /**
   * The authoritative unsaved-changes state of the live workbook.
   *
   * @remarks
   * A synchronous, on-demand read (unlike {@link StudioProps.onDirtyChange}) — e.g. for a host (a
   * VS Code extension) to re-check dirty immediately after an async save, where a concurrent edit
   * may have re-dirtied the workbook between encode and write.
   */
  isDirty: () => boolean;
  /**
   * The shared cell editor, or `null` if none. The same instance the grid and formula
   * bar drive. Delegates to the workbook element's `getEditable()`.
   */
  getEditable: () => SheetEditable | null;
  /**
   * Retrieve the studio's formula bar element, if a formula bar is shown.
   *
   * @remarks
   * The formula bar is studio chrome (the chromeless {@link IWorkbookElement} grid does not have
   * one), so this lives on the studio handle.
   */
  getFormulaBarElement: () => IFormulaBarElement | null;
  /**
   * Move focus into the studio.
   *
   * @remarks
   * A generic focus affordance that delegates to the contained
   * {@link IWorkbookElement}'s `focus()` (which focuses the active sheet). Declared here (rather than
   * relying on the inherited `HTMLDivElement.focus`) so the delegating behavior is part of the
   * studio contract.
   *
   * Signature mirrors `HTMLElement.focus` so {@link IStudioElement} can extend both.
   */
  focus(options?: FocusOptions): void;
  /**
   * The "load promise": resolves with the {@link IWorkbook} once it has loaded, rejects if the
   * load fails.
   *
   * @remarks
   * Lets a host await the outcome of the {@link StudioProps.workbook} resolution (a promise /
   * read options) without wiring {@link StudioProps.onWorkbookChange} + {@link StudioProps.onDocumentError}.
   * Re-armed on each new load (and on {@link IStudioAttributes.retry}); after a load has settled it
   * returns the settled promise. Resolves on workbook load — not the grid's first paint
   * ({@link StudioProps.onWorkbookLoad}).
   */
  whenReady(): Promise<IWorkbook>;
  /**
   * A synchronous read of the current workbook-resolution {@link WorkbookLoadState}.
   */
  getWorkbookState(): WorkbookLoadState;
  /**
   * Re-attempt resolving the current {@link StudioProps.document}.
   *
   * @remarks
   * For programmatic recovery (e.g. a host "reload" action) so an error state isn't terminal —
   * without changing the `workbook` prop identity. The default error panel does NOT surface this (an
   * invalid file stays invalid, so a retry button would be misleading); a custom UI may call it.
   */
  retry(): void;
}

/**
 * Type returned via the Studio's ref property.
 *
 * @remarks
 * The studio root is its own DOM element that *contains* a workbook grid; it does not extend
 * {@link IWorkbookElement}. See {@link IStudioAttributes}.
 */
export interface IStudioElement extends HTMLDivElement, IStudioAttributes {};
