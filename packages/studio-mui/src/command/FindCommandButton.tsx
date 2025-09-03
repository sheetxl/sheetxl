import React, { memo, forwardRef, useCallback } from 'react';

// import { Search as SearchIcon } from '@mui/icons-material';

import { Command, ICommands, CommandButtonType } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps, FindIcon,
  defaultCreatePopupPanel, ExhibitPopupPanelProps, themeIcon
} from '@sheetxl/utils-mui';

import {
  FindReplaceIcon, GotoIcon
} from '@sheetxl/utils-mui';

export interface FindCommandButtonProps extends CommandPopupButtonProps {
}

/**
 * Menu for Find options
 */
export const FindCommandButton = memo(
  forwardRef<HTMLElement, FindCommandButtonProps>((props, refForwarded) => {
  const {
    commands: propCommands,
    commandHook: propCommandHook,
    scope,
    disabled: propDisabled = false,
    ...rest
  } = props;

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      // parentFloat: props.floatReference,
      commandHook: propCommandHook,
      scope,
      disabled: propDisabled
    }
    const children = (<>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('find') as Command<boolean>}
        icon={themeIcon(<FindIcon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('findReplace') as Command<boolean>}
        icon={themeIcon(<FindReplaceIcon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('goto') as Command<boolean>}
        icon={themeIcon(<GotoIcon/>)}
      />
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, scope]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={propCommands}
      commandHook={propCommandHook}
      createPopupPanel={createPopupPanel}
      label="Find & Select"
      tooltip="Find and replace cells or go to a specific location."
      quickCommand={'find'}
      icon={themeIcon(<FindIcon/>)}
      {...rest}
    />
  )

}));

export default FindCommandButton;