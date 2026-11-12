import { useEffect, useRef } from 'react';

import { useVisualViewportRect } from '../hooks/useVisualViewportRect';

import { isVirtualKeyboardUp } from './VirtualKeyboard';

/**
 * How a host makes room for the virtual keyboard.
 *
 * - `'float'`: the host stays as it is and never scrolls the page; what is being typed into rides
 *   the top of the keyboard in a {@link KeyboardAccessory}. For a host that is part of a page.
 * - `'resize'`: the host shrinks to the part of the screen the keyboard leaves
 *   ({@link useKeyboardResize}), so everything in it stays in view above the keyboard. For a host that
 *   is the page; in a page that scrolls it would fight the page.
 * - `'none'`: nothing; the host or the browser manages the keyboard.
 */
export type VirtualKeyboardMode = 'float' | 'resize' | 'none';

/** The room a host that is the page gives up to the virtual keyboard. See {@link useKeyboardResize}. */
export interface KeyboardResize {
  /** The height the host gives up to the keyboard, in px; `0` while the keyboard is down. */
  inset: number;
  /** How far the host moves down to stay in the visible part of the page, in px. */
  offsetTop: number;
}

const NONE: KeyboardResize = { inset: 0, offsetTop: 0 };

/**
 * The room a host that is the page makes for the virtual keyboard (the `'resize'`
 * {@link VirtualKeyboardMode}): it shrinks to the part of the screen the keyboard leaves. Apply the
 * result to the host's own box, e.g. `height: calc(100% - ${inset}px)` and
 * `transform: translateY(${offsetTop}px)`.
 *
 * @param enabled Measure only while `true`; a host in another mode pays nothing.
 *
 * @remarks
 * iOS Safari keeps the layout viewport at full height and scrolls the page instead; the visual
 * viewport is the one signal that reflects the keyboard on every platform. While the keyboard is up
 * the host gives up its height (layout minus visual), rides the visual viewport's offset so it stays
 * put while Safari scrolls the layout under it, and the page is scrolled back to the top as the
 * keyboard changes and once as it goes. Only the keyboard counts: the address bar showing or hiding
 * and a pinch zoom leave the host alone.
 *
 * Meant for a host that fills a page that does not scroll. There, Chrome's address bar never hides,
 * so the visual viewport's readings stay right; on a page that scrolls, use the `'float'` mode.
 *
 * Re-renders with the visual viewport while enabled.
 */
export const useKeyboardResize = (enabled: boolean): KeyboardResize => {
  const rect = useVisualViewportRect(enabled);
  const keyboardUp = rect ? isVirtualKeyboardUp() : false;
  const height = rect?.height;

  const refWasUp = useRef<boolean>(false);
  useEffect(() => {
    if (height === undefined) return;
    const wasUp = refWasUp.current;
    refWasUp.current = keyboardUp;
    if (!keyboardUp && !wasUp) return;
    if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
  }, [height, keyboardUp]);

  if (!rect || !keyboardUp) return NONE;
  return {
    inset: Math.max(0, Math.round(window.innerHeight - rect.height)),
    offsetTop: Math.round(rect.offsetTop)
  };
};
