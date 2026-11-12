import { describe, it, expect, vi, afterEach } from 'vitest';

import { type ResourceIndex } from '@sheetxl/utils';

import { loadScriptTemplates } from '../utils/ScriptTemplates';

// Tests resolve the node twin of the resource resolver, which reads disk rather than fetching, so the
// listing is stubbed here; the resolver has its own tests. Sources are fetched by the loader itself.
const listings = new Map<string, () => ResourceIndex[]>();
vi.mock('@sheetxl/utils', async (importOriginal) => ({
  ...await importOriginal<typeof import('@sheetxl/utils')>(),
  listResources: vi.fn(async (_kind: string, _pkg: string, base: string) => listings.get(base)?.() ?? [])
}));

const catalog = (entries: ResourceIndex['entries']): ResourceIndex[] => [
  { kind: 'templates', package: 'templates-scripting', meta: { schema: 1 }, entries }
];

/** Serve script sources (paths under `<base>/templates-scripting/`) through a stubbed `fetch`. */
const serve = (base: string, files: Record<string, string>): string[] => {
  const requested: string[] = [];
  vi.stubGlobal('fetch', async (input: string) => {
    requested.push(input);
    const body = files[input.slice(`${base}/templates-scripting/`.length)];
    if (body === undefined) return new Response('not found', { status: 404 });
    return new Response(body, { status: 200, headers: { 'content-type': 'text/plain' } });
  });
  return requested;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('loadScriptTemplates', () => {
  it('reads the catalog and every source once, shared by concurrent callers', async () => {
    const base = 'https://example.test/a/dist';
    listings.set(base, () => catalog([
      { path: 'add.ts', title: 'ADD', summary: 'Adds two numbers.', icon: 'formula' },
      { path: 'autoFillDown.ts', icon: 'macro' },
      { path: 'README.md' }
    ]));
    const requested = serve(base, {
      'add.ts': 'export function add() {}',
      'autoFillDown.ts': 'export function autoFillDown() {}'
    });
    const [first, second] = await Promise.all([loadScriptTemplates(base), loadScriptTemplates(base)]);
    expect(second).toBe(first);
    expect(first).toEqual([
      { path: 'add.ts', title: 'ADD', summary: 'Adds two numbers.', icon: 'formula', content: 'export function add() {}' },
      { path: 'autoFillDown.ts', title: 'Auto Fill Down', summary: undefined, icon: 'macro', content: 'export function autoFillDown() {}' }
    ]);
    expect(requested).toEqual([
      `${base}/templates-scripting/add.ts`,
      `${base}/templates-scripting/autoFillDown.ts`
    ]);
  });

  it('leaves out a template whose source does not load', async () => {
    const base = 'https://example.test/b/dist';
    listings.set(base, () => catalog([{ path: 'gone.ts' }, { path: 'here.ts' }]));
    serve(base, { 'here.ts': 'x' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await loadScriptTemplates(base)).map((t) => t.path)).toEqual(['here.ts']);
  });

  it('ignores a bare file scan, which is not a catalog', async () => {
    const base = 'https://example.test/c/dist';
    listings.set(base, () => [{ kind: 'templates', package: 'templates-scripting', entries: [{ path: 'add.ts' }] }]);
    await expect(loadScriptTemplates(base)).rejects.toThrow(/No script templates/);
  });

  it('rejects when the catalog cannot be reached, and tries again on the next call', async () => {
    const base = 'https://example.test/d/dist';
    await expect(loadScriptTemplates(base)).rejects.toThrow(/No script templates/);
    listings.set(base, () => catalog([{ path: 'add.ts' }]));
    serve(base, { 'add.ts': 'x' });
    expect((await loadScriptTemplates(base)).map((t) => t.title)).toEqual(['Add']);
  });
});
