import React, { memo, forwardRef } from 'react';

import { Command, ICommands, CommandButtonType } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps, defaultCreatePopupPanel,
  ExhibitDivider, ExhibitPopupPanelProps, PasteIcon, themeIcon
} from '@sheetxl/utils-mui';

import { useCallbackRef } from '@sheetxl/utils-react';

import {
  PasteValuesIcon, PasteFormatsIcon, PasteFormulasIcon, PasteTransposeIcon, PasteLinksIcon
} from '@sheetxl/utils-mui';

export interface PasteCommandButtonProps extends CommandPopupButtonProps {
  command: Command<void>; // Might be paste options

  /**
   * Duplicate the paste all in the popup as well as the quick button
   * @defaultValue true
   */
  includePasteAllInPopup?:boolean;
}

/**
 * Menu for paste options
 */
export const PasteCommandButton = memo(
  forwardRef<HTMLElement, PasteCommandButtonProps>((props, refForwarded) => {
  const {
    command,
    commands: propCommands,
    commandHook: propCommandHook,
    scope,
    includePasteAllInPopup = true,
    disabled: propDisabled = false,
    ...rest
  } = props;

  const createPopupPanel = useCallbackRef((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      // parentFloat: props.floatReference,
      commandHook: propCommandHook,
      scope: 'paste',
      disabled: propDisabled
    }
    const children = [];
    if (includePasteAllInPopup) {
      children.push(
        <CommandButton
          {...commandButtonProps}
          command={commands.getCommand('paste')}
          key="paste"
          icon={<PasteIcon/>}
        />
      );
      children.push(
        <ExhibitDivider orientation="horizontal" key="paste-div"/>
      );
    }
    children.push(
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('pasteValues')}
        key="pasteValues"
        icon={themeIcon(<PasteValuesIcon/>)}
      />
    );
    children.push(
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('pasteFormats')}
        key="pasteFormats"
        icon={themeIcon(<PasteFormatsIcon/>)}
      />
    );
    children.push(
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('pasteFormulas')}
        key="pasteFormulas"
        icon={themeIcon(<PasteFormulasIcon/>)}
      />
    );
    children.push(
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('pasteTranspose')}
        key="pasteTranspose"
        icon={themeIcon(<PasteTransposeIcon/>)}
      />
    );
    children.push(
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('pasteLinks')}
        key="pasteLinks"
        icon={themeIcon(<PasteLinksIcon/>)}
      />
    );
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, scope, includePasteAllInPopup]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={propCommands}
      commandHook={propCommandHook}
      scope={scope}
      createPopupPanel={createPopupPanel}
      label="Paste"
      tooltip="Add content to the clipboard to your document."
      quickCommand={'paste'}
      icon={<PasteIcon/>}
      {...rest}
    />
  )

}));

export default PasteCommandButton;