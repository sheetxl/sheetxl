import React, { memo, forwardRef, useCallback } from 'react';

import { CommandButtonType, ICommands } from '@sheetxl/utils-react';

import { ClearContentsIcon } from '@sheetxl/utils-mui';
import { ClearAllIcon } from '@sheetxl/utils-mui';
import { ClearFormatsIcon } from '@sheetxl/utils-mui';


import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps, defaultCreatePopupPanel,
  ExhibitPopupPanelProps, themeIcon
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
        icon={<ClearAllIcon/>}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('clearFormats')}
        icon={themeIcon(<ClearFormatsIcon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('clearContents')}
        icon={themeIcon(<ClearContentsIcon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('clearComments')}
        // icon={themeIcon(<ClearContentsIcon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('clearHyperlinks')}
        // icon={themeIcon(<ClearContentsIcon/>)}
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
      icon={<ClearAllIcon/>}
      {...rest}
    />
  )

}));

export default ClearCommandButton;