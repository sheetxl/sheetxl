import React, { forwardRef, memo, useRef, useMemo } from 'react';

import { type TooltipProps } from '@mui/material';

import {
  ICommand, ICommands, CommandButtonType, ICommandHook, useCommands, useCallbackRef
} from '@sheetxl/utils-react';

import {
  ExhibitPopupIconButton, ExhibitPopupMenuItem, ExhibitPopupIconButtonProps, ExhibitTooltip
} from '../button';
import { type ExhibitPopupPanelProps } from '../float';

import { CommandTooltip } from './CommandTooltip';

export type CommandPopupButtonRefAttribute = {
  ref?: React.Ref<HTMLDivElement>;
};

/**
 * Attach a command to a popup.
 * Note
 */
export interface CommandPopupButtonProps<STATE=any, CONTEXT=any> extends Omit<ExhibitPopupIconButtonProps, "color" | "icon" | "label" | "createPopupPanel" > {

  quickCommand?: string;

  commands: ICommands.IGroup;

  icon?: React.ReactNode | ((command: ICommand) => React.ReactNode);

  label?: React.ReactNode | ((command: ICommand) => React.ReactNode);

  /**
   * Allow for listeners against a specific buttons execute rather than the command.
   * Useful when knowing the specific button that executed a command is required.
   * (For example when closing menus or restoring focus)
   */
  commandHook?: ICommandHook<any, any>;

  disableHover?: boolean;

  createPopupPanel?: (props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => React.ReactNode;

  /**
   * Styling
   * @defaultValue CommandButtonType.Toolbar
   */
  variant?: CommandButtonType;

  /**
   * Optional state for this specific command button.
   * @defaultValue to undefined
   */
  commandState?: STATE;

  context?: CONTEXT;

  scope?: string
}

const CommandPopupButton: React.FC<CommandPopupButtonProps & { ref?: any }> = memo(
    forwardRef<any, CommandPopupButtonProps>((props, refForwarded) => {
  const {
    variant = CommandButtonType.Toolbar,
    quickCommand: quickCommandKey,
    onQuickClick: propOnQuickClick,
    commands,
    commandState,
    commandHook: propCommandHook,
    disabled: propDisabled,
    label: propLabel,
    icon: propIcon,
    createPopupPanel: propCreatePopupPanel,
    tooltip: propTooltip,
    selected: propSelected,
    scope: propScope,
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

  // To listener for command update and changes to the quickCommandKey
  const resolvedCommands = useCommands(commands, [quickCommandKey], null, [quickCommandKey]);
  const quickCommand = resolvedCommands[0];

  const { label, icon } = useMemo(() => {
    let label = null;
    if (propLabel) {
      if (typeof propLabel === 'function') {
        label = propLabel(quickCommand);
      } else {
        label = propLabel;
      }
    }
    if (!label) {
      label = quickCommand?.label?.(propScope);
    }

    let icon = null;
    if (propIcon) {
      if (typeof propIcon === 'function') {
        icon = propIcon(quickCommand);
      } else {
        icon = propIcon;
      }
    }
    if (!icon) {
      icon = quickCommand?.icon?.();
    }

    return { label, icon }
  }, [resolvedCommands, propLabel, propIcon]);

  const propsCommand:any = {
    disabled: propDisabled,
    scope: propScope,
    touchRippleRef: refRipple,
    onQuickClick: propOnQuickClick,
    // commandHook,
    tooltip: propTooltip,
    label,
    icon
  }

  if (label || propTooltip) {
    propsCommand.createTooltip = ({children}: TooltipProps, disabled: boolean) => {
      return (
        <ExhibitTooltip
          label={label}
          description={propTooltip}
          disabled={disabled}
        >
          {children}
        </ExhibitTooltip>
      );
    }
  }

  const createPopupPanel = useCallbackRef((props: ExhibitPopupPanelProps) => {
    // we invalidate against resolvedCommands but pass commands
    return propCreatePopupPanel?.(props, commands);
  }, [propCreatePopupPanel, resolvedCommands]);

  const onQuickClick = useCallbackRef((_e: React.MouseEvent<any>) => {
    return quickCommand?.execute(commandState, commandHook);
  }, [quickCommand]);

  // if we have a quick command then override the tooltip
  if (quickCommand) {
    propsCommand.quickButtonProps = {};
    propsCommand.quickButtonProps.createTooltip = ({children, placement}: TooltipProps, disabled: boolean) => {
      return (
        <CommandTooltip
          command={quickCommand}
          placement={placement ?? variant === CommandButtonType.Toolbar? "bottom-start" : "right-start"}
          disabled={disabled}
        >
          {children}
        </CommandTooltip>
      );
    }

    propsCommand.disabled = propsCommand.disabled ?? quickCommand?.disabled();
    if (!propOnQuickClick) {
      propsCommand.onQuickClick = onQuickClick;
    }
  } else if (quickCommandKey) {
    propsCommand.onQuickClick = () => {} // ensure popup icon
  }
  propsCommand.selected = propSelected ?? quickCommand?.state();

  propsCommand.createPopupPanel = createPopupPanel;
  return (variant === CommandButtonType.Toolbar ?
    <ExhibitPopupIconButton {...rest} {...propsCommand } ref={refForwarded}/> :
    <ExhibitPopupMenuItem {...rest} {...propsCommand} ref={refForwarded}/>
  );
}));

CommandPopupButton.displayName = "CommandPopupButton";
export { CommandPopupButton };