import { createContext, useContext } from 'react';

import { type PersistentStateProviderProps, type PersistenceSerializer } from './Types';
import { InMemoryStore } from './InMemoryStore';

export type Ctx = Required<Omit<PersistentStateProviderProps, 'children'>> & {
  // lightweight pub/sub so multiple hooks in one tab stay in sync. `value` (serialized) is passed
  // for in-tab set notifications; omitted for cross-tab (storage) events where subscribers re-read.
  notify(key: string, value?: string): void;
  subscribeKey(key: string, fn: (value?: string) => void): () => void;
};

export const PersistenceContext = createContext<Ctx | null>(null);

export const EmptyDefaultValues: Readonly<Record<string, unknown>> = Object.freeze({});

export const DefaultSerializer: PersistenceSerializer = {
  parse: (r: string | null) => (!r ? null : JSON.parse(r)),
  stringify: JSON.stringify
}

// Module-level pub/sub for the default (no `PersistentStateProvider` mounted) context. Without this,
// `notify`/`subscribeKey` were no-ops, so a write in one hook never reached another hook on the same key
// in the same tab — e.g. an appearance toggle owned by a command bridge would not update the studio that
// reads the same key, so the dark-mode toggle "didn't apply" in hosts that mount no provider. `DefaultStore`
// is a module singleton (one shared `InMemoryStore` + one registry), so all default-context hooks stay in sync.
const _defaultSubs = new Map<string, Set<(value?: string) => void>>();

const DefaultStore: Ctx = {
  store: new InMemoryStore(),
  namespace: '',
  serializer: DefaultSerializer,
  onReady: (callback: () => void) => { callback(); }, // immediately ready
  debounceMs: 0,
  defaultValues: EmptyDefaultValues,
  // realtimeSync: false,
  notify: (key: string, value?: string) => {
    const set = _defaultSubs.get(key);
    if (set) set.forEach((fn) => fn(value));
  },
  subscribeKey: (key: string, fn: (value?: string) => void) => {
    const set = _defaultSubs.get(key) ?? new Set<(value?: string) => void>();
    set.add(fn);
    _defaultSubs.set(key, set);
    return () => {
      const s = _defaultSubs.get(key);
      if (!s) return;
      s.delete(fn);
      if (s.size === 0) _defaultSubs.delete(key);
    };
  },
};

export function usePersistenceContext() {
  const c = useContext(PersistenceContext);
  if (!c) return DefaultStore;
  return c;
}
