import React, { memo, forwardRef, useCallback } from 'react';

import { Command, ICommands, CommandButtonType } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel, ExhibitPopupPanelProps
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
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('findReplace') as Command<boolean>}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('goto') as Command<boolean>}
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
      icon={'Find'}
      {...rest}
    />
  )
}));