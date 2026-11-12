import { createContext, useContext } from 'react';

import { type CommandRegistry } from './CommandRegistry';

/**
 * The flat named {@link CommandRegistry} (the static catalog) for one mounted command host, provided
 * near the command root. The counterpart of the scope tree's *dynamic* contributions: the registry
 * holds the instance-independent presentation (icon/label/shortcut/tags) every feature seeds.
 */
export const CommandRegistryContext = createContext<CommandRegistry | null>(null);

/**
 * The ambient {@link CommandRegistry}, or `null` outside a provider.
 *
 * Prefer this over `scope.getRoot().getRegistry()`: the registry is a **container** concern, reached
 * by context like {@link useCommandButtonRegistry}, not by walking the scope tree to its root. A
 * feature provider reads it to seed its static chrome; it never needs the root scope to do so.
 */
export function useCommandRegistry(): CommandRegistry | null {
  return useContext(CommandRegistryContext);
}
