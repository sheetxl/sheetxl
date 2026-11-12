import type React from 'react';
import { forwardRef, memo, useMemo } from 'react';


import {
  CommandButtonType, useCommands, useCallbackRef, DynamicIcon, type Command, type UseCommandsListener,
  type RenderSlotFn
} from '@sheetxl/utils-react';

import {
  ExhibitPopupIconButton, ExhibitPopupMenuItem, ExhibitTooltip, type ExhibitPopupIconButtonProps
} from '../button';
import { type ExhibitPopupPanelProps, type ButtonTooltipRenderProps } from '../float';

import { CommandTooltip } from './CommandTooltip';
import { useManagedRipple } from './useManagedRipple';

export type CommandPopupButtonRefAttribute = {
  ref?: React.Ref<HTMLDivElement>;
};

/**
 * Attach a command to a popup.
 * Note
 */
export interface CommandPopupButtonProps<STATE=any, CONTEXT=any> extends Omit<ExhibitPopupIconButtonProps, "color" | "icon" | "label" | "renderPopupPanel" > {

  quickCommand?: string;

  icon?: React.ReactNode | ((command: Command.ResolvedCommand) => React.ReactNode) | string;

  label?: React.ReactNode | ((command: Command.ResolvedCommand) => React.ReactNode);

  disableHover?: boolean;

  renderPopupPanel?: RenderSlotFn<ExhibitPopupPanelProps>;

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

  /** The panel/group this renders in — selects `groupLabels` variants (see `CommandButtonOptions.groupKey`). */
  groupKey?: string;
}

export const CommandPopupButton: React.FC<CommandPopupButtonProps & { ref?: any }> = memo(
    forwardRef<HTMLDivElement, CommandPopupButtonProps>((props, refForwarded) => {
  const {
    variant = CommandButtonType.Toolbar,
    quickCommand: quickCommandKey,
    onQuickClick: propOnQuickClick,
    commandState,
    disabled: propDisabled,
    label: propLabel,
    icon: propIcon,
    renderPopupPanel: propRenderPopupPanel,
    tooltip: propTooltip,
    selected: propSelected,
    groupKey: propGroupKey,
    ...rest
  } = props;

  const { ripple, trigger: triggerRipple } = useManagedRipple();

  const commandListener: UseCommandsListener<any, any> = useMemo(() => ({
    // Fires for EVERY dispatch of the quick command (see `useCommands`); our always-mounted ripple
    // flashes the button so remote executes (keystroke/sibling/programmatic) give feedback too.
    onExecute(): void {
      triggerRipple();
    }
  }), [triggerRipple]);

  const [quickCommand] = useCommands(quickCommandKey ?? [], commandListener);

  const { label, icon } = useMemo(() => {
    let label = null;
    if (propLabel) {
      if (typeof propLabel === 'function') {
        label = quickCommand ? propLabel(quickCommand) : null;
      } else {
        label = propLabel;
      }
    }
    if (!label) {
      label = quickCommand?.getLabel?.(propGroupKey);
    }

    let icon = propIcon;
    if (!icon) {
      icon = quickCommand?.getIcon?.(propGroupKey);
    }

    if (typeof icon === 'string') {
      icon = <DynamicIcon iconKey={icon}/>;
    } else if (typeof icon === 'function') {
      icon = quickCommand ? icon(quickCommand) : undefined;
    }

    // fallback to icon that matches quick command key. This is a bit of a hack
    // this give warnings
    // if (!icon && quickCommandKey) {
    //   icon = <DynamicIcon iconKey={quickCommandKey}/>;
    // }

    // Leave `icon`/`label` as resolved — the popup button composes the visible content: a real icon
    // wins; otherwise the label renders as text, with the toggle checkmark prefixed for split (quick
    // command) buttons, and an empty non-split button falls back to a blank spacer downstream.
    return { label, icon }
  }, [quickCommand, propLabel, propIcon]);

  const resolved = quickCommand || !quickCommandKey // if quick commandKey but no resolve then it's invalid
  const propsCommand:any = {
    disabled: propDisabled || !resolved,
    // NB: `groupKey` is NOT forwarded here — it's a command-layer concept consumed above (label/icon
    // already resolved via getLabel(propGroupKey)). Spreading it reaches a DOM node → React warns.
    ripple,
    onQuickClick: propOnQuickClick,
    tooltip: propTooltip,
    label,
    icon
  }

  if (label || propTooltip) {
    propsCommand.renderTooltip = ({ children, disabled }: ButtonTooltipRenderProps) => {
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

  const renderPopupPanel = useCallbackRef((props: ExhibitPopupPanelProps) => {
    return propRenderPopupPanel?.(props);
  }, [propRenderPopupPanel]);

  const onQuickClick = useCallbackRef((_e: React.MouseEvent<any>) => {
    return quickCommand?.execute(commandState);
  }, [quickCommand]);

  // if we have a quick command then override the tooltip
  if (quickCommand) {
    propsCommand.propsQuickButton = {};
    propsCommand.propsQuickButton.renderTooltip = ({ children, placement, disabled }: ButtonTooltipRenderProps) => {
      return (
        <CommandTooltip
          commandKey={quickCommandKey}
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
  propsCommand.selected = propSelected ?? quickCommand?.getState();

  propsCommand.renderPopupPanel = renderPopupPanel;
  return (variant === CommandButtonType.Toolbar ?
    <ExhibitPopupIconButton {...rest} {...propsCommand } ref={refForwarded}/> :
    <ExhibitPopupMenuItem {...rest} {...propsCommand} ref={refForwarded}/>
  );
}));

CommandPopupButton.displayName = "CommandPopupButton";