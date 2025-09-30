import React, { memo, forwardRef, useCallback } from 'react';

import { ICommands, type CommandButtonOptions, CommandButtonType } from '@sheetxl/utils-react';

import { FloatReference } from '@sheetxl/utils-mui';

import {
  CommandButton, CommandPopupButton, defaultCreatePopupPanel,
  ExhibitPopupPanelProps, SimpleCommandPopupButton, ExhibitDivider
} from '@sheetxl/utils-mui';

export interface CellsFormatCommandButtonProps extends CommandButtonOptions {
  parentFloat: FloatReference;

  commands: ICommands.IGroup;
}

/**
 * Menu for cell formatting
 */
export const CellsFormatCommandButton = memo(
  forwardRef<HTMLElement, CellsFormatCommandButtonProps>((props, refForwarded) => {
  const {
    commands: propCommands,
    commandHook: propCommandHook,
    scope,
    // disabled: propDisabled = false,
    ...rest
  } = props;
  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      // parentFloat: props.floatReference,
      commandHook: propCommandHook,
      scope: 'formatCells',
      // disabled: propDisabled
    }
    const commandButtonsPopup = {
      commands,
      parentFloat: props.floatReference,
      ...commandButtonProps
    }
    const children = (<>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('resizeRows')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('autoFitRows')}
      />
      <ExhibitDivider
        orientation="horizontal"
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('resizeColumns')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('autoFitColumns')}
      />
      <ExhibitDivider
        orientation="horizontal"
      />
      <SimpleCommandPopupButton
        ref={refForwarded}
        {...commandButtonsPopup}
        popupCommandKeys={[
          'hideColumns',
          'hideRows',
          null,// divider
          'unhideColumns',
          'unhideRows',
        ]}
        // icon={'CellsFormat'}
        popupScope={'hideUnhide'}
        label="Hide & Unhide"
        // tooltip="Hide or Unhide row and column."
      />
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propCommandHook, scope]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={propCommands}
      commandHook={propCommandHook}
      scope={scope}
      createPopupPanel={createPopupPanel}
      icon={'CellsFormat'}
      label="Format Cells"
      tooltip="Change row and column sizes or visibility."
      {...rest}
    />
  );
}));

CellsFormatCommandButton.displayName = "CellsFormatCommandButton";