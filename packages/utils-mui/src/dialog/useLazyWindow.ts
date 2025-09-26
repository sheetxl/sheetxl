import React, { useState } from 'react';

import { useModal, UseModalOptions } from 'mui-modal-provider';

import  { InternalWindowProps } from './InternalWindow';

export interface LazyWindowOptions extends UseModalOptions {
  disableAutoDestroy?: boolean;
}

/**
 * Creates a single instance given the type and import function
 * @remarks
 * This relays on the onHide prop working
 */
// TODO - fix typing, component that extends a dialog
function useLazyWindow<P extends InternalWindowProps>(propsDefault?: LazyWindowOptions): (type: string, importFunc: () => Promise<{ default: any }>, props?: P, options?: LazyWindowOptions) => Promise<HTMLElement> {
  const [openDialogs, setOpenDialogs] = useState<Map<string, { id: string, element: HTMLElement}>>(() => new Map());
  // TODO - use?Modal.tsx is destroying on close even with flag set. The onExit handler doesn't check. This seems to be a bug.
  // https://github.com/Quernest/mui-modal-provider/issues/78
  // TODO - no reliable called to determine that modal has been removed (via hide)
  const { showModal, updateModal, destroyModal, hideModal } = useModal({ disableAutoDestroy: true });

  const showWindow = (type: string, importFunc: () => Promise<{ default: any }>, props?: P, options?: LazyWindowOptions): Promise<HTMLElement> => {
    return new Promise<HTMLElement>((resolveModal, error): void => {
      const injectedProps = {
        ...propsDefault,
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
          if (dialog && dialog.id && !options?.disableAutoDestroy) {
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
        return;
      }
      if (!importFunc) {
        error('invalid function')
        return; // throw an error
      }

      const dialog:any = React.lazy(importFunc);

      const modal = showModal(dialog, injectedProps, {
        destroyOnClose: !options?.disableAutoDestroy
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
