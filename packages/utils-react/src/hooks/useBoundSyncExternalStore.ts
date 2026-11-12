import { useCallback, useSyncExternalStore } from 'react';

/**
 * Like {@link useSyncExternalStore}, but for a store exposed as an **object with methods** rather than
 * standalone functions. It calls `store.subscribe(...)` and the snapshot selector **on the instance**,
 * so a normal `this`-centric class — whose methods are NOT pre-bound — works without the caller
 * detaching its methods (which would strip `this`). The model stays a plain class; the one adaptation
 * into `useSyncExternalStore`'s function-value contract lives here.
 *
 * @remarks
 * Pass the store instance and a selector that reads the snapshot off it (`s => s.getSelection()`).
 * `subscribe` is memoized on the store identity so it stays a stable reference across renders (a
 * changed `subscribe` would resubscribe); the snapshot selector may be an inline arrow. The selector
 * doubles as the SSR snapshot.
 *
 * Contrast {@link useOptionalSyncExternalStore}, which takes pre-bound standalone functions and
 * tolerates an absent (`null`) store.
 *
 * @typeParam S - The store type; must expose a `subscribe(listener)` method.
 * @typeParam T - The snapshot value type.
 */
export function useBoundSyncExternalStore<S extends { subscribe(onStoreChange: () => void): () => void }, T>(
  store: S,
  getSnapshot: (store: S) => T
): T {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => store.subscribe(onStoreChange),
    [store]
  );
  const snapshot = useCallback((): T => getSnapshot(store), [store, getSnapshot]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
