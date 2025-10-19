import React, { memo, forwardRef } from 'react';

import { useMediaQuery } from '@mui/material';

import {
  Command, CommandButtonType, useCallbackRef, useCommands, ICommands
} from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel, ExhibitDivider, ExhibitPopupPanelProps, ThemeMode
} from '@sheetxl/utils-mui';

export const AppearanceCommandButton = memo(forwardRef<HTMLElement, CommandPopupButtonProps>((props, refForwarded) => {
  const {
    commands: propCommands,
    commandHook: propCommandHook,
    scope,
    disabled: propDisabled = false,
    ...rest
  } = props;

  const resolved = useCommands<any,any>(propCommands, ['themeMode']);
  const commandMode = resolved[0];


  const createPopupPanel = useCallbackRef((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      // parentFloat: props.floatReference,
      commandHook: propCommandHook,
      scope: 'appearance',
      disabled: propDisabled
    }

    const children = (<>
      <CommandButton
        {...commandButtonProps}
        command={commandMode as Command<ThemeMode>}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('defaultThemeMode') as Command<boolean>}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('enableDarkGrid') as Command<boolean>}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('enableDarkImages') as Command<boolean>}
      />
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, commandMode, propCommandHook, scope]);

  const darkModeUserOverride:ThemeMode = commandMode?.getState();
  const darkModeSystemDefault = useMediaQuery('(prefers-color-scheme: dark)');
  const currentDark = darkModeUserOverride === 'dark' || (darkModeUserOverride === null && darkModeSystemDefault);
  const isUserOverride = commandMode?.getState() !== null;

  return (
    <CommandPopupButton
      ref={refForwarded}
      quickCommand={'themeMode'}
      commands={propCommands}
      commandHook={propCommandHook}
      createPopupPanel={createPopupPanel}
      label="Appearance"
      tooltip="Change the light/dark mode to match your viewing preference. This does not affect the view for others."
      onQuickClick={() => { commandMode?.execute(currentDark ? 'light' : 'dark', propCommandHook) }}
      selected={isUserOverride}
      {...rest}
    />
  )
}));
