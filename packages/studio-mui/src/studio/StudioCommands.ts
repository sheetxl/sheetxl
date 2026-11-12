import { CommonUtils, DOMUtils, type RemoveListener, t, messageKey } from '@sheetxl/utils';

import { type IWorkbook, type IWorkbookIO } from '@sheetxl/sdk';

import {
  NotifierType, type Command, type IReactNotifier, type BusyHandle, type ThemeMode,
  type OptionInput
} from '@sheetxl/utils-react';

import {
  TaskPaneKey, WorkbookIO, type WorkbookInput, type ActivateFrameOptions, type ProtectionPaneArgs
} from '@sheetxl/react';

import { type IStudioAttributes, type StudioSaveOptions } from './StudioProps';

/**
 * A port of the **studio**-level commands (`useStudioCommands`) — file I/O, theme,
 * help. This is the **placeholder** for the studio slice of the port; only the help/shortcuts family
 * is wired so far (enough to make `Help` + the shortcut dialog work).
 *
 * The studio command **chrome** (help / shortcuts / external links / theme / fullscreen) lives in the
 * catalog (`studio.cmd.en.json`, scope `app`). This file is the **behavior** half:
 * - **{@link contributeStudioCommands}** — the React-context behavior (opening the shortcut dialog) +
 *   the stateless `gotoUrl*` callbacks; contributed by `StudioCommandProvider`.
 * - `contributeStudioAppearance` / `contributeStudioFullScreen` / `contributeStudioIOCommands` — the
 *   rest of the dynamic behavior.
 */

/** Handlers the React-bound studio behavior needs (things a plain callback can't own). */
export interface ContributeStudioCommandsHandlers {
  /** Open the keyboard-shortcuts reference dialog. */
  showShortcuts: () => void;
}

/**
 * Contribute the studio behavior that needs React context: `showKeyboardShortcuts` + `help` both open
 * the shortcut dialog. Returns via
 * the {@link Command.CommandContribution} handle, so `contribution.remove()` tears it down.
 */
export function contributeStudioCommands(
  contribution: Command.CommandContribution,
  handlers: ContributeStudioCommandsHandlers
): void {
  const open = (): void => handlers.showShortcuts();
  contribution.updateCommand('showKeyboardShortcuts', { callback: open });
  contribution.updateCommand('help', { callback: open });

  // The `gotoUrl*` behavior — stateless `window.open` callbacks. Their chrome (label/icon/desc) is in
  // the studio catalog (`studio.cmd.en.json`); a callback is not chrome, so it is contributed here.
  const gotoUrls: Record<string, string> = {
    gotoUrlGithub: 'https://github.com/sheetxl/sheetxl',
    gotoUrlDiscord: 'https://discord.gg/NTKdwUgK9p',
    gotoUrlDocumentation: 'https://www.sheetxl.com/docs',
    gotoUrlIssue: 'https://github.com/sheetxl/sheetxl/issues'
  };
  for (const [key, url] of Object.entries(gotoUrls)) {
    contribution.updateCommand(key, { callback: () => { window?.open(url); } });
  }
}

/** The resolved appearance state the bridge threads in (from `usePersistentState` + theme hooks). */
export interface StudioAppearanceState {
  /** The persisted mode override (`null` = follow system). */
  mode: ThemeMode | null;
  setMode: (mode: ThemeMode | null) => void;
  /** Whether the *effective* mode is dark (override or system). */
  isDark: boolean;
  /** Whether the system default is dark (for the `defaultThemeMode` icon). */
  systemDefaultDark: boolean;
  enableDarkGrid: boolean;
  setEnableDarkGrid: (next: (prev: boolean) => boolean) => void;
  enableDarkImages: boolean;
  setEnableDarkImages: (next: (prev: boolean) => boolean) => void;
}

/**
 * Contribute the studio **appearance** toggles — light/dark mode, system-default, dark-grid, dark-images.
 * Their `state`/`label`/`icon` are dynamic, so this re-runs when the appearance state changes (the bridge
 * owns the `usePersistentState` and re-invokes on change). Ported from `useStudioCommands` L569-600.
 */
