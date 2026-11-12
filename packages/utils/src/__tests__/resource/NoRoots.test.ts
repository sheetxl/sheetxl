import { describe, it, expect, afterEach, vi } from 'vitest';

import { loadResourceAll, listResources } from '../../resource/lib/resource.browser';
import {
  addResourceRoot, onResourceRootsChange, setLocaleResourceBase
} from '../../i18n/LocaleResource';

/**
 * A browser host that serves nothing is the zero-config state: packages render their bundled default
 * language. The runtime must not go looking for resources it was never told about — every miss is a
 * failed request the browser logs in the console.
 */
afterEach(() => { vi.unstubAllGlobals(); });

describe('browser resources with no root configured', () => {
  it('makes no requests', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetch);
    await expect(listResources('locales', '@acme/pkg', null)).resolves.toEqual([]);
    await expect(loadResourceAll('locales', '@acme/pkg', 'inherit.json', null)).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('tells listeners when a root is added or the base is set', () => {
    const listener = vi.fn();
    const remove = onResourceRootsChange(listener);
    addResourceRoot('/late-resources');
    setLocaleResourceBase('/late-base/');
    setLocaleResourceBase('/late-base'); // same base, normalized: no change
    remove();
    addResourceRoot('/after-remove');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
