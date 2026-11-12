import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type PersistentStateOptions, type PersistentStateSetter } from "./Types";
import { usePersistenceContext, DefaultSerializer } from "./_Context";

/**
 * Persisted state hook backed by the current persistence context.
 *
 * This works like `useState`, but:
 *
 * - The value is persisted under `namespace:key` using the current store.
 * - With no stored value, it uses the provider's `defaultValues[key]` if present, otherwise `defaultValue`.
 *   Defaults are never written to the store; only values passed to `setState` are.
 * - Then it **hydrates asynchronously** from the configured store
 *   (memory, localStorage, IndexedDB, remote, etc.). Hydration is *seeding*: a value written with
 *   `setState` while the read is still in flight is newer, so it wins and the read is discarded.
 * - Writes are **debounced** according to `debounceMs` from the context.
 * - Optional **versioning + migration** lets you evolve stored shapes over time.
 *
 * ### Optional persistence
 *
 * If `key` is `null`, **persistence is disabled** and the hook behaves like
 * a plain `useState` with the same `defaultValue` semantics:
 *
 * - No reads or writes go to the persistence store.
 * - No cross-tab / cross-hook subscription is set up.
 * - `clear()` simply resets back to `defaultValue` (or `undefined`).
 *
 * @typeParam T - Type of the stored value.
 * @param key - Logical storage key; use `null` to disable persistence entirely.
 * @param defaultValue - Value used when nothing is stored and the provider has no default for `key`; a
 *   function is called lazily to produce it.
 * @param opts - Options controlling serialization, versioning, and migration.
 * @returns A tuple of `[state, setState, clear]`:
 * - `state` – The current value.
 * - `setState(next)` – Updates the value and persists it (unless `key === null`).
 * - `clear()` – Removes the persisted value and resets to the default.
 *
 * Like `useState`'s setter, `setState` and `clear` keep a stable identity across renders, so they are
 * safe in dependency lists.
 */
