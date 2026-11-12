import type React from 'react';
import { useEffect } from 'react';
import { useCallbackRef } from './useCallbackRef';

export interface ClickOrFocusAwayOptions {
  mouseEvents?: boolean;
  focusEvents?: boolean;
}

export type ClickOrFocusAwayListener = (event: globalThis.MouseEvent | globalThis.KeyboardEvent) => void;

// Hook
export function useOnClickOrFocusAway(ref: React.RefObject<any>, listenerArg: ClickOrFocusAwayListener, options?: ClickOrFocusAwayOptions) {
  const listener = useCallbackRef(listenerArg, [listenerArg]);
  useEffect(() => {
    const handler:ClickOrFocusAwayListener = (event: globalThis.MouseEvent | globalThis.KeyboardEvent) => {
      // Do nothing if clicking ref's element or descendent elements
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      // console.log('onHandle click away', event, ref.current);
      listener(event);
    };
    const domHandler = handler as EventListener;
    if (!options || options.mouseEvents !== false) {
      document.addEventListener("mousedown", domHandler);
      document.addEventListener("touchstart", domHandler);
    }
    if (!options || options.focusEvents !== false) {
      // console.log('add listener focus');
      document.addEventListener("focus", domHandler);
    }
    return () => {
      document.removeEventListener("mousedown", domHandler);
      document.removeEventListener("touchstart", domHandler);

      document.removeEventListener("focus", domHandler);
    };
  }, [ref]);
}
