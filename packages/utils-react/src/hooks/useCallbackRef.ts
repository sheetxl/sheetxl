import { useRef, useCallback, type DependencyList } from 'react';

/**
 * A callback with a **stable identity** that always runs the latest closure — like `useCallback`,
 * except that a change in `deps` does NOT change the returned function. Pass it to memoized
 * children, effect dependency lists or long-lived subscriptions (a command contribution's `data`,
 * a model listener) without re-running them whenever the closure's inputs change.
 *
 * This is the "latest ref" pattern (React's `useEvent` RFC; ahooks' `useMemoizedFn`; Radix's
 * `useCallbackRef`).
 *
 * Usage notes:
 * - **List every value the callback reads in `deps`.** The closure is only refreshed when `deps`
 *   change, so a missing dependency means the stable function calls a stale closure.
 * - **Call it from events and deferred work, not during render.** Its identity never changes, so
 *   a component that reads its result while rendering is not re-rendered when the inputs change.
 * - **For logic called only from an effect,** React's own `useEffectEvent` (React 19.2+) is the
 *   standard alternative. It cannot be passed to children or called during render, which this hook
 *   allows.
 *
 * @param callback - The function to wrap; `null`/`undefined` yields a function returning `undefined`.
 * @param deps - Every value `callback` closes over.
 */
export const useCallbackRef = <T extends (...args: any[]) => any>(callback: T | null | undefined, deps: DependencyList): T => {
  // Implementation notes, for whoever hardens this (callers would not change):
  // - The ref is written during render. Under concurrent rendering a discarded render can leave it
  //   pointing at a closure from a render that never committed, until the next commit overwrites
  //   it. The strict form assigns it in `useInsertionEffect` (or `useLayoutEffect`).
  // - The common form of this pattern takes no deps and assigns the raw `callback` every render,
  //   which removes the missing-dependency trap above. Ignoring `deps` here would be compatible.
  // - The `!refCB.current` branch below never runs: the ref is assigned just before it.
  const cbCurrent = useCallback((...args: any) => {
    return callback?.(...args);
  }, deps);

  const refCB = useRef<any>(null);
  refCB.current = cbCurrent;

  const stableCB = useCallback((...args: any) => {
    return refCB.current?.(...args);
  }, []);

  if (!refCB.current)
   return undefined as unknown as T;
  return stableCB as T;
}