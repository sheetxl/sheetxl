import React, {
  useMemo, memo, forwardRef
} from 'react';

import {
  ICommands, useCommands, Command, CommandButtonType, useCallbackRef
} from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel,
  ExhibitPopupPanelProps, ExhibitDivider, themeIcon
} from '@sheetxl/utils-mui';

import {
  TextHorizontalOverflowIcon, TextHorizontalWrapIcon, TextHorizontalClipIcon
} from '@sheetxl/utils-mui';
import { TextHorizontalShrinkIcon } from '@sheetxl/utils-mui';


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

  const activeCommandKey = useMemo(() => {
    for (let i=0; i<resolvedCommands.length; i++) {
      if ((resolvedCommands[i] as Command<boolean>)?.state()) {
        return resolvedCommands[i].key();
      }
    }
    // default
    return resolvedCommands[0]?.key();
  }, [resolvedCommands]);

  // TODO - Move to CommandButtonRegistry
  const commandIcons:Map<string, React.ReactElement> = useMemo(() => {
    const mapIcons = new Map();
    mapIcons.set('formatTextOverflowVisibleToggle', themeIcon(<TextHorizontalOverflowIcon/>));
    mapIcons.set('formatTextOverflowWrapToggle', themeIcon(<TextHorizontalWrapIcon/>));
    mapIcons.set('formatTextOverflowClipToggle', themeIcon(<TextHorizontalClipIcon/>));
    mapIcons.set('formatTextOverflowShrinkToggle', themeIcon(<TextHorizontalShrinkIcon/>));
    // mapIcons.set('formatTextOverflowEllipsisToggle', themeIcon(<TextEllipsisIcon/>));

    return mapIcons;
  }, []);

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
          icon={commandIcons.get('formatTextOverflowVisibleToggle')}
        />
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatTextOverflowWrapToggle') as Command<boolean>)}
          icon={commandIcons.get('formatTextOverflowWrapToggle')}
        />
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatTextOverflowClipToggle') as Command<boolean>)}
          icon={commandIcons.get('formatTextOverflowClipToggle')}
        />
        <ExhibitDivider orientation="horizontal"/>
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatTextOverflowShrinkToggle') as Command<boolean>)}
          icon={commandIcons.get('formatTextOverflowShrinkToggle')}
        />
        {/*  Not yet implemented
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatTextOverflowEllipsisToggle') as Command<boolean>)}
          icon={commandIcons.get('formatTextOverflowEllipsisToggle')}
          icon={<BlankIcon/>}
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
      icon={commandIcons.get(activeCommandKey) ?? themeIcon(<TextHorizontalOverflowIcon/>)}
      {...rest}
    />
  )

}));

export default TextOverflowCommandButton;