export function usePersistentState<T = unknown>(
  key: string | null,
  defaultValue?: T | (() => T),
  opts: PersistentStateOptions<T> = DefaultOptions
): [T, PersistentStateSetter<T>, () => void] {
  const {
    store,
    namespace,
    serializer: serializerContext,
    debounceMs,
    subscribeKey,
    notify,
    defaultValues,
  } = usePersistenceContext();

  const serializer = opts.serializer ?? serializerContext ?? DefaultSerializer;
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fullKey = useMemo(
    () => (key == null ? null : `${namespace}:${key}`),
    [namespace, key]
  );

  const versionKey = fullKey ? `${fullKey}::v` : null;

  // The provider's default for this key wins over the call site's (which supports a lazy initializer).
  const evalDefault = (): T => {
    if (key != null && Object.prototype.hasOwnProperty.call(defaultValues, key)) {
      return defaultValues[key] as T;
    }
    const dv = defaultValue;
    return typeof dv === "function" ? (dv as () => T)() : (dv as T);
  };

  const [state, setState] = useState<T>(() => {
    // If persistence is disabled, just use default.
    if (fullKey == null) {
      return evalDefault();
    }
    // if ready.
    let itemString: string | null = store.getItem(fullKey);
    if (itemString == null) return evalDefault();

    let retValue: T;
    try {
      retValue = serializer.parse(itemString);
    } catch {
      // ignore corrupt data and fall back to default
      retValue = evalDefault();
    }
    return retValue;
  });

  // Mirror of `state` so `set` can compute functional updates and run side effects (persist/notify)
  // *outside* a setState updater — updaters must be pure (no setState on other components in render).
  const stateRef = useRef(state);
  stateRef.current = state;

  /* Raised by any local write (`set` / `clear`), lowered when a hydrate read starts. The hydrate
     below issues its read and then awaits, so anything written before it resolves is NEWER than
     what that read returns — dropping the read is how a caller's write survives. Without it the
     stale read silently reverts the write (a lost update), which is invisible on a synchronous
     store holding what you expected and glaring on a slow one. */
  const refWroteDuringRead = useRef(false);

  // If key changes to null, reset to default (no persistence)
  useEffect(() => {
    if (fullKey == null) {
      setState(evalDefault());
    }
  }, [fullKey]);

  // Hydrate async (covers all drivers and handles version/migration)
  useEffect(() => {
    if (fullKey == null) return; // no-op when persistence is disabled

    let mounted = true;
    // Lowered per read, not once per mount: the effect re-runs on a key/store change, and that read
    // should only ignore writes racing IT.
    refWroteDuringRead.current = false;
    (async () => {
      const [raw, vRaw] = await Promise.all([
        store.getItem(fullKey),
        versionKey ? store.getItem(versionKey) : Promise.resolve(null),
      ]);

      /* A local write beat the read home, so the read is stale. Bail before the branches below and
         not just before the `setState`: the migration path WRITES, and would put the value the
         caller just replaced back into the store. */
      if (!mounted || refWroteDuringRead.current) return;

      let next: any;
      try {
        next = raw == null ? undefined : serializer.parse(raw);
      } catch {
        // ignore corrupt data and fall back to default/migration
      }

      const storedVersion =
        vRaw == null ? undefined : Number.parseInt(vRaw, 10);

      if (next === undefined) {
        /* No stored value: show the default but don't write it. A written default is indistinguishable
           from a user's choice, so a later change to the default (or a host's `defaultValues`) would
           never reach anyone who had loaded the app once. */
        next = evalDefault();
      } else if (
        opts.version != null &&
        storedVersion !== undefined &&
        storedVersion !== opts.version &&
        opts.migrate
      ) {
        // Migrate stored value to new version
        const migrated = opts.migrate(next, storedVersion);
        next = migrated;
        store.setItem(fullKey, serializer.stringify(next));
        if (versionKey) {
          store.setItem(versionKey, String(opts.version));
        }
      }

      if (!mounted) return;
      if (next !== undefined) setState(next);
    })();

    return () => {
      mounted = false;
    };
  }, [store, fullKey, versionKey, opts.version, opts.migrate, serializer, defaultValues]);

  // Keep other hooks in the same tab in sync
  useEffect(() => {
    if (fullKey == null || key == null) return;

    return subscribeKey(key, (value?: string) => {
      // In-tab sync passes the new value directly; cross-tab (storage event) re-reads the store.
      const raw = value !== undefined ? value : store.getItem(fullKey);
      if (raw == null) return;
      try {
        setState(serializer.parse(raw));
      } catch {
        // ignore corrupt data
      }
    });
  }, [store, fullKey, subscribeKey, key, serializer]);

  const persist = (value: T) => {
    if (fullKey == null) return; // no-op when persistence is disabled
    store.setItem(fullKey, serializer.stringify(value));
    if (opts.version != null && versionKey) {
      store.setItem(versionKey, String(opts.version));
    }
  };

  const set: PersistentStateSetter<T> = (next: T | ((prev: T) => T)) => {
    const val = typeof next === "function" ? (next as (p: T) => T)(stateRef.current) : next;
    refWroteDuringRead.current = true;
    stateRef.current = val;
    setState(val);

    if (debRef.current) clearTimeout(debRef.current);
    if (debounceMs > 0) {
      debRef.current = setTimeout(() => {
        void persist(val);
      }, debounceMs);
    } else {
      void persist(val);
    }

    // Sync other hooks on this key (Zustand-like) with the value directly. Done outside the setState
    // updater so it never updates another component during render; the durable write stays debounced.
    if (key != null) notify(key, serializer.stringify(val));
  };

  const clear = () => {
    refWroteDuringRead.current = true;
    if (debRef.current) clearTimeout(debRef.current);

    if (fullKey != null) {
      void store.removeItem(fullKey);
      if (versionKey != null) {
        void store.removeItem(versionKey);
      }
    }

    const next =
      defaultValue !== undefined ? (evalDefault() as T) : (undefined as unknown as T);
    setState(next);
  };

  // Cleanup on unmount (cancel pending debounced write)
  useEffect(() => {
    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, []);

  // Stable wrappers over the per-render closures (which read the current key, store and serializer).
  const refSet = useRef(set);
  refSet.current = set;
  const refClear = useRef(clear);
  refClear.current = clear;
  const stableSet = useCallback<PersistentStateSetter<T>>((next) => refSet.current(next), []);
  const stableClear = useCallback(() => refClear.current(), []);

  return [state as T, stableSet, stableClear];
}

const DefaultOptions: PersistentStateOptions<any> = {};
