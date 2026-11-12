import {
  useMemo, memo, forwardRef, useEffect, useCallback, useRef, useState
} from 'react';

import { type TopLeft } from '@sheetxl/utils';

import clsx from 'clsx';

import { RenderSlot } from '../components';
import { useMeasure } from '../hooks';
import { Scroller } from '../scroller';

import { ScrollbarOrientation } from './IScrollbar';
import { useWheelScroll } from './useWheelScroll';
import { useImperativeElement, useOptionalBoundSyncExternalStore, useCallbackRef } from '../hooks';
// tree-shake
import { detectIt } from '../utils/ReactUtils';

import {
  type IScrollPaneElement, type IScrollPaneAttributes, type ScrollPaneProps, type ScrollCornerProps
} from './IScrollPane';
import { type ViewportZoomStep } from './Viewport';

import { defaultRenderScrollbar } from './Utils';
import { isTouchOwned } from './touchOwner';
import {
  TouchThumbFrameProvider, touchThumbCornerReserve, touchThumbCrossInset, type TouchThumbFrame
} from './TouchThumbContext';

import styles from './ScrollPane.module.css';

/**
 * Flip to `true` to trace the whole touch-scroll chain in the console — DOM touch event -> `Scroller`
 * -> `handleScroller` callback -> `driveScroll` -> viewport, plus the scroller-sync effect's decision.
 * Reproduce in Chrome DevTools device emulation (single-finger drag) to see which link breaks. Off in
 * production. (Pairs with `DEBUG_TOUCH` in scroller/Scroller.ts for the tracking/dragging state.)
 */
const DEBUG_TOUCH_SCROLL = false;
const logTouch = (...args: unknown[]): void => {
  if (DEBUG_TOUCH_SCROLL) console.log('[touch-scroll]', ...args);
};

/**
 * A wheel has no "fingers lifted": its zoom gesture ends when the ctrl+wheel stream has been quiet
 * for this long. Short enough that the owner's end-of-gesture settle (snap) feels attached to the last
 * notch; long enough to span the gaps in a touchpad pinch.
 */
const WHEEL_ZOOM_QUIET_MS = 150;

/*
 * A wrapper around scrollbars. The child must be a component that returns a Viewport.

 * This component fills the space as a standard div (honoring layouts unlike grid)
 * Adds a bottom right corner
 *
 * Owns wheel (via onScrollBy), touch scrolling, and the zoom gesture (`zoomable`; steps are requested on
 * the viewport). TODO - snap
 */
