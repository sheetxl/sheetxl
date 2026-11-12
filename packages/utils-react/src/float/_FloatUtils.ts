import { createContext } from 'react';

import { TimerUtils } from '@sheetxl/utils';

import { type FloatReference, type FloatReferenceKey } from './useFloatStack';
import { type FloatSurface } from './FloatUtils';

export const DEFAULT_OPEN_DELAY = 120;
export const DEFAULT_CLOSE_DELAY = 60; // DEFAULT_OPEN_DELAY / 2
export const DEFAULT_CLOSE_OTHER_DELAY = 360; // DEFAULT_OPEN_DELAY * 3

/**
 * Backing context for {@link useFloatSurface} / {@link FloatProvider}. Internal: consumers read the
 * ambient surface via the hook and set it via the provider, never the context directly.
 */
export const SurfaceContext = createContext<FloatSurface | null>(null);

interface DebouncedFloat {
  fn: any;
  setReferences: Set<FloatReference>;
  isClose: boolean;
}

/**
 * The root float.
 *
 * In addition to being a {@link FloatReference}, the root owns the shared
 * runtime state for its tree: the open-child map, the float registry, and the
 * single in-flight debounce. Every float reaches it via
 * {@link FloatReference.getRoot}.
 *
 * Previously this was a set of module-level singletons; making the root the
 * state holder (seeded by {@link FloatProvider}, or a shared default) removes
 * the multi-instance / SSR hazard and the app-wide single debounce.
 */
export interface FloatRoot extends FloatReference {
  /** parent key -> currently open child key */
  readonly floatByParents: Map<FloatReferenceKey, FloatReferenceKey>;
  /** float key -> live reference (registered/open floats) */
  readonly statesByMovables: Map<FloatReferenceKey, FloatReference>;
  /** the single in-flight open/close debounce, if any */
  lastDebounced: DebouncedFloat | null;

  /**
   * Debounces an open/close. Only one float transition is in flight at a time;
   * scheduling a new one cancels the previous.
   */
  debounce(delay: number | null, fn: () => any, setReferences: Set<FloatReference>, isClose: boolean): () => any;
  /** The currently open child of `reference`, if any. */
  getChildRef(reference: FloatReference): FloatReference | null;
  /** `reference` plus its full open-child chain. */
  descendants(reference: FloatReference | null): Set<FloatReference>;
  /** Record `reference` as showing a popup; the result records that it stopped. */
  addOpenPopup(reference: FloatReference): () => void;
  /** Whether a popup is showing that `enclosing` is not inside (`null` is inside none). */
  isPopupOpenOutside(enclosing: FloatReference | null): boolean;
  /** Called as popups show and stop showing. */
  subscribeOpenPopups(listener: () => void): () => void;
}

/**
 * Creates an isolated root float (a {@link FloatReference} that also holds the
 * shared state for its tree).
 */
export const createFloatRoot = (): FloatRoot => {
  const collectDescendants = (set: Set<FloatReference>, reference: FloatReference | null): void => {
    if (reference === null)
      return;
    set.add(reference);
    const child = root.floatByParents.get(reference.key);
    if (!child)
      return;
    const childState = root.statesByMovables.get(child);
    if (!childState)
      return;
    collectDescendants(set, childState);
  };

  const openPopups = new Set<FloatReference>();
  const openPopupListeners = new Set<() => void>();
  const notifyOpenPopups = (): void => { openPopupListeners.forEach((listener) => listener()); };

  const root: FloatRoot = {
    key: { label: 'root' },
    isRoot: true,
    parent: null,
    open: (): void => {},
    close: (_delay?: number): Promise<void> | null => { return null },
    closeChild: (_delay?: number): Promise<void> | null => { return null },
    onChildVisible: () => {},
    onChildHidden: () => {},
    // Close the whole open chain by closing the root's open child; closing it
    // cascades to its own descendants. Mirrors `closeAllFloat` in useFloatStack,
    // but callable directly on the root (e.g. on webview focus loss).
    closeAll: (): Promise<void> | null => {
      const childKey = root.floatByParents.get(root.key);
      if (!childKey)
        return null;
      return root.statesByMovables.get(childKey)?.close(0) ?? null;
    },
    floatElement: () => null,
    anchorElement: () => null,
    getRoot: () => root,

    floatByParents: new Map<FloatReferenceKey, FloatReferenceKey>(),
    statesByMovables: new Map<FloatReferenceKey, FloatReference>(),
    lastDebounced: null,

    debounce(delay: number | null = null, fn: () => any, setReferences: Set<FloatReference>, isClose: boolean): () => any {
      if (root.lastDebounced) {
        root.lastDebounced.fn.clear();
        root.lastDebounced = null;
      }
      if (delay === 0)
        return fn;
      if (delay === null)
        delay = DEFAULT_OPEN_DELAY;
      const debouncedFn = TimerUtils.debounce(() => {
        return fn();
      }, delay);
      root.lastDebounced = { fn: debouncedFn, setReferences, isClose };
      return root.lastDebounced.fn;
    },
    getChildRef(reference: FloatReference): FloatReference | null {
      const child = root.floatByParents.get(reference.key);
      if (!child)
        return null;
      return root.statesByMovables.get(child) || null;
    },
    descendants(reference: FloatReference | null): Set<FloatReference> {
      const setRet = new Set<FloatReference>();
      collectDescendants(setRet, reference);
      return setRet;
    },
    addOpenPopup(reference: FloatReference): () => void {
      openPopups.add(reference);
      notifyOpenPopups();
      return () => {
        openPopups.delete(reference);
        notifyOpenPopups();
      };
    },
    isPopupOpenOutside(enclosing: FloatReference | null): boolean {
      for (const popup of openPopups) {
        let inside = false;
        for (let float = enclosing; float && !inside; float = float.parent) inside = float === popup;
        if (!inside) return true;
      }
      return false;
    },
    subscribeOpenPopups(listener: () => void): () => void {
      openPopupListeners.add(listener);
      return () => { openPopupListeners.delete(listener); };
    }
  };
  return root;
};
