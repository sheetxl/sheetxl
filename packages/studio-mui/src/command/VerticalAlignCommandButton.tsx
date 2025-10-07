import React, {
  useMemo, memo, forwardRef, useCallback
} from 'react';

import {
  ICommands, useCommands, Command, CommandButtonType
} from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel,
  ExhibitPopupPanelProps, ExhibitDivider,
} from '@sheetxl/utils-mui';

export const VerticalAlignCommandButton = memo(
  forwardRef<HTMLElement, CommandPopupButtonProps>((props, refForwarded) => {
  const {
    commands: propCommands,
    commandHook : propCommandHook,
    scope,
    // icon,
    disabled: propDisabled = false,
    ...rest
  } = props;

  const commandKeys:string[] = [
    'formatAlignTopToggle',
    'formatAlignMiddleToggle',
    'formatAlignBottomToggle',
    'formatAlignJustifyVerticalToggle',
    'formatAlignDistributedVerticalToggle'
  ];
  const resolvedCommands = useCommands(propCommands, commandKeys);

  const { activeCommand, allDisabled } = useMemo(() => {
    const resolvedCommandsLength = resolvedCommands.length;
    let count = 0;
    let activeCommand:Command<any>;
    for (let i=0; i<resolvedCommandsLength; i++) {
      const command = (resolvedCommands[i] as Command<boolean>);
      if (command && !command.disabled()) {
        if (!activeCommand && command?.state()) {
          activeCommand = command;
        }
        count++;
      }
    }
    // default
    activeCommand = activeCommand ?? resolvedCommands[0] as Command<any>;
    return { activeCommand, allDisabled: count === 0 };
  }, [resolvedCommands]);

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      // parentFloat: props.floatReference,
      commandHook: propCommandHook,
      scope,
      disabled: propDisabled
    }
    const children = (
      <>
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatAlignTopToggle') as Command<boolean>)}
        />
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatAlignMiddleToggle') as Command<boolean>)}
        />
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatAlignBottomToggle') as Command<boolean>)}
        />
        <ExhibitDivider orientation="horizontal"/>
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatAlignJustifyVerticalToggle') as Command<boolean>)}
        />
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatAlignDistributedVerticalToggle') as Command<boolean>)}
        />
      </>
    );
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={propCommands}
      commandHook={propCommandHook}
      createPopupPanel={createPopupPanel}
      disabled={propDisabled || allDisabled}
      label="Vertical Alignment"
      tooltip="Configure how text is placed in the vertical direction of the cell."
      icon={activeCommand?.icon() ?? 'TextVerticalBottom'}
      {...rest}
    />
  )
}));