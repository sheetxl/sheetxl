import type React from 'react';
import {
  useEffect, useRef, useState, useCallback, memo, forwardRef, useMemo
} from 'react';

import { type Theme } from '@mui/material';

import { DynamicIcon, useFloatStack, useTranslator, type FloatPopperProps, type RenderSlotFn } from '@sheetxl/utils-react';

import {
  WorkbookStrip as ReactWorkbookStrip, type WorkbookStripProps as ReactWorkbookStripProps,
  type WorkbookStripRef, type SheetTabProps
} from '@sheetxl/react';

import {
  SimpleTooltip, ExhibitIconButton, type ExhibitPopupPanelProps,
  defaultRenderScrollButtonStart, defaultRenderScrollButtonEnd, defaultRenderScrollButtonEdge
} from '@sheetxl/utils-mui';

import { type SheetsAllMenuProps, type SheetTabMenuProps } from '../sheet';

import {
  defaultRenderSheetTab, defaultRenderSheetsAll, defaultRenderSheetTabMenu
} from './DefaultRenderers';

/**
 * MUI flavor of the workbook tab strip. A thin wrapper around the chromeless
 * {@link @sheetxl/react!WorkbookStrip}: it delegates all of the tab/scroll/rename machinery and layers on
 * only the MUI-specific chrome — the ripple tab surface, the "all sheets" menu, the per-tab context menu
 * and the tooltip-wrapped scroll buttons — through the strip's render seams.
 */
export interface WorkbookStripProps extends Omit<ReactWorkbookStripProps,
  'renderSheetTab' | 'onTabContextMenu' | 'renderScrollButtonStart' | 'renderScrollButtonEnd' | 'renderScrollButtonEdge'
> {
  /**
   * Allow for customizations on the per-tab context menu.
   */
  propsSheetTabMenu?: Partial<SheetTabMenuProps>;
  /**
   * Render the per-tab context menu. `null` for none.
   */
  renderSheetTabMenu?: RenderSlotFn<SheetTabMenuProps> | null;
  /**
   * Allow for customizations on the "all sheets" menu.
   */
  propsSheetsAll?: SheetsAllMenuProps;
  /**
   * Render the "all sheets" menu.
   */
  renderSheetsAll?: RenderSlotFn<SheetsAllMenuProps>;
  /**
   * Allow for customizations on sheet tabs.
   */
  propsSheetTab?: Partial<SheetTabProps>;
  /**
   * Render custom sheet tabs. Defaults to the MUI ripple tab ({@link defaultRenderSheetTab}).
   */
  renderSheetTab?: RenderSlotFn<SheetTabProps>;
}

