import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import clsx from 'clsx';

import { useIsomorphicLayoutEffect } from '../hooks/useMeasure';
import { useFullscreenPortal } from '../utils';
import { zIndexVar, type ThemeAttrs } from '../theme';
import { floatThemeScopeProps } from '../float/FloatUtils';
import { useElementThemeAttrs, useFloatThemeScope } from '../float/_FloatTheme';

import { isVirtualKeyboardUp } from './VirtualKeyboard';
import { getVirtualKeyboardApi } from './_keyboardApi';

/** How long the visual viewport must be still before a floating accessory shows, in ms. */
const SETTLE_MS = 150;
/** The fade-in once it does, in ms. */
const FADE_MS = 150;

// The top edge of the accessory riding the keyboard, for content that must stay above it. One at a
// time: only the focused one floats.
let accessoryTop: number | null = null;
let accessoryOwner: object | null = null;
const accessoryListeners = new Set<() => void>();
const publishAccessoryTop = (owner: object, top: number | null): void => {
  if (top === null && accessoryOwner !== owner) return;
  if (accessoryTop === top && accessoryOwner === owner) return;
  accessoryTop = top;
  accessoryOwner = top === null ? null : owner;
  accessoryListeners.forEach(listener => listener());
};

/**
 * The top edge of the {@link KeyboardAccessory} showing on the keyboard, in client px (the coordinates
 * `getBoundingClientRect` reads), or `null` while none shows. Content under that line is covered: the
 * keyboard and the accessory both sit below it.
 */
export const getKeyboardAccessoryTop = (): number | null => accessoryTop;

/**
 * Listen for {@link getKeyboardAccessoryTop} changing: an accessory settling on the keyboard, moving
 * with it, or going away.
 *
 * @returns Stops listening.
 */
export const subscribeKeyboardAccessoryTop = (listener: () => void): (() => void) => {
  accessoryListeners.add(listener);
  return (): void => { accessoryListeners.delete(listener); };
};

/**
 * Props for {@link KeyboardAccessory}.
 */
