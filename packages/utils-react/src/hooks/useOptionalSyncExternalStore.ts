import { useCallback, useSyncExternalStore } from 'react';

const _noopUnsubscribe = (): void => { /* no store to unsubscribe from */ };

/**
 * Like {@link useSyncExternalStore}, but for a store that may be **absent** (`null`/`undefined`).
 *
 * @remarks
 * React forbids calling `useSyncExternalStore` conditionally, so observing a sometimes-there store
 * otherwise forces per-call-site `null` sentinels (you cannot early-return, nor pass `null.subscribe`).
 * Pass the store's `subscribe` and snapshot getter — or `null`/`undefined` when there is no store;
 * returns the snapshot, or `null` when absent. The snapshot doubles as the SSR snapshot (`null` with
 * no store), keeping it SSR-safe.
 *
 * `subscribe`/`getSnapshot` MUST be **stable references** (e.g. bound class-field methods): an inline
 * arrow changes identity every render and would resubscribe each time. Reading them off a stable
 * instance via optional chaining (`store?.subscribe`) is the intended usage.
 *
 * @typeParam T - The snapshot value type.
 */
export function useOptionalSyncExternalStore<T>(
  subscribe: ((onStoreChange: () => void) => () => void) | null | undefined,
  getSnapshot: (() => T) | null | undefined
): T | null {
  const subscribeOrNoop = useCallback(
    (onStoreChange: () => void): (() => void) => (subscribe ? subscribe(onStoreChange) : _noopUnsubscribe),
    [subscribe]
  );
  const snapshotOrNull = useCallback((): T | null => (getSnapshot ? getSnapshot() : null), [getSnapshot]);
  return useSyncExternalStore(subscribeOrNoop, snapshotOrNull, snapshotOrNull);
}
