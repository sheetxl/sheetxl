import React, { useMemo, useRef, useEffect } from "react";

import type { PersistenceStore, PersistenceProviderProps, PersistenceSerializer } from "./Types";
import { InMemoryStore } from "./InMemoryStore";

import { PersistenceContext, Ctx } from "./_Context";

export function PersistenceStateProvider(props: PersistenceProviderProps) {
  const {
    store,
    namespace = '',
    serializer = DefaultSerializer,
    debounceMs = 0,
    crossTabSync = true,
    children,
  } = props;

  // SSR-safe: if window is missing, force Memory
  const effectiveStore = useMemo<PersistenceStore>(() => {
    if (typeof window === "undefined") return new InMemoryStore();
    return store ?? new InMemoryStore();
  }, [store]);

  const subs = useRef(new Map<string, Set<() => void>>());

  const ctx = useMemo<Ctx>(() => ({
    store: effectiveStore,
    namespace,
    serializer,
    debounceMs,
    crossTabSync,
    notify(key: string) {
      const set = subs.current.get(key);
      if (set) set.forEach((fn) => fn());
    },
    subscribeKey(key: string, fn: () => void) {
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
  }), [effectiveStore, namespace, serializer, debounceMs, crossTabSync]);

  // Cross-tab sync (if store provides a subscribe)
  useEffect(() => {
    if (!ctx.crossTabSync || !ctx.store.subscribe) return;
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