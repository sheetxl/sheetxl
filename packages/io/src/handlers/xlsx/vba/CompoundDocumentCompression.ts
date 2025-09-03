// TODO - This doesn't work yet, but the code is here for reference.

/**
 * Decompress a VBA “compressed container” as defined in MS-OVBA §2.4.1
 *
 * * https://learn.microsoft.com/en-us/openspecs/office_file_formats/ms-ovba/7ce7fb12-f761-4d40-9561-d4db201ef5bc
 *
 * * https://github.com/chelh/VBACompressionCodec
 * * https://raw.githubusercontent.com/chelh/VBACompressionCodec/refs/heads/master/CompoundDocumentCompression.cs
 * * https://msopenspecs.microsoft.com/files/MS-OVBA/%5bMS-OVBA%5d-240521.pdf
 * * https://blog.nviso.eu/2020/02/25/evidence-of-vba-purging-found-in-malicious-documents/
 * * https://msopenspecs.microsoft.com/files/MS-OVBA/%5BMS-OVBA%5D.pdf
 *
 * The VBA compression uses a combination of RLE (Run Length Encoding) and
 * dictionary-based compression, processing data in 4096-byte chunks.
 */
export namespace CompoundDocumentCompression {
  const COMPRESSION_SIGNATURE: number = 0x01;
  const CHUNK_SIZE: number = 4096; // Standard decompressed chunk size

  interface CompressChunkResult {
    chunk: Uint8Array | null; // The compressed data for the chunk (not including header)
    newAbsoluteStartPos: number; // The position in the original buffer after this chunk
  }

  /**
   * Compresses a single chunk of data (up to 4096 bytes).
   * @param originalBuffer The entire input buffer to compress.
   * @param absoluteStartPos The starting position in originalBuffer for this chunk.
   * @returns The compressed chunk data and the new position in originalBuffer.
   */
  function compressChunk(originalBuffer: Uint8Array, absoluteStartPos: number): CompressChunkResult {
    const compressedChunkBytes: number[] = []; // Store bytes of the compressed chunk data

    let currentFlagsByteIndex = 0; // Index in compressedChunkBytes where current flag byte is/will be.
    compressedChunkBytes.push(0); // Placeholder for the first flag byte.
    let compressedWritePos = 1; // Next position to write in compressedChunkBytes.

    let originalReadPos = absoluteStartPos; // Current read position in originalBuffer for this chunk.
    // Determine the end of the current segment of originalBuffer to process (max CHUNK_SIZE bytes)
    const originalSegmentEnd = Math.min(absoluteStartPos + CHUNK_SIZE, originalBuffer.length);

    while (originalReadPos < originalSegmentEnd) {
      let tokenFlags = 0;
      const flagBytePositionInOutput = currentFlagsByteIndex;

      for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
        if (originalReadPos >= originalSegmentEnd) break; // No more data in this segment

        let bestMatchCandidateStart = -1;
        let bestMatchLength = 0;

        // Length of data decompressed/processed so far *within this current chunk*
        const decompressedBytesInThisChunkSoFar = originalReadPos - absoluteStartPos;

        if (decompressedBytesInThisChunkSoFar > 0) { // Only search if there's a dictionary
          const lenBits = getLengthBits(decompressedBytesInThisChunkSoFar);
          const maxLengthEncodable = (1 << lenBits) - 1; // Max value for (Length-3)

          // Search window starts from `absoluteStartPos` up to `originalReadPos - 1`
          for (let candidateReadPos = originalReadPos - 1; candidateReadPos >= absoluteStartPos; candidateReadPos--) {
            if (originalBuffer[candidateReadPos] === originalBuffer[originalReadPos]) {
              let currentMatchLength = 1;
              while (
                originalReadPos + currentMatchLength < originalSegmentEnd && // Stay within current segment
                candidateReadPos + currentMatchLength < originalReadPos && // Dictionary boundary
                originalBuffer[candidateReadPos + currentMatchLength] === originalBuffer[originalReadPos + currentMatchLength] &&
                currentMatchLength < maxLengthEncodable + 3 // Actual length (Length-3 is stored)
              ) {
                currentMatchLength++;
              }

              if (currentMatchLength > bestMatchLength) {
                bestMatchCandidateStart = candidateReadPos;
                bestMatchLength = currentMatchLength;
                if (bestMatchLength >= maxLengthEncodable + 3) {
                  break; // Found max possible length for this token configuration
                }
              }
            }
          }
        }

        if (bestMatchLength >= 3) { // Use a CopyToken
          tokenFlags |= (1 << bitIndex);

          const lenBits = getLengthBits(decompressedBytesInThisChunkSoFar);
          const offset = originalReadPos - bestMatchCandidateStart - 1; // Offset = current - match_start - 1
          const lengthFieldVal = bestMatchLength - 3; // Store (Length - 3)

          const tokenWord = (offset << lenBits) | lengthFieldVal;

          compressedChunkBytes[compressedWritePos++] = tokenWord & 0xFF;          // Little-endian
          compressedChunkBytes[compressedWritePos++] = (tokenWord >> 8) & 0xFF;
          originalReadPos += bestMatchLength;
        } else { // Use a LiteralToken
          compressedChunkBytes[compressedWritePos++] = originalBuffer[originalReadPos++];
        }
      }

      compressedChunkBytes[flagBytePositionInOutput] = tokenFlags;

      if (originalReadPos < originalSegmentEnd) { // More data to process, prepare for next flag byte
        currentFlagsByteIndex = compressedWritePos;
        compressedChunkBytes.push(0); // Placeholder
        compressedWritePos++;
      }
    }

