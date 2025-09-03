import React, { memo, forwardRef } from 'react';

import { useMediaQuery } from '@mui/material';

import { LightMode as LightModeIcon } from '@mui/icons-material';
import { DarkMode as DarkModeIcon } from '@mui/icons-material';

import {
  Command, CommandButtonType, useCallbackRef, useCommands, ICommands
} from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel, ExhibitDivider, ExhibitPopupPanelProps, themeIcon
} from '@sheetxl/utils-mui';

import {
  SystemDefaultDarkMode, SystemDefaultLightMode, ThemeMode
} from '@sheetxl/utils-mui';


export const AppearanceCommandButton = memo(
  forwardRef<HTMLElement, CommandPopupButtonProps>((props, refForwarded) => {
    const {
      commands: propCommands,
      commandHook: propCommandHook,
      scope,
      disabled: propDisabled = false,
      ...rest
    } = props;

    const resolved = useCommands<any,any>(propCommands, ['themeMode']);
    const commandMode = resolved[0];
    const darkModeUserOverride:ThemeMode = commandMode?.state();
    const isUserOverride = commandMode?.state() !== null;

    const darkModeSystemDefault = useMediaQuery('(prefers-color-scheme: dark)');
    const currentDark = darkModeUserOverride === 'dark' || (darkModeUserOverride === null && darkModeSystemDefault);

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
          // selected={isUserOverride}
          icon={themeIcon(currentDark ? <DarkModeIcon/> : <LightModeIcon/>)}
        />
        <CommandButton
          {...commandButtonProps}
          command={commands.getCommand('defaultThemeMode') as Command<boolean>}
          icon={themeIcon(darkModeSystemDefault ? <SystemDefaultDarkMode/> : <SystemDefaultLightMode/>)}
        />
        <ExhibitDivider orientation="horizontal"/>
        <CommandButton
          {...commandButtonProps}
          command={commands.getCommand('enableDarkGrid') as Command<boolean>}
          // icon={<DarkModeGrid/>}
        />
        <CommandButton
          {...commandButtonProps}
          command={commands.getCommand('enableDarkImages') as Command<boolean>}
          // icon={<DarkModeImages/>}
        />
      </>);
      return defaultCreatePopupPanel({...props, children});
    }, [propDisabled, commandMode, propCommandHook, scope, darkModeSystemDefault, darkModeUserOverride, isUserOverride]);

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
        icon={themeIcon(currentDark ? <DarkModeIcon/> : <LightModeIcon/>)}
        {...rest}
      />
    )

}));

export default AppearanceCommandButton;