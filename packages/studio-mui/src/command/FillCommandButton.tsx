import React, { memo, forwardRef, useCallback } from 'react';

import { CommandButtonType, ICommands } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel, ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

export interface FillCommandButtonProps extends CommandPopupButtonProps {
}

export const FillCommandButton = memo(
  forwardRef<HTMLElement, FillCommandButtonProps>((props, refForwarded) => {
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
      scope: 'fill',
      disabled: propDisabled
    }
    const children = (<>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('fillDown')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('fillRight')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('fillUp')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('fillLeft')}
      />
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, scope]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={propCommands}
      disabled={propDisabled}
      commandHook={propCommandHook}
      label="Fill"
      tooltip="Fill the selected cells with the value from one of the corners."
      createPopupPanel={createPopupPanel}
      icon={'FillDown'}
      {...rest}
    />
  )
}));