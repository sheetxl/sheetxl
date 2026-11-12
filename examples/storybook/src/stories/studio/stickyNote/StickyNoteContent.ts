import { AbstractMovableContent, type MovableContentRegistry } from '@sheetxl/sdk';

/** What a sticky note saves. */
export interface StickyNoteJSON {
  text?: string;
  color?: string;
}

interface StickyNoteState extends AbstractMovableContent.State {
  data?: StickyNoteJSON;
}

/** The content type, as registered with `MovableContentRegistry` and `registerMovableRenderer`. */
export const STICKY_NOTE_TYPE = 'stickyNote';

export const STICKY_NOTE_COLORS = {
  yellow: '#fff59d',
  pink: '#f8bbd0',
  blue: '#b3e5fc'
} as const;

/** One command per color: a toggle that reads pressed for the note's current color. */
export const STICKY_NOTE_COLOR_COMMANDS: [key: string, color: string][] = [
  ['stickyNoteColorYellow', STICKY_NOTE_COLORS.yellow],
  ['stickyNoteColorPink', STICKY_NOTE_COLORS.pink],
  ['stickyNoteColorBlue', STICKY_NOTE_COLORS.blue]
];

/**
 * Step 1 of a kind: the model. The SDK holds it, saves it with the workbook, and undoes its edits.
 * Every setter is one `_updateState`, so each edit is one undo step.
 */
export class StickyNoteContent extends AbstractMovableContent<StickyNoteState, StickyNoteJSON> {
  constructor(options: MovableContentRegistry.CreateOptions) {
    super(options);
    this._updateState({ data: { text: 'New note', color: STICKY_NOTE_COLORS.yellow, ...options.json } });
  }

  getType(): string { return STICKY_NOTE_TYPE; }

  /** The kind's name. It also labels the default ribbon tab and heads the format pane. */
  getTypeDescription(): string { return 'Sticky Note'; }

  getText(): string { return this._getState()?.data?.text ?? ''; }

  setText(text: string): this {
    this._protectionCheck('Edit Note Text');
    this._updateState({ data: { ...this._getState()?.data, text } }, { description: 'Edit Note Text' }, ['onAnyChange']);
    return this;
  }

  getColor(): string { return this._getState()?.data?.color ?? STICKY_NOTE_COLORS.yellow; }

  setColor(color: string): this {
    this._protectionCheck('Change Note Color');
    this._updateState({ data: { ...this._getState()?.data, color } }, { description: 'Change Note Color' }, ['onAnyChange']);
    return this;
  }

  toJSON(): StickyNoteJSON {
    return { ...this._getState()?.data };
  }
}
