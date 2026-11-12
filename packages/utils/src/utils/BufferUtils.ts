export const DEFAULT_MIME_TYPE: string = '*/*';
export const APP_MIME_TYPE: string = 'application/octet-stream';

/**
 * `Buffer` is a Node-only global. Access it via `globalThis` so this framework-free base
 * package needs no `@types/node`. The browser path is always tried first at runtime.
 */
const NodeBuffer = (globalThis as any).Buffer as
  | {
      from(data: any, encoding?: string): { toString(encoding?: string): string };
      isBuffer(value: unknown): boolean;
    }
  | undefined;

/**
 * True when `value` is a node `Buffer` (always false off node). A `Buffer` is also a `Uint8Array`,
 * so callers that already accept typed arrays do not need this - it is for telling the two apart.
 */
export const isNodeBuffer = (value: unknown): boolean => NodeBuffer?.isBuffer(value) ?? false;

/**
 * Whether a `SharedArrayBuffer` can be allocated here: the global exists and, where a page must be
 * cross-origin isolated to have it, it is.
 *
 * @remarks
 * A capability, not the runtime, so it is decided once at load rather than by a conditional
 * export: the same browser bundle serves isolated pages, which have it, and pages that do not.
 */
export const isSharedArrayBufferSupported: boolean = typeof SharedArrayBuffer === 'function'
  && ((globalThis as any).crossOriginIsolated === undefined || (globalThis as any).crossOriginIsolated === true);

/**
 * Whether multi-byte values are stored low byte first. Every mainstream engine is; big-endian
 * Node builds exist, so code that overlays views of different widths on one buffer asks.
 */
export const isLittleEndian: boolean = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

/**
 * `FileReader` is a browser-only global. Access it via `globalThis` so this framework-free base
 * package needs no `dom` lib; the Node path (`Blob.arrayBuffer()`) is used when it is absent.
 */
const NodeFileReader = (globalThis as any).FileReader as
  | (new () => { onload: () => void; onerror: () => void; result: unknown; error: unknown; readAsText(blob: BlobLike): void })
  | undefined;

/** Minimal structural subset of the DOM `Blob` we depend on (so this base lib needs no `dom` lib). */
type BlobLike = { arrayBuffer(): Promise<ArrayBuffer> };

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = (typeof globalThis.atob === 'function')
    ? globalThis.atob(base64)
    : NodeBuffer!.from(base64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i=0; i<len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const len: number = bytes.byteLength;
  let binaryString: string = '';
  for (let i=0; i<len; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(binaryString);
  } else if (NodeBuffer) {
    return NodeBuffer.from(binaryString, 'binary').toString('base64');
  } else {
    throw new Error('Unsupported environment');
  }
}

/**
 * Accept a blob and returns a promise of an string.
 */
export const blobToString = (blob: BlobLike): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    if (blob) {
      if (NodeFileReader) {
        // Browser context
        const reader = new NodeFileReader();
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.onerror = () => {
          reject(reader.error);
        };
        reader.readAsText(blob);
      } else if (NodeBuffer) {
        // Node.js context
        const arrayBufferToString = (buffer: ArrayBuffer): string => {
          return NodeBuffer!.from(buffer).toString('utf-8');
        };
        const arrayBuffer = blob.arrayBuffer();
        arrayBuffer.then(buffer => {
          resolve(arrayBufferToString(buffer));
        }).catch(error => {
          reject(error);
        });
      } else {
        reject(new Error('Unsupported environment'));
      }
    } else {
      resolve('');
    }
  });
};

/**
 * Copied from https://github.com/epoberezkin/fast-json-stable-stringify/tree/master
 * MIT License. https://github.com/epoberezkin/fast-json-stable-stringify/tree/master?tab=License-1-ov-file
 */
export function JSONStableStringify(data: any, opts?: any): string | undefined {
  if (!opts) opts = {};
  if (typeof opts === 'function') opts = { cmp: opts };
  let cycles = (typeof opts.cycles === 'boolean') ? opts.cycles : false;

  const cmp = opts.cmp && (function (f) {
    return function (node: any) {
      return function (a: string, b: string): number {
        const aObj = { key: a, value: node[a] };
        const bObj = { key: b, value: node[b] };
        return f(aObj, bObj);
      };
    };
  })(opts.cmp);

  let seen: any[] = [];
  return (function stringify (node: any): string | undefined {
    if (node && node.toJSON && typeof node.toJSON === 'function') {
      node = node.toJSON();
    }

    if (node === undefined) return;
    if (typeof node == 'number') return isFinite(node) ? '' + node : 'null';
    if (typeof node !== 'object') return JSON.stringify(node);

    let out:string;
    if (Array.isArray(node)) {
      out = '[';
      for (let i=0; i<node.length; i++) {
        if (i) out += ',';
        out += stringify(node[i]) || 'null';
      }
      return out + ']';
    }

    if (node === null) return 'null';

    if (seen.indexOf(node) !== -1) {
      if (cycles) return JSON.stringify('__cycle__');
      throw new TypeError('Converting circular structure to JSON');
    }

    const seenIndex = seen.push(node) - 1;
    const keys = Object.keys(node).sort(cmp && cmp(node));
    out = '';
    for (let i=0; i<keys.length; i++) {
      const key = keys[i];
      const value = stringify(node[key]);

      if (!value) continue;
      if (out) out += ',';
      out += JSON.stringify(key) + ':' + value;
    }
    seen.splice(seenIndex, 1);
    return '{' + out + '}';
  })(data);
};