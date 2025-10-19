import React, {
  useMemo, memo, forwardRef, useCallback
} from 'react';

import { ICommands, useCommands, Command, CommandButtonType } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps, defaultCreatePopupPanel,
  ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

/**
 * Menu for underline options
 */
export const UnderlineCommandButton = memo(
  forwardRef<HTMLElement, CommandPopupButtonProps>((props, refForwarded) => {
  const {
    commands: propCommands,
    commandHook: propCommandHook,
    scope,
    disabled: propDisabled = false,
    ...rest
  } = props;

  const commandKeys:string[] = [
    'formatUnderlinedToggle',
    'formatUnderlinedDoubleToggle',
    'formatUnderlinedAccountingToggle',
    'formatUnderlinedAccountingDoubleToggle'
  ];
  const resolvedCommands = useCommands(propCommands, commandKeys);

  const activeCommand = useMemo(() => {
    const resolvedCommandsLength = resolvedCommands.length;
    for (let i=0; i<resolvedCommandsLength; i++) {
      if ((resolvedCommands[i] as Command<boolean>)?.getState()) {
        return resolvedCommands[i];
      }
    }
    // default
    return resolvedCommands[0];
  }, [resolvedCommands])

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      // parentFloat: props.floatReference,
      commandHook: propCommandHook,
      scope: 'underline',
      disabled: propDisabled
    }
    const children = (<>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatUnderlinedToggle') as Command<boolean>}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatUnderlinedDoubleToggle') as Command<boolean>}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatUnderlinedAccountingToggle') as Command<boolean>}
        commandHook={propCommandHook}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatUnderlinedAccountingDoubleToggle') as Command<boolean>}
      />
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, scope]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      quickCommand={activeCommand?.getKey()}
      commands={propCommands}
      commandHook={propCommandHook}
      label="Underline"
      tooltip="All underline stylings."
      createPopupPanel={createPopupPanel}
      icon={activeCommand?.getIcon() ?? 'TextUnderline'}
      {...rest}
    />
  )
}));