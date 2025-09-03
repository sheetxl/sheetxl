
export const arrayToFile = async (fileNameWithExt: string, bufferLike: ArrayBufferLike): Promise<void> => {
  // Convert SharedArrayBuffer to ArrayBuffer if needed
  let arrayBuffer: ArrayBuffer;
  if (typeof SharedArrayBuffer !== "undefined" && bufferLike instanceof SharedArrayBuffer) {
    // Copy SharedArrayBuffer data to a new ArrayBuffer
    arrayBuffer = new ArrayBuffer(bufferLike.byteLength);
    new Uint8Array(arrayBuffer).set(new Uint8Array(bufferLike));
  } else {
    arrayBuffer = bufferLike as ArrayBuffer;
  }

  const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
  downloadBlob(blob, fileNameWithExt);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}