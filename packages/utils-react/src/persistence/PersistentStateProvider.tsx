import { useMemo, useRef, useEffect } from "react";

import { type PersistenceStore, type PersistentStateProviderProps, type PersistenceSerializer } from "./Types";
import { InMemoryStore } from "./InMemoryStore";

import { PersistenceContext, EmptyDefaultValues, type Ctx } from "./_Context";

export function PersistentStateProvider(props: PersistentStateProviderProps) {
  const {
    store,
    namespace = '',
    serializer = DefaultSerializer,
    debounceMs = 150,
    defaultValues = EmptyDefaultValues,
    // realtimeSync = false,
    children,
  } = props;

  // Hosts pass `defaultValues` as an inline literal; keep the previous object while its entries are
  // unchanged so the context (and every hook under it) doesn't churn on each render.
  const refDefaultValues = useRef(defaultValues);
  if (!shallowEqual(refDefaultValues.current, defaultValues)) refDefaultValues.current = defaultValues;
  const stableDefaultValues = refDefaultValues.current;

  // SSR-safe: if window is missing, force Memory
  const effectiveStore = useMemo<PersistenceStore>(() => {
    if (typeof window === "undefined") return new InMemoryStore();
    return store ?? new InMemoryStore();
  }, [store]);

  const subs = useRef(new Map<string, Set<(value?: string) => void>>());

  const ctx = useMemo<Ctx>(() => ({
    store: effectiveStore,
    namespace,
    serializer,
    debounceMs,
    defaultValues: stableDefaultValues,
    // realtimeSync,
    onReady: (callback: () => void) => {
      if (!effectiveStore.onReady) {
        callback();
        return;
      }
      effectiveStore.onReady?.(callback);
    },
    notify(key: string, value?: string) {
      const set = subs.current.get(key);
      if (set) set.forEach((fn) => fn(value));
    },
    subscribeKey(key: string, fn: (value?: string) => void) {
      const m = subs.current;
      const set = m.get(key) ?? new Set<() => void>();
      set.add(fn);
      m.set(key, set);
      return () => {
        const s = m.get(key);
        if (!s) return;
        s.delete(fn);
        if (s.size === 0) m.delete(key);
      };
    },
  }), [effectiveStore, namespace, serializer, debounceMs, stableDefaultValues]); // realtimeSync

  // Realtime sync (if store provides a subscribe)
  useEffect(() => {
    // if (!ctx.realtimeSync || !ctx.store.subscribe) return;
    if (!ctx.store.subscribe) return;
    return ctx.store.subscribe((changedFullKey) => {
      // Only notify our namespace keys
      if (!changedFullKey.startsWith(ctx.namespace + ":")) return;
      const k = changedFullKey.slice(ctx.namespace.length + 1);
      ctx.notify(k);
    });
  }, [ctx]);

  return (
    <PersistenceContext.Provider value={ctx}>
      {children}
    </PersistenceContext.Provider>
  );
}

const DefaultSerializer: PersistenceSerializer = {
  parse: (r) => (r == null ? null : JSON.parse(r)),
  stringify: JSON.stringify
};

const shallowEqual = (a: Readonly<Record<string, unknown>>, b: Readonly<Record<string, unknown>>): boolean => {
  if (a === b) return true;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && Object.is(a[k], b[k]));
};
