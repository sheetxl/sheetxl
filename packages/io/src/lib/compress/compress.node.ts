export * from './compress.shared';

// --- ArrayBuffer Version ---
export async function compressArrayBuffer(inputArrayBuffer: ArrayBufferLike, format: "deflate" | "deflate-raw" | "gzip"='gzip'): Promise<ArrayBuffer> {
  // Convert SharedArrayBuffer to ArrayBuffer if needed
  let arrayBuffer: ArrayBufferLike;
  if (typeof SharedArrayBuffer !== "undefined" && inputArrayBuffer instanceof SharedArrayBuffer) {
    // Copy SharedArrayBuffer data to a new ArrayBuffer
    arrayBuffer = new ArrayBuffer(inputArrayBuffer.byteLength);
    new Uint8Array(arrayBuffer).set(new Uint8Array(inputArrayBuffer));
  } else {
    arrayBuffer = inputArrayBuffer;
  }

  const zlib = await import('zlib');
  const { promisify } = await import('util');
  const buffer = Buffer.from(arrayBuffer);

  let compressedBuffer: Buffer;
  if (format === 'gzip') {
    const gzip = promisify(zlib.gzip);
    compressedBuffer = await gzip(buffer);
  } else if (format === 'deflate') {
    const deflate = promisify(zlib.deflate);
    compressedBuffer = await deflate(buffer);
  } else if (format === 'deflate-raw') {
    const deflateRaw = promisify(zlib.deflateRaw);
    compressedBuffer = await deflateRaw(buffer);
  } else {
    throw new Error(`Unsupported compression format: ${format}`);
  }

  // Convert Buffer to ArrayBuffer
  const result = new ArrayBuffer(compressedBuffer.byteLength);
  const view = new Uint8Array(result);
  view.set(compressedBuffer);
  return result;
}

export async function decompressArrayBuffer(compressedArrayBuffer: ArrayBuffer | SharedArrayBuffer, format: "deflate" | "deflate-raw" | "gzip"='gzip'): Promise<ArrayBuffer> {
  // Convert SharedArrayBuffer to ArrayBuffer if needed
  let arrayBuffer: ArrayBuffer;
  if (typeof SharedArrayBuffer !== "undefined" && compressedArrayBuffer instanceof SharedArrayBuffer) {
    // Copy SharedArrayBuffer data to a new ArrayBuffer
    arrayBuffer = new ArrayBuffer(compressedArrayBuffer.byteLength);
    new Uint8Array(arrayBuffer).set(new Uint8Array(compressedArrayBuffer));
  } else {
    arrayBuffer = compressedArrayBuffer as ArrayBuffer;
  }

  const zlib = await import('zlib');
  const { promisify } = await import('util');
  const buffer = Buffer.from(arrayBuffer);

  let decompressedBuffer: Buffer;
  if (format === 'gzip') {
    const gunzip = promisify(zlib.gunzip);
    decompressedBuffer = await gunzip(buffer);
  } else if (format === 'deflate') {
    const inflate = promisify(zlib.inflate);
    decompressedBuffer = await inflate(buffer);
  } else if (format === 'deflate-raw') {
    const inflateRaw = promisify(zlib.inflateRaw);
    decompressedBuffer = await inflateRaw(buffer);
  } else {
    throw new Error(`Unsupported decompression format: ${format}`);
  }

  // Convert Buffer to ArrayBuffer
  const result = new ArrayBuffer(decompressedBuffer.byteLength);
  const view = new Uint8Array(result);
  view.set(decompressedBuffer);
  return result;
}