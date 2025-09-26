import React, { memo, forwardRef, useCallback } from 'react';

import { TooltipProps } from '@mui/material';

import { IBorder } from '@sheetxl/sdk';

import {
  useCallbackRef, useCommands, ICommand, ICommands, CommandButtonType, ICommandHook
} from '@sheetxl/utils-react';

import { CommandContext } from '@sheetxl/react';
import { CommandTooltip } from '@sheetxl/utils-mui';

import { BorderPopupButton, BorderPopupButtonProps } from '../components/border';

export interface BorderCommandButtonProps extends Omit<Partial<BorderPopupButtonProps>, "icon" | "label"> {
  commands?: ICommands.IGroup;

  command?: ICommand<Partial<IBorder.Properties>, CommandContext.Border>;

  icon?: React.ReactNode | ((command: ICommand) => React.ReactNode);

  label?: React.ReactNode | ((command: ICommand) => React.ReactNode);
  /**
   * Allow for listeners against a specific buttons execute rather than the command.
   *
   * @remarks
   * Useful when knowing the specific button that executed a command is required.
   * (For example when closing menus or restoring focus)
   */
  commandHook?: ICommandHook<any, any>;

  /**
   * Styling
   * @defaultValue CommandButtonType.Toolbar
   */
  variant?: CommandButtonType;

  darkMode?: boolean;
}

/**
 * Implement disabled
 * Set command on selected
 */
export const BorderCommandButton = memo(
  forwardRef<HTMLElement, BorderCommandButtonProps>((props, refForwarded) => {
  const {
    commands: propCommands,
    command: propCommand,
    commandHook: propCommandHook,
    variant = CommandButtonType.Toolbar,
    disabled: propDisabled = false,

    autoColor: propAutoColor,
    autoStrokeStyle: propAutoStrokeStyle,

    schemeLookup: propSchemeLookup,
    createTemporaryBorder: propCreateTemporaryBorder,
    selectedBorder: propSelectedBorder,
    onSelectBorder: propOnSelectBorder,
    darkMode: propDarkMode,
    icon: propIcon,
    label: propLabel,
    ...rest
  } = props;

  const commands = useCommands<Partial<IBorder.Properties>, CommandContext.Border>(propCommands, ['formatBorder']);
  const command = propCommand ?? commands[0];
  const context:CommandContext.Border = command?.context() ?? null;

  const autoColor = context?.autoColor ?? propAutoColor;
  const autoStyle = context?.autoStyle ?? propAutoStrokeStyle;

  const selectedBorder = propSelectedBorder ?? context?.quickBorder;
  const darkMode = propDarkMode ?? context?.darkMode;

  const createTemporaryBorder = propCreateTemporaryBorder ?? context?.createTemporaryBorder;
  const schemeLookup = propSchemeLookup ?? context?.schemeLookup;

  const handleOnSelectBorder = useCallbackRef((border: Partial<IBorder.Properties> | null) => {
    if (context?.onBorderSelect)
      context.onBorderSelect(border);
    propOnSelectBorder?.(border);
    command?.execute(border, propCommandHook);
  }, [command, propOnSelectBorder, propCommandHook]);

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
        command={command as ICommand<any, any>}
        placement={variant === CommandButtonType.Toolbar? "bottom-start" : "right-start"}
        disabled={disabled}
        {...rest}
      >
        {retValue}
      </CommandTooltip>
    )
  }, [command, propDisabled]);

  return (
    <BorderPopupButton
      ref={refForwarded}
      autoColor={autoColor}
      darkMode={darkMode}
      autoStrokeStyle={autoStyle}
      createTemporaryBorder={createTemporaryBorder}
      schemeLookup={schemeLookup}
      selectedBorder={selectedBorder}
      onSelectBorder={handleOnSelectBorder}
      // variant={variant === CommandButtonType.Menuitem ? PopupButtonType.Menuitem : PopupButtonType.Toolbar } // TODO - clean this up
      createTooltip={createTooltip}
      disabled={propDisabled || !command || command.disabled()}
      {...rest}
    />
  )
}));
