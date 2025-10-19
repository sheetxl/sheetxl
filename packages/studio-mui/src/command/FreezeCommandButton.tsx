import React, { memo, forwardRef, useCallback } from 'react';

import { ICommands, CommandButtonType } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel, ExhibitPopupPanelProps, ExhibitDivider
} from '@sheetxl/utils-mui';

/**
 * Menu for freeze options
 */
export const FreezeCommandButton = memo(
  forwardRef<HTMLElement, CommandPopupButtonProps>((props, refForwarded) => {
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
        command={commands.getCommand('freezeToggle')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('freezeToggleHorizontal')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('freezeToggleVertical')}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('unfreeze')}
      />
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, scope]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={propCommands}
      commandHook={propCommandHook}
      createPopupPanel={createPopupPanel}
      quickCommand={'freezeToggle'}
      label="Freeze Panes"
      tooltip="Freeze a portion of the sheet to keep it visible while you scroll through the rest of the sheet.\n\nUseful for viewing data in other parts of your worksheet without losing your headers or labels."
      // selected={commandPrimaryToggle?.getState()}
      icon={'Freeze'}
      {...rest}
    />
  )
}));