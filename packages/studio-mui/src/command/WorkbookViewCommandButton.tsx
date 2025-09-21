import React, {
  memo, forwardRef, useCallback
} from 'react';

import {
  Command, CommandButtonType
} from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel, ExhibitDivider, ExhibitPopupPanelProps,
  LabelIcon
} from '@sheetxl/utils-mui';

export interface WorkbookViewCommandButtonProps extends CommandPopupButtonProps {

}

export const WorkbookViewCommandButton = memo(
  forwardRef<HTMLElement, WorkbookViewCommandButtonProps>((props, refForwarded) => {
  const {
    commands,
    commandHook: propCommandHook,
    scope = "view",
    disabled: propDisabled = false,
    ...rest
  } = props;

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      parentFloat: props.floatReference,
      commandHook: propCommandHook,
      scope,
      disabled: propDisabled
    }
    const children = (<>
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('workbookViewToggleShowFormulaBar') as Command<boolean>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('workbookViewToggleShowTabs') as Command<boolean>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('workbookViewToggleShowStatusBar') as Command<boolean>)}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('workbookViewToggleShowHorizontalScrollBar') as Command<boolean>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('workbookViewToggleShowVerticalScrollBar') as Command<boolean>)}
      />
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, commands, propCommandHook, scope]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={commands}
      disabled={propDisabled}
      commandHook={propCommandHook}
      scope={scope}
      label="Workbook View"
      tooltip="Options to configure how the workbook is displayed."
      createPopupPanel={createPopupPanel}
      icon={<LabelIcon
        icon={null}
        label="Workbook View"
      />}
      {...rest}
    />
  )

}));

export default WorkbookViewCommandButton;