    // If the compressedChunkBytes only contains the initial placeholder flag (meaning no actual tokens/literals were written)
    if (compressedWritePos === 1 && compressedChunkBytes[0] === 0) {
      return { chunk: null, newAbsoluteStartPos: originalSegmentEnd };
    }
    // Otherwise, the valid data is up to compressedWritePos
    return { chunk: Uint8Array.from(compressedChunkBytes.slice(0, compressedWritePos)), newAbsoluteStartPos: originalSegmentEnd };
  }

  /**
   * Compression using a run-length encoding algorithm.
   * See MS-OVBA Section 2.4.
   * This implementation aims to match EPPlus's behavior which primarily emits CompressedChunks.
   * @param part Byte array to compress.
   * @returns Compressed byte array.
   */
  export function CompressPart(part: Uint8Array): Uint8Array {
    const outputStreamBytes: number[] = [];
    outputStreamBytes.push(COMPRESSION_SIGNATURE);

    let currentOriginalBufferOffset = 0;

    while (currentOriginalBufferOffset < part.length) {
      const chunkResult = compressChunk(part, currentOriginalBufferOffset);
      const compressedChunkData = chunkResult.chunk; // This is the data portion of the chunk

      if (compressedChunkData && compressedChunkData.length > 0) {
        // According to EPPlus logic, it always creates a CompressedChunk if data exists.
        // Header.Length = CompressedChunkData.Length - 1
        let header = ((compressedChunkData.length - 1) & 0xFFF);
        header |= 0xB000; // Flag=1 (Compressed), Reserved bits=0b011

        outputStreamBytes.push(header & 0xFF);          // Little-endian header
        outputStreamBytes.push((header >> 8) & 0xFF);

        for (let k = 0; k < compressedChunkData.length; k++) {
          outputStreamBytes.push(compressedChunkData[k]);
        }
      }
      // If compressedChunkData is null or empty, EPPlus effectively writes nothing for this
      // "attempted" chunk, and the offset simply advances.
      // The next iteration will start from the new offset.
      currentOriginalBufferOffset = chunkResult.newAbsoluteStartPos;
    }
    return Uint8Array.from(outputStreamBytes);
  }

  /**
   * Inflate the “compressed container” that holds VBA source.
   *
   * @param part      Uint8Array that begins with 0x00 | 0x01 signature.
   * @param startPos  Byte index where the container starts (default 0).
   * @param verbose   true = log internals to console.debug
   * @returns         Inflated bytes, or null if signature invalid.
   *
   * @see
   * See MS-OVBA Section 2.4.
   */
  export function DecompressPart(part: Uint8Array, startPos: number = 0): Uint8Array | null {
    if (!part || part.length === 0) {
        return new Uint8Array(0);
    }
    if (startPos >= part.length || part[startPos] !== 1) { // Check signature byte
        console.error(`DecompressPart failed: Invalid signature byte 0x${part[startPos]?.toString(16)} at pos ${startPos} or invalid startPos.`);
        return null;
    }

    const ms_bytes: number[] = [];    // Simulates MemoryStream
    let compressPos = startPos + 1; // Skip signature byte

    while (compressPos < part.length - 1) { // Ensure at least 2 bytes remain for a potential header
        if (compressPos + 1 >= part.length) { // Double check for header read
            break;
        }
        try {
            const result = DecompressChunk(ms_bytes, part, compressPos);
            compressPos = result.newPos;
        } catch (e: any) {
            console.error(`Error during DecompressChunk at input offset ${compressPos}:`, e.message);
            return null; // Stop on error
        }
    }
    return Uint8Array.from(ms_bytes);
  }
}
// Helper function to mimic BitConverter.ToUInt16 for little-endian
function toUInt16LE(buffer: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 1 >= buffer.length) {
      throw new RangeError(`toUInt16LE: Offset ${offset} is out of bounds for buffer length ${buffer.length}. Needed 2 bytes.`);
  }
  return buffer[offset] | (buffer[offset + 1] << 8);
}

