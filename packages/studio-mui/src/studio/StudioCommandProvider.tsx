import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useMediaQuery } from '@mui/material';

import { DefaultLanguagePackService, defineLazyModule, formatMessage, type LanguageTag } from '@sheetxl/utils';

import { type IWorkbook } from '@sheetxl/sdk';

import {
  useCallbackRef, useNotifier, usePersistentState, useFullscreen, Command, useResolvedThemeMode,
  useTranslator, LanguageStateKey, type ThemeMode
} from '@sheetxl/utils-react';

import { ThemeStateKey, ThemeStateDefaults, useTaskPaneArea, type WorkbookInput } from '@sheetxl/react';

import { lazyModal, useModal } from '@sheetxl/utils-mui';

import {
  contributeStudioCommands, contributeStudioAppearance, contributeStudioFullScreen,
  contributeStudioIOCommands, contributeStudioLanguage, contributeStudioProtection, type StudioIODeps
} from './StudioCommands';
import { type IStudioAttributes } from './StudioProps';
import { registerStudioCommandCatalogs } from '../command';
import { type ShortcutKeysCommand, type ShortcutKeysCommandSource } from '../dialog/ShortcutKeysPanel';
import { TemplatesPlugin } from '../template/TemplateCommands';

const LazyShortcutKeysDialog = lazyModal(
  defineLazyModule('studio:shortcutKeysDialog', () => import('../dialog/ShortcutKeysDialog')).load
);

// App-init: seed the studio command chrome catalog (idempotent).
registerStudioCommandCatalogs();
// The workbook templates feature, registered through the plugin path like any third-party feature.
TemplatesPlugin();

/**
 * Present the command **catalog** — every command in the flat named {@link Command.CommandRegistry},
 * independent of which instances are mounted — as a {@link ShortcutKeysCommandSource} for the shortcut
 * dialog. Reads the registry directly (not `root.collectKeys()`), so it's instance-independent and
 * includes the sheet/workbook commands even when no instance is mounted. Each record carries its home
 * **name** as `groupKey` — the catalog's scope column ("available from this level and deeper").
 */
/** Catalog scopes that carry chrome for RENDERING SURFACES (button/panel/tab entries), not commands —
 *  same catalog format, but they have no behavior and must not pollute the shortcut list. */
const NON_COMMAND_SCOPES = new Set(['ui']);

const createCatalogCommandsSource = (registry: Command.CommandRegistry): ShortcutKeysCommandSource => {
  // Chrome is normally a literal from the catalog, but a legitimately DYNAMIC contribution supplies a
  // function instead — the per-format `saveWorkbookAs<Fmt>` labels (dynamic command keys, so no static
  // entry can exist) and the table structural overrides (whose wording tracks the selection). Those
  // functions read their own closures, not this call's arguments, so evaluate one: skipping it listed
  // the command by its raw KEY. Defensive, because a dynamic value MAY expect the live command context
  // this pre-mount surface has none of — a throw just falls back to undefined.
  const stat = <T,>(v: T | ((...a: any[]) => T) | undefined): T | undefined => {
    if (typeof v !== 'function') return v as T;
    try { return (v as (...a: any[]) => T)(); } catch { return undefined; }
  };
  // This is a "pre-mount surface": it reads chrome from the catalog without a live command instance, so
  // it must format parameterized (ICU-subset) labels — `{dark, select, …}`, `{n, plural, …}` — itself,
  // using the catalog's `params` DEFAULTS (`ChromeRecord.params`). Without live params, `formatMessage`
  // still resolves to the `other` branch, so a template never leaks raw into the reference list.
  const chrome = (v: unknown, params: Record<string, unknown> | undefined): string | undefined => {
    const raw = stat(v) as string | undefined;
    return typeof raw === 'string' ? formatMessage(raw, params, DefaultLanguagePackService.getActive()) : undefined;
  };
  const commands: { command: ShortcutKeysCommand; groupKey: string }[] = [];
  for (const name of registry.names()) {
    if (NON_COMMAND_SCOPES.has(name)) continue;
    // The registry IS the catalog: every registered command shows here (incl. ones like the editor's that
    // only *resolve* while their scope contributes dynamically — see CommandScope.resolve).
    for (const key of registry.keys(name)) {
      const def = registry.resolveDefinition(name, key);
      commands.push({
        groupKey: name,
        command: {
          getLabel: () => chrome(def?.label, def?.params) ?? key,
          getIcon: () => stat(def?.icon),
          getDescription: () => chrome(def?.description, def?.params) ?? '',
          getShortcut: () => stat(def?.shortcut) ?? null,
          getScope: () => name,
          getScopeLabel: () => Command.DefaultCommandCatalogService.getScopeLabel(name)
        }
      });
    }
  }
  return { getAllCommands: () => commands };
};

