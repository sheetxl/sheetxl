import { CompoundDocumentCompression } from './CompoundDocumentCompression';

// I am not able to get this code to work.

export const extractVBACode = (XLSX: any, vbaProject): void => {
  /* vbaProject.content is the ArrayBuffer/Uint8Array read from x/vbaProject.bin */
 const miniFat = XLSX.CFB.read(vbaProject.content, { type: 'buffer' });

  const paths = miniFat.FullPaths;
  for (let i=0; i<paths.length; i++) {
    const entry = miniFat.FileIndex[i];
    /* we need real streams only (type 2) that live under "Root Entry/VBA/" and are NOT
       the project‑level streams nor the "dir" stream itself
    */
    if (entry.type !== 2) continue;
    if (!paths[i].startsWith('Root Entry/VBA/')) continue;
    if (/^VBA\/(?:dir|_?PROJECT|PROJECTwm)$/i.test(entry.name)) continue;

    const raw = entry.content instanceof Uint8Array
    ? entry.content
    : new Uint8Array(entry.content);              // ArrayBuffer → Uint8Array
    console.log(entry.name, raw.slice(0, 8));
    /** quick header check – only true for module streams */
    // if (raw.length < 8 || raw[0] !== 0xCC || raw[1] !== 0x61) continue;

    /** read MODULEOFFSET / textOffset (bytes 4‑7, little‑endian) safely */
    // const textOffset = new DataView(raw.buffer, raw.byteOffset, 8)
    //                      .getUint32(4, /*littleEndian=*/true);

    try {
      const code = tryGetModuleText(raw);
      if (code === null) continue;             // not a module

  } catch (e) {
    console.warn(`[decompress] ${entry.name}: ${e.message}`);
    continue;
  }
  }
};

/**
 * Try to extract *plain VBA text* from a stream that lives under "VBA/".
 * Returns null if the stream is not a code module.
 */
function tryGetModuleText(raw: Uint8Array): string | null {
  let start = 0;                           // where the compressed data begins

  // old-style streams: 2-byte cookie 0xCC 0x61 + 2-byte reserved
  if (raw.length >= 4 && raw[0] === 0xCC && raw[1] === 0x61) {
    const textOffset = new DataView(raw.buffer, raw.byteOffset, 8)
                         .getUint32(4, true);          // bytes 4-7, little-endian
    if (textOffset >= raw.length) return null;         // corrupt header
    start = textOffset;
  }

  // sanity-check signature at the start position
  const sig = raw[start];
  if (sig !== 0x01 && sig !== 0x00) return null;       // not a compressed container

  const plainBytes = CompoundDocumentCompression.DecompressPart(raw.subarray(start));
  return new TextDecoder('windows-1252').decode(plainBytes);
}
