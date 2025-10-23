import { Rectangle, Bounds } from '../types';

import { deepEqual } from './DeepEqual';
import deepMerge from './DeepMerge';

export { deepEqual };
export { deepMerge };

export const EmptyArray: any = Object.freeze([]);
export const EmptyObject: any = Object.freeze({});
const DefaultValueGetter = <T>(v: T): number => v as number;

/**
 * Validates the value is in the object keys.
 *
 * @param enumType An enum or object with keys
 * @param value A value that must match one of the keys
 */
export const validEnumValue = <T=any>(enumType: any/*typeof T*/, value: T): void => {
  if (!Object.values(enumType).includes(value)) {
    throw new Error(`Invalid type: ${value ?? 'null'}. Must be one of: ${Object.values(value).join(', ')}.`);
  }
}

/**
 * Converts a camelCase string to a human-readable format with spaces between words.
 *
 * @param strInput The camelCase string to convert.
 * @returns The string converted to pretty case, with spaces between words and the first letter capitalized.
 *
 * @example
 * ```ts
 * camelToPrettyCase('camelCaseString'); // Returns "Camel Case String"
 * ```
 */
export const camelToPrettyCase = (strInput: string): string => {
  // TODO - use this one.
  // return str
  //   .replace(/([a-z])([A-Z])/g, '$1 $2')  // Insert space between lowercase and uppercase letters
  //   .replace(/^./, (char) => char.toUpperCase()); // Capitalize the first letter

  if (strInput.length === 1)
    return strInput.toUpperCase();
  return strInput
  // insert a space before all caps
  .replace(/([A-Z])/g, ' $1')
  // uppercase the first character
  .replace(/^./, function(str){ return str.toUpperCase(); }).trim();
}

export const textToKey = (str: string): string => {
  return str.replace(/[^a-zA-Z0-9]/g, ``).toLowerCase();
}

