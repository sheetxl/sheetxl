import type React from 'react';
import {
  memo, forwardRef, useMemo, useRef, useCallback, useEffect, useState
} from 'react';

import clsx from 'clsx';
import { useMergeRefs } from 'react-merge-refs';

import { useMeasure, useCallbackRef, useImperativeElement, useInputModality } from '../hooks';
import { RenderSlot } from '../components';

import {
  ScrollbarOrientation, type ScrollbarProps, type IScrollbarElement, type IScrollbarAttributes
} from './IScrollbar';
import {
  type ScrollButtonProps, defaultRenderScrollButtonStart, defaultRenderScrollButtonEnd
} from './ScrollButton';
import { TouchThumbHandle } from './TouchThumbHandle';
import { useTrackDrag, type TrackDragSession, type TrackDragZone } from './TrackDrag';

import styles from './Scrollbar.module.css';
import themeStyles from './ScrollbarTheme.module.css';

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
    renderScrollButtonStart = defaultRenderScrollButtonStart,
    renderScrollButtonEnd = defaultRenderScrollButtonEnd,
    propsTouchThumb,
    propsThumb,
    onThumbEdgeHold: propOnThumbEdgeHold,
    onThumbDrag: propOnThumbDrag,
    onMouseDown: propOnMouseDown,
    ...rest
  } = props;

  // Live: the touch thumbs appear after a finger's press and the desktop bar after a mouse's.
  const isTouch = useInputModality() === 'touch';

  const showCustomScrollButtons = propShowCustomScrollButtons ?? !isTouch;
  const onScroll = useCallbackRef(propOnScroll ?? (() => {}), [propOnScroll]);

  const [thumb, setThumb] = useState({ offset: 0, length: 0, disabled: false }); // MIN_THUMB_PX
  const refInFlight = useRef<number>(-1);

  const isVertical = orientation === ScrollbarOrientation.Vertical;
  const [refMeasure, { width: widthMeasure, height: heightMeasure }] = useMeasure<HTMLDivElement>();
  const trackLength = isVertical ? heightMeasure : widthMeasure;
  const refTrack = useRef<HTMLDivElement>(null);
  const refTrackMerged = useMergeRefs<HTMLDivElement>([refMeasure, refTrack]);

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

  const refLocal = useImperativeElement<IScrollbarElement, IScrollbarAttributes>(refForwarded, () => ({
    isScrollbar: () => true,
    // scrollTo: (args: any) => {
    //   // refGridHeader.current?.scrollTo(args)
    // },
  }), []);

  // One drag engine serves the whole track surface: a press is zone hit-tested (thumb vs track) and the
  // session supplies the policy. The engine owns capture, the hold timers, and the dragMode signal.
  const pageScroll = useCallbackRef((direction: -1 | 1) => {
    // Same step the keyboard PageUp/PageDown path uses.
    const page = Math.max(1, Math.floor(propViewportSize * 0.9));
    const target = direction > 0
      ? Math.min(maxOffset, propOffset + page)
      : Math.max(0, propOffset - page);
    handleLogicalScroll(target);
  }, [propViewportSize, propOffset, maxOffset]);

  const handleTrackDragStart = useCallbackRef((zone: TrackDragZone): TrackDragSession | null => {
    if (thumb.disabled) return null;
    if (zone === 'thumb') {
      // Signal the drag lifecycle with the thumb element (a virtual wrapper pins its elastic region;
      // a client anchors drag UI — e.g. a tooltip — to the element).
      propOnThumbDrag?.({ dragging: true, element: refThumbEl.current, source: 'thumb' });
      return {
        apply: (trackPx: number) => handlePhysicalScroll(trackPx),
        // Parked past the end: an elastic/virtual wrapper extends its region (its policy, its pace);
        // a linear scrollbar leaves this unset — its end is the end.
        edgeHold: propOnThumbEdgeHold,
        end: () => propOnThumbDrag?.({ dragging: false, element: refThumbEl.current, source: 'thumb' }),
        dragMode: 'thumb'
      };
    }
    return { page: pageScroll, dragMode: 'page' };
  }, [thumb, propOnThumbEdgeHold, propOnThumbDrag]);

  const trackDrag = useTrackDrag({
    vertical: isVertical,
    getTrackRect: () => refTrack.current?.getBoundingClientRect() ?? null,
    getThumb: () => thumb.disabled ? null : { offset: thumb.offset, length: thumb.length },
    onStart: handleTrackDragStart
  });
  const dragging = trackDrag.dragMode === 'thumb';

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
          'sxl-disabled': disabled
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
      />
    );
    if (!isTouch || disabled) return thumbInline;

    // The grip is a touch-sized rendering of THIS thumb: it rides the thumb's fraction (so a
    // virtual/elastic thumb stays in sync) and drags through the same physical-scroll mapping — with
    // the same edge-hold policy as the desktop thumb (park at the end → the elastic region extends,
    // accelerating) and the same drag-pinning signal. Positioned within the viewport via the
    // TouchThumbFrame context published by the ScrollPane.
    const thumbTravel = Math.max(0, trackLength - thumb.length);
    return (<>
      {thumbInline}
      <TouchThumbHandle
        {...propsTouchThumb}
        orientation={isVertical ? ScrollbarOrientation.Vertical : ScrollbarOrientation.Horizontal}
        fraction={thumbTravel > 0 ? thumb.offset / thumbTravel : 0}
        onScrollToFraction={(fraction: number) => handlePhysicalScroll(fraction * thumbTravel)}
        onEdgeHold={propOnThumbEdgeHold}
        onDraggingChange={propOnThumbDrag}
      />
    </>
    )
  }, [thumb, minThumbSize, maxOffset, propOffset, isVertical, isTouch, propOnMouseDown, propsTouchThumb, propsThumb, trackLength, propOnThumbEdgeHold, propOnThumbDrag]);

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

  const timerRef = useRef<any | null>(null); // NodeJS.Timeout
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

    return <RenderSlot render={renderScrollButtonStart} props={props} />;
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
    return <RenderSlot render={renderScrollButtonEnd} props={props} />;
  }, [showCustomScrollButtons, orientation, propOffset, maxOffset, scrollScrolling]);


  const orientationName = isVertical ? 'vertical' : 'horizontal';
  const directionClassName = `sxl-${orientationName}`;
  const refMerged = useMergeRefs([refLocal, refForwarded]);
  return (
    <div
      ref={refMerged as React.Ref<HTMLDivElement>}
      className={
        clsx(propClassName,
          styles['scrollbar'],
          themeStyles['scrollbar-colors'],
          directionClassName,
          {
          'sxl-dragging': dragging,
          'sxl-has-touch-thumb': isTouch,
        })}
      style={propStyle}
      {...rest}
    >
      {scrollStartButton}
      <div
        ref={refTrackMerged}
        role="scrollbar"
        aria-orientation={orientationName}
        aria-valuemin={0}
        aria-valuemax={maxOffset}
        aria-valuenow={propOffset}
        tabIndex={0}
        className={clsx(styles['track'], 'sxl-track', directionClassName)}
        onMouseDown={propOnMouseDown}
        onPointerDown={trackDrag.onPointerDown}
        onPointerMove={trackDrag.onPointerMove}
        onPointerUp={trackDrag.onPointerUp}
        onKeyDown={onKeyDown}
      >
        {thumbEl}
      </div>
      {scrollEndButton}
    </div>
  );
}));
