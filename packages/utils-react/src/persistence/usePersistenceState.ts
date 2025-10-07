import { useEffect, useMemo, useRef, useState } from "react";

import type { PersistenceStateOptions, PersistenceStateSetter } from "./Types";
import { usePersistenceContext, DefaultSerializer } from "./_Context";

export function usePersistenceState<T = unknown>(
  key: string,
  defaultValue?: T | (() => T),
  opts: PersistenceStateOptions<T> = DefaultOptions
): [T, PersistenceStateSetter<T>, () => void] {
  const { store, namespace, serializer: serializerContext, debounceMs, subscribeKey } = usePersistenceContext();
  const serializer = opts.serializer ?? serializerContext ?? DefaultSerializer;

  const fullKey = useMemo(() => `${namespace}:${key}`, [namespace, key]);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // We'll stash version in a sibling meta key
  const versionKey = `${fullKey}::v`;

  const [state, setState] = useState<T>(() => {
    // SSR / first render: try sync read (may be Memory or LocalStorage)
    // If it fails, fall back to defaultValue
    let initial: T | undefined;
    try {
      // NOTE: store.getItem is async; we do a best effort for Memory/LocalStorage by peeking at window.localStorage if available.
      if (typeof window !== "undefined" && "localStorage" in window && fullKey.startsWith(namespace)) {
        const raw = (window as any).localStorage?.getItem(fullKey) ?? null;
        if (raw != null) initial = serializer.parse(raw) as T;
      }
    } catch {}
    if (initial === undefined) {
      const dv = defaultValue;
      return typeof dv === "function" ? (dv as any)() : (dv as T | undefined);
    }
    return initial!;
  });

  // Hydrate async (covers non-local drivers and grabs version/migration)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [raw, vRaw] = await Promise.all([
        store.getItem(fullKey),
        store.getItem(versionKey),
      ]);
      let next: any;
      try {
        next = raw == null ? undefined : serializer.parse(raw);
      } catch {}
      const storedVersion = vRaw == null ? undefined : Number.parseInt(vRaw, 10);

      if (next === undefined) {
        if (!opts.lazy && defaultValue !== undefined) {
          const dv = typeof defaultValue === "function" ? (defaultValue as any)() : defaultValue;
          next = dv;
          await store.setItem(fullKey, serializer.stringify(next));
          if (opts.version != null) await store.setItem(versionKey, String(opts.version));
        }
      } else if (
        opts.version != null &&
        storedVersion !== undefined &&
        storedVersion !== opts.version &&
        opts.migrate
      ) {
        const migrated = opts.migrate(next, storedVersion);
        next = migrated;
        await store.setItem(fullKey, serializer.stringify(next));
        await store.setItem(versionKey, String(opts.version));
      }
      if (!mounted) return;
      if (next !== undefined) setState(next);
    })();
    return () => { mounted = false; };
  }, [store, fullKey, versionKey, opts.version, opts.migrate, opts.lazy]);

  // Keep other hooks in the same tab in sync
  useEffect(() => subscribeKey(key, async () => {
    const raw = await store.getItem(fullKey);
    if (raw == null) return;
    try { setState(serializer.parse(raw)); } catch {}
  }), [store, fullKey, subscribeKey, key]);

  const persist = async (value: T) => {
    await store.setItem(fullKey, serializer.stringify(value));
    if (opts.version != null) await store.setItem(versionKey, String(opts.version));
  };

  const set: PersistenceStateSetter<T> = (next: T | ((prev: T) => T)) => {
    setState((prev) => {
      const val = typeof next === "function" ? (next as any)(prev) : next;
      if (debRef.current) clearTimeout(debRef.current);
      if (debounceMs > 0) {
        debRef.current = setTimeout(() => { persist(val); }, debounceMs);
      } else {
        void persist(val);
      }
      return val;
    });
  };

  const clear = () => {
    if (debRef.current) clearTimeout(debRef.current);
    void store.removeItem(fullKey);
    void store.removeItem(versionKey);
    if (defaultValue !== undefined) {
      const dv = typeof defaultValue === "function" ? (defaultValue as any)() : defaultValue;
      setState(dv as T);
    } else {
      setState(undefined as unknown as T);
    }
  };

  return [state as T, set, clear];
}

const DefaultOptions: PersistenceStateOptions<any> = {};