export const uuidV4 = (): string => {
  /* cspell: disable-next-line */
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    let r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


/**
 * Converts a given value to a number, returning `0` if the value cannot be parsed
 * as a valid finite number.
 *
 * The function first attempts to coerce the value into a number using `parseAsNumber`.
 * If the resulting number is `NaN` or `Infinity`, the function returns `0`. Otherwise,
 * it returns the parsed number.
 *
 * @param value The value to be converted to a number.
 * @returns The parsed number if it's finite, otherwise `0`.
 *
 * @example
 * ```typescript
 * asNumber("123");    // 123
 * asNumber("abc");    // 0
 * asNumber(null);     // 0
 * asNumber("12.34");  // 12.34
 * asNumber(Infinity); // 0
 * ```
 */
export const asNumber = (value: any): number => {
  const parsedValue = parseAsNumber(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

/**
 * Converts a value to a number.
 * @param value
 * @returns As a number it may be `Number.NaN`.
 */
const parseAsNumber = (value: any): number => {
  //https://flaviocopes.com/how-to-convert-string-to-number-javascript/
  // parseAsNumber thinks that '12/31/2018' is a number
  // Number('3e3') works but is 'slowest'
  return value * 1;
}

/**
 * Checks if a given value can be parsed as a finite number.
 *
 * This function attempts to coerce the provided value into a number using `parseAsNumber`
 * and then determines if the result is both finite and of type `number`.
 * It filters out `NaN`, `Infinity`, `-Infinity`, and non-numeric types.
 *
 * @param value The value to be checked.
 * @returns `true` if the value can be parsed as a finite number, `false` otherwise.
 *
 * @example
 * ```
 * isNumeric("123");        // true
 * isNumeric("12.34");      // true
 * isNumeric("12e5");       // true
 * isNumeric("abc");        // false
 * isNumeric(null);         // false
 * isNumeric(Infinity);     // false
 * ```
 */
export const isNumeric = (value: any): boolean  => {
  /* inline parseAsNumber for performance */
  const num:number = value * 1;//parseAsNumber(n);
  return Number.isFinite(num) && typeof num === 'number';// && !Number.isNaN(num) ;
}

/**
 * Describes the parts of floating point number.
 */
export interface SplitNumber {
  /**
   * The integer part.
   */
  ip: number;
  /**
   * The floating part.
   */
  fp: number;
  /**
   * The number if digits for the integer part.
   */
  ipLength: number;
  /**
   * The number of digits for the floating part.
   */
  fpLength: number;
}

/**
 * Splits a number into the integer and fractional parts. Also returns the length of each
 * component for rounding and doesn't use string to be high performant.
 * This has a max precision of 7.
 */
export const splitNumber = (value: number): SplitNumber => {
  let absValue = Math.abs(value);
  if (isNaN(absValue) || !isFinite(value))
    return null;

  /* bitwise is 'faster' than trunc */
  let ip = absValue | 0;//Math.trunc(absValue);
  let fpOriginal = absValue - ip;
  let fp = 0;

  let fpLength = 0;
  let fpMultiple = 1;
  if (fpOriginal > 0.00000005) {
    while (fpLength < 8 && Math.abs(fp / fpMultiple - fpOriginal) > 0.00000005) {
      fpLength++;
      /* *10 over power */
      fpMultiple *= 10; // fpMultiple = Math.pow(10, fpLength);
      fp = Math.round(fpOriginal * fpMultiple);
    }
  }

  return {
    ip: Math.trunc(value),
    fp: fp,
    ipLength: Math.ceil(Math.log10(ip + 1)),
    fpLength: fpLength,
  }
}

/**
 * Rounds a number to a specified number of decimal places, ensuring precision is maintained.
 * If no decimal places are provided, the default is 0 (rounds to the nearest integer).
 *
 * This function uses scientific notation to avoid floating-point precision errors
 * commonly associated with rounding in JavaScript.
 *
 * @param number The number to round. If the number is `null` or not finite (e.g., `Infinity`), `null` is returned.
 * @param decimalPlaces The number of decimal places to round to (default is 0).
 * @returns The rounded number, or `null` if the input is invalid.
 *
 * @example
 * ```typescript
 * roundAccurately(123.4567, 2); // 123.46
 * roundAccurately(123.4567);    // 123
 * roundAccurately(123.4567, 0); // 123
 * roundAccurately(null);        // null
 * roundAccurately(Infinity);    // null
 * ```
 */
export const roundAccurately = (number: number, decimalPlaces: number = 0): number => {
  if (number == null || !isFinite(number)) return null;

  // Use scientific notation for more accurate rounding
  const factor = 10 ** decimalPlaces;
  return Number(Math.round(number * factor) / factor);
};


// export const roundAccuratelyOrig = (number: number, decimalPlaces: number = null): number => {
//   if (number == null || !isFinite(number)) return null;

//   // nothing to round
//   if (number % 1 === 0) return number;
//   if (decimalPlaces === null) {
//     decimalPlaces = 15 - splitNumber(number).ipLength; // we round based on the power of ips
//   }

//   let multiplier = 10 ** (decimalPlaces || 0);//Math.pow(10, decimalPlaces || 0);
//   return Math.round(number * multiplier) / multiplier;
// };

export const cloneObject = (value: any): any => {
  if (isNullOrUndefined(value)) return value;
  // return structuredClone(value);
  // return structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  // This seems to be faster then structured clone
  return JSON.parse(JSON.stringify(value));
}

/**
 * Checks whether two arrays are equal in terms of length and element values.
 *
 * The function compares the arrays for strict equality (`===`) for each element.
 * It first checks if the arrays reference the same object and returns `true` in that case.
 * If not, it ensures both arguments are arrays of the same length, and then compares their elements.
 *
 * @typeParam T - The type of the elements in the arrays.
 * @param a The first array to compare.
 * @param b The second array to compare.
 * @returns `true` if the arrays are equal in length and content, `false` otherwise.
 *
 * @example
 * ```typescript
 * isEqualArrays([1, 2, 3], [1, 2, 3]); // true
 * isEqualArrays([1, 2, 3], [1, 2, 4]); // false
 * isEqualArrays([1, 2], [1, 2, 3]);    // false
 * isEqualArrays([], []);               // true
 * ```
 */
export const isEqualArrays = <T=any>(a: T, b: T): boolean => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((val, index): boolean => {
    return val === b[index];
  });

}

/**
 * This just looks at the key at the top level. It does not compare
 * actual instances or traverse.
 */
export const isEqualObjectKeys = <T=any>(a: T, b: T): boolean => {
  if (a === b) return true;
  if ((a && !b) || (b && !a)) return false;
  const keysA = Object.keys(a);
  const keysALength = keysA.length;
  if (keysALength !== Object.keys(b).length) return false;
  for (let k=0; k<keysALength; k++) {
    const keyA = keysA[k];
    if (a[keyA] !== b[keyA])
      return false;
  }
  return true;
}
/**
 * Check if two bounds are equal.
 * @param a The first bounds.
 * @param b The second bounds.
 */
// TODO - move to GeomUtils? - Only used by DrawingUI
export const isEqualBounds = (a: Bounds | undefined, b: Bounds | undefined): boolean => {
  if (a === b) return true;
  if ((a && !b) || (b && !a)) return false;

  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height
  );
};

export const isObject = (obj: any): boolean => {
  return (typeof obj === 'object' && !Array.isArray(obj) && obj !== null);
  // return obj !== undefined && obj !== null && obj.constructor == Object;
}

export const removeEmptyProperties = (obj: any): any => {
  if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) return obj;
  Object.keys(obj).forEach(function (key) {
    if (obj[key] && typeof obj[key] === "object")
      removeEmptyProperties(obj[key]);
    //recursive for objects
    else if (obj[key] === null || obj[key] === undefined) delete obj[key]; //remove empty properties
    if (typeof obj[key] === "object" && Object.keys(obj[key]).length === 0)
      delete obj[key]; //remove empty objects
  });

  // if the user passed in null or remove all keys then we return null.
  if ( Object.keys(obj).length === 0)
    return null;
  return obj;
}

