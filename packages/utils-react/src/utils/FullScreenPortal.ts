import { useState, useEffect, useCallback } from 'react';

import styles from './FullScreenPortal.module.css';

export interface FullscreenPortalRoot {
  getPortalContainer: () => Element;
  isFullscreen: boolean;
}

let portalRootRefCount = 0;

// Stable literal classes — used as the `querySelector` hook (and available to consumers/tests). The
// base wrapper is ALWAYS present; the fullscreen marker is added only while the Fullscreen API is
// active. Each is paired with the CSS-module (hashed) class that actually carries the styling.
const CLASS_ROOT = 'sxl-portal-root';
const CLASS_FULLSCREEN = 'sxl-fullscreen';

/**
 * Ensure the single shared portal-root wrapper exists and is parented under the correct container:
 * the current fullscreen element when one is active, otherwise `document.body`. Returns the wrapper.
 *
 * The wrapper is a positioned, `pointer-events: none` layer (children re-enable pointer events) giving
 * every portaled overlay one consistent mount point in BOTH modes. Previously this layer only existed
 * in fullscreen; in normal mode overlays portaled straight into `document.body` and missed the wrapper
 * (its pointer-events isolation, and — in fullscreen — its z-index). See the CSS for why the base
 * wrapper carries no z-index (it must not create a stacking context that caps overlays).
 *
 * Idempotent: safe to call during render (some consumers resolve the portal target inline) and from
 * effects. On a fullscreen enter/exit it re-homes the SAME node (moving it preserves the React portals
 * already mounted into it) so overlays don't render under the fullscreen surface.
 */
const ensurePortalRoot = (): HTMLDivElement => {
  const fsElem = document.fullscreenElement as HTMLElement | null;
  const parent = fsElem ?? document.body;

  let portalRoot = document.querySelector('.' + CLASS_ROOT) as HTMLDivElement | null;
  if (!portalRoot) {
    portalRoot = document.createElement('div');
    portalRoot.className = `${CLASS_ROOT} ${styles['portal-root']}`;
  }
  // Re-home across a fullscreen enter/exit: the fullscreen element is a fresh containing block, so an
  // overlay left portaled into `body` would render UNDER the fullscreen surface (or be culled).
  if (portalRoot.parentElement !== parent) {
    parent.appendChild(portalRoot);
  }
  // Fullscreen-only marker (adds the stacking context / z-index); the base layer is otherwise shared.
  const isFs = !!fsElem;
  portalRoot.classList.toggle(CLASS_FULLSCREEN, isFs);
  portalRoot.classList.toggle(styles['fullscreen'], isFs);
  return portalRoot;
};

export function useFullscreenPortal(): FullscreenPortalRoot {
  const [isFullscreen, setFullscreen] = useState<boolean>(!!document.fullscreenElement);

  /**
   * Get the shared portal container. Called during render by some consumers (e.g. FloatPopper's
   * `createPortal` target), so it must be safe + idempotent — it lazily provisions the wrapper.
   */
  const getPortalContainer = useCallback((): Element => {
    return ensurePortalRoot();
  }, []);

  useEffect(() => {
    const onFullscreenChange = (): void => {
      setFullscreen(!!document.fullscreenElement);
      ensurePortalRoot(); // re-parent the shared wrapper under the new container
    };

    portalRootRefCount++;
    ensurePortalRoot();
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      portalRootRefCount--;
      if (portalRootRefCount <= 0) {
        portalRootRefCount = 0;
        document.querySelectorAll('.' + CLASS_ROOT).forEach((node) => {
          node.parentNode?.removeChild(node);
        });
      }
    };
  }, []);

  return { getPortalContainer, isFullscreen };
}
