import { useCallback, useSyncExternalStore } from 'react';

const _noopUnsubscribe = (): void => { /* no store to unsubscribe from */ };

/**
 * Like {@link useBoundSyncExternalStore}, but for a store that may be **absent** (`null`/`undefined`)
 * — the bound-method analog of {@link useOptionalSyncExternalStore}. It calls `store.subscribe(...)`
 * and the snapshot selector **on the instance**, so a normal `this`-centric class whose methods are
 * NOT pre-bound works without the caller detaching them (which would strip `this`); returns the
 * snapshot, or `null` when there is no store.
 *
 * @remarks
 * Pass the store instance (or `null`/`undefined`) and a selector that reads the snapshot off it
 * (`s => s.getState()`). `subscribe` is memoized on the store identity so it stays a stable reference
 * across renders; the snapshot selector may be an inline arrow. The `null` snapshot doubles as the
 * SSR snapshot, keeping it SSR-safe.
 *
 * @typeParam S - The store type; must expose a `subscribe(listener)` method.
 * @typeParam T - The snapshot value type.
 */
export function useOptionalBoundSyncExternalStore<S extends { subscribe(onStoreChange: () => void): () => void }, T>(
  store: S | null | undefined,
  getSnapshot: (store: S) => T
): T | null {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => (store ? store.subscribe(onStoreChange) : _noopUnsubscribe),
    [store]
  );
  const snapshot = useCallback((): T | null => (store ? getSnapshot(store) : null), [store, getSnapshot]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
