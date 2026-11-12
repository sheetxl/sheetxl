import { ExpectedError } from './Errors';

/**
 * A module failed to load — most often the network is unavailable.
 *
 * @remarks
 * The message is written for the user; the underlying failure is the `cause`.
 */
export class LazyLoadError extends ExpectedError {
  /** The key the module was defined with. */
  readonly key: string;

  constructor(key: string, options?: ErrorOptions) {
    super('This feature could not be loaded. Check your connection and try again.', options);
    this.name = 'LazyLoadError';
    this.key = key;
  }
}

/**
 * Options for {@link defineLazyModule}.
 */
export interface LazyModuleOptions<T = any, M = T> {
  /**
   * Whether {@link LazyModules.prefetch} may load the module ahead of use. Use `false` for modules
   * that are large or fetched from a third party, or a function for one that is wanted only some of
   * the time; it is asked at each prefetch.
   *
   * @defaultValue true
   */
  prefetch?: boolean | (() => boolean);
  /**
   * Picks what {@link LazyModule.load} answers from the imported module, such as one of its exports.
   * Pick here rather than in the loader: a retry imports the module again without the loader.
   *
   * @defaultValue the module itself
   */
  select?: (module: T) => M;
  /**
   * Additional attempts after a failed load before the failure is reported.
   *
   * @defaultValue 1
   */
  retries?: number;
  /**
   * Milliseconds to wait before each additional attempt.
   *
   * @defaultValue 250
   */
  retryDelay?: number;
}

/**
 * A module that is loaded on first use.
 */
export interface LazyModule<M> {
  /** Unique key, for example `'studio:sortDialog'`. */
  readonly key: string;
  /** Whether the module may be loaded ahead of use, as it is now. */
  readonly prefetch: boolean;
  /**
   * Loads the module, or returns it if it is already loaded.
   *
   * @remarks
   * Concurrent calls share one attempt. A failed attempt is not remembered, so calling again
   * tries again. Rejects with a {@link LazyLoadError}.
   */
  load(): Promise<M>;
  /**
   * The module if it has loaded, otherwise `undefined`.
   */
  peek(): M | undefined;
}

/**
 * Options for {@link LazyModules.prefetch}.
 */
export interface LazyPrefetchOptions {
  /**
   * Stops loading further modules when aborted.
   */
  signal?: AbortSignal;
  /**
   * Loads only while the browser reports a fast connection (`navigator.connection`). Where it
   * reports none, as Firefox and Safari do not, nothing is loaded.
   *
   * @defaultValue false
   */
  onlyWhenFast?: boolean;
}

const registry = new Map<string, LazyModule<unknown>>();

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The URL of the module script named by a failed `import()`, or `null` when the error does not name
 * one.
 *
 * @remarks
 * Chromium and Firefox name the URL ("Failed to fetch dynamically imported module: <url>"); Safari
 * does not.
 */
const failedImportUrl = (error: unknown): string | null => {
  const message = error instanceof Error ? error.message : '';
  const match = /dynamically imported module:?\s+(\S+)/i.exec(message);
  if (!match) return null;
  try {
    return new URL(match[1]).href;
  } catch {
    return null;
  }
};

/**
 * Imports a module script again after a failed fetch.
 *
 * @remarks
 * A browser remembers a failed module fetch for the life of the page, so importing the same URL
 * again fails without trying the network. A new query string makes it a new request.
 */
const importAgain = (url: string): Promise<any> => {
  const fresh = new URL(url);
  fresh.searchParams.set('retry', String(Date.now()));
  return import(/* webpackIgnore: true */ /* @vite-ignore */ fresh.href);
};

/** Resolves when the host is idle, so loading ahead of use does not compete with the user. */
const whenIdle = (): Promise<void> => new Promise((resolve) => {
  const requestIdle = (globalThis as any).requestIdleCallback;
  if (typeof requestIdle === 'function') {
    requestIdle(() => resolve(), { timeout: 2000 });
  } else {
    setTimeout(resolve, 0);
  }
});

/**
 * Whether the current connection allows loading ahead of use: not when offline, asked to save
 * data, or on a 2g connection, and with `onlyWhenFast` only on one the browser reports as fast.
 *
 * @remarks
 * `navigator.connection` is not available in every browser (Firefox, Safari); without it the
 * connection is unknown, which `onlyWhenFast` treats as not fast.
 */
const canPrefetch = (onlyWhenFast: boolean): boolean => {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as any);
  if (nav?.onLine === false) return false;
  const connection = nav?.connection;
  if (connection?.saveData === true) return false;
  const effectiveType: string = connection?.effectiveType ?? '';
  if (onlyWhenFast) return effectiveType === '4g';
  return !/2g$/.test(effectiveType);
};