export const WorkbookStrip = memo(forwardRef<WorkbookStripRef, WorkbookStripProps>(
  (props: WorkbookStripProps, refForwarded) => {
  const {
    workbook,
    disabled = false,
    propsSheetTabMenu,
    renderSheetTabMenu: propRenderSheetTabMenu = defaultRenderSheetTabMenu,
    propsSheetsAll,
    renderSheetsAll: propRenderSheetsAll = defaultRenderSheetsAll,
    propsSheetTab,
    renderSheetTab: propRenderSheetTab,
    ...rest
  } = props;

  const t = useTranslator();

  // We need the strip's imperative handle for the context menu's "Rename" action (startEdit), while
  // still honoring a forwarded ref.
  const stripRef = useRef<WorkbookStripRef>(null);
  const setRefs = useCallback((el: WorkbookStripRef) => {
    stripRef.current = el;
    if (typeof refForwarded === 'function') refForwarded(el);
    else if (refForwarded) (refForwarded as any).current = el;
  }, [refForwarded]);

  const localPropsPopper: Partial<FloatPopperProps> = useMemo(() => ({ placement: 'top-start' }), []);

  // "All sheets" menu — the hamburger that sits in the strip's leading control slot.
  const allSheetsRef = useRef(null);
  const [isShowAllSheets, setShowAllSheets] = useState<boolean>(false);
  const renderAllSheetsMenuPopupPanel = useCallback((panelProps: ExhibitPopupPanelProps): React.ReactNode => {
    const { closeFloatAll, floatReference } = panelProps;
    return propRenderSheetsAll({
      workbook: workbook!,
      floatReference: floatReference!,
      closeFloatAll: closeFloatAll!,
      ...propsSheetsAll
    });
  }, [propRenderSheetsAll, propsSheetsAll, workbook]);

  const {
    reference: allSheetsMenuReference,
    component: allSheetsMenuComponent
  } = useFloatStack({
    label: 'allSheet',
    propsPopper: localPropsPopper,
    anchor: allSheetsRef.current,
    onOpen: () => setShowAllSheets(true),
    onClose: () => setShowAllSheets(false),
    renderPopupPanel: renderAllSheetsMenuPopupPanel
  });

  // Per-tab context menu — anchored at the click location.
  const [sheetTabMenuLocation, setSheetTabMenuLocation] = useState<{ left: number; top: number; index: number } | null>(null);
  const renderSheetTabMenuPopupPanel = useCallback((panelProps: ExhibitPopupPanelProps) => {
    const { floatReference } = panelProps;
    if (!propRenderSheetTabMenu) return null;
    return propRenderSheetTabMenu({
      workbook: workbook!,
      index: sheetTabMenuLocation?.index,
      tabStripRef: stripRef.current ?? undefined,
      disabled,
      floatReference: floatReference!,
      ...propsSheetTabMenu
    });
  }, [propRenderSheetTabMenu, propsSheetTabMenu, disabled, workbook, sheetTabMenuLocation]);

  const {
    reference: sheetTabMenuReference,
    component: sheetTabMenuComponent
  } = useFloatStack({
    label: 'sheetTab',
    propsPopper: localPropsPopper,
    anchor: {
      getBoundingClientRect: () => {
        return new DOMRect(
          sheetTabMenuLocation?.left || 0,
          sheetTabMenuLocation?.top || 0,
          0,
          0
        );
      }
    },
    onClose: () => setSheetTabMenuLocation(null),
    renderPopupPanel: renderSheetTabMenuPopupPanel
  });

  useEffect(() => {
    if (sheetTabMenuLocation) {
      sheetTabMenuReference.open(0);
    } else {
      sheetTabMenuReference.close(0);
    }
  }, [sheetTabMenuLocation]);

  // The chromeless strip selects the tab before invoking this; we just open the menu at the cursor.
  const handleTabContextMenu = useCallback((event: React.MouseEvent<HTMLElement>, index: number) => {
    event.preventDefault();
    setSheetTabMenuLocation({
      left: event.clientX - 2,
      top: event.clientY - 4,
      index
    });
  }, []);

  // The MUI tab surface (ripple), merging any caller `propsSheetTab`. The chromeless strip supplies the
  // resolved `sheet` / `inverted` / `onContextMenu` in `tabProps`.
  const renderSheetTab = useCallback((tabProps: SheetTabProps): React.ReactNode => {
    const tabRenderer = propRenderSheetTab ?? defaultRenderSheetTab;
    return tabRenderer({ ...tabProps, ...propsSheetTab });
  }, [propRenderSheetTab, propsSheetTab]);

  const allSheetsButton = (
    <SimpleTooltip
      disableInteractive
      title={isShowAllSheets ? '' : t('workbookStrip.listAllSheets')}
    >
      <ExhibitIconButton
        sx={{
          padding: '0px',
          ml: 0.5,
          mr: 0,
          mt: 0,
          mb: 0,
          '& svg': {
            transform: 'scale(0.8, 1)'
          },
          color: (theme: Theme) => {
            return ((theme.palette.text as any).icon ?? theme.palette.action.active);
          }
        }}
        ref={allSheetsRef}
        dense={true}
        outlined={false}
        selected={isShowAllSheets}
        color="primary" aria-label="menu"
        onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault(); }}
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
  );

  return (
    <ReactWorkbookStrip
      ref={setRefs}
      workbook={workbook}
      disabled={disabled}
      renderSheetTab={renderSheetTab}
      onTabContextMenu={handleTabContextMenu}
      renderScrollButtonStart={defaultRenderScrollButtonStart}
      renderScrollButtonEnd={defaultRenderScrollButtonEnd}
      renderScrollButtonEdge={defaultRenderScrollButtonEdge}
      {...rest}
    >
      {allSheetsButton}
      {sheetTabMenuComponent}
      {allSheetsMenuComponent}
    </ReactWorkbookStrip>
  );
}));

WorkbookStrip.displayName = 'WorkbookStrip';
