import { useState, useMemo } from 'react';

import { singletonHook } from '../singletonHook';

import { type EditMode, type EditModeHandler, type SetEditMode } from '@sheetxl/utils';

/* Until a component reads the bus (`useEditMode` mounts it), nothing would show a mode, so a write
   is dropped: a headless edit (a test, a script) publishes into nothing. */
let globalSetMode: React.Dispatch<React.SetStateAction<EditMode | null>> = () => {};

// The bus is `null` when idle.
const useEditModeGlobal = singletonHook<EditMode | null>(null, () => {
  const [editMode, setEditMode] = useState<EditMode | null>(null);
  globalSetMode = setEditMode;
  return editMode;
});

/**
 * Publish (or clear) the active {@link EditMode} on the app-wide bus **without a hook** — the same
 * write {@link useEditMode}'s `setMode` performs (fires the superseded mode's
 * {@link EditMode.onModeChange}), callable from plain (non-React) code.
 *
 * @remarks
 * Exists so a non-component owner — e.g. the cell {@link IEditable} publishing its active session —
 * can drive the bus from anywhere, not only where a hook happens to be mounted. Reads (and the React
 * subscription) still go through {@link useEditMode}; this is write-only. Before any component has
 * called {@link useEditMode} there is no bus, and the write is dropped.
 */
export const setEditMode: SetEditMode = (mode: EditMode | null | ((prev: EditMode | null) => EditMode | null)): void => {
  globalSetMode((prev: EditMode | null): EditMode | null => {
    if (typeof mode === 'function') {
      mode = mode(prev);
    }
    prev?.onModeChange?.(mode ?? null);
    return mode;
  });
};

/** A way out of a mode: {@link EditMode.done} or {@link EditMode.cancel}. */
export type EditModeExit = 'done' | 'cancel';

const exitListeners = new Set<(mode: EditMode, exit: EditModeExit) => void>();

/**
 * Take a way out of a mode from chrome (the status bar's ✓ / ✕): tells the
 * {@link subscribeEditModeExit} listeners, then runs the mode's own `done` or `cancel`.
 *
 * @remarks
 * A way out is the user finishing the interaction, which is more than the mode ending: an edit also
 * ends when Enter moves on to the next cell. A feature that follows the user rather than the mode (the
 * virtual keyboard going down) listens here, so the chrome needs no knowledge of it.
 */
export const exitEditMode = (mode: EditMode, exit: EditModeExit): void => {
  exitListeners.forEach((listener) => listener(mode, exit));
  if (exit === 'done') mode.done?.();
  else mode.cancel?.();
};

/**
 * Listen for a way out of a mode taken from chrome (see {@link exitEditMode}). Called before the
 * mode's own `done` or `cancel` runs.
 *
 * @returns Stops listening.
 */
export const subscribeEditModeExit = (listener: (mode: EditMode, exit: EditModeExit) => void): (() => void) => {
  exitListeners.add(listener);
  return () => { exitListeners.delete(listener); };
};

/**
 * Access the application's **edit-mode bus** — the single, app-wide signal describing the
 * interaction currently in effect.
 *
 * @returns An {@link EditModeHandler} exposing `getMode()` and `setMode()`.
 *
 * @remarks
 * At any moment the application is in exactly one interaction mode, or none (idle). The bus holds a
 * single {@link EditMode} (`{ key, description?, args?, cursor?, cancel?, done?, onModeChange? }`),
 * and every part of the app reads from and writes to that one value.
 *
 * It exists so unrelated features can coordinate **without depending on one another**. A feature
 * announces that its interaction has started by publishing a mode, and clears it when finished;
 * other features react to the change. The bus is the decoupling layer between them.
 *
 * Typical **publishers** (set a mode while their interaction is active):
 * - cell editing — a single `key: 'edit'`, exposing the live editor handle (`IEditable`) via
 *   {@link EditMode.args}`.editable`. The fine-grained enter-vs-edit distinction lives on that
 *   handle's session, not on the bus key (the status-bar label is carried in
 *   {@link EditMode.description}, refreshed by the publisher when it flips);
 * - the copy / cut marquee — `key: 'copy'` / `'cut'`;
 * - fill and drag-move/copy gestures — `key: 'fill'` / `'drag…'`, with a {@link EditMode.cursor};
 * - the format painter.
 *
 * Typical **consumers** (read the active mode):
 * - the status bar, which shows {@link EditMode.description} (and its idle label when there is none),
 *   with a ✕ and a ✓ that take the mode's ways out ({@link exitEditMode}) when the mode carries them;
 * - the grid, which applies {@link EditMode.cursor};
 * - features that must defer to another interaction — e.g. fill is suppressed while a cell is being
 *   edited — by inspecting the active {@link EditMode.key}.
 *
 * Publishing a mode **replaces** the previous one and invokes its {@link EditMode.onModeChange}, so a
 * mode can clean up when it is superseded (for instance, starting an edit supersedes a copy marquee,
 * which then clears the clipboard).
 *
 * The bus is a singleton — one instance per application, reachable from anywhere without
 * prop-threading. It is backed by `singletonHook`, so a `SingletonHooksContainer` must be mounted in
 * the tree.
 *
 * @example
 * ```ts
 * const editMode = useEditMode();
 *
 * // Publish a mode while an interaction is active, then clear it when done.
 * editMode.setMode({ key: 'fill', description: 'Drag to fill', cursor: 'crosshair' });
 * editMode.setMode(null);
 *
 * // React to the active mode.
 * const mode = editMode.getMode();
 * const isEditing = mode?.key === 'edit';
 * ```
 */
export const useEditMode = () => {
  const globalMode = useEditModeGlobal();
  const handler:EditModeHandler = useMemo(() => {
    return {
      setMode: setEditMode,
      getMode: () => {
        return globalMode;
      }
    }
  }, [globalMode]);

  return handler;
}