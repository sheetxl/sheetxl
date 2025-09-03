import React, {memo, forwardRef, useCallback, useState, useLayoutEffect, useRef
} from 'react';

import { ReactUtils } from '../utils';

import { useCallbackRef } from '../hooks/useCallbackRef';
import type { ScrollbarProps } from './IScrollbar';
import { Scrollbar } from './Scrollbar';

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
}

const DEFAULT_GAP = 100;
const DEFAULT_SCROLL_INCREMENT = 100;

// Set to zero to disable elastic scroll
const DEFAULT_SCALE_LIMIT = 1000000; // 1,000,000
const DEFAULT_SCALE_FACTOR = 100;
const DEFAULT_PRECISION_ADJUST = 50;

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
const VirtualScrollbar = memo(forwardRef<HTMLDivElement, VirtualScrollbarProps>((props: VirtualScrollbarProps, refForwarded) => {
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
    ...rest
  } = props;
  if (propOnScroll) {
    // onScroll disabled because scrollTop, scrollLeft would be incorrect.
    console.warn('onScroll not supported for VirtualScrollbar. Use onScrollOffset instead');
  }

  const onMouseDown = useCallbackRef(propOnMouseDown, [propOnMouseDown]);

  const calcElastic = () => {
    return {
      offset: propOffset,
      totalSize: scaleLimit === 0 ? propTotalSize : Math.min(propTotalSize ?? 0, Math.max(minSize ?? 0, (propOffset ?? 0) + (propViewportSize ?? 0)) + (endGap ?? 0))
    }
  };
  const [elasticProps, setElasticProps] = useState(calcElastic);

  const effectiveFactor = scaleLimit !== 0 && elasticProps.totalSize > scaleLimit ? scaleFactor : 1;
  const effectivePrecision = effectiveFactor / precisionFactor;
  const totalSize = Math.ceil(elasticProps.totalSize / effectiveFactor);
  const offset = Math.ceil(elasticProps.offset / effectiveFactor);
  const viewportSize = Math.ceil(propViewportSize / effectiveFactor);

  const handleMouseMove = useCallback((_e: globalThis.MouseEvent) => {
  }, []);

  const [isDraggingScroll, setDraggingScroll] = useState(false);
  const viewportInFlight = useRef(null);
  useLayoutEffect(() => {
    if (!isDraggingScroll) {
      viewportInFlight.current = {
        propTotalSize, propViewportSize, propOffset
      }
      const newElastic = calcElastic();
      setElasticProps(newElastic);
    }
  }, [propTotalSize, propViewportSize, propOffset, isDraggingScroll, minSize, endGap, endScrollIncrement]);

  const handleOnScrollOffset = useCallbackRef((offsetPhysical: number, _viewportSizePhysical: number, _totalSizePhysical: number) => {
    /**
     * Because our physical scrollbar is not as large and logical we probably lose precision
     */
    const inFlight = viewportInFlight.current;
    viewportInFlight.current = null;
    if (inFlight &&
      inFlight.propTotalSize === propTotalSize &&
      inFlight.propViewportSize === propViewportSize &&
      inFlight.propOffset === propOffset
    ) {
      return;
    }

    if (Math.abs(offsetPhysical - offset) < effectivePrecision) {
      offsetPhysical = offset;
    }

    propOnScrollOffset?.(offsetPhysical * effectiveFactor, offset, viewportSize);
  }, [propOnScrollOffset, effectiveFactor, effectivePrecision, offset, viewportSize]);

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
    onMouseDown?.(e);

    setDraggingScroll(true);
    document.addEventListener("mousemove", handleMouseMove, {
      passive: true,
    });
    document.addEventListener("mouseup", handleMouseUp, {
      passive: true,
    });
  }, [handleMouseMove, handleMouseUp]);

  return (
    <Scrollbar // Note - the default scrollbar is 5 and horizontal is 25px high. To make these the same size we should use 5px
      ref={refForwarded}
      style={{
        ...propStyle
      }}
      {...rest}
      offset={offset}
      totalSize={totalSize}
      viewportSize={viewportSize}
      onMouseDown={handleMouseDown}
      onScrollOffset={handleOnScrollOffset}
    />
  );
}));

VirtualScrollbar.displayName = 'VirtualScrollbar';
export { VirtualScrollbar };