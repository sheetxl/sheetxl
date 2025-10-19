import { useEffect, useRef, useReducer, useMemo } from 'react';

import { CommonUtils, type RemoveListener } from '@sheetxl/utils';

import { ICommand } from './ICommand';

export interface ICommandListenerOptions {
  fireOnCommandChange: boolean;
}

export interface ICommandListener<STATE extends any, CONTEXT extends any=void> extends ICommand.Hook<STATE, CONTEXT> {
  onChange?(command: ICommand<STATE, CONTEXT>): void;
}

/**
 * Useful for capture command changes. This can be used with an @see ICommand.Hook or without.
 * If used with then will call the function. If not then a change will force a re-render.

 * @param command
 * @param listener
 */

export function useCommand<STATE=any, CONTEXT=any>(
  command: ICommand<STATE, CONTEXT> | ICommand<STATE, CONTEXT>[],
  listener: ICommandListener<STATE, CONTEXT> = null
): number {
  const listenerRef = useRef<ICommandListener<STATE, CONTEXT>>(listener);
  listenerRef.current = listener;

  // TODO - review why this is called so often
  // console.log('useCommand', command?.getKey());

  const [_, forceRender] = useReducer((s: number) => s + 1, 0);

  const commands:ICommand<any, any>[] = useMemo(() => {
    return Array.isArray(command) ? command : [command];
  }, [command]);

  useEffect(
    () => {
      const commandsLength = commands ? commands.length : 0;
      if (commandsLength === 0) return;

      const propertyListener:ICommand.PropertyListener<any, any> = (_props: ICommand.Properties<any, any>, command: ICommand<any, any>): void => {
        listenerRef.current?.onChange?.(command);
        forceRender();
      }
      let commandHook:ICommand.Hook<any, any> = null;
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
      for (let i=0; i<commandsLength; i++) {
        const command = commands[i];
        if (!command) continue;
        listenersRemove.add(command.addPropertyListener(CommonUtils.debounce(propertyListener, 0), true));
        if (listener) {
          listenersRemove.add(command.addExecuteListener(commandHook));
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