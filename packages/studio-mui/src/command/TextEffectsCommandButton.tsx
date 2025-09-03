import React, {
  useMemo, memo, forwardRef, useCallback
} from 'react';

import {
  ICommands, useCommands, Command, CommandButtonType
} from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel, ExhibitPopupPanelProps, themeIcon
} from '@sheetxl/utils-mui';

import {
  TextStrikeIcon, TextSuperscriptIcon, TextSubscriptIcon
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

  const activeCommandKey = useMemo(() => {
    for (let i=0; i<resolvedCommands.length; i++) {
      if ((resolvedCommands[i] as Command<boolean>)?.state()) {
        return resolvedCommands[i].key();
      }
    }
    // default
    return resolvedCommands[0]?.key();
  }, [resolvedCommands])

  // TODO - Move to CommandButtonRegistry
  const commandIcons:Map<string, React.ReactElement> = useMemo(() => {
    const mapIcons = new Map();
    mapIcons.set('formatStrikeThroughToggle', themeIcon(<TextStrikeIcon/>));
    mapIcons.set('formatSuperscriptToggle', themeIcon(<TextSuperscriptIcon/>));
    mapIcons.set('formatSubscriptToggle', themeIcon(<TextSubscriptIcon/>));
    return mapIcons;
  }, []);

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
        icon={commandIcons.get('formatStrikeThroughToggle')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatSuperscriptToggle') as Command<boolean>}
        icon={commandIcons.get('formatSuperscriptToggle')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatSubscriptToggle') as Command<boolean>}
        icon={commandIcons.get('formatSubscriptToggle')}
      />
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, scope]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      quickCommand={activeCommandKey}
      commands={propCommands}
      commandHook={propCommandHook}
      createPopupPanel={createPopupPanel}
      label="Text Effects"
      tooltip="Style your text to differentiate it."
      icon={commandIcons.get(activeCommandKey) ?? themeIcon(<TextStrikeIcon/>)}
      {...rest}
    />
  )

}));

export default TextEffectsCommandButton;