import React, {
  useMemo, memo, forwardRef, useCallback
} from 'react';

import {
  ICommands, useCommands, Command, CommandButtonType
} from '@sheetxl/utils-react';

import { FormatAlignJustify as FormatAlignJustifyIcon } from '@mui/icons-material';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel,
  ExhibitPopupPanelProps, themeIcon, ExhibitDivider,
} from '@sheetxl/utils-mui';

import {
  TextVerticalTopIcon, TextVerticalCenterIcon, TextVerticalBottomIcon
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
    mapIcons.set('formatAlignTopToggle', themeIcon(<TextVerticalTopIcon/>));
    mapIcons.set('formatAlignMiddleToggle', themeIcon(<TextVerticalCenterIcon/>));
    mapIcons.set('formatAlignBottomToggle', themeIcon(<TextVerticalBottomIcon/>));
    mapIcons.set('formatAlignJustifyVerticalToggle', themeIcon(<FormatAlignJustifyIcon/>));
    mapIcons.set('formatAlignDistributedVerticalToggle', themeIcon(<FormatAlignJustifyIcon/>));
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
    const children = (
      <>
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatAlignTopToggle') as Command<boolean>)}
          icon={commandIcons.get('formatAlignTopToggle')}
        />
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatAlignMiddleToggle') as Command<boolean>)}
          icon={commandIcons.get('formatAlignMiddleToggle')}
        />
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatAlignBottomToggle') as Command<boolean>)}
          icon={commandIcons.get('formatAlignBottomToggle')}
        />
        <ExhibitDivider orientation="horizontal"/>
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatAlignJustifyVerticalToggle') as Command<boolean>)}
          icon={commandIcons.get('formatAlignJustifyVerticalToggle')}
        />
        <CommandButton
          {...commandButtonProps}
          command={(commands.getCommand('formatAlignDistributedVerticalToggle') as Command<boolean>)}
          icon={commandIcons.get('formatAlignDistributedVerticalToggle')}
        />
      </>
    );
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, commandIcons]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={propCommands}
      commandHook={propCommandHook}
      createPopupPanel={createPopupPanel}
      label="Vertical Alignment"
      tooltip="Configure how text is placed in the vertical direction of the cell."
      icon={commandIcons.get(activeCommandKey) ?? themeIcon(<TextVerticalBottomIcon/>)}
      {...rest}
    />
  )
}));

export default VerticalAlignCommandButton;