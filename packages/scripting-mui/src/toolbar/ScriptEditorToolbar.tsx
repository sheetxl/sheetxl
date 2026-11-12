import { memo, forwardRef } from 'react';

import { useCallbackRef } from '@sheetxl/utils-react';

import {
  CommandButton, CommandToolbar, OverflowPalette,
  type CommandToolbarButtonProps, type CommandToolbarProps
} from '@sheetxl/utils-mui';

import { InsertScriptCommandButton } from '../command';

/**
 * Toolbar for script editor with common script commands.
 */
export const ScriptEditorToolbar = memo(forwardRef<HTMLDivElement, Omit<CommandToolbarProps, "renderToolbarPalette">>(
  (props, refForwarded) => {
  const {
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
        style={{
          // width: 'unset',
          // maxWidth: 'unset',
          // flex: '1 1 0%'
        }}
      >
        <CommandButton
          {...propsCommandButton}
          commandKey={'saveScripts'}
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
        style={{
          // width: 'unset',
          // maxWidth: 'unset',
          // flex: '1 1 0%'
        }}
      >
        <InsertScriptCommandButton
          {...propsCommandButton}
        />
      </OverflowPalette>
      </div>
    </div>
    </>);

    return children;
  }, []);

  return (
    <CommandToolbar
      ref={refForwarded}
      propsCommandButton={propCommandButtonProps}
      renderToolbarPalette={renderToolbarPalette}
      {...rest}
    />
  );
}));

ScriptEditorToolbar.displayName = "ScriptEditorToolbar";