export const removeListenerAll = (removeListeners: [() => void]): [] => {
  if (!removeListeners) return EmptyArray;
  const removeListenersLength = removeListeners.length;
  for (let i=0; i<removeListenersLength; i++) {
    const listener = removeListeners[i];
    if (!listener) continue;
    listener();
  }
  return EmptyArray;
}

/**
 * Transposes a 2D matrix (array of arrays).
 *
 * @param matrix The 2D array to transpose.
 * @returns The transposed 2D array.
 */
export const transpose = (matrix: number[][]): number[][] => {
  //   return matrix[0].map((col, i) => matrix.map(row => row[i]));
  if (!matrix)
    return matrix;
  const rows = matrix.length,
  cols = matrix[0].length;
  const transposed = [];
  for (let j=0; j<cols; j++) {
    transposed[j] = Array(rows);
  }
  for (let i=0; i<rows; i++) {
    for (let j=0; j<cols; j++) {
      transposed[j][i] = matrix[i][j];
    }
  }
  return transposed;
}

// const equalityCompare = (update: any, updateFrom: any) => update === updateFrom;
const equalityCompare = (update: any, original: any): boolean => {
  if (update === original || isEqualArrays(update, original))
    return true;

  if (update.isEqual?.(original))
    return true;
  return false;
};

/**
 * Removes from update any values that are identical in original.
 *
 * @param update The object to update.
 * @param original The original object to compare against.
 * @param isEqual A function to compare values for equality. Defaults to strict equality.
 *
 * @remarks
 * This mutates the update object.
 */
export const removeEqualValues = (update: any, original: any, isEqual:(update: any, original: any) => boolean = equalityCompare): void => {
  if (update === null || update === undefined || update === original) return null;
  if (!(update && typeof update === 'object' && !Array.isArray(update) && !update.isImmutable?.())) {
    return isEqual(update, original) ? null : update;
  }
  const keys = Object.keys(update);
  const keysLength = keys.length;
  if (keysLength === 0) return null;
  let hasDelete = false;
  for (let k=0; k<keysLength; k++) {
    const key = keys[k];
    let value = removeEqualValues(update[key], original?.[key], isEqual);
    if (value === null) {
      hasDelete = true;
      delete update[key];
    }
  }

  if (hasDelete  && Object.keys(update).length === 0) return null;
}

