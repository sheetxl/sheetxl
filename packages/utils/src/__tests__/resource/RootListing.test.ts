import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  loadResourceAll, listResources, clearResourceListingCache, addResourceRoot
} from '../../resource/lib/resource.browser';

// Where an app build stages resources; the host registers it (there is no implicit root).
addResourceRoot('/resources');

/**
 * The root `contents.json` is AUTHORITATIVE: one fetch of `<root>/contents.json` tells the resolver
 * everything the root contains, so a request for an absent file never happens at all. A root without
 * one (a hand-assembled or legacy host) degrades to probing, covered by
 * BrowserRoot.test.ts.
 */

/** What a build stages for one package with a `de` locale. */
const ROOT_INDEX = {
  entries: [
    { path: 'locales/@acme/pkg/contents.json' },
    { path: 'locales/@acme/pkg/de/ui.msg.json' }
  ],
  folders: ['locales', 'locales/@acme', 'locales/@acme/pkg', 'locales/@acme/pkg/de']
};

const PKG_INDEX = {
  kind: 'locales',
  package: '@acme/pkg',
  entries: [{ path: 'de/ui.msg.json', locale: 'de', role: 'messages' }]
};

const html = (): Response =>
  new Response('<!doctype html><html></html>', {
    status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }
  });

const json = (value: unknown): Response =>
  new Response(JSON.stringify(value), {
    status: 200, headers: { 'content-type': 'application/json' }
  });

/**
 * A single-page host: known routes answer JSON, everything else answers the app shell — the
 * uncooperative default the runtime must survive without server-side help.
 */
function host(routes: Record<string, unknown>): { requested: string[] } {
  const requested: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    requested.push(url);
    return url in routes ? json(routes[url]) : html();
  }));
  return { requested };
}

beforeEach(() => { clearResourceListingCache(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('authoritative root listing', () => {
  it('never requests a file the listing does not name', async () => {
    const { requested } = host({ '/resources/contents.json': ROOT_INDEX });
    await expect(loadResourceAll('locales', '@acme/pkg', 'inherit.json', null)).resolves.toEqual([]);
    // ONE request — the listing itself. The absent `inherit.json` was never asked for; that the
    // host would have answered it with HTML is exactly the round-trip this file exists to remove.
    expect(requested).toEqual(['/resources/contents.json']);
  });

  it('reads a listed file, fetching the listing only once', async () => {
    const { requested } = host({
      '/resources/contents.json': ROOT_INDEX,
      '/resources/locales/@acme/pkg/de/ui.msg.json': { hello: 'hallo' }
    });
    const found = await loadResourceAll('locales', '@acme/pkg', 'de/ui.msg.json', null);
    expect(found).toEqual([{ hello: 'hallo' }]);
    await loadResourceAll('locales', '@acme/pkg', 'inherit.json', null);
    expect(requested).toEqual([
      '/resources/contents.json',
      '/resources/locales/@acme/pkg/de/ui.msg.json'
    ]);
  });

  it('skips a package the listing does not hold — zero per-package requests', async () => {
    const { requested } = host({ '/resources/contents.json': ROOT_INDEX });
    await expect(listResources('locales', '@other/pkg', null)).resolves.toEqual([]);
    expect(requested).toEqual(['/resources/contents.json']);
  });

  it('reads the per-package listing the root listing declares', async () => {
    const { requested } = host({
      '/resources/contents.json': ROOT_INDEX,
      '/resources/locales/@acme/pkg/contents.json': PKG_INDEX
    });
    await expect(listResources('locales', '@acme/pkg', null)).resolves.toEqual([PKG_INDEX]);
    expect(requested).toEqual([
      '/resources/contents.json',
      '/resources/locales/@acme/pkg/contents.json'
    ]);
  });

  it('enumerates a served folder that has no per-package listing of its own', async () => {
    // A root listing can describe a folder nothing generated a `contents.json` for — HTTP cannot
    // enumerate, but the root listing stands in for the directory, so the folder still works.
    const { requested } = host({
      '/resources/contents.json': {
        entries: [{ path: 'locales/@acme/pkg/de/ui.msg.json' }],
        folders: ['locales', 'locales/@acme', 'locales/@acme/pkg', 'locales/@acme/pkg/de']
      }
    });
    await expect(listResources('locales', '@acme/pkg', null)).resolves.toEqual([
      { kind: 'locales', package: '@acme/pkg', entries: [{ path: 'de/ui.msg.json' }] }
    ]);
    expect(requested).toEqual(['/resources/contents.json']);
  });

  it('degrades to probing when the root has no listing at all', async () => {
    // A hand-assembled or legacy host: no root `contents.json`. Every address is probed —
    // this fallback is what keeps such roots working.
    const { requested } = host({
      '/resources/locales/@acme/pkg/de/ui.msg.json': { hello: 'hallo' }
    });
    const found = await loadResourceAll('locales', '@acme/pkg', 'de/ui.msg.json', null);
    expect(found).toEqual([{ hello: 'hallo' }]);
    expect(requested).toContain('/resources/contents.json');
  });

  it('treats an HTML answer for the listing itself as "no listing", not as broken', async () => {
    // The listing request is subject to the same single-page-host reality as everything else.
    host({ '/resources/locales/@acme/pkg/inherit.json': { de: ['en'] } });
    const found = await loadResourceAll('locales', '@acme/pkg', 'inherit.json', null);
    expect(found).toEqual([{ de: ['en'] }]);
  });
});
