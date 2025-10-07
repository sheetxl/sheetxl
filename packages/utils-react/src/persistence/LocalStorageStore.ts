import { PersistenceStore } from "./Types";

/** LocalStorage state with cross-tab sync */
export class LocalStorageStore implements PersistenceStore {
  constructor(private storage: Storage = window.localStorage) {}

  /** {@inheritDoc PersistenceStore.getItem} */
  async getItem(k: string) {
    try { return this.storage.getItem(k); } catch { return null; }
  }

  /** {@inheritDoc PersistenceStore.setItem} */
  async setItem(k: string, v: string) {
    try { this.storage.setItem(k, v); } catch { /* quota/full */ }
  }

  /** {@inheritDoc PersistenceStore.removeItem} */
  async removeItem(k: string) {
    try { this.storage.removeItem(k); } catch {}
  }

  /** {@inheritDoc PersistenceStore.subscribe} */
  subscribe?(onExternalChange: (changedKey: string) => void) {
    const h = (e: StorageEvent) => {
      if (e.storageArea === this.storage && e.key) onExternalChange(e.key);
    };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }
}
