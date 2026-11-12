import { useCallback, useContext, useSyncExternalStore } from 'react';

import {
  THEME_MODE_ATTR, THEME_SURFACE_ATTR, type ThemeMode, type ThemeAttrs
} from '../theme';

import { type FloatThemeScope } from './FloatUtils';
import { SurfaceContext } from './_FloatUtils';

/**
 * The nearest `data-sxl-theme-mode` / `-surface` above an element. Read as an **external store**, not at
 * render: the attrs live on an ANCESTOR's DOM, stamped in the same commit that re-renders the caller, so a
 * render-time read sees the previous theme and nothing re-renders the caller afterwards. The store is
 * re-checked after commit and on any later attribute change.
 */
export const useElementThemeAttrs = (el: Element | null): ThemeAttrs => {
  const doc = el?.ownerDocument;
  const subscribe = useCallback((onChange: () => void): (() => void) => {
    if (!doc || typeof MutationObserver === 'undefined') return () => {};
    const observer = new MutationObserver(onChange);
    observer.observe(doc.documentElement, {
      attributes: true, subtree: true, attributeFilter: [THEME_MODE_ATTR, THEME_SURFACE_ATTR]
    });
    return () => observer.disconnect();
  }, [doc]);
  // A primitive snapshot, so an unchanged theme is never a new value.
  const getSnapshot = (): string => {
    const mode = el?.closest(`[${THEME_MODE_ATTR}]`)?.getAttribute(THEME_MODE_ATTR) ?? '';
    const surface = el?.closest(`[${THEME_SURFACE_ATTR}]`)?.getAttribute(THEME_SURFACE_ATTR) ?? '';
    return `${mode}\n${surface}`;
  };
  const [mode, surface] = useSyncExternalStore(subscribe, getSnapshot, getSnapshot).split('\n');
  const attrs: ThemeAttrs = {};
  if (mode) attrs[THEME_MODE_ATTR] = mode as ThemeMode;
  if (surface) attrs[THEME_SURFACE_ATTR] = surface;
  return attrs;
};

/**
 * The theme an element portaled out of its themed subtree opens with (THEMING-DESIGN §7): the nearest
 * `FloatProvider`'s theme scope, a React-inherited context that crosses the portal even though the cascade
 * can't.
 */
export const useFloatThemeScope = (): FloatThemeScope | undefined => {
  return useContext(SurfaceContext)?.themeScope;
};
