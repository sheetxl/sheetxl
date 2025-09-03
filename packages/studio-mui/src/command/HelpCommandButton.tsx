import React, { memo, forwardRef, useCallback } from 'react';

import { Keyboard as KeyboardIcon } from '@mui/icons-material';

import { ICommand, ICommands, CommandButtonType } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps, defaultCreatePopupPanel,
  ExhibitPopupPanelProps, ExhibitDivider, themeIcon
} from '@sheetxl/utils-mui';
import {
  HelpIcon, GithubIcon, DiscordIcon, DocumentationIcon, TicketIcon
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
        icon={themeIcon(<KeyboardIcon/>)}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('gotoUrlGithub')}
        icon={themeIcon(<GithubIcon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('gotoUrlDiscord')}
        icon={themeIcon(<DiscordIcon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('gotoUrlDocumentation')}
        icon={themeIcon(<DocumentationIcon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('gotoUrlIssue')}
        icon={themeIcon(<TicketIcon/>)}
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
      icon={themeIcon(<HelpIcon sx={{transform: 'scale(0.75)'}}/>)}
      {...rest}
    />
  )

}));

export default HelpCommandButton;