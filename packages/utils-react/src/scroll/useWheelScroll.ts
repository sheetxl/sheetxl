import { useRef, useEffect, type RefObject } from 'react';

import { type TopLeft } from '@sheetxl/utils';

import { useCallbackRef } from '../hooks';

import { getWheelOwner } from './wheelOwner';

export interface UseWheelScrollOptions {
  /**
   * When `false`, the listener is not attached.
   * @defaultValue true
   */
  enabled?: boolean;
  /**
   * Apply a scroll delta — one axis at a time, matching the wheel's dominant direction.
   */
  onScrollBy: (delta: Partial<TopLeft>) => void;
  /**
   * Intercept hook. Return `false` to consume the event (skip scrolling).
   */
  onWheelScroll?: (event: globalThis.WheelEvent) => boolean | void;
  /**
   * ctrl/⌘+wheel ⇒ zoom. Receives the frame's accumulated `deltaY` in PIXELS (`deltaMode` lines and
   * pages are normalized) and the last event's client focal point. Coalesced to one call per
   * animation frame — a touchpad pinch arrives as dozens of ctrl+wheel events a second. When not
   * provided, a ctrl+wheel falls through to {@link onWheelScroll} and scrolling as any other wheel.
   */
  onZoomBy?: (deltaY: number, clientX: number, clientY: number) => void;
}

/** `deltaMode` 1 (lines): Firefox's unit. Chrome's pixel notch is 100 and Firefox's line notch is 3. */
const LINE_PX = 100 / 3;
/** `deltaMode` 2 (pages). */
const PAGE_PX = 800;

/**
 * Attach a non-passive `wheel` listener to `ref` that translates wheel deltas into single-axis
 * scroll deltas (shift ⇒ horizontal, rAF-coalesced to one per frame) and applies them via
 * `onScrollBy`; a ctrl/⌘+wheel goes to `onZoomBy` instead (also one per frame). Returns the handler
 * (for imperative reuse).
 *
 * @remarks
 * Lives here (not in the grid) so the ScrollPane owns wheel alongside touch.
 *
 * A wheel over an element inside `ref` that can still scroll that way (`overflow: auto` or `scroll`)
 * is left to the browser, which scrolls that element. At its end the wheel passes on to the pane,
 * unless the element sets `overscroll-behavior: contain`, which keeps it. Mark an element that
 * scrolls on the pane's behalf with `PANE_SCROLLER_ATTRIBUTE` (`ScrollUtils`).
 */
export const useWheelScroll = (
  ref: RefObject<HTMLElement | null>,
  options: UseWheelScrollOptions
): ((event: globalThis.WheelEvent) => void) => {
  const { enabled = true, onScrollBy, onWheelScroll, onZoomBy } = options;
  const scrollBy = useCallbackRef(onScrollBy, [onScrollBy]);
  const wheelScroll = useCallbackRef(onWheelScroll ?? (() => {}), [onWheelScroll]);
  const zoomBy = useCallbackRef(onZoomBy ?? (() => {}), [onZoomBy]);
  const hasZoom = useRef<boolean>(!!onZoomBy);
  hasZoom.current = !!onZoomBy;
  const refWheelDelta = useRef<number>(null);
  // The zoom frame: accumulated pixel delta + the latest focal point, flushed once per frame.
  const refZoomFrame = useRef<number>(null);
  const refZoomAccum = useRef<{ deltaY: number; clientX: number; clientY: number }>({ deltaY: 0, clientX: 0, clientY: 0 });

  const handleWheel = useCallbackRef((event: globalThis.WheelEvent) => {
    /* If user presses shift key, scroll horizontally */
    const isScrollingHorizontally = event.shiftKey;
    const { deltaX, deltaY, deltaMode } = event;
    const isZoom = hasZoom.current && !isScrollingHorizontally && (event.ctrlKey || event.metaKey);

    // A scrolling element inside the pane (a list in a drawing) takes the wheel first, as it would
    // outside one; the pane scrolls only once nothing under the pointer can.
    if (!isZoom && ref.current) {
      const owner = getWheelOwner(event, ref.current);
      if (owner === 'native') return;
      if (owner === 'contained') {
        event.preventDefault();
        return;
      }
    }

    /* Prevent browser back in Mac (and the browser's own page zoom on ctrl+wheel) */
    event.preventDefault();

    if (isZoom) {
      const unit = deltaMode === 1 ? LINE_PX : (deltaMode === 2 ? PAGE_PX : 1);
      const accum = refZoomAccum.current;
      accum.deltaY += deltaY * unit;
      accum.clientX = event.clientX;
      accum.clientY = event.clientY;
      if (refZoomFrame.current) return;
      refZoomFrame.current = window.requestAnimationFrame(() => {
        refZoomFrame.current = null;
        const { deltaY: dy, clientX, clientY } = refZoomAccum.current;
        refZoomAccum.current.deltaY = 0;
        if (dy !== 0) zoomBy(dy, clientX, clientY);
      });
      return;
    }

    /* Coalesce to one scroll per frame */
    if (refWheelDelta.current) return;

    const retIntercept = wheelScroll?.(event);
    if (retIntercept === false) return;

    let dx = isScrollingHorizontally ? deltaY : deltaX;
    let dy = deltaY;
    /* Scroll only in one direction */
    const isHorizontal = isScrollingHorizontally || Math.abs(dx) > Math.abs(dy);
    if (deltaMode === 1) {
      dy = dy * 0; // Note - what is deltaMode
    }

    refWheelDelta.current = window.requestAnimationFrame(() => {
      refWheelDelta.current = null;
      scrollBy(isHorizontal ? { left: dx } : { top: dy });
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
      if (refWheelDelta.current) {
        window.cancelAnimationFrame(refWheelDelta.current);
        refWheelDelta.current = null;
      }
      if (refZoomFrame.current) {
        window.cancelAnimationFrame(refZoomFrame.current);
        refZoomFrame.current = null;
        refZoomAccum.current.deltaY = 0;
      }
    };
  }, [enabled, ref, handleWheel]);

  return handleWheel;
};
