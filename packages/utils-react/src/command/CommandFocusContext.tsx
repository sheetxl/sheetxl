import { createContext, useContext } from 'react';

/**
 * A "restore focus after a command runs" callback, published by a container (e.g. a toolbar) and
 * invoked by descendant {@link useCommands} consumers on execute.
 *
 * This is the focus analogue of the enclosing-float close-on-execute (see `useFloat`): behavior
 * belongs to the **consumer/container**, discovered through context, never threaded per-button.
 * A toolbar captures the element that was focused before the toolbar took focus and, after a button
 * runs a command, returns focus there (so the grid keeps the caret). `null` ⇒ no restore.
 *
 * The callback is expected to be a stable reference (e.g. `useCallbackRef`) and to no-op when focus
 * has already left the container — so a *remote* dispatch (a keystroke from the grid) never steals it.
 */
export type CommandFocusRestore = () => void;

const CommandFocusContext = createContext<CommandFocusRestore | null>(null);

/**
 * Provides a {@link CommandFocusRestore} to descendant {@link useCommands} consumers. A container
 * that wants focus returned after its buttons execute wraps them with this.
 */
export const CommandFocusProvider = CommandFocusContext.Provider;

/** The nearest container's focus-restore callback, or `null` when none is provided. */
export function useCommandFocusRestore(): CommandFocusRestore | null {
  return useContext(CommandFocusContext);
}
