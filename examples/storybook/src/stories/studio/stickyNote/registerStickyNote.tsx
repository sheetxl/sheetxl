import { memo, useEffect } from 'react';

import { MovableContentRegistry } from '@sheetxl/sdk';

import { Command, type CommandContributionComponentProps } from '@sheetxl/utils-react';

import { registerMovableRenderer, type SheetCommandContributorData } from '@sheetxl/react';

import { STICKY_NOTE_TYPE, StickyNoteContent } from './StickyNoteContent';

/**
 * Step 3 of a kind: the wiring, done once at startup. A kind is four registrations, and only the
 * first two are required:
 *
 * 1. the model, with `MovableContentRegistry` (SDK);
 * 2. the UI module, with `registerMovableRenderer`: renderer, commands, tab, pane, loaded lazily;
 * 3. the chrome: a command catalog for the kind's own scope, and the groups its tab lists;
 * 4. a way to make one: an insert command in the `sheet` scope and a button in the Insert tab.
 */

/** The `stickyNote` scope's chrome: the kind's commands and the label of its tab. */
const STICKY_NOTE_CATALOG: Command.CommandCatalog = {
  scope: STICKY_NOTE_TYPE,
  label: 'Sticky Note',
  tag: 'en',
  version: 1,
  commands: {
    stickyNoteToolbar: { label: 'Sticky Note' },
    stickyNoteColorOptions: { label: 'Color', description: 'Change the color of the note.', icon: 'Colorize' },
    stickyNoteColorYellow: { label: 'Yellow', description: 'Make the note yellow.', tags: ['mutator'] },
    stickyNoteColorPink: { label: 'Pink', description: 'Make the note pink.', tags: ['mutator'] },
    stickyNoteColorBlue: { label: 'Blue', description: 'Make the note blue.', tags: ['mutator'] }
  }
};

/**
 * Chrome for the insert command. It joins the `sheet` scope's catalog as a source of its own, so
 * nothing of the package's is replaced.
 */
const INSERT_CATALOG: Command.CommandCatalog = {
  scope: 'sheet',
  tag: 'en',
  version: 1,
  commands: {
    insertStickyNote: { label: 'Sticky Note', description: 'Add a sticky note to the sheet.', icon: 'NoteInsert', tags: ['mutator'] }
  }
};

/**
 * The insert command's behavior, mounted at every `sheet` scope so it closes over that sheet. It
 * lives in `sheet` and not the kind's scope, because the kind's scope exists only while a sticky
 * note is selected.
 */
const StickyNoteInsertCommands = memo((props: CommandContributionComponentProps<SheetCommandContributorData>) => {
  const { scope, data } = props;
  const sheet = data?.sheet;
  useEffect(() => {
    if (!sheet) return undefined;
    const contribution = scope.contribution();
    contribution.updateCommand('insertStickyNote', {
      callback: async () => {
        await sheet.getMovables().add({
          type: STICKY_NOTE_TYPE,
          bounds: { width: 180, height: 140 },
          autoPlace: 'viewport',
          autoSelect: true
        });
      }
    });
    return () => contribution.remove();
  }, [scope, sheet]);
  return null;
});

let registered = false;

/** Registers the sticky note kind. Call once, before the first workbook mounts. Idempotent. */
export function registerStickyNote(): void {
  if (registered) return;
  registered = true;

  // 1. The model.
  MovableContentRegistry.register(STICKY_NOTE_TYPE, (options) => new StickyNoteContent(options));

  // 2. The UI, loaded the first time a sticky note is drawn.
  registerMovableRenderer(STICKY_NOTE_TYPE, () => import('./StickyNoteKind'), { select: (module) => module.StickyNoteKind });

  // 3. The chrome, and the group the tab lists.
  Command.DefaultCommandCatalogService.register(STICKY_NOTE_TYPE, 'en', STICKY_NOTE_CATALOG);
  Command.DefaultCommandCatalogService.register('sheet', 'en', INSERT_CATALOG, { sourceId: 'stickyNoteExample' });
  Command.DefaultCommandButtonRegistry.register({
    key: 'stickyNoteColorOptions',
    members: ['stickyNoteColorYellow', 'stickyNoteColorPink', 'stickyNoteColorBlue']
  }, true);

  // 4. Insert: the command in every `sheet` scope, and a button at the end of the Insert tab.
  Command.DefaultCommandRegistry.registerDynamic('sheet', StickyNoteInsertCommands);
  Command.DefaultCommandButtonRegistry.register({
    key: 'stickyNote.insert',
    defaultKey: 'insertStickyNote',
    showLabel: true,
    contributions: { insertToolbar: {} }
  }, true);
}
