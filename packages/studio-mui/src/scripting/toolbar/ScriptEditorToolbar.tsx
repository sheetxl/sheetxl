import React, { memo, forwardRef } from 'react';

import { useCallbackRef } from '@sheetxl/utils-react';

import {
  CommandButton, CommandToolbar, CommandToolbarButtonProps, CommandToolbarProps
} from '@sheetxl/utils-mui';

import { OverflowPalette } from '../../toolbar/OverflowPalette';

import { InsertScriptCommandButton } from '../command/InsertScriptCommandButton';

/**
 * Toolbar for script editor with common script commands.
 */
export const ScriptEditorToolbar = memo(forwardRef<HTMLDivElement, Omit<CommandToolbarProps, "renderToolbarPalette">>(
  (props, refForwarded) => {
  const {
    commands,
    parentFloat,
    propsCommandButton: propCommandButtonProps,
    ...rest
  } = props;

  const renderToolbarPalette = useCallbackRef((props: CommandToolbarButtonProps) => {
    const {
      propsCommandButton,
      propsCommandPopup: _commandPopupProps
    } = props;

    // TODO - all of the icons stroke lines are 'too thin' and need to be revisited by a designer, and ai, or me.
    const children = (<>
    <div
      style={{
        display: 'flex',
        flex: '1 1 100%'
      }}
    >
      <div>
      <OverflowPalette
        parentFloat={parentFloat}
        style={{
          // width: 'unset',
          // maxWidth: 'unset',
          // flex: '1 1 0%'
        }}
      >
        <CommandButton
          {...propsCommandButton}
          command={(commands?.getCommand('saveScripts'))}
        />
        {/* log viewer - console */}
        {/* gotoFunction - This will be a labeled script with the selected function and a dropdown with all of the choices. (will also move cursor to function) */}
        {/* debug - dialog with inputs? */}
        {/* event (this will be predefined like onOpen, onTimer, etc) */}
        {/* secret key config */}
      </OverflowPalette>
      </div>
      <div style={{ flex: '1 1 100%'}}></div>
      <div>
      <OverflowPalette
        parentFloat={parentFloat}
        style={{
          // width: 'unset',
          // maxWidth: 'unset',
          // flex: '1 1 0%'
        }}
      >
        <InsertScriptCommandButton
          {...propsCommandButton}
          commands={commands}
        />
      </OverflowPalette>
      </div>
    </div>
    </>);

    return children;
  }, [commands]);

  return (
    <CommandToolbar
      ref={refForwarded}
      commands={commands}
      parentFloat={parentFloat}
      propsCommandButton={propCommandButtonProps}
      renderToolbarPalette={renderToolbarPalette}
      {...rest}
    />
  );
}));

ScriptEditorToolbar.displayName = "ScriptEditorToolbar";