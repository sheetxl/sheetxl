import React, { memo, forwardRef, useCallback } from 'react';

import { ICommands, CommandButtonType } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps, defaultCreatePopupPanel,
  ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';


/**
 * PLACEHOLDER for FilterCommandButton.
 *
 * Popup menu on the Filter button.  (should we merge this with the sort menu?)
 */
export const FilterCommandButton = memo(
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
      scope: 'sort',
      disabled: propDisabled
    }

    const children = (<>
      <CommandButton
        {...commandButtonProps}
        scope={'filter'}
        command={commands.getCommand('autoFilterToggle')}
      />
      <CommandButton
        {...commandButtonProps}
        scope={'filter'}
        command={commands.getCommand('autoFilterClear')}
      />
      <CommandButton
        {...commandButtonProps}
        scope={'filter'}
        command={commands.getCommand('autoFilterReapply')}
      />
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, scope]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={propCommands}
      commandHook={propCommandHook}
      scope={scope}
      disabled={propDisabled}
      label="Filter" // Sort & Filter
      tooltip={(<><span>Organize your data so it's easier to analyze.</span><br/><span>You can sort the selected data from smallest to largest or largest to smallest.</span></>)} // You can sort the selected data from smallest to largest, largest to smallest, or filter our specific values
      createPopupPanel={createPopupPanel}
      icon={'FilterToggle'}
      {...rest}
    />
  )
}));