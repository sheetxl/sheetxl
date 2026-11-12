
/**
 * `requestAnimationFrame` / `cancelAnimationFrame` are browser-only globals. Access them via
 * `globalThis` so this framework-free base package needs no `dom` lib. They are `undefined` in
 * Node; the RAF-based helpers below are only meant for browser use.
 */
const requestAnimationFrame = (globalThis as any).requestAnimationFrame as
  | ((callback: (time: number) => void) => number)
  | undefined;
const cancelAnimationFrame = (globalThis as any).cancelAnimationFrame as
  | ((handle: number) => void)
  | undefined;

/**
 * Limits the number of times a function will be called within a given time.
 *
 * @param func The function
 * @param limit Delay in milliseconds
 * @template T - The type of the function
 */
 export function throttle<T extends Function>(func: T, limit: number) {
  let lastEventTimestamp: number | null = null;
  let callable = (...args: any) => {
    const now = Date.now();
    if (!lastEventTimestamp || now - lastEventTimestamp >= limit) {
      lastEventTimestamp = now;
      func(...args);
    }
  };
  return <T>(callable as any);
}

/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing.
 *
 * @param func The function
 * @param wait Delay in milliseconds
 * @param immediate It true will execute the first time immediately
 * @template T - The type of the function
 * @template R - The type returned from the function
 * @remarks
 * * **Attribution** - https://davidwalsh.name/function-debounce
 * * **Attribution** - https://github.com/component/debounce
 */
export function debounce<T extends Function, R=any>(func: T, wait: number=300, immediate: boolean=false): R {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let args:any; // really typed to debounced.
  let context:any; // initial arguments
  let timestamp:number =0;
  let result:R;
  if (null == wait) wait = 100;

  function later() {
    let last = Date.now() - timestamp;

    if (last < wait && last >= 0) {
      timeout = setTimeout(later, wait - last);
    } else {
      timeout = null;
      if (!immediate) {
        result = func.apply(context, args);
        context = args = null;
      }
    }
  };

  const debounced:any = function() {
    context = globalThis;
    args = arguments;
    timestamp = Date.now();
    var callNow = immediate && !timeout;
    if (!timeout) timeout = setTimeout(later, wait);
    if (callNow) {
      result = func.apply(context, args);
      context = args = null;
    }

    return result;
  };

  debounced.clear = function(): void {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  debounced.flush = function() {
    if (timeout) {
      result = func.apply(context, args);
      context = args = null;

      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
};

/**
 * Creates a throttled version of the provided callback function using requestAnimationFrame.
 * The returned function ensures that the callback is invoked at most once per animation frame,
 * regardless of how many times the returned function is called.
 *
 * @param callback - The function to be throttled
 * @returns A throttled version of the callback function
 */
export const rafThrottle = (callback: Function): any => {
  let active = false; // a simple flag
  let evt: any; // to keep track of the last event
  const handler = function () {
    // fired only when screen has refreshed
    active = false; // release our flag
    callback(evt);
  };
  return function handleEvent(e: any) {
    // the actual event handler
    evt = e; // save our event at each call
    evt && evt.persist && evt.persist();
    if (!active) {
      // only if we weren't already doing it
      active = true; // raise the flag
      requestAnimationFrame!(handler); // wait for next screen refresh
    }
  };
}

/**
 * Executes a callback function on the next tick of the event loop or animation frame.
 * This function provides a consistent way to defer execution across different environments.
 *
 * In browser environments, it uses requestAnimationFrame for smooth visual updates.
 * In Node.js or non-browser contexts, it uses setImmediate (if available) or setTimeout.
 *
 * @param callback - The function to execute on the next tick
 */
export const nextTick = (callback: Function): void => {
  // Use appropriate method based on environment
  if (typeof requestAnimationFrame === 'function') {
    // Browser environment - use requestAnimationFrame
    requestAnimationFrame(() => {
      callback();
    });
  } else {
    // Node environment or non-browser context - use setImmediate or setTimeout
    // `setImmediate` is Node-only; reach it via globalThis so this base lib needs no @types/node.
    const globalSetImmediate = (globalThis as any).setImmediate as
      | ((cb: (...args: any[]) => void) => unknown)
      | undefined;
    const setImmediateOrTimeout = typeof globalSetImmediate === 'function'
      ? globalSetImmediate
      : setTimeout;

    setImmediateOrTimeout(() => {
      callback()
    });
  }
}


// Animation frame based implementation of setTimeout.
// Inspired by Joe Lambert, https://gist.github.com/joelambert/1002116#file-requesttimeout-js

const hasNativePerformanceNow =
  typeof performance === "object" && typeof performance.now === "function";

const now = hasNativePerformanceNow
  ? () => performance.now()
  : () => Date.now();

export type TimeoutID = {
  id: number;
};

/**
 * Cancels a timeout set by `requestTimeout`.
 *
 * @param timeoutID The timeout ID to cancel.
 */
export const cancelTimeout = (timeoutID: TimeoutID): void => {
  cancelAnimationFrame!(timeoutID.id);
}

/**
 * Create a throttler based on RAF.
 *
 * @param callback The callback function
 * @param delay The delay
 */
export const requestTimeout = (callback: Function, delay: number): TimeoutID => {
  const start = now();

  function tick() {
    if (now() - start >= delay) {
      callback.call(null);
    } else {
      timeoutID.id = requestAnimationFrame!(tick);
    }
  }

  const timeoutID: TimeoutID = {
    id: requestAnimationFrame!(tick)
  };

  return timeoutID;
}
