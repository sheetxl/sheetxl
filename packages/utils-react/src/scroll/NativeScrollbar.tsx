import React, {
  memo, forwardRef, useState, useMemo, useRef, useCallback, useEffect
} from 'react';

import clsx from 'clsx';
import { useMeasure } from 'react-use';

import { useCallbackRef } from '../hooks/useCallbackRef';

import {
  ScrollButtonProps, defaultCreateScrollStartButton, defaultCreateScrollEndButton
} from './ScrollButton';
import { getScrollTo } from './Utils';

import { ScrollbarOrientation, type ScrollbarProps } from './IScrollbar';

import styles from './Scrollbar.module.css';

/**
 * Honors the scroll interface but uses native scrollbars.
 */
export const NativeScrollbar = memo(forwardRef<HTMLDivElement, ScrollbarProps>((props: ScrollbarProps, refForwarded) => {
  const {
    offset: propOffset=0,
    totalSize: propTotalSize=0,
    viewportSize: propViewportSize=0,
    style: propStyle,
    className: propClassName,
    orientation = ScrollbarOrientation.Vertical,
    onScrollOffset,
    onScroll: propOnScroll,
    showCustomScrollButtons = false,
    scrollButtonIncrement = 200,
    scrollButtonInitialRepeatDelay = 260,
    scrollButtonAdditionalRepeatDelay = 120, // we make first time slightly longer to similar a delayed start
    renderScrollButtonStart = defaultCreateScrollStartButton,
    renderScrollButtonEnd = defaultCreateScrollEndButton,
    ...rest
  } = props;
  const onScroll = useCallbackRef(propOnScroll, [propOnScroll]);

  const refScrollPane = useRef<HTMLDivElement>(null);
  const [refMeasureContainer, { width:widthContainer, height:heightContainer }] = useMeasure<HTMLDivElement>();
  const [refMeasureViewport, { width:widthViewport, height: heightViewport }] = useMeasure<HTMLDivElement>();

  const isVertical = orientation === ScrollbarOrientation.Vertical;
  const dimStart = isVertical ? 'top' : 'left';
  const dimScrollStart = isVertical ? 'scrollTop' : 'scrollLeft';
  const lengthContainer = isVertical ? heightContainer : widthContainer;
  const lengthViewport = isVertical ? heightViewport : widthViewport;

  const [scrollScrolling, setScrollScrolling] = useState<number | null>(null);
  // const [scrollOffset, setScrollOffset] = useState<number | null>(0);

  useEffect(() => {
    if (scrollScrolling === null || !refScrollPane.current)
      return;
    refScrollPane.current.scrollTo({
      behavior: 'smooth',
      [dimStart] : scrollScrolling
    });
  }, [scrollScrolling, isVertical]);

  const scrollStart = useCallback((jumpTo: number, isJump: boolean=false) => {
    if (!refScrollPane.current)
      return 0;
    const firstChild = refScrollPane.current.querySelector('.scrollbar-viewport');
    const refLocation = firstChild.getBoundingClientRect();
    const children = firstChild.children;

    let offsetTo: number;
    if (typeof scrollButtonIncrement === 'function') {
      offsetTo = scrollButtonIncrement(propOffset, propViewportSize, propTotalSize);
    } else {
      offsetTo = scrollButtonIncrement;
    }

    const min = 0;
    const newStart:number = isJump ? min : getScrollTo(jumpTo, refLocation[dimStart], children, true, Math.max(0, jumpTo - offsetTo));

    setScrollScrolling(newStart);
    return Math.max(min, newStart);
  }, []);

  const scrollEnd = useCallback((jumpTo: number, isJump: boolean=false) => {
    if (!refScrollPane.current)
      return 0;
    const firstChild = refScrollPane.current.querySelector('.scrollbar-viewport');
    const refLocation = firstChild.getBoundingClientRect();
    const children = firstChild.children;

    let offsetTo: number;
    if (typeof scrollButtonIncrement === 'function') {
      offsetTo = scrollButtonIncrement(propOffset, propViewportSize, propTotalSize);
    } else {
      offsetTo = scrollButtonIncrement;
    }

    const max =  Math.ceil(lengthViewport - lengthContainer);
    const newEnd = isJump ? max : getScrollTo(jumpTo, refLocation[dimStart], children, false, Math.max(0, jumpTo + offsetTo));

    setScrollScrolling(newEnd);
    return Math.min(max, newEnd);
  }, [lengthViewport, lengthContainer]);

  const refOffsetInFlight = useRef<number | null>(null);
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const lastPropInFlight = refOffsetInFlight.current;
    if (lastPropInFlight !== null) {
      refOffsetInFlight.current = null;
      return;
    }

    const newScrollOffset = e.target[dimScrollStart];
    onScrollOffset(newScrollOffset, propViewportSize, propTotalSize);
    onScroll?.(e);
  }, [onScrollOffset, propViewportSize, propTotalSize, propOffset]);

  // Note - Changing this to useLayoutEffect causes issues too. Review.
  useEffect(() => {
    // setScrollOffset(propOffset ?? 0);

    // Because we get propOffset events on a render and these can and often come from our handle event
    // we track the offset when we fired our event and don't re-scroll if it's stale
    const lastPropInFlight = refOffsetInFlight.current;
    if (propOffset === lastPropInFlight) return;
    const currentScrollStart = refScrollPane.current[dimScrollStart];
    if (currentScrollStart === propOffset) return;

    refOffsetInFlight.current = propOffset;
    refScrollPane.current[dimScrollStart] = propOffset;
  }, [propOffset, dimScrollStart]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollingToRef = useRef<number | null>(null);
  const stopScrolling = useCallback(() => {
    if (!timerRef.current) return;

    clearTimeout(timerRef.current);
    timerRef.current = null;
    scrollingToRef.current = null;
  }, []);

  const startScrolling = useCallback((start:number, isFirst:boolean, scrollToStart:boolean, delay:number=scrollButtonInitialRepeatDelay) => {
    scrollingToRef.current = start;
    timerRef.current = setTimeout(() => {
      const newScroll = scrollToStart ? scrollStart(scrollingToRef.current || start) : scrollEnd(scrollingToRef.current || start);
      if (newScroll === scrollingToRef.current) {
        stopScrolling();
        return;
      }

      startScrolling(newScroll, false, scrollToStart, scrollButtonAdditionalRepeatDelay);
    }, isFirst ? 0 : delay);
  }, [scrollStart, scrollEnd, stopScrolling]);

  useEffect(() => {
    return () => stopScrolling(); // when unmounted, stop counter
  }, [stopScrolling]);


  // const scrollOffset = propOffset;

  const scrollStartButton = useMemo(() => {
    if (!showCustomScrollButtons) return null;
    const props:ScrollButtonProps = {
      orientation,
      disabled: ((Math.floor(propOffset) <= 0) || (Math.floor(lengthViewport - lengthContainer) === 0)),
      onMouseUp:stopScrolling,
      onMouseLeave:stopScrolling,
      onMouseDown:() => startScrolling(propOffset, true, true),
    }

    return renderScrollButtonStart?.(props);
  }, [showCustomScrollButtons, orientation, propOffset, scrollScrolling, lengthViewport, lengthContainer]);

  const scrollEndButton = useMemo(() => {
    if (!showCustomScrollButtons) return null;
    const props:ScrollButtonProps = {
      orientation,
      disabled: (Math.floor(lengthViewport - lengthContainer) <= Math.ceil(propOffset)),
      onMouseUp:stopScrolling,
      onMouseLeave:stopScrolling,
      onMouseDown:() => startScrolling(propOffset, true, false),
    }
    return renderScrollButtonEnd?.(props);
  }, [showCustomScrollButtons, orientation, propOffset, scrollScrolling, lengthViewport, lengthContainer]);

  return (
    <div
      ref={refForwarded}
      style={{
        display: 'flex',
        flex: '1',
        flexDirection: isVertical ? 'column' : 'row',
        padding: '0',
        ...propStyle
      }}
      className={clsx(styles['sheetxl-scrollbar'], propClassName)}
      {...rest}
    >
      {scrollStartButton}
      <div
        className='pseudo-scrollbar'
        style={{
          flex: '1 1 100%',
          display:'flex',
          boxSizing: 'content-box',
          flexDirection: isVertical ? 'column' : 'row',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        ref={refMeasureContainer}
      >
        <div
          tabIndex={-1}
          style={{
            flex:'1 1 100%',
            overflowY: isVertical ? 'scroll' : 'hidden',
            overflowX: isVertical ? 'hidden' : 'scroll',
            // width: isVertical ? '100%' : undefined,
            // height: isVertical ? undefined : '100%',
            position: 'relative',
            willChange: 'transform'
          }}
          onScroll={handleScroll}
          ref={refScrollPane}
        >
          <div
            ref={refMeasureViewport}
            style={{
              position: 'absolute',
              height: isVertical ? (propTotalSize - propViewportSize + (heightContainer ?? 0)) : 1,
              width: isVertical ? 1 : (propTotalSize - propViewportSize + (widthContainer ?? 0)),
            }}
            className='scrollbar-viewport'
          />
        </div>
      </div>
      {scrollEndButton}
    </div>
  );
}));

NativeScrollbar.displayName = 'NativeScrollbar';