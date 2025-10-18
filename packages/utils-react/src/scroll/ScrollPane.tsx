import React, {
  useMemo, memo, forwardRef, useEffect, useCallback, useRef
} from 'react';

import clsx from 'clsx';
// import invariant from 'tiny-invariant';
import { useMeasure } from 'react-use';

import { Scroller } from '../scroller';

import { Size } from '@sheetxl/utils';

import { ScrollbarOrientation } from './IScrollbar';
import { useImperativeElement, useCallbackRef } from '../hooks';
// tree-shake
import { detectIt } from '../utils/ReactUtils';

import {
  IScrollPaneElement, IScrollPaneAttributes, ScrollPaneProps
} from './IScrollPane';

import { defaultRenderScrollbar } from './Utils';

import styles from './ScrollPane.module.css';

export const defaultCreateScrollCorner = (size: Size) => {
  const width = size?.width;
  const height = size?.height;
  return (
    <div
      className="corner"
      style={{
        minWidth: `${width}px`,
        width: `${width}px`,
        minHeight: `${height}px`,
        height: `${height}px`,
      }}
    />
  );
}

/*
 * A wrapper around scrollbars. The child must be a component that returns a Viewport.

 * This component fills the space as a standard div (honoring layouts unlike grid)
 * Adds a bottom right corner (todo - allow this to be customized)
 *
 * TODO - support wheel-mouse, snap, and zoom
 */
