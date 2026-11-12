import type React from 'react';
import { useState, useRef, useMemo, useEffect, memo, forwardRef } from 'react';
import { createPortal } from 'react-dom';

import clsx from 'clsx';
import { useMergeRefs } from 'react-merge-refs';

import {
  useCallbackRef,
  type PointerModifiers, type PointerHandlerOptions, useSynchronizedPointerHandler
} from '../hooks';
import { ReactUtils } from '../utils';

import { ScrollbarOrientation, type ThumbDragEvent } from './IScrollbar';
import { EDGE_HOLD_INTERVAL_MS, type TrackEdgeTick } from './TrackDrag';
import {
  useTouchThumbFrame, TOUCH_THUMB_SIZE, TOUCH_THUMB_ASPECT,
  TOUCH_THUMB_MARGIN_START, TOUCH_THUMB_MARGIN_END
} from './TouchThumbContext';

import styles from './Scrollbar.module.css';

export interface TouchThumbHandleProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * The orientation of the scrollbar.
   */
  orientation: ScrollbarOrientation;

  size?: number;

  borderColor?: string;
  backgroundColor?: string;
  borderWidth?: number;
  fillColor?: string;

  /**
   * The thumb's position along its track as a fraction `[0, 1]`. Comes from the scrollbar's thumb — a
   * virtual scrollbar maps scroll → thumb non-linearly (elastic), so only the scrollbar knows this.
   * The grip is literally a touch-sized rendering of the thumb.
   */
  fraction?: number;

  /**
   * Called while dragging with the new position along the travel as a fraction `[0, 1]`. The scrollbar
   * maps it back through its (possibly virtual) thumb space to a scroll offset.
   */
  onScrollToFraction?: (fraction: number) => void;

  /**
   * Called on a repeating tick while the grip is dragged past a travel end and held there — the same
   * contract as `ScrollbarProps.onThumbEdgeHold` (a virtual scrollbar extends its elastic region,
   * accelerating with hold time). Return `false` to stop the ticking (parked at the real end). Leave
   * unset for a linear scrollbar: its end is the end.
   */
  onEdgeHold?: (edge: -1 | 1, tick: TrackEdgeTick) => boolean;

  /**
   * Drag lifecycle signal, carrying the grip ELEMENT (`source: 'touch'`) — same event shape as the
   * desktop thumb's (`ScrollbarProps.onThumbDrag`). A virtual scrollbar pins its elastic region while
   * dragging; a client anchors drag UI (e.g. a tooltip) to the element.
   */
  onDraggingChange?: (event: ThumbDragEvent) => void;

  /**
   * Indicate that a touch handling is being used
   */
  currentTouchAnchor?: string;

  key?: string;

  /**
   * Ref for the TouchThumbHandle element
   */
  ref?: React.Ref<TouchThumbHandleElement>;
}

export interface TouchThumbHandleAttributes {
  // None yet
}

export interface TouchThumbHandleElement extends HTMLDivElement, TouchThumbHandleAttributes {};

const supportsTouchEvents = ReactUtils.detectIt().supportsTouchEvents;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * TouchThumbHandle component
 *
 * @remarks
 * A large, touch-friendly proxy for a scrollbar thumb. It is a pure presentation of the thumb: it
 * rides the thumb's fractional position and reports drag back as a fraction, so the (virtual)
 * scrollbar owns all scroll math — including the elastic bounce, and (via {@link onEdgeHold}) the
 * accelerating extend when the finger parks past a travel end. The {@link TouchThumbFrame} published
 * by the enclosing `ScrollPane` tells it where to sit — inside the viewport, clear of the
 * perpendicular grip's virtual corner.
 */
