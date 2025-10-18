import React, {
  memo, forwardRef, useCallback, useState, useMemo
} from 'react';

import { ReactUtils } from '../utils';

import { useCallbackRef } from '../hooks/useCallbackRef';
import type { IScrollbarElement, ScrollbarProps } from './IScrollbar';

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

  renderScrollbar?: (props: ScrollbarProps) => React.ReactNode,
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

  const onMouseDown = useCallbackRef(propOnMouseDown, [propOnMouseDown]);

  const [isDraggingScroll, setDraggingScroll] = useState(false);

  const bounds: VirtualBounds = useMemo(() => {
    const virtualTotal = scaleLimit === 0 ? propTotalSize : Math.min(propTotalSize ?? 0, Math.max(minSize ?? 0, (propOffset ?? 0) + (propViewportSize ?? 0)) + (endGap ?? 0));
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

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setDraggingScroll(true);

    onMouseDown?.(e);

    document.addEventListener("mousemove", handleMouseMove, {
      passive: true,
    });
    document.addEventListener("mouseup", handleMouseUp, {
      passive: true,
    });
  }, [handleMouseMove, handleMouseUp]);

  return renderScrollbar({
    style: propStyle,
    ...rest,
    offset: bounds.offset,
    totalSize: bounds.totalSize,
    viewportSize: bounds.viewportSize,
    onMouseDown: handleMouseDown,
    onScrollOffset: handleOnScrollOffset,
    ref: refForwarded
  });
}));

VirtualScrollbar.displayName = 'VirtualScrollbar';