import React, {
  useMemo, memo, forwardRef, useCallback
} from 'react';

import {
  ICommands, useCommands, Command, CommandButtonType
} from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel, ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

/**
 * Menu for text effects options
 */
export const TextEffectsCommandButton = memo(
  forwardRef<HTMLElement, CommandPopupButtonProps>((props, refForwarded) => {
  const {
    commands: propCommands,
    commandHook: propCommandHook,
    scope,
    disabled: propDisabled = false,
    ...rest
  } = props;

  const commandKeys:string[] = [
    'formatStrikeThroughToggle',
    'formatSuperscriptToggle',
    'formatSubscriptToggle'
  ];
  const resolvedCommands = useCommands(propCommands, commandKeys);

  const activeCommand = useMemo(() => {
    const resolvedCommandsLength = resolvedCommands.length;
    for (let i=0; i<resolvedCommandsLength; i++) {
      const command = resolvedCommands[i];
      if ((command as Command<boolean>)?.state()) {
        return command;
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
      scope: 'textEffects',
      disabled: propDisabled
    }
    const children = (<>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatStrikeThroughToggle') as Command<boolean>}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatSuperscriptToggle') as Command<boolean>}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatSubscriptToggle') as Command<boolean>}
      />
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, scope]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      quickCommand={activeCommand?.key()}
      commands={propCommands}
      commandHook={propCommandHook}
      createPopupPanel={createPopupPanel}
      label="Text Effects"
      tooltip="Style your text to differentiate it."
      icon={activeCommand?.icon() ?? 'TextStrike'}
      {...rest}
    />
  )
}));