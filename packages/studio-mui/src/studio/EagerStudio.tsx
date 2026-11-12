import type React from 'react';
import {
  useEffect, useCallback, memo, forwardRef, useState, useRef, useMemo
} from 'react';

import { mergeRefs } from 'react-merge-refs';

import { SnackbarProvider, type SnackbarKey, type CloseReason } from 'notistack';

import { ThemeProvider, type Theme, type ThemeOptions } from '@mui/material';
import { CssBaseline } from '@mui/material';
import { Paper, SvgIcon, Box } from '@mui/material';

import { CommonUtils, DefaultLanguagePackService, type LanguageTag } from '@sheetxl/utils';
import { type IWorkbook, type IWorkbookIO } from '@sheetxl/sdk';

import {
  Command, usePersistentState, useImperativeElement, useResolvedThemeMode, ReactErrorBoundary,
  useCallbackRef, DefaultIconService, DynamicIcon, UncaughtErrorBoundary,
  LanguageStateKey, ScrollUtils, RenderSlot, useKeyboardResize, type VirtualKeyboardMode, type ThemeMode, ThemeStyle
} from '@sheetxl/utils-react';

import {
  WorkbookIO, TaskPaneProvider, WorkbookProvider, useDocThemes, useModelSync, useWorkbookSaveState,
  useWorkbookEncrypted,
  useWorkbookName, useResolvedWorkbook, SHAPE_ICON_PACK,
  createEditable, ThemeStateKey, ThemeStateDefaults, ThemeRootStyles, useReferenceModeStore,
  type WorkbookInput, type IWorkbookElement, type WorkbookLoadEvent, type WorkbookRenderSettledEvent,
  type WorkbookElementProps,
  type SheetEditable, type TaskPaneAreaProps, type ITaskPaneAreaElement
} from '@sheetxl/react';

import {
  createExhibitTheme, ModalProvider, ExhibitFloatProvider, CommandGroup
} from '@sheetxl/utils-mui';

import {
  WorkbookElement, DocumentTitle, type IDocumentTitleElement
} from '../workbook';
import { ToastError } from '../toast';
import { createStudioThemeCSS, tokensToMuiOptions } from '../theme';
import { registerStudioCommandGroups } from '../command';

import {
  type StudioProps, type IStudioElement, type IStudioAttributes, type StudioSaveOptions, type WorkbookLoadState
} from './StudioProps';
import { StudioToolbar, type StudioToolbarProps } from './StudioToolbar';
import { CommandsWrapper } from './CommandsWrapper';
import { StudioNotifierProvider } from './StudioNotifierProvider';
import { StudioTaskPaneArea } from './StudioTaskPaneArea';
import { StudioSplitPane } from './StudioSplitPane';
import { resolveFormulaBarPlacement, orderStudioChrome } from './formulaBarPlacement';

import { TablePlugin } from '../table';
import { PivotPlugin } from '../pivot/PivotPlugin';
import { ShapePlugin } from '../shape';
import { ChartPlugin } from '../chart';
import { PicturePlugin } from '../picture';
import { SlicerPlugin } from '../slicer';
import { DataValidationPlugin } from '../dataValidation';
import { ConditionalFormatPlugin } from '../conditionalFormat';
import { ProtectionPlugin } from '../protection';
import { NamedPlugin } from '../named';
import { ExternalLinksPlugin } from '../externalLink';
import { CommentsPlugin } from '../comments';
import { AnomaliesPlugin } from '../anomalies';
import { FormatPlugin } from '../format';

import {
  defaultRenderWorkbookLoading,
  defaultRenderWorkbookError,
  defaultRenderFormulaBar, defaultRenderStatusBar
} from '../workbook/DefaultRenderers';

// AIPlugin();
TablePlugin(); // Components plugin
PivotPlugin();
ShapePlugin();
ChartPlugin();
PicturePlugin();
SlicerPlugin();
DataValidationPlugin();
ConditionalFormatPlugin();
ProtectionPlugin();
NamedPlugin();
ExternalLinksPlugin();
CommentsPlugin();
AnomaliesPlugin();
FormatPlugin();
registerStudioCommandGroups();

/**
 * A promise plus its resolvers, with a `settled` flag. Backs the imperative `whenReady()` — armed
 * at the start of each load and settled when that load resolves / fails.
 */
interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  settled: boolean;
}
const makeDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  const deferred: Deferred<T> = {
    promise,
    settled: false,
    resolve: (value) => { deferred.settled = true; resolve(value); },
    reject: (reason) => { deferred.settled = true; reject(reason); },
  };
  // Mark handled so a load failure with no `whenReady()` caller doesn't log an unhandled rejection.
  promise.catch(() => {});
  return deferred;
};

/**
 * Fully functional application. Wraps a workbook in a simple container for a standalone application.
 * Minimum usefulness is:
 *  * resolve initial workbook and loading panel
 *  * workbook
 *  * snackbar
 *  * export/import to local file system
 *  * file name
 *  * material-ui theme for light/dark toggle
 */

/**
 * Extract the `ThemeOptions` for one mode from the single `muiTheme` prop: the shared options merged with its
 * per-mode `colorSchemes[light|dark]` block (MUI's native per-mode mechanism, replacing the former
 * `lightTheme`/`darkTheme` props). So one `muiTheme` covers both shared and per-mode customization.
 */
const muiOptionsForMode = (base: ThemeOptions | undefined, isDark: boolean): ThemeOptions => {
  if (!base) return {};
  const { colorSchemes, ...shared } = base as any;
  const scheme = colorSchemes?.[isDark ? 'dark' : 'light'];
  return scheme && typeof scheme === 'object' ? CommonUtils.deepMerge(shared, scheme) : shared;
};

/**
 * Persistence keys for the studio's self-managed task-pane layout.
 *
 * @remarks
 * Owned via `usePersistentState` against the surrounding `PersistentStateProvider`. Kept as separate
 * keys so position and visibility can be opted into persistence independently (see {@link ThemeStateKey}).
 */
const LayoutStateKey = {
  /** The task-pane split position, as a percent (`number`). */
  TaskPanePosition: 'taskPanePosition',
  /** Whether a task pane is open. */
  TaskPaneVisible: 'taskPaneVisible',
} as const;

/**
 * The studio's content, rendered into a root element owned by {@link Studio}.
 *
 * @remarks
 * The root must exist before this (lazily loaded) module does, so the startup loading panel can live
 * inside it and consumer `className` / `style` / `sx` apply to a single element from the first render.
 */
export interface EagerStudioProps extends StudioProps {
  /** The root element rendered by {@link Studio}; decorated with the {@link IStudioAttributes}. */
  host: HTMLDivElement | null;
  /** The per-instance theme scope class carried by {@link EagerStudioProps.host}. */
  scopeClass: string;
}

