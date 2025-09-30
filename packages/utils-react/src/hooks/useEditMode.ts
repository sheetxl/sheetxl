import { useState, useMemo } from 'react';

import { singletonHook } from '../singletonHook';

import { EditMode, EditModeHandler } from '@sheetxl/utils';

let globalSetMode: React.Dispatch<React.SetStateAction<EditMode>> = () => {
  console.warn('You must call useEditMode before setting its state.')
}; // throw new Error(`You must call useEditMode before setting its state.`);

const useEditModeGlobal = singletonHook<EditMode>(null, () => {
  const [editMode, setEditMode] = useState<EditMode>(null);
  globalSetMode = setEditMode;
  return editMode;
});

export const useEditMode = () => {
  const globalMode = useEditModeGlobal();
  const handler:EditModeHandler = useMemo(() => {
    return {
      setMode: (mode: EditMode | ((prev: EditMode) => EditMode)): void  => {
        globalSetMode((prev: EditMode): EditMode => {
          if (typeof mode === 'function') {
            mode = mode(prev);
          }
          mode?.onModeChange?.(mode ?? null);
          return mode;
        })
      },
      getMode: () => {
        return globalMode;
      }
    }
  }, [globalMode]);

  return handler;
}