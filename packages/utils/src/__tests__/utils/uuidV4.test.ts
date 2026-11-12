import { describe, expect, it, vi, afterEach } from 'vitest';

import { uuidV4 } from '../../utils/CommonUtils';

/** `8-4-4-4-12` hex, version 4, variant 1. */
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidV4', () => {

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a version 4 uuid, and a different one each time', () => {
    const ids = new Set<string>();
    for (let i=0; i<1000; i++) {
      const id = uuidV4();
      expect(id).toMatch(V4);
      ids.add(id);
    }
    expect(ids.size).toEqual(1000);
  });

  it('falls back to getRandomValues where randomUUID is missing', () => {
    // An http page has `crypto` but not `randomUUID`, which is a secure-context API.
    const { getRandomValues } = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: getRandomValues.bind(globalThis.crypto) });
    const ids = new Set<string>();
    for (let i=0; i<1000; i++) {
      const id = uuidV4();
      expect(id).toMatch(V4);
      ids.add(id);
    }
    expect(ids.size).toEqual(1000);
  });

  it('still answers where there is no platform source at all', () => {
    vi.stubGlobal('crypto', undefined);
    expect(uuidV4()).toMatch(V4);
  });
});
