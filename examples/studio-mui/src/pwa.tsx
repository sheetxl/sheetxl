import type React from 'react';
import { useEffect, useRef, useState } from 'react';

import { Button, Snackbar } from '@mui/material';

import { registerSW } from 'virtual:pwa-register';

/**
 * Whether the connection asks for data to be saved or is too slow for a background download.
 * `navigator.connection` is Chromium-only; elsewhere the connection is assumed to be fine.
 */
const isConstrainedConnection = (): boolean => {
  const connection = (navigator as any).connection;
  if (!connection) return false;
  return connection.saveData === true || /2g$/.test(connection.effectiveType ?? '');
};

/**
 * Whether a different version of the app has been deployed since this page loaded.
 *
 * @remarks
 * With a service worker, asks it to check for an update; a new version is then reported through
 * `onNeedRefresh`. Without one, compares this page's entry script with the one the server now serves.
 */
const isNewVersionDeployed = async (): Promise<boolean> => {
  const registration = await navigator.serviceWorker.getRegistration();
  if (registration) {
    await registration.update().catch(() => {});
    return false;
  }
  const entry = document.querySelector('script[type="module"][src]')?.getAttribute('src');
  if (!entry) return false;
  try {
    const response = await fetch('/', { cache: 'no-store' });
    return response.ok && !(await response.text()).includes(entry);
  } catch {
    return false;
  }
};

/**
 * Installs the service worker that makes the app work offline, and offers a reload when a new
 * version is available.
 *
 * @remarks
 * Installing downloads the whole app once, so on a constrained connection the first install waits
 * until the connection improves.
 */
export const OfflineSupport = (): React.ReactElement => {
  const [needRefresh, setNeedRefresh] = useState<boolean>(false);
  const [updateSW, setUpdateSW] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);
  // A newer version already controls this page (accepted in another tab), so only a reload helps.
  const refTakenOver = useRef<boolean>(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    let registered = false;
    const register = (): void => {
      if (registered) return;
      // An installed service worker still registers, so that updates are offered.
      if (!navigator.serviceWorker.controller && isConstrainedConnection()) return;
      registered = true;
      const update = registerSW({
        onNeedRefresh: () => setNeedRefresh(true)
      });
      setUpdateSW(() => update);
      // An installed app keeps its offline copy only if the browser does not evict it. Not asked in a
      // browser tab, where some browsers show a permission prompt for it.
      if (window.matchMedia('(display-mode: standalone)').matches) {
        void navigator.storage?.persist?.();
      }
    };
    register();

    const connection = (navigator as any).connection;
    connection?.addEventListener?.('change', register);

    // When another tab accepts an update, the new version takes control of this tab too, while this tab
    // still runs the old one whose chunks are no longer cached. The first install taking control is not
    // a new version.
    let controlled = !!navigator.serviceWorker.controller;
    const onControllerChange = (): void => {
      if (controlled) {
        refTakenOver.current = true;
        setNeedRefresh(true);
      }
      controlled = true;
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // A chunk can fail to load because a newer version was deployed and the chunk no longer exists.
    // Offer a reload only in that case; any other failure is reported where the feature failed.
    const onPreloadError = (): void => {
      if (!navigator.onLine) return;
      void isNewVersionDeployed().then((isNew) => {
        if (isNew) setNeedRefresh(true);
      });
    };
    window.addEventListener('vite:preloadError', onPreloadError);

    return () => {
      connection?.removeEventListener?.('change', register);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      window.removeEventListener('vite:preloadError', onPreloadError);
    };
  }, []);

  const reload = (): void => {
    if (updateSW && !refTakenOver.current) {
      void updateSW(true);
    } else {
      window.location.reload();
    }
  };

  return (
    <Snackbar
      open={needRefresh}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      message="A new version of SheetXL is available."
      action={
        <Button color="inherit" size="small" onClick={reload}>
          Reload
        </Button>
      }
    />
  );
};
