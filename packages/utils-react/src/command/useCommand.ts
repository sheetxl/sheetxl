// react hook for listening for command updates
import {
  useEffect,
  useRef,
  useReducer,
  useMemo
} from 'react';

import { CommonUtils, RemoveListener } from '@sheetxl/utils';

import { ICommand, ICommandHook, ICommandPropertyListener, ICommandProperties } from './Command';

export interface ICommandListenerOptions {
  fireOnCommandChange: boolean;
}

export interface ICommandListener<STATE extends any, CONTEXT extends any=void> extends ICommandHook<STATE, CONTEXT> {
  onChange?(command: ICommand<STATE, CONTEXT>): void;
}

/**
 * Useful for capture command changes. This can be used with an @see ICommandHook or without.
 * If used with then will call the function. If not then a change will force a re-render.

 * @param command
 * @param listener
 */

function useCommand<STATE=any, CONTEXT=any>(command: ICommand<STATE, CONTEXT> | ICommand<STATE, CONTEXT>[], listener: ICommandListener<STATE, CONTEXT> = null): number {
  const listenerRef = useRef<ICommandListener<STATE, CONTEXT>>(listener);
  listenerRef.current = listener;

  // TODO - review why this is called so often
  // console.log('useCommand', command?.key());

  const [_, forceRender] = useReducer((s: number) => s + 1, 0);

  const commands:ICommand<any, any>[] = useMemo(() => {
    return Array.isArray(command) ? command : [command];
  }, [command]);

  useEffect(
    () => {
      if (!commands || commands.length === 0) return;

      const propertyListener:ICommandPropertyListener<any, any> = (_props: ICommandProperties<any, any>, command: ICommand<any, any>): void => {
        listenerRef.current?.onChange?.(command);
        forceRender();
      }
      let commandHook:ICommandHook<any, any> = null;
      if (listener) {
        commandHook = {
          onExecute(command: ICommand<any, any>, args: any): void {
            listenerRef.current?.onExecute?.(command, args);
          },
          onError(command: ICommand<any, any>, error: any, args: any): void {
            listenerRef.current?.onError?.(command, error, args);
          }
        }
      }

      const listenersRemove:Set<RemoveListener> = new Set();
      // add Listeners, we debounce because we may very well be in a render cycle
      for (let i=0; i<commands.length; i++) {
        listenersRemove.add(commands[i]?.addPropertyListener(CommonUtils.debounce(propertyListener, 0), true));
        if (listener) {
          listenersRemove.add(commands[i]?.addExecuteListener(commandHook));
        }
      }
      // Remove event listener on cleanup
      return () => {
        listenersRemove.forEach((removeListener: () => void) => {
          removeListener?.();
        });
      };
    },
    [command] // Re-run if new command
  );

  return _;
}

export { useCommand };