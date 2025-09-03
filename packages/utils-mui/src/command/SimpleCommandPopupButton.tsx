import React, { memo, forwardRef, useCallback } from 'react';

import { CommandButtonType, ICommands, ICommand, useCommands } from '@sheetxl/utils-react';

import { defaultCreatePopupPanel, type ExhibitPopupPanelProps } from '../float';
import { ExhibitDivider } from '../components';

import { CommandButton, type CommandButtonProps } from './CommandButton';
import { CommandPopupButton, type CommandPopupButtonProps } from './CommandPopupButton';

export interface SimpleCommandPopupButtonProps extends CommandPopupButtonProps {
  /**
   * A list of command keys to show in the popup
   */
  popupCommandKeys: string[];
  /**
   * Scope for the popup
   *
   * @defaultValue The 'quickCommandKey'.
   */
  // TODO - remove this and use parent command key as the scope
  popupScope?: string;

  renderCommandButton?: (props: CommandButtonProps & React.Attributes) => React.ReactNode;
}

const defaultRenderCommandButton = (props: CommandButtonProps & React.Attributes): React.ReactNode => {
  const { key, ...rest } = props;
  return (
    <CommandButton
      key={key}
      {...rest}
    />
  )
}

/**
 * Simple Popup that takes a list of commands for a popup
 */
// TODO - allow this to nest
export const SimpleCommandPopupButton = memo(
  forwardRef<HTMLElement, SimpleCommandPopupButtonProps>((props: SimpleCommandPopupButtonProps, refForwarded) => {
  const {
    popupCommandKeys,
    renderCommandButton = defaultRenderCommandButton,
    scope,
    commands,
    icon,
    quickCommand: quickCommandKey,
    popupScope = quickCommandKey,
    commandState: propCommandState,
    commandHook: propCommandHook,
    disabled: propDisabled = false,
    ...rest
  } = props;

  const resolved = useCommands(commands, popupCommandKeys ? [quickCommandKey, ...popupCommandKeys] : [quickCommandKey]);

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      // parentFloat: props.floatReference,
      commandHook: propCommandHook,
      commandState: propCommandState,
      icon,
      scope: popupScope,
      disabled: propDisabled
    }
    const children = [];
    for (let i=0;i<popupCommandKeys?.length; i++) {
      const commandKey = popupCommandKeys[i];
      if (commandKey === null || commandKey === "-") {
        children.push(
          <ExhibitDivider
            key={`element-${children.length}`}
            orientation="horizontal"
          />
        )
        continue;
      }
      const command:ICommand = commands.getCommand(commandKey);
      const props:CommandButtonProps & React.Attributes = {
        key: `${commandKey}-${children.length}`,
        command: command as any,
        ...commandButtonProps
      }
      const button = renderCommandButton(props);
      if (!button)
        continue;
      children.push(button);
    }
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, propCommandState, popupScope, popupCommandKeys, icon, renderCommandButton]);

  if (!popupCommandKeys) {
    return renderCommandButton({
      ref: refForwarded,
      disabled: propDisabled,
      commandHook: propCommandHook,
      commandState: propCommandState,
      scope,
      command: resolved[0],
      icon,
      ...rest
    });
  }
  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={commands}
      disabled={propDisabled}
      commandHook={propCommandHook}
      commandState={propCommandState}
      scope={scope}
      quickCommand={quickCommandKey}
      icon={icon}
      createPopupPanel={createPopupPanel}
      {...rest}
    />
  )

}));

export default SimpleCommandPopupButton;