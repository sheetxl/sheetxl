import { useState, useRef } from 'react';

import { useModal } from 'mui-modal-provider';

import { type ShowWindowOptions } from '@sheetxl/utils-react';

import { type InternalWindowProps } from './InternalWindow';
import { lazyModal } from './lazyModal';

/**
 * Creates a single instance given the type and import function
 *
 * @remarks
 * This relays on the onHide prop working
 */
function useLazyWindow<P extends InternalWindowProps>(propsDefault?: P): (type: string, importFunc: () => Promise<{ default: any }>, options: ShowWindowOptions, props?: P) => Promise<HTMLElement | null> {
  const [openDialogs, setOpenDialogs] = useState<Map<string, { id: string, element: HTMLElement | null, revealToken: number }>>(() => new Map());
  // Cache the lazy component per type. Rebuilding it on every open creates a new component identity,
  // forcing a remount and a fresh Suspense round-trip (microtask) even when the module is already
  // cached. Reusing the resolved component lets warm re-opens mount content synchronously.
  const refLazyByType = useRef<Map<string, any>>(null);
  if (refLazyByType.current === null) refLazyByType.current = new Map();
  // mui-modal-provider@2.4.6 fights keep-alive reuse two ways (its issue #78): (1) updateModal strips
  // `open`, so a hidden modal can't be re-opened declaratively; (2) with destroyOnClose=false it wires
  // TransitionProps.onExited -> destroy, tearing down the "kept" modal on its exit transition anyway.
  // Worked around here: InternalWindow skips that destroyer for keep-alive windows and re-shows off a
  // monotonic `revealToken` prop (bumped on reuse) instead of `open`. If this dance grows, vendoring /
  // replacing the provider is the cleaner path.
  const { showModal, updateModal, destroyModal, hideModal } = useModal({ disableAutoDestroy: true });

  const showWindow = (type: string, importFunc: () => Promise<{ default: any }>, options: ShowWindowOptions, props?: P): Promise<HTMLElement | null> => {
    return new Promise<HTMLElement | null>((resolveModal, error): void => {
      let disableAutoDestroy = false;
      if (options?.disableAutoDestroy !== undefined) {
        disableAutoDestroy = options.disableAutoDestroy;
        options = { ...options };
        delete options.disableAutoDestroy;
      }
      // Prewarm: mount hidden so the first real open is an instant reuse. Forces keep-alive (a
      // prewarmed window must survive to be reused) and mounts with open=false (never revealed).
      let prewarm = false;
      if (options?.prewarm !== undefined) {
        prewarm = options.prewarm;
        options = { ...options };
        delete options.prewarm;
        if (prewarm) disableAutoDestroy = true;
      }
      // Already mounted (or already prewarmed): a prewarm request is a no-op — nothing to reveal.
      if (prewarm && openDialogs.get(type)) {
        resolveModal(openDialogs.get(type)!.element);
        return;
      }
      const injectedProps = {
        ...propsDefault,
        ...options,
        ...props,
        onHide: () => {
          props?.onHide?.();
          if (disableAutoDestroy) {
            // Keep-alive: the window fades out on its own (local `visible`) but stays mounted AND
            // tracked so the next open reuses it via reveal() — instant, preserves position + state.
            // No hideModal/updateModal: updateModal strips `open` (can't re-show) and InternalWindow
            // already skips the provider's destroy-on-exit for keep-alive windows.
            return;
          }
          const dialog = openDialogs.get(type);
          setOpenDialogs((prev) => {
            prev.delete(type);
            return prev;
          });
          if (dialog?.id) hideModal(dialog.id);
        },
        onDone: (reason: any) => {
          props?.onDone?.(reason);
          // Keep-alive dialogs are never torn down on close; they are reused on the next open.
          if (disableAutoDestroy) return;
          const dialog = openDialogs.get(type);
          setOpenDialogs((prev) => {
            prev.delete(type);
            return prev;
          });
          if (dialog?.id) {
            destroyModal(dialog.id);
          }
        },
        onShown: (element: HTMLElement) => {
          setOpenDialogs((prev) => {
            const prevDialog = prev.get(type);
            if (prevDialog) {
              prev.set(type, {
                ...prevDialog,
                // Never let a null element wipe a good one (ref identity churns across re-renders).
                element: element ?? prevDialog.element
              });
            }
            return prev;
          });
          resolveModal(element);
        },
        // The window's module failed to load, so it was never shown: forget it (the next open loads
        // again) and reject. A prewarm has already resolved, so its failure stays silent.
        onLoadError: (loadError: unknown) => {
          const dialog = openDialogs.get(type);
          setOpenDialogs((prev) => {
            prev.delete(type);
            return prev;
          });
          if (dialog?.id) destroyModal(dialog.id);
          error(loadError);
        },
        // InternalWindow reads this to skip the provider's destroy-on-exit (mui-modal-provider#78)
        // and stay mounted for reuse. Not stripped by updateModal (only `open` is).
        disableAutoDestroy,
        // Bumped on each reuse to re-show the kept-alive window (see reopen path). 0 on fresh show.
        revealToken: 0,
        // Prewarm mounts hidden and suppresses the initial reveal; the first real open flips this false
        // (and bumps revealToken) to show it. `open` can't do this — the provider's SHOW forces it true.
        startHidden: prewarm,
        open: true
      };
      // Reuse a still-mounted instance (keep-alive). updateModal refreshes props/options and carries
      // the bumped revealToken that re-shows it (updateModal can't set `open` — it strips it).
      const existingModal = openDialogs.get(type);
      if (existingModal) {
        // Re-show by bumping revealToken (InternalWindow's effect calls setVisible(true)). Prop-based
        // so it never depends on a stale DOM element. updateModal refreshes options in the same pass.
        const nextToken = (existingModal.revealToken ?? 0) + 1;
        updateModal(existingModal.id, { ...injectedProps, revealToken: nextToken });
        setOpenDialogs((prev) => {
          const prevDialog = prev.get(type);
          if (prevDialog) prev.set(type, { ...prevDialog, revealToken: nextToken });
          return prev;
        });
        resolveModal(existingModal.element);
        return;
      }
      if (!importFunc) {
        error(`Invalid function for window '${type}'`);
        return; // throw an error
      }

      let dialog: any = refLazyByType.current!.get(type);
      if (!dialog) {
        dialog = lazyModal(importFunc);
        refLazyByType.current!.set(type, dialog);
      }

      const modal = showModal(dialog, injectedProps, {
        destroyOnClose: !disableAutoDestroy
      });
      setOpenDialogs((prev) => {
        prev.set(type, {
          id: modal.id,
          element: null,
          revealToken: 0
        });
        return prev;
      });
      // A prewarmed window mounts hidden and never fires onShown, so resolve now (nothing awaits the
      // element). A normal open resolves later, in onShown, once the window is actually shown.
      if (prewarm) resolveModal(null);
    })
  };
  return showWindow;
}

export default useLazyWindow;
export { useLazyWindow };
