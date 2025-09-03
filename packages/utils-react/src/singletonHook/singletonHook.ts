import React, { useEffect, useState } from 'react';
import { addHook } from './components/SingletonHooksContainer';
import { batch } from './utils/env';

export interface SingletonHookOptions {
  unmountIfNoConsumers?: boolean;
}

type ReactSingletonHook<T=any, S=any> = (
  initValue: T,
  useHookBody: () => S,
  options?: SingletonHookOptions
) => React.SetStateAction<S>

let _singletonHook: ReactSingletonHook = null;

// uncomment or add to global if we want this dedup at runtime.
// _singletonHook = (React as any)._singletonHook as ReactSingletonHook;

if (!_singletonHook) {
  _singletonHook = <T, S=any>(
    initValue: T,
    useHookBody: () => S,
    options: SingletonHookOptions = {}
  ): React.SetStateAction<S> => {
    let mounted: boolean = false;
    let removeHook: (() => void) | undefined;
    let initStateCalculated: boolean = false;
    let lastKnownState: S | undefined = undefined;
    let consumers: Array<React.Dispatch<React.SetStateAction<S>>> = [];
    let {
      unmountIfNoConsumers = false
    } = options;

    const applyStateChange = (newState: S) => {
      lastKnownState = newState;
      batch(() => consumers.forEach(c => c(newState)));
    };

    const stateInitializer = () => {
      if (!initStateCalculated) {
        lastKnownState = typeof initValue === 'function' ? initValue() : initValue;
        initStateCalculated = true;
      }
      return lastKnownState;
    };

    return () => {
      const [state, setState] = useState(stateInitializer);

      useEffect(() => {
        if (!mounted) {
          mounted = true;
          removeHook = addHook({ initValue, useHookBody, applyStateChange });
        }

        consumers.push(setState);
        if (lastKnownState !== state) {
          setState(lastKnownState);
        }
        return () => {
          consumers.splice(consumers.indexOf(setState), 1);
          if (consumers.length === 0 && unmountIfNoConsumers) {
            removeHook();
            mounted = false;
          }
        };

      }, []);

      return state;
    };
  };
}

// (React as any)._singletonHook = _singletonHook;

export const singletonHook:<T=any, S=any>(
  initValue: T,
  useHookBody: () => S,
  options?: SingletonHookOptions
) => React.SetStateAction<S> = _singletonHook;