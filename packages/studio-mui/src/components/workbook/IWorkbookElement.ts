import React from 'react';

import { type SxProps } from '@mui/system';
import { type Theme } from '@mui/material/styles';

import { type PaperProps } from '@mui/material';

import { type IWorkbook } from '@sheetxl/sdk';

import { type ICommands,type ICommand } from '@sheetxl/utils-react';

import { type SheetProps, type ISheetElement } from '@sheetxl/react';

import { type LoadingPanelProps } from '@sheetxl/utils-react';

import { type WorkbookToolbarsProps } from '../../toolbar';
import { type FormulaBarProps, type IFormulaBarElement } from '../formulaBar';
import { type FilterColumnMenuProps } from '../filter';
import { type StatusBarProps } from '../statusBar';

import { type WorkbookStripProps } from './WorkbookStrip';
import { type WorkbookContextMenuProps } from './WorkbookContextMenu';

import { type MovableContextMenuProps } from '../movable';

/**
 * Workbook specific attributes beyond HTMLDivElement.
 */
export interface IWorkbookAttributes {
  isWorkbookElement: () => true;
  getWorkbook: () => IWorkbook;
  getViewportElement: () => HTMLElement;
  getSheetElement: () => ISheetElement;
  getFormulaBarElement: () => IFormulaBarElement;
}


/**
 * Type returned via ref property
 */
export interface IWorkbookElement extends HTMLDivElement, IWorkbookAttributes {};


export type WorkbookLoadEvent = {
  source: IWorkbookElement;
}

export interface WorkbookElementProps extends Omit<PaperProps, 'autoFocus'> {
  /**
   * A memory model of the workbook.
   * If one is not provided a default workbook model will be used.
   * This can be accessed via the workbook ref.
   */
  workbook?: IWorkbook;
  /**
   * Callback for when the workbook is loaded. Useful for hiding/showing
   * loading panels.
   */
  // TODO - on first render
  onElementLoad?: (event: WorkbookLoadEvent) => void | Promise<void>;
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;
  /**
   * Additional commands provided by application.
   */
  commands?: ICommands.IGroup;
  /**
   * Notify that there is a new repeatable command.
   */
  onRepeatCommandChange?: (command: ICommand<any, any>) => void;
  /**
   * Indicate if the formulaBar should be showing.
   * @defaultValue 'workbook model but can be overridden'
   */
  showFormulaBar?: boolean;
  /**
   * Allow for customizations on FormulaBar.
   */
  formulaBarProps?: FormulaBarProps;
  /**
   * Render FormulaBar.
   *
   * @param props The properties for the FormulaBar.
   * @returns A React Element representing the FormulaBar.
   */
  renderFormulaBar?: (props: FormulaBarProps) => React.ReactElement;
  /**
   * This doesn't influence # of tabs just the visibility of the widget.
   * @defaultValue 'workbook model but can be overridden'
   */
  showTabs?: boolean;
  /**
   * Allow for customizations on tabs.
   */
  tabsProps?: WorkbookStripProps;
  /**
   * Render custom tabs.
   * @param props
   * @returns A React Element representing the Tabs for the WorkbookStrip.
   */
  renderTabs?: (props: WorkbookStripProps) => React.ReactElement;
  /**
   * Shows the statusbar.
   * @defaultValue 'workbook model but can be overridden'
   */
  showStatusBar?: boolean;
  /**
   * Customizations for the status bar
   */
  statusBarProps?: StatusBarProps;
  /**
   * Pass in a custom statusbar.
   *
   * @param props
   * @returns A React Element representing the StatusBar.
   */
  renderStatusBar?: (props: StatusBarProps) => React.ReactElement;
  /**
   * Props for the toolbar.
   */
  toolbarProps?: WorkbookToolbarsProps;
  /**
   * Pass in a custom toolbar.
   * @param props
   * @returns A React Element representing the Toolbar.
   */
  renderToolbar?: (props: WorkbookToolbarsProps) => React.ReactElement;
  /**
   * Allow for customizations on the context menu.
   */
  contextMenuSx?: SxProps<Theme>;
  /**
   * Render custom context menu.
   * @param props
   * @returns A React Element representing the ContextMenu.
   */
  renderContextMenu?: (props: WorkbookContextMenuProps) => React.ReactElement;
  /**
   * Render custom filter menu.
   *
   * @param props
   * @returns A React Element representing the FilterMenu.
   */
  renderFilterMenu?: (props: FilterColumnMenuProps) => React.ReactElement;
  /**
   * Render custom movable menu.
   *
   * @param props
   * @returns A React Element representing the MovableMenu.
   */
  renderMovableMenu?: (props: MovableContextMenuProps) => React.ReactElement;
  /**
   * Allow for customizations on loading panels.
   */
  loadingProps?: LoadingPanelProps;
  /**
   * Assign a custom loading panel.
   *
   * @returns A React Element representing the LoadingPane.
   */
  renderLoading?: (props: LoadingPanelProps) => React.ReactElement;
  /**
   * Allow for customizations on loading panel.
   */
  sheetProps?: SheetProps;
  /**
   * Render custom ISheetElement.
   *
   * @param props
   * @returns A React Element representing the Sheet.
   */
  renderSheet?: (props: SheetProps) => React.ReactElement;
  /**
   * Allows users to Wrap stage children in Top level Context
   */
  mainWrapper?: (children: React.ReactNode) => React.ReactElement;
  /**
   * Show the horizontal scrollbar
   */
  showHorizontalScrollbar?: boolean;
  /**
   * Show the vertical scrollbar
   */
  showVerticalScrollbar?: boolean;
  /**
   * Will autofocus to the sheet.
   * @defaultValue false
   */
  autoFocus?: boolean | FocusOptions;
  /**
   * Allow you to specify a specific material ui theme for the grid.
   *
   * * @defaultValue - The current Theme.
   *
   * @remarks
   * Useful for decorating the application with a single theme (such as dark mode) but render
   * the main grid using a different theme (for example light mode).
  */
  gridTheme?: Theme;
  /**
   * Allow you to specify a specific material ui theme for the headers.
   *
   * * @defaultValue - The grid theme.
  */
  headersTheme?: Theme;
  /**
   * If dark theme then the images will invert unless true.
   *
   * @defaultValue false
   */
  // css attribute bot a prop
  enableDarkImages?: boolean;
  /**
   * Ref for the workbook element
   */
  ref?: React.Ref<IWorkbookElement>;
}