import React, {
  useEffect, useLayoutEffect, useCallback, memo, forwardRef, useState, useRef, useMemo
} from 'react';

import clsx from 'clsx';

import { mergeRefs } from 'react-merge-refs';

import { SnackbarProvider, SnackbarKey, CloseReason } from 'notistack';

import { Theme, ThemeProvider } from '@mui/material/styles';

import { CssBaseline } from '@mui/material';
import { Paper, SvgIcon } from '@mui/material';

import { UndoManager, CommonUtils } from '@sheetxl/utils';
import { IWorkbook, Workbook, ITransaction } from '@sheetxl/sdk';

import {
  useCallbackRef, ICommand, ICommands, CommandGroup, DefaultDynamicIconService, DynamicIcon,
  UncaughtErrorBoundary, ReactErrorBoundary
} from '@sheetxl/utils-react';

import {
  TaskPaneProvider, type TaskPaneAreaProps, ITaskPaneAreaElement, useDocThemes
} from '@sheetxl/react';

import {
  createExhibitTheme, ModalProvider,
  useResolvedThemeMode, ThemeModeOptions, ThemeMode
} from '@sheetxl/utils-mui';

import {
  WorkbookElement, IWorkbookElement,
  WorkbookLoadEvent, WorkbookTitle, IWorkbookTitleElement
} from '../components';

import { WorkbookIO, type ReadWorkbookOptions } from '../io';

import { ToastError } from '../toast';

import type { StudioProps } from './StudioProps';
import { StudioToolbar, type StudioToolbarProps } from './StudioToolbar';
import { CommandsWrapper } from './CommandsWrapper';
import { SnackbarWrapper } from './SnackbarWrapper';
import { StudioTaskPaneArea } from './StudioTaskPaneArea';
import { StudioSplitPane } from './StudioSplitPane';

// TODO - should components have a composite plugin?
import { TablePlugin } from '../components';
import { ScriptingPlugin } from '../scripting';
// import { AIPlugin } from '../ai/plugin';

import {
  renderWorkbookLoading as defaultRenderWorkbookLoading,
  renderWorkbookError as defaultRenderWorkbookError
} from '../components/workbook/WorkbookRenderers';

