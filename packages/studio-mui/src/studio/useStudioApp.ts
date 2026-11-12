import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocationSearch } from '@sheetxl/utils-react';

import { type IWorkbook, type IWorkbookIO } from '@sheetxl/sdk';

import {
  useWindowChrome, useWorkbookName, type WindowChromeOptions, type WorkbookLoadEvent
} from '@sheetxl/react';

import { prefetchWelcome } from '../template/TemplateCommands';

import { type StudioProps } from './StudioProps';

/**
 * What the studio should open. An {@link IWorkbook} / `Promise` / {@link IWorkbookIO.ReadOptions} /
 * source string. When omitted, the `?source` (and `?title`) URL query is used, else a blank
 * workbook is created. A `#fragment` after a `?source` names where that workbook opens: a sheet
 * (`#Charts`), cells (`#Charts!B4`) or a defined name.
 */
export type StudioAppSource =
  | IWorkbook
  | Promise<IWorkbook>
  | IWorkbookIO.ReadOptions
  | string;

/**
 * The address a `#fragment` on the page URL names, as an in-workbook hyperlink does: a sheet
 * (`#Charts`), cells (`#Charts!B4:D9`) or a defined name. `null` when there is none.
 */
const readLocationAddress = (): string | null => {
  if (typeof window === 'undefined') return null;
  const fragment = window.location.hash.substring(1);
  if (!fragment) return null;
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment; // not percent-encoded after all
  }
};

/**
 * Shows `address` in `workbook`: a sheet's name selects that sheet; anything else is selected as a
 * range. An address the workbook does not have leaves it as it opened.
 */
const selectAddress = async (workbook: IWorkbook, address: string): Promise<void> => {
  try {
    const sheet = workbook.getWorksheets().getByName(address);
    if (sheet) await sheet.select();
    else await workbook.getRange(address).select();
  } catch {
    // a link to a sheet, range or name that is not in this workbook
  }
};

/**
 * Options for {@link useStudioApp}: the app's own (what to open, the startup dialog, the window chrome)
 * plus **any `Studio` prop**, passed through to the returned props — so the hook's result is the whole
 * `<Studio>` spread. `workbook` is spelled {@link StudioAppOptions.source} here, since the app's source
 * may also be a string.
 */
export interface StudioAppOptions extends WindowChromeOptions, Omit<StudioProps, 'workbook'> {
  /**
   * What to open. If omitted, the `?source` / `?title` URL query is read (with a `#fragment` for
   * the sheet or cells to open at), else a blank workbook is created. See {@link StudioAppSource}.
   */
  source?: StudioAppSource;
  /**
   * What to show when the app starts with no source. `'welcome'` opens the welcome dialog (start
   * blank, open a workbook, or pick a template) over the blank workbook.
   * @defaultValue nothing; the blank workbook is shown
   */
  startWith?: 'welcome';
  /**
   * The template catalog the welcome and "Choose a template" dialogs show: a URL serving
   * `templates-workbook/contents.json`. Use it to pin a version or to serve your own templates.
   * @defaultValue the latest published `@sheetxl/templates-workbook`
   */
  templatePath?: string;
  /**
   * How the studio makes room for the virtual keyboard. See {@link StudioProps.virtualKeyboard}.
   * @defaultValue `'resize'`: the app owns the window, so the studio shrinks to the part of the screen
   * the keyboard leaves
   */
  virtualKeyboard?: StudioProps['virtualKeyboard'];
  /**
   * The app's own `onWorkbookLoad` handler, run after the startup dialog. (The hook also chains your
   * `onWorkbookChange` / `onDirtyChange`, which it needs for the window chrome.)
   */
  onWorkbookLoad?: (event: WorkbookLoadEvent) => void | Promise<void>;
}

/**
 * Single-call setup for a single-per-window **Studio** app: resolves what to open (an explicit
 * {@link StudioAppOptions.source}, the `?source` URL query, or a blank workbook) and manages the
 * window chrome — document/tab title (with an unsaved `●` marker), an unsaved-changes close prompt,
 * and a browser keyboard guard.
 *
 * @returns the `<Studio>` props: every `Studio` prop given in `options`, plus `workbook` (the value to
 * open) and the `onWorkbookChange` / `onDirtyChange` / `onWorkbookLoad` callbacks the studio fires as
 * it opens/replaces workbooks, so the chrome follows (yours are chained after the hook's).
 *
 * @remarks
 * Studio owns the workbook lifecycle (resolve, Open/replace, save, dirty tracking) and reports the
 * live workbook + dirty flag via the callbacks; this hook holds them only to drive the window
 * chrome (the workbook itself carries its name/origin). For apps that own the whole window — NOT
 * for embedding `Studio` as a widget (which must not touch the window title / `beforeunload` of
 * its host).
 *
 * @example
 * ```tsx
 * const studioApp = useStudioApp({ startWith: 'welcome', propsWorkbook: { … } });   // reads ?source, else a blank workbook
 * return <Studio {...studioApp} />;
 * ```
 */
