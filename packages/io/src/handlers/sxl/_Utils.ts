
// TODO - move to utils.
// TODO - move to streaming api
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

// Function to check for common compression magic numbers
export function isLikelyCompressedByMagicNumber(arrayBuffer: ArrayBuffer | SharedArrayBuffer): string | false {
  if (arrayBuffer.byteLength < 4) { // Need at least a few bytes to check
    return false;
  }

  const view = new Uint8Array(arrayBuffer);

  // Common magic numbers (hexadecimal representation)
  const magicNumbers = {
    gzip: [0x1F, 0x8B],        // Gzip
    zip: [0x50, 0x4B, 0x03, 0x04], // ZIP (one of many ZIP signatures)
    bz2: [0x42, 0x5A, 0x68],    // Bzip2
    br: [0xCE, 0xB2, 0xCF, 0x81]     //Brotli (no standard magic number so just checking first 4 bytes of common brotli compressed data)
    // Add more magic numbers as needed
  };

  const formats = Object.keys(magicNumbers);
  for (let i=0; i<formats.length; i++) {
    const format = formats[i];
    const magic = magicNumbers[format];
    let match = true;
    for (let i = 0; i < magic.length; i++) {
      if (view[i] !== magic[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return format; // Return the format name (e.g., "gzip", "zip")
    }
  }

  return false; // Not a recognized compressed format
}

// --- Stream Version ---

export function compressStream(inputStream: ReadableStream): ReadableStream {
  const compressionStream = new CompressionStream('gzip');
  return inputStream.pipeThrough(compressionStream);
}

export function decompressStream(compressedStream: ReadableStream): ReadableStream {
  const decompressionStream = new DecompressionStream('gzip');
  return compressedStream.pipeThrough(decompressionStream);
}