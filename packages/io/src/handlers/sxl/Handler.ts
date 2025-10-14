import { IWorkbook, Workbook } from '@sheetxl/sdk';

import type { WriteJSONOptions } from './Types';
import type { WorkbookWriteHandler, WorkbookReadHandler, ReadWorkbookOptions } from '../../types';

import * as CompressUtils from '@sheetxl/io/lib/compress';

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

  function stringify(v: any, depth: number, arrayDepth: number, parentArray: boolean): string {
    // Fast path for primitives
    if (v === null || v === undefined || typeof v !== 'object') {
      return JSON.stringify(v);
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
    const keys = Object.keys(v);
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
      const key = keys[i];
      result += next + JSON.stringify(key) + ': ' + stringify(v[key], depth + 1, arrayDepth, false);
      if (i < keyCount - 1) result += ',\n';
    }
    result += '\n' + gap + '}';
    return result;
  }

  // Root has no parent, so parentIsArray = false
  return stringify(value, 0, 0, false);
}

export const writeBufferSXL: WorkbookWriteHandler = async (
  workbook: IWorkbook,
  options?: WriteJSONOptions
): Promise<ArrayBuffer> => {
  const jsonWB:IWorkbook.JSON = await workbook.toJSON();
  const whitespace:number = options?.whiteSpace ?? (typeof __DEV__ !== 'undefined' && __DEV__ ? 2 : 0);

  options?.beforeWrite?.(workbook, jsonWB);
  let strJson:string;
  if (whitespace === 0) {
    strJson = JSON.stringify(jsonWB);
  } else {
    strJson = formatJSON(jsonWB, whitespace);
  }

  let asArray:ArrayBufferLike = new TextEncoder().encode(strJson).buffer;
  const compress = options?.compress ?? (typeof __DEV__ !== 'undefined' && __DEV__ ? false : true);
  if (compress) {
    asArray = await CompressUtils.compressArrayBuffer(asArray, typeof compress === 'string' ? compress as any : undefined);
  }
  return asArray;
}

/**
 * Import for reading from a SXL array buffer into an IWorkbook.
 *
 * @param array The array buffer containing the SXL data.
 * @param options Options for reading the workbook.
 * @returns A promise that resolves to an IWorkbook instance.
 */
export const readBufferSXL: WorkbookReadHandler = async (
  array: ArrayBufferLike,
  options: ReadWorkbookOptions
): Promise<IWorkbook> => {
  let decodedArray:ArrayBufferLike = array;
  if (CompressUtils.isLikelyCompressedByMagicNumber(decodedArray)) {
    decodedArray = await CompressUtils.decompressArrayBuffer(decodedArray);
  }
  let decodedString = new TextDecoder().decode(decodedArray);
  const jsonWB:IWorkbook.JSON = JSON.parse(decodedString);

  const optionsCreateWB:IWorkbook.ConstructorOptions = {
    name: options?.name,
    ...options?.createWorkbookOptions ?? {},
    json: jsonWB,
  }

  const workbook = new Workbook(optionsCreateWB);
  return workbook;
}