/**
 * Simple wrapper around deepMerge that returns
 * Takes a two json objects and returns a deeply merged Json object.
 *
 * The json object will remove nulls so to remove values set null as the options within the second argument
 * Merge plain Json object but not arrays or (currently) objects with functions
 *
 * @remarks
 * Will try to merge functions.
 */
export const mergeContentful = (...args: any[]): any => {
  const argsLength = args.length;
  if (argsLength > 0 && args[argsLength - 1] !== undefined && !isObject(args[argsLength - 1]))
    return args[argsLength - 1];

  let retValue = args[0] || {};
  for (let i=1; i<argsLength; i++) {
    retValue = deepMerge(retValue, args[i] || {}, {
      arrayMerge: (_destinationArray, sourceArray: any[]) => {
        return [...sourceArray];
      }

    });
  }

  return retValue;
}

/**
 * Simple util that scans 2 objects and returns a new
 * object with values from check that are different than template.
 */
export const diffValues = (check: Object, template: Object): Object => {
  const diffs = {};
  const keys = Object.keys(template);
  const keysLength = keys.length;
  for (let k=0; k<keysLength; k++) {
    const key = keys[k];
    const checkValue = check[key];
    const templateValue = template[key];
    if (checkValue === templateValue)
      continue;
    if (checkValue === undefined)
      diffs[key] = templateValue;
    else
      diffs[key] = checkValue;
  }
  if (Object.keys(diffs).length === 0) {
    return null;
  }
  return diffs;
}

/**
 * Simple binary search that returns the offset of item that is >= the value 'x' passed in.
 */
export const findEqualOrGreater = function<T=any>(arr: readonly T[], x: number, f: ((v: T) => number)=DefaultValueGetter): number {
  let start=0;
  let end=arr.length-1;
  // Iterate while start not meets end
  while (start<=end) {
    // Find the mid index
    let mid=Math.floor((start + end)/2);
    let v = f(arr[mid]);
    // If element is present at mid, return True
    if (v === x) return mid;
    // Else look in left or right half accordingly
    if (v < x)
      start = mid + 1;
    else
      end = mid - 1;
  }
  return start;
}

/*
 * Simple binary search that returns the offset of item that is <= the value 'x' passed in.
*/
export const findEqualOrLesser = function<T=any>(arr: readonly T[], x: number, f: ((v: T) => number)=DefaultValueGetter): number {
  let start=arr.length-1;
  let end=0;
  // Iterate while start not meets end
  while (start>=end) {
    // Find the mid index
    let mid=Math.floor((start + end)/2);
    let v = f(arr[mid]);
    // If element is present at mid, return True
    if (v === x) return mid;
    // Else look in left or right half accordingly
    if (v > x)
      start = mid - 1;
    else
      end = mid + 1;
  }
  return start;
}

/**
 * Move an array item to a different position. Returns a new array with the item moved to the new position.
 */
export function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = array.slice();
  newArray.splice(to < 0 ? newArray.length + to : to, 0, newArray.splice(from, 1)[0]);
  return newArray;
}

// /**
//  * Swap an array item to a different position. Returns a new array with the item swapped to the new position.
//  */
// export function arraySwap<T>(array: T[], from: number, to: number): T[] {
//   const newArray = array.slice();
//   newArray[from] = array[to];
//   newArray[to] = array[from];
//   return newArray;
// }

/**
 * Limits the number of times a function will be called within a given time.
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
  let timeout:NodeJS.Timeout;
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

export const rafThrottle = (callback: Function): any => {
  let active = false; // a simple flag
  let evt: any; // to keep track of the last event
  let handler = function () {
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
      requestAnimationFrame(handler); // wait for next screen refresh
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
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    // Browser environment - use requestAnimationFrame
    window.requestAnimationFrame(() => {
      callback();
    });
  } else {
    // Node environment or non-browser context - use setImmediate or setTimeout
    const setImmediateOrTimeout = typeof setImmediate === 'function'
      ? setImmediate
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

export const cancelTimeout = (timeoutID: TimeoutID): void => {
  cancelAnimationFrame(timeoutID.id);
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
      timeoutID.id = requestAnimationFrame(tick);
    }
  }

  const timeoutID: TimeoutID = {
    id: requestAnimationFrame(tick)
  };

  return timeoutID;
}

/**
 * Converts a value to string.
 * @param value The value to cast.
 * @returns `undefined` if value was null or void.
 */
