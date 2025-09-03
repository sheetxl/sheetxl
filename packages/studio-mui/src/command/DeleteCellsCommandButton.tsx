import React, { useMemo, memo, forwardRef, useCallback } from 'react';

import { CommandButtonType, ICommands, useCommands } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps, ExhibitDivider,
  ExhibitPopupPanelProps, defaultCreatePopupPanel, themeIcon
} from '@sheetxl/utils-mui';

import { RemoveColumn2Icon, RemoveRowIcon, RemoveCellsIcon, BlankIcon } from '@sheetxl/utils-mui';

export interface DeleteCellsCommandButtonProps extends CommandPopupButtonProps {
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

export const DeleteCellsCommandButton = memo(
  forwardRef<HTMLElement, DeleteCellsCommandButtonProps>((props, refForwarded) => {
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
    'deleteCellsShiftUp',
    'deleteCellsShiftLeft',
    'deleteRows',
    'deleteColumns'
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


  // TODO - Move to CommandButtonRegistry
  const commandIcons:Map<string, React.ReactElement> = useMemo(() => {
    const mapIcons = new Map();
    mapIcons.set('deleteCellsShiftUp', themeIcon(<RemoveCellsIcon sx={{ transform: 'rotate(0deg)'}}/>));
    mapIcons.set('deleteCellsShiftLeft', themeIcon(<RemoveCellsIcon sx={{ transform: 'rotate(270deg)'}}/>));
    mapIcons.set('deleteRows', themeIcon(<RemoveRowIcon/>));
    mapIcons.set('deleteColumns', themeIcon(<RemoveColumn2Icon/>));

    return mapIcons;
  }, []);

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      // parentFloat: props.floatReference,
      commandHook: propCommandHook,
      scope: 'deleteCells',
      disabled: propDisabled
    }
    let deleteSheet = null;
    if (!disableSheet)
    deleteSheet = (<>
        <ExhibitDivider orientation="horizontal"/>
        <CommandButton
          {...commandButtonProps}
          command={commands.getCommand('deleteSheet')}
          icon={themeIcon(<BlankIcon/>)}
        />
      </>);
    const children = (<>
      {/* Note - Excel shows left before up in menu but this feels inconsistent with rows columns.*/}
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('deleteCellsShiftUp')}
        icon={commandIcons.get('deleteCellsShiftUp')}
      />
      {/* Note - Excel shows left before up in menu but this feels inconsistent with rows columns.*/}
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('deleteCellsShiftLeft')}
        icon={commandIcons.get('deleteCellsShiftLeft')}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('deleteRows')}
        icon={commandIcons.get('deleteRows')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('deleteColumns')}
        icon={commandIcons.get('deleteColumns')}
      />
      {deleteSheet}
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, scope, commandIcons]);


  // if single command shows a regular menu
  if (singleCommand) {
    return (
      <CommandButton
        ref={refForwarded as unknown as any}
        variant={variant}
        commandHook={propCommandHook}
        // scope={scope} // Remove the popup scope
        disabled={propDisabled}
        command={singleCommand}
        icon={commandIcons.get(singleCommand.key())}
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
      quickCommand={'deleteCells'}
      commands={propCommands}
      commandHook={propCommandHook}
      scope={scope}
      disabled={propDisabled || allDisabled}
      // label={label}
      tooltip={(<><span>Delete cells, rows, columns or sheets from your workbook.</span><br/><span>To delete multiple rows or columns at a time, select multiple rows or columns in the sheet and click Delete.</span></>)}
      createPopupPanel={createPopupPanel}
      icon={themeIcon(<RemoveColumn2Icon/>)}
      {...rest}
    />
  )

}));

export default DeleteCellsCommandButton;