// GetLengthBits function (as provided and confirmed by user to be from EPPlus logic)
function getLengthBits(decompressedLengthInCurrentChunk: number): number {
  if (decompressedLengthInCurrentChunk <= 0) return 12;
  if (decompressedLengthInCurrentChunk <= 16) return 12;
  if (decompressedLengthInCurrentChunk <= 32) return 11;
  if (decompressedLengthInCurrentChunk <= 64) return 10;
  if (decompressedLengthInCurrentChunk <= 128) return 9;
  if (decompressedLengthInCurrentChunk <= 256) return 8;
  if (decompressedLengthInCurrentChunk <= 512) return 7;
  if (decompressedLengthInCurrentChunk <= 1024) return 6;
  if (decompressedLengthInCurrentChunk <= 2048) return 5;
  if (decompressedLengthInCurrentChunk <= 4096) return 4;
  const shiftedDecomp = (decompressedLengthInCurrentChunk - 1) >> 4;
  if (shiftedDecomp <= 0) return 12;
  return Math.max(4, 12 - (Math.trunc(Math.log2(shiftedDecomp)) + 1));
}

interface DecompressChunkReturn {
  newPos: number; // The position in compBuffer *after* this chunk has been processed
}

function DecompressChunk(
  ms_bytes: number[],         // Output array (simulates MemoryStream)
  compBuffer: Uint8Array,     // The input compressed buffer
  current_pos_in_compBuffer: number // Starting position of the chunk header in compBuffer
): DecompressChunkReturn {
  let pos = current_pos_in_compBuffer; // Current read head in compBuffer

  const header: number = toUInt16LE(compBuffer, pos);
  pos += 2; // Advance past the 2-byte header, pos now points to the start of chunk data

  let decomprPos: number = 0; // Tracks position in the current chunk's history buffer
  let historyBuffer: Uint8Array = new Uint8Array(4198); // Per-chunk history for backreferences

  // Extract header fields
  const lengthFieldInHeader = header & 0x0FFF;
  const actualDataLength = lengthFieldInHeader + 1; // Actual number of data bytes in this chunk
  const b_isCompressedFlag: number = (header & 0x8000) >>> 15;
  // const a_reservedFlag: number = (header & 0x7000) >>> 12; // Read but not used by EPPlus logic for branching

  // endOfThisChunkData is the position in compBuffer *after* the data for this chunk
  const endOfThisChunkData = pos + actualDataLength;

  if (b_isCompressedFlag === 1) { // Compressed chunk
      while (pos < endOfThisChunkData && pos < compBuffer.length) {
          const tokenFlags: number = compBuffer[pos];
          pos++;

          for (let i = 0; i < 8; i++) {
              if (pos >= endOfThisChunkData) break; // Consumed all data bytes for this chunk

              if ((tokenFlags & (1 << i)) === 0) { // Literal token
                  if (pos >= compBuffer.length) throw new Error("EOF reading literal byte.");

                  const literalByte = compBuffer[pos];
                  ms_bytes.push(literalByte);
                  historyBuffer[decomprPos] = literalByte; // No bounds check before write in C#
                  decomprPos++;
                  pos++;
              } else { // Copy token
                  if (pos + 1 >= compBuffer.length) throw new Error("EOF reading copy token word.");

                  const t: number = toUInt16LE(compBuffer, pos);
                  const bitCount: number = getLengthBits(decomprPos);
                  const bitsToShiftForOffset = (16 - bitCount);
                  const lengthMask: number = (0xFFFF) >>> bitsToShiftForOffset;
                  const offsetMask: number = (~lengthMask) & 0xFFFF;

                  const length: number = (t & lengthMask) + 3;
                  const tokenOffsetField: number = (t & offsetMask) >>> bitCount;
                  const copyOffset: number = tokenOffsetField + 1;

                  let source: number = decomprPos - copyOffset;

                  if (source < 0) {
                      throw new Error(`Invalid CopyToken offset ${copyOffset} (history size ${decomprPos}, tokenOffsetField ${tokenOffsetField}, raw token word 0x${t.toString(16)}, header 0x${header.toString(16)})`);
                  }

                  if (decomprPos + length >= historyBuffer.length) {
                      const newLargerBuffer = new Uint8Array(historyBuffer.length + 4198);
                      newLargerBuffer.set(historyBuffer.subarray(0, decomprPos));
                      historyBuffer = newLargerBuffer;
                  }

                  for (let c = 0; c < length; c++) {
                       if (source >= decomprPos) { // Check if source is valid in current history
                          throw new Error(`CopyToken source read OOB: source_idx=${source}, history_written=${decomprPos}`);
                      }
                      const byteToCopy = historyBuffer[source];
                      ms_bytes.push(byteToCopy);
                      historyBuffer[decomprPos] = byteToCopy;
                      decomprPos++;
                      source++; // Important for overlapping copies
                  }
                  pos += 2; // Advance past the 2-byte copy token word
              }
          }
      }
      // After processing a compressed chunk, 'pos' should have ideally advanced to 'endOfThisChunkData'.
      // If the chunk data was shorter than declared by its header, 'pos' might be less.
      // If malformed, 'pos' could be anywhere. For robustness, ensure 'pos' is set to where the next chunk should begin.
      return { newPos: endOfThisChunkData };

  } else { // Raw chunk (b_isCompressedFlag === 0)
      if (pos + actualDataLength > compBuffer.length) {
          throw new Error(`Raw chunk data length (${actualDataLength}) extends beyond input buffer (length ${compBuffer.length}, current pos ${pos}).`);
      }

      for (let k = 0; k < actualDataLength; k++) {
          ms_bytes.push(compBuffer[pos + k]);
      }
      pos += actualDataLength; // Advance pos by the number of data bytes consumed

      return { newPos: pos }; // pos is now at the start of the next chunk's header (or end of stream)
  }
}
