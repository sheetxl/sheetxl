import React, {
  useMemo, memo, forwardRef
} from 'react';

import {
  ICommands, useCommands, Command, CommandButtonType, useCallbackRef
} from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel, ExhibitPopupPanelProps, ExhibitDivider
} from '@sheetxl/utils-mui';

export const TextOverflowCommandButton = memo(
  forwardRef<HTMLElement, CommandPopupButtonProps>((props, refForwarded) => {
  const {
    commands: propCommands,
    commandHook: propCommandHook,
    scope,
    disabled: propDisabled = false,
    ...rest
  } = props;

  const commandKeys:string[] = [
    'formatTextOverflowVisibleToggle',
    'formatTextOverflowWrapToggle',
    'formatTextOverflowClipToggle',
    'formatTextOverflowShrinkToggle',
    // 'formatTextOverflowEllipsisToggle'
  ];
  const resolvedCommands = useCommands(propCommands, commandKeys);

  const activeCommand = useMemo(() => {
    for (let i=0; i<resolvedCommands.length; i++) {
      if ((resolvedCommands[i] as Command<boolean>)?.state()) {
        return resolvedCommands[i];
      }
    }
    // default
    return resolvedCommands[0];
  }, [resolvedCommands]);


  const createPopupPanel = useCallbackRef((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
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
          command={(commands.getCommand('formatTextOverflowVisibleToggle') as Command<boolean>)}
        />
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatTextOverflowWrapToggle') as Command<boolean>)}
        />
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatTextOverflowClipToggle') as Command<boolean>)}
        />
        <ExhibitDivider orientation="horizontal"/>
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatTextOverflowShrinkToggle') as Command<boolean>)}
        />
        {/*  Not yet implemented
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatTextOverflowEllipsisToggle') as Command<boolean>)}
        />
        */}
      </>);
      return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, scope]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={propCommands}
      commandHook={propCommandHook}
      scope={scope}
      label="Text Overflow"
      tooltip="Configure how text behaves when it doesn't fit within a cell."
      createPopupPanel={createPopupPanel}
      // disabled={propDisabled || !activeCommand || activeCommand.disabled()}
      // selected={!activeCommand || (activeCommand as Command<boolean>).state()}
      icon={activeCommand?.icon() ?? 'TextHorizontalOverflow'}
      {...rest}
    />
  )

}));

export default TextOverflowCommandButton;