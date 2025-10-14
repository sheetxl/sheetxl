import React, { useEffect, useState, useRef, useMemo, memo, forwardRef } from 'react';
import { createPortal } from 'react-dom';

import clsx from 'clsx';
import { mergeRefs } from 'react-merge-refs';

import type { Bounds } from '@sheetxl/utils';

import {
  useCallbackRef, useAnimatedMeasure,
  type PointerModifiers, type PointerHandlerOptions, useSynchronizedPointerHandler
} from '../hooks';
import { ReactUtils, useFullscreenPortal } from '../utils';

import { ScrollbarOrientation } from './IScrollbar';

import styles from './Scrollbar.module.css';

export interface TouchThumbHandleProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * The orientation of the scrollbar.
   */
  orientation: ScrollbarOrientation;
  /**
   * Possible anchors are. If 'l', 't', 'r', or 'b', then it will center along view the view.
   *
   * @remarks
   * Determines not only the position but the event that is fired.
   */
  // anchor: 'tl' | 'br' | 'l' | 't' | 'r' | 'b'; // 6 possible

  size?: number;

  borderColor?: string;
  backgroundColor?: string;
  borderWidth?: number;
  fillColor?: string;

  /**
   * Indicate that a touch handling is being used
   */
  currentTouchAnchor?: string;
  /**
   * If provided then touch control will walk the parent hierarchy
   * to find the absolute scroll position
   */
  elementParent?: HTMLElement;
  /**
   * Use to add create the portal
   * @defaultValue document.body
   */
  elementRoot?: HTMLElement;

  // refThumbEl?: React.RefObject<HTMLDivElement>;

  key?: string;

  offset?: number;

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

// const isTouchPrimary = ReactUtils.detectIt().primaryInput === 'touch';

/**
 * Tooltip
 * TODO -
 *
 * ! Thumb end needs to end at end of scrollbar or viewport (additionally when at bottom right they overlap.)
 * (A simple solution would be to just make the scrollbar areas have end larger end padding.)
 * (A nicer solution would be a 'touch sensor that is a single circle with an 'd-pad' indicate like games with movement)
 * Hide opposite thumb - currentTouchAnchor
 * Scrollbar colors - vars are not working from portal
 * Gripper icon - move to IconPack
 * Have a way to show during scroll and/or for a time after scrolling.
 */

/**
 * TouchThumbHandle component
 */
