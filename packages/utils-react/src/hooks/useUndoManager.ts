import { useEffect, useMemo } from 'react';

import { UndoManager, RemoveListener } from '@sheetxl/utils';

import { Command, ICommand, ICommands } from '../command';
import { useNotifier, type IReactNotifier, useCallbackRef } from '../hooks';
import { KeyModifiers } from '../types';

const DESCRIPTION_UNDO_DEFAULT = `Undo the last action.`;
const DESCRIPTION_UNDO_TOP = (description: string) => `Undo ${description}`;
const DESCRIPTION_REDO_DEFAULT = `Repeat the last action or undo the redo.`;
const DESCRIPTION_REDO_TOP = (description: string) => `Redo ${description}`;

export interface UndoManagerResults {
  /**
   * Call undo manager via command
  */
  undo: (count?: number) => void;

    /**
   * Call undo manager via command
  */
  redo: (count?: number) => void;
}

export interface UndoManagerProps {
  manager: UndoManager;

  /**
   * Not allow to invoke undo/redo
   * Interesting.... Because this is sharable and not scoped to an object it's not clear the best
   * way to disable/protect a sheet. Excel clears the undo stack!
   */
  disabled?: boolean;

  commands?: ICommands.IGroup;
}

export interface UndoContext {
  readonly undoManager: UndoManager;
}

/**
 * Undo manager hook
 */
export const useUndoManager = ({
  manager,
  commands: commandsParent,
  disabled: propDisabled,
}: UndoManagerProps): UndoManagerResults => {

  const notifier: IReactNotifier = useNotifier();

  const handleUndoProgrammatic = useCallbackRef((count: number): void => {
    try {
      manager?.undo(count);
    } catch (error: any) {
      notifier.error(error);
    }
  }, [manager]);

  const handleRedoProgrammatic = useCallbackRef((count: number): void => {
    try {
      manager?.redo(count);
    } catch (error: any) {
      notifier.error(error);
    }
  }, [manager]);


  useMemo(() => {
    if (!commandsParent) return;
    // TODO - get this from param ultimately from sheet
    const commandTarget:ICommand.ITarget = {
      contains(_element: Node | null): boolean {
        return true;
      },
      focus(): void {
      }
    };
    const undoCommands = [
      new Command<number, UndoContext>('undo', commandTarget, {
        label: 'Undo',
        description: DESCRIPTION_UNDO_DEFAULT,
        shortcut: {
          key: 'z',
          modifiers: [KeyModifiers.Ctrl]
        },
        disabled: true
      }, handleUndoProgrammatic),
      new Command<number, UndoContext>('redo', commandTarget, {
        label: 'Redo',
        description: DESCRIPTION_REDO_DEFAULT,
        shortcut: [{
          key: 'y',
          modifiers: [KeyModifiers.Ctrl]
        }, {
          key: 'F4'
        },
        { // only on Excel windows
          key: 'Enter',
          modifiers: [KeyModifiers.Alt]
        }],
        disabled: true
      }, handleRedoProgrammatic)
    ];
    commandsParent?.addCommands(undoCommands, true);
  }, [commandsParent]);

  useEffect(() => {
    if (!commandsParent) return;
    const updateCommands = () => {
      const undoDescription = manager?.getTopUndoDescription();
      const newState = {} // force an update even when the description is the same
      commandsParent.getCommand('undo').update({
        disabled: (propDisabled || !manager || !manager.hasUndo()),
        description: undoDescription ? DESCRIPTION_UNDO_TOP(undoDescription) : DESCRIPTION_UNDO_DEFAULT,
        state: newState,
        context: {
          undoManager: manager
        }
      });

      const redoDescription = manager?.getTopRedoDescription();
      commandsParent.getCommand('redo').update({
        disabled: (propDisabled || !manager || !manager.hasRedo()),
        description: redoDescription ? DESCRIPTION_REDO_TOP(redoDescription) : DESCRIPTION_REDO_DEFAULT,
        state: newState,
        context: {
          undoManager: manager
        }
      })
    }
    updateCommands();  // initialize

    if (!manager) return;
    const removeListener:RemoveListener = manager.addListener({
      onStackChange(): void {
        updateCommands();
      }
    });
    return () => removeListener?.();
  }, [manager, commandsParent, propDisabled]);

  return {
    undo: handleUndoProgrammatic,
    redo: handleRedoProgrammatic,
  };
};
