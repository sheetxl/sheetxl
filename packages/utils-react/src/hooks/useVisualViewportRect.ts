import { useSyncExternalStore } from 'react';

import { getVirtualKeyboardApi } from '../virtualKeyboard/_keyboardApi';

/**
 * The part of the layout viewport that is actually visible, in CSS px.
 *
 * @remarks
 * On a phone the visual viewport is what shrinks when the virtual keyboard rises (iOS Safari never
 * resizes the layout viewport for it) and what moves when the page is pinch-zoomed or scrolled
 * under a pinned chrome. `offsetTop` / `offsetLeft` are its position within the layout viewport.
 */
export interface VisualViewportRect {
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
}

let cached: VisualViewportRect | null = null;

const viewport = (): VisualViewport | null => (typeof window !== 'undefined' ? window.visualViewport ?? null : null);

/**
 * The current {@link VisualViewportRect}, or `null` where `window.visualViewport` is unavailable.
 * Returns the same object until a value changes.
 */
export const getVisualViewportRect = (): VisualViewportRect | null => {
  const vv = viewport();
  if (!vv) return null;
  if (cached && cached.width === vv.width && cached.height === vv.height
      && cached.offsetTop === vv.offsetTop && cached.offsetLeft === vv.offsetLeft) {
    return cached;
  }
  cached = { width: vv.width, height: vv.height, offsetTop: vv.offsetTop, offsetLeft: vv.offsetLeft };
  return cached;
};

/**
 * Listen for the visual viewport resizing or scrolling, and for the browser reporting a change in a
 * keyboard that overlays the page (which leaves the visual viewport as it is).
 *
 * @returns Stops listening.
 */
export const subscribeVisualViewport = (listener: () => void): (() => void) => {
  const vv = viewport();
  const api = getVirtualKeyboardApi();
  if (!vv && !api) return () => {};
  vv?.addEventListener('resize', listener);
  vv?.addEventListener('scroll', listener);
  api?.addEventListener('geometrychange', listener);
  return (): void => {
    vv?.removeEventListener('resize', listener);
    vv?.removeEventListener('scroll', listener);
    api?.removeEventListener('geometrychange', listener);
  };
};

const noSubscribe = (): (() => void) => () => {};
const noRect = (): null => null;

/**
 * The visual viewport's size and offset, re-rendering as it changes. `null` on the server, in a
 * browser without `window.visualViewport`, or while `enabled` is `false`.
 *
 * @param enabled Subscribe only while `true`; a component that needs the rect in one configuration
 *   (the studio with its formula bar at the bottom) pays nothing in the others.
 *
 * @remarks
 * The signal behind a chrome that must stay above the virtual keyboard: the rect's `height` is the
 * room left once the keyboard is up, and `offsetTop` is how far the browser has moved the visible
 * part under a layout that did not shrink.
 */
export const useVisualViewportRect = (enabled: boolean = true): VisualViewportRect | null => {
  return useSyncExternalStore(
    enabled ? subscribeVisualViewport : noSubscribe,
    enabled ? getVisualViewportRect : noRect,
    noRect
  );
};