export const ScrollPane = memo(forwardRef<IScrollPaneElement, ScrollPaneProps>(
  (props: ScrollPaneProps, refForwarded) => {
  const {
    children,
    viewport,
    onScrollViewport: propOnScrollViewport,
    showHorizontalScrollbar: propShowHorizontalScrollbar = true,
    showVerticalScrollbar: propShowVerticalScrollbar = true,
    createScrollCorner = defaultCreateScrollCorner,
    renderScrollbarHorizontal = defaultRenderScrollbar,
    renderScrollbarVertical = defaultRenderScrollbar,
    style: propsStyle,
    className: propClassName,
    touchElement,
    disableTouch,
    ...rest
  } = props;
  // invariant(!(viewport), "viewport must be specified");

  const showHorizontalScrollbar = propShowHorizontalScrollbar && renderScrollbarHorizontal;
  const showVerticalScrollbar = propShowVerticalScrollbar && renderScrollbarVertical;
  const onScrollViewport = useCallbackRef(propOnScrollViewport, [propOnScrollViewport]);

  const refLocal = useImperativeElement<IScrollPaneElement, IScrollPaneAttributes>(refForwarded, () => {
    return {
      isScrollPane: () => true
    }
  }, []);

  const scrollerRef = useRef<Scroller | null>(null);
  useEffect(() => {
    if (!scrollerRef.current) return;
    if (scrollerRef.current.__scrollTop !== viewport?.top ||
        scrollerRef.current.__scrollLeft !== viewport?.left) {
      if (!scrollerRef.current.__isDecelerating) {
        scrollerRef.current?.scrollTo(viewport?.left, viewport?.top, false/*animate*/);
      }
    }
  }, [viewport?.left, viewport?.top, touchElement]);

  const handleScroller = useCallback((left: number, top: number) => {
    // console.log('Scroller called', left, top);
    onScrollViewport?.({ left, top });
  }, []);
  const handleTouchStart = useCallback((e: globalThis.TouchEvent) => {
    scrollerRef.current?.doTouchStart(e.touches, e.timeStamp);
  }, []);
  const handleTouchMove = useCallback((e: globalThis.TouchEvent) => {
    e.preventDefault();
    scrollerRef.current?.doTouchMove(e.touches, e.timeStamp);
  }, []);
  const handleTouchEnd = useCallback((e: globalThis.TouchEvent) => {
    scrollerRef.current?.doTouchEnd(e.timeStamp);
  }, []);

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
    scrollerRef.current.setDimensions(
      containerWidth,
      containerHeight,
      totalWidth,
      totalHeight
    );
  }, []);

  useEffect(() => {
    /* Update dimension */
    const listenElement:HTMLElement = touchElement ?? refLocal.current;
    // Note - later we will always use the scroller for animated scrolling
    // and snap but we have to reconcile the viewport with the scroller first
    const scrollerEnabled = !disableTouch && detectIt().supportsTouchEvents;
    if (scrollerEnabled && listenElement && viewport) {
      /* Add scroller, We only do this once */
      if (!scrollerRef.current) {
        const options = {
          scrollingX: true,
          scrollingY: true,
          decelerationRate: 0.95,
          penetrationAcceleration: 0.08,
        };
        scrollerRef.current = new Scroller(handleScroller, options);
      }

      if (detectIt().supportsTouchEvents) {
        /* Add listeners */
        listenElement.addEventListener("touchstart", handleTouchStart);
        listenElement.addEventListener("touchend", handleTouchEnd);
        listenElement.addEventListener("touchmove", handleTouchMove);
      }

      // /* Update dimensions */
      updateScrollDimensions({
        containerWidth: viewport?.width,
        containerHeight: viewport?.height,
        totalWidth: viewport?.totalWidth,
        totalHeight: viewport?.totalHeight,
      });
    }
    return () => {
      listenElement?.removeEventListener("touchstart", handleTouchStart);
      listenElement?.removeEventListener("touchend", handleTouchEnd);
      listenElement?.removeEventListener("touchmove", handleTouchMove);
    }
  }, [viewport?.width, viewport?.height, viewport?.totalWidth, viewport?.totalHeight, disableTouch, touchElement]);

  const [refMeasureVert, { width: vertWidth }] = useMeasure<HTMLDivElement>();
  const [refMeasureHorz, { height: horzHeight }] = useMeasure<HTMLDivElement>();

  const verticalScroll = useMemo(() => {
    if (!showVerticalScrollbar) return null;
    const scrollbar = renderScrollbarVertical({
      orientation: ScrollbarOrientation.Vertical,
      offset: viewport?.top,
      viewportSize: viewport?.height,
      totalSize: viewport?.totalHeight,
      onScrollOffset: (offset: number): void => {
        // TODO - we could support animation of scrollbars here too.
        // to make this work we will need to track the inflight top, left
        //scrollerRef.current?.scrollTo(scrollerRef.current?.__scrollLeft ?? 0, offset, true/*animate*/);
        onScrollViewport?.({ top: offset })
      }
    });
    return (
      <div
        className={clsx('vertical-container', styles['vertical-container'])}
        ref={refMeasureVert}
      >
        {scrollbar}
      </div>
    );
  }, [renderScrollbarVertical, viewport?.top, viewport?.height, viewport?.totalHeight]);

  const horizontalScroll = useMemo(() => {
    if (!showHorizontalScrollbar) return null;
    const scrollbar = renderScrollbarHorizontal({
      orientation:ScrollbarOrientation.Horizontal,
      offset: viewport?.left,
      viewportSize: viewport?.width,
      totalSize: viewport?.totalWidth,
      onScrollOffset: (offset: number): void => {
        // TODO - we could support animation of scrollbars here too.
        // to make this work we will need to track the inflight top, left
        //scrollerRef.current?.scrollTo(scrollerRef.current?.__scrollLeft ?? 0, offset, true/*animate*/);
        onScrollViewport?.({ left: offset })
      }
    });
    return (
      <div
        className={clsx('horizontal-corner-container', styles['horizontal-corner-container'])}
      >
        <div
          className={clsx('horizontal-sizer', styles['horizontal-sizer'])}
          style={{
            width: `calc(100% - ${vertWidth}px)`,
          }}
        >
          <div
            ref={refMeasureHorz}
            className={clsx('scrollbar-sizer', styles['scrollbar-sizer'])}
          >
            {scrollbar}
          </div>
        </div>
        {(showVerticalScrollbar ? createScrollCorner({ width: vertWidth, height: horzHeight}) : <></>)}
      </div>
    );
  }, [renderScrollbarHorizontal, viewport?.left, viewport?.width, viewport?.totalWidth, showVerticalScrollbar, createScrollCorner, vertWidth, horzHeight]);

  return (
    <div
      className={clsx(propClassName, 'scrollpane', styles['scrollpane'])}
      style={{
        minWidth: showVerticalScrollbar ? `${vertWidth}px` : undefined,
        minHeight: showHorizontalScrollbar ? `${horzHeight}px` : undefined,
        ...propsStyle
      }}
      {...rest}
      ref={refLocal}
    >
      <div
        className={clsx('scrollpane-content', styles['scrollpane-content'])}
      >
        <div
          className={clsx('scrollpane-content-element', styles['scrollpane-content-element'])}
        >
          <div
            className={clsx('scrollpane-content-element', styles['scrollpane-content-element'])}
          >
            {children}
          </div>
          { showVerticalScrollbar ? verticalScroll : <></>}
        </div>
        { showHorizontalScrollbar ? horizontalScroll : <></>}
      </div>
    </div>
  );
}));

ScrollPane.displayName = 'ScrollPane';