// AIPlugin();
TablePlugin(); // Components plugin
ScriptingPlugin();

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
export const EagerStudio = memo(forwardRef<IWorkbookElement, StudioProps>((props: StudioProps, refForwarded) => {
  const {
    className: propClassName,
    sx: propSx,
    style: propStyle,
    onElementLoad: propOnElementLoad,
    onError: propOnError,
    undoManager: propUndoManager,
    renderWorkbookError: propRenderWorkbookError = defaultRenderWorkbookError,
    onKeyDown: propOnKeyDown,

    workbook: propWorkbook,
    onWorkbookChange: propOnModelChange,

    logo,
    importExportDisabled = false,
    themeOptions: propThemeOptions,
    autoFocus = false,
    commands: commandsParent,
    title: propTitle,
    onTitleChange: propOnTitleChange,
    titleProps,
    renderLoading: propRenderLoading = defaultRenderWorkbookLoading,
    loadingProps,
    ...rest
  } = props;

  const refWorkbook = useRef<IWorkbookElement>(null);

  const onWorkbookChange = useCallbackRef(propOnModelChange, [propOnModelChange]);
  const onTitleChange = useCallbackRef(propOnTitleChange ?? titleProps?.onTitleChange, [propOnTitleChange ?? titleProps?.onTitleChange]);
  const titlePlaceHolder = titleProps?.placeHolder ?? 'Untitled';

  const propThemeMode = propThemeOptions?.mode;
  const { themeMode, source } = useResolvedThemeMode({ mode: propThemeMode });
  const themeOptions:ThemeModeOptions = useMemo(() => {
    return {
      ...propThemeOptions,
      light: createExhibitTheme(false, CommonUtils.deepMerge(propThemeOptions?.theme ?? {}, propThemeOptions?.light ?? {})),
      dark: createExhibitTheme(true, CommonUtils.deepMerge(propThemeOptions?.theme ?? {}, propThemeOptions?.dark ?? {})),
    }
  }, [propThemeOptions]);

  const isDarkMode = themeMode === ThemeMode.Dark;
  const [undoManager, setUndoManager] = useState<UndoManager>(null);
  useEffect(() => {
    setUndoManager(propUndoManager ?? new UndoManager());
  }, [propUndoManager]);

  const [workbookResolved, setWorkbookResolved] = useState<{ workbook?: IWorkbook, error?: any}>(null);

  const [workbook, setWorkbook] = useState<IWorkbook | Promise<IWorkbook> | ReadWorkbookOptions>(null);

  const defaultThemes = useDocThemes();
  useLayoutEffect(() => {
    if (!propWorkbook || (Object.keys(propWorkbook).length === 0) && !CommonUtils.isPromiseLike(propWorkbook)) {
      const options: IWorkbook.ConstructorOptions = {
        theme: defaultThemes.getDefaultTheme(),
        // createSheetCallback: (options: ISheet.ConstructorOptions) => {
        //   return new Sheet({
        //     ...options,
        //     maxRows: 100
        //   });
        // },
        // ...propCreateWorkbookOptions
      }
      setWorkbook(new Workbook(options));
    } else {
      setWorkbook(propWorkbook);
    }
  }, [propWorkbook]); // propCreateWorkbookOptions, defaultThemes


  useLayoutEffect(() => {
    if (!workbook) return;
    if (workbook instanceof Workbook) {
      setWorkbookResolved({ workbook });
      if (propWorkbook !== workbook) {
        onWorkbookChange?.(workbook);
      }
      return;
    };

    const resolveWorkbook = async () => {
      try {
        let resultOrWorkbook: IWorkbook | ReadWorkbookOptions = await Promise.resolve(workbook);
        if (resultOrWorkbook && (resultOrWorkbook as ReadWorkbookOptions).source) {
          resultOrWorkbook = await WorkbookIO.read(resultOrWorkbook as ReadWorkbookOptions);
        }
        let workbookResolved: IWorkbook = resultOrWorkbook as IWorkbook;
        onWorkbookChange?.(workbookResolved);
        setWorkbookTitle(workbookResolved.getName() ?? '');
        setWorkbookResolved({ workbook: workbookResolved });
      } catch (error: any) {
        onWorkbookChange?.(null);
        setWorkbookResolved({ error });
      }
    }
    resolveWorkbook();
  }, [workbook])

  const [workbookLoaded, setWorkbookLoaded] = useState<WorkbookLoadEvent>(null);

  useEffect(() => {
    if (!undoManager || !workbookResolved) return;

    // we clear an update to one of the variables indicates a new workbook.
    undoManager.clear();
    const transactions = workbookResolved?.workbook?.getTransactions();
    if (!transactions) return; // due to error.
    const removeListener = transactions.addListener({
      onCommitEnd: (commit: ITransaction.ICommit) => {
        if (!commit.getDescription()) {
          // This can occur if a transaction was created/committed without a description.
          // TODO - All current transactions are labels; perhaps we should disallow empty transactions?
          console.warn('commit has no description', commit);
          return;
        }
        undoManager.addUndoOperation({
          description: commit.getDescription(),
          undo: () => {
            transactions.revert(commit.getId());
            workbookLoaded.source?.focus(); // TODO - move to WorkbookElement or SheetElement
            return () => {
              transactions.restore(commit.getId());
              workbookLoaded.source?.focus();  // TODO - move to WorkbookElement or SheetElement
            }
          }
        });
      }
    });
    return removeListener;
  }, [undoManager, workbookResolved, workbookLoaded]);

  const onRepeatCommandChange = useCallbackRef((command: ICommand<any, any>) => {
    if (!command) {
      undoManager.setRepeatableOperation(null);
      return;
    }
    undoManager.setRepeatableOperation({
      description: command.label(),
      repeat: async () => {
        return command.execute();
      }
    });
  }, [undoManager]);

  const [titleWorkbook, setWorkbookTitle] = useState(propTitle ?? titleProps?.title ?? '');
  useEffect(() => {
    setWorkbookTitle(propTitle ?? titleProps?.title ?? '');
  }, [propTitle ?? titleProps?.title]);

  useEffect(() => {
    onTitleChange?.(titleWorkbook);
   } , [titleWorkbook]);

  const [viewportDOM, setViewportDOM] = useState(null);

  const commandsApplication = useMemo(() => {
    const target:() => ICommands.ITarget = () => {
      return {
        contains(_element: Node | null): boolean {
          return true;
        },
        focus(): void {
        }
      };
    };
    if (commandsParent) {
      return commandsParent.createChildGroup(target, 'application', false);
    } else {
      return new CommandGroup(target, 'application');
    }
  }, [commandsParent]);

  const onElementLoad = useCallbackRef(async (event: WorkbookLoadEvent) => {
    setViewportDOM(event.source.getViewportElement());
    setWorkbookLoaded(event);
    commandsApplication.activate(`sheet`);
    // ensure icons are loaded
    await DefaultDynamicIconService.prefetch();
    propOnElementLoad?.(event);
  }, [commandsApplication]);

  useEffect(() => {
    if (!workbookLoaded || !autoFocus) return;
    // TODO - If should still restore focus if it was in the component hierarchy even if autoFocus is true
    workbookLoaded.source?.focus(typeof autoFocus === 'object' ? autoFocus : undefined);
  }, [workbookLoaded])

  const refWorkbookTitle = useRef<IWorkbookTitleElement>(null);
  const renderToolbar = useCallback((props: StudioToolbarProps) => {
    let mainElement = null;
    if (!titleProps?.hidden) {
      mainElement = (
        <WorkbookTitle
          {...titleProps}
          style={{
            maxWidth: '100%',
            ...titleProps?.style
          }}
          workbook={refWorkbook.current}
          ref={refWorkbookTitle}
          title={titleWorkbook}
          placeHolder={titlePlaceHolder}
          onTitleChange={(title) => {
            setWorkbookTitle(title)}
          }
        />
      );
    }
    return (
      <StudioToolbar
        {...props}
        logo={logo}
        mainElement={mainElement}
        showFileMenu={!importExportDisabled}
        showAppearanceMenu={!!(themeOptions?.onEnabledDarkGridChange || themeOptions?.onEnabledDarkImagesChange || themeOptions?.onModeChange)}
      />
    );
  }, [logo, titleWorkbook, titleProps, themeOptions, importExportDisabled, commandsApplication]);

  useEffect(() => {
    // TODO - should this be moved to app.tsx
    // Disabled the wheel mouse. Not needed but since we have a zoom this can cause confusion if applied on toolbar/status/etc.
    const handleWheel = (e: globalThis.WheelEvent) => e.preventDefault();
    refWorkbook.current?.addEventListener("wheel", handleWheel, { passive: false });

    // const handleTouch = (e: globalThis.TouchEvent) => e.preventDefault();
    // refWorkbook.current?.addEventListener("touchstart", handleTouch, { passive: false });
    // refWorkbook.current?.addEventListener("touchend", handleTouch, { passive: false });
    // refWorkbook.current?.addEventListener("touchmove", handleTouch, { passive: false });
    // refWorkbook.current?.addEventListener("touchcancel", handleTouch, { passive: false });


    return () => {
      refWorkbook.current?.removeEventListener("wheel", handleWheel);

      // refWorkbook.current?.removeEventListener("touchstart", handleTouch);
      // refWorkbook.current?.removeEventListener("touchend", handleTouch);
      // refWorkbook.current?.removeEventListener("touchmove", handleTouch);
      // refWorkbook.current?.removeEventListener("touchcancel", handleTouch);
    };
  }, []);

  const styles = useMemo(() => {
    return {
      ...propSx,
      '& .SnackbarContainer-root': {
        position: 'absolute !important',
      },
      '& .notistack-SnackbarContainer > div': {
        maxWidth: '100%'
      },
      // '& .notistack-CollapseWrapper': {
      //   maxWidth: '100%',
      // },
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
      }
    }
  }, [propSx]);

  // TODO - roll this into StudioSplitPane and convert to a DockingPaneManager
  const [sideBar, setSideBar] = useState<React.ReactElement>(null);
  const createTaskPaneArea = useCallback((props: TaskPaneAreaProps, ref: React.Ref<ITaskPaneAreaElement>) => {
    return <StudioTaskPaneArea
      ref={ref}
      model={workbookResolved?.workbook}
      commands={commandsApplication}
      {...props}
    />;
  }, [commandsApplication, workbookResolved])

  const mainWrapper = useCallback((children: React.ReactElement) => {
    return (
      <StudioSplitPane
        mainElement={children}
        sidebarElement={sideBar}
      />
    );
  }, [sideBar]);

  const refLocal = mergeRefs([refWorkbook, refForwarded]);

  // We show the loading panel
  const renderedWorkbook = useMemo(() => {
    if (!workbookResolved) {
      return (
        <Paper
          sx={propSx}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...propStyle
          }}
        >
          {propRenderLoading( {...loadingProps} )}
        </Paper>
      );
    } else if (workbookResolved.error) {
      return (
        <Paper
          sx={propSx}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'stretch',
            // padding: '16px',
            ...propStyle
          }}
        >
          {propRenderWorkbookError( {
            style: {
              width: '100%',
              height: '100%',
              ...propStyle
            },
            error: workbookResolved.error
          } )}
        </Paper>
      );
    }

    let appTheme = null;
    let gridTheme = null;
    let enableDarkImages = false;
    if (themeOptions) {
      appTheme = isDarkMode ? themeOptions.dark : themeOptions.light;
      gridTheme = isDarkMode && themeOptions.enableDarkGrid ? themeOptions.dark : themeOptions.light;
      enableDarkImages = themeOptions.enableDarkImages;
    }

    // return the loading pane or error pane
    let workbookElement = (
      <WorkbookElement
        key="WorkbookElement"
        sx={styles}
        style={propStyle}
        tabIndex={0}
        autoFocus={true}
        workbook={workbookResolved.workbook}
        ref={refLocal}
        renderToolbar={renderToolbar}
        onElementLoad={onElementLoad}
        // commands={commandsStudio}
        onRepeatCommandChange={onRepeatCommandChange}
        onKeyDown={(e: React.KeyboardEvent<any>) => {
          propOnKeyDown?.(e);
        }}
        loadingProps={loadingProps}
        renderLoading={propRenderLoading}
        gridTheme={gridTheme}
        headersTheme={appTheme}
        enableDarkImages={enableDarkImages}
        mainWrapper={mainWrapper}
        className={clsx(propClassName)} //, 'sheetxl-studio')}
        // standalone application turns off context menu
        onContextMenu={e=> e.preventDefault()}
        {...rest}
      />
    );
    return workbookElement;
  }, [
    workbookResolved, titleWorkbook, undoManager, propRenderLoading, loadingProps,// commandsStudio,
    propRenderWorkbookError, themeOptions, rest, renderToolbar, styles, mainWrapper // because we need to pass rest
    // propStyle
  ]);

  let retValue = (
    <SnackbarProvider
      maxSnack={3}
      domRoot={viewportDOM} // We move the snackbar to to the grid viewport (see domRoot). Some apps may want this to be done in a different way.
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      autoHideDuration={3500} // Disable auto-hide for error notifications so users can interact with stack traces
      onClose={(_event: React.SyntheticEvent<any> | null, _reason: CloseReason, _key: SnackbarKey) => {
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
        <TaskPaneProvider
          createArea={createTaskPaneArea}
          onUpdateArea={(areaElement) => {
            setSideBar(areaElement as any);
          }}
        >
          <ModalProvider>
            <SnackbarWrapper>
              <UncaughtErrorBoundary>
                <ReactErrorBoundary>
                  <CommandsWrapper
                    workbook={workbookResolved?.workbook}
                    setWorkbook={setWorkbook}
                    importExportDisabled={importExportDisabled}
                    titlePlaceHolder={titlePlaceHolder}
                    titleWorkbook={titleWorkbook}
                    setWorkbookTitle={setWorkbookTitle}
                    refWorkbookTitle={refWorkbookTitle}
                    commands={commandsApplication}
                    undoManager={undoManager}
                    themeOptions={themeOptions}
                  >
                    {renderedWorkbook}
                  </CommandsWrapper>
                </ReactErrorBoundary>
              </UncaughtErrorBoundary>
            </SnackbarWrapper>
          </ModalProvider>
        </TaskPaneProvider>
    </SnackbarProvider>
  )
  if (themeOptions) {
    retValue = (
      <ThemeProvider theme={isDarkMode ? themeOptions.dark : themeOptions.light }>
        { themeOptions.cssBaseline ? <CssBaseline/> : null }
        {retValue}
      </ThemeProvider>
    );
  }
  return retValue;
}));

// export as both named and default
EagerStudio.displayName = "EagerStudio";
export default EagerStudio;