export const useStudioApp = (options: StudioAppOptions = {}): StudioProps => {
  const {
    source: propSource, startWith, templatePath, onWorkbookLoad: propOnWorkbookLoad,
    onWorkbookChange: propOnWorkbookChange, onDirtyChange: propOnDirtyChange,
    documentTitle, confirmOnClose, keyboardGuard,
    ...studioProps
  } = options;

  const locationSearch = useLocationSearch();

  // The live workbook the studio is showing + its dirty flag, tracked only to feed the window
  // chrome (the studio owns the lifecycle). Updated as the studio opens / replaces workbooks.
  const [liveWorkbook, setLiveWorkbook] = useState<IWorkbook | null>(null);
  const [isDirty, setDirty] = useState<boolean>(false);
  const name = useWorkbookName(liveWorkbook);
  useWindowChrome(name, isDirty, { documentTitle, confirmOnClose, keyboardGuard });

  // What to hand the studio: an explicit source (a bare string becomes ReadOptions), else the URL's
  // `?source` (+ `?title`, + `#address`), else `undefined` so the studio creates a blank workbook.
  const { workbook, urlTitle, urlAddress } = useMemo<{ workbook: StudioProps['workbook']; urlTitle: string | null; urlAddress: string | null }>(() => {
    if (propSource != null) {
      return {
        workbook: typeof propSource === 'string' ? { source: propSource } : propSource,
        urlTitle: null,
        urlAddress: null
      };
    }
    if (locationSearch) {
      const params = new URLSearchParams(locationSearch);
      const src = params.get('source');
      if (src) {
        return { workbook: { source: src }, urlTitle: params.get('title'), urlAddress: readLocationAddress() };
      }
    }
    return { workbook: undefined, urlTitle: null, urlAddress: null };
  }, [propSource, locationSearch]);

  // `?title` renames the opened workbook — a display rename on its origin (the handle's label; the
  // model has no intrinsic name). It names only the workbook read from the URL source: the first one
  // the studio reports. Later swaps (New, Open, a template) keep their own names.
  // Armed during render, not in an effect: the studio reports the workbook from its own effect,
  // which runs before this component's.
  const refPendingTitle = useRef<string | null>(null);
  useMemo(() => { refPendingTitle.current = urlTitle; }, [urlTitle]);
  const refOnWorkbookChange = useRef(propOnWorkbookChange);
  refOnWorkbookChange.current = propOnWorkbookChange;
  const onWorkbookChange = useCallback((wb: IWorkbook | null): void => {
    if (wb && refPendingTitle.current) {
      wb.getOrigin().setName(refPendingTitle.current);
      refPendingTitle.current = null;
    }
    setLiveWorkbook(wb);
    refOnWorkbookChange.current?.(wb);
  }, []);

  const refOnDirtyChange = useRef(propOnDirtyChange);
  refOnDirtyChange.current = propOnDirtyChange;
  const onDirtyChange = useCallback((dirty: boolean): void => {
    setDirty(dirty);
    refOnDirtyChange.current?.(dirty);
  }, []);

  // Fetched while the first workbook loads, so the dialog is ready to open with it.
  useEffect(() => {
    if (startWith === 'welcome' && workbook === undefined) prefetchWelcome(templatePath);
  }, [startWith, workbook, templatePath]);

  // The startup dialog is shown once, over the first workbook, and only when nothing was asked
  // for. Studio fires `onWorkbookLoad` again on every workbook swap. The URL's `#address` is as
  // one-time: it places the workbook read from the URL source, once its grid is up so that the
  // view scrolls to it.
  const refStarted = useRef(false);
  const refOnWorkbookLoad = useRef(propOnWorkbookLoad);
  refOnWorkbookLoad.current = propOnWorkbookLoad;
  const onWorkbookLoad = useCallback((event: WorkbookLoadEvent): void | Promise<void> => {
    if (!refStarted.current) {
      refStarted.current = true;
      if (startWith === 'welcome' && workbook === undefined) {
        // After the studio's own reveal (it waits two frames past this event). Any sooner and the
        // dialog competes with the studio's last assembly: both show without their icons, which then
        // pop in together.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          void event.source?.getCommandScope?.()?.resolve<void, any, { templatePath?: string; atStartup?: boolean }>('showWelcome')?.execute({ templatePath, atStartup: true });
        }));
      } else if (urlAddress) {
        const opened = event.source?.getWorkbook?.();
        if (opened) void selectAddress(opened, urlAddress);
      }
    }
    return refOnWorkbookLoad.current?.(event);
  }, [startWith, templatePath, workbook, urlAddress]);

  return {
    // The app owns the window, so the studio is the page: it makes room for the keyboard by shrinking.
    virtualKeyboard: 'resize',
    ...studioProps,
    workbook, onWorkbookChange, onDirtyChange, onWorkbookLoad
  };
};
