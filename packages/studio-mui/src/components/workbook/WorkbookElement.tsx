import React, {
  useCallback, useLayoutEffect, useEffect, useRef, useReducer, useMemo,
  useState, memo, forwardRef, type CSSProperties
} from 'react';

import clsx from 'clsx';
import { useMeasure } from 'react-use';

import { useTheme, Theme, alpha, getOverlayAlpha } from '@mui/material/styles';

import { Box } from '@mui/material';
import { Paper } from '@mui/material';
import { Typography } from '@mui/material';

import { CSSTransition } from 'react-transition-group';

import {
  Workbook, IWorkbook, IMovable, IAutoFilter, ISheet, IWorkbookProtection,
  IWorkbookView, TypesUtils, CommonUtils, type TopLeft, type Bounds
} from '@sheetxl/sdk';

import {
  ScrollPane, ScrollbarProps, ToolTipPlacement, KeyModifiers, SimpleCommand,
  useCallbackRef, useImperativeElement, SplitPane, useNotifier, IReactNotifier,
} from '@sheetxl/utils-react';

import { GridStyle } from '@sheetxl/grid-react';

import {
  ISheetElement, SheetLocation, SheetScrollbar, type SheetScrollbarProps,
  useModelListener, useDocThemes, type MovableElementProps
} from '@sheetxl/react';

import { PictureEditor, ChartEditor, EmptyFrame } from '@sheetxl/react';

import {
  scrollbarTheming, useFloatStack, ExhibitPopupPanelProps, type ExhibitPopperProps,
  LoadingPanel, SimpleTooltip
} from '@sheetxl/utils-mui';

import { createGridStyleFromMUITheme } from '../../theme';
import { renderWorkbookToolbars } from '../../toolbar';
import { type IFormulaBarElement } from '../formulaBar';
import { ScriptWorkspace, type IScriptWorkspaceElement } from '../../script';

import useWorkbookCommands from './useWorkbookCommands';

import type {
  IWorkbookElement, WorkbookElementProps, WorkbookAttributes, WorkbookLoadEvent
} from './IWorkbookElement';

import resetsStyles from '../../theme/Resets.module.css';
import themeStyles from '../../theme/Theme.module.css';

import workbookStyles from './Workbook.module.css';
import { setGlobalIWorkbookElement } from './GlobalWorkbookElement';
import { renderMovableContextMenu, renderFilterColumnMenu, renderWorkbookContextMenu,
  renderWorkbookFormulaBar, renderWorkbookLoadingPanel, renderWorkbookSheet,
  renderWorkbookStatusBar, renderWorkbookStrip
} from './WorkbookRenderers';

// let currentUrl: string = '';
// if (typeof window === "object") {
//   currentUrl = window.location.href;
// }
// // Remove trailing slash if present
// if (currentUrl.endsWith('/')) {
//   currentUrl = currentUrl.slice(0, -1);
// }
// // Remove existing hash fragment
// currentUrl = currentUrl.split('#')[0];
// // Append the desired hash fragment
// const scriptEditorUrl = currentUrl + '#openScriptEditor';

const IGNORE_MODEL_CHANGE = { fireOnModelChange: false };

const styleFlexFull = {
  flex: `1 1 100%`,
  display: 'flex'
}
/* Adjust the extend virtual scroll area beyond default */
const END_VIRTUAL_SCROLL_GAP = 700;

interface ContextMenuDetails {
  createPopupPanel: (props: ExhibitPopupPanelProps) => any;//ReactElement<any>;
  /* if anchor is used then clientX and client Y are ignored */
  // TODO - rationalize clientX, clientY, and anchor back into anchor
  clientX?: number;
  clientY?: number;
  anchor?: React.ReactElement | any;
  popperProps?: Partial<ExhibitPopperProps>;
}

