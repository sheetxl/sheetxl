import { describe, expect, it } from 'vitest';

import { createSeededRandom, keyedRandom, hashText } from '../../utils/RandomUtils';

describe('createSeededRandom', () => {
  it('repeats for the same seed', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const first = Array.from({ length: 32 }, () => a());
    const second = Array.from({ length: 32 }, () => b());
    expect(second).toEqual(first);
  });

  it('separates seeds', () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    expect(Array.from({ length: 8 }, () => b()))
      .not.toEqual(Array.from({ length: 8 }, () => a()));
  });

  it('stays in [0, 1)', () => {
    const next = createSeededRandom(7);
    for (let i=0; i<10000; i++) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('draws 53 bits, as `Math.random` does', () => {
    // A single 32-bit draw would make every value a multiple of 2^-32, and the low bits constant.
    const next = createSeededRandom(3);
    let anyLowBit = false;
    for (let i=0; i<64 && !anyLowBit; i++) {
      anyLowBit = (next() * 9007199254740992) % 4294967296 !== 0; // 2^53, 2^32
    }
    expect(anyLowBit).toBe(true);
  });
});

describe('keyedRandom', () => {
  it('repeats for the same key', () => {
    expect(keyedRandom(42, 2, 3, 4, 0)).toEqual(keyedRandom(42, 2, 3, 4, 0));
  });

  it('separates every part of the key, and the seed', () => {
    const base = keyedRandom(42, 2, 3, 4, 0);
    expect(keyedRandom(43, 2, 3, 4, 0)).not.toEqual(base);
    expect(keyedRandom(42, 3, 3, 4, 0)).not.toEqual(base);
    expect(keyedRandom(42, 2, 4, 4, 0)).not.toEqual(base);
    expect(keyedRandom(42, 2, 3, 5, 0)).not.toEqual(base);
    expect(keyedRandom(42, 2, 3, 4, 1)).not.toEqual(base);
  });

  it('separates seeds above 32 bits', () => {
    // The seed carries a whole 53-bit draw, so two of them may differ in either half.
    const high = Math.pow(2, 40);
    expect(keyedRandom(high, 0, 0, 0, 0)).not.toEqual(keyedRandom(high + 1, 0, 0, 0, 0));
    expect(keyedRandom(high, 0, 0, 0, 0)).not.toEqual(keyedRandom(high * 2, 0, 0, 0, 0));
  });

  it('spreads a run of cells over [0, 1) without repeating', () => {
    const values = new Set<number>();
    let sum = 0;
    for (let row=0; row<200; row++) {
      for (let column=0; column<50; column++) {
        const value = keyedRandom(42, 7, row, column, 0);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
        values.add(value);
        sum += value;
      }
    }
    expect(values.size).toEqual(10000);
    expect(sum / 10000).toBeGreaterThan(0.48); // a flat spread, not a corner of the range
    expect(sum / 10000).toBeLessThan(0.52);
  });
});

describe('hashText', () => {
  it('repeats, and separates', () => {
    expect(hashText('Sheet1')).toEqual(hashText('Sheet1'));
    expect(hashText('Sheet2')).not.toEqual(hashText('Sheet1'));
    expect(hashText('')).toEqual(hashText(''));
  });
});
