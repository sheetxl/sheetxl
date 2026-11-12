import type React from 'react';
import { memo, forwardRef, useCallback } from 'react';


import { type IBorders } from '@sheetxl/sdk';

import {
  useCallbackRef, useCommands, CommandButtonType
} from '@sheetxl/utils-react';

import { type CommandContext, useGridColorScheme } from '@sheetxl/react';
import { CommandTooltip, type ButtonTooltipRenderProps } from '@sheetxl/utils-mui';

import { BorderPopupButton, type BorderPopupButtonProps } from '../border';

export interface BorderCommandButtonProps extends Omit<Partial<BorderPopupButtonProps>, "icon" | "label"> {
  commandKey?: string;

  icon?: React.ReactNode | ((command: any) => React.ReactNode);

  label?: React.ReactNode | ((command: any) => React.ReactNode);

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
    commandKey,
    variant = CommandButtonType.Toolbar,
    disabled: propDisabled,

    autoColor: propAutoColor,
    autoStrokeStyle: propAutoStrokeStyle,

    schemeLookup: propSchemeLookup,
    createBorder: propCreateTemporaryBorder,
    selectedBorder: propSelectedBorder,
    onSelectBorder: propOnSelectBorder,
    darkMode: propDarkMode,
    icon: propIcon,
    label: propLabel,
    ...rest
  } = props;

  const commands = useCommands<Partial<IBorders.Properties>, CommandContext.Border>([commandKey ?? 'formatBorder']);
  const command = commands[0];
  const context:CommandContext.Border | null = command?.getContext() ?? null;

  const autoColor = context?.autoColor ?? propAutoColor;
  const autoStyle = context?.autoStyle ?? propAutoStrokeStyle;

  const selectedBorder = propSelectedBorder ?? context?.quickBorder;
  // Self-source the grid's light/dark intent (same value the grid resolves — no `context.darkMode`).
  const gridColorScheme = useGridColorScheme();
  const darkMode = propDarkMode ?? (gridColorScheme === 'dark');

  const createBorder = propCreateTemporaryBorder ?? context?.createBorder;
  const schemeLookup = propSchemeLookup ?? context?.schemeLookup;

  const handleOnSelectBorder = useCallbackRef((border: Partial<IBorders.Properties> | null) => {
    if (context?.onBorderSelect)
      context.onBorderSelect(border as Partial<IBorders.Properties>);
    propOnSelectBorder?.(border);
    command?.execute(border);
  }, [command, propOnSelectBorder]);

  const renderTooltip = useCallback((props: ButtonTooltipRenderProps): React.JSX.Element => {
    const {
      disabled,
      children,
      title, // remove default title
       ...rest
    } = props;

    let retValue = props.children;
    // no tooltip then we are done
    // if (!command?.getLabel())
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
        commandKey={commandKey}
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
      createBorder={createBorder!}
      schemeLookup={schemeLookup!}
      selectedBorder={selectedBorder!}
      onSelectBorder={handleOnSelectBorder}
      // variant={variant === CommandButtonType.Menuitem ? PopupButtonType.Menuitem : PopupButtonType.Toolbar } // TODO - clean this up
      renderTooltip={renderTooltip}
      disabled={propDisabled || !command || command.disabled()}
      {...rest}
    />
  )
}));
