import React, {
  useEffect, useCallback, useState, useRef, useMemo, memo, forwardRef
} from 'react';

import { useSnackbar, OptionsObject } from 'notistack';

import { IconButton } from '@mui/material';

import { CancelOutlined as  CancelOutlinedIcon } from '@mui/icons-material';

import { PartialError, UndoManager } from '@sheetxl/utils';

import { IWorkbook } from '@sheetxl/sdk';

import {
  IReactNotifier, EnqueueNotifierOptions, BusyNotifierOptions,
  NotifierType, ICommands, NotifierProvider, DefaultReactNotifier
} from '@sheetxl/utils-react';

import {
  AnimatedTraversingEllipsisIcon, LoadingPanel, useLazyWindow, LazyWindowOptions,
  useOptionsDialog, useInputDialog, IInternalWindowElement
} from '@sheetxl/utils-mui';

import {
  WorkbookElementProps, IWorkbookTitleElement
} from '../components/workbook';

import { HelpCommandButton } from '../command';
import { useStudioCommands } from './useStudioCommands';

import { StudioProps } from './StudioProps';

interface SnackbarAndCommandsWrapperProps extends StudioProps {
  children: React.ReactElement<any, string | React.JSXElementConstructor<any>>;

  /**
   * The workbook
   */
  workbook: IWorkbook;
  setWorkbook: any;
  importExportDisabled: boolean;
  titleWorkbook: string | null;
  setWorkbookTitle: (newWorkbookTitle: string | null) => void;
  titlePlaceHolder: string;

  undoManager: UndoManager;
  refWorkbookTitle: React.RefObject<IWorkbookTitleElement>;

  commands: ICommands.IGroup;
}

/**
 * Because snackbar is configured using a context provider we have to create
 * an intermediary component to retrieve and wrap the notifier (and commands)
 */
const SnackbarAndCommandsWrapper: React.FC<SnackbarAndCommandsWrapperProps & { ref?: React.Ref<HTMLDivElement>; }> =
  memo(forwardRef<HTMLDivElement, SnackbarAndCommandsWrapperProps>((props: SnackbarAndCommandsWrapperProps, ref: React.Ref<HTMLDivElement>) => {
  const {
    workbook,
    setWorkbook,
    refWorkbookTitle,
    titleWorkbook,
    setWorkbookTitle,
    titlePlaceHolder,
    children,
    undoManager,
    commands: commandsParent,
    importExportDisabled,
    themeOptions,
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
  const showInputOptions = useInputDialog(defaultOptions);

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
            <IconButton onClick={() => closeSnackbar(key)}>
              <CancelOutlinedIcon/>
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
      showBusy: (message: string | React.ReactNode, _options?: BusyNotifierOptions): Promise<() => void> => {
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
      showWindow: (type: string, props?: any, options?: LazyWindowOptions): Promise<IInternalWindowElement> => {
        const propsMapped = {
          ...props,
          onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>): void => {
            commandsParent?.dispatchToFocusedCommand(e);
            if (e.isDefaultPrevented() || e.isPropagationStopped()) return;
            props?.onKeyDown?.(e);
          }
        }
        const mappings = {
          'sort': () => import('../dialog/SortDialog'),
          'numberFormat': () => import('../dialog/NumberFormatDialog'),
          'hyperlink': () => import('../dialog/HyperlinkDialog'),
          'comments': () => import('../dialog/CommentsDialog'),
          'find': () => import('../dialog/FindReplaceWindow'),
          'tableDetails': () => import('../dialog/TableDetailsWindow'),
          'tableNew': () => import('../dialog/TableNewDialog'),
          'namedDetails': () => import('../dialog/NamedReferenceDialog'),
        }
        return showLazyWindow(type, mappings[type], propsMapped, options);
      },
      showOptions,
      showInputOptions,
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
        } else {
          // const isUserError = error instanceof UserError;
          // if (!isUserError) {
          //   console.warn(error);
          //   if (error.cause) {
          //     console.warn(`Caused by`, error.cause);
          //   }
          // }
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

  const onExecute = useCallback(() => {
    // refSheet.current.focus();
  }, []);

  const commandsStudio = useStudioCommands({
    notifier,
    workbook,
    setWorkbook,
    importExportDisabled,
    workbookTitle: titleWorkbook,
    setWorkbookTitle: setWorkbookTitle,
    commands: commandsParent,
    requestWorkbookTitle: (requestReason: string): Promise<string | null> => {
      return new Promise<string | null>((resolve) => {
        if (refWorkbookTitle.current) {
          refWorkbookTitle.current.requestWorkbookTitle((workbookTitle: string, _commitReason: string) => {
            resolve(workbookTitle);
          }, { selectAll: true, requestReason });
        } else {
          resolve(titlePlaceHolder);
        }
      });
    },
    themeOptions,
    undoManager,
    onExecute
  });

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
      <LoadingPanel
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


  const helpCommandPopup = useMemo(() => {
    return (
      <HelpCommandButton
        commands={commandsStudio}
        disableHover={true}
        sx={{
          padding: '0',
        }}
        buttonProps={{
          sx: {
            maxHeight: '22px', // make smaller to fit into statusbar
          }
        }}
      />
    )
  }, [commandsStudio]);

  const propsWorkbook: WorkbookElementProps & { ref?: React.Ref<HTMLDivElement> } = {
    // ref,
    commands: commandsStudio
  }
  if (workbook) {
    propsWorkbook.statusBarProps = {
      childrenEnd: helpCommandPopup
    }
  }
  return (
    <NotifierProvider notifier={notifier}>
      {loadingPane}
      {children ? React.cloneElement(children, propsWorkbook) : null}
    </NotifierProvider>
  );
}));

SnackbarAndCommandsWrapper.displayName = "SnackbarAndCommandsWrapper";
export { SnackbarAndCommandsWrapper };