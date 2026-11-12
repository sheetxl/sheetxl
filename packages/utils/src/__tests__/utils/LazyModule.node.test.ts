import { describe, it, expect, vi } from 'vitest';

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { defineLazyModule, LazyLoadError } from '../../utils/LazyModule';

/**
 * Node-only: importing a `file:` URL with a query string needs Node's own module loader.
 */
describe('defineLazyModule (failed module fetch)', () => {
  it('imports a module again under a new URL after the browser reports its fetch failed', async () => {
    // Browsers remember a failed module fetch per URL, so calling the same `import()` again fails
    // without touching the network even once it is back.
    const dir = mkdtempSync(join(tmpdir(), 'lazy-module-'));
    const file = join(dir, 'feature.mjs');
    writeFileSync(file, 'export const value = 42;\n');
    const url = pathToFileURL(file).href;

    const loader = vi.fn(async (): Promise<{ value: number }> => {
      throw new TypeError(`Failed to fetch dynamically imported module: ${url}`);
    });
    const module = defineLazyModule('test:importAgain', loader, { retries: 0 });

    await expect(module.load()).rejects.toBeInstanceOf(LazyLoadError);
    const loaded = await module.load();
    expect(loaded.value).toBe(42);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('applies select to the module imported again', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lazy-module-'));
    const file = join(dir, 'feature.mjs');
    writeFileSync(file, 'export const value = 42;\n');
    const url = pathToFileURL(file).href;

    const module = defineLazyModule('test:importAgainSelect', async (): Promise<{ value: number }> => {
      throw new TypeError(`Failed to fetch dynamically imported module: ${url}`);
    }, { retries: 0, select: (m) => m.value });

    await expect(module.load()).rejects.toBeInstanceOf(LazyLoadError);
    expect(await module.load()).toBe(42);
  });
});
