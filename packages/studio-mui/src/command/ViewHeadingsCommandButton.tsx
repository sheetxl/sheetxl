import React, { memo, forwardRef, useCallback } from 'react';

import {
  useCommands, ICommands, CommandButtonType
} from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps, defaultCreatePopupPanel,
  ExhibitPopupPanelProps, ExhibitDivider, LabelIcon
} from '@sheetxl/utils-mui';


/**
 * Menu for heading options
 */
export const ViewHeadingsCommandButton = memo(
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
    'sheetViewToggleShowHeadings',
    'sheetViewToggleShowHeadingColumns',
    'sheetViewToggleShowHeadingRows'
  ];
  const resolvedCommands = useCommands(propCommands, commandKeys);

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
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
        command={commands.getCommand('sheetViewToggleShowHeadings')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('sheetViewToggleShowHeadingsNumeric')}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('sheetViewToggleShowHeadingColumns')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('sheetViewToggleShowHeadingRows')}
      />
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, scope]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      parentFloat={parentFloat}
      quickCommand={resolvedCommands[0]?.key()}
      commands={propCommands}
      commandHook={propCommandHook}
      createPopupPanel={createPopupPanel}
      label="Headings"
      tooltip="Configure how the column and rows headings in the sheet are displayed."
      icon={<LabelIcon
        command={resolvedCommands[0]}
        scope={"view"}
      />}
      {...rest}
    />
  )
}));