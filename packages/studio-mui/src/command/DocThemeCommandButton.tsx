import type React from 'react';
import { memo, forwardRef, useCallback } from 'react';


import { type IThemeCollection, type ITheme } from '@sheetxl/sdk';

import {
  useCommands, CommandButtonType, useCallbackRef
} from '@sheetxl/utils-react';

import { CommandTooltip, PopupButtonType, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

import { useGridColorScheme } from '@sheetxl/react';

import { ThemeSelectPopupButton, type ThemeSelectPopupButtonProps } from '../theme';

export interface DocThemeCommandButtonProps extends Omit<ThemeSelectPopupButtonProps, "renderPopupPanel" | "variant" | "themes" | "icon" | "label"> {
  commandKey: string;//ICommand<ITheme, CommandContext.Theme>;

  icon?: React.ReactNode | ((command: any) => React.ReactNode);

  label?: React.ReactNode | ((command: any) => React.ReactNode);

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
    commandKey,
    selectedTheme: propSelectedTheme,
    onSelectTheme: propOnSelectTheme,
    disabled: propDisabled,
    darkMode: propDarkMode,
    label: propLabel,
    icon: propIcon,
    variant,
    ...rest
  } = props;

  const command = useCommands([commandKey])[0];
  const themes:IThemeCollection = command?.getContext()?.themes;
  const selectedTheme = propSelectedTheme || command?.getContext()?.theme;
  // Self-source the grid's light/dark intent (no `context.darkMode`).
  const gridColorScheme = useGridColorScheme();
  const darkMode = propDarkMode ?? (gridColorScheme === 'dark');
  const disabled = propDisabled ?? command?.disabled();

  const handleOnSelectTheme = useCallbackRef((theme: ITheme) => {
    propOnSelectTheme?.(theme);
    command?.execute(theme);
  }, [propOnSelectTheme]);

  const renderTooltip = useCallback((props: ButtonTooltipRenderProps): React.JSX.Element => {
    const {
      disabled: disabledTip,
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
        commandKey={commandKey}
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
      renderTooltip={renderTooltip}
      disabled={disabled}
      darkMode={darkMode}
      {...rest}
    />
  )
}));