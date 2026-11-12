import type React from 'react';
import { useRef, useEffect, useCallback } from 'react';

import { ReactUtils } from '../utils';

import { useCallbackRef } from './useCallbackRef';

/**
 * The pointer modifiers are used because pointer events and keyboard events
 * both have modifiers but pointer events are not updated with a keyboard event
 * is pressed.
 */
export interface PointerModifiers {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}
export interface PointerHandlerOptions<T extends Element = Element> {
  /**
   * If returns false then other events will not be fired
   */
  onPointerDown: (event: React.PointerEvent<T>, modifiers: PointerModifiers) => boolean | void;
  /**
   * If the Pointer has moved or it the Pointer was held for a period of timerContinuous.
   */
  onPointerMoveOrWait?: (event: React.PointerEvent<T>, modifiers: PointerModifiers, originalEvent: React.PointerEvent<T>) => void;
  /**
   * Called when Pointer is released. This is different than the regular
   * Pointer up in that it will be called even if the Pointer is released
   * when outside the component.
   */
  onPointerUp?: (event: React.PointerEvent<T>, modifiers: PointerModifiers, originalEvent: React.PointerEvent<T>) => void;

  timerInitial?: number;
  timerContinuous?: number;
  /**
   * Track the gesture through pointer events rather than mouse events, so a finger or a pen drives
   * it too. The element pressed declares `touch-action: none` to keep the browser's pan, and the
   * scroll pane's touch scroller, off the gesture.
   * @default false
   */
  processTouch?: boolean;
}

/**
 * If returns false don't setup the other listeners
 */
export type PointerDownListener = (event: React.PointerEvent<Element>) => void;

