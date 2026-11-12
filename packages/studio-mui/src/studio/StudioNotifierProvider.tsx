import type React from 'react';
import {
  useEffect, useCallback, useState, useRef, useMemo, memo
} from 'react';

import { useSnackbar, type OptionsObject } from 'notistack';

import { IconButton } from '@mui/material';

import { CommonUtils, PartialError, defineLazyModule } from '@sheetxl/utils';

import {
  NotifierType, ReactNotifierProvider, DynamicIcon, createBusyHandle, useTranslator,
  type IReactNotifier, type EnqueueNotifierOptions, type ShowBusyOptions, type BusyHandle,
  type ShowWindowOptions
} from '@sheetxl/utils-react';

import {
  AnimatedTraversingEllipsisIcon, AnimatedLoadingPanel, showLoadingPanel, hideLoadingPanel,
  useLazyWindow, useOptionsDialog, useInputDialog, type IInternalWindowElement
} from '@sheetxl/utils-mui';

interface StudioNotifierProviderProps {

  children: React.ReactElement<any, string | React.JSXElementConstructor<any>>;

  // TODO - loadingPanel options
}

// type -> lazy import for showWindow. Module scope so the idle prewarm below can share it.
// TODO - move this to a dialog registry, rationalize with taskPane
const WINDOW_IMPORTS: Record<string, () => Promise<{ default: any }>> = {
  'sort': defineLazyModule('studio:sortDialog', () => import('../dialog/SortDialog')).load,
  'hyperlink': defineLazyModule('studio:hyperlinkDialog', () => import('../dialog/HyperlinkDialog')).load,
  'find': defineLazyModule('studio:findReplaceWindow', () => import('../dialog/FindReplaceWindow')).load,
  'tableNew': defineLazyModule('studio:tableNewDialog', () => import('../dialog/TableNewDialog')).load,
  'pivotTableNew': defineLazyModule('studio:pivotTableNewDialog', () => import('../dialog/PivotTableNewDialog')).load,
  'sparklineNew': defineLazyModule('studio:sparklineNewDialog', () => import('../dialog/SparklineNewDialog')).load,
  'sparklineEdit': defineLazyModule('studio:sparklineEditDialog', () => import('../dialog/SparklineEditDialog')).load,
  'namedDetails': defineLazyModule('studio:namedReferenceDialog', () => import('../dialog/NamedReferenceDialog')).load,
  'insertFunction': defineLazyModule('studio:insertFunctionDialog', () => import('../dialog/InsertFunctionDialog')).load,
  'resizeHeader': defineLazyModule('studio:resizeHeaderDialog', () => import('../dialog/ResizeHeaderDialog')).load,
  'outlineSettings': defineLazyModule('studio:outlineSettingsDialog', () => import('../dialog/OutlineSettingsDialog')).load,
  'fillSeries': defineLazyModule('studio:fillSeriesDialog', () => import('../dialog/FillSeriesDialog')).load,
  'workbookStatistics': defineLazyModule('studio:workbookStatisticsDialog', () => import('../dialog/WorkbookStatisticsDialog')).load,
  'password': defineLazyModule('studio:passwordDialog', () => import('../protection/PasswordDialog')).load,
  'pivotValueSettings': defineLazyModule('studio:pivotValueSettingsDialog', () => import('../pivot/PivotValueSettingsDialog')).load
};

// Windows prewarmed at idle (mounted hidden, keep-alive) so their first open is an instant reveal.
// Keep this to high-frequency keep-alive windows — each holds a mounted (hidden) React tree.
const PREWARM_WINDOWS: readonly string[] = ['find'];

/**
 * Implements dialogs and toasts.
 */
