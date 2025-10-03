import React, { useEffect, useState, useRef, useMemo, memo, forwardRef } from 'react';
import { createPortal } from 'react-dom';

import clsx from 'clsx';
import { mergeRefs } from 'react-merge-refs';

import type { Bounds } from '@sheetxl/utils';

import { ScrollbarOrientation } from '../scroll';

import { useCallbackRef, useAnimatedMeasure } from '../hooks';
import { ReactUtils, useFullscreenPortal } from '../utils';


export interface TouchThumbHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Possible anchors are. If 'l', 't', 'r', or 'b', then it will center along view the view.
   *
   * @remarks
   * Determines not only the position but the event that is fired.
   */
  // anchor: 'tl' | 'br' | 'l' | 't' | 'r' | 'b'; // 6 possible

  size?: number;

  borderWidth?: number;
  borderStroke?: string;

  background?: string;

  // onTouchSelectStart?: (anchor: string) => void;
  // onTouchSelectEnd?: (anchor: string) => void;
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

  orientation : ScrollbarOrientation;
}

export interface TouchThumbHandleAttributes {
  // None yet
}

export interface TouchThumbHandleElement extends HTMLDivElement, TouchThumbHandleAttributes {};


export type TouchThumbHandleRefAttribute = {
  ref?: React.Ref<TouchThumbHandleElement>;
};

export interface TouchThumbHandleRefProps extends TouchThumbHandleProps, TouchThumbHandleRefAttribute {}

const supportsTouchEvents = ReactUtils.detectIt().supportsTouchEvents;

// const isTouchPrimary = ReactUtils.detectIt().primaryInput === 'touch';

/**
 * TODO - Setup touch detection
 * supportsTouchEvents = ReactUtils.detectIt().supportsTouchEvents;
 *
 * // 1. isTouchPrimary
 * // 2. supportsTouchEvents
 * //   2a. show - if hybrid and touchEvent (on component provided as options)
 * //   2b. hide - if hybrid and mouseEvent (on component provided as options)
 */

/**
 * TouchThumbHandle component
 */
export const TouchThumbHandle = memo(
  forwardRef<TouchThumbHandleElement, TouchThumbHandleProps>((props, refForwarded) => {
    const {
      // anchor,
      borderStroke = "rgb(33, 115, 70)", //"#1a73e8", excel green,
      background = 'white',
      borderWidth = 1.5,
      size = 22,
      style: propStyle,
      className: propClassName,
      // onTouchSelectStart: propOnTouchSelectStart,
      // onTouchSelectEnd: propOnTouchSelectEnd,

      onPointerDown: propOnPointerDown,
      onPointerMove: propPointerMove,
      onPointerUp: propPointerUp,

      orientation = ScrollbarOrientation.Vertical,
      offset = 0,
      currentTouchAnchor,
      elementParent,
      elementRoot,
      // refThumbEl,
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

    // const pointerHandler:PointerHandlerOptions = useMemo(() => {

    //   return {
    //     processTouch: true,
    //     consumeTouch: true,
    //     onPointerDown,//: (event: React.PointerEvent<Element>, modifiers: PointerModifiers) => {

    //       // const coords = directionalCoords(view.getCellCoordsFromClient(event.clientX, event.clientY));
    //       // onTouchSelectStart?.(anchor);
    //       // return selectionTouchPointerHandler.onSelectionPointerDown(
    //       //   event,
    //       //   modifiers,
    //       //   view,
    //       //   coords,
    //       //   coordsPivot,
    //       //   false/*scrollToAnchor*/,
    //       //   true/*extendSelection*/);
    //     // },
    //     onPointerMoveOrWait: (event: globalThis.PointerEvent, modifiers: PointerModifiers, originalEvent: React.PointerEvent<Element>) => {
    //       // const coords = directionalCoords(view.getCellCoordsFromClient(event.clientX, event.clientY));
    //       // return selectionTouchPointerHandler.onSelectionPointerMoveOrWait(
    //       //   event,
    //       //   modifiers,
    //       //   originalEvent,
    //       //   view,
    //       //   coords,
    //       //   selectingPivots.current?.coordsPivot,
    //       //   true/*scrollToAnchor*/,
    //       //   true/*resetCellAnchor*/
    //       // );
    //     },
    //     onPointerUp: (event: globalThis.PointerEvent, modifiers: PointerModifiers, originalEvent: React.PointerEvent<Element>) => {
    //       // onTouchSelectEnd?.(anchor);
    //       // return selectionTouchPointerHandler.onPointerUp(event, modifiers, originalEvent);
    //     }
    //   }
    // }, []);
    // const handlePointerDown = useSynchronizedPointerHandler(pointerHandler);

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
          className={clsx(`touch-thumb-handle`, propClassName)}
          ref={refForwarded}
          style={{
            position: "absolute",
            left: absoluteScrollLeft + (anchorRect?.x ?? 0) - ((size + borderWidth) / 2),
            top: absoluteScrollTop + (anchorRect?.y ?? 0) - ((size + borderWidth) / 2),
            width: isVertical ? size : size / 2,
            height: isVertical ? size / 2 : size,
            borderWidth: `${borderWidth}px`,
            borderStyle: 'solid',
            borderColor: borderStroke,
            borderRadius: '4px',
            background: background,
            // boxShadow: `0 0 0 1.5px ${background}`,
            cursor: "grab",
            pointerEvents: "all",
            opacity: currentTouchAnchor ? 0 : 1, //  && currentTouchAnchor !== anchor, we don't do this because excel doesn't and if pivoting around anchor then the touch is in the incorrect spot
            transitionDuration: '160ms',
            // transitionTimingFunction: 'linear',
            // transitionDelay: "0",
            transitionProperty: 'opacity',
            // willChange: 'opacity',
            ...propStyle
          }}
          tabIndex={-1}
          // onPointerDown={handlePointerDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          {...rest}
        />
      , elementRoot ?? getPortalContainer(), key));
    }, [topAnchor, leftAnchor, bounds?.x, bounds?.y, bounds?.width, bounds?.height, propClassName, currentTouchAnchor, background, size, borderWidth, borderStroke, elementParent, isFullscreen, key]);

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