const WorkbookElement =
    memo(forwardRef<IWorkbookElement, WorkbookElementProps>((props, refForwarded) => {
  const {
    workbook: propModel,
    createWorkbookOptions: propCreateWorkbookOptions,
    onNewWorkbook: propOnNewWorkbook,
    onElementLoad: propOnElementLoad,
    autoFocus = false,
    sx: propSx,
    style: propStyle,
    className: propClassName,
    onFocus: propOnFocus,
    onBlur: propOnBlur,
    onKeyDown: propOnKeyDown,
    onRepeatCommandChange: propOnRepeatCommandChange,
    commands: propCommandsParent,
    showFormulaBar: propShowFormulaBar,
    formulaBarProps: propsFormulaBar,
    renderFormulaBar: propRenderFormulaBar = renderWorkbookFormulaBar,
    showTabs: propShowTabs,
    tabsProps: propsTabs,
    renderTabs: propRenderTabs = renderWorkbookStrip,
    showStatusBar: propShowStatusBar,
    statusBarProps: propsStatusBar,
    renderStatusBar: propRenderStatusBar = renderWorkbookStatusBar,
    toolbarProps: propsToolbar,
    renderToolbar: propRenderToolbar = renderWorkbookToolbars,
    contextMenuSx: propsContextMenuSx,

    renderContextMenu: propRenderContextMenu = renderWorkbookContextMenu,
    renderFilterMenu: propRenderFilterMenu = renderFilterColumnMenu,
    renderMovableMenu: propRenderMovableMenu = renderMovableContextMenu,

    renderLoadingPanel: propRenderLoadingPanel = renderWorkbookLoadingPanel,
    loadingPanelProps: propsLoadingPanel,

    sheetProps: propsSheet,
    renderSheet: propRenderSheet = renderWorkbookSheet,

    showHorizontalScrollbar: propShowHorizontalScrollbar,
    showVerticalScrollbar: propShowVerticalScrollbar,
    gridTheme: propGridTheme,
    headersTheme: propHeadersTheme,
    enableDarkImages: propEnabledDarkImages,
    ...rest
  } = props;

  const notifier: IReactNotifier = useNotifier();
  const appTheme = useTheme();
  const docThemes = useDocThemes();

  const workbook:IWorkbook = useMemo(() => {
    const options = {
      theme: docThemes.getDefaultTheme(),
      ...propCreateWorkbookOptions
    }
    return propModel ?? new Workbook(options);
  }, [propModel]);

  const refSheet = useRef<ISheetElement>(null);
  const [hasFocus, setFocus] = useState<boolean>(false);
  // const [formulaEditor, setFormulaEditor] = useState<React.ReactNode>(<></>);

  const viewportRef = useRef<HTMLElement>(null);
  const viewportComponent = useMemo(() => {
    return (
      <Box
        className={"sheetxl-viewport"}
        sx={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          position: 'absolute', // snackBars are fixed by default. We don't want this
          pointerEvents: 'none !important',
          '& > :first-of-type': {
            position: 'relative'
          }
        }}
        ref={viewportRef}
      />
    );
  }, []);

  const [isSheetLoaded, setSheetLoaded] = useState<boolean>(false);
  const [isLoaded, setLoaded] = useState<boolean>(false);
  const handleSheetLoaded = useCallback(() => {
    setSheetLoaded(true);
  }, []);

  const refFormulaBar = useRef<IFormulaBarElement>(null);
  const refLocal = useImperativeElement<IWorkbookElement, WorkbookAttributes>(refForwarded, () => {
    const retValue:WorkbookAttributes & Partial<HTMLDivElement> = {
      isWorkbookElement: () => true,
      getWorkbook: () => { return workbook },
      getSheetElement: () => refSheet.current,
      getViewportElement: () => viewportRef.current,
      getFormulaBarElement: () => refFormulaBar.current,
      focus(): void {
        if (refSheet && refSheet.current) {
          refSheet.current.focus();
        }
      }
    };
    return retValue;
  }, [workbook]);

  // To ensure we call propOnElementLoad exactly once
  const refPropLoaded = useRef<(event: WorkbookLoadEvent) => void>(null);
  useLayoutEffect(() => {
    if (!isSheetLoaded || !refLocal.current) return;
    setLoaded(true);
    if (refPropLoaded.current !== propOnElementLoad) {
      propOnElementLoad?.({
        source: refLocal.current
      });
      refPropLoaded.current = propOnElementLoad;
    }
  }, [isSheetLoaded, refLocal.current]);

  setGlobalIWorkbookElement(refLocal.current);

  const handleBeforeSheetChange = useCallback((_index: number): boolean | void => {
    refSheet.current?.submitEdit();
    return true; // not required
  }, []);

  const handleOnSheetChange = useCallback(() => {
    // TODO - a bit of a hack. we need to review/rethink focus
    requestAnimationFrame(() => {
      refSheet?.current?.focus();
    });
  }, []);

  const [sheet, setSelectedSheet] = useState<ISheet>(workbook?.getSelectedSheet());
  const [protection, setProtection] = useState<IWorkbookProtection>(workbook?.getProtection());
  useModelListener<IWorkbook, IWorkbook.IListeners>(workbook, {
    onSheetsChange: (source: IWorkbook) => {
      setSelectedSheet(source?.getSelectedSheet());
    },
    onViewChange(source: IWorkbook): void {
      setSelectedSheet(source?.getSelectedSheet());
    },
    onProtectionChange: (source: IWorkbook) => {
      setProtection(source?.getProtection());
    }
  });

  useModelListener<IWorkbook, IWorkbook.IListeners>(workbook, {
    onRequestSelect: async(source: IWorkbook, sheet: ISheet): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        if (refSheet.current.getSheet() === sheet) {
          resolve(true)
          return;
        }
        refSheet.current.getGridElement()?.onViewChangeOnce(() => {
          if (refSheet.current.getSheet() !== sheet) { // still the same sheet?
            resolve(false);
          }
          resolve(true)
        });
      });
    }
  }, IGNORE_MODEL_CHANGE);

  const [_, forceRender] = useReducer((s: number) => s + 1, 0);

  const workbookView = workbook?.getView();
  useModelListener<IWorkbookView, IWorkbookView.IListeners>(workbookView, {
    onViewChange: (_update: IWorkbookView | null | undefined): void => {
      forceRender();
    }
  });

  const gridTheme = propGridTheme ?? appTheme;
  const gridStyle:GridStyle = useMemo(() => {
    return createGridStyleFromMUITheme(appTheme, gridTheme);
  }, [appTheme, gridTheme]);

  const headersTheme = propHeadersTheme ?? appTheme;
  const headersStyle:GridStyle = useMemo(() => {
    return createGridStyleFromMUITheme(appTheme, headersTheme);
  }, [appTheme, headersTheme]);

  const [viewport, setViewPort] = useState(null);

  const onExecute = useCallback(() => {
    refSheet.current.focus();
  }, []);

  const [isShowSidebar, setShowSidebar] = useState<boolean>(false);
  const refSidebar = useRef<IScriptWorkspaceElement>(null);

  const commandsWorkbook = useWorkbookCommands({
    workbook,
    workbookElement: refLocal.current,
    target: () => refSheet.current,
    onExecute,
    commands: propCommandsParent,
    darkMode: gridStyle.body.darkMode,
    onNewWorkbook: propOnNewWorkbook,
    onShowSidebar: () => {
      if (isShowSidebar) {
        refSidebar.current?.focus();
      } else {
        // will autoFocus (if already showing then refocus)
        setShowSidebar(true)
      }
    }
  });

  const popperRef = useRef(null);
  const [isPopperOpen, setPopperOpen] = useState<boolean>(false);
  const [popperDisplay, setPopperDisplay] = useState<any>(null);
  const [popperPlacement, setPopperPlacement] = useState<ToolTipPlacement>(ToolTipPlacement.Top);
  const [popperAnchor, setPopperAnchor] = useState<Partial<Bounds>>(TypesUtils.EmptyBounds);

  const closeTooltip = useCallback(() => {
    setPopperOpen(false);
    setPopperDisplay(null);
  }, []);

  const showTooltip = useCallback((anchor: Partial<Bounds>, display: string | React.ReactElement, placement: ToolTipPlacement=ToolTipPlacement.Top) => {
    setPopperAnchor(anchor);
    setPopperPlacement(placement);
    setPopperDisplay(display);
    if (popperRef.current !== null) {
      setTimeout(() => {
        if (popperRef.current !== null) {
          popperRef.current.update();
        }
      }, 160); // give time for the popper to render
    }
    setPopperOpen(true);
  }, []);

  const [_focusedComponent, setFocusedComponent] = useState<string>('sheet');

  const showTabs = propShowTabs ?? workbookView?.isShowTabs();
  const showHorizontalScrollbar = propShowHorizontalScrollbar ?? workbookView?.isShowHorizontalScrollbar();
  const showFormulaBar = propShowFormulaBar ?? workbookView?.isShowFormulaBar();
  const showStatusBar = propShowStatusBar ?? workbookView?.isShowStatusBar();
  const showVerticalScrollbar = propShowVerticalScrollbar ?? workbookView?.isShowVerticalScrollbar();
  const borderColor = gridStyle?.header?.edgeStrokeFill || 'rgb(171,171,171)';
  const borderWidth = 1;

  const statusBar = useMemo(() => {
    if (!showStatusBar) return null;

    return propRenderStatusBar({
      sheet,
      gridStyle,
      ...propsStatusBar
    });
  }, [propRenderStatusBar, propsStatusBar, showStatusBar, gridStyle, sheet]);

  const workbookToolbar = useMemo(() => {
    return propRenderToolbar({
      commands: commandsWorkbook,
      workbook: refLocal.current,
      ...propsToolbar
    });
  }, [commandsWorkbook, propRenderToolbar, propsToolbar, appTheme]);

  const [refMeasureMainArea, { width: widthMainArea }] = useMeasure<HTMLDivElement>();
  const isFullWidth = widthMainArea === 0 || widthMainArea > 560; // TODO - read from CSS variable

  const workbookStrip = useMemo(() => {
    if (!showTabs) return null;
    let retValue = propRenderTabs({
      // style: {
      //   paddingLeft: '16px',
      //   ...propsTabs?.style
      // },
      // ref: refTabStrip,
      background: gridStyle.body.fill,
      borderWidth,
      borderColor,
      gridTheme,
      gridStyle,
      onBeforeUserChange: handleBeforeSheetChange,
      onUserChange: handleOnSheetChange,
      workbook: workbook,
      commands: commandsWorkbook,
      sheetTabProps: {
        // tabRadius: 0, // TODO - allow for tab direction (bottom, left, right, top, none) (this is a nicer flavor than tabRadius)
      },
      // commandsSheet,
      ...propsTabs
    });
    /* we wrap to change flex props */
    if (!isFullWidth) {
      retValue = (
        <div
          style={{
            flex: 'none',
            display: 'flex'
          }}
        >
          {retValue}
        </div>
      )
    }
    return retValue;
  }, [propRenderTabs, propsTabs, notifier, appTheme, workbook, gridTheme, isFullWidth, commandsWorkbook, showTabs]);

  const createTabStripSharedScrollbar = useCallback((props: ScrollbarProps) => {
    const isFireFox = CommonUtils.getOS() === CommonUtils.OSType.Firefox;
    let horizontalArea = null;
    let horizontalScrollbar = null;
    let horizontalTabs = null;

    if (showHorizontalScrollbar) {
      horizontalScrollbar = (
        <div
          style={{
            display: 'flex',
            flex: '1 1 100%',
            // height: '100%',
            borderTop: `solid ${borderColor} ${borderWidth}px`,
            maxWidth: '100%'
          }}>
          <SheetScrollbar
            style={{
              alignItems: 'center',
              borderTop: `${isFireFox ? 6 : 3}px solid transparent`,
              borderBottom: `${isFullWidth ? 6 : 3}px solid transparent`,
              borderLeft: `${isFireFox ? 3 : 0}px solid transparent`,
              borderRight: `${isFireFox ? 3 : 0}px solid transparent`,
            }}
            {...props}
            endGap={END_VIRTUAL_SCROLL_GAP}
            sheet={sheet}
            showCustomScrollButtons={!isFireFox}
            onShowTooltip={(props) => {
              showTooltip({
                x: props.anchor.x,
                y: props.anchor.y,
                width: 0,
                height: 0
                // width: right - x,
                // height: bottom - y,
              },
              props.display,
              props.placement);
            }}
            onCloseTooltip={() => closeTooltip()}
          />
        </div>
      )
    }

    if (showTabs && isFullWidth) {
      horizontalTabs = workbookStrip;
    }

    // add trailing bottom edge
    if (showTabs && isFullWidth && !showHorizontalScrollbar) {
      horizontalTabs = (
        <Box sx={{
          display: "flex",
          flex: "1",
          position: 'relative',
          alignContent: 'center'
        }}>
          {horizontalTabs}
          <Box
            sx={{
              borderTop: `solid ${borderColor} ${borderWidth}px`,
              flex: "1"
            }}
          />
        </Box>
      )
    }

    if (horizontalTabs && showHorizontalScrollbar) {
      horizontalArea = (
        <SplitPane
          position={`${workbook.getView().getTabRatio() / 10}%`}
          onPositionChange={({ percent }): void => {
            workbook.getView().setTabRatio(Math.round(percent * 10));
          }}
          minBefore="200px"
          minAfter="180px"
          resizerProps={{
            style: {
              // borderLeft: `${appTheme.palette.action.active} solid 1px`,
              // borderRight: `${appTheme.palette.action.active} solid 1px`,
              minWidth: '11px',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='6.4' height='12' viewBox='0 0 9.6 16' version='1.1' fill='${(appTheme.palette.text as any).icon ?? appTheme.palette.action.active}' xmlns='http://www.w3.org/2000/svg' xmlns:svg='http://www.w3.org/2000/svg'%3E%3Cpath d='M 9.60008,14.40009 C 9.60008,15.28374 8.88368,16 8.00003,16 7.11639,16 6.40012,15.28374 6.40012,14.40009 c 0,-0.88365 0.71627,-1.60005 1.59991,-1.60005 0.88365,0 1.60005,0.7164 1.60005,1.60005 m 0,-6.40012 c 0,0.88364 -0.7164,1.60004 -1.60005,1.60004 -0.88364,0 -1.59991,-0.7164 -1.59991,-1.60004 0,-0.88365 0.71627,-1.60005 1.59991,-1.60005 0.88365,0 1.60005,0.7164 1.60005,1.60005 m 0,-6.40006 c 0,0.88365 -0.7164,1.60005 -1.60005,1.60005 -0.88364,0 -1.59991,-0.7164 -1.59991,-1.60005 C 6.40012,0.71626 7.11639,0 8.00003,0 8.88368,0 9.60008,0.71626 9.60008,1.59991 M 3.19996,14.40009 C 3.19996,15.28374 2.48369,16 1.60005,16 0.7164,16 0,15.28374 0,14.40009 c 0,-0.88365 0.7164,-1.60005 1.60005,-1.60005 0.88364,0 1.59991,0.7164 1.59991,1.60005 m 0,-6.40012 c 0,0.88364 -0.71627,1.60004 -1.59991,1.60004 C 0.7164,9.60001 0,8.88361 0,7.99997 0,7.11632 0.7164,6.39992 1.60005,6.39992 c 0.88364,0 1.59991,0.7164 1.59991,1.60005 m 0,-6.40006 c 0,0.88365 -0.71627,1.60005 -1.59991,1.60005 C 0.7164,3.19996 0,2.48356 0,1.59991 0,0.71626 0.7164,0 1.60005,0 2.48369,0 3.19996,0.71626 3.19996,1.59991' /%3E%3C/svg%3E%0A")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              borderTop: `solid ${borderColor} ${borderWidth}px`,
              borderBottom: 'solid 3px transparent' // our scrollbars have a trailing extra 3px padding so we add an extra border to this to match. Not sure if this is best.
            }
         }}
         elementBefore={horizontalTabs}
         elementAfter={horizontalScrollbar}
        />
      )
    } else if (showHorizontalScrollbar) {
      horizontalArea = horizontalScrollbar;
    } else if (horizontalTabs) {
      horizontalArea = horizontalTabs;
    } else {
      return (
        <Box sx={{
          display: "flex",
          flex: "1",
          position: 'relative',
          alignContent: 'center',
          height: '1px',
          borderTop: !showStatusBar ? `solid ${borderColor} ${borderWidth}px` : null
        }}
        />
      )
    }

    return (
      <Box sx={{
        display: "flex",
        flex: "1",
        position: 'relative',
        alignContent: 'center'
      }}>
        {horizontalArea}
      </Box>
    );
  }, [sheet, handleBeforeSheetChange, workbook, gridStyle, gridTheme, commandsWorkbook, showTabs, showHorizontalScrollbar, showStatusBar, isFullWidth]);

  const [contextMenuDetails, setContextMenuDetails] = React.useState<ContextMenuDetails>(null);
  const popperProps:Partial<ExhibitPopperProps> = useMemo(() => {
    return {
      placement: "right-start",
      ...contextMenuDetails?.popperProps
    }
  }, [contextMenuDetails?.popperProps]);

  const {
    reference: contentMenuReference,
    component: contextMenuComponent
  } = useFloatStack({
    label: 'contextMenu',
    popperProps,
    anchor: contextMenuDetails?.anchor ?? {
      getBoundingClientRect: () => {
        return new DOMRect(
          contextMenuDetails?.clientX || 0,
          contextMenuDetails?.clientY || 0,
          // contextMenuLocation?.clientWidth || 0,
          // contextMenuLocation?.clientHeight || 0
        );
      }
    },
    onClose: () => setContextMenuDetails(null),
    createPopupPanel: contextMenuDetails?.createPopupPanel
  });

  useEffect(() => {
    if (contextMenuDetails) {
      contentMenuReference.open(0);
    } else {
      contentMenuReference.close(0)
    }
  }, [contextMenuDetails]);

  const handleFilterMenu = useCallbackRef((event: React.MouseEvent<HTMLDivElement, MouseEvent>, filter: IAutoFilter.IColumn): boolean => {
    if (event?.isDefaultPrevented()) return true;
    event.preventDefault();
    // If the menu is already opened with the same anchor then close.
    // Note - We could associate a reference instead of using the anchor directly but this works.
    if (contextMenuDetails && contextMenuDetails.anchor === event.currentTarget) {
      setContextMenuDetails(null);
      return;
    }
    setContextMenuDetails({
      anchor: event.currentTarget,
      popperProps: {
        offsets: [-4, 2] // we want on the right shift up by the rounded corner amount.
      },
      createPopupPanel: (props: ExhibitPopupPanelProps) => {
        const { floatReference } = props;
        return propRenderFilterMenu({
          filter,
          commands: commandsWorkbook,
          floatReference,
          sx: {
            ...propsContextMenuSx
          }
        });
      }
    });
  }, [propRenderFilterMenu, propsContextMenuSx, commandsWorkbook, workbook, contextMenuDetails]);

  const handleSheetContextMenu = useCallbackRef((location: SheetLocation): boolean => {
    if (location.originalEvent?.isDefaultPrevented()) return true;
    location.originalEvent?.preventDefault();
    setContextMenuDetails({
      clientX: location.clientX,
      clientY: location.clientY,
      createPopupPanel: (props: ExhibitPopupPanelProps) => {
        const { floatReference } = props;
        return propRenderContextMenu({
          commands: commandsWorkbook,
          workbook,
          floatReference,
          sx: {
            ...propsContextMenuSx
          }
        });
      }
    });
  }, [propRenderContextMenu, propsContextMenuSx, commandsWorkbook, workbook]);

  const handleMovableContextMenu = useCallbackRef((event: React.MouseEvent<HTMLElement>, movable: IMovable): boolean => {
    if (event?.isDefaultPrevented()) return true;
    event.preventDefault();
    setContextMenuDetails({
      clientX: event.clientX,
      clientY: event.clientY,
      createPopupPanel: (props: ExhibitPopupPanelProps) => {
        const { floatReference } = props;
        return propRenderMovableMenu({
          movable,
          commands: commandsWorkbook,
          floatReference,
          sx: {
            ...propsContextMenuSx
          }
        });
      }
    });
  }, [propRenderMovableMenu, propsContextMenuSx, commandsWorkbook]);


  useMemo(() => {
    const uiCommands = [
      new SimpleCommand('openContextMenu', () => refSheet.current, {
        label: 'Context Menu',
        description: 'Open the context menu.',
        shortcut: [{
          key: 'F10',
          modifiers: [KeyModifiers.Shift]
        }, {
          key: 'ContextMenu'
        }]
      })
    ];
    commandsWorkbook.addCommands(uiCommands, true);
  }, [commandsWorkbook]);


  useEffect(() => {
    commandsWorkbook.getCommand('openContextMenu').updateCallback(() => {
      const coords = sheet.getSelection().getCoords().cell;
      refSheet.current?.getGridElement()?.scrollCellCoordsIntoView(coords).then((scrollTopLeft: TopLeft) => {
        requestAnimationFrame(() => {
          const zoom = sheet.getView().getZoomScale() / 100;
          const clientX = sheet.getColumnHeaders().findOffset(coords.colIndex + 1) * (zoom);
          const clientY = sheet.getRowHeaders().findOffset(coords.rowIndex + 1) * (zoom);
        // const clientWidth = sheet.getColumnHeaders().findOffset(coords.colIndex + 1) - clientX;
        // const clientHeight = sheet.getRowHeaders().findOffset(coords.rowIndex + 1) - clientY;

          const point = refSheet.current?.getGridElement()?.getRelativePointFromClient(0,0) || { x: 0, y: 0 };
          const offsetX = 6;
          const offsetY = 6;
          handleSheetContextMenu({
            clientX: clientX - point.x - scrollTopLeft.left + offsetX,
            clientY: clientY - point.y - scrollTopLeft.top + offsetY,
            // clientWidth: clientWidth - point.x - scrollTopLeft.left + offsetC,
            // clientHeight: clientHeight - point.y - scrollTopLeft.top + offsetY,
            // rowIndex: coords.rowIndex,
            // colIndex: coords.colIndex
          })
        })
      });
    });
  }, [sheet]);

  // useEffect(() => {
  //   // if the workbook is closed then we don't want to update the commands
  //   if (workbook.isClosed()) return;

  //   let commandsBase = commandsSheet;
  //   if ((focusedComponent === 'formulaBar') && commandsFormulaBar) {
  //     // merge in the formula bar commands ahead of the sheet commands
  //     commandsBase = commandsFormulaBar.merge(commandsBase);
  //   }
  //   // if (propCommands) {
  //   //   commandsBase = propCommands.merge(commandsBase);
  //   // }
  //   // now merge the workbook
  //   commandsBase = commandsWorkbook.merge(commandsBase);
  //   // finally merge commands specific to the ui
  //   commandsBase = commandsBase.merge(uiCommands);

  //   setCommands(commandsBase);
  // }, [focusedComponent, commandsWorkbook, commandsSheet, commandsFormulaBar, propCommandsParent]);

  const handleKeyDown = useCallbackRef(
    (e: React.KeyboardEvent) => {
      if (commandsWorkbook?.dispatchToFocusedCommand(e)) {
        return;
      }
  }, [commandsWorkbook]);

  const handleActiveWorkbookFocus = useCallbackRef(() => {
    setGlobalIWorkbookElement(refLocal.current);
  }, [workbook, refLocal.current]);

  const handleSheetFocus = useCallback(() => {
    setFocusedComponent('sheet')
  }, []);

  const handleFormulaBarFocus = useCallback(() => {
    setFocusedComponent('formulaBar')
  }, []);

  const createSizedVerticalScrollbarCallback = useCallbackRef((props: SheetScrollbarProps) => {
    const isFireFox = CommonUtils.getOS() === CommonUtils.OSType.Firefox;
    return (
      <SheetScrollbar
        style={{
          borderLeft: `3px solid transparent`,
          borderRight: '0px solid transparent',
          borderTop: `${isFireFox ? 3 : 0}px solid transparent`,
          borderBottom: `${isFireFox ? 3 : 0}px solid transparent`,
          width: isFireFox ? '13px' : undefined
        }}
        {...props}
        sheet={sheet}
        endGap={END_VIRTUAL_SCROLL_GAP}
        showCustomScrollButtons={!isFireFox}
        onShowTooltip={(props) => {
          showTooltip(props.anchor, props.display, ToolTipPlacement.Left);
        }}
        onCloseTooltip={() => closeTooltip()}
      />
    )
  }, [sheet]);


  useEffect(() => {
    if (autoFocus && refSheet && refSheet.current) {
      refSheet.current.focus();
    }
  }, []);

  const [dragText, setDragText] = React.useState<string>(null);
  // handle drag events
  const handleDrag = useCallback((e: React.DragEvent<any>) => {
    if (!commandsWorkbook?.getCommand('openWorkbook')) return;
    if (e.type === "dragenter" || e.type === "dragover") {
      // Note - drop will be supported at the sheet level soon. If will auto handle text types and provide a callback for files (to open or embed)
      if (e.dataTransfer?.types.includes('Files')) {
        if (e.dataTransfer.files[0]?.type?.startsWith("image/") || e.dataTransfer.items[0]?.type?.startsWith("image/")) {
          // TODO - add drop indicator for cell.
          // The easiest, perhaps, nice ways to do this is with a tooltip?
        } else if (e.dataTransfer.types.length === 1) { // only a single item
          setDragText('Drop to open');
        }
        // e.dataTransfer.dropEffect = "copy";
      } else if (e.dataTransfer?.types.includes('text/html') || e.dataTransfer?.types.includes('text/plain')) {
        // Behavior needs to. (1. convert to in-memory sheet (to find shape). 2. Provide a drop target with shape on drag. 3. paste on drop)
        //setDragText(`Drop to paste`);
        //e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.effectAllowed = "none";
        e.dataTransfer.dropEffect = "none";
      } else {
        e.dataTransfer.effectAllowed = "none";
        e.dataTransfer.dropEffect = "none";
      }
    } else if (e.type === "dragleave") {
      setDragText(null);
    }
    e.preventDefault();
  }, [commandsWorkbook]);

  // triggers when file is dropped
  const handleDrop = useCallbackRef((e: React.DragEvent<any>) => {
    if (!commandsWorkbook?.getCommand('openWorkbook')) return;
    e.preventDefault();
    e.stopPropagation();
    setDragText(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (file?.type?.startsWith("image/")) {
        const view = refSheet.current?.getGridElement().getViewFromClient(e.clientX, e.clientY);
        if (!view) return;
        const point = view.getRelativePointFromClient(e.clientX, e.clientY);
        // TODO - would be nice if view had a getAbsoluteBoundsFromClient method
        const pointAbs = view.toAbsoluteBounds({
          ...point,
          width: 0,
          height: 0,
        });
        const coords = view.getCellCoordsFromClient(e.clientX, e.clientY);
        if (!coords) return;
        commandsWorkbook?.getCommand('insertImageFromFile')?.execute({
          file,
          options: {
            bounds: {
              x: pointAbs.x,
              y: pointAbs.y
            }
          },
          goto: {
            range: {
              ...coords
            }
          }
        });
      } else {
        commandsWorkbook?.getCommand('openWorkbook')?.execute(file);
      }
    }
  }, [commandsWorkbook, dragText]);

  const dropOverlay = useMemo(() => {
    if (!dragText) return null;
    return (
      <Box
        sx={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: (theme: Theme) => {
            return theme.palette.divider;
          },
          color: (theme: Theme) => {
            return theme.palette.primary.dark;
          }
        }}
      >
        <Typography variant="h4">
          {dragText}
        </Typography>
      </Box>
    )
  }, [dragText]);

  const refLoading = useRef<HTMLDivElement>(null);
  const loadingPane = useMemo(() => {
    return (
      <CSSTransition
        in={!isLoaded}
        nodeRef={refLoading}
        timeout={500} // react-transition-group doesn't listen for transitionend
        classNames="animating"
        unmountOnExit
      >
        <Box
          style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          left: '0px',
          top: '0px',
          width: '100%',
          height: '100%',
          pointerEvents: isLoaded ? 'none' : ((propSx as CSSProperties)?.pointerEvents),
          position: 'absolute',
          boxSizing: 'border-box',
        }}
      >
        {propRenderLoadingPanel({
          ref: refLoading,
            transitionDelay: '0',
            transparentBackground: false,
            sx: {
              opacity: isLoaded ? 0 : ((propSx as CSSProperties)?.opacity),
              pointerEvents: isLoaded ? 'none' : ((propSx as CSSProperties)?.pointerEvents),
              position: 'absolute',
              left: '0px',
              top: '0px',
              width: '100%',
              height: '100%',
              ...propsLoadingPanel
            }
          })}
        </Box>
      </CSSTransition>
    )
  }, [isLoaded, propRenderLoadingPanel, propsLoadingPanel]);

  const formulaBar = useMemo(() => {
    return propRenderFormulaBar({
      sx: {
        marginTop: (theme: Theme) => { return theme.spacing(0.25) },
        marginLeft: (theme: Theme) => { return theme.spacing(1) },
        marginRight: (theme: Theme) => { return theme.spacing(1) }
      },
      workbook,
      sheetElement: refSheet.current,
      gridStyle,
      onFocus: handleFormulaBarFocus,
      ...propsFormulaBar,
      NamedCollectionEditorProps: {
        restoreFocus: (options: FocusOptions) => refSheet.current.focus(options),
        ...propsFormulaBar?.NamedCollectionEditorProps,
        commandPopupButtonProps: {
          commands: commandsWorkbook,
          ...propsFormulaBar?.NamedCollectionEditorProps?.commandPopupButtonProps,
        }
      }
    }, refFormulaBar);
  }, [propRenderFormulaBar, propsFormulaBar, workbook, gridStyle, commandsWorkbook, isLoaded]); /* isLoaded is proxy for sheet.ref */

  const renderMovable = useCallback((props: MovableElementProps) => {
      const {
        movable,
        ...rest
      } = props;
      const movableProps = {
        movable: movable as any,
        onContextMenuCapture: (event: React.MouseEvent<HTMLElement>) => {
          handleMovableContextMenu(event, movable);
        },
        ...rest
      }

      const type = movable.getContent().getType();
      let asElement = null; //`Drawing of type '${type}'.`;
      if (type === 'picture') {
        return <PictureEditor
          loadingPanel={
            <LoadingPanel
              transitionDelay={'100'}
              // transparentBackground={false}
              style={{
                position: 'absolute', // Why is this required?
              }}
              sx={{
                border: (theme: Theme) => {
                  return `solid 1px ${theme.palette.action.active}`;
                }
              }}
            />
          }
          picture={movable.getContent() as any}
          description={movable.getDescription() ?? movable?.getName()}
          {...movableProps}
        />
      } else if (type === 'chart') {
        const propsChart = {
          ...movableProps,
          chart: movable.getContent() as any
        };
        return <ChartEditor {...propsChart} />
      } else {
        asElement = `Float of type '${type}'.`
      }
      if (typeof asElement === 'string') {
        const propsEmpty = {
          ...movableProps,
          description: asElement
        };
        asElement =  <EmptyFrame  {...propsEmpty}/>
      }
    // TODO - this should look at the overlay type call a factory to create the component
    return (
      <div
        style={{
          position: 'absolute',
          // willChange: 'top, left, width, height',
          // left, top, width, height,
          clipPath: 'inset(0px)', // prevent overflow (if desired)
          // transform: (view.zoom !== 1) ? `translate(-50%, -50%) scale(${view.zoom}) translate(50%, 50%)` : undefined,
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'stretch',
          pointerEvents: 'all',
          // overflow: 'none'
        }}
        key={movable.getUUID()}
      >
        {asElement}
      </div>
    )
  }, []);

  const sheetElement = useMemo(() => {
    const onFilterButtonMouseDown=(e: React.MouseEvent<HTMLDivElement, MouseEvent>, filter: IAutoFilter.IColumn) => {
      propsSheet?.cellRenderProps?.onFilterButtonMouseDown(e, filter);
      handleFilterMenu(e, filter);
    }

    return propRenderSheet({
      style: styleFlexFull,
      onFocus: handleSheetFocus,
      gridStyle,
      headersStyle,
      sheet,
      commands: commandsWorkbook,
      onSheetContextMenu: handleSheetContextMenu,
      onViewportChange: viewport => {
        setViewPort(viewport);
      },
      showScrollbars: false,
      viewportComponent,
      onRepeatCommandChange: propOnRepeatCommandChange,
      onElementLoad: handleSheetLoaded,
      onShowColumnTooltip: (props) => {
        showTooltip(props.anchor, props.display, ToolTipPlacement.Top); // bottom?
      },
      onShowRowTooltip: (props) => {
        showTooltip(props.anchor, props.display, ToolTipPlacement.Right);
      },
      onShowTooltip: (props) => {
        showTooltip({
          x: props.anchor.x,
          y: props.anchor.y,
          width: 0,
          height: 0
          // width: right - x,
          // height: bottom - y,
        }, props.display, props.placement);
      },
      onCloseTooltip: () => closeTooltip(),
      renderMovable,
      // columnHeaderProps,
      // rowHeaderProps,
      // docTheme,
      ...propsSheet,
      cellRenderProps: {
        onFilterButtonMouseDown,
        ...propsSheet?.cellRenderProps
      }
    }, refSheet);
  }, [propRenderSheet, commandsWorkbook, propsSheet, sheet, gridStyle, notifier, propOnRepeatCommandChange]);

  const sideBar = useMemo(() => {
    if (!isShowSidebar) return null;
    const disabled = !protection.isStructureAllowed();
    return (
      <ScriptWorkspace
        sx={{
          marginBottom: (theme: Theme) => {
            return theme.spacing(0.5); // same as top
          },
          border: (theme: Theme) => { // same as toolbar
            return `solid ${(!disabled ? alpha(theme.palette.divider, 0.2) : theme.palette.action.disabled)} 1px`
          },
          borderRadius: (theme: Theme) => {
            return `${theme.shape.borderRadius}px`
          },
          overflow: 'hidden' // because of the rounded borders
          // I can't decide. Should this have square borders on right (near tabs, perhaps just when tabs are showing?)
          // borderTopRightRadius: (theme: Theme) => {
          //   return `${theme.shape.borderRadius}px`
          // },
          // borderBottomRightRadius: (theme: Theme) => {
          //   return `${theme.shape.borderRadius}px`
          // },
        }}
        onClose={() => {
          setShowSidebar(false)
          // TODO - hack. Figure out why sidebar is not returning focus?
          requestAnimationFrame(() => {
            refSheet.current.focus();
          });
        }}
        readOnly={disabled}
        commands={commandsWorkbook}
        ref={refSidebar}
        scripts={workbook.getScripts()}
      >
        {/* TODO - refactor into generic sidebar that has ScriptWorkspace */}
      </ScriptWorkspace>
    )
  }, [isShowSidebar, commandsWorkbook, workbook, notifier, protection]);

  const mainArea = useMemo(() => {
    const scrollPane = (
      <ScrollPane
        style={{
          ...styleFlexFull,
          marginRight: sideBar && isFullWidth ? '0px' : '6px'
        }}
        viewport={viewport}
        touchElement={refSheet.current?.getGridElement()?.stage}
        onScrollViewport={(scrollPosition) => {
          refSheet.current?.getGridElement()?.scrollTo(scrollPosition);
        }}
        showHorizontalScrollbar={showHorizontalScrollbar || showTabs}
        showVerticalScrollbar={showVerticalScrollbar}
        createHorizontalScrollbar={createTabStripSharedScrollbar}
        createVerticalScrollbar={createSizedVerticalScrollbarCallback}
      >
        {sheetElement}
      </ScrollPane>
    )

    let leftPane = scrollPane;
    if (!isFullWidth) {
      leftPane = (<>
        {scrollPane}
        {workbookStrip}
      </>)
    }

    let path = null;
    let width = 4;
    let height = 13;
    if (isFullWidth) {
      path = 'm 3.6261898,11.36243 c 0,0.88365 -0.71627,1.59991 -1.59991,1.59991 -0.8836498,0 -1.60004965,-0.71626 -1.60004965,-1.59991 0,-0.88365 0.71639985,-1.6000508 1.60004965,-1.6000508 0.88364,0 1.59991,0.7164008 1.59991,1.6000508 m 0,-4.881294 c 0,0.88364 -0.71627,1.60004 -1.59991,1.60004 -0.8836498,0 -1.60004965,-0.7164 -1.60004965,-1.60004 0,-0.88365 0.71639985,-1.60005 1.60004965,-1.60005 0.88364,0 1.59991,0.7164 1.59991,1.60005 m 0,-4.881226 c 0,0.88365 -0.71627,1.60005 -1.59991,1.60005 C 1.14263,3.19996 0.42623015,2.48356 0.42623015,1.59991 0.42623015,0.71626 1.14263,0 2.0262798,0 c 0.88364,0 1.59991,0.71626 1.59991,1.59991';
    } else {
      path = 'M 1.59991,3.62619 C 0.71626,3.62619 0,2.90992 0,2.02628 0,1.1426301 0.71626,0.42623015 1.59991,0.42623015 c 0.88365,0 1.6000508,0.71639995 1.6000508,1.60004985 0,0.88364 -0.7164008,1.59991 -1.6000508,1.59991 m 4.881294,0 c -0.88364,0 -1.60004,-0.71627 -1.60004,-1.59991 0,-0.8836499 0.7164,-1.60004985 1.60004,-1.60004985 0.88365,0 1.60005,0.71639995 1.60005,1.60004985 0,0.88364 -0.7164,1.59991 -1.60005,1.59991 m 4.881226,0 c -0.88365,0 -1.60005,-0.71627 -1.60005,-1.59991 0,-0.8836499 0.7164,-1.60004985 1.60005,-1.60004985 0.88365,0 1.59991,0.71639995 1.59991,1.60004985 0,0.88364 -0.71626,1.59991 -1.59991,1.59991';
      width = 13;
      height = 4;
    }

    return (
      <SplitPane
        fixedPane="after"
        position="40%"
        minAfter={isFullWidth ? '280px' : '120px'}
        splitDirection={isFullWidth ? 'row' : 'column'}
        style={styleFlexFull}
        ref={refMeasureMainArea}
        resizerProps={{
          className: "styled-resizer",
          // todo - move this to css
          style: {
            minWidth: isFullWidth ? '6px' : undefined,
            minHeight: isFullWidth ? undefined : '6px',
            maskImage: `url("data:image/svg+xml,%3Csvg width='${width}' height='${height}' viewBox='0 0 ${width} ${height}' version='1.1' fill='${(appTheme.palette.text as any).icon ?? appTheme.palette.action.active}' xmlns='http://www.w3.org/2000/svg' xmlns:svg='http://www.w3.org/2000/svg'%3E%3Cpath d='${path}' /%3E%3C/svg%3E%0A")`,
            maskRepeat: 'no-repeat',
            maskPosition: isFullWidth  ? 'left center' : 'top center',
          },
        }}
        elementBefore={leftPane}
        paneBeforeProps={{
          style: {
            flexDirection: 'column'
          }
        }}
        elementAfter={sideBar}
        paneAfterProps={{
          style: {
            marginLeft: isFullWidth ? '0px' : '4px',
            marginRight: isFullWidth ? '8px' : '4px'
          }
        }}
      />
    );
  }, [showHorizontalScrollbar, showTabs, createTabStripSharedScrollbar, showVerticalScrollbar, viewport, sideBar, sheetElement, workbookStrip, appTheme, isFullWidth]);

  const tooltip = useMemo(() => {
    return (
      <SimpleTooltip
        arrow
        disableInteractive
        // TransitionComponent={Fade} // Not working
        open={isPopperOpen}
        title={
          <Typography
            variant="subtitle2"
            component="div"
          >
            {popperDisplay}
          </Typography>
        }
        placement={popperPlacement}
        TransitionProps={{
          timeout: {
            exit: 0, // reverse grow with arrow behaves poorly. Would be nice to just make a fade?
          }
        }}
        PopperProps={{
          popperRef,
          sx: {
            "& .MuiTooltip-tooltip": {
              padding: "2px 6px",
              "& .MuiTooltip-arrow": {
                display: isPopperOpen ? "visible" : "none"
              }
            }
          },
          anchorEl: {
            getBoundingClientRect: () => {
              return new DOMRect(
                popperAnchor.x,
                popperAnchor.y,
                popperAnchor.width,
                popperAnchor.height
              );
            },
          },
          modifiers: [
            {
                name: "offset",
                options: {
                    offset: [0, 0],
                },
            },
          ],
        }}
      >
        <Box />
      </SimpleTooltip>
    );
  }, [isPopperOpen, popperDisplay, popperPlacement, popperAnchor, popperRef]);

  const effectiveStyle = useMemo(() => {
    const themedScrollbar = scrollbarTheming(appTheme);
    return {
      boxSizing: 'border-box',
      background: (theme: Theme) => {
        if (theme.palette.mode !== 'dark')
          return gridStyle.header.fill;
        // return theme.palette.background.default;
        return theme.palette.background.paper
      },
      "& *" : {
        ...themedScrollbar,
        // some css resets
        fontWeight: 400,
      },
      '&.Mui-focusVisible': {
      },
      '& .viewport-overlay': {
        borderRight: `solid ${borderColor} ${borderWidth}px`,
        // the bottom is associated to the horizontal scrollPane
      },
      ...propSx
    }
  }, [propSx, gridStyle]);

  const formulaBarPadding = useMemo(() => {
    return (
      <Box
        sx={{
          marginBottom: (theme: Theme) => { return theme.spacing(0.75) }
        }}
      />
    );
  }, []);

  const themedStyles = useMemo(() => {
    return {
      flex: '1 1 100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      opacity: !isLoaded ? 0 : undefined,
      '--sxl-app-color-high-contrast': appTheme.palette.primary.main, // style_HighContrast // TODO - make this nicer
      '--sxl-app-color-primary': appTheme.palette.primary.main,
      '--sxl-app-color-primary-dark': appTheme.palette.primary.dark,
      '--sxl-app-color-primary-light': appTheme.palette.primary.light,
      '--sxl-app-color-info': appTheme.palette.info.main, // style_m24
      '--sxl-app-color-info-dark': appTheme.palette.info.dark, // style_m25
      '--sxl-app-color-info-light': appTheme.palette.info.light, // style_m26
      '--sxl-app-color-secondary': appTheme.palette.secondary.main, // no office equivalent
      '--sxl-app-color-secondary-dark': appTheme.palette.secondary.dark, // style_m23
      '--sxl-app-color-secondary-light': appTheme.palette.secondary.light, // style_m21 - office always makes this grey
      '--sxl-app-color-success': appTheme.palette.success.main,
      '--sxl-app-color-success-dark': appTheme.palette.success.dark,
      '--sxl-app-color-success-light': appTheme.palette.success.light,
      '--sxl-app-color-warning': appTheme.palette.warning.main,
      '--sxl-app-color-warning-dark': appTheme.palette.warning.dark,
      '--sxl-app-color-warning-light': appTheme.palette.warning.light,
      '--sxl-app-color-error': appTheme.palette.error.main,
      '--sxl-app-color-error-dark': appTheme.palette.error.dark,
      '--sxl-app-color-error-light': appTheme.palette.error.light,
      '--sxl-app-color-text': appTheme.palette.text.primary,
      '--sxl-app-color-text-secondary': appTheme.palette.text.secondary,
      '--sxl-app-color-text-disabled': appTheme.palette.text.disabled,
      '--sxl-app-color-background': appTheme.palette.background.paper, // style_m20
      '--sxl-app-color-button-surface': appTheme.palette.grey[600],
      '--sxl-app-color-shadow': appTheme.palette.action.focus,
      '--sxl-app-color-grey': appTheme.palette.grey[500], // style_m26
      // TODO - review these. They are color mode specific and this is not a good pattern.
      '--sxl-app-filter-dark-invert': gridStyle.body.darkMode && propEnabledDarkImages ? `hue-rotate(180deg) invert(1) brightness(95%)` : 'none',
      '--sxl-app-image-background': gridStyle.body.darkMode ? `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})` : undefined,
    } as CSSProperties
  }, [gridStyle, appTheme, isLoaded]);

  const classNameEffective = useMemo(() => {
    return clsx(resetsStyles['sheetxl-reset'])
  }, []);

  return (
    <Paper
      className={clsx(
        "sheetxl-workbook", workbookStyles['sheetxl-workbook'],
        {
          'Mui-focusVisible': hasFocus,
        },
        themeStyles['sheetxl-theme'],
        propClassName,
      )}

      sx={effectiveStyle as any}
      style={propStyle}
      square={false}
      {...rest}
      ref={refLocal}
      onFocus={(e: React.FocusEvent<any>) => { setFocus(true); handleActiveWorkbookFocus(); propOnFocus?.(e); }}
      onBlur={(e: React.FocusEvent<any>) => { setFocus(false); propOnBlur?.(e); }}
      onKeyDown={(e: React.KeyboardEvent<any>) => {
        handleKeyDown(e);
        propOnKeyDown?.(e);
      }}
      onDragStart={(e: React.DragEvent<any>) => {
        // TODO - dragging an image from the sheet causes a duplicate but should share the resource.
        // We want the pointer at the top/left
        if ((e.target as any).src) {
          const img = new Image();
          img.src = (e.target as any).src;
          e.dataTransfer.setDragImage(img, 1, 1);
        }
      }}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div
        className={classNameEffective}
        style={themedStyles}
      >
        {workbookToolbar}
        {showFormulaBar ? formulaBar : null}
        {formulaBarPadding}
        {mainArea}
        {statusBar}
        {tooltip}
        {contextMenuComponent}
        {dropOverlay}
      </div>
      {loadingPane}
    </Paper>
    );
  })
);

WorkbookElement.displayName = 'WorkbookElement';
export { WorkbookElement };