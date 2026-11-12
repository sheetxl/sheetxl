import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

import { type RemoveListener } from '@sheetxl/utils';

import { useFloat } from '../float/FloatStackContext';

import { QUICK_ACTION_TAG } from './tags';
import { useCommandResolver } from './CommandAnchorProvider';
import { useCommandFallback } from './CommandFallbackContext';
import { useCommandFocusRestore } from './CommandFocusContext';
import { type ResolvedCommand, type ExecuteHook } from './createResolvedCommand';

/**
 * Per-key execute observation (ripple/close). `onExecute` fires for every dispatch of the
 * command — `cmd.execute()`, a sibling, or a keystroke.
 */
export interface UseCommandsListener<STATE = any, CONTEXT = any, ARGS = any>
  extends ExecuteHook<STATE, CONTEXT, ARGS> {
  /**
   * Not invoked. The resolver already re-renders subscribers on any command property change
   * (via its version); this member is retained for source compatibility only.
   * @deprecated Rely on the re-render instead.
   */
  onChange?(command: ResolvedCommand<STATE, CONTEXT, ARGS>): void;
}

/**
 * Subscribe to one or more commands by key, resolved by the nearest container's
 * {@link CommandResolver} (its anchor + cadence — set by {@link CommandAnchorProvider}, not
 * here). Returns the **resolved** commands (re-rendering when the resolver re-emits), and
 * wires `listener` for per-key execute observation (ripple/close), which fires **immediately**
 * for every dispatch path. A button just calls `cmd.execute()`.
 */
export function useCommands<STATE = any, CONTEXT = any, ARGS = any>(
  commandIds: string | readonly string[],
  listener?: UseCommandsListener<STATE, CONTEXT, ARGS>
): Array<ResolvedCommand<STATE, CONTEXT, ARGS> | undefined> {
  const resolver = useCommandResolver();
  // Not-in-context fallback (a container may enable it — see `CommandFallbackProvider`). `null` ⇒ no
  // fallback (a not-in-context key stays `undefined`); non-null ⇒ on a miss, resolve the static by name
  // (this `prefer` list first, then all) so a toolbar shows the command disabled instead of blank.
  const fallback = useCommandFallback();

  // Memoize on the id *content*, not the array identity. Callers routinely pass a fresh array literal
  // (`useCommands([key], hook)`), so keying on the array would recompute `ids` every render → the
  // `subscribe` callback below would change identity every render → `useSyncExternalStore` would tear
  // down and re-add the subscription (incl. the execute observer) on every render. That churn both wastes
  // work and opens a race: an execute-triggered re-render can remove the observer during the `await` in
  // `execute()` before `onExecute` fires (ripple/close lost). A stable `ids` registers the subscription
  // once and keeps it. (NUL separator — can't appear in a command key.)
  const idsKey = Array.isArray(commandIds) ? commandIds.join('\u0000') : String(commandIds);
  const ids = useMemo(
    () => (Array.isArray(commandIds) ? [...commandIds] : [commandIds]) as readonly string[],
    [idsKey] // keyed on content, not `commandIds` identity (see above)
  );

  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  // The enclosing popup float (if this command surface is rendered inside one). Ref'd so the observer reads
  // the live value without re-subscribing. Used to auto-dismiss menus on execute (see the hook below).
  const float = useFloat();
  const floatRef = useRef(float);
  floatRef.current = float;

  // The enclosing container's focus-restore (e.g. a toolbar returning focus to the grid after a button
  // runs). Ref'd for the same reason as `float`. Fires after a successful execute; no-ops off-container.
  const focusRestore = useCommandFocusRestore();
  const focusRestoreRef = useRef(focusRestore);
  focusRestoreRef.current = focusRestore;

  const subscribe = useCallback((onStoreChange: () => void): (() => void) => {
    if (!resolver) return () => {};
    const removers: RemoveListener[] = [];
    // Re-render when the resolver re-emits (anchor or contribution changed, at its cadence).
    removers.push(resolver.subscribe(onStoreChange));
    // Per-key execute observation (ripple/close) — registry-level, never debounced.
    const hook: ExecuteHook<STATE, CONTEXT, ARGS> = {
      beforeExecute: (c, a) => {
        const explicit = listenerRef.current?.beforeExecute;
        // A command hinted as a quick action (increase/decrease size, indent, decimals…) applies in place
        // and must NEVER dismiss the popup it was pressed in. We must NOT delegate to `explicit` here: a
        // surface inside a toolbar sees the toolbar's ambient float, and closing THAT closes the popup we
        // are trying to keep open. The hint rides the resolved command, so every observer of the key
        // agrees — see `QUICK_ACTION_TAG`.
        if (c?.getTags?.()?.includes(QUICK_ACTION_TAG)) return;
        // Otherwise: a surface with its own `beforeExecute` controls its dismissal (e.g. a context menu whose
        // hook calls `closeAll()`) — delegate and do nothing else. With no hook, when this surface is inside a
        // popup float, dismiss it on execute (menus/galleries auto-close, no per-item wiring). Close-before-
        // execute (execute awaits us first) so a command that opens a NEW float survives.
        if (explicit) return explicit(c, a);
        // `closeAll()` returns null when there's nothing to close — normalize to undefined so the
        // hook's return type (no `| null`) is satisfied; both mean "no async barrier, proceed".
        return floatRef.current?.closeAll() ?? undefined;
      },
      onExecute: (c, a) => {
        listenerRef.current?.onExecute?.(c, a);
        // Container-level focus restore (toolbar → grid). No-ops when focus already left the container,
        // so a remote dispatch never steals focus back.
        focusRestoreRef.current?.();
      },
      onError: (c, e, a) => listenerRef.current?.onError?.(c, e, a)
    };
    const idsLength = ids.length;
    for (let i = 0; i < idsLength; i++) {
      removers.push(resolver.scope.addExecuteListener(ids[i], hook));
    }
    return () => { for (const remove of removers) remove(); };
  }, [resolver, ids]);

  const version = useSyncExternalStore(
    subscribe,
    () => (resolver ? resolver.getVersion() : 0),
    () => 0
  );

  return useMemo(() => {
    if (!resolver) return ids.map(() => undefined);
    return ids.map((id) => {
      const resolved = resolver.resolve<STATE, CONTEXT, ARGS>(id);
      // In context ⇒ use it. Otherwise, if a container enabled the fallback, resolve the static by name so
      // the surface can still render it (disabled, or executable if the static carries a global callback).
      if (resolved) return resolved;
      if (fallback) return resolver.scope.resolveStatic<STATE, CONTEXT, ARGS>(id, fallback);
      return undefined;
    });
    // `version` drives re-resolution; resolve/resolveStatic are memoized so refs stay stable
    // until a real per-key change.
  }, [resolver, ids, version, fallback]);
}
