import React, { memo, forwardRef, useCallback } from 'react';

import {
  Command, useCommands, ICommands, CommandButtonType
} from '@sheetxl/utils-react';

import { IColor } from '@sheetxl/sdk';

import { DynamicIcon } from '@sheetxl/utils-react';
import { CommandContext } from '@sheetxl/react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel, ExhibitPopupPanelProps, ExhibitDivider, LabelIcon
} from '@sheetxl/utils-mui';

import { ColorCommandButton } from '../command/ColorCommandButton';

/**
 * Menu for gridline options
 */
export const ViewGridLinesCommandButton = memo(
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
    'gridlinesToggle',
    'sheetViewToggleGridlinesColumns',
    'sheetViewToggleGridlinesRows'
  ];
  const resolvedCommands = useCommands(propCommands, commandKeys);

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      parentFloat: props.floatReference,
      commandHook: propCommandHook,
      scope,
      disabled: propDisabled
    };
    const children = (<>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('gridlinesToggle')}
      />
      <ColorCommandButton
        {...commandButtonProps}
        command={(commands.getCommand('sheetViewFormatGridlinesColor') as Command<IColor, CommandContext.Color>)}
        icon={<DynamicIcon iconKey="stroke.colored" />}
        panelProps={{
          disableAlpha: true
        }}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('sheetViewToggleGridlinesColumns')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('sheetViewToggleGridlinesRows')}
      />
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      parentFloat={parentFloat}
      quickCommand={resolvedCommands[0]?.key()}
      commands={propCommands}
      commandHook={propCommandHook}
      createPopupPanel={createPopupPanel}
      label="Gridlines"
      tooltip="Configure how the lines between rows and columns in the sheet are displayed."
      icon={<LabelIcon
        command={resolvedCommands[0]}
        scope={"view"}
      />}
      {...rest}
    />
  )

}));

export default ViewGridLinesCommandButton;