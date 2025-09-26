import React, { forwardRef, memo, useCallback, useMemo } from 'react';

import { TooltipProps } from '@mui/material';

import { useCallbackRef } from '@sheetxl/utils-react';
import { useCommand } from '@sheetxl/utils-react';

import { IColor, Color } from '@sheetxl/sdk';

import { Command, CommandButtonType, ICommand, ICommandHook } from '@sheetxl/utils-react';

import { CommandContext } from '@sheetxl/react';

import {
  CommandTooltip, PopupButtonType
} from '@sheetxl/utils-mui';

import {
  ColorPopupButton, ColorPanelProps, ColorPopupButtonProps
} from '../components/color';

/**
 * Wraps ColorPopupButton with a command.
 */
export interface ColorCommandButtonProps extends Omit<ColorPopupButtonProps, "selectedColor" | "variant" | "icon" | "label"> {
  command: Command<IColor, CommandContext.Color>;
  /**
   * Allow for listeners against a specific buttons execute rather than the command.
   *
   * @remarks
   * Useful when knowing the specific button that executed a command is required.
   * (For example when closing menus or restoring focus)
   */
  commandHook?: ICommandHook<any, any>;

  icon?: React.ReactNode | ((command: ICommand) => React.ReactNode);

  label?: React.ReactNode | ((command: ICommand) => React.ReactNode);
  /**
   * Styling
   * @defaultValue CommandButtonType.Toolbar
   */
  variant?: CommandButtonType;
  /**
   * Hint to indicate to the popup to behave like a split button even if no commands is available.
   */
  isSplit?: boolean;

  darkMode?: boolean;
}

export const ColorCommandButton = memo(
    forwardRef<HTMLElement, ColorCommandButtonProps>((props, refForwarded) => {
  const {
    command,
    commandHook,
    onSelectColor: propOnSelectedColor,
    disabled: propDisabled = false,
    variant = CommandButtonType.Toolbar,
    quickColor: propQuickColor,
    panelProps: propPanelProps,
    isSplit = false,
    darkMode: propDarkMode,
    icon,
    ...rest
  } = props;

  const {
    autoColor: propAutoColor,
    schemeLookup: propSchemeLookup,
    recentColors: propRecentColors,
    ...restPanelProps
  } = propPanelProps;

  if ((rest as any).selectedColor)
    throw new Error('Command selectedColor will be used. Do not try to provide one as a direct argument');
  const _ = useCommand(command);

  const context:CommandContext.Color = command?.context();
  let quickColor = propQuickColor ?? context?.quickColor;
  if (isSplit && !quickColor)
    quickColor = new Color('transparent');
  const autoColor = propAutoColor ?? context?.autoColor;
  const schemeLookup = propSchemeLookup ?? context?.schemeLookup;
  const recentColors = propRecentColors ?? context?.recentColors;
  const darkMode = propDarkMode ?? context?.darkMode;

  const panelProps:Partial<ColorPanelProps> = useMemo(() => {
    return {
      autoColor,
      schemeLookup,
      recentColors,
      darkMode,
      ...restPanelProps
    };
  }, [autoColor, schemeLookup, recentColors, darkMode]);

  const handleOnSelectColor = useCallbackRef((color: IColor | null, isCustom: boolean) => {
    if (color && isCustom && context?.addRecentColor)
      context.addRecentColor(color);
    if (context?.onColorSelect)
      context.onColorSelect(color);
    propOnSelectedColor?.(color, isCustom);
    command?.execute(color, commandHook);
  }, [command, propOnSelectedColor, commandHook, context]);

  const createTooltip = useCallback((props: TooltipProps, disabled: boolean): React.JSX.Element => {
    const {
      children,
      title, // remove default title
       ...rest
    } = props;

    let retValue = props.children;
    // no tooltip then we are done
    // if (!command?.label())
    //   return retValue;

    // can't have a disabled component in a tooltip
    if (command?.disabled() || propDisabled) {
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
        disabled={disabled}
        {...rest}
      >
        {retValue}
      </CommandTooltip>
    )
  }, [command, propDisabled]);

  return (
    <ColorPopupButton
      ref={refForwarded}
      panelProps={panelProps}
      icon={icon as any}
      quickColor={quickColor}
      selectedColor={command?.state()}
      onSelectColor={handleOnSelectColor}
      variant={variant === CommandButtonType.Menuitem ? PopupButtonType.Menuitem : PopupButtonType.Toolbar } // TODO - clean this up
      createTooltip={createTooltip}
      label={command?.label() as any}
      disabled={propDisabled || !command || command.disabled()}
      compareRGB={true}
      darkMode={darkMode}
      {...rest}
    />
  );
}));

ColorCommandButton.displayName = "ColorCommandButton";