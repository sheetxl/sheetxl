/**
 * A single entry on the application's edit-mode bus: the interaction currently in effect — for
 * example editing a cell, a copy/cut marquee, or a fill/drag gesture.
 *
 * @typeParam T - The shape of {@link EditMode.args}, the mode-specific payload.
 *
 * @remarks
 * Exactly one `EditMode` is active at a time, or none (idle). A feature signals that its interaction
 * has begun by publishing an `EditMode`, and clears it when the interaction ends. See
 * {@link EditModeHandler} for how the bus is read and written.
 */
export interface EditMode<T=any> {
  /**
   * Stable identifier for the kind of interaction (e.g. `'edit'`, `'copy'`, `'fill'`). Consumers
   * switch on this to recognize a mode they care about.
   */
  key: string;
  /**
   * Human-readable label for the mode, shown to the user (e.g. in the status bar). When omitted, the
   * UI falls back to its idle text.
   */
  description?: string;
  /**
   * Mode-specific payload for consumers that need more than the {@link EditMode.key} — for example a
   * handle to the live editor during a cell edit, or flags describing a clipboard operation.
   */
  args?: T;
  /**
   * Cursor to show while the mode is active (any CSS cursor value), e.g. `'crosshair'` for a fill
   * drag. Applied by whichever surface owns the pointer.
   */
  cursor?: string;
  /**
   * Runs when the user cancels the mode from chrome (the status bar's ✕ beside the description); the
   * publisher ends the mode. Supply the same action the mode's Escape takes. When omitted, the chrome
   * offers no cancel for the mode.
   */
  cancel?: () => void;
  /**
   * Runs when the user completes the mode from chrome (the status bar's ✓ beside the description):
   * the publisher performs the mode's action and ends the mode. Supply the same action the mode's
   * Enter takes (commit an edit, paste a marquee). When omitted, the chrome offers no complete for
   * the mode; a gesture that completes on its own release (a drag) has none.
   */
  done?: () => void;
  /**
   * Invoked when this mode is replaced (or cleared), receiving the incoming mode or `null`. Use it
   * to tear down anything the mode set up — e.g. a copy mode clears the clipboard when it is
   * superseded.
   */
  onModeChange?: (newMode: EditMode | null) => void;
}

/**
 * Publishes a new mode onto the bus, replacing whatever was active. Accepts a mode (or `null` to
 * clear), or an updater that receives the current mode — the same shape as a React state setter.
 */
export type SetEditMode = (value: EditMode | null | ((prev: EditMode | null) => EditMode | null)) => void;

/**
 * Read/write access to the global edit-mode bus.
 */
export interface EditModeHandler {
  /**
   * Publish (or clear) the active mode. Replacing a mode fires the previous mode's
   * {@link EditMode.onModeChange}.
   */
  setMode: SetEditMode;

  /**
   * The mode currently in effect, or `null` when idle.
   */
  getMode: () => EditMode | null;
}
