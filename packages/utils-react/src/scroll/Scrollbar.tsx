import React, {
  memo, forwardRef, useMemo, useRef, useCallback, useEffect, useState
} from 'react';

import clsx from 'clsx';
import { mergeRefs } from 'react-merge-refs';
import { useMeasure } from 'react-use';

import { useCallbackRef, useImperativeElement } from '../hooks';
import { ReactUtils } from '../utils';

import {
  ScrollbarOrientation, type ScrollbarProps, type IScrollbarElement, type IScrollbarAttributes
} from './IScrollbar';
import {
  type ScrollButtonProps, defaultCreateScrollStartButton, defaultCreateScrollEndButton
} from './ScrollButton';
import { TouchThumbHandle } from './TouchThumbHandle';

import styles from './Scrollbar.module.css';

const DEFAULT_MIN_THUMB_PX = 24; // touch target

export const Scrollbar = memo(forwardRef<IScrollbarElement, ScrollbarProps>(
  (props: ScrollbarProps, refForwarded) => {
  const {
    offset: propOffset = 0,
    totalSize: propTotalSize = 0,         // total rows or total columns
    viewportSize: propViewportSize = 0,   // visible rows or columns
    style: propStyle,
    className: propClassName,
    orientation = ScrollbarOrientation.Vertical,
    onScrollOffset: propOnScrollOffset,
    onScroll: propOnScroll,
    showCustomScrollButtons: propShowCustomScrollButtons,
    scrollButtonIncrement = 200,
    scrollButtonInitialRepeatDelay = 260,
    scrollButtonAdditionalRepeatDelay = 120, // we make first time slightly longer to similar a delayed start
    minThumbSize = DEFAULT_MIN_THUMB_PX,
    maxThumbSize,
    renderScrollButtonStart = defaultCreateScrollStartButton,
    renderScrollButtonEnd = defaultCreateScrollEndButton,
    propsTouchThumb,
    propsThumb,
    onMouseDown: propOnMouseDown,
    ...rest
  } = props;

  const isTouch = ReactUtils.detectIt().primaryInput === 'touch';

  const showCustomScrollButtons = propShowCustomScrollButtons ?? !isTouch;
  const onScroll = useCallbackRef(propOnScroll, [propOnScroll]);

  const [thumb, setThumb] = useState({ offset: 0, length: 0, disabled: false }); // MIN_THUMB_PX
  const refInFlight = useRef<number>(-1);

  const isVertical = orientation === ScrollbarOrientation.Vertical;
  const [refMeasure, { width: widthMeasure, height: heightMeasure }] = useMeasure<HTMLDivElement>();
  const trackLength = isVertical ? heightMeasure : widthMeasure;

  const calcThumb = useCallbackRef((
    offset: number, viewportSize: number, totalSize: number
  ) => {
    if (viewportSize === 0 || totalSize === 0) {
      const newThumb = { offset: 0, length: minThumbSize, disabled: true };
      setThumb(newThumb);
      return newThumb;
    }
    if (viewportSize >= totalSize) {
      return { offset: 0, length: trackLength, disabled: true };
    }
    const totalProportional = totalSize / trackLength;
    const newViewPort = viewportSize / totalProportional;
    const newThumbLength = Math.min(Math.max(minThumbSize, newViewPort), Math.min(trackLength, maxThumbSize ?? Number.MAX_SAFE_INTEGER));

    const newOffset = offset / totalProportional;
    const newBoundOffset = Math.min(Math.max(0, newOffset), trackLength - newThumbLength);
    // console.log('calcThumb', 'offset', offset, 'physicalOffset', newBoundOffset, 'newThumbLength', newThumbLength, 'viewportSize', viewportSize, 'totalSize', totalSize, 'trackLength', trackLength, 'totalProportional', totalProportional);
    return { offset: newBoundOffset, length: newThumbLength, disabled: false };
  }, [trackLength, minThumbSize, maxThumbSize]);

  const handlePhysicalScroll = useCallbackRef((
    offset: number
  ) => {
    const proportional = propTotalSize / trackLength;
    // console.log('handlePhysicalScroll', offset * proportional, viewportSize, totalSize);
    const scaledOffset = Math.round(offset * proportional);
    setThumb(calcThumb(scaledOffset, propViewportSize, propTotalSize));
    propOnScrollOffset?.(scaledOffset, propViewportSize, propTotalSize);
    refInFlight.current = offset;
  }, [propOnScrollOffset, propViewportSize, propTotalSize, trackLength, thumb]);

  const handleLogicalScroll = useCallbackRef((
    offset: number
  ) => {
    setThumb(calcThumb(offset, propViewportSize, propTotalSize));
    propOnScrollOffset?.(offset, propViewportSize, propTotalSize);
    refInFlight.current = offset;
  }, [propOnScrollOffset, propViewportSize, propTotalSize]);

  useEffect(() => {
    if (refInFlight.current === propOffset || trackLength === 0) return;
    refInFlight.current = -1;
    setThumb(calcThumb(propOffset, propViewportSize, propTotalSize));
  }, [propOffset]);

  useEffect(() => {
    if (trackLength === 0) return;
    setThumb(calcThumb(propOffset, propViewportSize, propTotalSize));
  }, [propViewportSize, propTotalSize, isVertical, trackLength]);

  // Compute thumb size and position from props
  const maxOffset = Math.max(0, propTotalSize - propViewportSize);

  const [dragging, setDragging] = useState(false);
  const dragStartPxRef = useRef(0);
  const dragStartPosPxRef = useRef(0);

  const refLocal = useImperativeElement<IScrollbarElement, IScrollbarAttributes>(refForwarded, () => ({
    isScrollbar: () => true,
    // scrollTo: (args: any) => {
    //   // refGridHeader.current?.scrollTo(args)
    // },
  }), []);

  const processPointerDown = useCallbackRef((e: React.PointerEvent) => {
    setDragging(true);
    dragStartPxRef.current = isVertical ? e.clientY : e.clientX;
    dragStartPosPxRef.current = thumb.offset;
    // handlePhysicalScroll(thumb.offset, propViewportSize, propTotalSize);
  }, [isVertical, thumb]);

  const onThumbPointerDown = useCallbackRef((e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    processPointerDown(e);
    // e.preventDefault();
    e.stopPropagation();
  }, [propOnMouseDown]);

  const processPointerMove = useCallbackRef((e: React.PointerEvent) => {
    if (!dragging) return;
    const now = isVertical ? e.clientY : e.clientX;
    const delta = now - dragStartPxRef.current;
    const pixel = dragStartPosPxRef.current + delta;
    handlePhysicalScroll(pixel);
  }, [dragging, isVertical]);

  const onThumbPointerMove = useCallbackRef((e: React.PointerEvent) => {
    processPointerMove(e);
  }, []);

  const processPointerUp = useCallbackRef((e: React.PointerEvent) => {
    setDragging(false);
  }, []);

  const onThumbPointerUp = useCallbackRef((e: React.PointerEvent) => {
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch {}
    processPointerUp(e);
  }, []);

  const onTrackPointerDown = useCallbackRef((e: React.PointerEvent) => {
    if (!e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offset = isVertical ? e.clientY - rect.top : e.clientX - rect.left;
    handlePhysicalScroll(offset);
  }, [isVertical, thumb, propViewportSize, propTotalSize]);

  // Keyboard (accessibility)
  const onKeyDown = useCallbackRef((e: React.KeyboardEvent) => {
    const line = 1;
    const page = Math.max(1, Math.floor(propViewportSize * 0.9));
    if (isVertical) {
      if (e.key === 'ArrowDown') handlePhysicalScroll(Math.min(maxOffset, propOffset + line));
      if (e.key === 'ArrowUp')   handlePhysicalScroll(Math.max(0, propOffset - line));
      if (e.key === 'PageDown')  handlePhysicalScroll(Math.min(maxOffset, propOffset + page));
      if (e.key === 'PageUp')    handlePhysicalScroll(Math.max(0, propOffset - page));
      if (e.key === 'Home')      handlePhysicalScroll(0);
      if (e.key === 'End')       handlePhysicalScroll(maxOffset);
    } else {
      if (e.key === 'ArrowRight') handlePhysicalScroll(Math.min(maxOffset, propOffset + line));
      if (e.key === 'ArrowLeft')  handlePhysicalScroll(Math.max(0, propOffset - line));
      if (e.key === 'PageDown')   handlePhysicalScroll(Math.min(maxOffset, propOffset + page));
      if (e.key === 'PageUp')     handlePhysicalScroll(Math.max(0, propOffset - page));
      if (e.key === 'Home')       handlePhysicalScroll(0);
      if (e.key === 'End')        handlePhysicalScroll(maxOffset);
    }
  }, [isVertical, propViewportSize, propTotalSize, propOffset, maxOffset]);

  const refThumbEl = useRef<HTMLDivElement>(null);
  // Thumb element (Portal optional for mobile z-index)
  const thumbEl = useMemo(() => {
    const disabled = thumb.disabled;
    if (disabled) return null; // later we can style thumb
    const thumbInline = (
      <div
        {...propsThumb}
        className={clsx(styles['thumb'], {
          'disabled': disabled
        })}
        ref={refThumbEl}
        role="slider"
        aria-label={isVertical ? 'Rows' : 'Columns'}
        aria-orientation={isVertical ? 'vertical' : 'horizontal'}
        aria-valuemin={0}
        aria-valuemax={maxOffset}
        aria-valuenow={propOffset}
        tabIndex={0}
        style={{
          ...propsThumb?.style,
          position: 'relative',
          [isVertical ? 'height' : 'width']: `${thumb.length}px`,
          [isVertical ? 'width' : 'height']: '100%',
          transform: isVertical ? `translateY(${thumb.offset}px)` : `translateX(${thumb.offset}px)`,
          [isVertical ? 'minHeight' : 'minWidth']: `${minThumbSize}px`,
        } as React.CSSProperties }
        onMouseDown={propOnMouseDown}
        onPointerDown={onThumbPointerDown}
        onPointerMove={onThumbPointerMove}
        onPointerUp={onThumbPointerUp}
      />
    );
    if (!isTouch || disabled) return thumbInline;

    return (<>
      {thumbInline}
      <TouchThumbHandle
        {...propsTouchThumb}
        offset={thumb.offset}
        // length={thumb.length}
        orientation={isVertical ? ScrollbarOrientation.Vertical : ScrollbarOrientation.Horizontal}
        onPointerDown={processPointerDown}
        onPointerMove={processPointerMove}
        onPointerUp={processPointerUp}
      />
    </>
    )
  }, [thumb, minThumbSize, maxOffset, propOffset, isVertical, isTouch, propOnMouseDown, propsTouchThumb, propsThumb]);

  const [scrollScrolling, setScrollScrolling] = useState<number | null>(null);

  const scrollStart = useCallbackRef(() => {
    let offsetTo: number;
    if (typeof scrollButtonIncrement === 'function') {
      offsetTo = scrollButtonIncrement(propOffset, propViewportSize, propTotalSize);
    } else {
      offsetTo = propOffset - scrollButtonIncrement;
    }
    const newOffset = Math.max(0, offsetTo);

    handleLogicalScroll(newOffset);
    setScrollScrolling(newOffset);
    return newOffset;
  }, [scrollButtonIncrement, propOffset, propViewportSize, propTotalSize]);

  const scrollEnd = useCallbackRef(() => {
    let offsetTo: number;
    if (typeof scrollButtonIncrement === 'function') {
      offsetTo = scrollButtonIncrement(propOffset, propViewportSize, propTotalSize);
    } else {
      offsetTo = propOffset + scrollButtonIncrement;
    }

    const newOffset = Math.min(maxOffset, offsetTo);
    handleLogicalScroll(newOffset);
    setScrollScrolling(newOffset);
    return newOffset;
  }, [scrollButtonIncrement, propOffset, maxOffset, propViewportSize, propTotalSize]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollingToRef = useRef<number | null>(null);
  const stopScrolling = useCallback(() => {
    if (!timerRef.current) return;

    clearTimeout(timerRef.current);
    timerRef.current = null;
    scrollingToRef.current = null;
  }, []);

  const startScrolling = useCallback((start: number, isFirst: boolean, scrollToStart: boolean, delay: number = scrollButtonInitialRepeatDelay) => {
    scrollingToRef.current = start;
    timerRef.current = setTimeout(() => {
      const newScroll = scrollToStart ? scrollStart() : scrollEnd();
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

  const scrollStartButton = useMemo(() => {
    if (!showCustomScrollButtons) return null;
    const props:ScrollButtonProps = {
      orientation,
      disabled: propOffset <= 0,
      onMouseUp:stopScrolling,
      onMouseLeave:stopScrolling,
      onMouseDown:() => startScrolling(propOffset, true, true),
    }

    return renderScrollButtonStart?.(props);
  }, [showCustomScrollButtons, orientation, propOffset, scrollScrolling]);

  const scrollEndButton = useMemo(() => {
    if (!showCustomScrollButtons) return null;
    const props:ScrollButtonProps = {
      orientation,
      disabled: propOffset >= maxOffset,
      onMouseUp:stopScrolling,
      onMouseLeave:stopScrolling,
      onMouseDown:() => startScrolling(propOffset, true, false),
    }
    return renderScrollButtonEnd?.(props);
  }, [showCustomScrollButtons, orientation, propOffset, maxOffset, scrollScrolling]);


  const directionClassName = isVertical ? 'vertical' : 'horizontal';
  return (
    <div
      ref={mergeRefs([refLocal, refForwarded])}
      className={
        clsx(propClassName,
          styles['scrollbar'],
          directionClassName,
          {
          'dragging': dragging,
          'has-touch-thumb': isTouch,
        })}
      style={propStyle}
      {...rest}
    >
      {scrollStartButton}
      <div
        ref={refMeasure}
        role="scrollbar"
        aria-orientation={directionClassName}
        aria-valuemin={0}
        aria-valuemax={maxOffset}
        aria-valuenow={propOffset}
        tabIndex={0}
        className={clsx(styles['track'], 'track', directionClassName)}
        onMouseDown={propOnMouseDown}
        onPointerDown={onTrackPointerDown}
        onKeyDown={onKeyDown}
      >
        {thumbEl}
      </div>
      {scrollEndButton}
    </div>
  );
}));
