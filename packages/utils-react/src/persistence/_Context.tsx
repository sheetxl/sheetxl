import React, { createContext, useContext } from "react";

import type { PersistenceProviderProps, PersistenceSerializer } from "./Types";
import { InMemoryStore } from "./InMemoryStore";

export type Ctx = Required<Omit<PersistenceProviderProps, "children">> & {
  // lightweight pub/sub so multiple hooks in one tab stay in sync
  notify(key: string): void;
  subscribeKey(key: string, fn: () => void): () => void;
};

export const PersistenceContext = createContext<Ctx | null>(null);

export const DefaultSerializer: PersistenceSerializer = {
  parse: (r: string | null) => (!r ? null : JSON.parse(r)),
  stringify: JSON.stringify
}

const DefaultStore: Ctx = {
  store: new InMemoryStore(),
  namespace: '',
  serializer: DefaultSerializer,
  debounceMs: 0,
  crossTabSync: false,
  notify: () => {},
  subscribeKey: () => () => {},
};

export function usePersistenceContext() {
  const c = useContext(PersistenceContext);
  if (!c) return DefaultStore;
  return c;
}
