import type { IFontStyle, IShapeStyle } from '@sheetxl/sdk';

/**
 * One setting, declared rather than drawn: what it is called and how it is read and written. A
 * format editor's tab, and a details pane's row, draw their bodies from these.
 */
export type FormatField = FormatField.Base & (
  { type: 'flag', get: () => boolean, set: (value: boolean) => void } |
  { type: 'choice', options: readonly string[], labels: Readonly<Record<string, string>>, get: () => string, set: (value: string) => void } |
  /**
   * A number. One that may be left for its owner to work out (an axis' bounds) states `auto`: its
   * `get` then answers `null` while nothing is stated, and `set` takes `null` to state nothing.
   */
  { type: 'number', min: number, max: number, decimals?: boolean, auto?: string, get: () => number | null, set: (value: number | null) => void } |
  { type: 'text', get: () => string, set: (value: string) => void } |
  /**
   * Cells, or whatever else a formula can name, typed or picked from the grid. A `literal` field
   * takes plain text too, and reads as a formula only with a leading `=`. The text handed to `set`
   * is as typed, its leading `=` included. A `placeholder` says what the field stands for while it
   * is empty.
   */
  { type: 'formula', literal?: boolean, placeholder?: string, get: () => string, set: (text: string) => void } |
  { type: 'font', font: IFontStyle } |
  { type: 'fill', style: IShapeStyle } |
  { type: 'line', style: IShapeStyle }
);

export namespace FormatField {
  export interface Base {
    /** Names the field within its tab or row. */
    key: string;
    label: string;
    /** Other words the field is found by. */
    keywords?: readonly string[];
    /** A heading drawn over the field. */
    heading?: string;
    /** Fields that follow each other with one `row` are drawn side by side. */
    row?: string;
    /** Says who else the setting belongs to: a setting shared with others, not this one's alone. */
    shared?: string;
    /** A line under the field: what its value means as it stands. */
    hint?: string;
  }
}

/** One tab of a {@link FormatTarget}: a name and the fields under it, asked for when it is shown. */
export interface FormatTargetTab {
  /** Names the tab; the editor stays on a tab of the same key when its target changes. */
  key: string;
  label: string;
  fields: () => FormatField[];
}

/**
 * What a format editor formats: one thing, as the selection resolves to it, with the tabs its kind
 * of thing has.
 *
 * @remarks
 * A target is made anew whenever what it reads may have changed; its `id` says whether it is still
 * the same thing.
 */
export interface FormatTarget {
  /** Names what is formatted. Another id is another thing. */
  id: string;
  /** What is formatted, as the user knows it; omitted where the host already says. */
  title?: string;
  /** Whether nothing may be changed (a protected sheet). */
  disabled: boolean;
  tabs: readonly FormatTargetTab[];
}
