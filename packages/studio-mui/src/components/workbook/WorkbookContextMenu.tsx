import React, { useState, useMemo, useReducer, memo, forwardRef } from 'react';

import clsx from 'clsx';

import { Theme } from '@mui/material/styles';
import { SxProps } from '@mui/system';

import { Box } from '@mui/material';

import { ICell, ICellRanges, IRangeSelection, IWorkbook, ISheet } from '@sheetxl/sdk';

import {
  ICommand, Command, ICommands, CommandButtonType, useCommand, useCommands
} from '@sheetxl/utils-react';

import { useModelListener } from '@sheetxl/react';

import {
  SimpleCommandPopupButton, CommandButton, FloatReference, ExhibitDivider, themeIcon
} from '@sheetxl/utils-mui';

import {
  CutIcon, ShowColumnIcon, HideColumnIcon, ShowRowIcon, HideRowIcon,
  InsertHyperlinkIcon, InsertCommentIcon, InsertTableIcon
} from '@sheetxl/utils-mui';

import { ColumnsResizeAutoIcon, RowsResizeAutoIcon } from '@sheetxl/utils-mui';

import { WalkingCopyCommandButton } from '../../command';
import { PasteCommandButton } from '../../command';
import { InsertCellsCommandButton } from '../../command';
import { DeleteCellsCommandButton } from '../../command';

import { ClearCommandButton } from '../../command';

import { SortFilterCommandButton } from '../../command';
// import { FilterCommandButton } from '../../command';

import { InsertImageCommandButton } from '../../command';
// import { PresetTableStylesCommandButton } from '../../command';

import { InsertChartCommandButton } from '../../chart/command';

export interface WorkbookContextMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The workbook,
   */
  workbook: IWorkbook;

  commands?: ICommands.IGroup;

  disabled?: boolean;
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;

  floatReference: FloatReference;
}

