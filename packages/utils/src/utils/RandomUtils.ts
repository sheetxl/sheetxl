/** 2^26 and 2^53 — written as powers because the literals are at the edge of exact integers. */
const TWO_POW_26 = Math.pow(2, 26);
const TWO_POW_32 = Math.pow(2, 32);
const TWO_POW_53 = Math.pow(2, 53);

/** A 32-bit avalanche (murmur3's finalizer): every input bit reaches every output bit. */
const mix = (value: number): number => {
  let h = value | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85EBCA6B);
  h ^= h >>> 13;
  h = Math.imul(h, 0xC2B2AE35);
  h ^= h >>> 16;
  return h >>> 0;
};

/**
 * Creates a random source that repeats — the same seed always produces the same sequence.
 *
 * @param seed Any integer. Distinct seeds give unrelated sequences.
 *
 * @returns A function returning a number in `[0, 1)`, drop-in for `Math.random`.
 *
 * @remarks
 * Values carry the full 53 bits of a double, as `Math.random` does.
 *
 * Each value comes from the position in the sequence, so a caller reproduces its values only by
 * asking in the same order. Where the order is not fixed, key the draws instead
 * ({@link keyedRandom}).
 *
 * Not a cryptographic source — never use it for keys, tokens or identifiers.
 *
 * @example
 * ```typescript
 * const next = createSeededRandom(42);
 * next(); // 0.6011037487409305, every time
 * ```
 */
export function createSeededRandom(seed: number): () => number {
  // mulberry32, drawn twice: one 32-bit draw is a multiple of 2^-32, where `Math.random` is a
  // multiple of 2^-53, so a seeded sequence would otherwise be measurably coarser.
  let state = seed | 0;
  const next = (): number => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
  return (): number => {
    const hi = next() >>> 5; // 27 bits
    const lo = next() >>> 6; // 26 bits
    return (hi * TWO_POW_26 + lo) / TWO_POW_53;
  };
}

/**
 * A value keyed by where it is wanted rather than by when it was asked for — the same key always
 * gives the same value.
 *
 * @param seed Any integer, and the widest part — it may exceed 32 bits. Distinct seeds give
 * unrelated values for the same key.
 * @param keyA A part of the key.
 * @param keyB A part of the key.
 * @param keyC A part of the key.
 * @param keyD The narrowest part of the key, e.g. a counter within the rest.
 *
 * @returns A number in `[0, 1)`.
 *
 * @remarks
 * A sequence hands each caller the value its turn earned, so reproducing the values means
 * reproducing the order. Keying takes the order out of the answer: the same key gives the same
 * value however many other values were drawn first, on any machine.
 *
 * Values carry the full 53 bits of a double, as `Math.random` does. The parts of the key are
 * mixed, not concatenated, so any of them may be small, sparse or repeated.
 *
 * Not a cryptographic source — never use it for keys, tokens or identifiers.
 */
export function keyedRandom(
  seed: number, keyA: number, keyB: number, keyC: number, keyD: number
): number {
  let h = mix((seed | 0) ^ 0x9E3779B9); // both halves, for a seed wider than the mixer's 32 bits
  h = mix(h ^ Math.floor(seed / TWO_POW_32));
  h = mix(h ^ keyA);
  h = mix(h ^ keyB);
  h = mix(h ^ keyC);
  h = mix(h ^ keyD);
  // Two independent words, for the same 53 bits a sequence carries.
  const hi = mix(h) >>> 5; // 27 bits
  const lo = mix(h ^ 0x85EBCA6B) >>> 6; // 26 bits
  return (hi * TWO_POW_26 + lo) / TWO_POW_53;
}

/**
 * Hashes text to a 32-bit integer, for keying by a part that is not a number.
 *
 * @param text The text to hash.
 *
 * @remarks
 * Not a cryptographic hash, and not stable across releases — for keying within a run, not for
 * anything stored.
 */
export function hashText(text: string): number {
  let h = 0x811C9DC5;
  const length = text.length;
  for (let i=0; i<length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  }
  return mix(h);
}
