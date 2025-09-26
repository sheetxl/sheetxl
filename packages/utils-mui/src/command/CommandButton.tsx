import React, { useRef, useMemo, memo, forwardRef, useCallback } from 'react';

import {
  useCommand, ICommand, CommandButtonType, ICommandHook, KeyCodes,
  CommandButtonRefAttribute, CommandButtonProps, DynamicIcon
} from '@sheetxl/utils-react';

import { ExhibitIconButton, ExhibitMenuItem, SelectedIcon } from '../button';

import { CommandTooltip } from './CommandTooltip';

const BLANK_ICON = <DynamicIcon/>;

export const CommandButton = memo(
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
    if (propIcon) {
      return typeof propIcon === "function" ? propIcon(command) : propIcon ;
    }
    // If we are a menu and not selected we don't want the default checkmark icon
    let commandIcon = command?.icon(context);
    if (commandIcon) {
      if (typeof commandIcon === "string") {
        commandIcon = <DynamicIcon iconKey={commandIcon}/>;
      }
      return commandIcon;
    }
    if (variant !== CommandButtonType.Toolbar && !command?.state())
      return BLANK_ICON;
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
CommandButton.displayName = "CommandButton";