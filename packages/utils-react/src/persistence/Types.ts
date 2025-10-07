/**
 * Primary interface for storing retrieving key/value pairs
 */
export interface PersistenceStore {
  /**
   * Retrieves the value associated with the given key.
   *
   * @param key The key to retrieve.
   */
  getItem(key: string): Promise<string | null>;
  /**
   * Sets the value for the given key.
   *
   * @param key The key to set.
   * @param value The value to associate with the key.
   */
  setItem(key: string, value: string): Promise<void>;
  /**
   * Removes the value associated with the given key.
   *
   * @param key The key to remove.
   */
  removeItem(key: string): Promise<void>;
  /**
   * Subscribes to external changes for cross-tab synchronization.
   *
   * @param onExternalChange Callback invoked when a key changes externally.
   *
   * @remarks
   * Not all state implementations support cross-tab subscription (may no-op)
   */
  subscribe?(onExternalChange: (changedKey: string) => void): () => void;
}

export type PersistenceSerializer<T=any> = {
  parse: (raw: string | null) => T;
  stringify: (val: T) => string;
};

export type PersistenceStateOptions<T=any> = {
  /**
   * Convert the value to/from a string for storage
   *
   * @defaultValue JSON
   */
  serializer?: PersistenceSerializer<T>;
  version?: number; // optional per-key schema version
  migrate?: (oldValue: unknown, oldVersion: number | undefined) => T;
  // If true, don't write default until explicitly set
  // TODO - remove this as it's not that useful
  lazy?: boolean;
};


export type PersistenceStateSetter<T> = (next: T | ((prev: T) => T)) => void;

export type PersistenceProviderProps = {
  /**
   * Storage backend to use
   */
  store: PersistenceStore;
  /**
   * Namespace prefix for all keys
   *
   * @defaultValue none
   */
  namespace?: string;
  serializer?: PersistenceSerializer;            // defaults to JSON
  debounceMs?: number;                // default 0 (no debounce)
  crossTabSync?: boolean;             // default true when supported
  /**
   * Children elements that will have access to the persistence context.
   *
   * @remarks
   * Required for provider
   */
  children: React.ReactNode;
};