export const TouchThumbHandle = memo(
  forwardRef<TouchThumbHandleElement, TouchThumbHandleProps>((props, refForwarded) => {
    const {
      // anchor,
      borderColor = 'var(--sxl-app-color-primary, rgb(33, 115, 70))',
      backgroundColor = 'var(--sxl-app-color-background, white)',
      fillColor = 'var(--sxl-app-color-grey, grey)',
      borderWidth = 3,
      size = 22,
      style: propStyle,
      className: propClassName,

      onPointerDown: propOnPointerDown,
      onPointerMove: propPointerMove,
      onPointerUp: propPointerUp,

      orientation = ScrollbarOrientation.Vertical,
      offset = 0,
      currentTouchAnchor,
      elementParent,
      elementRoot,
      key,
      ...rest
    } = props;

    if (!supportsTouchEvents) {
      return null; // this condition happens before hooks but since it's a static global it's ok.
    }

    const onPointerDown = useCallbackRef(propOnPointerDown, [propOnPointerDown]);
    const onPointerMove = useCallbackRef(propPointerMove, [propPointerMove]);
    const onPointerUp = useCallbackRef(propPointerUp, [propPointerUp]);

    const isVertical = orientation === ScrollbarOrientation.Vertical;

    const [dragging, setDragging] = useState(false);

    const pointerHandler:PointerHandlerOptions = useMemo(() => {
      return {
        processTouch: true,
        consumeTouch: true,
        onPointerDown: (e: React.PointerEvent<HTMLElement>, modifiers: PointerModifiers) => {
          // (e.currentTarget as Element).setPointerCapture(e.pointerId);
          setDragging(true);
          onPointerDown?.(e);
          e.preventDefault();
          e.stopPropagation();
        },
        onPointerMoveOrWait: (e: React.PointerEvent<HTMLElement>, modifiers: PointerModifiers, originalEvent: React.PointerEvent<HTMLElement>) => {
          onPointerMove?.(e);
        },
        onPointerUp: (e: React.PointerEvent<HTMLElement>, modifiers: PointerModifiers, originalEvent: React.PointerEvent<HTMLElement>) => {
          // try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch {}
          setDragging(false);
          onPointerUp?.(originalEvent);
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }, []);
    const handlePointerDown = useSynchronizedPointerHandler(pointerHandler);

    const bounds: Bounds = useMemo(() => {
      const paddingOffset = (size / 2) + (borderWidth / 2) + 6;
      const paddingLeading = size;
      return {
        x: isVertical ? -paddingOffset : offset + paddingLeading,
        y: isVertical ? offset + paddingLeading: -paddingOffset,
        width: 0,
        height: 0
      }
    }, [isVertical, offset, size]);
    /*
      Several things to note:
      1. We use refMeasureAnchor to event (it has resize observable)
      2. We use refAnchor to get the absolute bounds
      3. We do the moving in a useEffect to ensure that there is a reflow
    */
    const [refMeasureAnchor, { y: topAnchor, x: leftAnchor }] = useAnimatedMeasure<HTMLDivElement>();
    const refAnchor = useRef<HTMLDivElement>(null);
    const { getPortalContainer, isFullscreen } = useFullscreenPortal();
    const [portal, setPortal] = useState<React.ReactPortal>(null);
    useEffect(() => {
      const anchorRect = refAnchor.current?.getBoundingClientRect();
      if (!anchorRect) {
        setPortal(null);
        return;
      }

      let absoluteScrollLeft = 0;
      let absoluteScrollTop = 0;
      let scrollElement = elementParent;
      while (scrollElement) {
        absoluteScrollLeft += scrollElement.scrollLeft;
        absoluteScrollTop += scrollElement.scrollTop;
        if (elementRoot && scrollElement === elementRoot.parentElement)
          scrollElement = null
        else
          scrollElement = scrollElement.parentElement;
      }

      setPortal(createPortal(
        <div
          className={
            clsx(`touch-thumb`,
            styles['touch-thumb'],
            propClassName,
            styles,
            {
            'dragging': dragging
          })}
          ref={refForwarded}
          style={{
            left: absoluteScrollLeft + (anchorRect?.x ?? 0) - ((size + borderWidth) / 2),
            top: absoluteScrollTop + (anchorRect?.y ?? 0) - ((size + borderWidth) / 2),
            width: isVertical ? size : size * 1.8,
            height: isVertical ? size * 1.8 : size,
            borderWidth: `${borderWidth}px`,
            boxShadow: dragging ? `${backgroundColor} 0px 0px 0px 1.5px` : undefined,
            borderStyle: 'solid',
            borderColor: borderColor,
            backgroundColor: backgroundColor,
            opacity: currentTouchAnchor ? 0 : undefined, //  && currentTouchAnchor !== anchor, we don't do this because excel doesn't and if pivoting around anchor then the touch is in the incorrect spot
            transitionDuration: '160ms',
            // transitionTimingFunction: 'linear',
            // transitionDelay: "0",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='6.4' height='12' viewBox='0 0 9.6 16' version='1.1' fill='${fillColor}' xmlns='http://www.w3.org/2000/svg' xmlns:svg='http://www.w3.org/2000/svg'%3E%3Cpath d='M 9.60008,14.40009 C 9.60008,15.28374 8.88368,16 8.00003,16 7.11639,16 6.40012,15.28374 6.40012,14.40009 c 0,-0.88365 0.71627,-1.60005 1.59991,-1.60005 0.88365,0 1.60005,0.7164 1.60005,1.60005 m 0,-6.40012 c 0,0.88364 -0.7164,1.60004 -1.60005,1.60004 -0.88364,0 -1.59991,-0.7164 -1.59991,-1.60004 0,-0.88365 0.71627,-1.60005 1.59991,-1.60005 0.88365,0 1.60005,0.7164 1.60005,1.60005 m 0,-6.40006 c 0,0.88365 -0.7164,1.60005 -1.60005,1.60005 -0.88364,0 -1.59991,-0.7164 -1.59991,-1.60005 C 6.40012,0.71626 7.11639,0 8.00003,0 8.88368,0 9.60008,0.71626 9.60008,1.59991 M 3.19996,14.40009 C 3.19996,15.28374 2.48369,16 1.60005,16 0.7164,16 0,15.28374 0,14.40009 c 0,-0.88365 0.7164,-1.60005 1.60005,-1.60005 0.88364,0 1.59991,0.7164 1.59991,1.60005 m 0,-6.40012 c 0,0.88364 -0.71627,1.60004 -1.59991,1.60004 C 0.7164,9.60001 0,8.88361 0,7.99997 0,7.11632 0.7164,6.39992 1.60005,6.39992 c 0.88364,0 1.59991,0.7164 1.59991,1.60005 m 0,-6.40006 c 0,0.88365 -0.71627,1.60005 -1.59991,1.60005 C 0.7164,3.19996 0,2.48356 0,1.59991 0,0.71626 0.7164,0 1.60005,0 2.48369,0 3.19996,0.71626 3.19996,1.59991' /%3E%3C/svg%3E%0A")`,
            // backgroundImage: `url("data:image/svg+xml,%3Csvg width='${width}' height='${height}' viewBox='0 0 ${width} ${height}' version='1.1' fill='${fillColor}' xmlns='http://www.w3.org/2000/svg' xmlns:svg='http://www.w3.org/2000/svg'%3E%3Cpath d='${path}' /%3E%3C/svg%3E%0A")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center center',
            ...propStyle
          }}
          tabIndex={-1}
          onPointerDown={handlePointerDown}
          {...rest}
        />
      , elementRoot ?? getPortalContainer(), key));
    }, [topAnchor, dragging, borderColor, backgroundColor, fillColor, leftAnchor, bounds?.x, bounds?.y, bounds?.width, bounds?.height, propClassName, currentTouchAnchor, backgroundColor, size, borderWidth, borderColor, elementParent, isFullscreen, key]);

    if (!bounds) return null;

    return (
      <>
        <div
          ref={mergeRefs([refMeasureAnchor, refAnchor])}
          style={{
            position: "absolute",
            left: bounds.x,
            top: bounds.y,
            opacity: 0,
          }}
        />
        {portal}
    </>)
  })
);

TouchThumbHandle.displayName = "TouchThumbHandle";