export const ScrollPane = memo(forwardRef<IScrollPaneElement, ScrollPaneProps>(
  (props: ScrollPaneProps, refForwarded) => {
  const {
    children,
    viewport: propViewport,
    disableMouseWheel = false,
    onWheelScroll,
    zoomable = false,
    showHorizontalScrollbar: propShowHorizontalScrollbar = true,
    showVerticalScrollbar: propShowVerticalScrollbar = true,
    renderScrollCorner = defaultRenderScrollCorner,
    renderScrollbarHorizontal = defaultRenderScrollbar,
    renderScrollbarVertical = defaultRenderScrollbar,
    style: propsStyle,
    className: propClassName,
    disableTouch,
    ...rest
  } = props;

  const showHorizontalScrollbar = propShowHorizontalScrollbar && renderScrollbarHorizontal;
  const showVerticalScrollbar = propShowVerticalScrollbar && renderScrollbarVertical;

  // Subscribe to the viewport for position + sizes (its identity-stable getViewport snapshot). A no-op
  // store keeps the hook unconditional when no viewport is provided. The ScrollPane is a pure scroll UI:
  // it reads sizes here (to place scrollbar thumbs) and drives `setTarget` on wheel/drag/touch — it does
  // NOT measure the client. The content itself (a GridSurface) hands its own element to `viewport.observe`.
  const viewport = useOptionalBoundSyncExternalStore(propViewport, (s) => s.getMetrics());

  // Scroll sink: drive the viewport directly (scrollbar/wheel/touch → setTarget). Animation is
  // per-request: position control (thumb drag, the touch scroller's per-frame writes) stays instant;
  // discrete gestures (a wheel notch) pass `animate` for the fixed-duration glide.
  const driveScroll = useCallback((scrollPoint: Partial<TopLeft>, animate?: boolean): void => {
    if (!propViewport) { logTouch('driveScroll SKIPPED — no propViewport', scrollPoint); return; }
    const t = propViewport.getTarget();
    logTouch('driveScroll', { request: scrollPoint, from: t, animate });
    propViewport.setTarget(scrollPoint.left ?? t.left, scrollPoint.top ?? t.top, animate);
  }, [propViewport]);

  const refLocal = useImperativeElement<IScrollPaneElement, IScrollPaneAttributes>(refForwarded, () => {
    return {
      isScrollPane: () => true
    }
  }, []);

  // DEBUG probe: capture-phase document listeners for the RAW touch + pointer streams, to see whether
  // touch events fire at all, on WHAT element they land (vs where the scroller listens), and whether a
  // `pointerdown` "steals" the gesture (pointer capture on a touch pointer can suppress the touch stream).
  useEffect(() => {
    if (!DEBUG_TOUCH_SCROLL) return;
    const listen = refLocal.current;
    const describe = (t: EventTarget | null): string => {
      const el = t as HTMLElement | null;
      if (!el) return 'null';
      const cls = typeof el.className === 'string' ? el.className : '';
      return `${el.tagName?.toLowerCase() ?? '?'}${cls ? '.' + cls.split(/\s+/).filter(Boolean).join('.') : ''}`;
    };
    let moves = 0;
    const probe = (e: Event): void => {
      if (e.type === 'touchmove' || e.type === 'pointermove') { if (moves++ % 10 !== 0) return; } // throttle
      const tgt = e.target as HTMLElement | null;
      logTouch(`RAW ${e.type}`, {
        target: describe(e.target),
        listenContainsTarget: !!(listen && tgt && listen.contains(tgt)), // is our listen el an ancestor?
        targetTouchAction: tgt ? getComputedStyle(tgt).touchAction : undefined,
        defaultPrevented: e.defaultPrevented,
        pointerType: (e as PointerEvent).pointerType
      });
    };
    const types = ['touchstart', 'touchmove', 'touchend', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel'];
    types.forEach((t) => document.addEventListener(t, probe, true));
    return () => types.forEach((t) => document.removeEventListener(t, probe, true));
  }, []);

  const scrollerRef = useRef<Scroller | null>(null);
  // Zoom steps are REQUESTED on the viewport (the same sink the scroll goes to); the zoom's owner listens
  // there. The ScrollPane never applies a zoom itself.
  const zoomRef = useCallbackRef((step: ViewportZoomStep): void => { propViewport?.requestZoom(step); }, [propViewport]);
  // The zoom gesture the scroller is running, as seen from here: whether one is open (so the first
  // changed publish is `start`), the last reported step (re-sent as `end`), the focal point of the
  // input that is about to publish, and — for wheel, which has no "fingers lifted" — the quiet timer
  // that closes it.
  const refZoomGesture = useRef<{
    active: boolean;
    lastZoom: number;
    focal: { clientX: number; clientY: number };
    last: ViewportZoomStep | null;
    endTimer: ReturnType<typeof setTimeout> | null;
  }>({ active: false, lastZoom: 1, focal: { clientX: 0, clientY: 0 }, last: null, endTimer: null });
  const endZoomGesture = useCallback((): void => {
    const g = refZoomGesture.current;
    if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
    if (!g.active) return;
    g.active = false;
    if (g.last) zoomRef({ ...g.last, panX: 0, panY: 0, phase: 'end' }); // the pan was already applied
    // Re-seat the scroller on the committed level. The owner's commit may still be in flight (its model
    // round-trip lands as a viewport zoom change, which the sync effect below then pushes); this covers
    // the case where the commit changed nothing (a sub-percent drift, a snap already at 100).
    if (propViewport) scrollerRef.current?.setZoomLevel(propViewport.getZoom());
  }, [propViewport]);
  // ctrl/⌘+wheel (one per frame, pixel-normalized — see useWheelScroll). The scroller owns the factor
  // and the clamp; its publish comes back through `handleScroller`, which requests it on the viewport.
  const handleWheelZoom = useCallbackRef((deltaY: number, clientX: number, clientY: number): void => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const g = refZoomGesture.current;
    g.focal = { clientX, clientY };
    if (g.endTimer) clearTimeout(g.endTimer);
    g.endTimer = setTimeout(endZoomGesture, WHEEL_ZOOM_QUIET_MS);
    const rect = refLocal.current?.getBoundingClientRect();
    scroller.doMouseZoom(deltaY, performance.now(), clientX - (rect?.left ?? 0), clientY - (rect?.top ?? 0));
  }, [endZoomGesture]);
  useEffect(() => () => {
    const g = refZoomGesture.current;
    if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
  }, []);

  // Mouse wheel (sibling of the touch handling below). Drives the SAME viewport sink as the scrollbars
  // (delta applied to the current viewport position), so every ScrollPane gets wheel for free — and
  // since it's the shared viewport, any scroll-syncing (e.g. split views) comes along too. Attaches to
  // the ScrollPane element so wheel over any child scrolls.
  useWheelScroll(refLocal, {
    enabled: !disableMouseWheel && !!propViewport,
    onScrollBy: (delta) => {
      // Accumulate on the TARGET (not the rendered current): during a glide, rapid notches must stack
      // onto where we're headed, or each notch would erase the in-flight distance.
      if (!propViewport) return;
      const t = propViewport.getTarget();
      driveScroll?.({
        left: delta.left !== undefined ? t.left + delta.left : undefined,
        top: delta.top !== undefined ? t.top + delta.top : undefined
      }, true /* the wheel glide */);
    },
    onWheelScroll,
    onZoomBy: zoomable ? handleWheelZoom : undefined
  });
  // True while WE are pushing the viewport position into the scroller (below). Scroller.scrollTo
  // publishes synchronously back through `handleScroller`; without the guard that echo re-enters
  // `driveScroll` as an instant setTarget(current) — position control wins, so it kills an
  // in-flight glide (a goto/into-view lands a frame or two into the ramp on touch devices).
  const refSyncingScroller = useRef<boolean>(false);
  // Zoom is viewport state too (the grid drives it from its model); mirror it into the scroller the same
  // way as position, so the next gesture starts from the committed level and the scroll maximums are
  // right for it. Not while a zoom gesture is open: then the scroller's continuous level is ahead of the
  // owner's whole-percent commits by design, and re-seating it every commit would quantize the gesture.
  const viewportZoom = useOptionalBoundSyncExternalStore(propViewport, (s) => s.getZoom());
  useEffect(() => {
    if (!scrollerRef.current || viewportZoom == null) return;
    if (refZoomGesture.current.active) return;
    scrollerRef.current.setZoomLevel(viewportZoom);
    refZoomGesture.current.lastZoom = scrollerRef.current.__zoomLevel;
  }, [viewportZoom]);
  useEffect(() => {
    if (!scrollerRef.current) return;
    if (!viewport) return;
    if (scrollerRef.current.__scrollTop !== viewport?.top ||
        scrollerRef.current.__scrollLeft !== viewport?.left) {
      // Only sync when the scroller does NOT own the position. While it is actively tracking a touch
      // drag (`__isTracking`) or coasting (`__isDecelerating`) it IS the source of truth, and the viewport
      // it drives reports a rAF-lagging `current` (getMetrics -> `_current`, not the target). Syncing then
      // would yank the scroller back to that lagging value every frame — fighting the finger, which reads
      // as "one-finger touch scroll doesn't move" (wheel / thumb bypass the scroller, so they're immune).
      // The sync is only for the OTHER direction: a wheel / thumb / programmatic move must be reflected
      // into the scroller so the NEXT touch takeover starts from the right spot.
      if (!scrollerRef.current.__isDecelerating && !scrollerRef.current.__isTracking) {
        // A SYNC (keep the scroller current so a touch takeover starts from the right spot),
        // not a scroll request — don't let its echo drive the viewport.
        logTouch('sync effect -> scrollTo (scroller idle)', {
          scroller: { left: scrollerRef.current.__scrollLeft, top: scrollerRef.current.__scrollTop },
          viewport: { left: viewport.left, top: viewport.top }
        });
        refSyncingScroller.current = true;
        try {
          scrollerRef.current?.scrollTo(viewport.left, viewport.top, false/*animate*/);
        } finally {
          refSyncingScroller.current = false;
        }
      } else {
        logTouch('sync effect SKIPPED (scroller owns position)', {
          isTracking: scrollerRef.current.__isTracking,
          isDecelerating: scrollerRef.current.__isDecelerating
        });
      }
    }
  }, [viewport?.left, viewport?.top]);

  const handleScroller = useCallback((left: number, top: number, zoom: number) => {
    if (refSyncingScroller.current) { logTouch('scroller callback IGNORED (own sync echo)', { left, top }); return; }
    // The scroller's callback drives the viewport ONLY for a live touch gesture (`__isTracking`), its
    // coasting momentum (`__isDecelerating`), or a zoom (`__isZooming`). Any other publish — notably
    // `setDimensions` re-clamping on a resize, which republishes the scroller's stale position — must
    // NOT drive scroll, or every resize slams the viewport back to the scroller's (often 0,0) position.
    const s = scrollerRef.current;
    if (s && !s.__isTracking && !s.__isDecelerating && !s.__isZooming) {
      logTouch('scroller callback IGNORED (not a live gesture — e.g. setDimensions clamp)', { left, top });
      return;
    }
    // A zoom step is reported to the owner, not driven into the viewport: the owner commits zoom + a
    // focal-corrected position to ITS model, and that round-trips into the viewport (and back into the
    // scroller via the sync effect). Driving the scroller's own position here would fight that commit.
    // Once a gesture has changed the zoom, EVERY publish of that touch sequence goes this way, with the
    // move's pan on it — including moves that only panned. The owner's commits have moved the viewport
    // without the scroller (the sync is skipped while tracking), so driving the scroller's own position
    // into the viewport mid-pinch would jump.
    const g = refZoomGesture.current;
    if (zoom !== g.lastZoom || (g.active && s?.__isTracking)) {
      g.lastZoom = zoom;
      const phase = g.active ? 'move' : 'start';
      g.active = true;
      g.last = {
        zoom, left, top, clientX: g.focal.clientX, clientY: g.focal.clientY,
        panX: s?.__gestureMoveX ?? 0, panY: s?.__gestureMoveY ?? 0, phase
      };
      logTouch('scroller callback -> viewport.requestZoom', g.last);
      zoomRef(g.last);
      return;
    }
    // A zoom publish whose level did not change (pinned at the range edge): nothing to report, and its
    // position must not drive the viewport either.
    if (s?.__isZooming) return;
    logTouch('scroller callback -> driveScroll', { left, top });
    driveScroll?.({ left, top });
  }, []);
  // True while the content owns the touch gesture (see `isTouchOwned`): the scroller sits it out, and
  // the browser's default is left to the element's own `touch-action`. Decided by the first finger
  // and held until every finger lifts, so a second finger cannot hand a handle's drag to the pan.
  const refTouchOwned = useRef<boolean>(false);
  const handleTouchStart = useCallback((e: globalThis.TouchEvent) => {
    if (e.touches.length === 1) refTouchOwned.current = isTouchOwned(e.target, refLocal.current);
    logTouch('touchstart', { touches: e.touches.length, owned: refTouchOwned.current });
    if (refTouchOwned.current) return;
    scrollerRef.current?.doTouchStart(e.touches, e.timeStamp);
  }, []);
  const handleTouchMove = useCallback((e: globalThis.TouchEvent) => {
    if (refTouchOwned.current) return;
    e.preventDefault();
    // Two fingers: the midpoint is the pinch's focal point. Recorded before the scroller publishes so
    // `handleScroller` can stamp it on the zoom step.
    if (e.touches.length === 2) {
      refZoomGesture.current.focal = {
        clientX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        clientY: (e.touches[0].clientY + e.touches[1].clientY) / 2
      };
    }
    logTouch('touchmove', {
      touches: e.touches.length,
      isTracking: scrollerRef.current?.__isTracking,
      isDragging: scrollerRef.current?.__isDragging,
      scrollTop: scrollerRef.current?.__scrollTop
    });
    scrollerRef.current?.doTouchMove(e.touches, e.timeStamp);
  }, []);
  const handleTouchEnd = useCallback((e: globalThis.TouchEvent) => {
    if (refTouchOwned.current) {
      if (e.touches.length === 0) refTouchOwned.current = false;
      return;
    }
    logTouch('touchend');
    scrollerRef.current?.doTouchEnd(e.timeStamp);
    // Fingers lifted: a pinch that was running ends now (the wheel's quiet timer is not involved).
    endZoomGesture();
  }, [endZoomGesture]);

  const updateScrollDimensions = useCallback(({
      containerWidth,
      containerHeight,
      totalWidth,
      totalHeight,
  }: {
    containerWidth: number;
    containerHeight: number;
    totalWidth: number;
    totalHeight: number;
  }) => {
    if (!scrollerRef.current) return;
    scrollerRef.current.setDimensions(
      containerWidth,
      containerHeight,
      totalWidth,
      totalHeight
    );
  }, []);

  useEffect(() => {
    // Listen on the ScrollPane's OWN element — the same element `useWheelScroll` uses (above) and the one
    // that reliably wraps all scrollable content. The `touchElement` prop pointed at the primary grid
    // surface, which after the GridSurface refactor is NOT a DOM ancestor of the interactive `Stage`
    // (where touches land), so `touchstart`/`touchmove` never bubbled to it and the scroller was deaf —
    // one-finger touch scroll did nothing. (Confirmed via `element.contains(touchTarget) === false`.)
    const listenElement: HTMLElement | null = refLocal.current;
    // Note - later we will always use the scroller for animated scrolling
    // and snap but we have to reconcile the viewport with the scroller first
    const touchEnabled = !disableTouch && detectIt().supportsTouchEvents;
    // The scroller runs the touch gesture AND the zoom gesture (ctrl/⌘+wheel is a mouse input), so it
    // exists whenever either is wanted; the touch listeners attach only for touch.
    const scrollerEnabled = touchEnabled || zoomable;
    // Flat args (console truncates nested objects with "…" — keep the decisive fields visible).
    logTouch(
      'attach effect —',
      'willAttach:', !!(touchEnabled && listenElement && viewport),
      '| scrollerEnabled:', scrollerEnabled,
      '| hasViewport:', !!viewport
    );
    if (scrollerEnabled && listenElement && viewport) {
      /* Add scroller, We only do this once */
      if (!scrollerRef.current) {
        const options = {
          scrollingX: true,
          scrollingY: true,
          decelerationRate: 0.95,
          penetrationAcceleration: 0.08,
          // The level is the owner's zoom factor (1 = 100 %); the range is `IWorksheetView`'s 10–400 %.
          zooming: true,
          minZoom: 0.1,
          maxZoom: 4,
        };
        scrollerRef.current = new Scroller(handleScroller, options);
        scrollerRef.current.setZoomLevel(propViewport?.getZoom() ?? 1);
        refZoomGesture.current.lastZoom = scrollerRef.current.__zoomLevel;
      }

      if (touchEnabled) {
        // Non-passive so `handleTouchMove` can `preventDefault()` the browser's native pan (otherwise the
        // browser steals the gesture — the `pointercancel` + no-scroll seen in the probe).
        listenElement.addEventListener("touchstart", handleTouchStart, { passive: false });
        listenElement.addEventListener("touchend", handleTouchEnd);
        listenElement.addEventListener("touchmove", handleTouchMove, { passive: false });
      }

      // Content in BASE (zoom-independent) px — the scroller scales it by its own level — while the
      // viewport reports screen (zoomed) totals.
      const z = propViewport?.getZoom() || 1;
      updateScrollDimensions({
        containerWidth: viewport?.width,
        containerHeight: viewport?.height,
        totalWidth: viewport?.totalWidth / z,
        totalHeight: viewport?.totalHeight / z,
      });
    }
    return () => {
      listenElement?.removeEventListener("touchstart", handleTouchStart);
      listenElement?.removeEventListener("touchend", handleTouchEnd);
      listenElement?.removeEventListener("touchmove", handleTouchMove);
    }
  }, [viewport?.width, viewport?.height, viewport?.totalWidth, viewport?.totalHeight, viewportZoom, disableTouch, zoomable]);

  const isTouchCapable = detectIt().supportsTouchEvents;

  // The overlay covering the grid viewport box (excludes the scrollbar gutters). Touch grips portal
  // into it and position in its content-relative coords. Its size == each scrollbar's track length, so
  // mapping the grip across it keeps the grip in step with the thumb — even when the (tab-shared) track
  // is physically narrower.
  const [contentEl, setContentEl] = useState<HTMLDivElement | null>(null);
  const [refMeasureContent, { width: contentWidth, height: contentHeight }] = useMeasure<HTMLDivElement>();
  const setContentRef = useCallback((el: HTMLDivElement | null) => {
    setContentEl(el);
    refMeasureContent(el as HTMLDivElement);
  }, [refMeasureContent]);

  // Coordinate frame the touch grips are drawn into. Only ScrollPane knows the full viewport + which
  // gutters exist, so it publishes: where to draw, the viewport size, and the corner each grip must
  // leave for the other (so they never overlap in the bottom-right).
  const touchFrame: TouchThumbFrame | null = useMemo(() => {
    if (!contentEl) return null;
    const reserve = touchThumbCornerReserve();
    // Cell-area viewport (excludes the header gutters). Falling back to the content box means a
    // headerless pane just travels the full box (leading offset of 0).
    const viewportWidth = Math.min(contentWidth, viewport?.width ?? contentWidth);
    const viewportHeight = Math.min(contentHeight, viewport?.height ?? contentHeight);
    return {
      portalTarget: contentEl,
      width: contentWidth,
      height: contentHeight,
      viewportWidth,
      viewportHeight,
      reserveVertical: showHorizontalScrollbar ? reserve : 0,
      reserveHorizontal: showVerticalScrollbar ? reserve : 0,
      crossInset: touchThumbCrossInset()
    };
  }, [
    contentEl, contentWidth, contentHeight,
    viewport?.width, viewport?.height,
    showHorizontalScrollbar, showVerticalScrollbar
  ]);

  const verticalScroll = useMemo(() => {
    if (!showVerticalScrollbar) return null;
    const scrollbar = <RenderSlot render={renderScrollbarVertical} props={{
      orientation: ScrollbarOrientation.Vertical,
      offset: viewport?.top ?? 0,
      viewportSize: viewport?.height ?? 0,
      totalSize: viewport?.totalHeight ?? 0,
      onScrollOffset: (offset: number): void => {
        // TODO - we could support animation of scrollbars here too.
        // to make this work we will need to track the inflight top, left
        //scrollerRef.current?.scrollTo(scrollerRef.current?.__scrollLeft ?? 0, offset, true/*animate*/);
        driveScroll?.({ top: offset })
      }
    }} />;
    return (
      <div
        className={clsx('sxl-vertical-container', styles['vertical-container'])}
      >
        {scrollbar}
      </div>
    );
  }, [renderScrollbarVertical, viewport?.top, viewport?.height, viewport?.totalHeight]);

  const horizontalScroll = useMemo(() => {
    if (!showHorizontalScrollbar) return null;
    const scrollbar = <RenderSlot render={renderScrollbarHorizontal} props={{
      orientation:ScrollbarOrientation.Horizontal,
      offset: viewport?.left ?? 0,
      viewportSize: viewport?.width ?? 0,
      totalSize: viewport?.totalWidth ?? 0,
      onScrollOffset: (offset: number): void => {
        // TODO - we could support animation of scrollbars here too.
        // to make this work we will need to track the inflight top, left
        //scrollerRef.current?.scrollTo(scrollerRef.current?.__scrollLeft ?? 0, offset, true/*animate*/);
        driveScroll?.({ left: offset })
      }
    }} />;
    // Lives in the content column ONLY (grid cell 2,1). The `1fr` track bounds it, so the tab-strip
    // SplitPane can't bleed under the vertical gutter or past the right edge. The corner is a separate
    // grid cell (below), not nested here.
    return (
      <div
        className={clsx('sxl-horizontal-container', styles['horizontal-container'])}
      >
        {scrollbar}
      </div>
    );
  }, [renderScrollbarHorizontal, viewport?.left, viewport?.width, viewport?.totalWidth]);

  // The corner is simply the (2,2) grid cell — the grid sizes it from the vertical gutter's width and the
  // horizontal gutter's height, so nothing here needs measuring. Rendered only when both gutters exist.
  const scrollCorner = useMemo(() => {
    if (!showVerticalScrollbar || !showHorizontalScrollbar) return null;
    return (
      <div className={clsx('sxl-corner-container', styles['corner-container'])}>
        <RenderSlot render={renderScrollCorner} props={{}} />
      </div>
    );
  }, [showVerticalScrollbar, showHorizontalScrollbar, renderScrollCorner]);

  return (
    <div
      className={clsx(propClassName, 'sxl-scrollpane', styles['scrollpane'])}
      style={propsStyle}
      {...rest}
      ref={refLocal}
    >
      <TouchThumbFrameProvider value={touchFrame}>
        {/* One CSS grid (`1fr auto` × `1fr auto`) with four direct cells: (1,1) content, (1,2) vertical
            scrollbar, (2,1) horizontal scrollbar, (2,2) corner. Each is its own grid area — no spanning
            item, no inner flex wrappers. A hidden scrollbar's `auto` track collapses to 0 automatically. */}
        <div
          className={clsx('sxl-scrollpane-content', styles['scrollpane-content'])}
        >
          <div
            className={clsx('sxl-scrollpane-content-cell', styles['scrollpane-content-cell'])}
          >
            {children}
          </div>
          { showVerticalScrollbar ? verticalScroll : null}
          { showHorizontalScrollbar ? horizontalScroll : null}
          { scrollCorner }
          {/* Touch grips portal into this overlay — it shares the content cell (1,1), so it covers the
              grid viewport box without wrapping the grid, and never becomes the grid's positioning
              context. pointer-events flow through to the grid; only the grips themselves capture. */}
          { isTouchCapable ? (
            <div
              ref={setContentRef}
              className={clsx('sxl-touch-thumb-overlay', styles['touch-thumb-overlay'])}
            />
          ) : null }
        </div>
      </TouchThumbFrameProvider>
    </div>
  );
}));

ScrollPane.displayName = 'ScrollPane';



export const defaultRenderScrollCorner = (props: ScrollCornerProps) => {
  const { size: _size, style: propStyle, ...rest } = props;
  // Fill the (2,2) grid cell — the grid already sizes it to the scrollbar gutters.
  return (
    <div
      className="sxl-corner"
      style={{
        width: '100%',
        height: '100%',
        ...propStyle
      }}
      {...rest}
    />
  );
}
