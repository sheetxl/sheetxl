import React, { useMemo, memo, forwardRef, useCallback } from 'react';

import { CommandButtonType, ICommands, useCommands } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps, defaultCreatePopupPanel,
  ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

export interface InsertImageCommandButtonProps extends CommandPopupButtonProps {
  /**
   * If set to `true` only a single menu will be shown instead of a popup if
   * only one command is enabled. Useful for adding or removing rows/column on headers.
   *
   * @remarks
   * This is only considered for `MenuButton` Variant.
   */
  preferSingleMenu?: boolean;

  showQuickButton?: boolean;
}

export const InsertImageCommandButton = memo(
  forwardRef<HTMLElement, InsertImageCommandButtonProps>((props, refForwarded) => {
  const {
    commands: propCommands,
    commandHook: propCommandHook,
    scope,
    disabled: propDisabled = false,
    preferSingleMenu = true,
    showQuickButton: _showQuickButton = true,
    variant = CommandButtonType.Toolbar,
    ...rest
  } = props;

  const resolvedCommands = useCommands(propCommands, [
    'insertImageFromFile',
    'insertImageFromURL',
    // insertImageFromUnsplash
  ]);

  const { singleMenuCommand, allDisabled } = useMemo(() => {
    let singleCommand = null;
    let count = 0;
    for (let i=0; i<resolvedCommands.length; i++) {
      if (resolvedCommands[i] && !resolvedCommands[i]?.disabled()) {
        // if first enabled command set otherwise null
        if (preferSingleMenu && variant === CommandButtonType.Menuitem)
          singleCommand = count === 0 ? resolvedCommands[i] : null;
        count++;
      }
    }
    return { singleMenuCommand: singleCommand, allDisabled: count === 0 };
  }, [resolvedCommands]);

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      // parentFloat: props.floatReference,
      commandHook: propCommandHook,
      scope: 'insertImage',
      disabled: propDisabled
    }
    const children = (<>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('insertImageFromFile')}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('insertImageFromURL')}
      />
      {/* <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('insertImageFromUnsplash')}
      /> */}
    </>);
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, scope]);

  // if single command show regular menu
  if (singleMenuCommand) {
    return (
      <CommandButton
        ref={refForwarded as unknown as any}
        variant={variant}
        commandHook={propCommandHook}
        // scope={scope} // Remove the popup scope
        disabled={propDisabled}
        command={singleMenuCommand}
        {...rest}
      />
    )
  }
  return (
    <CommandPopupButton
      ref={refForwarded}
      variant={variant}
      quickCommand={'insertImageFromFile'}
      // onQuickClick={!activeCommand ? () => {} : undefined} // So that it always act like popup even if we don't have a command
      commands={propCommands}
      commandHook={propCommandHook}
      scope={scope}
      disabled={propDisabled || allDisabled}
      // label={`Insert Image\u2026`}
      tooltip={`Insert a picture from the web to complement your data.`}
      createPopupPanel={createPopupPanel}
      icon={'InsertImage'}
      {...rest}
    />
  );
}));