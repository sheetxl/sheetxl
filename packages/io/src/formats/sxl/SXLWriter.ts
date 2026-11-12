import { type IWorkbook } from '@sheetxl/sdk';

import * as CompressUtils from '@sheetxl/io/lib/compress';

import { type WriteJSONOptions } from './Types';

// Deliberately not annotated as `IWorkbookIO.WriteHandler`: that would widen `options` to the base
// `WriteOptions` and hide the format's own options from callers (it stays assignable to the handler
// type, since every added member is optional).
export const writeSXL = async (
  workbook: IWorkbook,
  options?: WriteJSONOptions
): Promise<ArrayBuffer> => {
  const jsonWB:IWorkbook.JSON = await workbook.toJSON();
  // Defaults are the compact ones; the registered formats supply their own (see `sxl/Plugin.ts`),
  // and they no longer vary by build — dev and prod produce identical bytes.
  const whitespace:number = options?.whiteSpace ?? 0;

  options?.beforeWrite?.(workbook, jsonWB);
  let strJson:string;
  if (whitespace === 0) {
    strJson = JSON.stringify(jsonWB);
  } else {
    strJson = formatJSON(jsonWB, whitespace);
  }

  let asArray:ArrayBufferLike = new TextEncoder().encode(strJson).buffer;
  const compress = options?.compress ?? true;
  if (compress) {
    asArray = await CompressUtils.compressArrayBuffer(asArray, typeof compress === 'string' ? compress as any : undefined);
  }
  return asArray;
}

/**
 * Pretty-prints JSON so that:
 * - Arrays whose parent is not an array use normal indentation
 * - Arrays whose parent is an array are compact: [1,2,3]
 *
 * Optimized for performance with direct loops instead of array methods.
 */
function formatJSON(value: any, indent: number=2): string {
  // Pre-allocate pad strings to avoid repeated concatenations
  const padStrings: string[] = [];
  function getPad(depth: number): string {
    const padIndex = indent * depth;
    if (padStrings[padIndex] === undefined) {
      padStrings[padIndex] = ' '.repeat(padIndex);
    }
    return padStrings[padIndex];
  }

  /**
   * Returns JSON SOURCE TEXT for `v` - a fragment of the document being written, never a value.
   * `'null'` below is therefore the 4-character JSON literal `null`, exactly as
   * `JSON.stringify(null)` produces it; the string "null" would be `'"null"'`, quotes included,
   * and stays a string through `JSON.parse`. Nothing on the read side has to know about this.
   */
  function stringify(v: any, depth: number, arrayDepth: number, parentArray: boolean): string {
    // Fast path for primitives
    if (v === null || v === undefined || typeof v !== 'object') {
      const asJson = JSON.stringify(v);
      // `JSON.stringify` returns the VALUE `undefined` - not text - for `undefined`, a function
      // or a symbol, and concatenating that emitted the word `undefined` into the document, which
      // is not JSON and makes the whole file unparseable.
      //
      // `null` is what belongs there, and only ever in an ARRAY: `JSON.stringify([1, undefined])`
      // is `[1,null]`, because dropping the position would renumber every element after it. An
      // object key is dropped instead - `{a: 1, b: undefined}` is `{"a":1}` - and that happens in
      // the caller below, so this line is never reached for one.
      return asJson === undefined ? 'null' : asJson;
    }

    const gap = getPad(depth);
    const next = getPad(depth + 1);

    // ---------- arrays ----------
    if (Array.isArray(v)) {
      const length = v.length;
      if (length === 0) return '[]';
      const pretty = arrayDepth === 0; // If nested array then compact form
      if (!pretty) return JSON.stringify(v); // Compact form for nested arrays

      // Pretty-printed form for top-level arrays
      let result = '[\n';
      for (let i=0; i<length; i++) {
        result += next + stringify(v[i], depth + 1, arrayDepth + 1, true);
        if (i < length - 1) result += ',\n';
      }
      result += '\n' + gap + ']';
      return result;
    }

    // ---------- objects ----------
    // A key whose value cannot be represented is DROPPED, as `JSON.stringify` drops it - writing
    // `"key": null` instead would turn "this property is absent" into "this property is null",
    // which several of the model's readers treat as different things. Filtered before the count so
    // the comma placement below stays right.
    const allKeys = Object.keys(v);
    const keys: string[] = [];
    const values: any[] = [];
    for (let i=0; i<allKeys.length; i++) {
      const value = v[allKeys[i]];
      if (value === undefined || typeof value === 'function' || typeof value === 'symbol') continue;
      keys.push(allKeys[i]);
      values.push(value); // held, not re-read: a property may be a lazy getter
    }
    const keyCount = keys.length;
    if (keyCount === 0) return '{}';
    const pretty = arrayDepth < 2; // If nested array then compact form
    if (!pretty) return JSON.stringify(v); // Compact form for objects in nested arrays

    // Pretty-printed form for objects
    let result = '{\n';
    if (!parentArray) {
      arrayDepth = 0; // Reset array depth for top-level objects
    }
    for (let i=0; i<keyCount; i++) {
      result += next + JSON.stringify(keys[i]) + ': ' + stringify(values[i], depth + 1, arrayDepth, false);
      if (i < keyCount - 1) result += ',\n';
    }
    result += '\n' + gap + '}';
    return result;
  }

  // Root has no parent, so parentIsArray = false
  return stringify(value, 0, 0, false);
}