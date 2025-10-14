import React, {
  useEffect, useRef, useState, useCallback, memo, forwardRef, useMemo
} from 'react';

import { SxProps } from '@mui/system';
import { Theme, alpha } from '@mui/material/styles';

import clsx from 'clsx';

import { Box } from '@mui/material';
import { IconButton } from '@mui/material';

import { IWorkbook, ISheet, IWorkbookProtection } from '@sheetxl/sdk';

import { useCallbackRef, ICommands, DynamicIcon } from '@sheetxl/utils-react';
import { GridStyle } from '@sheetxl/grid-react';
import { TabStrip, useModelListener } from '@sheetxl/react';
import { SimpleTooltip } from '@sheetxl/utils-mui';

import {
  ExhibitIconButton, ExhibitPopperProps, ExhibitDivider,
  ExhibitPopupPanelProps, useFloatStack
} from '@sheetxl/utils-mui';

import {
  createScrollEdgeButton, createScrollStartButton, createScrollEndButton
} from '@sheetxl/utils-mui';

import type { SheetTabProps, SheetsAllMenuProps, SheetTabMenuProps } from '../sheet';

import {
  renderWorkbookSheetTab, renderWorkbookStripSheetsAll, renderWorkbookStripContextMenu
} from './WorkbookRenderers';

/**
 * Tab strip that operates on IWorkbook
 */
export interface WorkbookStripProps extends React.HTMLAttributes<HTMLDivElement> {
  commands?: ICommands.IGroup;
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;
  /**
   * The workbook
   */
  workbook?: IWorkbook;
  /**
   * If true, the tab strip is disabled
   * @defaultValue false
   */
  disabled?: boolean;
  /**
   * If true then the tab strips can not be modified but can still be selected.
   *
   * @defaultValue !models.getProtection().isStructureAllowed()
   * @remarks
   * This can be set to `true` but if models.getProtection().isStructureAllowed() is `false`
   * then `false` is ignored.
   */
  readOnly?: boolean;
  /**
   * Allow for customizations on context menu
   */
  contextMenuProps?: Partial<SheetTabMenuProps>;
  /**
   * Render custom context menu.
   *
   * @param props
   * @returns A React Element representing the ContextMenu.
   */
  renderContextMenu?: (props: SheetTabMenuProps) => React.ReactElement;
  /**
   * Allow for customizations on context menu
   */
  sheetsAllProps?: SheetsAllMenuProps;
  /**
   * Render custom sheet all menu.
   *
   * @param props
   * @returns A React Element representing the SheetAllMenu.
   */
  renderSheetsAll?: (props: SheetsAllMenuProps) => React.ReactElement;
  /**
   * Allow for customizations om sheet tabs.
   */
  sheetTabProps?: Partial<SheetTabProps>;
  /**
   * Render custom sheet tabs.
   * @param props
   * @returns A React Element representing a Tab for a Sheet.
   */
  renderSheetTab?: (props: SheetTabProps) => React.ReactElement;
  /**
   * Called when the user has initiated a change to the active tab
   * but before it has been rendered. This allows for
   * cleanup events or a chance to cancel the change by
   * returning false.
   * @param index
   */
  onBeforeUserChange?(index: number): boolean | void;
  /**
   * Called after the tab has been changed.
   * @param index
   */
  onUserChange?(index: number): void;

  background?: string;

  borderColor?: string;
  borderWidth?: number;

  gridTheme?: Theme;
  gridStyle?: GridStyle;
}


