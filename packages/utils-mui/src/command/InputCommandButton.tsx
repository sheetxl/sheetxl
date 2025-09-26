import React, { useState, useRef, useMemo, memo, useEffect, forwardRef } from 'react';

import { Theme } from '@mui/material/styles';

import { IconButton } from '@mui/material'
import { Input } from '@mui/material';

import {
  useCallbackRef, useCommand, ICommand, CommandButtonType, ICommandHook, KeyCodes,
  type CommandButtonProps, DynamicIcon
} from '@sheetxl/utils-react';

import { ExhibitMenuItem, ExhibitIconButton } from '../button';

import { CommandTooltip } from './CommandTooltip';

const BLANK_ICON = <DynamicIcon/>;

export interface InputCommandButtonProps<STATE=any, CONTEXT=any> extends CommandButtonProps<STATE, CONTEXT> {
  // TODO - move to command buttons
  label?: React.ReactNode | string | (() => React.ReactNode | string);
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
    command,
    scope,
    icon: propIcon = BLANK_ICON,
    label: propLabel,
    variant = CommandButtonType.Toolbar,
    disabled: propDisabled = false,
    commandHook: propCommandHook,
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

  const committedInputValue = () => {
    return command?.state()?.toString() || '0';
  }

  const [inputValue, setInputValue] = useState<string>(committedInputValue);

  const commitNewValue = useCallbackRef(() => {
    const asNumber = parseFloat(inputValue);
    if (isNaN(asNumber)) { // revert back to original value (blank is an example)
      setInputValue(committedInputValue());
      return;
    }
    // If the same don't commit
    if (parseFloat(committedInputValue()) === asNumber)
      return;

    command.execute(asNumber, propCommandHook);
  }, [committedInputValue, command, inputValue, propCommandHook]);

  useEffect(() => {
    setInputValue(committedInputValue());
  }, [command?.state()]);

  const icon = useMemo(() => {
    let retValue = typeof propIcon === "function" ? propIcon(command) : propIcon ;
    if (retValue) {
      retValue = command?.icon();
    }
    if (typeof retValue === 'string') {
      retValue = <DynamicIcon iconKey={retValue} />;
    }
    return retValue;
  }, [_, propIcon, command?.icon]);

  const label = useMemo(() => {
    if (propLabel === undefined)
      return command?.label(scope);
    return typeof propLabel === "function" ? propLabel() : propLabel ;
  }, [_]);

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
          inputMode={'numeric'}
          disabled={propDisabled || !command || command.disabled()}
          inputProps={{
            tabIndex:0,
            name: `input-${command.key()}`,
            autoComplete: "off",
            type:"number",
            maxLength: 4, // Not honored for inputType number so we manage in onchange and keypress
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
  }, [inputValue, propDisabled, command]);

  const buttonProps = {
    tabIndex: 0,
    ref: refForwarded,
    icon,
    touchRippleRef: refRipple,
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
      command?.execute(!command?.state?.(), commandHook);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      // button prevents space so we don't check it
      // if (e.isDefaultPrevented()) return;
      if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Space) {
        command?.execute(!command?.state?.(), commandHook);
      }
    }
  }

  let retValue: React.ReactNode;
  if (variant === CommandButtonType.Menuitem) {
    retValue = (
      <ExhibitMenuItem
        {...rest as any}
        chips={command?.tags()}
        {...buttonProps}
      >
        {label}
        {input}
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
  if (!command?.label())
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
    >
    {retValue}
    </CommandTooltip>
  )
  return retValue;
}));