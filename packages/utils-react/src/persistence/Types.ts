/**
 * Primary interface for storing retrieving key/value pairs
 */
export interface PersistenceStore {
  /**
   * Retrieves the value associated with the given key.
   *
   * @param key The key to retrieve.
   */
  getItem(key: string): string | null;
  /**
   * Sets the value for the given key.
   *
   * @param key The key to set.
   * @param value The value to associate with the key.
   */
  setItem(key: string, value: string): void;
  /**
   * Removes the value associated with the given key.
   *
   * @param key The key to remove.
   */
  removeItem(key: string): void;
  /**
   * Subscribes to external changes for cross-tab synchronization.
   *
   * @param onExternalChange Callback invoked when a key changes externally.
   *
   * @remarks
   * Not all state implementations support cross-tab subscription (may no-op)
   */
  subscribe?(onExternalChange: (changedKey: string) => void): () => void;
  /**
   * If implemented the provider will is this called when the store is ready to be used.
   *
   * @remarks
   * This is useful for avoiding flash with asynchronous stores that need to do some initialization before use.
   *
   * If this is implemented it should be called once when the store is ready.
   * If the store is already ready when called it should invoke immediately the callback synchronously.
   */
  onReady?(callback: () => void): void;
}

export type PersistenceSerializer<T=any> = {
  parse: (raw: string | null) => T;
  stringify: (val: T) => string;
};

export type PersistentStateOptions<T=any> = {
  /**
   * Convert the value to/from a string for storage
   *
   * @defaultValue JSON
   */
  serializer?: PersistenceSerializer<T>;
  version?: number; // optional per-key schema version
  migrate?: (oldValue: unknown, oldVersion: number | undefined) => T;
};


export type PersistentStateSetter<T> = (next: T | ((prev: T) => T)) => void;

export type PersistentStateProviderProps = {
  /**
   * Storage backend to use.
   *
   * @defaultValue an in-memory store, also used when there is no `window`
   */
  store?: PersistenceStore;
  /**
   * Namespace prefix for all keys
   *
   * @defaultValue none
   */
  namespace?: string;
  /**
   * Convert the value to/from a string for storage.
   *
   * @defaultValue `JSON.parse / JSON.stringify`
   */
  serializer?: PersistenceSerializer;

  /**
   * Callback invoked when the store is ready to be used.
   */
  onReady?: (callback: () => void) => void;
  /**
   * Debounce time in milliseconds for state updates.
   *
   * @defaultValue `150`
   */
  debounceMs?: number;
  /**
   * Default values by key, used for any key with no stored value.
   *
   * @remarks
   * Lets a host change the starting value of user-adjustable state without taking the choice away from
   * the user — for example, enabling the dark grid by default while the user can still turn it off.
   *
   * Keys are the same logical keys passed to `usePersistentState` (without the namespace). Values are
   * the typed values, not serialized strings. A value here wins over the default passed to
   * `usePersistentState`; a stored value wins over both. Defaults are never written to the store, so
   * changing one later applies to every user who has not made a choice.
   *
   * @defaultValue none
   */
  defaultValues?: Readonly<Record<string, unknown>>;
  // /**
  //  * Enable state to be notified across sessions. Either browser tab or
  //  * processes.
  //  *
  //  * @defaultValue `false`
  //  *
  //  * @remarks
  //  * Many storage backends do not support realtime sync.
  //  */
  // realtimeSync?: boolean;
  /**
   * Children elements that will have access to the persistence context.
   *
   * @remarks
   * Required for provider
   */
  children: React.ReactNode;
};