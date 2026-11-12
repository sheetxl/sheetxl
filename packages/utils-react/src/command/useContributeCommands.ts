import { useEffect } from 'react';

import { type ICommandDefinition } from './ICommandDefinition';
import { useCommandScope } from './CommandScopeContext';

/**
 * Contribute a set of command definitions onto the **current (ambient) scope** for the lifetime of
 * the calling component, removing them on unmount. The generic "drop a contributor" primitive (the
 * model→scope adapter, design/COMMAND-DESIGN.md): a feature builds its definitions — chrome +
 * callbacks bound to its live model — and hands them here; the **placement rule** decides which
 * scope is ambient (e.g. a grid pane scope provided by `wrapPane`).
 *
 * @remarks
 * Decoupled from any visual layer: a contributor is a **sibling that writes** to the shared scope,
 * not a wrapper. Pass a **stable** `definitions` reference (memoize on the model) — a fresh array
 * each render re-contributes. No-ops when there is no ambient scope (graceful when the grid isn't
 * running commands).
 *
 * @param definitions The (callback-bearing) definitions to contribute. Memoize by the model.
 */
export function useContributeCommands(definitions: readonly ICommandDefinition[]): void {
  const scope = useCommandScope();
  useEffect(() => {
    if (!scope) return;
    const keys: string[] = [];
    for (const def of definitions) {
      const { key, ...partial } = def;
      scope.updateCommand(key, partial);
      keys.push(key);
    }
    return () => { for (const key of keys) scope.removeCommand(key); };
  }, [scope, definitions]);
}
