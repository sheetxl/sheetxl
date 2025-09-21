import React, { memo, forwardRef, useCallback } from 'react';

import { CommandButtonType, ICommands } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps, defaultCreatePopupPanel,
  ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

export interface ClearCommandButtonProps extends CommandPopupButtonProps {}

export const ClearCommandButton = memo(
  forwardRef<HTMLElement, ClearCommandButtonProps>((props, refForwarded) => {
  const {
    commands: propsCommands,
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
      scope: 'clear',
      disabled: propDisabled
    }
    const children = (<>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('clearAll')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('clearFormats')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('clearContents')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('clearComments')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('clearHyperlinks')}
      />
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, scope]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={propsCommands}
      disabled={propDisabled}
      commandHook={propCommandHook}
      scope={scope}
      label="Clear"
      tooltip="Clear everything in the cell, or remove just the formatting or contents." // "Delete everything in the cell, or remove just the formatting, contents, comments or hyperlinks."
      createPopupPanel={createPopupPanel}
      icon={'ClearAll'}
      {...rest}
    />
  )

}));

export default ClearCommandButton;