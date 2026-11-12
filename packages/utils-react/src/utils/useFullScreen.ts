import { useState, useCallback, useEffect, type RefObject } from 'react';

/**
 * React hook for controlling the Fullscreen API.
 *
 * Correctly handles restricted contexts such as iframes where
 * `document.fullscreenEnabled` may be `true` but the Permissions Policy
 * actually blocks the API. Detection is performed in order:
 *
 *   1. `document.permissionsPolicy?.allowsFeature('fullscreen')` (modern)
 *   2. `document.featurePolicy?.allowsFeature('fullscreen')` (older Chrome)
 *   3. `document.fullscreenEnabled` (fallback)
 *
 * If `requestFullscreen` throws a `TypeError` at runtime, `isFullscreenAvailable`
 * is reactively set to `false` so the UI can hide or disable the button.
 */

interface UseFullscreenProps {
  /** The element to make fullscreen. Defaults to `document.documentElement`. */
  target?: RefObject<Element | null>;
  /** Called whenever the fullscreen state changes. */
  onChange?: (event: Event) => void;
  /** Called when a fullscreen error occurs. */
  onError?: (event: Event) => void;
  /** Options forwarded to `requestFullscreen`. */
  requestFullScreenOptions?: FullscreenOptions;
}

function checkFullscreenAllowed(): boolean {
  if (typeof document === 'undefined') return false;

  // Modern Permissions Policy API
  const policy = (document as any).permissionsPolicy ?? (document as any).featurePolicy;
  if (policy?.allowsFeature) {
    return policy.allowsFeature('fullscreen');
  }

  // Fallback – less reliable inside iframes
  return !!(document as any).fullscreenEnabled;
}

/**
 * Controls the browser Fullscreen API for a target element.
 *
 * @param props - See {@link UseFullscreenProps}.
 * @returns
 *   - `isFullscreenAvailable` — `true` when the current context permits fullscreen.
 *   - `isFullscreenEnabled` — `true` when an element is currently fullscreen.
 *   - `fullscreenElement` — The element that is currently fullscreen, or `null`.
 *   - `enableFullscreen` — Requests fullscreen on the target element.
 *   - `disableFullscreen` — Exits fullscreen.
 *   - `toggleFullscreen` — Toggles between fullscreen and normal.
 */
export function useFullscreen(props: UseFullscreenProps = {}) {
  const { target, onChange, onError, requestFullScreenOptions } = props;

  const [isFullscreenAvailable, setIsFullscreenAvailable] = useState<boolean>(false);
  const [fullscreenElement, setFullscreenElement] = useState<Element | null>(null);
  const [isFullscreenEnabled, setIsFullscreenEnabled] = useState<boolean>(false);

  // Evaluate on first client-side render
  useEffect(() => {
    setIsFullscreenAvailable(checkFullscreenAllowed());
  }, []);

  const enableFullscreen = useCallback(async () => {
    const element = target?.current ?? document.documentElement;
    try {
      await element.requestFullscreen(requestFullScreenOptions);
    } catch (err) {
      // Permissions Policy violation surfaces as TypeError in some webviews
      if (err instanceof TypeError || (err instanceof DOMException && err.name === 'TypeError')) {
        setIsFullscreenAvailable(false);
      }
      throw err;
    }
  }, [target, requestFullScreenOptions]);

  const disableFullscreen = useCallback(async () => {
    await document.exitFullscreen();
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) return disableFullscreen();
    return enableFullscreen();
  }, [enableFullscreen, disableFullscreen]);

  const onChangeHandler = useCallback(
    (event: Event) => {
      const el = document.fullscreenElement ?? null;
      setFullscreenElement(el);
      setIsFullscreenEnabled(!!el);
      onChange?.(event);
    },
    [onChange]
  );

  const onErrorHandler = useCallback(
    (event: Event) => {
      const el = document.fullscreenElement ?? null;
      setFullscreenElement(el);
      setIsFullscreenEnabled(!!el);
      onError?.(event);
    },
    [onError]
  );

  useEffect(() => {
    document.addEventListener('fullscreenchange', onChangeHandler);
    document.addEventListener('fullscreenerror', onErrorHandler);
    return () => {
      document.removeEventListener('fullscreenchange', onChangeHandler);
      document.removeEventListener('fullscreenerror', onErrorHandler);
    };
  }, [onChangeHandler, onErrorHandler]);

  return {
    isFullscreenAvailable,
    fullscreenElement,
    isFullscreenEnabled,
    enableFullscreen,
    disableFullscreen,
    toggleFullscreen,
  };
}
