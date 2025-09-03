import React from 'react';

import {
  SheetElement, type ISheetElement, type SheetProps
} from '@sheetxl/react';

import {
  LoadingPanel, type LoadingPanelProps
} from '@sheetxl/utils-mui';

import { FormulaBar, type FormulaBarProps, type IFormulaBarElement } from '../formulaBar';
import { FilterColumnMenu, type FilterColumnMenuProps } from '../filter';
import { StatusBar, type StatusBarProps } from '../statusBar';

import { WorkbookStrip, type WorkbookStripProps } from './WorkbookStrip';
import { WorkbookContextMenu, type WorkbookContextMenuProps } from './WorkbookContextMenu';

import { MovableContextMenu, type MovableContextMenuProps } from '../movable';

export const renderMovableContextMenu = (props: MovableContextMenuProps): React.ReactElement => {
  return <MovableContextMenu {...props}/>
}

export const renderWorkbookContextMenu = (props: WorkbookContextMenuProps): React.ReactElement => {
  return <WorkbookContextMenu {...props}/>
}

export const renderFilterColumnMenu = (props: FilterColumnMenuProps): React.ReactElement => {
  return <FilterColumnMenu {...props}/>
}

export const renderWorkbookFormulaBar = (props: FormulaBarProps, ref: React.Ref<IFormulaBarElement>): React.ReactElement => {
  return <FormulaBar ref={ref} {...props}/>
}

export const renderWorkbookLoadingPanel = (props: LoadingPanelProps): React.ReactElement => {
  return <LoadingPanel {...props}/>
}

export const renderWorkbookSheet = (props: SheetProps, ref: React.Ref<ISheetElement>): React.ReactElement => {
  return <SheetElement ref={ref} {...props}/>
}

export const renderWorkbookStatusBar = (props: StatusBarProps): React.ReactElement => {
  return <StatusBar {...props}/>
}

export const renderWorkbookStrip = (props: WorkbookStripProps): React.ReactElement => {
  return <WorkbookStrip {...props}/>
}
