import { type Rectangle, type Bounds } from '../types';

import { deepEqual } from './DeepEqual';
import deepMerge from './DeepMerge';

export { deepEqual };
export { deepMerge };

export const EmptyArray: any = Object.freeze([]);
export const EmptyObject: any = Object.freeze({});
export const DonePromise = Promise.resolve();

const DefaultValueGetter = <T>(v: T): number => v as number;

/**
 * Validates the value is in the object keys.
 *
 * @param enumType An enum or object with keys
 * @param value A value that must match one of the keys
 */
export function validEnumValue<T=any>(enumType: any/*typeof T*/, value: T): void {
  if (!Object.values(enumType).includes(value)) {
    throw new Error(`Invalid type: ${value ?? 'null'}. Must be one of: ${Object.values(enumType).join(', ')}.`);
  }
}

/**
 * Converts a camelCase string to a human-readable format with spaces between words.
 *
 * @param strInput The camelCase string to convert. A nullish/empty value returns an empty string.
 * @returns The string converted to pretty case, with spaces between words and the first letter capitalized.
 *
 * @example
 * ```ts
 * camelToPrettyCase('camelCaseString'); // Returns "Camel Case String"
 * camelToPrettyCase('OSVersion'); // Returns "OS Version" — an acronym stays one word
 * ```
 */
export function camelToPrettyCase(strInput: string | null | undefined): string {
  if (!strInput) {
    return '';
  }
  return strInput
  // a word starts at a capital that follows a lowercase letter or a digit
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  // and at the last capital of a run, when a lowercase letter follows it (`OSVersion`)
  .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  // uppercase the first character
  .replace(/^./, (str) => str.toUpperCase());
}

export function textToKey(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, ``).toLowerCase();
}

/** `00` … `ff`, so formatting the bytes is a lookup rather than a pad-and-concat. */
const _hex: string[] = Array.from({ length: 256 }, (_v, i) => (i + 0x100).toString(16).slice(1));

/**
 * Returns a version 4 UUID.
 *
 * @remarks
 * Uniqueness is the whole of what an id is for, so this draws from the platform's random source
 * and falls back to `Math.random` only where there is none. `Math.random` may be seeded, and two
 * tabs or workers seeded alike would mint the same ids.
 */
