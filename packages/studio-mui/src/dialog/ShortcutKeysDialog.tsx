import React from 'react';

import { DialogContent } from '@mui/material';

import { ICommands, KeyCodes } from '@sheetxl/utils-react';

import { InternalWindow, InternalWindowProps } from '@sheetxl/utils-mui';
import { ShortcutKeysPanel } from './ShortcutKeysPanel';

export interface ShortcutKeysDialogProps extends InternalWindowProps {
  commands: ICommands.IGroup;
};

const ShortcutKeysDialog: React.FC<ShortcutKeysDialogProps> = (props: ShortcutKeysDialogProps) => {
  const {
    title: propTitle = 'Shortcut Keys',
    commands,
    sx: propSx,
    ...rest
  } = props;

  return (
    <InternalWindow
      isModal={true}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.keyCode === KeyCodes.F1) {
          e.preventDefault();
        }
      }}
      sx={{
        width: '780px',
        ...propSx
      }}
      title={propTitle}
      autoFocusSel={'.input'}
      {...rest}
    >
      <DialogContent dividers>
        <ShortcutKeysPanel
          commands={commands}
          sx={{
            marginBottom: '8px'
          }}
        />
      </DialogContent>
    </InternalWindow>
  );
}

export default ShortcutKeysDialog;