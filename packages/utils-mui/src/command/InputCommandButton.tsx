import type React from 'react';
import { useState, useRef, useMemo, memo, useEffect, forwardRef } from 'react';

import { type InputBaseComponentProps, type Theme } from '@mui/material';
import { IconButton } from '@mui/material'
import { Input } from '@mui/material';

import {
  useCommands, useCallbackRef, CommandButtonType, KeyCodes, DynamicIcon,
  type UseCommandsListener, type CommandButtonProps
} from '@sheetxl/utils-react';

import { ExhibitMenuItem, ExhibitIconButton } from '../button';

import { CommandTooltip } from './CommandTooltip';
import { useManagedRipple } from './useManagedRipple';

const BLANK_ICON = <DynamicIcon/>;

export interface InputCommandButtonProps<STATE=any, CONTEXT=any> extends CommandButtonProps<STATE, CONTEXT> {
  // TODO - move to command buttons
  label?: React.ReactNode | string | (() => React.ReactNode | string);

  inputProps?: InputBaseComponentProps;
    /**
     * Pass a ref to the `input` element.
     */
  inputRef?: React.Ref<any>;

  parseInput?: (value: string) => any;
}

/**
 * Binds an input control to a command.
 * @remarks
 *
 * Currently only supports numbers.
 */