export const TouchThumbHandle = memo(
  forwardRef<TouchThumbHandleElement, TouchThumbHandleProps>((props, refForwarded) => {
    const {
      borderColor = 'var(--sxl-color-primary, rgb(33, 115, 70))',
      backgroundColor = 'var(--sxl-color-base-100, white)',
      fillColor = 'var(--sxl-color-neutral, grey)',
      borderWidth = 3,
      size = TOUCH_THUMB_SIZE,
      style: propStyle,
      className: propClassName,

      orientation = ScrollbarOrientation.Vertical,
      fraction: propFraction = 0,
      onScrollToFraction: propOnScrollToFraction,
      onEdgeHold: propOnEdgeHold,
      onDraggingChange: propOnDraggingChange,
      currentTouchAnchor,
      key,
      ...rest
    } = props;

    if (!supportsTouchEvents) {
      return null; // this condition happens before hooks but since it's a static global it's ok.
    }

    const isVertical = orientation === ScrollbarOrientation.Vertical;
    const frame = useTouchThumbFrame();

    const onScrollToFraction = useCallbackRef(propOnScrollToFraction ?? (() => {}), [propOnScrollToFraction]);
    const onEdgeHold = useCallbackRef(propOnEdgeHold ?? (() => {}), [propOnEdgeHold]);
    const onDraggingChange = useCallbackRef(propOnDraggingChange ?? (() => {}), [propOnDraggingChange]);

    // Own handle on the grip element — carried in the drag event so clients can anchor UI to it.
    const refGrip = useRef<TouchThumbHandleElement>(null);
    const refMerged = useMergeRefs<TouchThumbHandleElement>([refGrip, refForwarded]);
    const dragEvent = useCallbackRef((dragging: boolean): ThumbDragEvent => (
      { dragging, element: refGrip.current, source: 'touch' }
    ), []);

    const [dragging, setDragging] = useState(false);

    // The pointer handler is created once; drag reads live geometry + hold state through this ref.
    const dragRef = useRef({
      isVertical, travel: 0, startAlong: 0, startFraction: 0, fraction: 0, dragging: false,
      hasEdgeHold: false, rawFraction: 0, edge: 0 as -1 | 0 | 1, engagedAt: 0, count: 0,
      timer: null as ReturnType<typeof setTimeout> | null
    });
    dragRef.current.isVertical = isVertical;
    dragRef.current.fraction = clamp01(propFraction);
    dragRef.current.hasEdgeHold = !!propOnEdgeHold;

    const stopEdgeTimer = useCallbackRef(() => {
      const d = dragRef.current;
      if (d.timer) clearTimeout(d.timer);
      d.timer = null;
    }, []);

    // Parked-past-the-end heartbeat: while held, tick the scrollbar's edge policy (e.g. the virtual
    // scrollbar's accelerating elastic extend) — same contract as the desktop thumb's edge hold.
    const edgeTick = useCallbackRef(() => {
      const d = dragRef.current;
      d.timer = null;
      if (!d.edge || !d.dragging) return;
      d.count++;
      const overshootPx = Math.max(0, d.edge > 0 ? d.rawFraction - 1 : -d.rawFraction) * d.travel;
      const engaged = onEdgeHold?.(d.edge, {
        count: d.count,
        heldMs: Date.now() - d.engagedAt,
        overshootPx
      }) ?? false;
      if (engaged) d.timer = setTimeout(edgeTick, EDGE_HOLD_INTERVAL_MS);
    }, []);

    const updateEdge = useCallbackRef(() => {
      const d = dragRef.current;
      if (!d.hasEdgeHold) return;
      const next: -1 | 0 | 1 = d.rawFraction < 0 ? -1 : d.rawFraction > 1 ? 1 : 0;
      if (next === d.edge) return;
      d.edge = next;
      stopEdgeTimer();
      if (next) {
        d.engagedAt = Date.now();
        d.count = 0;
        d.timer = setTimeout(edgeTick, EDGE_HOLD_INTERVAL_MS);
      }
    }, []);

    const pointerHandler:PointerHandlerOptions = useMemo(() => {
      return {
        processTouch: true,
        onPointerDown: (e: React.PointerEvent<Element>, _modifiers: PointerModifiers) => {
          const d = dragRef.current;
          d.startAlong = d.isVertical ? e.clientY : e.clientX;
          d.startFraction = d.fraction;
          d.rawFraction = d.fraction;
          d.edge = 0;
          d.dragging = true;
          setDragging(true);
          onDraggingChange?.(dragEvent(true));
          e.preventDefault();
          e.stopPropagation();
        },
        onPointerMoveOrWait: (e: React.PointerEvent<Element>) => {
          const d = dragRef.current;
          const now = d.isVertical ? e.clientY : e.clientX;
          const delta = now - d.startAlong;
          d.rawFraction = d.startFraction + (d.travel > 0 ? delta / d.travel : 0);
          onScrollToFraction?.(clamp01(d.rawFraction));
          updateEdge();
        },
        onPointerUp: (e: React.PointerEvent<Element>) => {
          const d = dragRef.current;
          d.edge = 0;
          d.dragging = false;
          stopEdgeTimer();
          setDragging(false);
          onDraggingChange?.(dragEvent(false));
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }, []);
    const handlePointerDown = useSynchronizedPointerHandler(pointerHandler);

    // Unmount mid-drag: drop the heartbeat and release the drag signal (the elastic region unpins).
    useEffect(() => () => {
      const d = dragRef.current;
      if (d.timer) clearTimeout(d.timer);
      if (d.dragging) {
        d.dragging = false;
        onDraggingChange?.(dragEvent(false));
      }
    }, []);

    if (!frame?.portalTarget) return null;

    // Grip box: `size` thick, elongated along its travel axis.
    const gripLong = size * TOUCH_THUMB_ASPECT;
    const w = isVertical ? size : gripLong;
    const h = isVertical ? gripLong : size;

    // Position along the travel axis: the thumb fraction mapped across the *cell-area viewport*
    // (offset from the content-box edge by the header gutter), stopping short of the reserved corner so
    // the two grips never overlap.
    const axisViewLen = isVertical ? frame.viewportHeight : frame.viewportWidth;
    const axisContentLen = isVertical ? frame.height : frame.width;
    const leading = Math.max(0, axisContentLen - axisViewLen); // header gutter (top / left)
    const reserve = isVertical ? frame.reserveVertical : frame.reserveHorizontal;
    // Trailing gap: tuck toward the corner reserve when there is one (the rounded pill may overlap the
    // reserve boundary slightly, hence a negative margin); mirror the leading gap when there isn't.
    const endMargin = reserve > 0 ? TOUCH_THUMB_MARGIN_END : TOUCH_THUMB_MARGIN_START;
    const travel = Math.max(0, axisViewLen - reserve - gripLong - TOUCH_THUMB_MARGIN_START - endMargin);
    dragRef.current.travel = travel;

    const centerAlong = leading + TOUCH_THUMB_MARGIN_START + gripLong / 2 + clamp01(propFraction) * travel;

    // Cross axis: sit just inside the viewport edge the scrollbar manages.
    let left: number;
    let top: number;
    if (isVertical) {
      const crossCenter = frame.width - frame.crossInset;
      left = crossCenter - w / 2;
      top = centerAlong - h / 2;
    } else {
      const crossCenter = frame.height - frame.crossInset;
      top = crossCenter - h / 2;
      left = centerAlong - w / 2;
    }

    return createPortal(
      <div
        className={clsx(`sxl-touch-thumb`, styles['touch-thumb'], propClassName, { 'sxl-dragging': dragging })}
        ref={refMerged}
        style={{
          left,
          top,
          width: w,
          height: h,
          // Sit above the grid content it is portaled alongside (which may open its own stacking context).
          zIndex: 20,
          borderWidth: `${borderWidth}px`,
          boxShadow: dragging ? `${backgroundColor} 0px 0px 0px 1.5px` : undefined,
          borderStyle: 'solid',
          borderColor: borderColor,
          backgroundColor: backgroundColor,
          // Excel keeps both grips visible while pivoting around an anchor, so we don't hide the
          // opposite grip; a caller can still opt into hiding via currentTouchAnchor.
          opacity: currentTouchAnchor ? 0 : undefined,
          transitionDuration: '160ms',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='6.4' height='12' viewBox='0 0 9.6 16' version='1.1' fill='${fillColor}' xmlns='http://www.w3.org/2000/svg' xmlns:svg='http://www.w3.org/2000/svg'%3E%3Cpath d='M 9.60008,14.40009 C 9.60008,15.28374 8.88368,16 8.00003,16 7.11639,16 6.40012,15.28374 6.40012,14.40009 c 0,-0.88365 0.71627,-1.60005 1.59991,-1.60005 0.88365,0 1.60005,0.7164 1.60005,1.60005 m 0,-6.40012 c 0,0.88364 -0.7164,1.60004 -1.60005,1.60004 -0.88364,0 -1.59991,-0.7164 -1.59991,-1.60004 0,-0.88365 0.71627,-1.60005 1.59991,-1.60005 0.88365,0 1.60005,0.7164 1.60005,1.60005 m 0,-6.40006 c 0,0.88365 -0.7164,1.60005 -1.60005,1.60005 -0.88364,0 -1.59991,-0.7164 -1.59991,-1.60005 C 6.40012,0.71626 7.11639,0 8.00003,0 8.88368,0 9.60008,0.71626 9.60008,1.59991 M 3.19996,14.40009 C 3.19996,15.28374 2.48369,16 1.60005,16 0.7164,16 0,15.28374 0,14.40009 c 0,-0.88365 0.7164,-1.60005 1.60005,-1.60005 0.88364,0 1.59991,0.7164 1.59991,1.60005 m 0,-6.40012 c 0,0.88364 -0.71627,1.60004 -1.59991,1.60004 C 0.7164,9.60001 0,8.88361 0,7.99997 0,7.11632 0.7164,6.39992 1.60005,6.39992 c 0.88364,0 1.59991,0.7164 1.59991,1.60005 m 0,-6.40006 c 0,0.88365 -0.71627,1.60005 -1.59991,1.60005 C 0.7164,3.19996 0,2.48356 0,1.59991 0,0.71626 0.7164,0 1.60005,0 2.48369,0 3.19996,0.71626 3.19996,1.59991' /%3E%3C/svg%3E%0A")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center center',
          ...propStyle
        }}
        tabIndex={-1}
        onPointerDown={handlePointerDown}
        {...rest}
      />
    , frame.portalTarget, key);
  })
);

TouchThumbHandle.displayName = "TouchThumbHandle";