export function contributeStudioAppearance(contribution: Command.CommandContribution, s: StudioAppearanceState): void {
  // The Light/Dark wording is a catalog `{dark, select, …}` message; only the live value is contributed.
  contribution.updateCommand<ThemeMode | null>('themeMode', {
    state: s.mode ?? null,
    params: { dark: s.isDark },
    icon: s.isDark ? 'DarkMode' : 'LightMode',
    callback: () => s.setMode(s.isDark ? 'light' : 'dark')
  });
  contribution.updateCommand<boolean>('defaultThemeMode', {
    state: !s.mode,
    icon: s.systemDefaultDark ? 'SystemDefaultDarkMode' : 'SystemDefaultLightMode',
    callback: () => s.setMode(null)
  });
  contribution.updateCommand<boolean>('enableDarkGrid', { state: s.enableDarkGrid, callback: () => s.setEnableDarkGrid((p) => !p) });
  contribution.updateCommand<boolean>('enableDarkImages', { state: s.enableDarkImages, callback: () => s.setEnableDarkImages((p) => !p) });
}

/** The UI-language state the bridge threads in (from `DefaultLanguagePackService`). */
export interface StudioLanguageState {
  /** The active UI-language tag (a user preference, not a document property). */
  active: string;
  setActive: (tag: string) => void;
}

/**
 * Contribute the **UI language** command. The active language is application state owned by the
 * language-pack service singleton — the bridge owns the subscription and re-invokes on change (same
 * shape as appearance). `execute(tag)` switches; the picker component supplies the list (whatever
 * packs are registered, not a hardcoded set). Contrast with `locale` (number/date formatting), which
 * is a workbook command: it travels with the document, as in Excel.
 */
export function contributeStudioLanguage(contribution: Command.CommandContribution, s: StudioLanguageState): void {
  contribution.updateCommand<string, any, string>('language', {
    state: s.active,
    callback: (tag?: string) => { if (tag) s.setActive(tag); }
  });
}

/** Fullscreen state the bridge threads in (from `useFullscreen`, bound to the document/app shell). */
export interface StudioFullScreenState {
  /** Whether the current context permits fullscreen (iframe permissions policy etc). */
  isFullscreenAvailable: boolean;
  /** Whether an element is currently fullscreen. */
  isFullscreenEnabled: boolean;
  /** Toggle fullscreen on/off. */
  toggleFullscreen: () => void | Promise<void>;
}

/**
 * Contribute the **fullscreen** toggle — a studio/app-shell concern (targets the whole document), so it lives
 * here rather than in the workbook contributor. `state`/`icon` are dynamic + `disabled` when the context
 * disallows fullscreen, so the bridge re-runs this on change.
 */
export function contributeStudioFullScreen(contribution: Command.CommandContribution, s: StudioFullScreenState): void {
  contribution.updateCommand<boolean>('fullScreenToggle', {
    state: s.isFullscreenEnabled,
    disabledReasons: s.isFullscreenAvailable ? [] : [messageKey('reason.fullscreenUnavailable')],
    icon: s.isFullscreenEnabled ? 'FullScreenOff' : 'FullScreen',
    callback: () => { void s.toggleFullscreen(); }
  });
}

/**
 * Protect Workbook: BOTH protections behind one entry, deliberately.
 *
 * @remarks
 * Excel splits them by storage mechanism - encryption is the file container, structure is XML inside
 * the package - and so puts them in unrelated parts of its UI. That is an implementation detail
 * deciding menu placement, and it reliably leads people to believe "Protect Workbook" encrypts.
 * Grouped by intent here, labelled by effect in the panel.
 *
 * The command now OPENS the Workbook tab of Manage Protection rather than a dialog of its own; the
 * key and the File-menu entry stay exactly where they were. Contributed here, and not with the file
 * commands, because it is neither io nor a workbook mutation - it is a pane opener that happens to
 * carry a studio-catalog key.
 */
export function contributeStudioProtection(
  contribution: Command.CommandContribution,
  activateTaskPane: (key: string, options?: ActivateFrameOptions) => void
): void {
  contribution.updateCommand('protectWorkbook', {
    tags: ['noTransaction', 'noRepeat'],
    callback: () => {
      activateTaskPane(TaskPaneKey.Protection, { args: { tab: 'workbook' } satisfies ProtectionPaneArgs });
    }
  });
}

/**
 * Open a workbook in a new popup window: `source` when given (read by the new window through
 * `?source`, named by `?title`), else a blank one.
 */
const openInNewWindow = (source?: string, title?: string): void => {
  const url = new URL(window.location.pathname, window.location.origin);
  if (source) url.searchParams.set('source', source);
  if (source && title) url.searchParams.set('title', title);
  window.open(url.toString(), 'sheetxl-' + CommonUtils.uuidV4(), 'popup=true');
};

