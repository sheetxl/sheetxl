export * from './compress.shared';

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

  const readableStream = new ReadableStream({
    start(controller) {
      controller.enqueue(arrayBuffer);
      controller.close();
    }
  });

  // TODO - validate format types
  const compressionStream = new CompressionStream(format); // "deflate" | "deflate-raw" | "gzip"
  const compressedStream = readableStream.pipeThrough(compressionStream);
  const compressedBlob = await new Response(compressedStream).blob();

  return compressedBlob.arrayBuffer(); // Return an ArrayBuffer
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

  const compressedBlob = new Blob([arrayBuffer]); // Create a Blob from the ArrayBuffer
  const compressedReadableStream = compressedBlob.stream();
  // TODO - validate format types
  const decompressionStream = new DecompressionStream(format);
  const decompressedStream = compressedReadableStream.pipeThrough(decompressionStream);
  const decompressedBlob = await new Response(decompressedStream).blob();
  return decompressedBlob.arrayBuffer(); // Return an ArrayBuffer
}
