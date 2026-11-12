import { describe, it, expect, afterEach, vi } from 'vitest';

import {
  loadResourceAll, listResources, clearResourceListingCache, addResourceRoot
} from '../../resource/lib/resource.browser';

addResourceRoot('/resources');

/**
 * A resource host is NOT required to cooperate.
 *
 * Most single-page hosts (nginx `try_files`, Netlify, a plain Vite app) answer an unknown path with
 * `200 text/html` — the app shell — rather than a 404. We cannot ask a consumer to add resource-aware
 * routing to their server, so the runtime has to recognize that response as "absent" on its own.
 *
 * Without this, every OPTIONAL file (`inherit.json`, which most packages do not ship) reads back as
 * HTML and surfaces as "not valid JSON" for a file that simply does not exist.
 */
const html = (body = '<!doctype html><html></html>'): Response =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });

const json = (value: unknown): Response =>
  new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });

afterEach(() => { vi.unstubAllGlobals(); clearResourceListingCache(); });

describe('browser resource root', () => {
  it('treats a single-page host\'s HTML fallback as ABSENT, not as broken JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => html()));
    await expect(loadResourceAll('locales', '@acme/pkg', 'inherit.json', null)).resolves.toEqual([]);
  });

  it('still reads a real JSON resource', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ nn: ['nb'] })));
    const found = await loadResourceAll<Record<string, string[]>>(
      'locales', '@acme/pkg', 'inherit.json', null
    );
    expect(found[0]).toEqual({ nn: ['nb'] });
  });

  it('treats a 404 as absent too (a host that does route correctly)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    await expect(loadResourceAll('locales', '@acme/pkg', 'inherit.json', null)).resolves.toEqual([]);
  });

  it('does not mistake an HTML fallback for a listing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => html()));
    // No `contents.json` and no way to enumerate over HTTP ⇒ this root contributes nothing, rather
    // than contributing the app shell parsed as an index.
    await expect(listResources('locales', '@acme/pkg', null)).resolves.toEqual([]);
  });

  it('surfaces genuinely malformed JSON — a typo must not read as absent', async () => {
    // The other half of the contract: a file that IS there but broken has to be loud, or a user
    // debugging their own override gets silence.
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response('{ oops', { status: 200, headers: { 'content-type': 'application/json' } })
    ));
    await expect(loadResourceAll('locales', '@acme/pkg', 'inherit.json', null))
      .rejects.toThrow(/not valid JSON/);
  });
});
