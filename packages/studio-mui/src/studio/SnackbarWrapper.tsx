import React, {
  useEffect, useCallback, useState, useRef, useMemo, memo
} from 'react';

import { useSnackbar, type OptionsObject } from 'notistack';

import { IconButton } from '@mui/material';

import { PartialError } from '@sheetxl/utils';

import {
  IReactNotifier, type EnqueueNotifierOptions, type ShowBusyOptions,
  NotifierType, NotifierProvider, DefaultReactNotifier, DynamicIcon,
  type ShowWindowOptions
} from '@sheetxl/utils-react';

import {
  AnimatedTraversingEllipsisIcon, AnimatedLoadingPanel, useLazyWindow,
  useOptionsDialog, useInputDialog, IInternalWindowElement
} from '@sheetxl/utils-mui';

interface SnackbarWrapperProps {

  children: React.ReactElement<any, string | React.JSXElementConstructor<any>>;

  // TODO - loadingPanel options
}

/**
 * Because snackbar is configured using a context provider we have to create
 * an intermediary component to retrieve and wrap the notifier (and commands)
 */
export const SnackbarWrapper: React.FC<SnackbarWrapperProps> =
  memo((props: SnackbarWrapperProps) => {
  const {
    children
  } = props;

  const notistack = useSnackbar();
  const enqueueSnackbar = notistack ? notistack.enqueueSnackbar : (() => {});
  const closeSnackbar = notistack ? notistack.closeSnackbar : (() => {});

  const [busy, setBusy] = useState({ isMounted: false, label: null as any, starting: new Map(), running: new Map() });

  const onMount = useCallback(() => {
    setBusy((prev) => {
      return {
        ...prev,
        isMounted: true
      }
    });
  }, []);

  const onUnmount = useCallback(() => {
    setBusy((prev) => {
      return {
        ...prev,
        isMounted: false
      }
    });
  }, []);

  const defaultOptions = {}
  const showLazyWindow = useLazyWindow(defaultOptions);
  const showOptions = useOptionsDialog(defaultOptions);
  const showInput = useInputDialog(defaultOptions);

  /* TODO - move to permissions */
  const onceMessageKeys = useRef<Set<string>>(new Set());

  const notifier:IReactNotifier = useMemo(() => {
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
    const overrides = {
      showMessage,
      showBusy: (message: string | React.ReactNode, _options?: ShowBusyOptions): Promise<() => void> => {
        let resolverBlock = null;
        const promise = new Promise<() => void>((resolve) => {
          resolverBlock = resolve;
        });
        setBusy((prev) => {
          const cloned = new Map(prev.starting);
          cloned.set(promise, resolverBlock);
          const retValue = {
            ...prev,
            label: message,
            starting: cloned
          }
          return retValue;
        });
        return promise;
      },
      showWindow: (type: string, options?: ShowWindowOptions): Promise<IInternalWindowElement> => {
        const optionsOriginal = options
        options = {
          ...options,
          onKeyDown: (e: React.KeyboardEvent<any>): void => {
            // TODO - need a useCommands or useKeyboard Context
            // commandsParent?.dispatchToFocusedCommand(e);
            if (e.isDefaultPrevented() || e.isPropagationStopped()) return;
            optionsOriginal?.onKeyDown?.(e);
          }
        }
        // TODO - move this to a dialog registry, rationalize with taskPane
        const mappings = {
          'sort': () => import('../dialog/SortDialog'),
          'numberFormat': () => import('../dialog/NumberFormatDialog'),
          'hyperlink': () => import('../dialog/HyperlinkDialog'),
          'comments': () => import('../dialog/CommentsDialog'),
          'find': () => import('../dialog/FindReplaceWindow'),
          'tableNew': () => import('../dialog/TableNewDialog'),
          'namedDetails': () => import('../dialog/NamedReferenceDialog'),
          'resizeHeader': () => import('../dialog/ResizeHeaderDialog')
        }
        return showLazyWindow(type, mappings[type], options);
      },
      showOptions,
      showInput,
      showError: (error: any): void => {
        // TODO - support logging?
        let type: NotifierType = NotifierType.Error;
        let message:string = 'Unknown Error';
        let errorValue: Error;
        if (typeof error === 'string') {
          message = error;
        } else if (error instanceof Error) {
          errorValue = error;
          if (error.message) {
            message = error.message;
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
    }

    const notifier = new DefaultReactNotifier();
    notifier.setOverrides(overrides);
    return notifier;
  }, []);

  useEffect(() => {
    if (busy.starting.size <= 0 || !busy.isMounted) {
      // console.log('not mounted', busy, isBlockMounted);
      return;
    }

    setBusy((prev) => {
      const newRunning = new Map(prev.running);
      prev.starting.forEach((resolver, promise) => {
        // hack. If the promise is already done, we can't process again but react may call a second time
        // if (promise.done) return;
        // promise.done = true;
        const removeBusy = () => {
          setBusy((prevRemove) => {
            const removed = new Map(prevRemove.running);
            removed.delete(promise);
            const retValue = {
              ...prevRemove,
              running: removed
            }
            // if (prev.starting.size === 0 && removed.size === 0) {
            //   setBlockMounted(false); // hide panel
            // }
            return retValue;
          });
        }
        // add hdeBusy
        newRunning.set(promise, removeBusy);
        resolver(removeBusy);
      });
      const retValue = {
        ...prev,
        starting: new Map(),
        running: newRunning
      }
      // console.log('set busy start', retValue);
      return retValue;
    });
  }, [busy]);

  const [loadingPane, setLoadingPane] = useState<React.ReactElement | null>(null);
  useEffect(() => {
    if (busy.starting.size === 0 && busy.running.size === 0) {
      setLoadingPane(null);
      return;
    }

    // long operation panel
    setLoadingPane(
      <AnimatedLoadingPanel
        icon={<AnimatedTraversingEllipsisIcon sx={{transform: 'scale(0.7)', marginLeft: '-6px'}}/>}
        panel={true}
        label={busy.label}
        onMount={onMount}
        onUnmount={onUnmount}
        sx={{
          position: 'absolute',
          left: '0',
          top: '0',
          width: '100%',
          height: '100%',
          zIndex:'9999', // review this as it shouldn't be required.
        }}
      />
    );
  }, [busy.starting, busy.running]);

  return (
    <NotifierProvider notifier={notifier}>
      {loadingPane}
      {children}
    </NotifierProvider>
  );
});

SnackbarWrapper.displayName = "SnackbarWrapper";