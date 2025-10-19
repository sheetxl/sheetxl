import React, {
  memo, forwardRef, useMemo, useCallback
} from 'react';

import {
  ICommands, useCommands, Command, CommandButtonType
} from '@sheetxl/utils-react';

import {
  CommandPopupButton, CommandButton, InputCommandButton, ExhibitDivider,
  CommandPopupButtonProps, ExhibitPopupPanelProps, defaultCreatePopupPanel
} from '@sheetxl/utils-mui';

export const TextRotateCommandButton = memo(
  forwardRef<HTMLElement, CommandPopupButtonProps>((props, refForwarded) => {
  const {
    commands: propCommands,
    commandHook: propCommandHook,
    scope,
    disabled: propDisabled = false,
    ...rest
  } = props;

  const commandKeys:string[] = [
    'formatTextRotate0',
    'formatTextRotate315',
    'formatTextRotate45',
    'formatTextRotate90',
    'formatTextRotate270',
    'formatSubscriptToggle',
    'formatTextRotateCustom'
  ];
  const resolvedCommands = useCommands(propCommands, commandKeys);

  const activeCommand = useMemo(() => {
    const resolvedCommandsLength = resolvedCommands.length
    for (let i=0; i<resolvedCommandsLength; i++) {
      const command = resolvedCommands[i] as Command<boolean>;
      if (command?.getState()) {
        return command;
      }
    }
    // the second command
    return resolvedCommands[1];
  }, [resolvedCommands])

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      // parentFloat: props.floatReference,
      commandHook: propCommandHook,
      scope,
      disabled: propDisabled
    }
    const children = (<>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatTextRotate0') as Command<boolean>}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatTextRotate315') as Command<boolean>}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatTextRotate45') as Command<boolean>}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatTextRotate90') as Command<boolean>}
      />
      {/* TODO - implement
       <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatTextRotateVertical')}
      /> */}
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatTextRotate270') as Command<boolean>}
      />
      <ExhibitDivider orientation="horizontal"/>
      <InputCommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatTextRotateCustom')}
        label={'Custom'}
      />
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, scope, propCommands]);

  const isSelected = useMemo(() => {
    return (propCommands.getCommand('formatTextRotateCustom')?.getState() ?? 0) !== 0
  }, [resolvedCommands]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={propCommands}
      // disabled={propDisabled || !activeCommand || activeCommand.disabled()}
      commandHook={propCommandHook}
      scope={scope}
      selected={isSelected}
      label="Text Orientation"
      tooltip="Rotate your text diagonally or vertically. This is a great way to label narrow columns."
      createPopupPanel={createPopupPanel}
      quickCommand={isSelected ? 'formatTextRotate0' : 'formatTextRotate315' }
        icon={activeCommand?.getIcon() ?? 'TextRotation315'}
        {...rest}
    />
  )
}));