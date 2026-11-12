import { describe, it, expect, vi, afterEach } from 'vitest';

import { defineLazyModule, LazyLoadError, LazyModules } from '../../utils/LazyModule';

describe('defineLazyModule', () => {
  it('shares one attempt between concurrent loads and keeps the loaded module', async () => {
    const loader = vi.fn(async () => ({ value: 1 }));
    const module = defineLazyModule('test:shared', loader, { retries: 0 });
    expect(module.peek()).toBeUndefined();

    const [a, b] = await Promise.all([module.load(), module.load()]);
    expect(a).toBe(b);
    expect(await module.load()).toBe(a);
    expect(module.peek()).toBe(a);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('retries a failed load before reporting it', async () => {
    let calls = 0;
    const module = defineLazyModule('test:retry', async () => {
      if (++calls < 3) throw new TypeError('network error');
      return 'ok';
    }, { retries: 2, retryDelay: 0 });

    expect(await module.load()).toBe('ok');
    expect(calls).toBe(3);
  });

  it('reports a LazyLoadError, and loads again on the next call', async () => {
    // The offline case: a failure must not be remembered, or reconnecting would not help.
    const cause = new TypeError('network error');
    let online = false;
    const module = defineLazyModule('test:offline', async () => {
      if (!online) throw cause;
      return 'ok';
    }, { retries: 0 });

    const error = await module.load().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LazyLoadError);
    expect((error as LazyLoadError).key).toBe('test:offline');
    expect((error as LazyLoadError).cause).toBe(cause);
    expect(module.peek()).toBeUndefined();

    online = true;
    expect(await module.load()).toBe('ok');
  });

  it('answers what select picks from the module', async () => {
    const module = defineLazyModule('test:select', async () => ({ Feature: 'feature' }), { select: (m) => m.Feature });
    expect(await module.load()).toBe('feature');
    expect(module.peek()).toBe('feature');
  });

  it('registers each module by key, and removes only the one still under its key', () => {
    const module = defineLazyModule('test:registry', async () => 1);
    expect(LazyModules.get('test:registry')).toBe(module);
    expect(LazyModules.getAll()).toContain(module);
    expect(module.prefetch).toBe(true);

    const replaced = defineLazyModule('test:registry', async () => 2);
    expect(LazyModules.get('test:registry')).toBe(replaced);
    expect(LazyModules.remove(module)).toBe(false);
    expect(LazyModules.get('test:registry')).toBe(replaced);
    expect(LazyModules.remove(replaced)).toBe(true);
    expect(LazyModules.get('test:registry')).toBeUndefined();
  });
});

describe('LazyModules.prefetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Modules whose keys are unique to one test, so the shared registry does not leak between tests. */
  const defineSet = (prefix: string) => {
    const loaded: string[] = [];
    const define = (name: string, options?: Parameters<typeof defineLazyModule>[2]) =>
      defineLazyModule(`${prefix}:${name}`, async () => { loaded.push(name); return name; }, { retries: 0, ...options });
    return { loaded, define };
  };

  it('loads every module once, skipping modules that opted out', async () => {
    const { loaded, define } = defineSet('prefetch-all');
    define('one');
    define('two');
    define('optOut', { prefetch: false });

    await LazyModules.prefetch();
    expect(loaded).toContain('one');
    expect(loaded).toContain('two');
    expect(loaded).not.toContain('optOut');

    await LazyModules.prefetch();
    expect(loaded.filter((name) => name === 'one')).toHaveLength(1);
  });

  it('loads nothing while offline, saving data, or on 2g', async () => {
    const { loaded, define } = defineSet('prefetch-network');
    define('feature');

    vi.stubGlobal('navigator', { onLine: false });
    await LazyModules.prefetch();
    vi.stubGlobal('navigator', { onLine: true, connection: { saveData: true, effectiveType: '4g' } });
    await LazyModules.prefetch();
    vi.stubGlobal('navigator', { onLine: true, connection: { effectiveType: 'slow-2g' } });
    await LazyModules.prefetch();
    expect(loaded).toEqual([]);

    vi.stubGlobal('navigator', { onLine: true, connection: { effectiveType: '3g' } });
    await LazyModules.prefetch();
    expect(loaded).toEqual(['feature']);
  });

  it('loads only on a connection reported fast when asked to', async () => {
    const { loaded, define } = defineSet('prefetch-fast');
    define('feature');

    vi.stubGlobal('navigator', { onLine: true });
    await LazyModules.prefetch({ onlyWhenFast: true });
    vi.stubGlobal('navigator', { onLine: true, connection: { effectiveType: '3g' } });
    await LazyModules.prefetch({ onlyWhenFast: true });
    expect(loaded).toEqual([]);

    vi.stubGlobal('navigator', { onLine: true, connection: { effectiveType: '4g' } });
    await LazyModules.prefetch({ onlyWhenFast: true });
    expect(loaded).toEqual(['feature']);
  });

  it('asks a module whether it is wanted at each prefetch', async () => {
    const { loaded, define } = defineSet('prefetch-wanted');
    let wanted = false;
    const module = define('feature', { prefetch: () => wanted });
    expect(module.prefetch).toBe(false);
    await LazyModules.prefetch();
    expect(loaded).toEqual([]);
    wanted = true;
    expect(module.prefetch).toBe(true);
    await LazyModules.prefetch();
    expect(loaded).toEqual(['feature']);
  });

  it('stops when aborted and does not reject when a module fails', async () => {
    const { loaded, define } = defineSet('prefetch-abort');
    defineLazyModule('prefetch-abort:failing', async () => { throw new Error('offline'); }, { retries: 0 });
    define('after');

    await expect(LazyModules.prefetch()).resolves.toBeUndefined();
    expect(loaded).toContain('after');

    const { loaded: loadedAborted, define: defineAborted } = defineSet('prefetch-aborted');
    defineAborted('skipped');
    const controller = new AbortController();
    controller.abort();
    await LazyModules.prefetch({ signal: controller.signal });
    expect(loadedAborted).toEqual([]);
  });
});
