import { describe, expect, it } from 'vitest';

import { CompoundDocumentCompression } from '../handlers/xlsx/vba';

// Assuming your compression code is in a namespace/module like this:
// import { CompoundDocumentCompression } from './compression';
// Or if it's in the same file, just use CompoundDocumentCompression.

// --- Helper function to compare Uint8Arrays ---
function arraysAreEqual(a: Uint8Array | null, b: Uint8Array | null): boolean {
  if (a === null && b === null) {
    return true; // Both null are considered equal here
  }
  if (a === null || b === null) {
    return false; // One is null, the other isn't
  }
  if (a.length !== b.length) {
    console.error(`Equality check failed: Lengths differ (${a.length} vs ${b.length})`);
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      console.error(`Equality check failed: Byte difference at index ${i} (${a[i]} vs ${b[i]})`);
      return false;
    }
  }
  return true;
}

// --- Function to run a single test case ---
function runCompressionTest(testName: string, originalData: Uint8Array) {
  // console.log(`Original Size: ${originalData.length} bytes`);
  // You can add more detailed logging of original data if needed, e.g., hex representation

  let compressedData: Uint8Array | null = null;
  let decompressedData: Uint8Array | null = null;
  let success = false;

  try {
    // 1. Compress
    // console.log("Compressing...");
    compressedData = CompoundDocumentCompression.CompressPart(originalData);
    // console.log(`Compressed Size: ${compressedData.length} bytes`);
    // You can add logging of compressed data (e.g., hex) if needed for debugging

    // 2. Decompress
    // console.log("Decompressing...");
    decompressedData = CompoundDocumentCompression.DecompressPart(compressedData);

    if (decompressedData === null) {
      expect(decompressedData !== null).toBe(true); // This will fail the test

      // console.error("Decompression failed: DecompressPart returned null.");
      // This usually means the signature byte was wrong on the *compressed* data,
      // which would indicate a bug in CompressPart if the input wasn't empty.
    } else {
      // console.log(`Decompressed Size: ${decompressedData.length} bytes`);

      // 3. Verify
      // console.log("Verifying...");
      success = arraysAreEqual(originalData, decompressedData);
      // if (success) {

      // } else {
      //     console.error(`Result: ${testName} FAILED - Decompressed data does not match original.`);
      //     // Optional: Log sections of the arrays for comparison if lengths match
      //     // if (originalData.length === decompressedData.length) {
      //     //     console.log("Original (start): ", originalData.slice(0, 50));
      //     //     console.log("Decompressed (start):", decompressedData.slice(0, 50));
      //     // }
      // }
    }

  } catch (error: any) {
    console.error(`Result: ${testName} FAILED with error during processing:`, error);
    // Log intermediate states if helpful
    console.log("Original size:", originalData.length);
    if (compressedData) console.log("Compressed size:", compressedData.length);
  }
  expect(success).toBe(true); // This will fail the test if an error occurs
  // console.log(`--- Test Finished: ${testName} ---`);
}


describe("Decompression", () => {
  it("Compress basic string", async () => {
    // --- Define and Run Test Cases ---
    const textEncoder = new TextEncoder();

    // Test 1: Simple repeats to test copy tokens
    const testData1 = textEncoder.encode("AAAAABBBBBCCCCCCDDDDDDDDEEEEEEEFFFFFFFGGGGGGGHHHHHHHIIIIIIJJJJJJJKKKKKKKLLLLLLLAAAAABBBCCC");
    runCompressionTest("Simple Repeats", testData1);

    // Test 2: Pattern that should generate longer back-references
    const testData2Str = "ABCDEFABCDEFABCDEF--------GHIJKLGHIJKLGHIJKL";
    const testData2 = textEncoder.encode(testData2Str.repeat(15)); // Repeat to make it longer
    runCompressionTest("Longer Repeating Patterns", testData2);

    // Test 3: Data likely to be less compressible (mostly literals)
    const testData3 = textEncoder.encode("This is a test string with fairly unique characters 0123456789 !@#$%^&*()_+=-`~");
    runCompressionTest("Less Compressible Data", testData3);

    // Test 4: Edge Case: Empty Data
    const testData4 = new Uint8Array([]);
    runCompressionTest("Empty Data", testData4);

    // Test 5: Edge Case: Single Byte
    const testData5 = new Uint8Array([77]); // 'M'
    runCompressionTest("Single Byte", testData5);

    // Test 6: Edge Case: Two Bytes (cannot trigger copy token)
    const testData6 = new Uint8Array([77, 78]); // 'MN'
    runCompressionTest("Two Bytes", testData6);

    // Test 7: Edge Case: Minimum repeat length (3 bytes)
    const testData7 = textEncoder.encode("XYXYABCDABCDABCDZ Z Z"); // Includes "AAA" implicitly if repeating ABCD
    runCompressionTest("Minimum Repeat Trigger", testData7);

    // Test 8: All identical bytes
    const testData8 = new Uint8Array(200).fill(65); // 200 'A's
    runCompressionTest("All Identical Bytes", testData8);

    // Test 9: Data crossing the 4096 byte chunk boundary (OPTIONAL - enable if needed)
    /*
    console.log("\n--- Preparing Large Test Data (> 4096 bytes) ---");
    let largeStr = "";
    const pattern = "SomeRepeatingPattern_12345_";
    for (let i = 0; i < Math.ceil(5000 / pattern.length); i++) {
      largeStr += pattern;
    }
    const testData9 = textEncoder.encode(largeStr.slice(0, 5000)); // Create ~5000 bytes
    runCompressionTest("Data > 4096 Bytes", testData9);
    */
    expect(true).toEqual(true);
  });

});