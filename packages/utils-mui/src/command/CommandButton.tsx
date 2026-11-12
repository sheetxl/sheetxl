import type React from 'react';
import { useMemo, memo, forwardRef, useCallback } from 'react';

import {
  useCommands, CommandButtonType, KeyCodes,
  type CommandButtonRefAttribute, DynamicIcon, type CommandButtonProps, type UseCommandsListener
} from '@sheetxl/utils-react';

import { ExhibitIconButton, ExhibitMenuItem, SelectedIcon, composeButtonContent } from '../button';

import { CommandTooltip } from './CommandTooltip';
import { useManagedRipple } from './useManagedRipple';

const BLANK_ICON = <DynamicIcon/>;

export const CommandButton = memo(
  forwardRef<any, CommandButtonProps & CommandButtonRefAttribute>((props, refForwarded) => {
  const {
    commandKey: propCommandKey,
    command: propCommand,
    groupKey,
    icon: propIcon,
    label: propLabel,
    showLabel: propShowLabel = false,
    disabled: propDisabled,
    variant = CommandButtonType.Toolbar,
    shortcut,
    commandState,
    propsTooltip,
    ...rest
  } = props;

  const { ripple, trigger: triggerRipple } = useManagedRipple();

  const commandListener: UseCommandsListener<any, any> = useMemo(() => ({
    // Fires for EVERY dispatch of this command (click, keystroke, sibling, programmatic) — see
    // `useCommands`. Our own always-mounted ripple flashes the button so remote executes give feedback.
    onExecute(): void {
      triggerRipple();
    }
  }), [triggerRipple]);

  const [commandLookup] = useCommands(propCommandKey ?? [], commandListener);
  const command = propCommand ?? commandLookup;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; e.preventDefault();
  }, []);

  const onMouseUp = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!command) return;
    await command.execute(commandState);
 }, [command, commandState]);

 const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    // button prevents space so we don't check it
    // if (e.isDefaultPrevented()) return;
    if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Space) {
      command?.execute(commandState);
    }
  }, [command, commandState]);

  const disabled = propDisabled ?? (!command || command.disabled());
  const state = command?.getState();

  const icon: React.ReactNode = useMemo(() => {
    if (propIcon === null) return BLANK_ICON;
    let commandIcon: React.ReactNode;
    if (typeof propIcon === "function") {
      commandIcon = command ? propIcon(command) : undefined;
    } else {
      commandIcon = propIcon;
    }
    // If we are a menu and not selected we don't want the default checkmark icon
    if (!commandIcon) {
      commandIcon = command?.getIcon(groupKey);
    }
    if (commandIcon) {
      if (typeof commandIcon === "string") {
        commandIcon = <DynamicIcon iconKey={commandIcon}/>;
      }
      return commandIcon as React.ReactNode;
    }

    if (variant !== CommandButtonType.Toolbar && !state) {
      return BLANK_ICON;
    }
    // A checked menu item resolves to NO icon on purpose — `SelectedIcon` draws the checkmark for empty
    // children. `state` is therefore a dependency: a toggle flipped while its menu stays open (a quick
    // action) would otherwise keep the blank spacer it first rendered with.
  }, [command, groupKey, propIcon, state, variant]);

  const buttonProps = {
    //  useMemo(() => {
    // return {
      tabIndex: 0,
      ref: refForwarded,
      selected: !!state,
      // Toolbar buttons are icon-only unless `showLabel` — then render the icon + styled label
      // (shared with the popup button). Menu items always show their label as a child (below).
      icon: variant === CommandButtonType.Toolbar
        ? (propShowLabel ? composeButtonContent(icon, (propLabel as React.ReactNode) ?? command?.getLabel(groupKey)) : icon)
        : <SelectedIcon selected={state ?? false}>{icon}</SelectedIcon>,
      // MUI's own ripple is lazy-mounted (only after a pointer/focus on THIS button), so it can't
      // flash on a remote execute. We disable it and drive our always-mounted `ripple` via onExecute.
      disableRipple: true,
      disabled,
      onMouseDown,
      onMouseUp,
      onKeyDown
    }
  // }, [disabled, variant, propDisabled, icon, onMouseUp, onMouseDown, onKeyDown]);

  let retValue:React.ReactNode;
  if (variant === CommandButtonType.Menuitem) {
    retValue = (
      <ExhibitMenuItem
        {...rest}
        {...buttonProps}
      >
        {propLabel as any ?? command?.getLabel(groupKey)}
        {ripple}
      </ExhibitMenuItem>
    );
  } else {
    retValue = (
      <ExhibitIconButton
        {...rest}
        {...buttonProps}
      >
        {ripple}
      </ExhibitIconButton>
    );
  }

  // no tooltip then we are done
  if (!propLabel && !command?.getLabel()) // We don't contextualize the tooltip
    return retValue;

  // can't have a disabled component in a tooltip
  if (disabled) {
    retValue = (
      <div>
        {retValue}
      </div>
    )
  }

  retValue = (
    <CommandTooltip
      commandKey={propCommandKey}
      command={propCommand}
      disabled={disabled}
      placement={variant === CommandButtonType.Toolbar? "bottom-start" : "right-start"}
      shortcut={shortcut}
      {...propsTooltip}
    >
      {retValue}
    </CommandTooltip>
  )
  return retValue;
}));
CommandButton.displayName = "CommandButton";