/** What `openWorkbookFromUrl` accepts in place of a bare URL. */
export interface OpenWorkbookFromUrlArgs {
  url: string;
  /** The name to give the opened workbook. Defaults to the URL's file name. */
  title?: string;
}

/** What `newWorkbook` accepts to start from an existing workbook rather than a blank one. */
export interface NewWorkbookArgs {
  /** The URL of the workbook to start from. */
  source?: string;
  /** The name to give the new workbook. Defaults to the source's file name. */
  title?: string;
}

/**
 * The studio **app-shell** dependencies the file-I/O commands need — threaded from `CommandsWrapper` via
 * `StudioCommandProvider` (they live in the studio shell, not the workbook model).
 */
export interface StudioIODeps {
  /** The active workbook (source for writes; CSV-import inherits its options). */
  workbook: IWorkbook;
  /**
   * Replace the current workbook (open pairs the new model with its read origin). The studio owns the
   * displaced workbook from here on and closes it once its grid is off screen — closing it at the call
   * site would kill the model while the outgoing grid is still mounted and interactive.
   */
  setWorkbook: (input: WorkbookInput) => void;
  /** Suggested filename stem when a save prompts for a destination. */
  workbookTitle?: string;
  /**
   * Live unsaved-changes probe, read at click time so close/open confirm see the current value.
   */
  isDirty: () => boolean;
  /** Busy / error / confirm UI. */
  notifier: IReactNotifier;
  /**
   * Receives the studio's Save while the backing store can write, and `null` otherwise — what
   * {@link IStudioAttributes.save} runs.
   */
  refSave?: { current: ((options?: StudioSaveOptions) => Promise<IWorkbookIO.Origin | null>) | null };
}

/**
 * Contribute the studio **file-I/O** commands (the "studio slog", Batch 3) — `newWorkbook` /
 * `closeWorkbook` (capability-independent) + `saveWorkbook` / `saveWorkbookAs` / per-format
 * `saveWorkbookAs<Fmt>` (only when `WorkbookIO.canWrite()`) + `openWorkbook` / `openWorkbookFromUrl` (only
 * when `WorkbookIO.canRead()`). Ported from `useStudioCommands` (`importWorkbook` L81, `exportToFile`
 * L162, the command handlers L204-443).
 *
 * @remarks
 * Chrome here is **capability-gated + generated** (not a static catalog entry), so it's registered *with*
 * the behavior via `updateCommand`, and the save/open shortcuts (Ctrl+S / Ctrl+O) only bind when the
 * active backing store supports them — an embedded host (VS Code) installs a write-only store and owns
 * open itself. The capability probe is async (`getWriteFormats` forces the io layer to load); the returned
 * disposer cancels a probe still in flight so a fast unmount can't register after teardown. File I/O is
 * **not** a sheet transaction, so there's no middleware (contributed at the app root, like undo/workbook).
 */
