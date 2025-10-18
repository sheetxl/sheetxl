import React, {
  useCallback, useLayoutEffect, useEffect, useRef, useReducer, useMemo,
  useState, memo, forwardRef, type CSSProperties
} from 'react';

import clsx from 'clsx';
import { useMeasure } from 'react-use';

import { useTheme, Theme, alpha, getOverlayAlpha } from '@mui/material/styles';

import { Box } from '@mui/material';
import { Typography } from '@mui/material';

import { CSSTransition } from 'react-transition-group';

import {
  IWorkbook, IMovable, IAutoFilter, ISheet, IWorkbookProtection,
  IWorkbookView, TypesUtils, type TopLeft, type Bounds
} from '@sheetxl/sdk';

import {
  ScrollPane, type ScrollbarProps, ToolTipPlacement, KeyModifiers, SimpleCommand,
  useCallbackRef, useImperativeElement, SplitPane,
} from '@sheetxl/utils-react';

import { GridStyle } from '@sheetxl/grid-react';

import {
  ISheetElement, SheetLocation, SheetScrollbar, type SheetScrollbarProps,
  useModelListener, type MovableElementProps
} from '@sheetxl/react';

import { PictureEditor, ChartEditor, EmptyFrame } from '@sheetxl/react';

import {
  scrollbarTheming, useFloatStack, type ExhibitPopupPanelProps, type ExhibitPopperProps,
  AnimatedLoadingPanel, SimpleTooltip
} from '@sheetxl/utils-mui';

import { createGridStyleFromMUITheme } from '../../theme';
import resetsStyles from '../../theme/Resets.module.css';
import themeStyles from '../../theme/Theme.module.css';

import { renderWorkbookToolbars } from '../../toolbar';
import { type IFormulaBarElement } from '../formulaBar';

import { useWorkbookCommands } from './useWorkbookCommands';

import type {
  IWorkbookElement, WorkbookElementProps, IWorkbookAttributes, WorkbookLoadEvent
} from './IWorkbookElement';

import workbookStyles from './Workbook.module.css';
import { setGlobalIWorkbookElement } from './GlobalWorkbookElement';

