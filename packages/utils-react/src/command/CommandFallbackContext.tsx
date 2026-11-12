import { createContext, useContext, type ReactNode } from 'react';

/**
 * A container's **not-in-context fallback** prefer-list — the priority names a consumer (a toolbar / menu)
 * uses to show a command whose scope isn't currently contributing (design/COMMAND-DESIGN.md §"Named
 * scopes"). `null` ⇒ this subtree does **no** fallback (a bare `useCommands` returns `undefined` for a
 * not-in-context key). An empty array ⇒ fallback is on, but with no preference — straight to "search all".
 *
 * This is purely a **consumer** concern: it never touches the resolver/dispatcher/registry core. The
 * keyboard dispatcher, which reads none of this, stays a pure context resolver (an inert static never
 * binds a shortcut — an idle editor's F4 falls to `redo`).
 */
export const CommandFallbackContext = createContext<readonly string[] | null>(null);

/** The nearest container's fallback prefer-list, or `null` if this subtree has no fallback. */
export function useCommandFallback(): readonly string[] | null {
  return useContext(CommandFallbackContext);
}

const EMPTY: readonly string[] = [];

export interface CommandFallbackProviderProps {
  /**
   * Priority names searched first on a not-in-context miss (then **all** names). Omit ⇒ fallback on with no
   * preference (straight to "search all"). Pass a **stable** reference (memoize/const) — a new array each
   * render re-runs consumers.
   */
  prefer?: readonly string[];
  children: ReactNode;
}

/**
 * Turn on the not-in-context fallback for descendant {@link useCommands} consumers — so a toolbar under it
 * shows a not-currently-contributed command **disabled** (from its static default) instead of blank. See
 * {@link CommandScope.resolveStatic} for the resolution primitive it drives.
 */
export function CommandFallbackProvider({ prefer, children }: CommandFallbackProviderProps): ReactNode {
  return <CommandFallbackContext.Provider value={prefer ?? EMPTY}>{children}</CommandFallbackContext.Provider>;
}
