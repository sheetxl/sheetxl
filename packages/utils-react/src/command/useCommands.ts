// react hook for listening for command updates
import { useEffect, useRef, useState } from 'react';

import { CommonUtils } from '@sheetxl/utils';

import { ICommand } from './ICommand';
import { ICommands } from './ICommands';

export interface ICommandsListeners<STATE extends any, CONTEXT extends any=void> extends ICommand.Hook<STATE, CONTEXT> {
  /**
   * Called when either the command group is updated or if keys are provided then the commands as well.
   *
   * @param commands
   */
  onChange?(commands: ICommands.IGroup): void;
}

// TODO - this should resolve the entire hierarchy of commands?
const resolveCommands = <STATE=any, CONTEXT=any>(commands: ICommands.IGroup, keys: string[]): ICommand<STATE, CONTEXT>[] => {
  if (!keys || !commands || keys.length === 0) return CommonUtils.EmptyArray;
  const keysLength = keys.length;
  const resolved = new Array<ICommand<STATE, CONTEXT>>(keysLength);
  for (let i=0; i<keysLength; i++) {
    const key = keys[i];
    const command = key ? commands.getCommand(key) as ICommand<STATE, CONTEXT> : null;
    resolved[i] = command;
  }
  return resolved;
}

/**
 * Useful for capture command changes. This can be used with an @see ICommand.Hook or without.
 * If used with then will call the function. If not then a change will force a re-render.
 *
 * @param commands
 * @param keys
 * @param listener
 * @param deps Optional dependencies to trigger a re-render
 *
 * @remarks
 * A change to the commands, keys, or listeners will not trigger a rerender. The deps argument can be used.
 */

export function useCommands<STATE extends any, CONTEXT extends any=void>(
  commands: ICommands.IGroup,
  keys: string[] = null,
  listener: ICommandsListeners<STATE, CONTEXT> = null,
  deps?: React.DependencyList
): ICommand<STATE, CONTEXT>[] {
  const listenerRef = useRef<ICommandsListeners<STATE, CONTEXT>>(listener);
  listenerRef.current = listener;

  if (keys && !Array.isArray(keys)) {
    keys = [keys];
  }

  const [resolvedCommands, setResolvedCommands] = useState<ICommand<STATE, CONTEXT>[]>(resolveCommands<STATE, CONTEXT>(commands, keys));

  const _deps = deps ? [...deps, commands] : [commands];
  /* listens to the commands */
  useEffect(() => {
    const listenerDelegate:ICommands.IListener = {
      onGroupChange: () => {
        const resolved = resolveCommands<STATE, CONTEXT>(commands, keys);
        setResolvedCommands(resolved);
        listenerRef.current?.onChange?.(this);
      }
    };
    let options:ICommands.IListenerOptions = undefined;
    if (keys && keys.length > 0) {
      options = { keys };
      listenerDelegate.onCommandChange = (_group: ICommands.IGroup, _command: ICommand ) => {
        listenerRef.current?.onChange?.(commands);
        setResolvedCommands(resolveCommands<STATE, CONTEXT>(commands, keys));
      }
    }
    const removeCommands = commands?.addListener(listenerDelegate, options);
    const resolved = resolveCommands<STATE, CONTEXT>(commands, keys);
    setResolvedCommands(resolved);
    if (listenerRef.current?.onChange) {
      listenerRef.current?.onChange(commands);
    }

    return () => {
      removeCommands?.();
    }
  }, _deps);

  return resolvedCommands;
}