export const castToString = (value: any): string | undefined => {
  if (value === null || value === undefined || value === void 0) return "";
  return typeof value !== "string" ? "" + value : value;
};

export const isNullOrUndefined = (value: any): boolean => {
  return value === undefined || value === null;
}

export const isDefined = (value: any): boolean => {
  /* inlined - isNullOrUndefined */
  return !(value === undefined || value === null);
}

/**
 * Returns `true` if `undefined` or `null` or `''`.
 */
export const isEmpty = (value: any): boolean => {
  return value === undefined || value === null || value === "";
}

/**
 * Checks if the value is a Promise-like object.
 */
export const isPromiseLike = (obj: any): boolean => {
  return !!obj && typeof obj.then === 'function';
}

/**
 * Check if rectangles intersect.
 * @param a
 * @param b
 */
export const isRectIntersect = (a: Rectangle, b: Rectangle): boolean => {
  return !(
    b.left > a.right ||
    b.right < a.left ||
    b.top > a.bottom ||
    b.bottom < a.top
  );
}

export const canUseDOM = !!(
  typeof window !== "undefined" &&
  window.document &&
  window.document.createElement
);

/**
 * Check if rect is inside another rect.
 *
 * @param needle Inside `Rectangle`
 * @param haystack Outside `Rectangle`
 */
export const isRectInsideRect = (needle: Rectangle, haystack: Rectangle): boolean => {
  // TODO - make or for performance
  // TODO - switch args to make consistent with subtractRect
  return (
    needle.top >= haystack.top &&
    needle.bottom <= haystack.bottom &&
    needle.left >= haystack.left &&
    needle.right <= haystack.right
  );
};

/**
* Breaks the outer rect into 1-4 parts based on the inner rect.
* If the inner rect doesn't intersect then a 0 length array will be returned.
*
* This assumes both valid (bottom > top, right > left) and non zero rects
* @param rectOuter The outer rectangle.
* @param rectInner The inner rectangle.
* @param vertical Subtract vertical before horizontal. Default Value `false`.
*/
export const subtractRect = (rectOuter: Rectangle, rectInner: Rectangle, vertical: boolean=false): Rectangle[] => {
  if (!rectInner) return [rectOuter];
  if (!isRectIntersect(rectOuter, rectInner))
    return [];

  const retValue:Rectangle[] = [];
  let rectRemaining = rectOuter;
  const stripTop = () => {
    if (rectInner.top > rectRemaining.top && rectInner.top < rectRemaining.bottom) {
      retValue.push({
        ...rectRemaining,
        bottom: rectInner.top
      })
      rectRemaining = {
        ...rectRemaining,
        top: rectInner.top
      }
    }
  }

  const stripBottom = () => {
    if (rectInner.bottom > rectRemaining.top && rectInner.bottom < rectRemaining.bottom) {
      retValue.push({
        ...rectRemaining,
        top: rectInner.bottom
      })
      rectRemaining = {
        ...rectRemaining,
        bottom: rectInner.bottom
      }
    }
  }

  const stripRight = () => {
    if (rectInner.right > rectRemaining.left && rectInner.right < rectRemaining.right) {
      retValue.push({
        ...rectRemaining,
        left: rectInner.right
      })
      rectRemaining = {
        ...rectRemaining,
        right: rectInner.right
      }
    }
  }

  const stripLeft = () => {
    if (rectInner.left > rectRemaining.left && rectInner.left < rectRemaining.right) {
      retValue.push({
        ...rectRemaining,
        right: rectInner.left
      })
      rectRemaining = {
        ...rectRemaining,
        left: rectInner.left
      }
    }
  }

  if (vertical) {
    stripLeft();
    stripRight();
    stripTop();
    stripBottom()
  } else { // horizontal
    stripTop();
    stripBottom();
    stripRight();  // same order 90%
    stripLeft()
  }

  return retValue;
}

