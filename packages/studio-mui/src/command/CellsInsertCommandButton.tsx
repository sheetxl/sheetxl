import React, { useMemo, memo, forwardRef, useCallback } from 'react';

import { CommandButtonType, ICommands, useCommands } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps, defaultCreatePopupPanel,
  ExhibitPopupPanelProps, ExhibitDivider
} from '@sheetxl/utils-mui';

export interface CellsInsertCommandButtonProps extends CommandPopupButtonProps {
  disableSheet?: boolean;
  /**
   * If set to `true` only a single menu will be shown instead of a popup if
   * only one command is enabled. Useful for adding or removing rows/column on headers.
   *
   * @remarks
   * This is only considered for the `MenuButton` Variant.
   */
  preferSingleMenu?: boolean;

  showQuickButton?: boolean;
}

export const CellsInsertCommandButton = memo(
  forwardRef<HTMLElement, CellsInsertCommandButtonProps>((props, refForwarded) => {
  const {
    commands: propCommands,
    commandHook: propCommandHook,
    scope,
    disabled: propDisabled = false,
    disableSheet = false,
    preferSingleMenu = true,
    showQuickButton: _showQuickButton = true,
    variant = CommandButtonType.Toolbar,
    ...rest
  } = props;

  const commandKeys:string[] = [
    'insertCellsShiftDown',
    'insertCellsShiftRight',
    'insertRows',
    'insertColumns'
  ];
  const resolvedCommands = useCommands(propCommands, commandKeys);

  const { singleCommand, allDisabled } = useMemo(() => {
    let singleCommand = null;
    let count = 0;
    for (let i=0; i<resolvedCommands.length; i++) {
      if (resolvedCommands[i] && !resolvedCommands[i]?.disabled()) {
        // if first enabled command set otherwise null
        if (preferSingleMenu && variant === CommandButtonType.Menuitem)
          singleCommand = count === 0 ? resolvedCommands[i] : null;
        count++;
      }
    }
    return { singleCommand, allDisabled: count === 0 };
  }, [resolvedCommands]);

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    let addSheet = null;
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      // parentFloat: props.floatReference,
      commandHook: propCommandHook,
      scope: 'insertCells',
      disabled: propDisabled
    }
    if (!disableSheet)
      addSheet = (<>
        <ExhibitDivider orientation="horizontal"/>
        <CommandButton
          {...commandButtonProps}
          command={commands.getCommand('addSheet')}
        />
      </>);
    const children = (<>
      {/* Note - Excel shows right before down in menu but this feels inconsistent with rows columns.*/}
      <CommandButton
        {...commandButtonProps}
        command={resolvedCommands[0]}
      />
      {/* Note - Excel shows right before down in menu but this feels inconsistent with rows columns.*/}
      <CommandButton
        {...commandButtonProps}
        command={resolvedCommands[1]}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={resolvedCommands[2]}
      />
      {/* <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('insertRowsAfter')}
      /> */}
      {/* <ExhibitDivider orientation="horizontal"/> */}
      <CommandButton
        {...commandButtonProps}
        command={resolvedCommands[3]}
      />
      {/* <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('insertColumnsAfter')}
      /> */}
      {addSheet}
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, resolvedCommands, propCommandHook, scope]);

  // if single command show regular menu
  if (singleCommand) {
    return (
      <CommandButton
        ref={refForwarded as unknown as any}
        variant={variant}
        commandHook={propCommandHook}
        // scope={scope} // Remove the popup scope
        disabled={propDisabled}
        command={singleCommand}
        {...rest}
      />
    )
  }
  // We could have the icon change based on selection but not sure this would be nice experience.
  // To do this we would have to duplicate/abstract default logic from insertCells commands
  return (
    <CommandPopupButton
      ref={refForwarded}
      variant={variant}
      quickCommand={'insertCells'}
      // onQuickClick={!activeCommand ? () => {} : undefined} // So that it always act like popup even if we don't have a command
      commands={propCommands}
      commandHook={propCommandHook}
      scope={scope}
      disabled={propDisabled || allDisabled}
      // label={activeCommand?.label() ?? `Insert Cells`}
      tooltip={(<><span>Insert new cells, rows or columns to your workbook.</span><br/><span>To insert multiple rows or columns at a time, select multiple rows or columns in the sheet and click Insert.</span></>)}
      createPopupPanel={createPopupPanel}
      {...rest}
    />
  );
}));