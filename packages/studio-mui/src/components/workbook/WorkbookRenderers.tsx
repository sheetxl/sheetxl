import React from 'react';

import {
  SheetElement, type SheetProps
} from '@sheetxl/react';


import {
  AnimatedLoadingPanel, type AnimatedLoadingPanelProps, StackTraceErrorPanel, type StackTraceErrorPanelProps
} from '@sheetxl/utils-mui';

import { FormulaBar, type FormulaBarProps } from '../formulaBar';
import { FilterColumnMenu, type FilterColumnMenuProps } from '../filter';
import { StatusBar, type StatusBarProps } from '../statusBar';
import { MovableContextMenu, type MovableContextMenuProps } from '../movable';
import {
  SheetTab, type SheetTabProps, SheetsAllMenu, type SheetsAllMenuProps, SheetTabMenu, type SheetTabMenuProps
} from '../sheet';

import { WorkbookStrip, type WorkbookStripProps } from './WorkbookStrip';
import { WorkbookContextMenu, type WorkbookContextMenuProps } from './WorkbookContextMenu';

export const renderMovableContextMenu = (props: MovableContextMenuProps): React.ReactElement => {
  return <MovableContextMenu {...props}/>
}

export const renderWorkbookContextMenu = (props: WorkbookContextMenuProps): React.ReactElement => {
  return <WorkbookContextMenu {...props}/>
}

export const renderFilterColumnMenu = (props: FilterColumnMenuProps): React.ReactElement => {
  return <FilterColumnMenu {...props}/>
}

export const renderWorkbookFormulaBar = (props: FormulaBarProps): React.ReactElement => {
  return <FormulaBar {...props}/>
}

export const renderWorkbookLoading = (props: AnimatedLoadingPanelProps): React.ReactElement => {
  return <AnimatedLoadingPanel
    transitionDelay='160ms'
    transparentBackground={true}
    {...props}
  />
}

export const renderWorkbookError = (props: StackTraceErrorPanelProps): React.ReactElement => {
  return <StackTraceErrorPanel
    fullscreen={true}
    {...props}
  />
}

export const renderWorkbookSheet = (props: SheetProps): React.ReactElement => {
  return <SheetElement {...props}/>
}

export const renderWorkbookStatusBar = (props: StatusBarProps): React.ReactElement => {
  return <StatusBar {...props}/>
}

export const renderWorkbookStrip = (props: WorkbookStripProps): React.ReactElement => {
  return <WorkbookStrip {...props}/>
}


export const renderWorkbookStripContextMenu = (props: SheetTabMenuProps): React.ReactElement => {
  return <SheetTabMenu {...props}/>
}

export const renderWorkbookStripSheetsAll = (props: SheetsAllMenuProps): React.ReactElement => {
  return <SheetsAllMenu {...props}/>
}

export const renderWorkbookSheetTab = (props: SheetTabProps): React.ReactElement => {
  return <SheetTab {...props}/>
}
