import React, { memo, forwardRef, useCallback } from 'react';

import { ICommand, ICommands, CommandButtonType, DynamicIcon } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps, defaultCreatePopupPanel,
  ExhibitPopupPanelProps, ExhibitDivider
} from '@sheetxl/utils-mui';

export interface HelpCommandButtonProps extends CommandPopupButtonProps {}

export const HelpCommandButton = memo(
  forwardRef<HTMLElement, HelpCommandButtonProps>((props, refForwarded) => {
  const {
    commands: propCommands,
    commandHook: propCommandHook,
    scope,
    disabled: propDisabled = false,
    sx: sxProp,
    ...rest
  } = props;

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      scope: 'help',
      // parentFloat: props.floatReference,
      commandHook: {
        ...propCommandHook,
        beforeExecute: (command: ICommand<any, any>, args: any): Promise<boolean | void> | boolean | void => {
          const delegate = propCommandHook?.beforeExecute?.(command, args);
          if (delegate === false) return false;
          return props.floatReference.closeAll();
        }
      },
      disabled: propDisabled
    }
    const children = (<>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('showKeyboardShortcuts')}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('gotoUrlGithub')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('gotoUrlDiscord')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('gotoUrlDocumentation')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('gotoUrlIssue')}
      />
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      sx={sxProp}
      commands={propCommands}
      disabled={propDisabled}
      commandHook={propCommandHook}
      scope={scope}
      label="Help"
      tooltip="Help, feedback, and keyboard shortcuts."
      createPopupPanel={createPopupPanel}
      icon={<DynamicIcon iconKey="Help" style={{transform: 'scale(0.75)'}}/>}
      {...rest}
    />
  )

}));

export default HelpCommandButton;