import { renderMovableContextMenu, renderFilterColumnMenu, renderWorkbookContextMenu,
  renderWorkbookFormulaBar, renderWorkbookLoading, renderWorkbookSheet,
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

const styleFlexFull: React.CSSProperties = {
  flex: `1 1 100%`,
  display: 'flex',
  boxSizing: 'border-box'
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
  propsPopper?: Partial<ExhibitPopperProps>;
}

/**
 * The main component for rendering a workbook.
 */
export const WorkbookElement = memo(forwardRef<IWorkbookElement, WorkbookElementProps>(
  (props: WorkbookElementProps, refForwarded) => {
  const {
    workbook: propWorkbook,
    onElementLoad: propOnElementLoad,
    autoFocus = false,
    style: propStyle,
    className: propClassName,
    onFocus: propOnFocus,
    onBlur: propOnBlur,
    onKeyDown: propOnKeyDown,
    onRepeatCommandChange: propOnRepeatCommandChange,
    commands: propCommandsParent,
    showFormulaBar: propShowFormulaBar,
    propsFormulaBar,
    renderFormulaBar: propRenderFormulaBar = renderWorkbookFormulaBar,
    showTabs: propShowTabs,
    propsTabs,
    renderTabs: propRenderTabs = renderWorkbookStrip,
    showStatusBar: propShowStatusBar,
    propsStatusBar,
    renderStatusBar: propRenderStatusBar = renderWorkbookStatusBar,
    propsToolbar,
    renderToolbar: propRenderToolbar = renderWorkbookToolbars,
    propsContextMenu,
    renderContextMenu: propRenderContextMenu = renderWorkbookContextMenu,
    renderFilterMenu: propRenderFilterMenu = renderFilterColumnMenu,
    renderMovableMenu: propRenderMovableMenu = renderMovableContextMenu,

    renderLoading: propsRenderLoading = renderWorkbookLoading,
    propsLoading,

    propsSheet,
    renderSheet: propRenderSheet = renderWorkbookSheet,

    wrapperMain: propWrapperMain,

    showHorizontalScrollbar: propShowHorizontalScrollbar,
    showVerticalScrollbar: propShowVerticalScrollbar,
    gridTheme: propGridTheme,
    headersTheme: propHeadersTheme,
    enableDarkImages: propEnabledDarkImages,
    ...rest
  } = props;

  if (!propWorkbook) {
    throw new Error('IWorkbook must be provided.');
  }

  const appTheme = useTheme();

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
  const refLocal = useImperativeElement<IWorkbookElement, IWorkbookAttributes>(refForwarded, () => {
    const retValue:IWorkbookAttributes & Partial<HTMLDivElement> = {
      isWorkbookElement: () => true,
      getWorkbook: () => { return propWorkbook },
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
  }, [propWorkbook]);

  // To ensure we call propOnElementLoad exactly once
  const refPropLoaded = useRef<(event: WorkbookLoadEvent) => void>(null);
  useLayoutEffect(() => {
    if (!isSheetLoaded || !refLocal.current) return;
    const onLoaded = async () => {
      if (refPropLoaded.current !== propOnElementLoad) {
        await propOnElementLoad?.({
          source: refLocal.current
        });
        refPropLoaded.current = propOnElementLoad;
      }
      setLoaded(true);
    }
    onLoaded();
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

  const [sheet, setSelectedSheet] = useState<ISheet>(propWorkbook.getSelectedSheet());
  const [protection, setProtection] = useState<IWorkbookProtection>(propWorkbook.getProtection());
  useModelListener<IWorkbook, IWorkbook.IListeners>(propWorkbook, {
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

  useModelListener<IWorkbook, IWorkbook.IListeners>(propWorkbook, {
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

  const workbookView = propWorkbook.getView();
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


  const commandsWorkbook = useWorkbookCommands({
    workbook: propWorkbook,
    workbookElement: refLocal.current,
    target: () => refSheet.current,
    onExecute,
    commands: propCommandsParent,
    darkMode: gridStyle.body.darkMode,
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

  const toolbar = useMemo(() => {
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
      workbook: propWorkbook,
      commands: commandsWorkbook,
      propsSheetTab: {
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
  }, [propRenderTabs, propsTabs, appTheme, propWorkbook, gridTheme, isFullWidth, commandsWorkbook, showTabs]);

  const createTabStripSharedScrollbar = useCallback((props: ScrollbarProps) => {
    const {
      style: propsStyle,
      ...rest
    } = props;

    let horizontalArea = null;
    let horizontalScrollbar = null;
    let horizontalTabs = null;

    if (showHorizontalScrollbar) {
      horizontalScrollbar = (
        <div
          style={{
            display: 'flex',
            flex: '1 1 100%',
            borderTop: `solid ${borderColor} ${borderWidth}px`,
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
          <SheetScrollbar
            {...rest}
            style={{
              paddingLeft: '4px',
              paddingRight: '4px',
              ...propsStyle
            }}
            /* HACK - required because thumbs are in portals */
            propsTouchThumb={{
              backgroundColor: gridTheme.palette.background.paper,
              borderColor: gridTheme.palette.primary.main,
              fillColor: 'grey',
            }}
            endGap={END_VIRTUAL_SCROLL_GAP}
            sheet={sheet}
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
          position={`${propWorkbook.getView().getTabRatio() / 10}%`}
          onPositionChange={({ percent }): void => {
            propWorkbook.getView().setTabRatio(Math.round(percent * 10));
          }}
          minBefore="200px"
          minAfter="180px"
          propsResizer={{
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
  }, [sheet, handleBeforeSheetChange, propWorkbook, gridStyle, gridTheme, commandsWorkbook, showTabs, showHorizontalScrollbar, showStatusBar, isFullWidth]);

  const [contextMenuDetails, setContextMenuDetails] = React.useState<ContextMenuDetails>(null);
  const localPropsPopper:Partial<ExhibitPopperProps> = useMemo(() => {
    return {
      placement: "right-start",
      ...contextMenuDetails?.propsPopper
    }
  }, [contextMenuDetails?.propsPopper]);

  const {
    reference: contentMenuReference,
    component: contextMenuComponent
  } = useFloatStack({
    label: 'contextMenu',
    propsPopper: localPropsPopper,
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
      propsPopper: {
        offsets: [-4, 2] // we want on the right shift up by the rounded corner amount.
      },
      createPopupPanel: (props: ExhibitPopupPanelProps) => {
        const { floatReference } = props;
        return propRenderFilterMenu({
          filter,
          commands: commandsWorkbook,
          floatReference,
          ...propsContextMenu
        });
      }
    });
  }, [propRenderFilterMenu, propsContextMenu, commandsWorkbook, propWorkbook, contextMenuDetails]);

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
          workbook: propWorkbook,
          floatReference,
          ...propsContextMenu
        });
      }
    });
  }, [propRenderContextMenu, propsContextMenu, commandsWorkbook, propWorkbook]);

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
          ...propsContextMenu
        });
      }
    });
  }, [propRenderMovableMenu, propsContextMenu, commandsWorkbook]);


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
  }, []);

  const handleSheetFocus = useCallback(() => {
    setFocusedComponent('sheet')
  }, []);

  const handleFormulaBarFocus = useCallback(() => {
    setFocusedComponent('formulaBar')
  }, []);

  const createSizedVerticalScrollbarCallback = useCallback((props: SheetScrollbarProps) => {
    const {
      style: propsStyle,
      ...rest
    } = props;
    return (
      <SheetScrollbar
        {...rest}
        style={{
          ...propsStyle,
          paddingTop: '4px',
          paddingBottom: '4px'
        }}
        /* HACK - required because thumbs are in portals */
        propsTouchThumb={{
          backgroundColor: gridTheme.palette.background.paper,
          borderColor: gridTheme.palette.primary.main,
          fillColor: 'grey',
        }}
        sheet={sheet}
        endGap={END_VIRTUAL_SCROLL_GAP}
        onShowTooltip={(props) => {
          showTooltip(props.anchor, props.display, ToolTipPlacement.Left);
        }}
        onCloseTooltip={() => closeTooltip()}
      />
    )
  }, [sheet, gridTheme]);


  useEffect(() => {
    if (autoFocus && refSheet && refSheet.current) {
      refSheet.current.focus();
    }
  }, []);

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
            position: 'absolute',
            boxSizing: 'border-box',
            pointerEvents: isLoaded ? 'none' : (propStyle?.pointerEvents),
          }}
        >
        {propsRenderLoading?.({
          ref: refLoading,
          ...propsLoading
          // style: {
          //   opacity: isLoaded ? 0 : ((propSx as CSSProperties)?.opacity),
          //   pointerEvents: isLoaded ? 'none' : ((propSx as CSSProperties)?.pointerEvents),
          //   position: 'absolute',
          //   left: '0px',
          //   top: '0px',
          //   width: '100%',
          //   height: '100%',
          //   ...propsLoadingProps
          // }
        })}
        </Box>
      </CSSTransition>
    )
  }, [isLoaded, propsRenderLoading, propsLoading]);

  const formulaBar = useMemo(() => {
    return propRenderFormulaBar({
      ref: refFormulaBar,
      sx: {
        marginTop: (theme: Theme) => { return theme.spacing(0.25) },
        marginLeft: (theme: Theme) => { return theme.spacing(1) },
        marginRight: (theme: Theme) => { return theme.spacing(1) }
      },
      workbook: propWorkbook,
      sheetElement: refSheet.current,
      gridStyle,
      onFocus: handleFormulaBarFocus,
      ...propsFormulaBar,
      propsNamedCollectionEditor: {
        restoreFocus: (options: FocusOptions) => refSheet.current.focus(options),
        ...propsFormulaBar?.propsNamedCollectionEditor,
        propsCommandPopupButton: {
          commands: commandsWorkbook,
          ...propsFormulaBar?.propsNamedCollectionEditor?.propsCommandPopupButton,
        }
      }
    });
  }, [propRenderFormulaBar, propsFormulaBar, propWorkbook, gridStyle, commandsWorkbook, isLoaded]); /* isLoaded is proxy for sheet.ref */

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
            <AnimatedLoadingPanel
              style={{
                position: 'absolute', // Why is this required?
              }}
              transitionDelay={'100'}
              // transparentBackground={false}
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
      propsSheet?.propsCellRender?.onFilterButtonMouseDown(e, filter);
      handleFilterMenu(e, filter);
    }

    return propRenderSheet({
      ref: refSheet,
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
      propsCellRender: {
        onFilterButtonMouseDown,
        ...propsSheet?.propsCellRender
      }
    });
  }, [commandsWorkbook, propsSheet, sheet, gridStyle, propOnRepeatCommandChange]);

  const mainPane = useMemo(() => {
    let mainElement = (
      <ScrollPane
        ref={refMeasureMainArea}
        style={styleFlexFull}
        viewport={viewport}
        touchElement={refSheet.current?.getGridElement()?.stage}
        onScrollViewport={(scrollPosition) => {
          refSheet.current?.getGridElement()?.scrollTo(scrollPosition);
        }}
        showHorizontalScrollbar={showHorizontalScrollbar || showTabs}
        showVerticalScrollbar={showVerticalScrollbar}
        renderScrollbarHorizontal={createTabStripSharedScrollbar}
        renderScrollbarVertical={createSizedVerticalScrollbarCallback}
      >
        {sheetElement}
      </ScrollPane>
    )
    if (!isFullWidth && widthMainArea !== 0) {
      mainElement = (<>
        {mainElement}
        {workbookStrip}
      </>)
    }
    if (!propWrapperMain) return mainElement;
    return propWrapperMain(mainElement);
  }, [
    showHorizontalScrollbar, showTabs, createTabStripSharedScrollbar, showVerticalScrollbar, viewport, isFullWidth,
    sheetElement, workbookStrip, appTheme, propWrapperMain, gridTheme
  ]);

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
        slotProps={{
          transition: {
            timeout: {
              exit: 0, // reverse grow with arrow behaves poorly. Would be nice to just make a fade?
            }
          },
          popper: {
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
            modifiers: [{
              name: "offset",
              options: {
                offset: [0, 0],
              }
            }]
          }
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
      '& .viewport-overlay': {
        borderRight: `solid ${borderColor} ${borderWidth}px`,
        // the bottom is associated to the horizontal scrollPane
      },
      ...propStyle
    }
  }, [propStyle, gridStyle]);

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
    <Box
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
      {...rest}
      ref={refLocal}
      onFocus={(e: React.FocusEvent<any>) => {
        setFocus(true);
        handleActiveWorkbookFocus();
        propOnFocus?.(e);
      }}
      onBlur={(e: React.FocusEvent<any>) => {
        setFocus(false);
        propOnBlur?.(e);
      }}
      onKeyDown={(e: React.KeyboardEvent<any>) => {
        handleKeyDown(e);
        propOnKeyDown?.(e);
      }}
    >
      <div
        className={classNameEffective}
        style={themedStyles}
      >
        {toolbar}
        {showFormulaBar ? formulaBar : null}
        {formulaBarPadding}
        {mainPane}
        {statusBar}
        {tooltip}
        {contextMenuComponent}
      </div>
      {loadingPane}
    </Box>
    );
  })
);

WorkbookElement.displayName = 'WorkbookElement';