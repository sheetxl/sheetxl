import type React from 'react';
import {
  memo, forwardRef, useCallback, useState, useMemo, useRef
} from 'react';

import { ReactUtils } from '../utils';
import { useCallbackRef } from '../hooks';
import { RenderSlot, type RenderSlotFn } from '../components';

import { type IScrollbarElement, type ScrollbarProps, type ThumbDragEvent } from './IScrollbar';
import { type TrackEdgeTick } from './TrackDrag';

import { defaultRenderScrollbar } from './Utils';

export interface VirtualScrollbarProps extends Omit<ScrollbarProps, "onScroll"> {
  /**
   * Amount of scrollbar between minSize and totalSize. This is mean to show that there is more scroll area.
   * @defaultValue 100
   */
  endGap?: number;

  /**
   * If this is the minimum scrollbar size.
   * By default this is the bottom of the viewport but can be extended.
   * @defaultValue 0
   */
  // TODO - this is a confusing variable name. Revisit
  minSize?: number;

  /**
   * Determines the increment amount when the scrollbar has been dragged to the end but is not scrolled to total size.
   * @defaultValue 100;
   */
  // TODO - implement this
  endScrollIncrement?: number;

  /**
   * The max size of the area before scaling is implemented.
   * @defaultValue 1000000
   */
  scaleLimit?: number;

  /**
   * The factor amount for physical scaling
   * @defaultValue 100
   */
  scaleFactor?: number;

  /**
   * The default precision. This is a factor of the scale factor.
   * @defaultValue 50
   */
  precisionFactor?: number;

  renderScrollbar?: RenderSlotFn<ScrollbarProps>,
}

const DEFAULT_GAP = 300;
const DEFAULT_SCROLL_INCREMENT = 100;

// Set to zero to disable elastic scroll
const DEFAULT_SCALE_LIMIT = 1000000; // 1,000,000
const DEFAULT_SCALE_FACTOR = 100;
const DEFAULT_PRECISION_ADJUST = 50;

interface VirtualBounds {
  offset: number;
  totalSize: number;
  viewportSize: number;

  scaledOffset: number;
  scaledTotalSize: number;
  scaledViewportSize: number;

  factor: number;
  precision: number;
}

/**
 * The virtual scrollbar is for very large scroll area.
 * Browsers have issues with more than divs more than 6m pixels width/height (which by most account is reasonable).
 *
 * This virtualScrollbar also has an elastic component that allows the scrollbar to shrink to its minSize
 * for easier scrolling for large virtual areas with small content areas. (Similar to excel desktop)
 *
 * Note -
 * Because of the virtual nature of the scrollbar the onScroll method is disabled
 * and onScrollOffset must be used.
 */