// TODO - break out toast into a separate provider?
export const StudioNotifierProvider: React.FC<StudioNotifierProviderProps> =
  memo((props: StudioNotifierProviderProps) => {
  const {
    children
  } = props;

  const notistack = useSnackbar();
  const enqueueSnackbar = notistack ? notistack.enqueueSnackbar : (() => {});
  const closeSnackbar = notistack ? notistack.closeSnackbar : (() => {});

  // The indicator is mounted for the life of the app and armed per operation. Mounting it per
  // operation instead meant every command — the transactional middleware raises one around each —
  // waited out a mount, a full-screen first paint and `transitionrun` before its own work could
  // start. An already-painted panel commits its fade in a single frame.
  //
  // This path deliberately avoids React: a command may seize the main thread the moment `showBusy`
  // returns, and a scheduled render would not land until after the work it was meant to announce. A
  // string label is written straight into the panel; only a rich (element) label or a progress
  // update renders, and neither happens on the blocking path.
  const refBusyOps = useRef<Set<symbol>>(new Set());
  const refPanel = useRef<HTMLDivElement>(null);
  const refBusyLabel = useRef<React.ReactNode>(null);
  const [busy, setBusy] = useState<{ label: React.ReactNode; progress: number | null }>({
    label: null, progress: null
  });

  const t = useTranslator();

  const defaultOptions = CommonUtils.EmptyObject;
  const showLazyWindow = useLazyWindow(defaultOptions);
  const showOptions = useOptionsDialog(defaultOptions);
  const showInput = useInputDialog(defaultOptions);

  // Prewarm high-frequency windows once, at idle, so their first open is an instant reveal rather
  // than a full first mount. Runs after the app settles; each is mounted hidden + keep-alive and the
  // real open reuses it. Idempotent (prewarm no-ops if already mounted), so StrictMode double-run is fine.
  const refPrewarmed = useRef<boolean>(false);
  useEffect(() => {
    if (refPrewarmed.current) return;
    refPrewarmed.current = true;
    const win = window as any;
    const schedule: (cb: () => void) => any = win.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 500));
    const cancel: (handle: any) => void = win.cancelIdleCallback ?? clearTimeout;
    const handle = schedule(() => {
      for (const type of PREWARM_WINDOWS) {
        void showLazyWindow(type, WINDOW_IMPORTS[type], { prewarm: true }).catch(() => { /* ignore */ });
      }
    });
    return () => cancel(handle);
    // // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* TODO - move to permissions */
  const onceMessageKeys = useRef<Set<string>>(new Set());

  const notifier: Partial<IReactNotifier> = useMemo(() => {
    const showMessage = (message: string | React.ReactNode, options?: EnqueueNotifierOptions): void => {
      if (options?.onceKey) {
        if (onceMessageKeys.current.has(options.onceKey)) return;
        const newSet = new Set(onceMessageKeys.current);
        newSet.add(options.onceKey);
        onceMessageKeys.current = newSet;
      }

      const enqueueSnackOptions:OptionsObject = {
        variant: options?.type ?? NotifierType.Info, //'default' as VariantType,
        anchorOrigin: {
          vertical: 'top',
          horizontal: 'center'
        },
        preventDuplicate: options?.preventDuplicate,
        persist: options?.persist ?? options?.type === NotifierType.Error,
        action: (key) => {
          return (
            <IconButton
              onClick={() => closeSnackbar(key)}
            >
              <DynamicIcon iconKey="Cancel" />
            </IconButton>
          )
        }
      };
      if (options?.enqueueProps) {
        Object.assign(enqueueSnackOptions, options.enqueueProps);
      }
      if (!message) {
        console.log(`message is 'null'`, options);
      }
      enqueueSnackbar(message ?? 'Alert', enqueueSnackOptions);
    };
    return {
      showMessage,
      showBusy: (
        message: string | React.ReactNode,
        _options?: ShowBusyOptions
      ): Promise<BusyHandle> | BusyHandle => {
        const op = Symbol('busy');
        refBusyOps.current.add(op);
        refBusyLabel.current = message;
        // A rich label can only arrive by render. Such callers are not the blocking path, and the
        // panel is invisible for its first second regardless.
        if (message !== null && message !== undefined && typeof message !== 'string')
          setBusy((prev) => (prev.label === message ? prev : { ...prev, label: message }));

        // The handle dismisses the indicator and can update its progress/message while it shows.
        const handle = createBusyHandle(
          (): void => {
            if (!refBusyOps.current.delete(op)) return; // already dismissed
            if (refBusyOps.current.size > 0) return;    // others still running
            // Synchronously, in the task the work ended in: a deferred disarm lets the browser paint
            // a frame first, and work that outlasted the delay is showing by then — so the panel
            // lingers past the operation it was announcing.
            hideLoadingPanel(refPanel.current);
            refBusyLabel.current = null;
            setBusy((prev) => (prev.label === null && prev.progress === null ? prev : { label: null, progress: null }));
          },
          (completed?: number, total?: number): void => {
            const fraction = (total && total > 0 && completed != null)
              ? Math.max(0, Math.min(1, completed / total))
              : null;
            setBusy((prev) => (prev.progress === fraction ? prev : { ...prev, progress: fraction }));
          },
          (updated: string | React.ReactNode): void => {
            refBusyLabel.current = updated;
            if (typeof updated === 'string') showLoadingPanel(refPanel.current, updated);
            else setBusy((prev) => ({ ...prev, label: updated }));
          }
        );

        // Hand the handle back only once the fade is committed — the caller may block immediately
        // after. A second operation while one is already running has nothing to wait for.
        const armed = showLoadingPanel(refPanel.current, typeof message === 'string' ? message : undefined);
        return armed ? armed.then(() => handle) : handle;
      },
      showWindow: (type: string, options?: ShowWindowOptions): Promise<IInternalWindowElement> => {
        const optionsOriginal = options
        options = {
          ...options,
          onKeyDown: (e: React.KeyboardEvent<any>): void => {
            // TODO - need a useCommands or useKeyboard Context
            // commandsParent?.dispatchCommand(e);
            if (e.isDefaultPrevented() || e.isPropagationStopped()) return;
            optionsOriginal?.onKeyDown?.(e);
          }
        }
        // Non-prewarm `showWindow` always resolves the mounted InternalWindow element (the `| null`
        // from `useLazyWindow` only applies to the prewarm path above).
        return showLazyWindow(type, WINDOW_IMPORTS[type], options) as Promise<IInternalWindowElement>;
      },
      showOptions,
      showInput,
      showError: (error: any): void => {
        // TODO - support logging?
        let type: NotifierType = NotifierType.Error;
        let message:string = t('error.unknown');
        let errorValue: Error | undefined;
        if (typeof error === 'string') {
          message = error;
        } else if (error instanceof Error) {
          errorValue = error;
          if (error.message) {
            // SDK errors carry a messageKey;  resolves it at DISPLAY. A plain sentence
            // (no catalog entry) passes through unchanged, so this is safe for every error.
            message = t(error.message);
          }
        }

        if (error instanceof PartialError) {
          type = NotifierType.Info;
        }
        showMessage(message, {
          type,
          enqueueProps: {
            error: errorValue
          }
        });
      }
    };
    // `t` — showError resolves message KEYS, so the notifier must rebind on a language switch.
  }, [t]);

  // Mounted always, idle until armed. `label` mirrors what was written imperatively so a render
  // (rich label, progress) does not overwrite the panel's text with a stale value.
  const loadingPane = useMemo(() => {
    return (
      <AnimatedLoadingPanel
        ref={refPanel}
        autoStart={false}
        icon={<AnimatedTraversingEllipsisIcon sx={{transform: 'scale(0.7)', marginLeft: '-6px'}}/>}
        panel={true}
        label={busy.label ?? (typeof refBusyLabel.current === 'string' ? refBusyLabel.current : undefined)}
        progress={busy.progress}
        sx={{
          position: 'absolute',
          left: '0',
          top: '0',
          width: '100%',
          height: '100%',
          zIndex:'9999', // review this as it shouldn't be required.
          // The indicator reports work; it does not own the pointer. It covers the whole app and is
          // invisible for its first second (the anti-flicker transition delay), so hit-testing it
          // lets a click land on the overlay instead of on what the user is pressing — swallowing
          // that click, and reading as a click OUTSIDE any open popup, which dismisses it. Nothing
          // inside is interactive.
          pointerEvents: 'none'
        }}
      />
    );
  }, [busy.label, busy.progress]);

  return (
    <ReactNotifierProvider notifier={notifier}>
      {loadingPane}
      {children}
    </ReactNotifierProvider>
  );
});

StudioNotifierProvider.displayName = "StudioNotifierProvider";