import { type PersistenceStore } from "./Types";

/** In-memory state (default fallback / SSR-safe) */
export class InMemoryStore implements PersistenceStore {
  private store = new Map<string, string>();

  /** {@inheritDoc PersistenceStore.getItem} */
  getItem(k: string) { return this.store.get(k) ?? null; }
  /** {@inheritDoc PersistenceStore.setItem} */
  setItem(k: string, v: string) { this.store.set(k, v); }
  /** {@inheritDoc PersistenceStore.removeItem} */
  removeItem(k: string) { this.store.delete(k); }
}