export const getFromPath = (obj: Record<string, any>, path: string): Record<string, any> => {
  const segments: string[] = path.split(".");
  let currentObject = obj;
  const segmentsLength = segments.length;
  for (let i=0; i<segmentsLength; i++) {
    const seg = segments[i];
    if (!currentObject)
      return null;

    let child:any = currentObject[seg];
    if (typeof child === 'function') {
      child = child.bind(currentObject)();
    }
    if (!child || !isObject(child)) {
      return child;
    }

    currentObject = child;
  }
  return currentObject ?? null;
}

export const setToPath = (obj: Record<string, any>, path: string, value: Record<string, any>): Record<string, any> => {
  const segments:string[] = path.split(".");
  let currentObject:Record<string, any> = obj;
  if (!currentObject) {
    throw new Error(`Can not set path to a null path.`);
  }
  const segmentsLength = segments.length;
  for (let i=0; currentObject && i<segmentsLength - 1; i++) {
    const seg:string = segments[i];
    let child:any = currentObject[seg];
    if (child === null || child === undefined) {
      child = {};
      currentObject[seg] = child;
    }
    if (!isObject(child))
      throw new Error(`Can not set path to a non object path.`);

    currentObject = child;
  }
  if (typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "string" ||
      isObject(value)) {
    currentObject[segments[segmentsLength-1]] = value;
  } else {
    throw new Error(`Can not set path to ${value} that is not a a supported primitive.`);
  }
  return obj;
}

export const openFileDialog = (accepts: string = '*.*'): Promise<File> => {
  return new Promise<File>((resolve, reject) => {
    if (!canUseDOM) {
      reject('Unable to open dialog with no dom.');
      return;
    }
    const input:HTMLInputElement = document.createElement('input');
    input.type = 'file';
    input.accept = accepts;

    let file:File = null;
    let canceled:boolean = false;
    // HACK ALERT -
    // since there is no cancel event for dialogs we use the focus event.
    // We also give it a delay to ensure we get this event after the onchange. Generally on cancel is used for cleanup
    // so a longer time delay should be ok and reduces the risk if fires a false cancel.
    const startCancelTimer = () => {
      setTimeout(() => {
        if (file || canceled)
          return;
        canceled = true;
        resolve(null);
      }, 1000);
    }

    globalThis.addEventListener?.("focus", () => {
      startCancelTimer();
    }, { once: true, passive: true });

    input.onchange = () => {
      file = input.files[0];
      if (file) {
        if (canceled) {
          console.warn(`File open detected after faux cancel.`, file);
          return;
        }
        resolve(file);
      }
    }
    input.autofocus = true;
    input.click(); // initiate
  });
}

export const getDPI = (): number => {
  let devicePixelRatio = 1;
  if (typeof window === "object") {
    // TODO - add a listener for deviceScale change in ui
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
    // const updatePixelRatio = () => {
    //   console.log('updatePixelRation');
    // }
    // const mqString = `(resolution: ${window.devicePixelRatio}dpx)`;
    // const media = matchMedia(mqString);
    // media.addEventListener("change", updatePixelRatio);
    // removeMedia = () => {
    //   media.removeEventListener("change", updatePixelRatio);
    // };

    devicePixelRatio = window.devicePixelRatio || 1;
  }
  return devicePixelRatio;
}


export const consoleWithNoSource = (...params: any): Promise<any> => {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      Function('console.log.apply(console, arguments)').apply(null, params);
      resolve();
    });
  });
}

export const OSType = {
  Windows: 'windows',
  MacOS: 'macos',
  IOS: 'ios',
  Linux: 'linux',
  Android: 'android',
  Safari: 'safari',
  Firefox: 'firefox',
  Node: 'node',
  Unknown: 'unknown'
} as const;
export type OSType = typeof OSType[keyof typeof OSType];