// TODO - if we have dragged to the end then the start timer that will 'increment by a certain amount'
export const VirtualScrollbar = memo(forwardRef<IScrollbarElement, VirtualScrollbarProps>(
  (props: VirtualScrollbarProps, refForwarded) => {
  const {
    offset: propOffset = 0,
    viewportSize: propViewportSize = 0,
    totalSize: propTotalSize = 0,
    minSize = 0,
    endGap = DEFAULT_GAP,
    endScrollIncrement = DEFAULT_SCROLL_INCREMENT,
    style: propStyle = ReactUtils.EmptyCssProperties,
    onMouseDown: propOnMouseDown,
    onThumbDrag: propOnThumbDrag,
    onScrollOffset: propOnScrollOffset,
    //@ts-ignore
    onScroll: propOnScroll,
    scaleLimit = DEFAULT_SCALE_LIMIT,
    scaleFactor = DEFAULT_SCALE_FACTOR,
    precisionFactor = DEFAULT_PRECISION_ADJUST,
    renderScrollbar = defaultRenderScrollbar,
    ...rest
  } = props;
  if (propOnScroll) {
    // onScroll disabled because scrollTop, scrollLeft would be incorrect.
    console.warn('onScroll not supported for VirtualScrollbar. Use onScrollOffset instead');
  }

  const onMouseDown = useCallbackRef(propOnMouseDown ?? (() => {}), [propOnMouseDown]);

  const [isDraggingScroll, setDraggingScroll] = useState(false);

  // The elastic region never SHRINKS mid-drag (it may still grow — the edge-hold extend). A shrinking
  // region re-maps the remaining offset to a higher thumb position on every move, eating an upward drag
  // (a treadmill that makes the top/left edge near-unreachable from deep past the data end). While
  // dragging the mapping stays pinned (linear, predictable); on release it recomputes freely — the
  // elastic "bounce back".
  const refDragTotal = useRef<number>(0);

  const bounds: VirtualBounds = useMemo(() => {
    let virtualTotal = scaleLimit === 0 ? propTotalSize : Math.min(propTotalSize ?? 0, Math.max(minSize ?? 0, (propOffset ?? 0) + (propViewportSize ?? 0)) + (endGap ?? 0));
    if (isDraggingScroll) {
      virtualTotal = Math.max(virtualTotal, refDragTotal.current);
    }
    refDragTotal.current = virtualTotal;
    const effectiveFactor = scaleLimit !== 0 && virtualTotal > scaleLimit ? scaleFactor : 1;
    const effectivePrecision = effectiveFactor / precisionFactor;

    const totalSize = Math.ceil(virtualTotal / effectiveFactor);
    const offset = Math.ceil(propOffset / effectiveFactor);
    const viewportSize = Math.ceil(propViewportSize / effectiveFactor);
    const retValue = {
      offset, totalSize, viewportSize,
      scaledOffset: propOffset,
      scaledTotalSize: propTotalSize,
      scaledViewportSize: propViewportSize,
      factor: effectiveFactor,
      precision: effectivePrecision
     }
    return retValue;
  }, [propOffset, propTotalSize, propViewportSize, isDraggingScroll, minSize, endGap, endScrollIncrement]);

  const handleOnScrollOffset = useCallbackRef((offsetPhysical: number, _viewportSizePhysical: number, _totalSizePhysical: number) => {
    /**
     * Because our physical scrollbar is not as large and logical we probably lose precision
     */
    const offset = bounds.offset;
    if (Math.abs(offsetPhysical - offset) < bounds.precision) {
      offsetPhysical = offset;
    }

    propOnScrollOffset?.(offsetPhysical * bounds.factor, offset, bounds.viewportSize);
  }, [propOnScrollOffset, bounds]);

  // Thumb dragged to the track end and HELD: extend past the elastic region toward the real end. The
  // drag engine supplies the heartbeat (and hold metadata) — the elastic policy lives entirely here:
  // each tick advances the REAL offset by endScrollIncrement, accelerating with hold time, and the
  // region re-derives from the new offset (the thumb stays pinned under the pointer). Returns false at
  // the real clamp so the ticking stops.
  const handleThumbEdgeHold = useCallbackRef((edge: -1 | 1, tick: TrackEdgeTick): boolean => {
    // 1× → 4× across the first 3 s of hold — long sheets speed up, a short hold stays precise.
    const accel = 1 + Math.min(3, tick.heldMs / 1000);
    const maxOffset = Math.max(0, bounds.scaledTotalSize - bounds.scaledViewportSize);
    const next = Math.min(maxOffset, Math.max(0, bounds.scaledOffset + edge * endScrollIncrement * accel));
    if (next === bounds.scaledOffset) return false; // parked at the real end (or start)
    propOnScrollOffset?.(next, bounds.scaledViewportSize, bounds.scaledTotalSize);
    return true;
  }, [bounds, endScrollIncrement, propOnScrollOffset]);

  // Consume the drag lifecycle for the elastic pin AND pass it through — it's a generic event the
  // client also observes (e.g. the sheet anchors a "Row: N" tooltip to event.element during any
  // thumb/grip drag).
  const handleThumbDrag = useCallbackRef((event: ThumbDragEvent) => {
    setDraggingScroll(event.dragging);
    propOnThumbDrag?.(event);
  }, [propOnThumbDrag]);

  const handleMouseMove = useCallback((_e: globalThis.MouseEvent) => {
  }, []);
  /**
   * When user releases mouse
   */
  const handleMouseUp = useCallback((_e: globalThis.MouseEvent) => {
    /* Remove listener */
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);

    setDraggingScroll(false);
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    setDraggingScroll(true);

    onMouseDown?.(event);

    document.addEventListener("mousemove", handleMouseMove, {
      passive: true,
    });
    document.addEventListener("mouseup", handleMouseUp, {
      passive: true,
    });
  }, [handleMouseMove, handleMouseUp]);

  return <RenderSlot render={renderScrollbar} props={{
    style: propStyle,
    ...rest,
    offset: bounds.offset,
    totalSize: bounds.totalSize,
    viewportSize: bounds.viewportSize,
    onMouseDown: handleMouseDown,
    onScrollOffset: handleOnScrollOffset,
    onThumbEdgeHold: handleThumbEdgeHold,
    // Explicit drag lifecycle (desktop thumb + touch grip): pins the elastic region for the drag's
    // duration and forwards to the client. The mouse-event path above stays as a belt-and-suspenders
    // for track interactions.
    onThumbDrag: handleThumbDrag,
    ref: refForwarded
  }} />;
}));

VirtualScrollbar.displayName = 'VirtualScrollbar';