import React, { memo, forwardRef, useCallback } from 'react';

import { ICommands, CommandButtonType } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel, ExhibitPopupPanelProps, ExhibitDivider
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
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('mergeHorizontal')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('mergeVertical')}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('unmerge')}
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
      icon={'MergeAll'}
      {...rest}
    />
  )

}));

export default MergeCommandButton;