export const WorkbookStrip = memo(forwardRef<HTMLElement, WorkbookStripProps>(
  (props: WorkbookStripProps, refForwarded) => {
  const {
    workbook,
    commands,
    onBeforeUserChange,
    onUserChange,
    disabled=false,
    readOnly=false,
    contextMenuProps: propsContextMenu,
    renderContextMenu: propRenderContextMenu = renderWorkbookStripContextMenu,
    sheetsAllProps: propsSheetsAll,
    renderSheetsAll: propRenderSheetsAll = renderWorkbookStripSheetsAll,

    sheetTabProps: propsSheetTab,
    renderSheetTab: propRenderSheetTab,

    background="transparent",
    className,
    sx: propSx,
    borderWidth,
    borderColor,
    gridTheme,
    gridStyle,
    ...rest
  } = props;

  const [activeSheetOffset, setSheetOffset] = useState<number>(workbook?.getSelectedSheetIndex());
  const [sheets, setSheets] = useState<ISheet[]>(workbook?.getSheets().getItems());
  const [protection, setProtection] = useState<IWorkbookProtection>(workbook?.getProtection());
  useModelListener<IWorkbook, IWorkbook.IListeners>(workbook, {
    onViewChange(source: IWorkbook): void {
      setSheetOffset(source?.getSelectedSheetIndex());
    },
    onSheetsChange: (source: IWorkbook) => {
      setSheets(source.getSheets().getItems());
    },
    onProtectionChange: (source: IWorkbook) => {
      setProtection(source?.getProtection());
    },
  });

  const isProtectedOrReadOnly = readOnly || !protection.isStructureAllowed();

  const sheetNames = useMemo(() => {
    const names = [];
    for (let i=0;i<sheets.length; i++) {
      names.push(sheets[i].getName());
    }
    return names;
  }, [sheets]);

  const handleSelectedSheetIndexChange = useCallback((index: number) => {
    if (onBeforeUserChange?.(index) === false)
      return;
    workbook.getSheetAt(index).select();
    onUserChange?.(index);
  }, [workbook, onBeforeUserChange, onUserChange]);

  const handleSheetNameChange = useCallback ((index: number, value: string) => {
    workbook.getSheetAt(index).setName(value)
    onUserChange?.(index);
  }, [workbook, onUserChange]);

  const handleSheetMove = useCallback((indexFrom: number, indexTo: number) => {
    workbook.getSheetAt(indexFrom).setPosition(indexTo);
    onUserChange?.(indexTo);
  }, [workbook, onUserChange]);

  const handleSheetAdd = useCallbackRef(() => {
    if (onBeforeUserChange?.(activeSheetOffset) === false)
      return;
    const index = activeSheetOffset+1;
    const value = undefined;
    workbook.getSheets().add({ name: value, autoSelect: true });
    onUserChange?.(index);
  }, [workbook, onBeforeUserChange, onUserChange, activeSheetOffset]);

  const popperProps:Partial<ExhibitPopperProps> = useMemo(() => {
    return {
      placement:"top-start",
    }
  }, []);

  const allSheetsRef = useRef(null);
  const [isShowAllSheets, setShowAllSheets] = useState<boolean>(false);
  const createAllSheetsMenuPopupPanel = useCallback((props: ExhibitPopupPanelProps): React.ReactElement<any> => {
    const { closeFloatAll, floatReference } = props;
    return propRenderSheetsAll({
      workbook,
      gridStyle,
      floatReference,
      closeFloatAll,
      ...propsSheetsAll
    });
  }, [propRenderSheetsAll, propsSheetsAll, disabled, workbook, gridStyle]); // commands

  const {
    reference: allSheetsMenuReference,
    component: allSheetsMenuComponent
  } = useFloatStack({
    label: 'allSheet',
    popperProps: popperProps,
    anchor: allSheetsRef.current,
    onOpen: () => setShowAllSheets(true),
    onClose: () => setShowAllSheets(false),
    createPopupPanel: createAllSheetsMenuPopupPanel
  });

  const tabStripRef = useRef<any>(null);
  const [sheetTabMenuLocation, setSheetTabMenuLocation] = useState(null);

  const createSheetTabMenuPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const { floatReference } = props;
    return propRenderContextMenu?.({
      workbook,
      index: sheetTabMenuLocation?.index,
      tabStripRef: tabStripRef.current,
      commands,
      disabled,
      floatReference,
      ...propsContextMenu
    });
  }, [propRenderContextMenu, propsContextMenu, disabled, workbook, commands, sheetTabMenuLocation]);

  const {
    reference: sheetTabMenuReference,
    component: sheetTabMenuComponent
  } = useFloatStack({
    label: 'sheetTab',
    popperProps: popperProps,
    anchor: {
      getBoundingClientRect: () => {
        return new DOMRect(
          sheetTabMenuLocation?.left || 0,
          sheetTabMenuLocation?.top || 0,
          0,//sheetTabMenuLocation.width,
          0//sheetTabMenuLocation.height
        );
      }
    },
    onClose: () => setSheetTabMenuLocation(null),
    createPopupPanel: createSheetTabMenuPopupPanel
  });

  useEffect(() => {
    if (sheetTabMenuLocation) {
      sheetTabMenuReference.open(0);
    } else {
      sheetTabMenuReference.close(0);
    }
  }, [sheetTabMenuLocation]);

  const handleSheetTabMenuLocationOpen = useCallback((event: React.MouseEvent, index: number) => {
    event.preventDefault();
    setSheetTabMenuLocation({
      left: event.clientX - 2,
      top: event.clientY - 4,
      index: index
    });

  }, []);

  const createTabButton = useCallbackRef((props: SheetTabProps): React.ReactElement<any> => {
    let sheet:ISheet;
    try { // Shouldn't be needed but during open and drag the workbook will render with stale sheet props
      sheet = workbook?.getSheetAt(props.index);
    } catch (error: any) {}
    if (!sheet)
      return null;
    const tabRenderer = propRenderSheetTab ?? renderWorkbookSheetTab;
    return tabRenderer({
      sheet,
      gridTheme,
      onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
        handleSelectedSheetIndexChange(props.index);
        handleSheetTabMenuLocationOpen(event, props.index);
      },
      ...props,
      ...propsSheetTab
    });
  }, [propRenderSheetTab, propsSheetTab, workbook, gridTheme]);

  const addSheetButton = useMemo(() => {
    if (isProtectedOrReadOnly) return null;
    return (
      <SimpleTooltip
        disableInteractive
        title="New sheet"
      >
        <IconButton
          disabled={disabled}
          component="div"
          sx={{
            padding: '0',
            "&:hover:not([disabled])": {
              color: (theme:Theme) => {
                return theme.palette.primary.main;
              }
            },
            color: (theme:Theme) => {
              return ((theme.palette.text as any).icon ?? theme.palette.action.active);
            },
            "& svg": {
              width: '18px',
              height: '18px'
            }
          }}
          aria-label="addTab"
          size="small"
          onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault() }}
          onClick={() => handleSheetAdd()}
        >
          <DynamicIcon iconKey="AddCircle" />
        </IconButton>
      </SimpleTooltip>
    )
  }, [disabled, isProtectedOrReadOnly, handleSheetAdd]);

  return (
    <Box
      ref={refForwarded}
      className={clsx(className)}
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'stretch',
        flex: '1 1 100%',
        maxWidth: '100%',
        // marginBottom: '1px',
        ...propSx
      }}
      {...rest}
    >
      <TabStrip
        ref={tabStripRef}
        selectedTabIndex={activeSheetOffset}
        tabNames={sheetNames}
        onSelectedTabIndexChange={handleSelectedSheetIndexChange}
        onTabNameChange={handleSheetNameChange}
        onTabMove={handleSheetMove}
        background={background}
        borderColor={borderColor}
        borderWidth={borderWidth}
        activeColor={null}
        disabled={disabled}
        disableDrag={isProtectedOrReadOnly}
        createScrollStartButton={createScrollStartButton}
        createScrollEndButton={createScrollEndButton}
        createScrollEdgeButton={createScrollEdgeButton}
        createTabButton={createTabButton}
        createTabDivider={(props) => {
          const { key, ...rest } = props;
          return (
            <ExhibitDivider
              key={key}
              sx={{
                marginLeft: '-1px',
                marginRight: '0px',
                marginTop: '6px',
                marginBottom: '6px',
                background: (theme: Theme) => alpha(theme.palette.divider, .25),
              }}
              {...rest}
            />
          );
        }}
        editLabelProps={{
          readOnly: isProtectedOrReadOnly,
          maxLength: 31,
          styleHover: {
            fontWeight: '700'
          },
          onKeyPress: (e: React.KeyboardEvent) => {
            if (!workbook.isValidSheetNameCharacter(e.key)) {
              e.preventDefault();
            }
          },
          onCancel: () => {
            onUserChange?.(activeSheetOffset); // This is not the correct event
          }
        }}
      >
        <SimpleTooltip
          disableInteractive
          title={isShowAllSheets ? '' : "List all sheets"}
        >
          <ExhibitIconButton
            sx={{
              padding: '0px',
              ml: 0.5,
              mr: 0,
              mt: 0,
              mb: 0,
              "& svg": {
                transform: "scale(0.8, 1)"
              },
              color: (theme:Theme) => {
                return ((theme.palette.text as any).icon ?? theme.palette.action.active);
              }
            }}
            ref={allSheetsRef}
            dense={true}
            outlined={false}
            selected={isShowAllSheets}
            color="primary" aria-label="menu"
            onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault() }}
            onClick={() => {
              if (!isShowAllSheets) {
                allSheetsMenuReference.open(0);
              } else {
                allSheetsMenuReference.close(0);
              }
            }}
            icon={<DynamicIcon iconKey="Menu" />}
          />
        </SimpleTooltip>
      </TabStrip>
      <div
        style={{
          borderTop: `solid ${borderColor} ${borderWidth}px`,
          minWidth: '4px'
        }}
      />
      <div
        style={{
          borderTop: `solid ${borderColor} ${borderWidth}px`,
          flex: 'none',
          display: 'flex',
          alignItems: 'center'
        }}
      >
      {addSheetButton}
      </div>
      <div
        style={{
          borderTop: `solid ${borderColor} ${borderWidth}px`,
          flex: 1,
          minWidth: '24px'
        }}
      />
      {sheetTabMenuComponent}
      {allSheetsMenuComponent}
    </Box>
  );

}));

WorkbookStrip.displayName = "WorkbookStrip";