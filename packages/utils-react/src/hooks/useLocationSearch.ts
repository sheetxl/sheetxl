import { useSyncExternalStore } from 'react';

const HISTORY_EVENT = 'sxl-history-change';

let historyPatched = false;

/**
 * `pushState` / `replaceState` fire no event, so wrap them (once) to announce themselves. Done on first
 * subscription rather than at import, so merely loading the package leaves `window.history` alone.
 */
const patchHistory = (): void => {
  if (historyPatched) return;
  historyPatched = true;
  const history = window.history;
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method];
    history[method] = function (this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event(HISTORY_EVENT));
      return result;
    };
  }
};

const subscribe = (onChange: () => void): (() => void) => {
  patchHistory();
  window.addEventListener('popstate', onChange);
  window.addEventListener(HISTORY_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(HISTORY_EVENT, onChange);
  };
};

const getSearch = (): string => window.location.search;
const getServerSearch = (): string => '';

/**
 * The page URL's query string (`window.location.search`, including the leading `?`, or `''`).
 *
 * @remarks
 * Re-renders on back/forward navigation and on `history.pushState` / `replaceState`. Always `''` when
 * rendered on a server.
 */
export function useLocationSearch(): string {
  return useSyncExternalStore(subscribe, getSearch, getServerSearch);
}
