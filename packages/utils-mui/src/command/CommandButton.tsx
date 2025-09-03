import React, { useRef, useMemo, memo, forwardRef, useCallback } from 'react';

import { SxProps } from '@mui/system';
import { Theme } from '@mui/material/styles';

import {
  useCommand, ICommand, CommandButtonType, ICommandHook, KeyCodes, IKeyStroke
} from '@sheetxl/utils-react';

import { type ExhibitTooltipProps } from '../button';

import { ExhibitIconButton, ExhibitMenuItem, SelectedIcon, BLANK_ICON } from '../button';

import { CommandTooltip } from './CommandTooltip';

export type CommandButtonRefAttribute = {
  ref?: React.Ref<HTMLDivElement>;
};

export interface CommandButtonOptions<STATE=any, CONTEXT=any> extends Omit<React.HTMLAttributes<HTMLElement>, "color" | "label"> {
  /**
   * Allow for listeners against a specific buttons execute rather then the command.
   * Useful when knowing the specific button that executed a command is required.
   * (For example when closing menus or restoring focus)
   */
  commandHook?: ICommandHook<STATE, CONTEXT>;
  /**
   * Optional string to enable the command label to be configured based on the scope of how it is being used.
   */
  scope?: string;

  icon?: React.ReactNode | ((command: ICommand) => React.ReactNode);

  label?: React.ReactNode | ((command: ICommand) => React.ReactNode);
  // show label?

  /**
   * The shortcut to display.
   *
   * @remarks
   * This is display only and doesn't actually track the shortcut.
   * Override the display for the shortcut on the command (if available).
   */
  shortcut?: IKeyStroke | IKeyStroke[];

  selected?: boolean;
  disabled?: boolean;
  disableHover?: boolean;
  /**
   * Tooltip properties. If this is specified then the tooltips are used.
   * Do not provide a child as this component will be the child.
   */
  tooltipProps?: Omit<ExhibitTooltipProps, 'children'>;
  /**
   * How the button will be styles.
   * @defaultValue CommandButtonType.Toolbar
   */
  variant?: CommandButtonType;
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;
  /**
   * Optional state for this specific command button.
   * @defaultValue to undefined
   */
  commandState?: STATE;

  context?: CONTEXT;
}

export interface CommandButtonProps<STATE=any, CONTEXT=any> extends CommandButtonOptions {
  command: ICommand<STATE, CONTEXT>;

  // ref?: React.Ref<unknown>;
}


export const CommandButton: React.FC<CommandButtonProps & CommandButtonRefAttribute> = memo(
  forwardRef<any, CommandButtonProps & CommandButtonRefAttribute>((props, refForwarded) => {
  const {
    command,
    commandHook: propCommandHook,
    scope,
    context,
    icon: propIcon,
    label: propLabel,
    disabled: propDisabled = false,
    variant = CommandButtonType.Toolbar,
    shortcut,
    commandState,
    tooltipProps,
    ...rest
  } = props;

  const refRipple = useRef<any>(null);
  const refRippleSelf = useRef<boolean>(false);
  const rippleDuration = 180;

  const commandHook:ICommandHook<any, any> = useMemo(() => {
    const retValue:ICommandHook<any, any> = {
      onExecute(command: ICommand<any, any>, args: any): void {
        propCommandHook?.onExecute?.(command, args);
        if (!refRippleSelf.current) {
          refRipple.current?.start({
            center: false
          })
          setTimeout(() => refRipple.current?.stop({}), rippleDuration);
        }
        refRippleSelf.current = false;
      },
      onError(command: ICommand<any, any>, error: any, args: any): void {
        propCommandHook?.onError(command, error, args);
      }
    }
    if (propCommandHook?.beforeExecute)
      retValue.beforeExecute = propCommandHook.beforeExecute;
    return retValue;
  }, [propCommandHook]);

  const _ = useCommand(command, commandHook);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; e.preventDefault();
  }, []);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; command?.execute(commandState, propCommandHook);
 }, [_, propCommandHook, commandState]);

 const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    // button prevents space so we don't check it
    // if (e.isDefaultPrevented()) return;
    if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Space) {
      command?.execute(commandState, propCommandHook);
    }
  }, [_, propCommandHook, commandState]);

  const icon = useMemo(() => {
    // If we are a menu and not selected we don't want the default checkmark icon
    if (!propIcon && variant !== CommandButtonType.Toolbar && !command?.state())
      return BLANK_ICON;
    return typeof propIcon === "function" ? propIcon(command) : propIcon ;
  }, [_, propIcon]);

  const buttonProps = useMemo(() => {
    return {
      tabIndex: 0,
      ref: refForwarded,
      selected: command?.state(),
      icon: variant === CommandButtonType.Toolbar ? icon : <SelectedIcon selected={command?.state() ?? false}>{icon}</SelectedIcon>,
      touchRippleRef: refRipple,
      disabled: propDisabled || !command || command.disabled(),
      onMouseDown,
      onMouseUp,
      onKeyDown
    }
  }, [_, propCommandHook, propDisabled, icon]);

  let retValue:React.ReactNode;
  if (variant === CommandButtonType.Menuitem) {
    retValue = (
      <ExhibitMenuItem
        {...rest}
        chips={command?.tags()}
        {...buttonProps}
      >
        {propLabel as any ?? command?.label(scope, context)}
      </ExhibitMenuItem>
    );
  } else {
    retValue = (
      <ExhibitIconButton
        {...rest}
        {...buttonProps}
      />
    );
  }

  // no tooltip then we are done
  if (!propLabel && !command?.label()) // We don't contextualize the tooltip
    return retValue;

  // can't have a disabled component in a tooltip
  if (command.disabled() || propDisabled) {
    retValue = (
      <div>
        {retValue}
      </div>
    )
  }

  retValue = (
    <CommandTooltip
      command={command}
      placement={variant === CommandButtonType.Toolbar? "bottom-start" : "right-start"}
      shortcut={shortcut}
      {...tooltipProps}
    >
      {retValue}
    </CommandTooltip>
  )
  return retValue;
}));

export default CommandButton;