export interface KeyboardAccessoryProps {
  /**
   * Whether the content rides the top of the virtual keyboard. While `false` it stays mounted but
   * hidden, so a field inside keeps its focus and its keyboard across the change.
   */
  floating: boolean;
  /**
   * The element the accessory stands in for, in the page: its theme mode and surface are carried onto
   * the accessory when no float provider supplies a theme.
   */
  anchor?: Element | null;
  /**
   * Called as the accessory shows and hides, after it has settled: an in-page twin fades the other
   * way, so the content looks to have moved.
   */
  onShownChange?: (shown: boolean) => void;
  /**
   * Called when the keyboard goes away while floating (the Android back gesture, the keyboard's own
   * hide key, Safari's Done), so the owner can end what the keyboard was for.
   */
  onKeyboardClose?: () => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Content that rides the top of the virtual keyboard: a bar of a page-level portal, placed from the
 * visual viewport (the part of the page the keyboard leaves visible).
 *
 * @remarks
 * CSS cannot pin anything to the visual viewport (`position: fixed` pins to the layout viewport, which
 * the keyboard does not shrink on iOS, nor on Chrome by default), and script placement runs a frame
 * behind the browser's own scroll, zoom and address-bar animation. So:
 *
 * - **Hidden while anything moves.** A visual viewport resize or scroll, or a page scroll, hides it at
 *   once; once nothing has moved for a moment it is placed on the keyboard and fades in.
 * - **Parked at the top of the visible area while hidden.** A focused field the browser sees under the
 *   keyboard's edge makes it pan the page to reveal it, and mid-pan the visual viewport's readings do
 *   not match the screen. Parked at the top, the field is always in view.
 * - **Undoes pinch zoom**, so it stays the size of the screen.
 * - **Placed by the browser where it can.** Where the browser offers the VirtualKeyboard API (Chromium,
 *   in a secure context), the keyboard overlays the page while the accessory floats, and the accessory
 *   sits on `env(keyboard-inset-height)`. The visual viewport is wrong in one state there: Chrome
 *   bringing its address bar back as the keyboard rises on a scrolled page reports the visible area as
 *   if the bar were still hidden, which would put the accessory behind the keyboard. Elsewhere (iOS
 *   Safari, Firefox) it is placed from the visual viewport.
 *
 * Its top edge is published through {@link getKeyboardAccessoryTop} while it shows. It never scrolls
 * the page.
 *
 * Inside an iframe the visual viewport is the iframe's, so the accessory rides the iframe's bottom.
 * A floating or split keyboard, or a hardware one, does not shrink the visual viewport: the accessory
 * sits at the bottom of the visible area, and no keyboard close is reported.
 */
export const KeyboardAccessory = forwardRef<HTMLDivElement, KeyboardAccessoryProps>(
  (props: KeyboardAccessoryProps, refForwarded) => {
  const { floating, anchor = null, onShownChange, onKeyboardClose, className, style, children } = props;

  // Held as state: the portal's container can change after the first render (the shared portal root
  // is provisioned lazily), and React then mounts the content in a new element. The placement follows
  // the element, not the first one it saw.
  const [element, setElementState] = useState<HTMLDivElement | null>(null);
  const setElement = useCallback((next: HTMLDivElement | null): void => {
    setElementState(next);
    if (typeof refForwarded === 'function') refForwarded(next);
    else if (refForwarded) refForwarded.current = next;
  }, [refForwarded]);

  const refFloating = useRef(floating);
  refFloating.current = floating;
  const refCallbacks = useRef({ onShownChange, onKeyboardClose });
  refCallbacks.current = { onShownChange, onKeyboardClose };
  // The placement's handle on a change of `floating`, set up by the placement effect.
  const refOnFloatingChange = useRef<(() => void) | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!element || typeof window === 'undefined') return undefined;
    const owner = {};
    let frame = 0;
    let settle = 0;
    let moving = false;
    let shown = false;
    // The layout height before the keyboard, and whether it has been seen up since floating began.
    let baseline = window.innerHeight;
    let seenUp = false;

    // Where the browser offers it (Chromium, secure context), the keyboard overlays the page while this
    // floats, and the browser places the accessory on it: no measurements of ours. The visual
    // viewport's are wrong in one state (Chrome bringing its address bar back as the keyboard rises on
    // a scrolled page reports the visible area as if the bar were still hidden). Only while this
    // floats, so the host's own fields keep the browser's usual behavior.
    const api = getVirtualKeyboardApi();
    let overlay = false;
    const setOverlay = (on: boolean): void => {
      if (!api || on === overlay) return;
      overlay = on;
      api.overlaysContent = on;
    };

    const show = (next: boolean): void => {
      if (next === shown) return;
      shown = next;
      element.style.opacity = next ? '1' : '0';
      element.style.pointerEvents = next ? 'auto' : 'none';
      if (!next) publishAccessoryTop(owner, null);
      refCallbacks.current.onShownChange?.(next);
    };

    const place = (): void => {
      frame = 0;
      const vv = window.visualViewport;
      const scale = vv?.scale ?? 1;
      const visibleTop = vv?.offsetTop ?? 0;
      const visibleHeight = vv?.height ?? window.innerHeight;
      const ride = refFloating.current && !moving;
      if (ride && overlay) {
        if (vv && scale > 1.01) {
          // Pinch-zoomed: `env()` is in the page's own pixels, so the page's zoom would magnify the bar
          // and carry it off the visible area. Placed on the visible area instead, the zoom undone; the
          // keyboard overlays it, so its height is the browser's report, not the visible area's.
          const keyboard = api!.boundingRect.height;
          element.style.bottom = 'auto';
          element.style.top = `${visibleTop + visibleHeight - (keyboard + element.offsetHeight) / scale}px`;
          element.style.left = `${vv.offsetLeft}px`;
          element.style.width = `${vv.width * scale}px`;
          element.style.transform = `scale(${1 / scale})`;
        } else {
          element.style.top = 'auto';
          element.style.bottom = 'env(keyboard-inset-height, 0px)';
          element.style.left = '0px';
          element.style.width = '100%';
          element.style.transform = '';
        }
        element.style.transition = `opacity ${FADE_MS}ms ease-out`;
        show(true);
        publishAccessoryTop(owner, element.getBoundingClientRect().top);
        return;
      }
      const top = ride ? visibleTop + visibleHeight - element.offsetHeight / scale : visibleTop;
      element.style.bottom = 'auto';
      element.style.top = `${top}px`;
      element.style.left = `${vv?.offsetLeft ?? 0}px`;
      element.style.width = `${(vv?.width ?? window.innerWidth) * scale}px`;
      element.style.transform = scale !== 1 ? `scale(${1 / scale})` : '';
      if (ride) {
        element.style.transition = `opacity ${FADE_MS}ms ease-out`;
        show(true);
        publishAccessoryTop(owner, top);
      } else {
        element.style.transition = 'none';
        show(false);
      }
    };
    const schedule = (): void => {
      if (!frame) frame = requestAnimationFrame(place);
    };

    const hideUntilStill = (): void => {
      if (!refFloating.current) return;
      moving = true;
      element.style.transition = 'none';
      show(false);
      clearTimeout(settle);
      settle = window.setTimeout(() => {
        moving = false;
        place();
      }, SETTLE_MS);
    };

    const onMove = (): void => {
      hideUntilStill();
      schedule();
    };

    const onViewportResize = (): void => {
      onMove();
      if (!refFloating.current) return;
      if (isVirtualKeyboardUp(baseline)) {
        seenUp = true;
        return;
      }
      if (!seenUp) return;
      seenUp = false;
      refCallbacks.current.onKeyboardClose?.();
    };

    // A rotation changes the layout height the keyboard is measured against; read it once it settles.
    const onOrientation = (): void => {
      seenUp = false;
      window.setTimeout(() => {
        if (!isVirtualKeyboardUp()) baseline = window.innerHeight;
      }, 300);
    };

    refOnFloatingChange.current = (): void => {
      setOverlay(refFloating.current);
      if (refFloating.current) {
        baseline = window.innerHeight;
        seenUp = false;
        // Wait for the keyboard to finish rising, rather than show where it is about to cover.
        hideUntilStill();
      } else {
        clearTimeout(settle);
        moving = false;
      }
      schedule();
    };

    // The content's own size changes (a field growing by a line) move its top, but nothing else did.
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    resizeObserver?.observe(element);

    // Overlay before the keyboard rises for a field in here: set in the focus itself, not a render later.
    const onFocusIn = (): void => setOverlay(true);
    const onFocusOut = (e: FocusEvent): void => {
      if (!refFloating.current && !element.contains(e.relatedTarget as Node | null)) setOverlay(false);
    };
    element.addEventListener('focusin', onFocusIn);
    element.addEventListener('focusout', onFocusOut);
    api?.addEventListener('geometrychange', onViewportResize);

    const vv = window.visualViewport;
    vv?.addEventListener('resize', onViewportResize);
    vv?.addEventListener('scroll', onMove);
    window.addEventListener('scroll', onMove, { passive: true });
    window.addEventListener('resize', onMove);
    window.addEventListener('orientationchange', onOrientation);
    // Mounted floating: wait for stillness like any other start, rather than show at once.
    if (refFloating.current) refOnFloatingChange.current();
    place();
    return (): void => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      resizeObserver?.disconnect();
      vv?.removeEventListener('resize', onViewportResize);
      vv?.removeEventListener('scroll', onMove);
      window.removeEventListener('scroll', onMove);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('orientationchange', onOrientation);
      element.removeEventListener('focusin', onFocusIn);
      element.removeEventListener('focusout', onFocusOut);
      api?.removeEventListener('geometrychange', onViewportResize);
      setOverlay(false);
      refOnFloatingChange.current = null;
      publishAccessoryTop(owner, null);
      if (shown) refCallbacks.current.onShownChange?.(false);
    };
  }, [element]);

  useEffect(() => {
    refOnFloatingChange.current?.();
  }, [floating]);

  // Carry the theme across the portal (THEMING-DESIGN §7), as a float does: the provider's scope, else
  // the anchor's own mode and surface.
  const themeScope = useFloatThemeScope();
  const anchorAttrs = useElementThemeAttrs(anchor);
  const { className: themeClassName, attrs: providerAttrs } = floatThemeScopeProps(themeScope);
  const themeAttrs: ThemeAttrs = themeClassName || Object.keys(providerAttrs).length > 0 ? providerAttrs : anchorAttrs;

  const { getPortalContainer } = useFullscreenPortal();
  // The shared portal root is removed when its last user lets go, even for a moment (a remount), and a
  // new one made on the next call. Content left in the removed one is out of the page, where a field
  // cannot take focus: render again, into the current root.
  const [, setReconnect] = useState<number>(0);
  useEffect(() => {
    if (element && !element.isConnected) setReconnect((n: number) => n + 1);
  });
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={setElement}
      className={clsx('sxl-keyboard-accessory', themeClassName, className)}
      {...themeAttrs}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        boxSizing: 'border-box',
        transformOrigin: 'top left',
        zIndex: zIndexVar('grid'),
        opacity: 0,
        pointerEvents: 'none',
        ...style
      }}
    >
      {children}
    </div>,
    getPortalContainer()
  );
});

KeyboardAccessory.displayName = 'KeyboardAccessory';
