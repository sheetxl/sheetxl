import React, { memo, forwardRef } from 'react';

import { ScriptSaveIcon } from '@sheetxl/utils-mui';
// import { PlayArrow as PlayArrowIcon } from '@mui/icons-material';
// import { TerminalOutlined as TerminalOutlinedIcon } from '@mui/icons-material';
// import { IntegrationInstructionsOutlined as IntegrationInstructionsOutlinedIcon } from '@mui/icons-material';

import { useCallbackRef } from '@sheetxl/utils-react';

import {
  CommandButton, CommandToolbar, CommandToolbarButtonProps, CommandToolbarProps, themeIcon
} from '@sheetxl/utils-mui';

import { OverflowPalette } from '../../toolbar/OverflowPalette';

import { InsertScriptCommandButton } from '../command/InsertScriptCommandButton';

const ScriptEditorToolbar = memo(forwardRef<HTMLDivElement, Omit<CommandToolbarProps, "createToolbarPalette">>((props, refForwarded) => {
  const {
    commands,
    parentFloat,
    commandButtonProps: propCommandButtonProps,
    ...rest
  } = props;

  const createToolbarPalette = useCallbackRef((props: CommandToolbarButtonProps) => {
    const {
      commandButtonProps,
      commandPopupProps: _commandPopupProps
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
          {...commandButtonProps}
          command={(commands.getCommand('saveScripts'))}
          icon={themeIcon(<ScriptSaveIcon/>)}
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
          {...commandButtonProps}
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
      commandButtonProps={propCommandButtonProps}
      createToolbarPalette={createToolbarPalette}
      {...rest}
    />
  );
}));

ScriptEditorToolbar.displayName = "ScriptEditorToolbar";
export { ScriptEditorToolbar };