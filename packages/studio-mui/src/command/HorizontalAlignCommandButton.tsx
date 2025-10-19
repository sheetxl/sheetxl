import React, {
  useMemo, memo, forwardRef, useCallback
 } from 'react';

import clsx from 'clsx';

import { Box } from '@mui/material';

import { Command, ICommands, useCommands, CommandButtonType } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel, ExhibitDivider, ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

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

  const activeCommand = useMemo(() => {
    for (let i=0; i<resolvedCommands.length; i++) {
      if ((resolvedCommands[i] as Command<boolean>)?.getState()) {
        return resolvedCommands[i];
      }
    }
    // default
    return resolvedCommands[0];
  }, [resolvedCommands])

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
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('formatAlignCenterToggle') as Command<boolean>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('formatAlignRightToggle') as Command<boolean>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('formatAlignJustifyToggle') as Command<boolean>)}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('formatAlignCenterContinuousToggle') as Command<boolean>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('formatAlignFillToggle') as Command<boolean>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('formatAlignDistributedHorizontalToggle') as Command<boolean>)}
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
        />
        <CommandButton
          command={commands.getCommand('formatIndentIncrease')}
          commandHook={commandHookNoBefore}
          scope={scope}
          disabled={propDisabled}
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
      quickCommand={activeCommand?.getKey()}
      // selected={isSelected}
      icon={activeCommand?.getIcon() ?? 'FormatAlignLeft'}
      {...rest}
    />
  )
}));