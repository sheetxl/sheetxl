import React, { useEffect, useReducer, useState } from 'react';

import { Box, Button, TextField, Typography } from '@mui/material';

import { type IMovable } from '@sheetxl/sdk';

import { Command } from '@sheetxl/utils-react';

import {
  WORKBOOK_TOOLBARS_KEY, createTransactionalMiddleware, useModelListener,
  type MovableKindCommandData, type MovablePaneProps, type MovableRendererModule, type MovableRendererProps
} from '@sheetxl/react';

import { STICKY_NOTE_COLORS, STICKY_NOTE_COLOR_COMMANDS, type StickyNoteContent } from './StickyNoteContent';

/**
 * Step 2 of a kind: its UI, in one module that `registerMovableRenderer` loads the first time a
 * sticky note is drawn. Everything here is optional except the renderer; a kind that leaves out
 * `toolbar` gets a default tab, and one that leaves out `pane` gets the format pane's empty state.
 */

/** Re-renders the caller whenever the note changes, an undo or redo included. */
const useNote = (movable: IMovable): StickyNoteContent => {
  const note = movable.getContent<StickyNoteContent>();
  const [, bump] = useReducer((s: number) => s + 1, 0);
  useModelListener(note, { onAnyChange: () => bump() });
  return note;
};

/** Draws the note inside the frame the movable layer gives it. */
const StickyNoteRenderer = (props: MovableRendererProps): React.ReactElement => {
  const note = useNote(props.movable);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        boxSizing: 'border-box',
        padding: 10,
        background: note.getColor(),
        boxShadow: '2px 3px 6px rgba(0, 0, 0, 0.25)',
        color: '#333',
        font: '14px/1.35 "Segoe Print", "Comic Sans MS", cursive',
        whiteSpace: 'pre-wrap',
        overflow: 'hidden'
      }}
    >
      {note.getText()}
    </div>
  );
};

/**
 * The kind's command behavior. It runs in a scope named `stickyNote` for the active sticky note, and
 * again for each note that becomes active; the chrome (labels, icons) is the `stickyNote` catalog in
 * `registerStickyNote`.
 */
const contributeStickyNoteCommands: Command.DynamicCommandContributor<MovableKindCommandData> = (contribution, data) => {
  const { sheet, movable, notifier } = data;
  // Each command is one transaction: one undo step, and refused on a protected sheet.
  contribution.use(createTransactionalMiddleware({ transaction: sheet, notifier }));

  const note = movable.getContent<StickyNoteContent>();
  for (const [key, color] of STICKY_NOTE_COLOR_COMMANDS) {
    contribution.updateCommand(key, { callback: () => { note.setColor(color); } });
  }

  // The pressed color follows the note, an undo included.
  const syncState = (): void => {
    for (const [key, color] of STICKY_NOTE_COLOR_COMMANDS) contribution.updateCommand<boolean>(key, { state: note.getColor() === color });
  };
  syncState();
  return note.addListeners({ onAnyChange: syncState }, { transactional: false });
};

/**
 * The kind's ribbon tab, shown while a sticky note is the active selection. Its label is
 * `stickyNoteToolbar` in the kind's catalog. A group it lists must be registered, as
 * `stickyNoteColorOptions` is in `registerStickyNote`. It ends as every drawing tab does: the shared
 * Arrange popup and the format pane.
 */
const STICKY_NOTE_TOOLBAR: Command.CommandButtonEntry & { key: string } = {
  key: 'stickyNoteToolbar',
  contributions: { [WORKBOOK_TOOLBARS_KEY]: { order: 1 } },
  members: [
    'stickyNoteColorOptions',
    '-',
    'arrangeOptions',
    'formatMovable'
  ]
};

/** The body the format pane shows while a sticky note is the active selection. */
const StickyNotePane = (props: MovablePaneProps): React.ReactElement => {
  const note = useNote(props.movable);
  // Edited locally and written on blur, so the text is one undo step and not one per keystroke.
  const [text, setText] = useState(note.getText());
  const saved = note.getText();
  useEffect(() => { setText(saved); }, [saved]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label="Text"
        multiline
        minRows={3}
        size="small"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => { if (text !== saved) note.setText(text); }}
      />
      <Box>
        <Typography variant="caption">Color</Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
          {Object.entries(STICKY_NOTE_COLORS).map(([name, color]) => (
            <Button
              key={name}
              aria-label={name}
              aria-pressed={note.getColor() === color}
              onClick={() => note.setColor(color)}
              sx={{
                minWidth: 32,
                height: 32,
                background: color,
                border: note.getColor() === color ? '2px solid #333' : '1px solid rgba(0, 0, 0, 0.2)'
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export const StickyNoteKind: MovableRendererModule = {
  renderer: StickyNoteRenderer,
  commands: contributeStickyNoteCommands,
  toolbar: STICKY_NOTE_TOOLBAR,
  pane: StickyNotePane
};
