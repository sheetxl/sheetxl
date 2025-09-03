import { useState, useEffect, useRef } from 'react'

export interface DevicePixelRatioOptions {
  /**
   * Default DPR to use if browser does not support the `devicePixelRatio`
   * property, or when rendering on server
   *
   * @defaultValue `1`
   */
  defaultDpr?: number

  /**
   * Whether or not to round the number down to the closest integer
   *
   * @defaultValue `true`
   */
  round?: boolean

  /**
   * Maximum DPR to return (set to `2` to only generate 1 and 2)
   *
   * @defaultValue `3`
   */
  maxDpr?: number
}

/**
 * Get the device pixel ratio, potentially rounded and capped.
 * Will emit new values if it changes.
 *
 * @param options
 * @returns The current device pixel ratio, or the default if none can be resolved
 */
export function useDevicePixelRatio(options?: DevicePixelRatioOptions) {

  const [currentDpr, setCurrentDpr] = useState(typeof window !== 'undefined' ? window.devicePixelRatio : 1);
  const refUnlistener = useRef<any>(null);

  useEffect(() => {
    const canListen = typeof window !== 'undefined' && 'matchMedia' in window
    if (!canListen) {
      return
    }

    const listener = () => {
      const mediaMatcher = window.matchMedia(`screen and (resolution: ${window.devicePixelRatio}dppx)`);
      mediaMatcher.addEventListener('change', listener, {once: true, passive: true });
      setCurrentDpr(window.devicePixelRatio);
      refUnlistener.current = {
        mediaMatcher,
        listener
      }
    }
    listener();

    return () => {
      if (refUnlistener.current)
        refUnlistener.current.mediaMatcher.removeEventListener('change', refUnlistener.current.listener);
    }
  }, [options])

  return currentDpr
}

/**
 * Returns the current device pixel ratio (DPR) given the passed options
 *
 * @param options
 * @returns current device pixel ratio
 */
export function getDevicePixelRatio(options?: DevicePixelRatioOptions): number {
  if (typeof window === "undefined") return 1; // Default for SSR
  const {defaultDpr = 1, maxDpr = 3, round = true} = options || {}
  const hasDprProp = typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
  const dpr = hasDprProp ? window.devicePixelRatio : defaultDpr
  const rounded = Math.min(Math.max(1, round ? Math.floor(dpr) : dpr), maxDpr)
  return rounded
}