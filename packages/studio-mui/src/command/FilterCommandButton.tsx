import React, { memo, forwardRef, useCallback } from 'react';

import {
  FilterToggleIcon, FilterReapplyIcon, FilterClearIcon
} from '@sheetxl/utils-mui';

import { ICommands, CommandButtonType } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps, defaultCreatePopupPanel,
  ExhibitPopupPanelProps, themeIcon
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
        icon={themeIcon(<FilterToggleIcon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        scope={'filter'}
        command={commands.getCommand('autoFilterClear')}
        icon={themeIcon(<FilterClearIcon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        scope={'filter'}
        command={commands.getCommand('autoFilterReapply')}
        icon={themeIcon(<FilterReapplyIcon/>)}
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
      icon={themeIcon(<FilterToggleIcon/>)}
      {...rest}
    />
  )

}));

export default FilterCommandButton;