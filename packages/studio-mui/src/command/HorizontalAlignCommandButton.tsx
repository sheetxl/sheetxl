import React, {
  useMemo, memo, forwardRef, useCallback
 } from 'react';

 import clsx from 'clsx';

import { Box } from '@mui/material';

import { FormatAlignLeft as FormatAlignLeftIcon } from '@mui/icons-material';
import { FormatAlignRight as FormatAlignRightIcon } from '@mui/icons-material';
import { FormatAlignCenter as FormatAlignCenterIcon } from '@mui/icons-material';
import { FormatAlignJustify as FormatAlignJustifyIcon } from '@mui/icons-material';

import { Command, ICommands, useCommands, CommandButtonType } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel, ExhibitDivider, themeIcon, ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

import { FormatIndentIncreaseIcon, FormatIndentDecreaseIcon } from '@sheetxl/utils-mui';

export const HorizontalAlignCommandButton = memo(
  forwardRef<HTMLElement, CommandPopupButtonProps>((props, refForwarded) => {
  const {
    commands: propCommands,
    commandHook: propCommandHook,
    scope,
    disabled: propDisabled = false,
    parentFloat,
    ...rest
  } = props;

  const commandKeys:string[] = [
    'formatAlignLeftToggle',
    'formatAlignCenterToggle',
    'formatAlignRightToggle',
    'formatAlignJustifyToggle',
    'formatAlignCenterContinuousToggle',
    'formatAlignFillToggle',
    'formatAlignDistributedHorizontalToggle'
  ]
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
    mapIcons.set('formatAlignLeftToggle', themeIcon(<FormatAlignLeftIcon/>));
    mapIcons.set('formatAlignCenterToggle', themeIcon(<FormatAlignCenterIcon/>));
    mapIcons.set('formatAlignRightToggle', themeIcon(<FormatAlignRightIcon/>));
    mapIcons.set('formatAlignJustifyToggle', themeIcon(<FormatAlignJustifyIcon/>));
    mapIcons.set('formatAlignCenterContinuousToggle', themeIcon(<FormatAlignCenterIcon/>)); // FormatAlignCenterContinuousIcon
    mapIcons.set('formatAlignFillToggle', themeIcon(<FormatAlignJustifyIcon/>)); // FormatAlignFillIcon
    mapIcons.set('formatAlignDistributedHorizontalToggle', themeIcon(<FormatAlignJustifyIcon/>)); // FormatAlignDistributedHorizontalIcon

    return mapIcons;
  }, []);

  const commandHookNoBefore = useMemo(() => {
    if (!propCommandHook) return null;
    const retValue = {...propCommandHook};
    delete retValue.beforeExecute;
    return retValue;
  }, [propCommandHook]);

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      // parentFloat: props.floatReference,
      commandHook: propCommandHook,
      scope,
      disabled: propDisabled
    }
    const menus = (<>
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('formatAlignLeftToggle') as Command<boolean>)}
        icon={commandIcons.get('formatAlignLeftToggle')}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('formatAlignCenterToggle') as Command<boolean>)}
        icon={commandIcons.get('formatAlignCenterToggle')}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('formatAlignRightToggle') as Command<boolean>)}
        icon={commandIcons.get('formatAlignRightToggle')}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('formatAlignJustifyToggle') as Command<boolean>)}
        icon={commandIcons.get('formatAlignJustifyToggle')}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('formatAlignCenterContinuousToggle') as Command<boolean>)}
        icon={commandIcons.get('formatAlignCenterContinuousToggle')}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('formatAlignFillToggle') as Command<boolean>)}
        icon={commandIcons.get('formatAlignFillToggle')}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('formatAlignDistributedHorizontalToggle') as Command<boolean>)}
        icon={commandIcons.get('formatAlignDistributedHorizontalToggle')}
      />
    </>
    );
    const quickFormats = (
      <Box
        sx={{
          className: clsx("quick-buttons"),
          display:'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={(e) => e.stopPropagation() } // Prevent the quick buttons from closing the menu
      >
        <CommandButton
          command={commands.getCommand('formatIndentDecrease')}
          commandHook={commandHookNoBefore}
          scope={scope}
          disabled={propDisabled}
          icon={themeIcon(<FormatIndentDecreaseIcon/>)}
        />
        <CommandButton
          command={commands.getCommand('formatIndentIncrease')}
          commandHook={commandHookNoBefore}
          scope={scope}
          disabled={propDisabled}
          icon={themeIcon(<FormatIndentIncreaseIcon/>)}
        />
      </Box>
    );
    const children = (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 100%',
          overflow: 'hidden'
        }}
        {...rest}
      >
        {quickFormats}
        <ExhibitDivider orientation="horizontal"/>
        <Box
          sx={{
            overflow: 'auto',
            flex: "1 1 100%"
          }}>
          {menus}
        </Box>
      </Box>
    );
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      parentFloat={parentFloat}
      commands={propCommands}
      commandHook={propCommandHook}
      scope={scope}
      createPopupPanel={createPopupPanel}
      label="Horizontal Alignment"
      tooltip="Configure how text is placed in the horizontal direction of the cell."
      quickCommand={activeCommandKey}
      // selected={isSelected}
      icon={commandIcons.get(activeCommandKey) ?? <FormatAlignLeftIcon/>}
      {...rest}
    />
  )

}));

export default HorizontalAlignCommandButton;