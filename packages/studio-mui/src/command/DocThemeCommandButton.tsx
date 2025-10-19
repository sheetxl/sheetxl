import React, { memo, forwardRef, useCallback } from 'react';

import type { TooltipProps } from '@mui/material';

import { IThemeCollection, ITheme } from '@sheetxl/sdk';

import {
  ICommand, Command, CommandButtonType, useCommand, useCallbackRef
} from '@sheetxl/utils-react';

import type { CommandContext } from '@sheetxl/react';

import { CommandTooltip, PopupButtonType } from '@sheetxl/utils-mui';

import { ThemeSelectPopupButton, type ThemeSelectPopupButtonProps } from '../components/theme';


export interface DocThemeCommandButtonProps extends Omit<ThemeSelectPopupButtonProps, "createPopupPanel" | "variant" | "themes" | "icon" | "label"> {
  command: ICommand<ITheme, CommandContext.Theme>;

  icon?: React.ReactNode | ((command: ICommand) => React.ReactNode);

  label?: React.ReactNode | ((command: ICommand) => React.ReactNode);

  /**
   * Allow for listeners against a specific buttons execute rather than the command.
   *
   * @remarks
   * Useful when knowing the specific button that executed a command is required.
   * (For example when closing menus or restoring focus)
   */
  commandHook?: ICommand.Hook<any, any>;

  selectedTheme?: ITheme;
  onSelectTheme?: (docTheme: ITheme) => void;

  /**
   * Styling
   * @defaultValue CommandButtonType.Toolbar
   */
  variant?: CommandButtonType;

  darkMode?: boolean;
}

export const DocThemeCommandButton = memo(
  forwardRef<HTMLElement, DocThemeCommandButtonProps>((props, refForwarded) => {
  const {
    command,
    commandHook,
    selectedTheme: propSelectedTheme,
    onSelectTheme: propOnSelectTheme,
    disabled: propDisabled = false,
    darkMode: propDarkMode,
    label: propLabel,
    icon: propIcon,
    variant,
    ...rest
  } = props;

  const _ = useCommand(command);
  const themes:IThemeCollection = command?.getContext()?.themes;
  const selectedTheme = propSelectedTheme || command?.getContext()?.theme;
  const darkMode = propDarkMode ?? command?.getContext()?.darkMode;
  const disabled = propDisabled || command?.disabled();

  const handleOnSelectTheme = useCallbackRef((theme: ITheme) => {
    propOnSelectTheme?.(theme);
    command?.execute(theme, commandHook);
  }, [propOnSelectTheme, commandHook]);

  const createTooltip = useCallback((props: TooltipProps, disabledTip: boolean): React.JSX.Element => {
    const {
      children,
      title, // remove default title
       ...rest
    } = props;

    let retValue = props.children;
    // can't have a disabled component in a tooltip
    if (disabled || disabledTip) {
      retValue = (
        <div>
          {retValue}
        </div>
      )
    }

    return (
      <CommandTooltip
        command={command as Command<any, any>}
        placement={variant === CommandButtonType.Toolbar? "bottom-start" : "right-start"}
        disabled={disabled || disabledTip}
        {...rest}
      >
        {retValue}
      </CommandTooltip>
    )
  }, [command, disabled]);

  return (
    <ThemeSelectPopupButton
      ref={refForwarded}
      themes={themes}
      selectedTheme={selectedTheme}
      onSelectTheme={handleOnSelectTheme}
      variant={variant === CommandButtonType.Menuitem ? PopupButtonType.Menuitem : PopupButtonType.Toolbar } // TODO - clean this up
      createTooltip={createTooltip}
      disabled={disabled}
      darkMode={darkMode}
      {...rest}
    />
  )
}));