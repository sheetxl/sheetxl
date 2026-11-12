import type React from 'react';
import { useState, memo, forwardRef } from 'react';

import clsx from 'clsx';

import { Box } from '@mui/material';

import {
  type ICell, type ICellRanges, type IRangeSelection, type IWorkbook, type IWorksheet
} from '@sheetxl/sdk';

import {
  CommandButtonType, useCommandButtonRegistry,
  type CommandButtonEntry, type FloatReference
} from '@sheetxl/utils-react';

import { useModelListener, useModelSync } from '@sheetxl/react';

import {
  CommandGroup, renderMembers
} from '@sheetxl/utils-mui';

export interface WorkbookContextMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The workbook,
   */
  workbook: IWorkbook;

  disabled?: boolean;

  floatReference: FloatReference;
}

/**
 * The grid's context menu. It acts on the selected worksheet's selection, so it shows nothing while
 * the active tab is a sheet of another kind.
 */
export const WorkbookContextMenu: React.FC<WorkbookContextMenuProps> = memo(forwardRef<HTMLDivElement, WorkbookContextMenuProps>((props: WorkbookContextMenuProps, refForwarded) => {
  useModelSync<IWorkbook.IListeners>(props.workbook, 'onSelectedSheetChange');
  const sheet = props.workbook.getSelectedWorksheet();
  if (!sheet) return null;
  return <WorkbookContextMenuBody {...props} ref={refForwarded} sheet={sheet}/>;
}));

const WorkbookContextMenuBody = memo(forwardRef<HTMLDivElement, WorkbookContextMenuProps & { sheet: IWorksheet }>((props, refForwarded) => {
  const {
    workbook,
    sheet,
    disabled: propDisabled,
    floatReference,
    className: propClassName,
    ...rest
  } = props;

  const [selectedSheet, setSelectedSheet] = useState<IWorksheet>(sheet);
  const [selectedRanges, setSelectedRanges] = useState<ICellRanges>(selectedSheet.getSelectedRanges());
  const [selectedCell, setSelectedCell] = useState<ICell>(selectedSheet.getSelectedCell());
  useModelListener<IWorkbook, IWorkbook.IListeners>(workbook, {
    onSheetsChange(): void {
      const next = workbook.getSelectedWorksheet();
      if (next) setSelectedSheet(next);
    }
  });

  useModelListener<IRangeSelection, IRangeSelection.IListeners>(selectedSheet.getSelection(), {
    onChange(): void {
      setSelectedRanges(selectedSheet.getSelectedRanges());
      setSelectedCell(selectedSheet.getSelectedCell());
    }
  });

  const registry = useCommandButtonRegistry();

  // No `beforeExecute → closeAll`: dismiss-on-execute is owned by the enclosing float. The `useCommands`
  // observer closes the float published via `FloatStackProvider` (useFloatStack wraps this menu's panel)
  // on execute, honoring the `quickAction` opt-out — the same float this menu's `floatReference` points at.
  const commandProps = {
    disabled: propDisabled,
    groupKey: 'contextMenu',
  };

  // The always-present spine (with any host contributions) comes from the registered `contextMenu`
  // surface; the selection-conditional sections below depend on live selection and are woven in here.
  const isEntireRows = selectedRanges.isEntireRows();
  const isEntireColumns = selectedRanges.isEntireColumns();

  // Per-cell actions (hyperlink / note / comment). Each is a split popup when the feature is present
  // on the cell, else a single "add" command; a table offers only its split, never an insert. `groupKey` preserves the compact scoped labels (Edit /
  // Delete) for the hyperlink and table popups.
  const contextBefore: (string | '-' | CommandButtonEntry)[] = [];
  if (!isEntireRows && !isEntireColumns) {
    contextBefore.push('-');
    contextBefore.push(selectedCell?.getHyperlink() ? {
      render: (props) => (
        <CommandGroup {...props} groupKey="hyperlinkOptions" members={['updateHyperlink', 'deleteHyperlink']} quickCommand="openHyperlink"/>
      )
    } : 'updateHyperlink');
    // A cell has a note or a threaded comment, never both: an empty one offers each.
    const selectedComment = selectedCell?.getComments();
    if (!selectedComment) {
      contextBefore.push('editNote', 'updateComments');
    } else if (selectedComment.isNote()) {
      contextBefore.push({
        render: (props) => (
          <CommandGroup {...props} groupKey="noteOptions" members={['showHideNote', 'deleteComments']} quickCommand="editNote"/>
        )
      });
    } else {
      contextBefore.push({
        render: (props) => (
          <CommandGroup {...props} members={['showCommentsPane', 'deleteComments']} quickCommand="updateComments"/>
        )
      });
    }
    // Excel's Sparklines submenu, while the cell has one.
    if (selectedCell?.getSparkline()) contextBefore.push('sparklineOptions');
    const selectedTable = selectedCell?.getRange().getTables()[0] ?? null;
    if (selectedTable) {
      contextBefore.push({
        render: (props) => (
          <CommandGroup {...props} groupKey="tableOptions" members={['convertTableToRange', 'deleteTable']} quickCommand="editTable" commandState={selectedTable}/>
        )
      });
    }
  }

  // Row / column header actions, keyed off whether entire rows and/or columns are selected.
  const contextOptions: (string | '-')[] = [];
  if (isEntireRows) contextOptions.push('-', 'hideRows', 'unhideRows');
  if (isEntireColumns) contextOptions.push('-', 'hideColumns', 'unhideColumns');
  if (isEntireRows || isEntireColumns) contextOptions.push('-');
  if (isEntireRows) contextOptions.push('autoFitRows', 'resizeRows');
  if (isEntireColumns) contextOptions.push('autoFitColumns', 'resizeColumns');

  const members: (string | '-' | null | CommandButtonEntry)[] = [
    ...(registry.resolveMembers('contextMenu') ?? []),
    ...contextBefore,
    ...contextOptions,
    // Format Cells last, on its own - the catch-all for anything the sections above don't cover.
    '-',
    'formatCells'
  ];

  const children = renderMembers(members, {
    variant: CommandButtonType.Menuitem,
    dividerOrientation: 'horizontal',
    groupKey: 'contextMenu',
    registry,
    propsCommandButton: commandProps,
    propsCommandPopup: commandProps
  });

  return (
    <Box
      ref={refForwarded}
      className={clsx('menu', propClassName)}
      {...rest}
    >
      {children}
    </Box>
  );
}));

WorkbookContextMenuBody.displayName = 'WorkbookContextMenuBody';
WorkbookContextMenu.displayName = 'WorkbookContextMenu';
