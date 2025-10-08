import React from 'react';

import { useSynchronizedPointerHandler, PointerModifiers } from './useSynchronizedPointerHandler';

export interface RepeatClickOptions {
  timerInitial?: number;
  timerContinuous?: number;
}

/**
 * Simple hook that calls onMouseDown at intervals until mouse is up.
 *
 * @remarks
 * Fires the original mouse down event so preventDefault should be ignored or treated accordingly.
 */
export function useMouseDownAndHoldListener(onPointerDown: (event: React.PointerEvent<Element>) => boolean | void, options?: RepeatClickOptions): (event: React.PointerEvent<Element>) => void {
  return useSynchronizedPointerHandler({
    onPointerDown,
    onPointerMoveOrWait: (_event: React.PointerEvent, modifiers: PointerModifiers, originalEvent: React.PointerEvent<Element>) => {
      onPointerDown?.(originalEvent);
    },
    ...options
  });
}