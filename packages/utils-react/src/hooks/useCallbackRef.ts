import { useRef, useCallback, DependencyList } from 'react';

/**
 * This is a callback hook that is similar to useCallback except in
 * one important way. When it's dependencies change it does
 * NOT update the callback handler itself. Useful
 * in the instance where you want to pass a callback and
 * want to avoid have stale values do to closure but don't
 * want a re-render to occur.
 */
export const useCallbackRef = <T extends (...args: any[]) => any>(callback: T, deps: DependencyList): T => {
  const cbCurrent = useCallback((...args: any) => {
    return callback?.(...args);
  }, deps);

  const refCB = useRef<any>(null);
  refCB.current = cbCurrent;

  const stableCB = useCallback((...args: any) => {
    return refCB.current?.(...args);
  }, []);

  if (!refCB.current)
   return undefined;
  return stableCB as T;
}