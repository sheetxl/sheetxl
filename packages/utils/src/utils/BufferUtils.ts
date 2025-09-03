export const DEFAULT_MIME_TYPE: string = '*/*';

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = (typeof window !== 'undefined' && typeof globalThis.atob === 'function')
    ? globalThis.atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const len: number = bytes.byteLength;
  let binaryString: string = '';
  for (let i = 0; i < len; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  if (typeof window !== 'undefined' && typeof globalThis.btoa === 'function') {
    return globalThis.btoa(binaryString);
  } else if (typeof Buffer !== 'undefined') {
    return Buffer.from(binaryString, 'binary').toString('base64');
  } else {
    throw new Error('Unsupported environment');
  }
}

/**
 * Accept a blob and returns a promise of an string.
 */
export const blobToString = (blob: Blob): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    if (blob) {
      if (typeof FileReader !== 'undefined') {
        // Browser context
        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.onerror = () => {
          reject(reader.error);
        };
        reader.readAsText(blob);
      } else if (typeof Buffer !== 'undefined') {
        // Node.js context
        const arrayBufferToString = (buffer: ArrayBuffer): string => {
          return Buffer.from(buffer).toString('utf-8');
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