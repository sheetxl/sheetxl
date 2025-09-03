/**
 * Describes the state of an edit mode. Some examples are:
 * * insert
 * * overwrite
 * * copy (with args for cut, format)
 */
export interface EditMode<T=any> {
  /**
   * A unique key for the edit mode.
   */
  key: string;
  /**
   * A human readable description of the edit mode.
   */
  description?: string;
  /**
   * Optional arguments
   */
  args?: T;
  /**
   * A cursor to use when the edit mode is active.
   */
  cursor?: string;
  /**
   * Called when the edit mode is replaced.
   * The newMode is passed in if there is one.
   */
  onModeChange?: (newMode: EditMode | null) => void;
}

export type SetEditMode = (value: EditMode | ((prev: EditMode) => EditMode)) => void;

export interface EditModeHandler {
  // add listener to prevent mode from changing.
  setMode: SetEditMode;

  getMode: () => EditMode;
}