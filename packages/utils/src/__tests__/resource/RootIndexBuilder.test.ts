import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildRootIndex, writeRootIndex, rootIndexFromPaths, walkResourceFiles, CONTENTS_FILE
} from '../../resource/lib/builder.node';

/**
 * The root listing is a `readdir` of the whole root: every file and folder present, no more and no
 * less — the per-package `contents.json` files included (they are files the root contains), itself
 * excluded (a listing does not list itself).
 */
describe('root contents.json builder', () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sheetxl-root-index-'));
    const write = (rel: string, value: unknown): void => {
      const file = path.join(root, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(value));
    };
    write('locales/@acme/pkg/contents.json', { kind: 'locales', package: '@acme/pkg', entries: [] });
    write('locales/@acme/pkg/de/ui.msg.json', { hello: 'hallo' });
    write('locales/sheetxl/en/ui.msg.json', { hello: 'hello' });
  });

  afterAll(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it('lists every file present — nested listings included — and every folder', async () => {
    const index = await buildRootIndex(root);
    expect(index.entries.map((e) => e.path)).toEqual([
      'locales/@acme/pkg/contents.json',
      'locales/@acme/pkg/de/ui.msg.json',
      'locales/sheetxl/en/ui.msg.json'
    ]);
    expect(index.folders).toEqual([
      'locales',
      'locales/@acme',
      'locales/@acme/pkg',
      'locales/@acme/pkg/de',
      'locales/sheetxl',
      'locales/sheetxl/en'
    ]);
  });

  it('writes itself out but never lists itself, and regenerates byte-identical', async () => {
    await writeRootIndex(root);
    const first = fs.readFileSync(path.join(root, CONTENTS_FILE), 'utf8');
    expect(JSON.parse(first).entries.map((e: { path: string }) => e.path))
      .not.toContain(CONTENTS_FILE);

    // Regenerating over a root that already carries its listing must not see (or list) that listing.
    await writeRootIndex(root);
    expect(fs.readFileSync(path.join(root, CONTENTS_FILE), 'utf8')).toBe(first);
  });

  it('stays in parity with the directory it describes', async () => {
    // The permanent form of the listing/disk parity check: entries === an actual recursive walk.
    const index = await buildRootIndex(root);
    const onDisk = (await walkResourceFiles(root)).filter((f) => f !== CONTENTS_FILE).sort();
    expect(index.entries.map((e) => e.path)).toEqual(onDisk);
  });

  it('derives folders from bare paths exactly as the scan does', () => {
    const fromPaths = rootIndexFromPaths(['a/b/c.json', 'a/d.json']);
    expect(fromPaths.entries).toEqual([{ path: 'a/b/c.json' }, { path: 'a/d.json' }]);
    expect(fromPaths.folders).toEqual(['a', 'a/b']);
  });
});
