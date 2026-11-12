import React from 'react';

import { Studio } from '@sheetxl/studio-mui';

import { registerStickyNote } from './stickyNote/registerStickyNote';

import { asStory } from '../../components';

/**
 * A new kind of drawing, added from outside the packages the way a third party would: a sticky
 * note with text and a color. It brings its own model, renderer, commands, ribbon tab and format
 * pane body, plus an Insert-tab button. See `./stickyNote` for the recipe, one step per file.
 *
 * Try it: Insert ▸ Sticky Note, then with the note selected use the Sticky Note tab (color,
 * Arrange, Format). Undo works for every edit, and the note saves with the workbook.
 */
registerStickyNote();

const Template: React.FC = () => <Studio />;

export const StudioWithStickyNotes = asStory(Template);
StudioWithStickyNotes.args = {};
StudioWithStickyNotes.storyName = 'With a Custom Drawing';

const Story = {
  title: 'Studio/With a Custom Drawing',
  component: Studio,
};
export default Story;