/** Studio app-shell state the bridge threads into the file-I/O commands (from `CommandsWrapper`). */
export interface StudioCommandProviderProps {
  children: ReactNode;
  /** The active workbook. */
  workbook: IWorkbook;
  /** Replace the current workbook (open pairs the new model with its read origin). */
  setWorkbook: (input: WorkbookInput) => void;
  /** Suggested filename stem when a save prompts for a destination. */
  workbookTitle?: string | null;
  /** Live unsaved-changes probe (read at click time) — drives close/open confirm. */
  isDirty?: () => boolean;
  /** Receives the studio's Save, for {@link IStudioAttributes.save}. */
  refSave?: StudioIODeps['refSave'];
  /**
   * The element the fullscreen toggle makes fullscreen — the studio root, so the studio fills the screen
   * rather than the host page.
   *
   * @defaultValue `document.documentElement`
   */
  fullscreenTarget?: HTMLElement | null;
}

/**
 * **Studio command bridge** — the studio slice. Registers the studio catalog + contributes help /
 * shortcuts / appearance **and the file-I/O commands** (`contributeStudioIOCommands`) onto the app-root
 * scope, so the studio buttons + shortcut dialog resolve. The dialog is fed the command **catalog** (all
 * commands), not a single group.
 */
export const StudioCommandProvider = (props: StudioCommandProviderProps): ReactNode => {
  const { children, workbook, setWorkbook, workbookTitle, isDirty, refSave, fullscreenTarget } = props;
  const scope = Command.useCommandScope();
  const notifier = useNotifier();
  const { showModal } = useModal();
  const t = useTranslator();

  // Live dirty ref so close/open confirm read the current value at click time without re-registering.
  const refIsDirty = useRef<(() => boolean) | undefined>(isDirty);
  refIsDirty.current = isDirty;

  const showShortcuts = useCallbackRef((): void => {
    const registry = scope?.getRoot().getRegistry();
    if (!registry) return;
    const modal = showModal(LazyShortcutKeysDialog, {
      title: t('dialog.shortcutKeys.title'),
      commands: createCatalogCommandsSource(registry),
      onDone: () => modal.hide(),
      onLoadError: (error: unknown) => {
        modal.destroy();
        notifier.showError(error as Error);
      }
    });
  }, [scope, showModal]);

  // Studio chrome is seeded at module init via `registerStudioCommandCatalogs()` (top of file); behavior
  // stays contributed on the root scope by the effects below, and the cascade merges chrome + behavior.

  useEffect(() => {
    if (!scope) return undefined;
    // Behavior only — chrome lives in the registry (seeded above), so `contribution.remove()` on cleanup
    // no longer strips it; the per-effect re-seed is gone.
    const contribution = scope.getRoot().contribution();
    contributeStudioCommands(contribution, { showShortcuts });
    return () => contribution.remove();
  }, [scope, showShortcuts]);

  // Appearance toggles — this bridge owns the persisted prefs (shared with the studio via the same keys),
  // so the theme/dark-grid/dark-image commands work. Re-contributes state on change.
  const systemDefaultDark = useMediaQuery('(prefers-color-scheme: dark)');
  const { themeMode: resolvedMode } = useResolvedThemeMode();
  const [mode, setMode] = usePersistentState<ThemeMode | null>(ThemeStateKey.Mode, ThemeStateDefaults[ThemeStateKey.Mode]);
  const [enableDarkGrid, setEnableDarkGrid] = usePersistentState<boolean>(ThemeStateKey.DarkGrid, ThemeStateDefaults[ThemeStateKey.DarkGrid]);
  const [enableDarkImages, setEnableDarkImages] = usePersistentState<boolean>(ThemeStateKey.DarkImages, ThemeStateDefaults[ThemeStateKey.DarkImages]);
  useEffect(() => {
    if (!scope) return undefined;
    const root = scope.getRoot();
    // Behavior only — the appearance keys' chrome (labels/descriptions) lives in the registry (seeded once),
    // so the key-level `contribution.remove()` on cleanup no longer strips it. The former per-run re-seed is gone.
    const contribution = root.contribution();
    const isDark = mode === 'dark' || (!mode && resolvedMode === 'dark');
    contributeStudioAppearance(contribution, {
      mode, setMode, isDark, systemDefaultDark, enableDarkGrid, setEnableDarkGrid, enableDarkImages, setEnableDarkImages
    });
    return () => contribution.remove();
  }, [scope, mode, resolvedMode, systemDefaultDark, enableDarkGrid, enableDarkImages, setMode, setEnableDarkGrid, setEnableDarkImages]);

  // UI language — a PERSISTED user preference (same provider/store as the appearance keys above, so
  // a host — e.g. the VS Code extension, whose store bridges to the extension host — can seed or
  // override it the way it drives `themeMode`). The pack service singleton stays the runtime
  // authority; the persisted value is the preference, applied by the effect below.
  const [language, setLanguage] = usePersistentState<LanguageTag | null>(LanguageStateKey.Active, null);
  const [activeLanguage, setActiveLanguage] = useState<LanguageTag>(() => DefaultLanguagePackService.getActive());
  useEffect(() => DefaultLanguagePackService.addChangeListener(setActiveLanguage), []);
  // Apply the preference — the initial restore and any external write (another tab, the host store).
  // `null` = no preference: the service default stands.
  useEffect(() => {
    if (language && language !== DefaultLanguagePackService.getActive()) {
      void DefaultLanguagePackService.setActive(language);
    }
  }, [language]);
  useEffect(() => {
    if (!scope) return undefined;
    const contribution = scope.getRoot().contribution();
    contributeStudioLanguage(contribution, {
      active: activeLanguage,
      // Persist only — the apply-effect above is the single path onto the service.
      setActive: (tag: string) => { setLanguage(tag as LanguageTag); }
    });
    return () => contribution.remove();
  }, [scope, activeLanguage, setLanguage]);

  // Fullscreen (studio/app-shell concern) — targets the studio root, so it lives here, not in the workbook
  // bridge. Re-runs on state change to keep the icon/enablement live. Re-seeds
  // the studio chrome first: the F11 shortcut lives in the catalog, and the key-level `contribution.remove()`
  // below would otherwise strip it (the undo/workbook re-seed hazard).
  const refFullscreenTarget = useMemo(() => ({ current: fullscreenTarget ?? null }), [fullscreenTarget]);
  const { isFullscreenAvailable, isFullscreenEnabled, toggleFullscreen } = useFullscreen({ target: refFullscreenTarget });
  useEffect(() => {
    if (!scope) return undefined;
    // Behavior only — the F11 chrome lives in the registry (seeded once), so `contribution.remove()` no
    // longer strips it. The former per-run re-seed is gone.
    const contribution = scope.getRoot().contribution();
    contributeStudioFullScreen(contribution, { isFullscreenAvailable, isFullscreenEnabled, toggleFullscreen });
    return () => contribution.remove();
  }, [scope, isFullscreenAvailable, isFullscreenEnabled, toggleFullscreen]);

  /* Protect Workbook — a pane opener, so it needs the task-pane area rather than the workbook.
     `ignoreUpdates` because only the WRITE side (`activate`) is used: re-rendering this provider on
     every pane switch would re-run every contribution below it. */
  const taskPaneArea = useTaskPaneArea(true);
  useEffect(() => {
    if (!scope) return undefined;
    const contribution = scope.getRoot().contribution();
    contributeStudioProtection(contribution, (key, options) => taskPaneArea.activate(key, options));
    return () => contribution.remove();
  }, [scope, taskPaneArea]);

  // File-I/O commands (new/open/save/saveAs/close). Re-runs on workbook / setWorkbook / title change;
  // dirty is read live via `refIsDirty` (not a dep), so dirty-state changes don't re-register.
  useEffect(() => {
    if (!scope || !workbook) return undefined;
    const contribution = scope.getRoot().contribution();
    const dispose = contributeStudioIOCommands(contribution, {
      workbook,
      setWorkbook,
      workbookTitle: workbookTitle ?? undefined,
      isDirty: () => refIsDirty.current?.() ?? false,
      notifier,
      refSave
    });
    return () => { dispose(); contribution.remove(); };
  }, [scope, workbook, setWorkbook, workbookTitle, notifier, refSave]);

  return children;
};

StudioCommandProvider.displayName = 'StudioCommandProvider';
