import React, {
  useEffect,
} from 'react';
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
    if (!options || options.mouseEvents !== false) {
      document.addEventListener("mousedown", handler);
      document.addEventListener("touchstart", handler);
    }
    if (!options || options.focusEvents !== false) {
      // console.log('add listener focus');
      document.addEventListener("focus", handler);
    }
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);

      document.removeEventListener("focus", handler);
    };
  }, [ref]);
}
