import React, { useState } from 'react';

import { useModal } from 'mui-modal-provider';

import type { ShowWindowOptions } from '@sheetxl/utils-react';

import type { InternalWindowProps } from './InternalWindow';

/**
 * Creates a single instance given the type and import function
 *
 * @remarks
 * This relays on the onHide prop working
 */
function useLazyWindow<P extends InternalWindowProps>(propsDefault?: P): (type: string, importFunc: () => Promise<{ default: any }>, options: ShowWindowOptions, props?: P) => Promise<HTMLElement> {
  const [openDialogs, setOpenDialogs] = useState<Map<string, { id: string, element: HTMLElement}>>(() => new Map());
  // TODO - use?Modal.tsx is destroying on close even with flag set. The onExit handler doesn't check. This seems to be a bug.
  // https://github.com/Quernest/mui-modal-provider/issues/78
  // TODO - no reliable called to determine that modal has been removed (via hide)
  const { showModal, updateModal, destroyModal, hideModal } = useModal({ disableAutoDestroy: true });

  const showWindow = (type: string, importFunc: () => Promise<{ default: any }>, options: ShowWindowOptions, props?: P): Promise<HTMLElement> => {
    return new Promise<HTMLElement>((resolveModal, error): void => {
      let disableAutoDestroy = false;
      if (options?.disableAutoDestroy !== undefined) {
        disableAutoDestroy = options.disableAutoDestroy;
        options = { ...options };
        delete options.disableAutoDestroy;
      }
      const injectedProps = {
        ...propsDefault,
        ...options,
        ...props,
        onHide: () => {
          const dialog = openDialogs.get(type);
          props?.onHide?.();
          setOpenDialogs((prev) => {
            prev.delete(type);
            return prev;
          });

          hideModal(dialog.id);
        },
        onDone: (reason: any) => {
          const dialog = openDialogs.get(type);
          setOpenDialogs((prev) => {
            prev.delete(type);
            return prev;
          });
          props?.onDone?.(reason);
          if (dialog && dialog.id && !disableAutoDestroy) {
            destroyModal(dialog.id);
          }
        },
        onShown: (element: HTMLElement) => {
          setOpenDialogs((prev) => {
            const prevDialog = prev.get(type);
            prev.set(type, {
              ...prevDialog,
              element: element
            });
            return prev;
          });
          resolveModal(element);
        },
        open: true
      };
      // check map for exiting instance call and update if exist
      const existingModal = openDialogs.get(type);
      if (existingModal) {
        updateModal(existingModal.id, injectedProps);
        resolveModal(existingModal.element);
        if (injectedProps.autoFocus) {
          existingModal.element?.focus();
        }
        return;
      }
      if (!importFunc) {
        error(`Invalid function for window '${type}'`);
        return; // throw an error
      }

      const dialog:any = React.lazy(importFunc);

      const modal = showModal(dialog, injectedProps, {
        destroyOnClose: !disableAutoDestroy
      });
      setOpenDialogs((prev) => {
        prev.set(type, {
          id: modal.id,
          element: null
        });
        return prev;
      });
    })
  };
  return showWindow;
}

export default useLazyWindow;
export { useLazyWindow };
