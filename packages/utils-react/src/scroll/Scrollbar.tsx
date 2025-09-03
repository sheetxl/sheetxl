import React, {
  memo, forwardRef, useState, useMemo, useRef, useCallback, useEffect
} from 'react';

import clsx from 'clsx';
import { useMeasure } from 'react-use';

import { useCallbackRef } from '../hooks/useCallbackRef';

import {
  ScrollButtonProps, defaultCreateScrollStartButton, defaultCreateScrollEndButton
} from './ScrollButton';
import { getScrollTo } from './scrollUtils';

import { ScrollbarOrientation, type ScrollbarProps } from './IScrollbar';

import styles from './Scrollbar.module.css';

const Scrollbar = memo(forwardRef<HTMLDivElement, ScrollbarProps>((props: ScrollbarProps, refForwarded) => {
  const {
    offset: propOffset=0,
    totalSize: propTotalSize=0,
    viewportSize: propViewportSize=0,
    style: propStyle,
    className: propClassName,
    orientation=ScrollbarOrientation.Vertical,
    onScrollOffset,
    onScroll: propOnScroll,
    showCustomScrollButtons = false,
    scrollButtonIncrement = 200,
    scrollButtonInitialRepeatDelay = 260,
    scrollButtonAdditionalRepeatDelay = 120, // we make first time slightly longer to similar a delayed start
    createScrollStartButton = defaultCreateScrollStartButton,
    createScrollEndButton = defaultCreateScrollEndButton,
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

  const scrollStart = useCallback((jumpTo:number, isJump: boolean=false) => {
    if (!refScrollPane.current)
      return 0;
    const firstChild = refScrollPane.current.querySelector('.scrollbar-viewport');
    const refLocation = firstChild.getBoundingClientRect();
    const children = firstChild.children;

    const min = 0;
    const newStart:number = isJump ? min : getScrollTo(jumpTo, refLocation[dimStart], children, true, Math.max(0, jumpTo - scrollButtonIncrement));

    setScrollScrolling(newStart);
    return Math.max(min, newStart);
  }, []);

  const scrollEnd = useCallback((jumpTo:number, isJump: boolean=false) => {
    if (!refScrollPane.current)
      return 0;
    const firstChild = refScrollPane.current.querySelector('.scrollbar-viewport');
    const refLocation = firstChild.getBoundingClientRect();
    const children = firstChild.children;

    const max =  Math.ceil(lengthViewport - lengthContainer);
    const newEnd = isJump ? max : getScrollTo(jumpTo, refLocation[dimStart], children, false, Math.max(0, jumpTo + scrollButtonIncrement));

    setScrollScrolling(newEnd);
    return Math.min(max, newEnd);
  }, [lengthViewport, lengthContainer]);

  const refOffsetInFlight = useRef<number | null>(null);
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    refOffsetInFlight.current = propOffset;

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
    refOffsetInFlight.current = null;
    if (propOffset === lastPropInFlight) {
      return;
    }

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



  const scrollOffset = propOffset;
  // useEffect(() => {
  //   refScrollPane.current[dimScrollStart] = scrollOffset;
  // }, [scrollOffset, dimScrollStart])

  const scrollStartButton = useMemo(() => {
    if (!showCustomScrollButtons) return null;
    const props:ScrollButtonProps = {
      orientation,
      disabled: ((Math.floor(scrollOffset) <= 0) || (Math.floor(lengthViewport - lengthContainer) === 0)),
      onMouseUp:stopScrolling,
      onMouseLeave:stopScrolling,
      onMouseDown:() => startScrolling(scrollOffset, true, true),
    }

    return createScrollStartButton?.(props);
  }, [showCustomScrollButtons, orientation, scrollOffset, scrollScrolling, lengthViewport, lengthContainer]);

  const scrollEndButton = useMemo(() => {
    if (!showCustomScrollButtons) return null;
    const props:ScrollButtonProps = {
      orientation,
      disabled: (Math.floor(lengthViewport - lengthContainer) <= Math.ceil(scrollOffset)),
      onMouseUp:stopScrolling,
      onMouseLeave:stopScrolling,
      onMouseDown:() => startScrolling(scrollOffset, true, false),
    }
    return createScrollEndButton?.(props);
  }, [showCustomScrollButtons, orientation, scrollOffset, scrollScrolling, lengthViewport, lengthContainer]);

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

Scrollbar.displayName = 'Scrollbar';
export { Scrollbar };