const WorkbookContextMenu: React.FC<WorkbookContextMenuProps> = memo(forwardRef<HTMLDivElement, WorkbookContextMenuProps>((props: WorkbookContextMenuProps, refForwarded) => {
  const {
    workbook,
    commands,
    disabled: propDisabled,
    sx: propSx,
    floatReference,
    className: propClassName,
    ...rest
  } = props;

  const [_, forceRender] = useReducer((s: number) => s + 1, 0);

  const [selectedSheet, setSelectedSheet] = useState<ISheet>(workbook.getSelectedSheet());
  const [selectedRanges, setSelectedRanges] = useState<ICellRanges>(selectedSheet.getSelectedRanges());
  const [selectedCell, setSelectedCell] = useState<ICell>(selectedSheet.getSelectedCell());
  useModelListener<IWorkbook, IWorkbook.IListeners>(workbook, {
    onSheetsChange(): void {
      setSelectedSheet(workbook.getSelectedSheet());
    }
  });

  useModelListener<IRangeSelection, IRangeSelection.IListeners>(selectedSheet.getSelection(), {
    onChange(): void {
      setSelectedRanges(selectedSheet.getSelectedRanges());
      setSelectedCell(selectedSheet.getSelectedCell());
      // forceRender();
    }
  });

  useCommands(commands, [], {
    onChange: () => {
      forceRender();
    }
  });

  // let asString:string;
  // const activeRanges:ICellRanges = activeSheet.getSelectedRanges();

  // const activeSelection = activeSheet.getView().selection;
  // if (activeSelection.rangeIndex !== -1) {
  //   activeRange = activeSelection.ranges[activeSelection.rangeIndex];
  // }

  const buttonProps = useMemo(() => {
    return {
      // dense: true,
      // outlined: false,
      // disabled: true
    }
  }, []);

  const commandProps = useMemo(() => {
    return {
      commandHook: {
        beforeExecute: (_command: ICommand<any, any>, _args: any): Promise<boolean | void> | boolean | void => {
          return floatReference.closeAll();
        },
        onExecute(): void {
          //focusRelated();
        },
        onError(): void {
          console.log('onError');
        },
      },
      disabled: propDisabled,
      scope: 'contextMenu',
      parentFloat : floatReference
    }
  }, [propDisabled, floatReference]);

  const commandButtonProps = useMemo(() => {
    return {
      ...buttonProps,
      ...commandProps,
      variant: CommandButtonType.Menuitem
    }
  }, [buttonProps, commandProps]);

  const commandPopupProps = useMemo(() => {
    return {
      commands,
      variant: CommandButtonType.Menuitem,
      parentFloat: floatReference,
      ...commandProps
    }
  }, [commands, commandProps, floatReference]);

  // console.log('selection', selection);
  const contextOptions = [];
  let isRowAll = selectedRanges.isEntireRows();
  let isColumnAll = selectedRanges.isEntireColumns();
  if (selectedRanges) {
    if (isRowAll) {
      contextOptions.push(
        <ExhibitDivider
          orientation="horizontal"
          key={'context:' + contextOptions.length}
        />
      );
      contextOptions.push(
        <CommandButton
          command={commands.getCommand('hideColumns')}
          {...commandButtonProps}
          icon={themeIcon(<HideColumnIcon/>)}
          key={'context:' + contextOptions.length}
        />
      );
      contextOptions.push(
        <CommandButton
          command={commands.getCommand('unhideColumns')}
          {...commandButtonProps}
          icon={themeIcon(<ShowColumnIcon/>)}
          key={'context:' + contextOptions.length}
        />
      );
    }
    if (isColumnAll) {
      contextOptions.push(
        <ExhibitDivider
          orientation="horizontal"
          key={'context:' + contextOptions.length}
        />
      );
      contextOptions.push(
        <CommandButton
          command={commands.getCommand('hideRows')}
          {...commandButtonProps}
          icon={themeIcon(<HideRowIcon/>)}
          key={'context:' + contextOptions.length}
        />
      );
      contextOptions.push(
        <CommandButton
          command={commands.getCommand('unhideRows')}
          {...commandButtonProps}
          icon={themeIcon(<ShowRowIcon/>)}
          key={'context:' + contextOptions.length}
        />
      );
    }
    if (isRowAll || isColumnAll) {
      contextOptions.push(
        <ExhibitDivider
          orientation="horizontal"
          key={'context:' + contextOptions.length}
        />
      );
    }
    if (isRowAll) {
      contextOptions.push(
        <CommandButton
          command={commands.getCommand('autoFitColumns')}
          {...commandButtonProps}
          icon={themeIcon(<ColumnsResizeAutoIcon/>)}
          key={'context:' + contextOptions.length}
        />
      );
    }
    if (isColumnAll) {
      contextOptions.push(
        <CommandButton
          command={commands.getCommand('autoFitRows')}
          {...commandButtonProps}
          icon={themeIcon(<RowsResizeAutoIcon/>)}
          key={'context:' + contextOptions.length}
        />
      );
    }
  } else {
    // asString = workbook.getRange(activeSelection.cell).toString();
  }

  const contextBefore = [];
  const formatTableStyleCommand = commands.getCommand('formatTableStyle');
  const activeTable = formatTableStyleCommand?.context()?.table();

  /* bit of a hack. we need to listen for changes to state because we update the menu */
  const _activeTableInvalidate = useCommand(formatTableStyleCommand);

  if (!isRowAll && !isColumnAll) {
    contextBefore.push(
      <ExhibitDivider
        orientation="horizontal"
        key={'contextBefore:' + contextBefore.length}
      />
    );

    if (selectedCell?.getHyperlink()) {
      contextBefore.push(
        <SimpleCommandPopupButton
          {...commandPopupProps}
          popupCommandKeys={[
            'updateHyperlink',
            'deleteHyperlink',
          ]}
          popupScope="hyperlink"
          key={'contextBefore:action' + contextBefore.length}
          quickCommand={'openHyperlink'}
          icon={(command: ICommand) => {
            const key = command.key();
            switch (key) {
              case 'openHyperlink':
                return themeIcon(<InsertHyperlinkIcon/>);
              default:
                return null;
            }
          }}
        />
      );
    } else {
      const updateHyperlinkCommand = commands.getCommand('updateHyperlink');
      contextBefore.push(
        <CommandButton
          command={updateHyperlinkCommand}
          {...commandButtonProps}
          icon={themeIcon(<InsertHyperlinkIcon/>)}
          key={'contextBefore:' + contextBefore.length}
        />
      );
    }

    if (selectedCell?.getComments()) {
      contextBefore.push(
        <SimpleCommandPopupButton
          {...commandPopupProps}
          popupCommandKeys={[
            // 'updateComments',
            // TODO - Add a quick note option?
            'deleteComments',
          ]}
          key={'contextBefore:action' + contextBefore.length}
          quickCommand={'updateComments'}
          icon={(command: ICommand) => {
            const key = command.key();
            switch (key) {
              case 'updateComments':
                return themeIcon(<InsertCommentIcon/>);
              default:
                return null;
            }
          }}
        />
      );
    } else {
      const updateCommentsCommand = commands.getCommand('updateComments');
      contextBefore.push(
        <CommandButton
          command={updateCommentsCommand}
          {...commandButtonProps}
          icon={themeIcon(<InsertCommentIcon/>)}
          key={'contextBefore:' + contextBefore.length}
        />
      );
    }

    // a bit of a flicker
    // contextBefore.push(
    //   <PresetTableStylesCommandButton
    //     key={'contextBefore:' + contextBefore.length}
    //     command={(commands.getCommand('formatTableStyle'))}
    //     {...commandPopupProps}
    //   />
    // );
    if (activeTable) {
      contextBefore.push(
        <SimpleCommandPopupButton
          {...commandPopupProps}
          variant={CommandButtonType.Menuitem}
          key={'contextBefore:' + contextBefore.length}
          popupCommandKeys={[
            // 'selectNamed',
            'convertTableToRange',
            'deleteTable',
          ]}
          popupScope="table"
          scope="context"
          commandState={activeTable}
          quickCommand={'editTable'}
          icon={(command: ICommand) => {
            const key = command.key();
            switch (key) {
              default:
                return themeIcon(<InsertTableIcon/>);
            }
          }}
        />
      );
    } else {
      contextBefore.push(
        <CommandButton
          command={commands.getCommand('insertTable')}
          {...commandButtonProps}
          icon={themeIcon(<InsertTableIcon/>)}
          key={'context:' + contextOptions.length}
        />
      );
    }

    if (__DEV__) {
      contextBefore.push(
        <InsertChartCommandButton
          {...commandPopupProps}
          // icon={themeIcon(<InsertHyperlinkIcon/>)}
          key={'contextBefore:' + contextBefore.length}
        />
      );
    }
    contextBefore.push(
      <InsertImageCommandButton
        {...commandPopupProps}
        // icon={themeIcon(<InsertHyperlinkIcon/>)}
        key={'contextBefore:' + contextBefore.length}
      />
    );
  }

  const items = (<>
    <CommandButton
      command={commands.getCommand('cut')}
      {...commandButtonProps}
      icon={<CutIcon/>}
    />
    <WalkingCopyCommandButton
      command={commands.getCommand('copy')}
      {...commandButtonProps}
    />
    <PasteCommandButton
      command={commands.getCommand('paste') as Command<void>}
      {...commandPopupProps}
      // scope="paste"
      includePasteAllInPopup={false}
    />
    <ExhibitDivider orientation="horizontal"/>
    {/* <FilterCommandButton
      {...commandPopupProps}
    /> */}
    <SortFilterCommandButton
      {...commandPopupProps}
    />
    <ExhibitDivider orientation="horizontal"/>
    <InsertCellsCommandButton
      commands={commands}
      {...commandPopupProps}
      // scope="insertCells"
      disableSheet={true}
    />
    <DeleteCellsCommandButton
      commands={commands}
      {...commandPopupProps}
      // scope="deleteCells"
      disableSheet={true}
    />
        {/* <ExhibitDivider orientation="horizontal"/> */}
    <ClearCommandButton
      {...commandPopupProps}
      // scope="clear"
    />
    {contextBefore}
    {/* // clear contents
    <CommandButton
      command={commands.getCommand('clearContents')}
      {...commandButtonProps}
      icon={themeIcon(<ClearContentsIcon/>)}
    />
    */}
    {contextOptions}
  </>);

  return (
    <Box
      ref={refForwarded}
      className={clsx("menu", propClassName)}
      sx={{
        ...propSx,
      }}
      {...rest}
    >
      {items}
    </Box>
  );
}));

WorkbookContextMenu.displayName = "WorkbookContextMenu";
export { WorkbookContextMenu };