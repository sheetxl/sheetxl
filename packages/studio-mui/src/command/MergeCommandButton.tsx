import React, { memo, forwardRef, useCallback } from 'react';

import { ICommands, CommandButtonType } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel, ExhibitPopupPanelProps, ExhibitDivider, themeIcon
} from '@sheetxl/utils-mui';

import {
  MergeAllIcon, MergeHorizontalIcon, MergeVerticalIcon, MergeUnMergeIcon
} from '@sheetxl/utils-mui';

export interface MergeCommandButtonProps extends CommandPopupButtonProps {}

/**
 * Menu for merge options
 */
export const MergeCommandButton = memo(
  forwardRef<HTMLElement, MergeCommandButtonProps>((props, refForwarded) => {
  const {
    commands: propCommands,
    commandHook: propCommandHook,
    scope,
    disabled: propDisabled = false,
    ...rest
  } = props;

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
        command={commands.getCommand('mergeToggle')}
        icon={themeIcon(<MergeAllIcon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('mergeHorizontal')}
        icon={themeIcon(<MergeHorizontalIcon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('mergeVertical')}
        icon={themeIcon(<MergeVerticalIcon/>)}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('unmerge')}
        icon={themeIcon(<MergeUnMergeIcon/>)}
      />
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, scope]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={propCommands}
      quickCommand={'mergeToggle'}
      commandHook={propCommandHook}
      scope={scope}
      // label="Merge Cells"
      tooltip="Combine or split cells."
      createPopupPanel={createPopupPanel}
      // disabled={propDisabled || commandPrimaryToggle?.disabled()}
      icon={themeIcon(<MergeAllIcon/>)}
      {...rest}
    />
  )

}));

export default MergeCommandButton;