/**
 * Defines a module that is loaded on first use.
 *
 * @param key Unique key, for example `'studio:sortDialog'`. Defining a key again replaces the
 * module defined with it.
 * @param loader Imports the module, typically `() => import('./SortDialog')`. It must resolve to the
 * module itself, with any export picked by `options.select`: after a failed fetch, the module is
 * imported again directly from the URL the browser reported.
 * @param options Selection, prefetch, and retry options.
 *
 * @remarks
 * Browsers remember a failed module fetch until the page reloads. When the browser's error names
 * the module's URL, later attempts import that URL again under a new query string, so the module
 * loads once the network is back. Where the error does not name it (Safari), a failed module loads
 * again only after a reload.
 *
 * @example
 * ```ts
 * const SortDialog = defineLazyModule('studio:sortDialog', () => import('./SortDialog'));
 * const { default: Dialog } = await SortDialog.load();
 *
 * const Chart = defineLazyModule('sdk:chart', () => import('./Chart'), { select: (m) => m.Chart });
 * ```
 */
export function defineLazyModule<T, M = T>(
  key: string,
  loader: () => Promise<T>,
  options?: LazyModuleOptions<T, M>
): LazyModule<M> {
  const prefetch = options?.prefetch ?? true;
  const select = options?.select ?? ((module: T): M => module as unknown as M);
  const retries = Math.max(0, options?.retries ?? 1);
  const retryDelay = options?.retryDelay ?? 250;

  let loaded = false;
  let value: M | undefined;
  let pending: Promise<M> | null = null;
  // The URL of the module's script, once a fetch of it has failed.
  let failedUrl: string | null = null;

  const fetchModule = async (): Promise<T> => {
    let lastError: unknown;
    for (let i = 0; i <= retries; i++) {
      if (i > 0) await wait(retryDelay);
      try {
        return failedUrl ? await importAgain(failedUrl) as T : await loader();
      } catch (error: unknown) {
        lastError = error;
        // Keep the first URL: a later failure may name one of the module's dependencies instead.
        failedUrl ??= failedImportUrl(error);
      }
    }
    throw lastError instanceof LazyLoadError ? lastError : new LazyLoadError(key, { cause: lastError });
  };
  // Outside the retries: a select that throws is a defect, not a fetch to try again.
  const attempt = async (): Promise<M> => select(await fetchModule());

  const module: LazyModule<M> = {
    key,
    get prefetch(): boolean {
      return typeof prefetch === 'function' ? prefetch() : prefetch;
    },
    load: (): Promise<M> => {
      if (loaded) return Promise.resolve(value as M);
      pending ??= attempt().then(
        (result: M) => {
          value = result;
          loaded = true;
          pending = null;
          return result;
        },
        (error: unknown) => {
          pending = null;
          throw error;
        }
      );
      return pending;
    },
    peek: (): M | undefined => value
  };
  registry.set(key, module as LazyModule<unknown>);
  return module;
}

/**
 * The modules defined with {@link defineLazyModule}.
 */
export const LazyModules = {
  /** Returns the module defined with `key`. */
  get: (key: string): LazyModule<unknown> | undefined => registry.get(key),
  /** Returns every defined module. */
  getAll: (): LazyModule<unknown>[] => Array.from(registry.values()),
  /**
   * Removes `module`, so it is no longer loaded ahead of use. A module defined since under the same
   * key is kept.
   *
   * @returns Whether `module` was removed.
   */
  remove: (module: LazyModule<unknown>): boolean => {
    if (registry.get(module.key) !== module) return false;
    return registry.delete(module.key);
  },
  /**
   * Loads every module not yet loaded, one at a time while the host is idle.
   *
   * @param options A signal to stop.
   *
   * @remarks
   * Loads nothing while offline, when the connection asks to save data, or on a 2g connection, and
   * with `onlyWhenFast` nothing unless the browser reports a fast connection.
   * Stops as soon as that changes, so call it again when the connection recovers; modules that
   * already loaded are skipped. Modules defined with `prefetch: false` are never loaded ahead of
   * use. A module that fails to load is left for its first use to retry.
   */
  prefetch: async (options?: LazyPrefetchOptions): Promise<void> => {
    const signal = options?.signal;
    const onlyWhenFast = options?.onlyWhenFast ?? false;
    const candidates = Array.from(registry.values()).filter((module) =>
      module.prefetch && module.peek() === undefined);
    for (const module of candidates) {
      if (signal?.aborted) return;
      await whenIdle();
      if (signal?.aborted) return;
      if (!canPrefetch(onlyWhenFast)) return;
      try {
        await module.load();
      } catch {
        // Left for the module's first use, which reports the failure.
      }
    }
  }
};