export const getOS = (): OSType => {
  if (isNode()) return OSType.Node;

  const isBrowser = typeof globalThis.navigator !== 'undefined';
  const userAgent = isBrowser && globalThis.navigator.userAgent ? globalThis.navigator.userAgent.toLowerCase() : '';
  if (!userAgent) {
    return OSType.Unknown;
  }
  const windowsPlatforms = /(win32|win64|windows|wince)/i;

  if (windowsPlatforms.test(userAgent)) {
    return OSType.Windows;
  }
  /* cspell: disable-next-line */
  const macosPlatforms = /(macintosh|macintel|macppc|mac68k|macos)/i;
  if (macosPlatforms.test(userAgent)) {
    return OSType.MacOS;
  }
  const iosPlatforms = /(iphone|ipad|ipod)/i;
  if (iosPlatforms.test(userAgent)) {
    return OSType.IOS;
  }
  const androidPlatforms = /android/;
  if (androidPlatforms.test(userAgent)) {
    return OSType.Android;
  }
  const linuxPlatforms = /linux/;
  if (linuxPlatforms.test(userAgent)) {
    return OSType.Linux;
  }
  const safariPlatforms = /^((?!chrome|android|).)*safari/i;
  if (safariPlatforms.test(userAgent)) {
    return OSType.Safari;
  }
  /* cspell: disable-next-line */
  const firefoxPlatforms = /^((?!chrome|android|Seamonkey).)*firefox/i
  if (firefoxPlatforms.test(userAgent)) {
    return OSType.Firefox;
  }

  return OSType.Unknown;
}

/**
 * Returns true if the current environment is Node.js.
 */
export function isNode(): boolean {
  /** True for real Node.js, false for browser or Vite’s process shim */

  // 1️⃣  Fast path: Vite injects this during SSR or `vite-node`
  // (undefined in browser builds)
  // if (typeof import.meta !== 'undefined' && (import.meta as any).env?.SSR) {
  //   return true;
  // }

  // 2️⃣  Real Node: process.release.name === 'node'
  if (typeof process !== 'undefined' && (process.release?.name === 'node')) {
    return true;
  }

  // 3️⃣  The process/browser shim sets browser=true
  if (typeof process !== 'undefined' && (process as any).browser) {
    return false;
  }

  return false;
}

export const hasFocus = (elementSource: HTMLElement | SVGElement, ignoreDoc: boolean=false): boolean => {
  return (document.hasFocus() || ignoreDoc) && (elementSource === document.activeElement || elementSource?.contains(document.activeElement));
}

export const whenFocus = async (elementSource: HTMLElement | SVGElement, ignoreDoc: boolean=false): Promise<boolean> => {
  return new Promise<boolean>((resolve: (input: boolean) => void) => {
    if (hasFocus(elementSource, ignoreDoc)) {
      resolve(true);
    } else {
      elementSource.addEventListener('focusin', () => {
        resolve(true);
      }, { once: true});
    }
    elementSource.focus();
  });
}

/**
 * A simple stepper.
 */
export const findNextStep = (size: number, increase: boolean=true, defaultStep: number=15, min: number=10, max: number=400): number => {
  const toRound = Math.max(size - min, 0) + (increase ? 1 : -1);
  return Math.min(max, Math[increase ? 'ceil' : 'floor'](toRound / defaultStep) * defaultStep + min);
}

/**
 * Deeply freeze and entire graph.
 */
export function deepFreeze<T=any>(obj: T): T {
  Object.freeze(obj);

  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Object.isFrozen(obj[key])) {
      deepFreeze(obj[key]);
    }
  });

  return obj;
}



/**
 * Converts an object to a JSON-safe representation. This function ensures that
 * objects with custom `toJSON` or `toString` methods are properly serialized.
 * It also handles arrays and nested objects recursively.
 *
 * @param obj The object to be converted to a JSON-safe representation.
 * @returns The JSON-safe representation of the input object.
 */
export function toSafeJSON(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (typeof obj.toJSON === 'function') {
    return obj.toJSON();
  }

  if (Array.isArray(obj)) {
    return obj.map(item => toSafeJSON(item));
  }

  if (typeof obj.toString === 'function' && obj.toString !== Object.prototype.toString) {
    return obj.toString();
  }


  const result: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      result[key] = toSafeJSON(obj[key]);
    }
  }

  return result;
}