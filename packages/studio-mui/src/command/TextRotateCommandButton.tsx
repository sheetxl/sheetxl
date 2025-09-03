import React, {
  memo, forwardRef, useMemo, useCallback
} from 'react';

import {
  ICommands, useCommands, Command, CommandButtonType
} from '@sheetxl/utils-react';

import {
  CommandPopupButton, CommandButton, InputCommandButton, ExhibitDivider,
  CommandPopupButtonProps, ExhibitPopupPanelProps, defaultCreatePopupPanel, themeIcon
} from '@sheetxl/utils-mui';

import {
  TextRotation0Icon, TextRotation45Icon, TextRotation90Icon, TextRotation2702Icon,
  TextRotation315Icon, TextRotationCustomIcon
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

  const activeCommandKey = useMemo(() => {
    const resolvedCommandsLength = resolvedCommands.length
    for (let i=0; i<resolvedCommandsLength; i++) {
      const command = resolvedCommands[i] as Command<boolean>;
      if (command?.state()) {
        return command.key();
      }
    }
    // the second command
    return resolvedCommands[1]?.key();
  }, [resolvedCommands])


  // TODO - Move to CommandButtonRegistry
  const commandIcons:Map<string, React.ReactElement> = useMemo(() => {
    const mapIcons = new Map();
    mapIcons.set('formatTextRotate0', themeIcon(<TextRotation315Icon/>));//<TextRotation0Icon/>);
    mapIcons.set('formatTextRotate315', themeIcon(<TextRotation315Icon/>));
    mapIcons.set('formatTextRotate45', themeIcon(<TextRotation45Icon/>));
    mapIcons.set('formatTextRotate90', themeIcon(<TextRotation90Icon/>));
    mapIcons.set('formatTextRotate270', themeIcon(<TextRotation2702Icon/>));
    mapIcons.set('formatTextRotateCustom', themeIcon(<TextRotationCustomIcon/>));

    return mapIcons;
  }, []);

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
        icon={themeIcon(<TextRotation0Icon/>)}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatTextRotate315') as Command<boolean>}
        icon={themeIcon(<TextRotation315Icon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatTextRotate45') as Command<boolean>}
        icon={themeIcon(<TextRotation45Icon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatTextRotate90') as Command<boolean>}
        icon={themeIcon(<TextRotation90Icon/>)}
      />
      {/* TODO - implement
       <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatTextRotateVertical')}
        icon={themeIcon(<TextRotationVerticalIcon/>)}
      /> */}
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatTextRotate270') as Command<boolean>}
        icon={themeIcon(<TextRotation2702Icon/>)}
      />
      <ExhibitDivider orientation="horizontal"/>
      <InputCommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatTextRotateCustom')}
        icon={themeIcon(<TextRotationCustomIcon/>)}
        label={'Custom'}
      />
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, scope, propCommands]);

  const isSelected = useMemo(() => {
    return (propCommands.getCommand('formatTextRotateCustom')?.state() ?? 0) !== 0
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
      icon={themeIcon(commandIcons.get(activeCommandKey) ?? <TextRotation315Icon/>)}
      {...rest}
    />
  )

}));

export default TextRotateCommandButton;