export function contributeStudioIOCommands(
  contribution: Command.CommandContribution,
  deps: StudioIODeps
): RemoveListener {
  const { workbook, setWorkbook, workbookTitle = 'export', isDirty, notifier, refSave } = deps;
  let cancelled = false;

  // --- import (read a workbook from a File / picker / handle) ---
  const importWorkbook = async (
    input: File | Promise<File> | string | null = null,
    typedCreateWorkbookOptions: Record<string, IWorkbook.ConstructorOptions> | null = null,
    onStart: ((origin: IWorkbookIO.Origin, total?: number) => Promise<void> | void) | null = null
  ): Promise<IWorkbook | null> => {
    const warnings: string[] = [];
    // An explicit File is read directly; a string / null leaves the source unset so the backing store
    // resolves it (File System Access open picker — caching the handle for silent save-back — or an
    // <input type=file> fallback).
    const inputFile: File | Promise<File> | null = (input && typeof input !== 'string') ? input : null;
    const optionsFile: IWorkbookIO.ReadOptions = {
      source: inputFile,
      typedCreateWorkbookOptions: typedCreateWorkbookOptions ?? undefined,
      // File encryption ("password to open"): the io layer detects the envelope and asks us for the
      // password before any progress UI starts, so this dialog is never buried under a busy spinner.
      // Returning null cancels the whole open — `read` then resolves to null, exactly like a
      // dismissed picker.
      //
      // ONE dialog handles every attempt: `validate` tests a password in place (the Open button
      // spins while it runs, ~1s of deliberate key derivation) and a wrong one just re-labels the
      // field. Re-prompting by closing and reopening instead would rebuild the dialog per attempt,
      // which reads as a flicker.
      // NOTE: unrelated to sheet protection, which is a hash gate on the model.
      onPassword: async ({ origin, validate }: IWorkbookIO.PasswordRequest): Promise<string | null> => {
        const results = await notifier.showInput({
          title: t('dialog.password.title'),
          description: t('dialog.password.open.description', { name: origin.getName() ?? '' }),
          inputType: 'password',
          options: [{ id: 'Open', label: () => t('dialog.open') }, 'Cancel'],
          defaultOption: 'Open',
          // Only on submit — the keystroke path (`option` undefined) must stay cheap, or every
          // character typed would trigger a full derivation.
          onValidateInput: async (input?: string, option?: OptionInput) => {
            if (option === undefined) return { valid: true };
            if (!input) return { valid: false, message: t('dialog.password.open.required') };
            return await validate(input)
              ? { valid: true }
              : { valid: false, message: t('dialog.password.open.retry') };
          }
        });
        return results?.option === 'Open' ? (results.input ?? null) : null;
      },
      progress: { onWarning: (message: string) => { warnings.push(message); } }
    };
    if (onStart) optionsFile.progress!.onStart = onStart;

    let hideBusy: BusyHandle;
    // Update the indicator at ~5% steps (not every 1%): far fewer re-renders during the parse; the bar's
    // CSS transition glides across each step so coarse updates still feel smooth.
    let lastShown = -5;
    return WorkbookIO.read({
      ...optionsFile,
      progress: {
        async onStart(origin: IWorkbookIO.Origin, total?: number): Promise<void> {
          await optionsFile?.progress?.onStart?.(origin, total);
          hideBusy = await notifier?.showBusy?.(t('workbook.opening', { name: origin?.getName() ?? '' }));
          if (total) hideBusy?.setProgress?.(0, total);
        },
        onProgress(completed: number, total?: number): void {
          if (!total) return;
          const percent = Math.min(100, Math.round((completed / total) * 100));
          if (percent >= 100) {
            if (lastShown === 100) return;
            lastShown = 100;
            hideBusy?.setProgress?.(completed, total);
            return;
          }
          if (percent - lastShown < 5) return;
          lastShown = percent;
          hideBusy?.setProgress?.(completed, total);
        },
        onComplete(): void {
          hideBusy?.();
          if (warnings.length > 0) {
            notifier.showMessage(t('workbook.importWarnings'));
            console.warn('Import warnings:\n' + warnings.join('\n'));
          }
        },
        // This `progress` REPLACES `optionsFile.progress` wholesale, so every handler the caller
        // supplied there has to be re-delegated by hand (as `onStart` does above). Warnings are
        // collected rather than shown: a reader emits one per unmodeled feature, and surfacing them
        // individually meant a file with N of them raised N popups.
        onWarning(message: string, context?: string): void {
          optionsFile?.progress?.onWarning?.(message, context);
        }
      }
    });
  };

  // --- save / save-as (write the workbook). ---
  /**
   * The single write path behind every save entry point. The only inputs are the format (the
   * command ARGUMENT — `undefined` = the workbook's current format) and which verb this is; no
   * caller reaches for `write`/`writeAs` itself. A host's own decision on a lossy write
   * (`onWarningsOverride`) replaces the dialog.
   */
  const exportToFile = async (
    target: IWorkbook,
    format: IWorkbookIO.FormatType | undefined,
    saveAs = false,
    onWarningsOverride?: IWorkbookIO.WriteOptions['onWarnings']
  ): Promise<IWorkbookIO.Origin | null> => {
    let hideBusyWriting: BusyHandle;
    // No `password` here on purpose: omitting it means "whatever this workbook was opened with",
    // which the io layer resolves from its own session cache. The UI never holds a password.
    const writeOptions: IWorkbookIO.WriteOptions = {
      format: format?.key,
      progress: {
        async onStart(origin: IWorkbookIO.Origin): Promise<void> {
          hideBusyWriting = await notifier?.showBusy?.(t('workbook.saving', { name: origin?.getName() ?? '' }));
        },
        onComplete(): void { hideBusyWriting?.(); }
      },
      // What the format could not hold, as ONE dialog — the io layer asks once, after encoding. It
      // says only THAT SheetXL-only features were left out: the warnings themselves are worded for
      // developers, so they go to the console. A silent re-save can be cancelled (the file being
      // replaced may hold what is about to be lost); a prompted save cannot (the user just chose an
      // empty destination, and the picker has already created the file), so there the dialog only
      // informs and is not awaited. Either way the workbook still holds everything, which is what
      // the dialog says.
      onWarnings: onWarningsOverride ?? (async ({ warnings, origin, canCancel }): Promise<boolean> => {
        hideBusyWriting?.();
        console.warn(`Not written to '${origin.getName()}':\n${warnings.map((warning) => `  ${warning.message}`).join('\n')}`);
        const title = t('dialog.writeWarnings.title');
        // The origin is the file being written, so its format is the one the bytes are in.
        const formatKey = origin.getFormat();
        const written = formatKey ? (await WorkbookIO.getWriteFormats({ search: formatKey }))[0] : undefined;
        const format = written?.description ?? formatKey ?? '';
        const keep = t('dialog.writeWarnings.keep');
        if (!canCancel) {
          void notifier.showOptions({
            title,
            type: NotifierType.Warning,
            description: `${t('dialog.writeWarnings.saved', { format })}\n\n${keep}`,
            options: ['Ok']
          });
          return true;
        }
        const option = await notifier.showOptions({
          title,
          type: NotifierType.Warning,
          description: `${t('dialog.writeWarnings.confirm', { format })}\n\n${keep}`,
          options: [{ id: 'Save', label: () => t('dialog.save') }, 'Cancel'],
          defaultOption: 'Cancel'
        });
        if (option !== 'Save') return false;
        hideBusyWriting = await notifier?.showBusy?.(t('workbook.saving', { name: origin?.getName() ?? '' }));
        return true;
      })
    };
    let written: IWorkbookIO.Origin | null;
    if (!saveAs) {
      // Save: back to the workbook's own origin. An unbound/read-only origin makes the store
      // resolve a destination (save dialog) and the workbook moves to it, so the next Ctrl+S is
      // silent.
      written = await WorkbookIO.write(target, undefined, writeOptions);
    } else {
      // Save As: write to another file and move the workbook there. The suggested destination seeds
      // the picker; the Studio title follows the workbook's origin reactively.
      const origin = target.getOrigin();
      // A file NAME is being built, so this needs the origin's extension, not its format — the
      // latter is a resolved key ('SheetXL'), which would suggest 'Book.SheetXL'.
      const suggestedExt = format?.exts?.[0] ?? (origin.getExtension() || 'sxl');
      const suggested = `${workbookTitle || origin.getName() || t('workbook.defaultName')}.${suggestedExt}`;
      // `prompt` is what makes this a Save As the USER asked for: without it a store may write the
      // suggested name directly instead of asking where.
      written = await WorkbookIO.writeAs(target, suggested, { ...writeOptions, prompt: true });
    }
    return written;
  };

  // --- capability-independent: new + close. ---
  // Set once the io layer has loaded and can read; opening a source in place needs it.
  let openFromUrl: ((input?: string | OpenWorkbookFromUrlArgs) => Promise<void>) | null = null;
  // New never discards work: a clean workbook is replaced in place, a dirty one is left alone and the
  // new workbook opens in its own window. Replacing needs a readable backing store (a host that owns
  // the document lifecycle withholds it), so without one it is always a new window. A `source` starts
  // from that workbook (a template) instead of a blank one.
  contribution.updateCommand<void, any, NewWorkbookArgs>('newWorkbook', {
    callback: async (args?: NewWorkbookArgs): Promise<void> => {
      const inPlace = WorkbookIO.canRead() && !isDirty();
      if (!args?.source) {
        if (inPlace) {
          setWorkbook({});
        } else {
          openInNewWindow();
        }
      } else if (inPlace && openFromUrl) {
        await openFromUrl({ url: args.source, title: args.title });
      } else {
        openInNewWindow(args.source, args.title);
      }
    }
  });

  // Ctrl+Alt+W (catalog) rather than Ctrl+W, which the browser reserves outside window mode —
  // https://codereview.chromium.org/9701108
  contribution.updateCommand('closeWorkbook', {
    callback: async (): Promise<void> => {
      // Only confirm when there are unsaved changes; a clean workbook closes immediately.
      if (isDirty()) {
        const option = await notifier.showOptions({
          title: t('dialog.confirm.title'),
          description: t('dialog.unsavedChanges'),
          options: [{ id: 'Close', label: () => t('dialog.close') }, 'Cancel'],
          defaultOption: 'Cancel'
        });
        if (option !== 'Close') return;
      }
      window.close();
    }
  });

  // --- capability-gated: save/open (async — the io layer loads on first `getWriteFormats`). ---
  void (async (): Promise<void> => {
    const writeFormats = await WorkbookIO.getWriteFormats();
    if (cancelled) return;
    // Gate at *registration* (not merely disabled) so Ctrl+S / Ctrl+O only bind when actually supported.
    const canWrite = WorkbookIO.canWrite();
    const canRead = WorkbookIO.canRead();

    if (canWrite) {
      /**
       * Every "save as" entry point, argument-driven. `formatKey` is the command ARGUMENT — the
       * per-format menu entries pass their own key, and `undefined` (the generic command, its
       * shortcut, `execute()` from a host) means *the workbook's current format*: the picker then
       * defaults to it with every other format still listed. An unknown key is treated the same
       * way rather than failing the save.
       */
      const saveAs = (formatKey?: string): void => {
        const format = formatKey ? writeFormats.find((f) => f.key === formatKey) : undefined;
        exportToFile(workbook, format, true).catch((error) => notifier.showError(error));
      };

      // Default save: `write` resolves destination + format itself (save-back to origin, or prompt).
      // NO chrome here — every literal field (label/description/groupLabels/icon/shortcut) is authored in
      // the catalog (`studio.cmd.json`), because a dynamic contribution is the most-specific layer of the
      // cascade and an inline value would clobber the localized (and linted) one. That includes the SHORTCUT:
      // the static registry is what seeds the shortcut palette, so a code-only Ctrl+S is invisible there,
      // and it is what `scripts/command-chord-lint.mjs` reads, so a code-only chord can silently collide.
      //
      // Ctrl+S is still gated to hosts where the io layer can write, by the CALLBACK alone: chrome with
      // no callback resolves `disabled()`, and `KeyBindingDispatcher.dispatch` returns false without
      // `preventDefault` for a disabled command — so in a read/write-less host the keystroke falls
      // through to the browser.
      contribution.updateCommand('saveWorkbook', {
        callback: () => { exportToFile(workbook, undefined, false).catch((error) => notifier.showError(error)); }
      });
      // The same Save, for a host that owns the save gesture (IStudioAttributes.save): it gets the
      // outcome, and a failure rejects to it instead of being shown here.
      if (refSave) {
        refSave.current = (options?: StudioSaveOptions) => exportToFile(workbook, undefined, false, options?.onWarnings);
      }
      // Save As (Ctrl+Shift+S / F12 / Alt+F2 — Excel binds the last two; all three in the catalog):
      // always choose a new destination. The GENERIC command: it takes the format as its argument, so a
      // host (or a menu entry) can say `execute('CSV')`, and no argument means "current format,
      // everything else still offered".
      contribution.updateCommand<void, any, string>('saveWorkbookAs', {
        callback: (formatKey?: string) => { saveAs(formatKey); }
      });
      // Per-format "Save as <format>" export commands. The keys are DYNAMIC (one per registered write
      // format), so these are the one family here that cannot be static catalog entries — and therefore
      // the one place chrome legitimately stays in code. It goes through LAZY `t()`, never a literal:
      // this contributor's deps don't include the UI language, so an eagerly-evaluated `t(…)` (or an
      // inline template, as the label/groupLabels used to be) freezes at contribution time and never
      // re-renders on a language switch. The ICON is likewise per-format and stays here.
      //
      // EVERY write format gets one, `advanced` ones (`FormatType.advanced`) included: that flag
      // demotes a format out of the Save As MENU, not out of the product. The command is still what
      // a host executes, what the palette finds — and what the menu's lead entry borrows its label
      // from when the open workbook happens to BE one of them (see `FileCommandButton`).
      for (const format of writeFormats) {
        const formatKey = format.key;
        contribution.updateCommand(`saveWorkbookAs${formatKey}`, {
          label: () => t('command.saveAsFormat.label', { format: format.description }),
          groupLabels: {
            'workbook': () => t('command.saveAsFormat.workbook', { format: format.description }),
            'saveWorkbookOptions': () => t('command.saveAsFormat.compact', { format: format.description })
          },
          tags: format.tags,
          description: () => t('command.saveAsFormat', { format: format.description }),
          icon: formatKey === 'CSV' ? 'FileDownloadAsCSV' : formatKey === 'Excel' ? 'FileDownloadAsExcel' : 'FileDownloadAsSheet',
          // Chrome only. The behavior is the generic Save As with this format as its ARGUMENT —
          // these entries exist because each needs its own label/icon, not because each needs its
          // own implementation.
          callback: () => { saveAs(formatKey); }
        });
      }
    }

    // Import a file and append its sheets to the current workbook as new tabs.
    // Reads a *temporary* workbook via `importWorkbook`, then
    // clones each source sheet's entire range — copyFrom carries values, formatting, and floating
    // objects (charts/images), so no used-range detection is needed. Shared by the file + URL commands.
    //
    // NOT gated on `canRead`: that capability guards commands which REPLACE the document, so a host
    // owning the document lifecycle (VS Code's custom editor) can't be left with an orphan. Importing
    // only APPENDS sheets to the open workbook — document identity is untouched — so a read-less
    // backing store is no reason to withhold it. See `pickImportFile` for how the bytes are sourced.
    const importDataFromSource = async (input: File | Promise<File> | string | null = null): Promise<void> => {
      // CSV inherits the current workbook's options (mirrors `openWorkbook`).
      const typedCreateWorkbookOptions = { 'csv': { date1904: workbook.getRuntime().isDate1904(), ...workbook.options } };
      try {
        let readName: string = '';
        const onStart = async (origin: IWorkbookIO.Origin): Promise<void> => { readName = origin?.getName() ?? ''; };
        const importedWorkbook: IWorkbook | null = await importWorkbook(input, typedCreateWorkbookOptions, onStart);
        if (!importedWorkbook) return; // cancel
        const importedSheets = importedWorkbook.getWorksheets().getItems();
        await workbook.doBatch(async () => {
          for (let i = 0; i < importedSheets.length; i++) {
            const importedSheet = importedSheets[i];
            // Single-sheet files (CSV) get named after the source file; multi-sheet keep their names.
            const baseName = importedSheets.length === 1 ? readName : importedSheet.getName();
            const newSheetName = workbook.findValidSheetName(baseName);
            const sheetTo = workbook.getWorksheets().add({ name: newSheetName, autoSelect: i === importedSheets.length - 1 });
            await sheetTo.getEntireRange().copyFrom(importedSheet.getEntireRange());
          }
        }, messageKey('op.importData'));
        importedWorkbook.close(); // release the temporary workbook
      } catch (error: any) {
        notifier.showError(error);
      }
    };
    /**
     * Source the file to import when the caller passed none.
     *
     * A readable backing store resolves the source itself (File System Access picker, caching the
     * handle) — leave `null` alone so that path is unchanged. A write-only store has nothing to
     * resolve it with, so fall back to a plain DOM file dialog, exactly as `insertImageFromFile`
     * does: importing needs BYTES, not the store's open capability, and in-hand bytes always read.
     */
    const pickImportFile = async (): Promise<File | null> => {
      const formats = await WorkbookIO.getReadFormats();
      const exts = [...new Set(formats.flatMap((format) => format.exts))].map((ext) => `.${ext}`);
      return DOMUtils.openFileDialog(exts.length ? exts.join(',') : '*.*');
    };
    contribution.updateCommand('insertDataFromFile', {
      tags: ['noTransaction', 'noRepeat'],
      callback: async (input: File | Promise<File> | string | null = null): Promise<void> => {
        let source = input;
        if (!source && !WorkbookIO.canRead()) {
          source = await pickImportFile();
          if (!source) return; // cancelled
        }
        return importDataFromSource(source);
      }
    });
    // Import from a web address: fetch the workbook into a File, then run the same append logic
    // (importWorkbook ignores a bare string source — see its `typeof input !== 'string'` guard).
    // The fetch is ours, so this never touches the backing store at all.
    // Mirrors `openWorkbookFromUrl`, but replaces the workbook instead of appending.
    contribution.updateCommand('insertDataFromURL', {
      tags: ['noTransaction', 'noRepeat'],
      callback: async (url?: string): Promise<void> => {
        if (!url) {
          const results = await notifier.showInput({
            title: t('dialog.importFromWeb.title'),
            description: t('dialog.importFromWeb.description'),
            inputLabel: t('dialog.webAddress.inputLabel'),
            initialValue: 'https://www.sheetxl.com/docs/examples/loan-calculator.xlsx',
            propsInput: { style: { minWidth: '440px' } },
            options: [{ id: 'Import', label: () => t('dialog.import') }]
          });
          if (results.option !== 'Import') return;
          url = results.input;
        }
        if (!url) return;
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Could not fetch '${url}' (${response.status} ${response.statusText}).`);
          const blob = await response.blob();
          const name = decodeURIComponent(url.split('/').pop()?.split('?')[0] || '') || 'import.xlsx';
          await importDataFromSource(new File([blob], name, { type: blob.type }));
        } catch (error: any) {
          notifier.showError(error);
        }
      }
    });

    if (canRead) {
      // Opening REPLACES the whole workbook (not a sheet mutation), so it's never gated by sheet
      // protection — no `mutator` tag. Shared by the device (`openWorkbook`) and web (`openWorkbookFromUrl`)
      // entries; the only difference is where the source `File` comes from.
      const confirmReplaceIfDirty = async (): Promise<boolean> => {
        // Opening discards the current workbook. Confirm *before* reading/fetching (not after) when there
        // are unsaved changes, so a large file isn't parsed / downloaded only to be thrown away on cancel.
        if (!isDirty()) return true;
        const option = await notifier.showOptions({
          title: t('dialog.confirm.title'),
          description: t('dialog.unsavedChanges'),
          options: [{ id: 'Open', label: () => t('dialog.open') }, 'Cancel'],
          defaultOption: 'Cancel'
        });
        return option === 'Open';
      };
      const replaceWorkbookFromSource = async (input: File | Promise<File> | string | null = null): Promise<void> => {
        // CSV inherits the current workbook's options.
        const typedCreateWorkbookOptions = { 'csv': { date1904: workbook.getRuntime().isDate1904(), ...workbook.options } };
        try {
          const importedWorkbook: IWorkbook | null = await importWorkbook(input, typedCreateWorkbookOptions);
          if (!importedWorkbook) return; // cancel
          // Replace. The read-produced workbook carries its own origin, so save-back and the title
          // follow with no extra pairing. The displaced workbook is NOT closed here — the studio closes
          // it once its grid has left the screen (see `setWorkbook`).
          setWorkbook(importedWorkbook);
        } catch (error: any) {
          notifier.showError(error);
        }
      };
      // Chrome (incl. the Ctrl+O binding) is catalog-authored; the capability gate is the callback —
      // see the note on `saveWorkbook`.
      contribution.updateCommand('openWorkbook', {
        callback: async (input: File | Promise<File> | string | null = null): Promise<void> => {
          if (!(await confirmReplaceIfDirty())) return;
          await replaceWorkbookFromSource(input);
        }
      });
      // Open from a web address: prompt (unless a URL is passed), fetch the workbook into a File, then run
      // the same replace logic. The workbook is named by `title` when given, else by the URL's file name.
      openFromUrl = async (input?: string | OpenWorkbookFromUrlArgs): Promise<void> => {
        let url = typeof input === 'string' ? input : input?.url;
        const title = typeof input === 'string' ? undefined : input?.title;
        if (!url) {
          const results = await notifier.showInput({
            title: t('dialog.openFromWeb.title'),
            description: t('dialog.openFromWeb.description'),
            inputLabel: t('dialog.webAddress.inputLabel'),
            initialValue: 'https://www.sheetxl.com/docs/examples/loan-calculator.xlsx',
            propsInput: { style: { minWidth: '440px' } },
            options: [{ id: 'Open', label: () => t('dialog.open') }]
          });
          if (results.option !== 'Open') return;
          url = results.input;
        }
        if (!url) return;
        if (!(await confirmReplaceIfDirty())) return;
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Could not fetch '${url}' (${response.status} ${response.statusText}).`);
          const blob = await response.blob();
          const fileName = decodeURIComponent(url.split('/').pop()?.split('?')[0] || '') || 'workbook.xlsx';
          // The file name carries the format, so a title only replaces its stem.
          const ext = fileName.match(/\.[^/.]+$/)?.[0] ?? '';
          const name = title ? `${title}${ext}` : fileName;
          await replaceWorkbookFromSource(new File([blob], name, { type: blob.type }));
        } catch (error: any) {
          notifier.showError(error);
        }
      };
      contribution.updateCommand<void, any, string | OpenWorkbookFromUrlArgs>('openWorkbookFromUrl', {
        callback: openFromUrl
      });
    }
  })();

  return () => {
    cancelled = true;
    if (refSave) refSave.current = null;
  };
}
