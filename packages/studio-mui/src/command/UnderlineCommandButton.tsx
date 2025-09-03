import React, {
  useMemo, memo, forwardRef, useCallback
} from 'react';

import { ICommands, useCommands, Command, CommandButtonType } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps, defaultCreatePopupPanel,
  ExhibitPopupPanelProps, themeIcon
} from '@sheetxl/utils-mui';

import {
  TextUnderlineIcon, TextUnderlineDoubleIcon, TextUnderlineAccountingIcon, TextUnderlineAccountingDoubleIcon
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
    mapIcons.set('formatUnderlinedToggle', themeIcon(<TextUnderlineIcon/>));
    mapIcons.set('formatUnderlinedDoubleToggle', themeIcon(<TextUnderlineDoubleIcon/>));
    mapIcons.set('formatUnderlinedAccountingToggle', themeIcon(<TextUnderlineAccountingIcon/>));
    mapIcons.set('formatUnderlinedAccountingDoubleToggle', themeIcon(<TextUnderlineAccountingDoubleIcon/>));

    return mapIcons;
  }, []);

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
        icon={themeIcon(<TextUnderlineIcon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatUnderlinedDoubleToggle') as Command<boolean>}
        icon={themeIcon(<TextUnderlineDoubleIcon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatUnderlinedAccountingToggle') as Command<boolean>}
        commandHook={propCommandHook}
        icon={themeIcon(<TextUnderlineAccountingIcon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatUnderlinedAccountingDoubleToggle') as Command<boolean>}
        icon={themeIcon(<TextUnderlineAccountingDoubleIcon/>)}
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
      label="Underline"
      tooltip="All underline stylings."
      createPopupPanel={createPopupPanel}
      icon={commandIcons.get(activeCommandKey) ?? themeIcon(<TextUnderlineIcon/>)}
      {...rest}
    />
  )

}));

export default UnderlineCommandButton;