/**
 * This hook will respond on Pointer down and then continue to fire events
 * until the Pointer is released.
 *
 * Returns PointerDownListener that should be added to the
 * source component's onPointerDown event handler.
*/
export function useSynchronizedPointerHandler(options: PointerHandlerOptions): PointerDownListener {
  if (!options)
    throw new Error('must have a PointerHandlerOptions');
  const {
    onPointerDown: propOnPointerDown,
    onPointerUp: propOnPointerUp,
    onPointerMoveOrWait: propOnPointerMoveOrWait,
    processTouch = false,
  } = options;

  const onPointerDown = useCallbackRef(propOnPointerDown, [propOnPointerDown]);
  const onPointerUp = useCallbackRef(propOnPointerUp, [propOnPointerUp]);
  const onPointerMoveOrWait = useCallbackRef(propOnPointerMoveOrWait, [propOnPointerMoveOrWait]);

  /*
   * We track because we want to wrap onPointerMoveOrWait in a raf Maximum update depth exceeded.
   * we also don't want to fire AFTER mouse up.
   */
  const refIsPressed = useRef<boolean>(false);

  const timerInitial = options?.timerInitial ?? 230;
  const timerContinuous = options?.timerContinuous ?? timerInitial / 2;

  const originalEvent = useRef<React.PointerEvent | null>(null);
  const lastPointerEvent = useRef<globalThis.PointerEvent | null>(null);
  const lastKeyboardModifiers = useRef<PointerModifiers | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTimer = useCallback(() => {
    if (!timerRef.current) return;

    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const startTimer = useCallback((delay:number) => {
    timerRef.current = setTimeout(() => {
      window.requestAnimationFrame(() => {
        if (refIsPressed.current === false) return;
        const nativeEvent = lastPointerEvent.current;
        const original = originalEvent.current;
        if (!nativeEvent || !original) return;
        const syntheticEvent = ReactUtils.createSyntheticEvent<Element, PointerEvent, React.PointerEvent<Element>>(
          nativeEvent,
          original.currentTarget
        );
        onPointerMoveOrWait?.(syntheticEvent, lastKeyboardModifiers.current!, original);
      });
      startTimer(timerContinuous); // we make first time slightly longer to similar a delayed start
    }, delay ?? timerInitial);
  }, []);

  useEffect(() => {
    return () => stopTimer(); // when unmounted, stop counter
  }, []);

  const eventType = processTouch ? 'pointer' : 'mouse';

  const handlePointerUp = useCallbackRef((e: globalThis.PointerEvent) => {
    /* Remove listener */
    document.removeEventListener(`${eventType}move`, handlePointerMove as EventListener);
    document.removeEventListener(`${eventType}up`, handlePointerUp as EventListener);
    document.removeEventListener('pointercancel', handlePointerUp as EventListener);

    document.removeEventListener(`keydown`, handleKeyDown);
    document.removeEventListener(`keyup`, handleKeyUp);

    window.removeEventListener('blur', handleWindowBlur);
    stopTimer();

    // Note - We use raf to avoid calling to many times and throwing react deep mutation errors
    window.requestAnimationFrame(() => {
      if (refIsPressed.current === false) return;
      refIsPressed.current = false;
      const nativeEvent = e;
      const original = originalEvent.current;
      if (!original) return;
      const syntheticEvent = ReactUtils.createSyntheticEvent<Element, PointerEvent, React.PointerEvent<Element>>(
        nativeEvent,
        original.currentTarget
      );
      onPointerUp?.(syntheticEvent, lastKeyboardModifiers.current!, original);
      lastKeyboardModifiers.current = null;
    });
  }, []);

  // Losing the window (another app or a system overlay takes the pointer) ends the press as a release
  // at the last known position; the release path clears `refIsPressed` itself.
  const handleWindowBlur = useCallback(() => {
    if (refIsPressed.current === false || !lastPointerEvent.current) return;
    handlePointerUp(lastPointerEvent.current);
  }, []);

  const handlePointerUpdate = useCallbackRef(() => {
    stopTimer();
    startTimer(timerContinuous);
    // Note - We use raf to avoid calling to many times and throwing react deep mutation errors
    window.requestAnimationFrame(() => {
      if (refIsPressed.current === false) return;
      const nativeEvent = lastPointerEvent.current;
      const original = originalEvent.current;
      if (!nativeEvent || !original) return;
      const syntheticEvent = ReactUtils.createSyntheticEvent<Element, PointerEvent, React.PointerEvent<Element>>(
        nativeEvent,
        original.currentTarget
      );
      onPointerMoveOrWait?.(syntheticEvent, lastKeyboardModifiers.current!, original);
    });
  }, [timerContinuous]);

  const handlePointerMove = useCallbackRef((e: globalThis.PointerEvent) => {
    lastPointerEvent.current = e;
    handlePointerUpdate();
  }, []);

  const handleKeyDown = useCallbackRef((e: globalThis.KeyboardEvent) => {
    lastKeyboardModifiers.current = {
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey
    }
    handlePointerUpdate();
  }, []);

  const handleKeyUp = useCallbackRef((e: globalThis.KeyboardEvent) => {
    lastKeyboardModifiers.current = {
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey
    }
    handlePointerUpdate();
  }, [timerContinuous]);

  const listenerPointerDown:PointerDownListener = useCallbackRef((e: React.PointerEvent<Element>) => {
    if (e.isDefaultPrevented()) return;
    lastKeyboardModifiers.current = {
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey
    }
    const operationContinue = onPointerDown(e, lastKeyboardModifiers.current);
    if (operationContinue === false)
      return;

    originalEvent.current = e;
    lastPointerEvent.current = e.nativeEvent;

    document.addEventListener(`${eventType}up`, handlePointerUp as EventListener, { passive: false });
    document.addEventListener(`${eventType}move`, handlePointerMove as EventListener, { passive: false });
    // The browser can take the pointer away mid-press with no `up` to follow.
    document.addEventListener('pointercancel', handlePointerUp as EventListener, { passive: false });

    document.addEventListener(`keydown`, handleKeyDown, { passive: false });
    document.addEventListener(`keyup`, handleKeyUp, { passive: false });

    window.addEventListener('blur', handleWindowBlur, { passive: true });

    refIsPressed.current = true;
    startTimer(timerInitial);
  }, [timerInitial, processTouch]);

  return listenerPointerDown;
}