export function uuidV4(): string {
  const source: Crypto | undefined = globalThis.crypto;
  if (source?.randomUUID) return source.randomUUID(); // secure contexts, and node 19+
  if (source?.getRandomValues) {
    const bytes: Uint8Array = source.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0F) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3F) | 0x80; // variant 1
    return (
      _hex[bytes[0]] + _hex[bytes[1]] + _hex[bytes[2]] + _hex[bytes[3]] + '-' +
      _hex[bytes[4]] + _hex[bytes[5]] + '-' +
      _hex[bytes[6]] + _hex[bytes[7]] + '-' +
      _hex[bytes[8]] + _hex[bytes[9]] + '-' +
      _hex[bytes[10]] + _hex[bytes[11]] + _hex[bytes[12]] + _hex[bytes[13]] + _hex[bytes[14]] + _hex[bytes[15]]
    );
  }
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
export function asNumber(value: any): number {
  const parsedValue = parseAsNumber(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

/**
 * Converts a value to a number.
 * @param value
 * @returns As a number it may be `Number.NaN`.
 */
function parseAsNumber(value: any): number {
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
export function isNumeric(value: any): boolean  {
  /* inline parseAsNumber for performance */
  const num:number = value * 1;//parseAsNumber(n);
  return Number.isFinite(num) && typeof num === 'number';// && !Number.isNaN(num) ;
}

/**
 * Describes the parts of floating point number.
 */
export interface SplitNumber {
  /**
   * The integer part, signed.
   */
  ip: number;
  /**
   * The fractional digits as an integer, trailing zeros stripped (`0.05` → `fp: 5`).
   * Always `< 10^fpLength`.
   */
  fp: number;
  /**
   * The number of digits for the integer part (`0` when the integer part is `0`).
   */
  ipLength: number;
  /**
   * The number of printed fraction digits, including leading zeros (`0.05` → `fpLength: 2`).
   */
  fpLength: number;
}

/* Exact powers of ten; 1e16 is the largest needed (MAX_SAFE_INTEGER has 16 digits). */
const POW10 = [1, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13, 1e14, 1e15, 1e16];

/**
 * Splits a number into the integer and fractional parts plus the printed length of each,
 * following Excel's display model: 15 significant digits shared between the two parts
 * (the formula-bar conversion, e.g. `PI()` → `3.14159265358979`), trailing zeros stripped,
 * and rounding carried into the integer part. Rounding at the 15th significant digit is
 * also what absorbs binary float noise (`0.1 + 0.2` → `0.3`). Number-only (no string
 * round-trip) to stay fast on the render/measure path.
 *
 * Intended for UI layout decisions (autofit measure, width fitting) — display text itself
 * comes from the number format engine. Two documented deviations from an exact
 * `toPrecision(15)` round-trip, both irrelevant at display width:
 * - The fraction is capped at 15 printed digits so `fp` stays a safe integer, so values
 *   below `0.1` spend budget on leading zeros and round away their last significant
 *   digits. General renders those magnitudes in scientific notation anyway.
 * - Within half a float ulp of a decimal rounding tie the last digit can go the other way.
 */
export function splitNumber(value: number): SplitNumber | null {
  const absValue = Math.abs(value);
  if (!Number.isFinite(absValue))
    return null;

  /*
   * Note - `| 0` is faster but coerces through int32, which wraps above 2^31 and collapses to
   * `0` at ~1e26 — magnitudes a spreadsheet holds routinely. That made both `ipLength` and the
   * fractional part garbage for large values.
   */
  let ip = Math.trunc(absValue);
  const fpOriginal = absValue - ip; // exact: the low bits of absValue

  let ipLength: number;
  if (ip > Number.MAX_SAFE_INTEGER) {
    /*
     * `ip + 1` stops distinguishing digits past the safe-integer range (`1e26 + 1 === 1e26`),
     * so beyond it the digit count comes from the decimal exponent instead.
     */
    ipLength = Number(ip.toExponential().split('e')[1]) + 1;
  } else {
    ipLength = Math.ceil(Math.log10(ip + 1));
    /*
     * From 1e15 up, `+ 1` is below half a ulp of the log, so `log10(1e15 + 1)` rounds down to
     * exactly 15 and `ceil` misses the 16th digit at exact powers of ten.
     */
    if (POW10[ipLength] <= ip) ipLength++;
  }

  let fp = 0;
  let fpLength = 0;
  const budget = 15 - ipLength; // significant digits left for the fraction
  if (fpOriginal > 0 && budget > 0) {
    const fpMultiple = POW10[budget];
    fp = Math.round(fpOriginal * fpMultiple);
    if (fp === fpMultiple) {
      /* the fraction rounded up to 1.0 (e.g. 16 nines) — carry into the integer part */
      ip++;
      fp = 0;
      if (ip >= POW10[ipLength]) ipLength++;
    } else if (fp > 0) {
      fpLength = budget;
      while (fp % 10 === 0) {
        fp /= 10;
        fpLength--;
      }
    }
  }

  return {
    ip: value < 0 ? -ip : ip,
    fp: fp,
    ipLength: ipLength,
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
export function roundAccurately(number: number | null, decimalPlaces: number = 0): number | null {
  if (number == null || !isFinite(number)) return null;

  // Use scientific notation for more accurate rounding
  const factor = 10 ** decimalPlaces;
  return Number(Math.round(number * factor) / factor);
}

/**
 * Clones an object or array.
 *
 * @param value The value to clone.
 * @returns The cloned value.
 *
 * @remarks
 *
 * This is a simple JSON serialization/deserialization to create a deep copy of the object or array.
 */
export function cloneObject(value: any): any {
  if (isNullOrUndefined(value)) return value;
  // return structuredClone(value);
  // return structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  // This seems to be faster then structured clone
  return JSON.parse(JSON.stringify(value));
}

const DefaultEquals = <T>(a: T, b: T): boolean => a === b;

/**
 * Checks whether two arrays are equal in terms of length and element values.
 *
 * The function compares the arrays for strict equality (`===`) for each element.
 * It first checks if the arrays reference the same object and returns `true` in that case.
 * If not, it ensures both arguments are arrays of the same length, and then compares their elements.
 *
 * @param a The first array to compare.
 * @param b The second array to compare.
 * @param isEqual Function to compare two elements of type `T`. Defaults to strict equality.
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
export function isEqualArrays<T=any>(
  a: readonly T[],
  b: readonly T[],
  isEqual?: (a: T, b: T) => boolean
): boolean {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  if (!isEqual) {
    isEqual = DefaultEquals;
  }
  const aLength = a.length;
  for (let i=0; i<aLength; i++) {
    const aI = a[i];
    const bI = b[i];
    if (!isEqual(aI, bI)) return false;
  }
  return true;
  // TODO remove
  // return a.every((val, index): boolean => {
  //   return equals(val, b[index]);
  // });
}

// /**
//  * This just looks at the key at the top level. It does not compare
//  * actual instances or traverse.
//  *
//  * @param a The first object.
//  * @param b The second object.
//  */
// export function isEqualObjectKeys<T=any>(a: T, b: T): boolean {
//   if (a === b) return true;
//   if ((a && !b) || (b && !a)) return false;
//   const keysA = Object.keys(a);
//   const keysALength = keysA.length;
//   if (keysALength !== Object.keys(b).length) return false;
//   for (let k=0; k<keysALength; k++) {
//     const keyA = keysA[k];
//     if (a[keyA] !== b[keyA])
//       return false;
//   }
//   return true;
// }

/**
 * Check if two bounds are equal.
 *
 * @param a The first bounds.
 * @param b The second bounds.
 */
// TODO - move to GeomUtils? - Only used by DrawingUI
export function isEqualBounds(
  a: Readonly<Bounds> | undefined,
  b: Readonly<Bounds> | undefined
): boolean {
  if (a === b) return true;
  // equivalent to the pairwise check: a === b above already handled both-undefined
  if (!a || !b) return false;

  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height
  );
};

/**
 * Checks if the given value is an object.
 *
 * @param obj The value to check.
 * @returns True if the value is an object, false otherwise.
 */
export function isObject<T=any>(obj: T): boolean {
  // TODO - make fast falsy check
  return (typeof obj === 'object' && !Array.isArray(obj) && obj !== null);
  // return obj !== undefined && obj !== null && obj.constructor == Object;
}

/**
 * Removes empty properties from an object.
 *
 * @param obj The object to clean.
 * @returns The cleaned object with empty properties removed.
 */
export function removeEmptyProperties<T=any>(obj: T): T | null {
  if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) return obj;
  const asAny = obj as any;
  Object.keys(asAny).forEach(function (key) {
    if (asAny[key] && typeof asAny[key] === "object")
      removeEmptyProperties(asAny[key]);
    //recursive for objects
    else if (asAny[key] === null || asAny[key] === undefined) delete asAny[key]; //remove empty properties
    if (typeof asAny[key] === "object" && Object.keys(asAny[key]).length === 0)
      delete asAny[key]; //remove empty objects
  });

  // if the user passed in null or remove all keys then we return null.
  if ( Object.keys(obj).length === 0)
    return null;
  return obj;
}

/**
 * Simple function that calls all 0 arg functions in array.
 *
 * @param callbacks The callbacks to call.
 * @returns An Empty Array
 */
// TODO - rename to invokeCallbacks (take a default argument?)
export function removeListenerAll(callbacks: [(arg?: any) => void], defaultArg?: any): [] {
  if (!callbacks) return EmptyArray;
  const callbacksLength = callbacks.length;
  for (let i=0; i<callbacksLength; i++) {
    const callback = callbacks[i];
    if (!callback) continue;
    callback(defaultArg);
  }
  return EmptyArray;
}

/**
 * Transposes a 2D matrix (array of arrays).
 *
 * @param matrix The 2D array to transpose.
 * @returns The transposed 2D array.
 *
 * @remarks
 * This function assumes that the input matrix is well-formed,
 * meaning that it has at least 1 element and all inner arrays
 * have the same length.
 */
export function transpose(matrix: number[][]): number[][] {
  if (!matrix) return matrix;
  const rows = matrix.length,
  cols = matrix[0].length;
  const transposed = [];
  for (let j=0; j<cols; j++) {
    transposed[j] = Array(rows);
  }
  for (let i=0; i<rows; i++) {
    const matrixI = matrix[i];
    for (let j=0; j<cols; j++) {
      transposed[j][i] = matrixI[j];
    }
  }
  return transposed;
}

/**
 * Used by removeEqualValues
 *
 * @returns
 * @internal
 */
// const equalityCompare = (update: any, updateFrom: any) => update === updateFrom;
const DefaultEqualityCompare = (update: any, original: any): boolean => {
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
export function removeEqualValues(
  update: any,
  original: any,
  isEqual: (update: any, original: any) => boolean = DefaultEqualityCompare
): any {
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
 * Removes from update any values that are identical in a LAYERED original.
 *
 * The layers are ordered nearest-first: for each leaf the first layer that defines it (`undefined`
 * is 'not defined', `null` is a value) is the one it is compared against. This is
 * {@link removeEqualValues} against the deep merge of the layers, without materializing that merge —
 * which matters when the layers hold resolved model objects rather than plain json.
 *
 * @param update The object to update.
 * @param layers The original values to compare against, nearest layer first. Nullish layers are ignored.
 * @param isEqual A function to compare values for equality. Defaults to strict equality.
 *
 * @returns `true` when nothing of `update` survived.
 *
 * @remarks
 * This mutates the update object.
 */
export function removeEqualValuesLayered(
  update: any,
  layers: readonly any[],
  isEqual: (update: any, original: any) => boolean = DefaultEqualityCompare
): boolean {
  if (update === null || update === undefined) return true;
  if (!(update && typeof update === 'object' && !Array.isArray(update) && !update.isImmutable?.())) {
    let defined = false;
    let original: any;
    for (let l=0; !defined && l<layers.length; l++) {
      if (layers[l] === undefined) continue;
      defined = true;
      original = layers[l];
    }
    // No layer defines it: it can't be shown to be a default, so it stays.
    return defined && (update === original || isEqual(update, original));
  }
  const keys = Object.keys(update);
  const keysLength = keys.length;
  if (keysLength === 0) return true;
  const layersLength = layers.length;
  let hasDelete = false;
  for (let k=0; k<keysLength; k++) {
    const key = keys[k];
    // Measured: a fresh short-lived array per key beats recycling one across the loop.
    const childLayers: any[] = [];
    for (let l=0; l<layersLength; l++) {
      const layer = layers[l];
      const value = (layer !== null && layer !== undefined) ? layer[key] : undefined;
      if (value !== undefined)
        childLayers.push(value);
    }
    if (removeEqualValuesLayered(update[key], childLayers, isEqual)) {
      hasDelete = true;
      delete update[key];
    }
  }

  return hasDelete && Object.keys(update).length === 0;
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
export function mergeContentful(...args: any[]): any {
  const argsLength = args.length;
  if (argsLength > 0 && args[argsLength - 1] !== undefined && !isObject(args[argsLength - 1])) {
    return args[argsLength - 1];
  }

  let retValue = args[0] || {};
  for (let i=1; i<argsLength; i++) {
    retValue = deepMerge(retValue, args[i] || {}, {
      arrayMerge: (_destinationArray: any, sourceArray: any[]) => {
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
export function diffValues(
  check: Object,
  template: Object
): Object | null {
  const diffs: any = {};
  const keys = Object.keys(template);
  const keysLength = keys.length;
  for (let k=0; k<keysLength; k++) {
    const key = keys[k];
    const checkValue = (check as any)[key];
    const templateValue = (template as any)[key];
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
export function findEqualOrGreater<T=any>(
  arr: readonly T[],
  x: number,
  f: ((v: T) => number)=DefaultValueGetter
): number {
  let start=0;
  let end=arr.length-1;
  // Iterate while start not meets end
  while (start<=end) {
    // Find the mid index
    const mid=Math.floor((start + end)/2);
    const v = f(arr[mid]);
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
export function findEqualOrLesser<T=any>(
  arr: readonly T[],
  x: number,
  f: ((v: T) => number)=DefaultValueGetter
): number {
  let start=arr.length-1;
  let end=0;
  // Iterate while start not meets end
  while (start>=end) {
    // Find the mid index
    const mid=Math.floor((start + end)/2);
    const v = f(arr[mid]);
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
 *
 * @param array The array
 * @param from The index of the item to move
 * @param to The index to move the item to
 */
export function arrayMove<T>(
  array: T[],
  from: number,
  to: number
): T[] {
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
 * Converts a value to string.
 *
 * @param value The value to cast.
 * @returns `undefined` if value was null or void.
 */
export function castToString(value: any): string | undefined {
  if (value === null || value === undefined || value === void 0) return "";
  return typeof value !== "string" ? "" + value : value;
}

/**
 * Checks if a value is null or undefined.
 *
 * @param value The value to check.
 * @returns True if the value is null or undefined, false otherwise.
 */
export function isNullOrUndefined<T=any>(value: T): boolean {
  return value === undefined || value === null;
}

/**
 * Checks if a value is defined (not null or undefined).
 *
 * @param value The value to check.
 * @returns True if the value is defined, false otherwise.
 */
export function isDefined<T=any>(value: T): boolean {
  /* inlined - isNullOrUndefined */
  return !(value === undefined || value === null);
}

/**
 * Returns `true` if `undefined` or `null` or `''`.
 *
 * @param value The value to check.
 */
export function isEmpty<T=any>(value: T): boolean {
  return value === undefined || value === null || value === "";
}

/**
 * Checks if the value is a Promise-like object.
 *
 * @param obj The object to check.
 * @returns True if the object is Promise-like, false otherwise.
 */
export function isPromiseLike<T=any>(obj: T | Promise<T>): boolean {
  return !!obj && typeof (obj as Promise<T>).then === 'function';
}

/**
 * Check if rectangles intersect.
 *
 * @param a The first rectangle.
 * @param b The second rectangle.
 * @return True if the rectangles intersect, false otherwise.
 */
export function isRectIntersect(a: Rectangle, b: Rectangle): boolean {
  return !(
    b.left > a.right ||
    b.right < a.left ||
    b.top > a.bottom ||
    b.bottom < a.top
  );
}

/**
 * Check if rect is inside another rect.
 *
 * @param needle Inside `Rectangle`
 * @param haystack Outside `Rectangle`
 * @return True if the needle is inside the haystack, false otherwise.
 */
export function isRectInsideRect(needle: Rectangle, haystack: Rectangle): boolean {
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
 * @param rectOuter The outer rectangle.
 * @param rectInner The inner rectangle.
 * @param vertical Subtract vertical before horizontal. Default Value `false`.
 * @return An array of rectangles representing the remaining parts of the outer rectangle after subtracting the inner rectangle.
 *
 * @remarks
 * This assumes both valid (bottom > top, right > left) and non zero rects
 */
export function subtractRect(
  rectOuter: Rectangle,
  rectInner: Rectangle,
  vertical: boolean=false
): Rectangle[] {
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

/**
 * Gets a value from an object based on a dot separated path.
 *
 * @param obj The object to get the value from.
 * @param path The dot separated path.
 * @returns The value at the specified path or `null` if not found.
 */
export function getFromPath(
  obj: Record<string, any>,
  path: string
): Record<string, any> | null {
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

/**
 * Sets a value in an object based on a dot separated path.
 *
 * @param obj The object to set the value in.
 * @param path The dot separated path.
 * @param value The value to set.
 * @returns The updated object.
 */
export function setToPath(
  obj: Record<string, any>,
  path: string,
  value: Record<string, any>
): Record<string, any> {
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

export function consoleWithNoSource(...params: any): Promise<any> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      Function('console.log.apply(console, arguments)').apply(null, params);
      resolve();
    });
  });
}

/**
 * Operating System Types
 */
export const OSType = {
  /** Microsoft Windows */
  Windows: 'windows',
  /** macOS */
  MacOS: 'macos',
  /** iOS */
  IOS: 'ios',
  /** Linux */
  Linux: 'linux',
  /** Android */
  Android: 'android',
  /** Safari */
  Safari: 'safari',
  /** Firefox */
  Firefox: 'firefox',
  /** Unknown */
  Unknown: 'unknown'
} as const;
export type OSType = typeof OSType[keyof typeof OSType];

/**
 * Gets the client platform (operating system / browser engine).
 *
 * @returns The platform type.
 *
 * @remarks
 * Uses user agent sniffing and is only meaningful in a browser-like environment;
 * it intentionally does not report the JavaScript runtime (node vs browser) - that
 * is resolved via conditional exports, not runtime detection. Returns
 * {@link OSType.Unknown} when no user agent is available (e.g. node).
 */
export function getPlatform(): OSType {
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
 * Deeply freeze and entire graph.
 */
export function deepFreeze<T=any>(obj: T): T {
  Object.freeze(obj);

  const asAny = obj as any;
  Object.keys(asAny).forEach(key => {
    if (typeof asAny[key] === 'object' && asAny[key] !== null && !Object.isFrozen(asAny[key])) {
      deepFreeze(asAny[key]);
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