// TODO - this is hard coded for numeric input at the moment
// TODO - allow custom inputProps
// TODO - allow for removal of icon including spacing
export const InputCommandButton: React.FC<InputCommandButtonProps> = memo(
  forwardRef<any, InputCommandButtonProps>((props, refForwarded) => {
  const {
    commandKey,
    groupKey,
    icon: propIcon,
    commandState,
    label: propLabel,
    variant = CommandButtonType.Toolbar,
    disabled: propDisabled,
    parseInput,
    inputProps,
    inputRef,
    ...rest
  } = props;

  const { ripple, trigger: triggerRipple } = useManagedRipple();

  const commandListener: UseCommandsListener<any, any> = useMemo(() => ({
    // Fires for EVERY dispatch of this command (see `useCommands`); our always-mounted ripple flashes
    // the button so remote executes (keystroke/sibling/programmatic) give feedback too.
    onExecute(): void {
      triggerRipple();
    }
  }), [triggerRipple]);

  const command = useCommands(commandKey ?? [], commandListener)[0];

  const committedInputValue = () => {
    return command?.getState()?.toString() || '';
  }

  const [inputValue, setInputValue] = useState<any>('');

  const refLastCommitted = useRef<string>(committedInputValue());
  const commitNewValue = useCallbackRef(() => {
    // we have a race condition with blur and enter key causing double commit
    let newInput = inputValue;
    if (parseInput) {
      try {
        newInput = parseInput(inputValue);
      } catch (e) {
        setInputValue(committedInputValue());
        return;
      }
    }
    if (refLastCommitted.current === inputValue) {
      setInputValue(committedInputValue()); // not needed?
      return;
    }
    refLastCommitted.current = inputValue;

    command?.execute(newInput);
  }, [committedInputValue, command, inputValue, parseInput]);

  useEffect(() => {
    setInputValue(committedInputValue());
  }, [command?.getState()]);

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
      commandIcon = command?.getIcon();
    }
    if (commandIcon) {
      if (typeof commandIcon === "string") {
        commandIcon = <DynamicIcon iconKey={commandIcon}/>;
      }
      return commandIcon as React.ReactNode;
    }

    if (variant !== CommandButtonType.Toolbar && !command?.getState()) {
      return BLANK_ICON;
    }
  }, [command?.getIcon(), propIcon]);

  const label = useMemo(() => {
    if (propLabel === undefined)
      return command?.getLabel(groupKey);
    return typeof propLabel === "function" ? propLabel() : propLabel ;
  }, [propLabel, command?.getLabel(groupKey)]);

  const disabled = propDisabled ?? (!command || command.disabled());
  const input = useMemo(() => {
    return (
      <IconButton {...rest}
        sx={{
          paddingTop: '0px',
          paddingBottom: '0px',
        }}
        component="div"
        disableRipple={true}
        onClick={(e) => e.stopPropagation() } // Prevent the quick buttons from closing the menu
        onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.stopPropagation() } }
        onMouseUp={(e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.stopPropagation() } }
      >
        <Input
          // inputMode={'numeric'}
          disabled={disabled}
          inputRef={inputRef}
          inputProps={{
            tabIndex:0,
            name: `input-${command?.getKey()}`,
            autoComplete: "off",
            ...inputProps
          }}
          sx={{
            paddingTop: '0px',
            paddingBottom: '0px',
            paddingLeft: '0px',
            paddingRight: '0px',
            fontSize: (theme: Theme) => {
              return `${Math.round(theme.typography.fontSize)}px`;
            },
            width: (_theme: Theme) => { return '3.2em' }, // rough estimate for width
            'input': {
              padding: '0 0',
              textAlign: 'center',
              'MozAppearance': 'textfield'
            },
            'input::-webkit-inner-spin-button': {
              'WebkitAppearance': 'none',
              margin: '0'
            },
            minHeight: '24px' // to align with icons. what if larger?
          }}

          value={inputValue}
          onFocus={(e:React.FocusEvent<HTMLInputElement>) => {
            // setTimeout(() => {
              e.target?.select();
            // }, 0);
          }}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if ((e.which === KeyCodes.Enter)) {
              if (committedInputValue() !== inputValue) {
                e.stopPropagation();
                e.preventDefault();
                commitNewValue();
              }
            } else if ((e.which === KeyCodes.Escape)) {
              if (committedInputValue() !== inputValue) {
                setInputValue(committedInputValue());
                setTimeout(() => {
                  (e.target as any)?.select();
                }, 0);
                e.stopPropagation();
                e.preventDefault();
              }
            } else if (e.key.match('[-]')) { // disallow negatives
              e.stopPropagation();
              e.preventDefault();
              return;
            } else if (e.key.match('[0-9.]') && (inputValue + e.key).length > 4) {
              e.stopPropagation();
              e.preventDefault();
              return;
            } else if ((e.which === KeyCodes.Space)) {
              // e.stopPropagation();
              e.preventDefault();
              return;
            }
          }}
          onBlur={() => {
            commitNewValue();
          }}
          onChange={(e) => {
            if (e.target.value.length > 4) {
              e.stopPropagation();
              e.preventDefault();
              return;
            }
            setInputValue(e.target.value);
          }}
        />
      </IconButton>
      );
  }, [inputValue, disabled, inputProps, inputRef]);

  const buttonProps = {
    tabIndex: 0,
    ref: refForwarded,
    icon,
    // MUI's own ripple is lazy-mounted (only after a pointer/focus on THIS button), so it can't flash
    // on a remote execute. We disable it and drive our always-mounted `ripple` via onExecute.
    disableRipple: true,
    disabled: propDisabled || !command || command.disabled(),
    onMouseDown: (e: React.MouseEvent<HTMLElement>) => {
      if (e.button !== 0)
        return; e.preventDefault()
    },
    onMouseUp: (e: React.MouseEvent<HTMLElement>) => {
      if (e.button !== 0 || e.isPropagationStopped() || e.isDefaultPrevented()) return;
      // Note - Input button is being called twice so we have this hack. Review toggle vs buttons vs menus.
      if (e.isDefaultPrevented()) return;
      e.preventDefault();
      commitNewValue();
      // command?.execute(commandState ?? !command?.getState());
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      // button prevents space so we don't check it
      // if (e.isDefaultPrevented()) return;
      if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Tab) {
        commitNewValue();
        // command?.execute(commandState ?? !command?.getState());
      }
    }
  }

  let retValue: React.ReactNode;
  if (variant === CommandButtonType.Menuitem) {
    retValue = (
      <ExhibitMenuItem
        {...rest as any}
        {...buttonProps}
      >
        {label}
        {input}
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
  if (!command?.getLabel())
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
      commandKey={commandKey}
      placement={variant === CommandButtonType.Toolbar? "bottom-start" : "right-start"}
    >
    {retValue}
    </CommandTooltip>
  )
  return retValue;
}));