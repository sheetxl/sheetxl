import { useState, useEffect, useCallback } from 'react';

import styles from './FullScreenPortal.module.css';

export interface FullscreenPortalRoot {
  getPortalContainer: () => Element;
  isFullscreen: boolean;
}
let portalRootRefCount = 0;

const classNamePortal = styles['fullscreen-portal-root'];
export function useFullscreenPortal(): FullscreenPortalRoot {

  const [isFullscreen, setFullscreen] = useState<boolean>(!!document.fullscreenElement);
  /**
   * Get the portal container element.
   */
  const getPortalContainer = useCallback((): Element => {
    const fsElem = document.fullscreenElement;
    if (fsElem) {
      // Try to find a special portal root inside the fullscreen element
      return fsElem.querySelector('.fullscreen-portal-root') || fsElem;
    }
    return document.body;
  }, []);

  useEffect(() => {
    function ensurePortalRoot() {
      const fsElem = document.fullscreenElement;
      setFullscreen(!!fsElem);
      if (!fsElem) return;
      let portalRoot = fsElem.querySelector('.fullscreen-portal-root') as HTMLDivElement;
      if (!portalRoot) {
        portalRoot = document.createElement('div');
        portalRoot.className = 'fullscreen-portal-root ' + classNamePortal;
        fsElem.appendChild(portalRoot);
      }
    }

    function cleanupPortalRoot() {
      portalRootRefCount--;
      if (portalRootRefCount <= 0) {
        document.querySelectorAll('.fullscreen-portal-root').forEach(node => {
          if (node.parentNode) node.parentNode.removeChild(node);
        });
        portalRootRefCount = 0;
      }
    }

    portalRootRefCount++;
    ensurePortalRoot();
    document.addEventListener('fullscreenchange', ensurePortalRoot);

    return () => {
      document.removeEventListener('fullscreenchange', ensurePortalRoot);
      cleanupPortalRoot();
    };
  }, []);

  return { getPortalContainer, isFullscreen };
}