export const EagerStudio = memo(forwardRef<IStudioElement, EagerStudioProps>(
  (props: EagerStudioProps, refForwarded) => {
  const {
    host,
    scopeClass,
    square: propsSquare, // paperProps
    elevation: propElevation, // paperProps
    variant: propVariant,  // paperProps
    onWorkbookLoad: propOnFirstRender,
    onRenderSettled: propOnRenderSettled,
    prefetch: propPrefetch,
    onDocumentError: propOnDocumentError,
    renderDocumentError: propRenderDocumentError = defaultRenderWorkbookError,
    propsDocumentError,

    propsTaskPaneArea,
    renderTaskPaneArea: propRenderTaskPaneArea = defaultRenderTaskPaneArea,
    taskPaneSide = 'right',
    onKeyDown: propOnKeyDown,

    workbook: propWorkbook,
    onWorkbookChange: propOnWorkbookChange,

    logo,
    topLeft: propTopLeft,
    topRight: propTopRight,
    muiTheme: propMuiTheme,
    tokens: propTokens,
    cssBaseline: propCssBaseline,
    autoFocus: propAutoFocus = false,
    title: propTitle,
    onDirtyChange: propOnDirtyChange,
    propsDocumentTitle,
    renderDocumentLoading: propRenderLoading = defaultRenderWorkbookLoading,
    propsDocumentLoading: propsLoading,
    // Grid-level customizations forwarded to the chromeless workbook grid (contained, not inherited).
    propsWorkbook,
    // Chrome (toolbar / formula bar / status bar) is composed by the Studio around the chromeless
    // grid; these are studio-level props (the grid no longer carries them).
    showFormulaBar: propShowFormulaBar,
    propsFormulaBar,
    renderFormulaBar: propRenderFormulaBar,
    formulaBarPlacement: propFormulaBarPlacement,
    virtualKeyboard: propVirtualKeyboard = 'float',
    editable: propEditable,
    showStatusBar: propShowStatusBar,
    propsStatusBar,
    renderStatusBar: propRenderStatusBar,
    propsToolbar,
    renderToolbar: propRenderToolbar,
  } = props;

  const refWorkbook = useRef<IWorkbookElement>(null);
  // Ref for the PENDING (hidden, pre-painting) grid of an in-app open. A ref must always be passed:
  // `useImperativeElement` only augments the DOM element with the imperative attributes (
  // `getViewportElement` / `getSheetElement` / `focus`…) inside `useImperativeHandle`, which React
  // skips entirely when no forwarded ref is attached — a ref-less grid would emit a BARE div as its
  // `onWorkbookLoad` source.
  const refPendingWorkbook = useRef<IWorkbookElement>(null);
  // The formula bar's name box element, exposed via the studio handle (getFormulaBarElement).
  const refFormulaBar = useRef<any>(null);
  // Imperative name-box focus for the workbook `activeNameBox` (Alt+F3) command — the command lives on the
  // workbook but the name box is in the formula bar, so the shell hands it this handle. Stable identity so it
  // doesn't churn the command contribution.
  const focusNameBox = useCallbackRef((): void => {
    refFormulaBar.current?.getNamedCollectionEditorElement?.()?.focus?.();
  }, []);

  // Which edge the formula bar sits on. `detect-it` measures the device's primary pointer once at
  // module load, so `'auto'` is a plain read, not a subscription.
  const formulaBarPlacement = resolveFormulaBarPlacement(propFormulaBarPlacement);

  // How the studio makes room for the virtual keyboard (`StudioProps.virtualKeyboard`). Only with the
  // bar at the bottom: a desktop studio is unaffected.
  const keyboardRoom: VirtualKeyboardMode = formulaBarPlacement === 'bottom' ? propVirtualKeyboard : 'none';

  // `'resize'`: the studio is the page, so it shrinks to the part of the screen the keyboard leaves.
  const { inset: viewportInset, offsetTop: viewportOffsetTop } = useKeyboardResize(keyboardRoom === 'resize');


  const onDocumentError = useCallbackRef<(error: any) => void>(propOnDocumentError ?? (() => {}), [propOnDocumentError]);
  const onDirtyChange = useCallbackRef<(isDirty: boolean) => void>(propOnDirtyChange ?? (() => {}), [propOnDirtyChange]);
  // Only forward a consumer-supplied override; the default ('Untitled') is resolved inside
  // DocumentTitle at the display boundary so it follows the active language reactively. Pre-resolving
  // it here would bake it into the stale `renderToolbar` closure and freeze it on the load-time language.
  const titlePlaceHolder = propsDocumentTitle?.placeHolder;

  // Light/dark mode is a self-managed, persisted preference (a VS Code host writes ThemeStateKey.Mode
  // from its editor theme). When unset it falls back to the document body class / media query.
  const [persistedMode] = usePersistentState<ThemeMode | null>(ThemeStateKey.Mode, ThemeStateDefaults[ThemeStateKey.Mode]);
  const { themeMode } = useResolvedThemeMode({ mode: persistedMode ?? undefined });

  // The persisted UI-language preference — read here (not just in StudioCommandProvider) so the
  // reveal gate can ACTIVATE it before first paint. Otherwise the gate prefetches the default (en),
  // reveals, and the post-paint `setActive` swaps to the real language — an English flash on every
  // always-visible label (number-format, preset styles). `null` = follow the service default.
  const [persistedLanguage] = usePersistentState<LanguageTag | null>(LanguageStateKey.Active, null);
  // Read through a ref: the reveal callback has empty deps (stable identity), and an async store
  // (the VS Code host) may resolve the preference AFTER first render — the ref keeps it live.
  const refPersistedLanguage = useRef(persistedLanguage);
  refPersistedLanguage.current = persistedLanguage;
  // The single `muiTheme` prop: shared options + the per-mode `colorSchemes[light|dark]` block (see
  // muiOptionsForMode). The host's `app` tokens are mapped `sxl → mui` and merged LAST, so a token retints the
  // MUI chrome (buttons/slider/tabs) too, not just the grid. See {@link tokensToMuiOptions}.
  const resolvedThemes = useMemo(() => ({
    light: createExhibitTheme(false, CommonUtils.deepMerge(
      muiOptionsForMode(propMuiTheme, false),
      tokensToMuiOptions(propTokens?.light?.app)
    )),
    dark: createExhibitTheme(true, CommonUtils.deepMerge(
      muiOptionsForMode(propMuiTheme, true),
      tokensToMuiOptions(propTokens?.dark?.app)
    )),
  }), [propMuiTheme, propTokens]);

  const isDarkMode = themeMode === 'dark';
  // The studio theme stylesheet — the `(token × surface × mode)` matrix as attribute rules, injected inline
  // (below). Containers select a cell via `data-sxl-theme-mode` / `data-sxl-theme-surface`; consumers just
  // read `var(--sxl-*)`. Both modes (and both grid cells) are always emitted, so it is stable across the
  // light/dark AND the Enable-Dark-Grid toggles and memoizes on the theme pair alone.
  //
  // Rendered as a plain INLINE `<style>` (no `href`/`precedence`) — NOT a React-19 hoisted resource, so its
  // text updates in place and no stale duplicate can leak into <head>. Its rules are global selectors, so
  // document.body-portaled pickers/menus resolve them (kept global, not `@scope`d, until the float-carry
  // step — a scoped studio theme wouldn't reach floats outside its subtree; see THEMING §7).
  // Per-instance scope (design §6): the studio theme is `@scope`d to this studio's own root class
  // (`scopeClass`, minted by Studio, which renders the root), so two studios on a page don't collide.
  // Floats carry this class (via ExhibitFloatProvider below) so a portaled picker still resolves the studio
  // tokens even though it mounts outside the studio subtree (design §7).
  // Does NOT depend on `enableDarkGrid`: the sheet always carries both grid cells; the option only flips the
  // grid's `data-sxl-theme-mode` attribute (via `useGridColorScheme`), so the CSS never regenerates on toggle.
  // `propTokens` — the host's explicit token values. Threaded into the generation (not merged as an after-the-
  // fact override) so the surface derivations CONSULT them: a host that names its chrome grey gets it on the
  // desktop and the headers, instead of an elevation-derived grey computed from a color it already replaced.
  const themeCSS = useMemo(
    () => createStudioThemeCSS(resolvedThemes.light, resolvedThemes.dark, `.${scopeClass}`, propTokens),
    [resolvedThemes, scopeClass, propTokens]
  );

  const defaultThemes = useDocThemes();

  // The requested input: the `workbook` prop, or a command-driven override (the open/import
  // commands hand the freshly-read workbook back via `setWorkbook` — it carries its own origin).
  // Initialized from the prop; the sync effect follows later prop-identity changes.
  const [requested, setWorkbook] = useState<WorkbookInput | null>(() => propWorkbook ?? null);
  useEffect(() => {
    setWorkbook(propWorkbook ?? null);
  }, [propWorkbook]);

  // Bumped by the imperative `retry()` to re-run the resolve effect for the current `requested`.
  const [retryNonce, setRetryNonce] = useState(0);

  // The "load promise" behind the imperative `whenReady()`. Armed (a fresh deferred) at the start of
  // each load if the previous one already settled; settled when this load resolves / fails.
  const refReady = useRef<Deferred<IWorkbook> | null>(null);
  if (!refReady.current) refReady.current = makeDeferred<IWorkbook>();

  // Resolve a source input (loading | loaded | error). The shared hook owns the normalize +
  // cancellation (stale-load guard) + reload-preserve; `retryNonce` (reloadKey) re-runs it for the
  // imperative `retry()`.
  const workbookState = useResolvedWorkbook(requested, {
    io: WorkbookIO,
    defaultTheme: defaultThemes.getDefaultTheme(),
    reloadKey: retryNonce
  });

  // The live workbook — the studio's value object. It carries its own identity (origin + name);
  // the studio adds only the session dirty state (tracked below for the SHOWN workbook).
  const liveWorkbook = workbookState.status === 'loaded' ? workbookState.workbook : null;

  const status: WorkbookLoadState = useMemo(() => {
    if (workbookState.status === 'error') return { status: 'error', error: workbookState.error };
    if (workbookState.status === 'loaded') return { status: 'loaded', workbook: workbookState.workbook };
    return { status: 'loading' };
  }, [workbookState]);

  // Arm a fresh `whenReady()` promise at the start of each load (the input / a retry changed) if the
  // previous one already settled.
  useEffect(() => {
    if (refReady.current!.settled) refReady.current = makeDeferred<IWorkbook>();
  }, [requested, retryNonce]);

  // Settle `whenReady()` + report a load failure as the lifecycle transitions. Failures go to
  // `onDocumentError` AND the error panel; the workbook itself is reported via `onWorkbookChange`.
  useEffect(() => {
    if (status.status === 'loaded') {
      // Ready means sized: a workbook is handed over once its fonts have landed and the autofits
      // taken with stand-ins meanwhile have run again (a failed font load settles too).
      const ready = refReady.current!;
      const workbook = status.workbook;
      workbook.whenFontsReady().then(() => ready.resolve(workbook), () => ready.resolve(workbook));
    } else if (status.status === 'error') {
      onDocumentError?.(status.error);
      refReady.current!.reject(status.error);
    }
  }, [status]);

  // --- Pending-workbook double-buffer (GRID-BUFFERING-PLAN.md Part A) ---------------------------
  // The committed (visible) workbook. The first resolved workbook is adopted immediately (the
  // initial load rides the single loading overlay). A later workbook-identity change (an in-app
  // open) does NOT rebuild the visible grid in place: the old grid stays on screen — interactive —
  // while the new workbook's grid mounts hidden alongside it (`pendingWorkbook`), and the swap
  // happens on the new grid's first paint — a visibility flip of an already-painted grid, no
  // inflight-props frame. Double-mounting is safe: each WorkbookElement owns its own per-workbook
  // command scope + undo manager (isolated by construction).
  const [shownWorkbook, setShownWorkbook] = useState<IWorkbook | null>(null);
  if (liveWorkbook && !shownWorkbook) {
    // Adopt in place (render-time state adjust): nothing is shown yet (initial load).
    setShownWorkbook(liveWorkbook);
  }
  // A *different* workbook while one is shown → the pending (hidden) candidate.
  // `liveWorkbook === null` (a failed open, or a transient resolve frame) is NOT a drop: the
  // old grid stays committed and the error panel renders on top of it.
  const pendingWorkbook = (liveWorkbook && shownWorkbook && liveWorkbook !== shownWorkbook) ? liveWorkbook : null;
  const refPendingModel = useRef(pendingWorkbook);
  refPendingModel.current = pendingWorkbook;
  const refShownWorkbook = useRef(shownWorkbook);
  refShownWorkbook.current = shownWorkbook;

  // --- Closing the workbook a replace displaces ------------------------------------------------
  // The io commands hand a freshly-read workbook to `replaceWorkbook`; the one it displaces is closed
  // HERE, not there. It cannot be closed at replace time: the double-buffer above keeps the outgoing
  // grid mounted — and interactive, its command scope still resolving — until the new grid paints, so
  // closing its model first left live UI bound to a dead sheet (a closed sheet has no state, and every
  // read off it throws). Queued on replace, closed by the effect below, which runs after the commit
  // that swapped the grids and unmounted the old one.
  //
  // Only a `replaceWorkbook` caller queues a close — a `workbook` PROP change (the sync effect above)
  // uses the raw setter, because a consumer-supplied workbook is the consumer's to close.
  const refWorkbooksToClose = useRef<IWorkbook[]>([]);
  const replaceWorkbook = useCallback((input: WorkbookInput | null): void => {
    const outgoing = refShownWorkbook.current;
    if (outgoing) refWorkbooksToClose.current.push(outgoing);
    setWorkbook(input);
  }, []);
  useEffect(() => {
    const queued = refWorkbooksToClose.current;
    if (queued.length === 0) return;
    // Still shown ⇒ the replace never landed (a failed / superseded open keeps the old grid committed).
    // Leave it open and queued: it is what the user is still looking at.
    refWorkbooksToClose.current = queued.filter((workbook) => workbook === shownWorkbook);
    for (let i=0; i<queued.length; i++) {
      const workbook = queued[i];
      if (workbook === shownWorkbook) continue;
      try {
        workbook.close();
      } catch (error: any) {
        console.warn('Unable to close the replaced workbook', error);
      }
    }
  }, [shownWorkbook]);

  // The shared cell editor: one stable IEditable for the whole workbook's life, passed by
  // reference to BOTH the formula bar and the grid for free two-way sync
  const autoWorkbook = propEditable ? null : shownWorkbook;
  // Reference bus threaded from context: a custom `ReferenceModeProvider` above the Studio scopes the
  // editable's pick state to that bus (model-side wiring can't resolve a provider itself).
  const referenceStore = useReferenceModeStore();
  const autoEditable = useMemo(
    () => {
      // Built on the selected worksheet, or the first when another kind of sheet is the active tab: the
      // editable follows the selection from there. A workbook with no worksheet has nothing to edit.
      const anchor = autoWorkbook?.getSelectedWorksheet()
        ?? autoWorkbook?.getWorksheets().getItems({ visibility: 'veryHidden' })[0];
      return anchor ? createEditable(anchor, { referenceMode: referenceStore }) : null;
    },
    [autoWorkbook, referenceStore]
  );
  const editable: SheetEditable | null = propEditable ?? autoEditable;
  // Live mirror for the (stable) studio handle's getEditable().
  const refEditable = useRef<SheetEditable | null>(editable);
  refEditable.current = editable;

  // Restore focus to the grid when a formula-bar edit ends. The formula bar is chrome OUTSIDE the grid, so
  // a keyboard commit/cancel there (Enter / Tab / Escape) — or the bar's ✕ / ✓ buttons — ends the session
  // with focus stranded in the now-idle bar; the in-grid editor needs none of this (focus is already on the
  // grid). This is a studio concern by design: it's the one place that knows BOTH the bar and the grid, so
  // returning focus (the "special case" of an out-of-grid editor) lives here as a listener — NOT in the
  // FormulaBar or the input. Gated so it only fires for a bar-driven end that would otherwise strand focus:
  //   • the ended session's active editor was the formula bar (`editorId === 'formula-bar'`), and
  //   • focus still sits inside the bar (a click-away already moved focus to the grid; a programmatic /
  //     tab-switch end moved it elsewhere — neither should be yanked to the grid).
  useEffect(() => {
    if (!editable) return undefined;
    let prev = editable.getSession();
    return editable.subscribe(() => {
      const ended = prev;
      prev = editable.getSession();
      if (!ended || prev) return; // only a session END (was a session, now idle)
      if (ended.getActiveEditorId() !== 'formula-bar') return;
      const bar = refFormulaBar.current;
      if (!(bar?.isFocusWithin?.() ?? bar?.contains?.(document.activeElement))) return;
      refWorkbook.current?.focus();
    });
  }, [editable]);

  // The display name + dirty state of the SHOWN workbook, tracked reactively. Name/identity live
  // on the workbook (its origin); the studio owns only the session dirty tracker. Drives the title
  // and the onDirtyChange prop — the visible chrome follows the visible grid, so a pending open
  // doesn't retitle the old grid early.
  const handleName = useWorkbookName(shownWorkbook);
  const { isDirty, saveState } = useWorkbookSaveState(shownWorkbook, WorkbookIO);
  // Whether the next save produces an encrypted file — intent included, so the lock appears when a
  // password is set rather than only once it has been applied.
  const isEncrypted = useWorkbookEncrypted(shownWorkbook);
  // Live probe for click-time reads (close/open confirm, the imperative isDirty()) without
  // re-registering commands on every dirty flip.
  const refSaveState = useRef(saveState);
  // The studio's own Save, published by its file commands while the store can write — what the
  // handle's `save()` runs, so a host's Save behaves exactly like the studio's.
  const refSave = useRef<((options?: StudioSaveOptions) => Promise<IWorkbookIO.Origin | null>) | null>(null);
  refSaveState.current = saveState;
  const isDirtyLive = useCallback((): boolean => refSaveState.current?.isDirty() ?? false, []);

  // Live mirror of the resolve state for the imperative `getWorkbookState()` (the handle is stable).
  const refWorkbookState = useRef(status);
  refWorkbookState.current = status;

  const [workbookLoaded, setWorkbookLoaded] = useState<WorkbookLoadEvent | null>(null);

  // Undo/redo (and the repeatable-command wiring) now live on the chromeless grid via its
  // TransactionUndoManager — the studio no longer manages them.

  // A consumer-controlled `title` prop always wins. Otherwise the displayed title follows the
  // workbook's own name (handleName: the model name, else the origin's — so opens, renames, and
  // save-as are all reflected), with an in-session manual edit layered on top.
  const controlledTitle = propTitle ?? propsDocumentTitle?.title;

  // A manual edit to the title box. Reset whenever the shown workbook changes so a freshly-opened
  // (or dropped) workbook shows its own name rather than the previous workbook's title.
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  useEffect(() => {
    setTitleOverride(null);
  }, [shownWorkbook]);

  // The effective title: explicit prop > manual override > the workbook's name.
  const titleWorkbook = controlledTitle ?? titleOverride ?? handleName ?? '';

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty]);

  // Report the live workbook so a window-owning host (tab title / beforeunload, see useStudioApp)
  // can follow it across in-app opens — the Studio owns Open/replace internally.
  const onWorkbookChange = useCallbackRef<(workbook: IWorkbook | null) => void>(propOnWorkbookChange ?? (() => {}), [propOnWorkbookChange]);
  useEffect(() => {
    onWorkbookChange?.(liveWorkbook);
  }, [liveWorkbook]);

  // Keep the current workbook reachable from the imperative handle without re-creating the
  // forwarded ref each time the workbook changes.
  const refLiveWorkbook = useRef(liveWorkbook);
  refLiveWorkbook.current = liveWorkbook;

  // Re-render the studio chrome when the shown workbook's view toggles formula-bar / status-bar
  // visibility (the grid no longer owns this chrome, so the studio listens for the view change itself).
  // `shownWorkbook` may be null pre-load; useModelSync/useModelListener guard a null source at runtime
  // (see useModelListener line ~94), but the dep types the source non-null. Cast to bridge.
  useModelSync<IWorkbook.IListeners>(shownWorkbook as IWorkbook, 'onViewChange');

  // The status bar's trailing help button. Lives at the Studio layer with the rest of the chrome.
  const helpCommandPopup = useMemo(() => {
    return (
      <CommandGroup
        groupKey="helpOptions"
        disableHover={true}
        sx={{ padding: '0' }}
        propsButton={{ sx: { maxHeight: '22px' } }} // make smaller to fit into statusbar
      />
    );
  }, []);

  // Portal target for toasts (see the `SnackbarProvider domRoot` below). This must be a STABLE element
  // that survives a workbook swap: we point it at the grid-SLOT wrapper (which lives outside the
  // workbook-keyed grids), NOT the grid's own viewport element. The viewport element is recreated when
  // the grid remounts on open (`key={workbook.getId()}`); moving notistack's portal to a fresh node
  // mid-open made an in-flight toast paint twice (the "import warning shows 2x" bug). A callback ref
  // captures the node once — the slot is stable, so this fires a single time and never moves.
  const [snackbarRootDOM, setSnackbarRootDOM] = useState<HTMLElement | null>(null);
  const setSnackbarRootRef = useCallback((node: HTMLDivElement | null): void => {
    setSnackbarRootDOM(node);
  }, []);

  // Warm the icon cache early — OFF the reveal path. Previously we `await`ed this inside
  // handleWorkbookLoad before signalling load, which both delayed the reveal AND split the panel
  // removal from the grid's opacity flip across an async boundary (flashing empty chrome). Toolbar
  // icons stream in on their own via DynamicIcon, so first paint need not wait on the prefetch.
  useEffect(() => {
    DefaultIconService.prefetch([DefaultIconService.getActive(), SHAPE_ICON_PACK]).catch((error: unknown) => {
      console.warn('Icons could not be loaded:', error);
    });
  }, []);

  // The studio tracker's INITIAL command anchor (a synthetic first focus — see FocusActivation),
  // supplied as a recallable PROVIDER. Cold-start: the deferred below resolves with the first loaded
  // grid's would-focus pane in the same call that triggers the loading reveal, so the toolbar paints
  // enabled at reveal without the grid stealing real focus. Recall: after load, the provider reads the
  // live would-focus pane so a resize that destroys the anchored pane (dropping focus to <body>) re-homes
  // the anchor instead of resolving through the orphan. Real focus advances the anchor between those.
  const refInitialAnchor = useRef<Deferred<Element | null> | null>(null);
  if (!refInitialAnchor.current) refInitialAnchor.current = makeDeferred<Element | null>();
  // The currently-loaded grid, read LIVE by the recall provider (kept current across workbook swaps).
  const refLoadedSource = useRef<IWorkbookElement | null>(null);
  // No-arg getPane(): the pane focus WOULD land on (last-focused, else center) — the surface owns that
  // policy; the studio doesn't know freeze geometry. Post-load returns a live element (cold-start +
  // recall); pre-load falls back to the deferred promise so the first resolution still gates the reveal.
  const resolveInitialCommandAnchor = useCallback((): Element | null | Promise<Element | null> => {
    const paneEl = refLoadedSource.current?.getSheetElement()?.getGridSurface()?.getPane()?.getElement();
    return paneEl ?? refInitialAnchor.current!.promise;
  }, []);

  const handleWorkbookLoad = useCallbackRef(async (event: WorkbookLoadEvent) => {
    // Activate the persisted language BEFORE prefetching, so the reveal loads and shows that language
    // — never English. `setActive` awaits the pack load and flips the active tag (which the catalog
    // service mirrors synchronously via its change listener), so the `prefetch()` below then targets
    // the right language. Without this the gate would prefetch the default (en) and flash on switch.
    const targetLanguage = refPersistedLanguage.current;
    if (targetLanguage && targetLanguage !== DefaultLanguagePackService.getActive()) {
      await DefaultLanguagePackService.setActive(targetLanguage);
    }
    // Command chrome (toolbar labels/shortcuts) is fetched, so gate the reveal on it — unlike icons
    // (which stream in via DynamicIcon), a toolbar with no labels at first paint would flash. Pass the
    // target language explicitly so the command-catalog fetch matches the message packs loaded above
    // (don't depend on the change-listener having already mirrored the active tag).
    await Command.DefaultCommandCatalogService.prefetch(targetLanguage ?? undefined);
    setWorkbookLoaded(event);
    // Keep the recall provider pointed at the live grid (survives workbook swaps).
    refLoadedSource.current = event.source;
    if (!refInitialAnchor.current!.settled) {
      // Cold-start: settle the reveal gate with the would-focus pane (same policy the provider reads).
      refInitialAnchor.current!.resolve(
        event.source.getSheetElement()?.getGridSurface()?.getPane()?.getElement() ?? null
      );
    }
    propOnFirstRender?.(event);
  }, []);

  const refDocumentTitle = useRef<IDocumentTitleElement>(null);
  const renderToolbar = useCallback((props: StudioToolbarProps) => {
    let mainElement = null;
    let optionsDocumentTitle = {
      readOnly: true,
      ...propsDocumentTitle
    }
    if (!propsDocumentTitle?.hidden) {
      mainElement = (
        <DocumentTitle
          {...optionsDocumentTitle}
          style={{
            maxWidth: '100%',
            ...propsDocumentTitle?.style
          }}
          // Prefer the element handed in by the caller (`workbookLoaded.source` — fresh even on the
          // pending-swap promotion frame, where `refWorkbook` still points at the old grid).
          workbook={props.workbook ?? refWorkbook.current}
          ref={refDocumentTitle}
          title={titleWorkbook}
          modified={isDirty}
          encrypted={isEncrypted}
          placeHolder={titlePlaceHolder}
          onTitleChange={(title) => {
            setTitleOverride(title);
            // The consumer's own title-box callback (for an editable title); the studio-level
            // onWorkbookTitleChange was dropped — the document name covers the rest via onDocumentChange.
            propsDocumentTitle?.onTitleChange?.(title);
          }}
        />
      );
    }
    return (
      <StudioToolbar
        {...props}
        logo={logo}
        mainElement={mainElement}
        startElement={propTopLeft}
        endElement={propTopRight}
      />
    );
  }, [logo, titleWorkbook, isDirty, isEncrypted, propsDocumentTitle, propTopLeft, propTopRight]);

  useEffect(() => {
    // TODO - should this be moved to app.tsx
    // Disabled the wheel mouse. Not needed but since we have a zoom this can cause confusion if applied on toolbar/status/etc.
    // Re-attached per load event: the shown grid ELEMENT changes on an in-app open (pending-workbook
    // swap), so a mount-once attach would leave the promoted grid without the handler. The element is
    // captured for cleanup (refWorkbook may already point at the next grid by then).
    const element = refWorkbook.current;
    if (!element) return undefined;
    // A scrolling element inside (a list in a slicer) still takes a plain wheel, as the grid's pane allows.
    const handleWheel = (e: globalThis.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && ScrollUtils.getWheelOwner(e, element) === 'native') return;
      e.preventDefault();
    };
    element.addEventListener("wheel", handleWheel, { passive: false });

    // const handleTouch = (e: globalThis.TouchEvent) => e.preventDefault();
    // element.addEventListener("touchstart", handleTouch, { passive: false });

    return () => {
      element.removeEventListener("wheel", handleWheel);
    };
  }, [workbookLoaded]);

  // The SHOWN workbook's own `workbook` command scope — owned by its `WorkbookElement` (per
  // GRID-BUFFERING-PLAN: each grid owns its scope + undo manager for safe double-mount). The task-pane
  // area is hoisted OUT of the workbook-keyed grid (so it survives a workbook swap), which also takes it
  // out of that scope's React-context reach; we bridge the shown grid's scope back to it here so the
  // panes resolve workbook commands (insertFunction / executeScript / undo / redo) against the shown
  // workbook. Re-read per load event — the shown grid element changes on a swap.
  const [shownWorkbookScope, setShownWorkbookScope] = useState<Command.CommandScope | null>(null);
  useEffect(() => {
    setShownWorkbookScope(workbookLoaded?.source?.getCommandScope?.() ?? null);
  }, [workbookLoaded]);

  const localSX = useMemo(() => {
    return {
      '& .SnackbarContainer-root': {
        position: 'absolute !important',
      },
      '& .notistack-SnackbarContainer > div': {
        maxWidth: 'min(100%, 720px)',
      },
      '& .notistack-Snackbar': {
        minWidth: 'unset'
      },
      '& .notistack-Snackbar > .error-snackbar .MuiTypography-root': {
        color: (theme: Theme) => {
          return theme.palette.getContrastText(theme.palette.error.main);
        }
      },
      '& .notistack-Snackbar > .error-snackbar .MuiCardActions-root': {
        color: (theme: Theme) => {
          return theme.palette.getContrastText(theme.palette.error.main);
        }
      },
      '& .notistack-Snackbar > .error-snackbar .MuiButtonBase-root': {
        color: (theme: Theme) => {
          return theme.palette.getContrastText(theme.palette.error.main);
        }
      },
      '& .notistack-MuiContent *': {
        fontFamily: (theme: Theme) => {
          return theme.typography.fontFamily
        },
      },
      '& #notistack-snackbar': {
        maxWidth: '560px',
        whiteSpace: 'pre-wrap'
      },
      '*': {
        userSelect: 'none'
      },
    }
  }, []);

  // TODO - roll this into StudioSplitPane and convert to a DockingPaneManager
  const [sideBar, setSideBar] = useState<React.ReactElement | null>(null);

  // Task-pane layout is kept as two INDEPENDENT persisted states so we can decide (after living with it)
  // whether each should survive a session:
  //  - position: the resized split. Self-managed by StudioSplitPane via `persistKey` below (stored as a
  //    per-slot map so a horizontal drag is remembered separately from a vertical one).
  //  - visibility: whether a pane is open. Intentionally NOT persisted yet (key `null` = plain useState);
  //    flip the key on to opt in. NOTE: restoring visibility also needs the TaskPaneProvider to reopen the
  //    last pane(s) on load, so this should become the ordered array of open pane names (panes activate by
  //    name) rather than a boolean; for now it just records that something is open.
  const [, setTaskPaneVisible] = usePersistentState<boolean>(/* LayoutStateKey.TaskPaneVisible */ null, false);
  useEffect(() => {
    setTaskPaneVisible(sideBar != null);
  }, [sideBar, setTaskPaneVisible]);
  const renderTaskArea = useCallback((props: TaskPaneAreaProps) => {
    return propRenderTaskPaneArea({
      model: shownWorkbook,
      side: taskPaneSide,
      ...props,
      ...propsTaskPaneArea
    })
  }, [shownWorkbook, taskPaneSide, propsTaskPaneArea]);

  // NOTE: the task-pane split pane is no longer a per-grid `wrapperMain`. It is rendered once at the
  // content level (see `localRenderWorkbook`) so the task-pane area lives OUTSIDE the workbook-keyed
  // grids and survives a workbook swap. Both grids render plain into its shared main slot.

  // The studio root (`host`, rendered by Studio) is its own DOM element that *contains* the workbook
  // grid (held by `refWorkbook`, assigned where the WorkbookElement is rendered). The handle delegates the ergonomic accessors to
  // that grid; identity (name/origin) is read off the workbook itself, dirty off the studio's save
  // state. Stable for the element's lifetime.
  const refHost = useRef(host);
  refHost.current = host;
  useImperativeElement<IStudioElement, IStudioAttributes>(refForwarded, () => ({
    isStudioElement: () => true,
    save: (options?: StudioSaveOptions): Promise<IWorkbookIO.Origin | null> => {
      const save = refSave.current;
      // i18n-exempt: developer invariant — a host saving through a store that cannot write.
      if (!save) return Promise.reject(new Error('The studio cannot save: no workbook, or the backing store cannot write.'));
      return save(options);
    },
    getWorkbookElement: () => refWorkbook.current,
    getWorkbook: (): IWorkbook | null => refLiveWorkbook.current ?? null,
    isDirty: (): boolean => refSaveState.current?.isDirty() ?? false,
    getEditable: () => refEditable.current,
    getFormulaBarElement: () => refFormulaBar.current ?? null,
    focus: (): void => refWorkbook.current?.focus(),
    whenReady: (): Promise<IWorkbook> => {
      if (!refReady.current) refReady.current = makeDeferred<IWorkbook>();
      return refReady.current.promise;
    },
    getWorkbookState: (): WorkbookLoadState => refWorkbookState.current,
    retry: (): void => setRetryNonce((n) => n + 1),
  }), [], host);

  // Promote the pending grid once its first screen has finished drawing (its `onRenderSettled`, which
  // already waits for the paint): flip it to shown — the old grid unmounts — and complete the normal
  // load handshake (viewport DOM / load event / chrome rebind). Promoting at its first render instead
  // exposed an empty surface, then pictures and charts filling in. Focus is restored onto the
  // promoted grid only when it was inside the studio (the unmounting grid would otherwise drop it on
  // `body`), and only AFTER the visibility flip commits (a `visibility:hidden` element is not
  // focusable), hence the effect.
  const refFocusOnPromote = useRef(false);
  const handlePendingSettled = useCallbackRef(async (event: WorkbookRenderSettledEvent, workbook: IWorkbook) => {
    if (workbook !== refPendingModel.current) return; // superseded by a newer open — this grid is unmounting
    refFocusOnPromote.current = refHost.current?.contains(document.activeElement) ?? true;
    setShownWorkbook(workbook);
    await handleWorkbookLoad(event);
    propOnRenderSettled?.(event);
  }, []);
  useEffect(() => {
    if (!refFocusOnPromote.current) return;
    refFocusOnPromote.current = false;
    refWorkbook.current?.focus();
  }, [shownWorkbook]);

  // We show the loading panel
  const localRenderWorkbook = useCallback((props: WorkbookElementProps) => {
    const {
      ref: propRenderRef,
      ...restRenderProps
    } = props;
    const appTheme = isDarkMode ? resolvedThemes.dark : resolvedThemes.light;

    // Error panel. Before anything was shown (an initial-load failure) it replaces everything
    // (no chrome / grid). With a grid already committed (a failed in-app open) it renders ON TOP of
    // the old grid instead (below) — the shown grid is never dropped, and a `retry()` swaps in the
    // reloaded workbook through the normal pending path.
    const errorPanel = status.status === 'error' && propRenderDocumentError ? <RenderSlot render={propRenderDocumentError} props={{
      ...propsDocumentError,
      style: {
        width: '100%',
        height: '100%',
        ...propsDocumentError?.style
      },
      error: status.error
    }} /> : null;
    if (errorPanel && !shownWorkbook) {
      return (
        <Paper
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'stretch',
            // padding: '16px',
          }}
        >
          {errorPanel}
        </Paper>
      );
    }

    // Chrome (toolbar / formula bar / status bar) is composed here, around the chromeless grid; it
    // shares the studio command root so it resolves the workbook commands. Rendered only once a
    // workbook is COMMITTED (shown) — the chrome always matches the visible grid, not an inflight load.
    let content: React.ReactNode = null;
    if (shownWorkbook) {
      const workbookModel = shownWorkbook;
      const view = workbookModel.getView();
      const showFormulaBar = propShowFormulaBar ?? view?.isShowFormulaBar();
      const showStatusBar = propShowStatusBar ?? view?.isShowStatusBar();

      // The grid element (and its sheet element) become available once the grid has rendered; this
      // callback re-runs on `workbookLoaded` so the chrome picks them up. The event's `source` (the
      // element that just loaded) is preferred over the ref: on a promotion this render happens in
      // the same commit that re-attaches `refWorkbook`, so the ref still points at the OLD grid here.
      const workbookElementCurrent = workbookLoaded?.source ?? refWorkbook.current;

      const toolbar = <RenderSlot<StudioToolbarProps> render={propRenderToolbar === undefined ? renderToolbar : propRenderToolbar} props={{
        workbook: workbookElementCurrent,
        ...propsToolbar
      }} />;

      // Above the grid the larger margin faces the grid; under the status bar the block takes the
      // toolbar's margins so the two ends of the studio match.
      const barAtBottom = formulaBarPlacement === 'bottom';
      const formulaBar = showFormulaBar ? <RenderSlot render={propRenderFormulaBar === undefined ? defaultRenderFormulaBar : propRenderFormulaBar} props={{
        ref: refFormulaBar,
        style: {
          marginTop: appTheme.spacing(barAtBottom ? 0.5 : 0.25),
          marginLeft: appTheme.spacing(1),
          marginRight: appTheme.spacing(1),
          marginBottom: appTheme.spacing(barAtBottom ? 0.5 : 0.75)
        },
        workbook: workbookModel,
        editable: editable ?? undefined,
        placement: formulaBarPlacement,
        // `'float'`: the bar at the bottom edits on top of the virtual keyboard.
        floatOnKeyboard: keyboardRoom === 'float',
        ...propsFormulaBar,
        // `workbook` is injected by FormulaBar; this override is intentionally partial. FormulaBarProps
        // types it as the full (workbook-required) NamedCollectionEditorProps, so cast to bridge.
        propsNamedCollectionEditor: {
          restoreFocus: (options?: FocusOptions) => workbookElementCurrent?.focus(options),
          ...propsFormulaBar?.propsNamedCollectionEditor
        } as any
      }} /> : null;

      const statusBar = showStatusBar ? <RenderSlot render={propRenderStatusBar === undefined ? defaultRenderStatusBar : propRenderStatusBar} props={{
        childrenEnd: helpCommandPopup,
        ...propsStatusBar
      }} /> : null;

      // One grid per live workbook, keyed by the workbook id, so the pending→shown promotion is a
      // props/visibility flip on the SAME element (the pre-paint isn't wasted), and the old grid
      // unmounts by key. The pending grid is stacked over the shown one `visibility:hidden` — a real
      // laid-out box (it must measure and paint so `onRenderSettled` fires; `display:none` would
      // deadlock the swap) — takes no focus, no shared editable, and no drop-zone/consumer ref.
      const renderGrid = (workbook: IWorkbook, pending: boolean): React.ReactElement => {
        return (
          <WorkbookElement
            key={workbook.getId()}
            // Consumer grid customizations first; studio-managed props below win.
            {...propsWorkbook}
            tabIndex={0}
            // Delegate autofocus to the grid; it focuses the sheet surface once loaded. The pending
            // grid must never take focus while hidden; promotion restores focus explicitly instead.
            autoFocus={pending ? false : propAutoFocus}
            workbook={workbook}
            editable={pending ? undefined : (editable ?? undefined)}
            // The name-box focus bridge now rides the per-workbook command scope (owned by WorkbookElement),
            // so it's threaded to WorkbookElement rather than the (removed) studio-level sheet bridge.
            focusNameBox={pending ? undefined : focusNameBox}
            prefetch={pending ? false : propPrefetch}
            ref={pending ? refPendingWorkbook : mergeRefs([propRenderRef, refWorkbook])}
            onWorkbookLoad={pending ? undefined : handleWorkbookLoad}
            onRenderSettled={pending
              ? (event: WorkbookRenderSettledEvent) => { void handlePendingSettled(event, workbook); }
              : propOnRenderSettled}
            // commands={commandsStudio}
            onKeyDown={(e: React.KeyboardEvent<any>) => {
              propOnKeyDown?.(e);
            }}
            propsWorkbookLoading={propsLoading}
            // The studio shows a single loading overlay (below); the grid omits its own panel.
            // The studio shows a single overlay (below) over both the model-resolve and grid
            // first-paint phases, so the grid shows none of its own.
            renderWorkbookLoading={null}
            // No per-grid task-pane wrapper: the split pane (with the sidebar) is hoisted OUT of the
            // workbook-keyed grids to the content level (below), so the task-pane area persists across
            // a workbook swap instead of remounting empty. Both grids render into the shared main slot;
            // the pending grid overlays absolutely within it (so it already excludes the sidebar width).
            style={pending
              // The stacking/hidden styles must WIN over consumer styles on the pending grid (the
              // swap depends on them); the shown grid keeps the usual consumer-wins order.
              ? { ...propsWorkbook?.style, position: 'absolute', inset: 0, visibility: 'hidden' }
              : { flex: '1 1 100%', minHeight: 0, ...propsWorkbook?.style }}
            // standalone application turns off context menu
            onContextMenu={(e: React.MouseEvent<any>) => e.preventDefault()}
            {...(pending ? null : restRenderProps)}
          />
        );
      };

      content = (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 100%',
            minWidth: 0,
            minHeight: 0,
          }}
        >
          {orderStudioChrome(formulaBarPlacement, { toolbar, formulaBar, statusBar, main: (
          /* The task-pane split pane lives HERE (outside the workbook-keyed grids) so the task-pane
              area persists across a workbook swap. Its main slot holds the grid slot; the sidebar is
              the (stable) task-pane element. `sidebarElement` is null until a pane is first opened. */
          <StudioSplitPane
            taskSide={taskPaneSide}
            persistKey={LayoutStateKey.TaskPanePosition}
            // Bridge the shown workbook's command scope to the hoisted sidebar so its panes resolve
            // workbook commands (the sidebar renders outside the grid's scope). Only wrap when a pane
            // is open (a non-null provider element would otherwise read as a populated sidebar).
            // Deliberately NO `elementRef`: the sidebar RESOLVES workbook commands (its buttons) but is
            // not part of the workbook's region — a keystroke born in a task-pane field must not reach
            // them, which is the whole reason the workbook scope bounds itself to the grid.
            sidebarElement={sideBar ? (
              <Command.CommandScopeProvider scope={shownWorkbookScope}>
                {sideBar}
              </Command.CommandScopeProvider>
            ) : undefined}
            mainElement={(
              /* The grid slot: the shown grid fills it (flex child); a pending grid overlays the same
                 box hidden until its first paint promotes it. Rendered as an ARRAY so React matches the
                 children by key across positions — promotion moves the pending element to the shown
                 slot as a props update on the same (already-painted) instance, not a remount. */
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: '1 1 100%', minWidth: 0, minHeight: 0 }}>
                {[renderGrid(shownWorkbook, false), pendingWorkbook ? renderGrid(pendingWorkbook, true) : null]}
                {/* Stable toast host (the SnackbarProvider `domRoot`, see `snackbarRootDOM`). Mirrors the
                    grid's own `.sheetxl-viewport` overlay we used to portal into: a full-box, pointer-events
                    -none layer whose first child (notistack's SnackbarContainer, `position:fixed` by default)
                    is pinned `relative` so toasts sit within the GRID, not the page. Living in the (stable)
                    grid slot rather than the grid means it survives a workbook swap — the moving portal
                    target was what double-painted the import-warning toast. */}
                <Box
                  ref={setSnackbarRootRef}
                  sx={{
                    position: 'absolute',
                    // Start the toast host ~10% down the grid rather than flush with the top: top-anchored
                    // toasts (the studio enqueues them `top`/`center`) then sit partially down the view.
                    // The remaining 80% is ample for the stack; a very short grid just gets a small offset.
                    top: '10%',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    pointerEvents: 'none',
                    // notistack's SnackbarContainer is `position:fixed` by default; the studio's `localSX`
                    // pins it `absolute`, so it anchors to THIS overlay (20% down), not the page.
                    '& > :first-of-type': { position: 'relative' }
                  }}
                />
              </div>
            )}
          />
          ) })}
        </div>
      );
    }

    // Loading overlay for the model-resolve + grid first-paint phases. The lazy {@link Studio} wrapper
    // passes `null` (it owns a single startup panel), so this shows only for direct EagerStudio use.
    const loadingOverlay = !workbookLoaded && propRenderLoading ? <RenderSlot render={propRenderLoading} props={{ ...propsLoading }} /> : null;

    return (
      <Paper
        sx={localSX}
        style={{
          width: '100%',
          height: viewportInset ? `calc(100% - ${viewportInset}px)` : '100%',
          transform: viewportOffsetTop ? `translateY(${viewportOffsetTop}px)` : undefined,
          position: 'absolute',
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'stretch',
          backgroundColor: 'var(--sxl-color-base-200)',
          // padding: '16px',
        }}
        className="eager-studio"
        square={propsSquare} // paperProps
        elevation={propElevation} // paperProps
        variant={propVariant}  // paperProps
      >
        {content}
        {/* A failed in-app open: the error panel covers the (still-committed) old grid; a retry
            resolves through the normal pending swap underneath it. */}
        {errorPanel ? (
          <Paper
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'stretch',
            }}
          >
            {errorPanel}
          </Paper>
        ) : null}
        {/* Opaque loading overlay (hides the chrome until the grid has rendered); background matches
            the Studio wrapper's startup panel. Only shown for direct EagerStudio use — the Studio
            wrapper passes `null` and owns a single panel instead. */}
        {loadingOverlay ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `var(--sxl-color-base-100, ${isDarkMode ? '#121212' : '#fff'})`
            }}
          >
            {loadingOverlay}
          </div>
        ) : null}
      </Paper>
    );
  }, [
    status, shownWorkbook, pendingWorkbook, workbookLoaded, titleWorkbook, propRenderLoading, propsLoading,// commandsStudio,
    propsWorkbook, propsSquare, propElevation, propVariant, helpCommandPopup,
    propRenderDocumentError, propsDocumentError, renderToolbar, localSX, sideBar, taskPaneSide, shownWorkbookScope, // sidebar hoisted into content
    propShowFormulaBar, propsFormulaBar, propRenderFormulaBar, formulaBarPlacement, editable, propShowStatusBar, propsStatusBar,
    propRenderStatusBar, propsToolbar, propRenderToolbar, keyboardRoom, viewportInset, viewportOffsetTop,
    resolvedThemes, isDarkMode // theme drives the appTheme
  ]);

  // TODO - this need to be configurable by external props
  let retValue = (
    <SnackbarProvider
      maxSnack={3}
      // Render toasts inside the (stable) grid-slot element so they sit over the grid area. This must be
      // a node that persists across a workbook swap — see `snackbarRootDOM`. (Previously this was the
      // grid's own viewport element, which remounts on open and made an in-flight toast paint twice.)
      domRoot={snackbarRootDOM ?? undefined}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      autoHideDuration={3500} // Disable auto-hide for error notifications so users can interact with stack traces
      onClose={(_event: React.SyntheticEvent<any> | null, _reason: CloseReason, _key?: SnackbarKey) => {
        refWorkbook.current?.focus();
      }}
      Components={{
        error: ToastError
      }}
      iconVariant={{
        success: (
          <SvgIcon // The default success icon is more consistent (circle with a check but this is the default material)
            style={{ marginRight: '8px' }}
          >
            <path d="M20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4C12.76,4 13.5,4.11 14.2, 4.31L15.77,2.74C14.61,2.26 13.34,2 12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0, 0 22,12M7.91,10.08L6.5,11.5L11,16L21,6L19.59,4.58L11,13.17L7.91,10.08Z"/>
          </SvgIcon>)
        ,
        error: (
          <DynamicIcon iconKey="ErrorAlert"
            style={{ marginRight: '8px' }}
          />
        ),
      }}
    >
        {/* The ambient workbook + the file-IO commands follow the SHOWN document (the visible grid),
            not an inflight load — a pending open leaves them on the old workbook until its grid is
            promoted. Above the task-pane/modal/notifier hosts ON PURPOSE: dialogs and task panes are
            workbook consumers too (a `FormulaField` in the insert-table dialog resolves + picks via
            `useWorkbook()`), and modal windows mount at the ModalProvider's level in the tree. */}
        <WorkbookProvider
          workbook={shownWorkbook as IWorkbook}
        >
        <TaskPaneProvider // moved down
          renderArea={renderTaskArea}
          onUpdateArea={(areaElement) => {
            setSideBar(areaElement as any);
          }}
        >
          <ModalProvider>
            <StudioNotifierProvider>
              <UncaughtErrorBoundary>
                <ReactErrorBoundary>
                  {/* CommandProvider */}
                  <CommandsWrapper
                    workbook={shownWorkbook as IWorkbook}
                    initialCommandAnchor={resolveInitialCommandAnchor}
                    renderWorkbook={localRenderWorkbook}
                    setWorkbook={replaceWorkbook}
                    titleWorkbook={titleWorkbook}
                    setWorkbookTitle={setTitleOverride}
                    refDocumentTitle={refDocumentTitle}
                    isDirty={isDirtyLive}
                    refSave={refSave}
                    host={host}
                  />
                </ReactErrorBoundary>
              </UncaughtErrorBoundary>
            </StudioNotifierProvider>
          </ModalProvider>
        </TaskPaneProvider>
        </WorkbookProvider>
    </SnackbarProvider>
  )
  retValue = (
    <ThemeProvider theme={isDarkMode ? resolvedThemes.dark : resolvedThemes.light}>
      { propCssBaseline ? <CssBaseline/> : null }
      {/* The `(token × surface × mode)` matrix as attribute rules. Inline (NOT a hoisted `href` resource)
          so an `enableDarkGrid` toggle updates it in place instead of minting a duplicate stale sheet in
          <head>. Rules are global selectors, so floats re-applying
          `data-sxl-theme-*` across their portal still resolve them. */}
      <ThemeStyle css={themeCSS} />
      {/* The studio is a theme root: defaults and system colors, `@scope`d to it. Floats carry the studio's
          scope class, so portaled pickers and menus resolve them too. */}
      <ThemeRootStyles scopeClass={scopeClass} />
      {/* Floats carry the studio's theme (design §7): its scope class (so the `@scope`d studio sheet
          resolves on the portaled wrapper), the app surface, and the app's mode — so a picker/menu opened
          from anywhere in the studio (incl. a light grid in a dark app) opens on the dark app surface. The
          grid adds no FloatProvider, so it inherits this. */}
      <ExhibitFloatProvider
        themeScopeClass={scopeClass}
        themeSurface="app"
        themeMode={themeMode}
      >
        {retValue}
      </ExhibitFloatProvider>
    </ThemeProvider>
  );
  return retValue;
}));

// export as both named and default
EagerStudio.displayName = "EagerStudio";
export default EagerStudio;


const defaultRenderTaskPaneArea = (props: TaskPaneAreaProps): React.ReactElement<ITaskPaneAreaElement> => {
  return <StudioTaskPaneArea {...props} />;
}