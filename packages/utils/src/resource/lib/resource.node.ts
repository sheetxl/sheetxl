/**
 * Node resource roots: directories on disk, searched in order.
 *
 * A "resource" is a data file shipped beside the code rather than inside the bundle — locale catalogs
 * today, fonts and script libraries next. Both things we need follow from the search order: our npm
 * distribution can provide them, and a user can drop in their own.
 *
 * ## Order for `(kind, pkg, relPath)`
 *
 * 1. `SHEETXL_RESOURCE_PATH` (a `path.delimiter`-separated list, first entry wins — each names a
 *    resource root directly, so no `resources/` segment)
 * 2. `~/.sheetxl/resources`
 * 3. anything registered via {@link addResourceRoot}, in registration order
 * 4. an explicitly configured base, if any — kind-INCLUSIVE, so it holds `<pkg>/<relPath>` directly
 * 5. `<entry script dir>/resources` — what a bundled app's BUILD staged, found automatically
 * 6. the package's own `resources/<kind>/`, located by walking up from `import.meta.url`
 *
 * User-controlled roots come first ON PURPOSE: that ordering is the whole "npm ships them AND users
 * install their own" contract — dropping `~/.sheetxl/resources/locales/@sheetxl/sdk/fr/` adds a locale
 * we never shipped, and dropping a file we DO ship overrides it.
 *
 * **Self-location is LAST, not the mechanism.** It only works while a package is a distinct directory
 * on disk; a host that bundles our packages into one file (the CLI does) destroys `import.meta.url`'s
 * meaning and must rely on a staged root instead — exactly as the browser must, for the same reason.
 *
 * Node built-ins load through {@link _builtin}, whose specifier is a VARIABLE. That is deliberate:
 * a literal specifier makes TypeScript demand `@types/node`, which resolves in some packages of this
 * monorepo and not others (utils-react / utils-mui / grid-react all failed), and a browser bundler
 * would try to resolve it. An indirect specifier is invisible to both.
 */
import { type ResourceIndex, type ResourceRoot } from '../Types';
import { read, readAll, readAllTagged, list, bridgedResourceRoot, type ResourceHit } from '../Resource';

// Mirror the browser entry's public seam so the custom-loader API is identical on both platforms.
export { bridgedResourceRoot };
export type { ResourceRoot } from '../Types';

/**
 * The directory resources live under wherever the container holds other things too — a package root,
 * an app bundle, `~/.sheetxl`. A path given to `SHEETXL_RESOURCE_PATH` names the resource root itself
 * and so does NOT include it.
 */
const RESOURCE_DIR = 'resources';

/** Load a node built-in without TypeScript or a bundler trying to resolve the specifier. */
const _builtin = (name: string): Promise<any> =>
  import(/* @vite-ignore */ /* webpackIgnore: true */ name);

/** Every file under `dir`, relative to it (recursive). */
async function walk(fs: any, path: any, dir: string, rel = ''): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await walk(fs, path, path.join(dir, entry.name), r));
    else out.push(r);
  }
  return out;
}

/**
 * A root backed by a real directory, resolving `<dir>/<segments…>/<relPath>`.
 *
 * `segments` is what varies between the three on-disk layouts: a resource root holds
 * `<kind>/<pkg>/`, a package locating itself holds `<kind>/` (it IS the package), and a configured
 * base holds `<pkg>/` (it already names the kind).
 */
function directoryRoot(
  dir: string,
  segments: (kind: string, pkg: string) => string[]
): ResourceRoot {
  const dirOf = async (kind: string, pkg: string): Promise<string> => {
    const path = await _builtin('node:path');
    return path.join(dir, ...segments(kind, pkg));
  };
  return {
    id: dir,
    describe: (kind, pkg, relPath) => [dir, ...segments(kind, pkg), relPath].join('/'),
    async read(kind, pkg, relPath) {
      const fs = await _builtin('node:fs/promises');
      const path = await _builtin('node:path');
      try {
        return await fs.readFile(path.join(await dirOf(kind, pkg), relPath));
      } catch {
        return null; // absent at this root
      }
    },
    async list(kind, pkg) {
      const fs = await _builtin('node:fs/promises');
      const path = await _builtin('node:path');
      try {
        return await walk(fs, path, await dirOf(kind, pkg));
      } catch {
        return null; // no such directory
      }
    }
  };
}

/**
 * Signature parity with the browser twin, where fetched root listings are cached for the session.
 * Node roots are real directories — the filesystem is its own authority and nothing is cached — so
 * there is nothing to clear.
 */
export function clearResourceListingCache(): void {
  /* nothing cached on node */
}

/** Roots registered by a host. */
const _hostRoots: ResourceRoot[] = [];

/** Env, home, and app-staged roots — resolved once. */
let _implicit: { user: ResourceRoot[]; app: ResourceRoot[] } | null = null;

/**
 * Register a directory (or a custom {@link ResourceRoot}) that may hold resources for any package,
 * laid out as `<root>/<kind>/<pkg>/<relPath>`.
 *
 * Ordered after the user's own roots so a host staging its shipped copy never shadows an override.
 */
export function addResourceRoot(root: string | ResourceRoot): void {
  const resolved = typeof root === 'string'
    ? directoryRoot(root, (kind, pkg) => [kind, pkg])
    : root;
  if (resolved.id && !_hostRoots.some((r) => r.id === resolved.id)) _hostRoots.push(resolved);
}

/** Env + home roots, and the running app's staged root. */
async function implicitRoots(): Promise<{ user: ResourceRoot[]; app: ResourceRoot[] }> {
  if (_implicit) return _implicit;
  const user: ResourceRoot[] = [];
  const app: ResourceRoot[] = [];
  try {
    const path = await _builtin('node:path');
    const os = await _builtin('node:os');
    const fs = await _builtin('node:fs');
    const proc = (globalThis as any).process;

    const env = proc?.env?.SHEETXL_RESOURCE_PATH;
    if (env) {
      for (const entry of String(env).split(path.delimiter)) {
        const trimmed = entry.trim();
        if (trimmed) user.push(directoryRoot(trimmed, (kind, pkg) => [kind, pkg]));
      }
    }
    // `~/.sheetxl/resources` — the `resources/` segment keeps runtime data from colliding with the
    // config and cache that will live beside it.
    const home = os.homedir();
    if (home) {
      user.push(directoryRoot(path.join(home, '.sheetxl', RESOURCE_DIR), (kind, pkg) => [kind, pkg]));
    }

    // `<entry script dir>/resources` — how a BUNDLED app (the CLI, the MCP server) finds what its
    // build staged, with no startup call to forget. realpath because a `bin` install is a symlink and
    // the staging sits next to the real script, not the link.
    const argv1 = proc?.argv?.[1];
    if (argv1) {
      const staged = path.join(path.dirname(fs.realpathSync(argv1)), RESOURCE_DIR);
      if (fs.existsSync(staged)) app.push(directoryRoot(staged, (kind, pkg) => [kind, pkg]));
    }
  } catch {
    /* no env/home/argv here — host roots and self-location still apply */
  }
  _implicit = { user, app };
  return _implicit;
}

/** `<pkg>\0<fromUrl>` -> that package's root directory (or null when not locatable). */
const _packageRoots = new Map<string, string | null>();

/** Walk up from a module URL to the `package.json` that declares `pkg`. */
async function packageRootFor(pkg: string, fromUrl: string): Promise<string | null> {
  const cacheKey = `${pkg}\0${fromUrl}`;
  if (_packageRoots.has(cacheKey)) return _packageRoots.get(cacheKey)!;

  const url = await _builtin('node:url');
  const fs = await _builtin('node:fs/promises');
  const path = await _builtin('node:path');

  let dir: string | null = null;
  try {
    let current: string = path.dirname(url.fileURLToPath(fromUrl));
    for (let i = 0; i < 12; i++) {
      try {
        const raw = await fs.readFile(path.join(current, 'package.json'), 'utf8');
        if (JSON.parse(raw).name === pkg) { dir = current; break; }
      } catch {
        /* not the root (or unreadable) — keep walking */
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  } catch {
    /* not a file: URL, or an unreadable tree */
  }

  _packageRoots.set(cacheKey, dir);
  return dir;
}

/** Every root for one lookup, in precedence order. */
async function roots(pkg: string, base: string | null, fromUrl?: string): Promise<ResourceRoot[]> {
  const { user, app } = await implicitRoots();
  const out = [...user, ..._hostRoots];
  // A configured base already names the kind, so it holds `<pkg>/<relPath>` with no `<kind>` segment.
  if (base) out.push(directoryRoot(base, (_kind, p) => [p]));
  out.push(...app);
  if (fromUrl) {
    const pkgRoot = await packageRootFor(pkg, fromUrl);
    // A package keeps its own under `resources/<kind>/` — no `<pkg>` segment, because it IS the pkg.
    if (pkgRoot) out.push(directoryRoot(pkgRoot, (kind) => [RESOURCE_DIR, kind]));
  }
  return out;
}

export async function loadResourceAll<T = unknown>(
  kind: string, pkg: string, relPath: string, base: string | null, fromUrl?: string
): Promise<T[]> {
  return readAll<T>(await roots(pkg, base, fromUrl), kind, pkg, relPath);
}

export async function loadResource<T = unknown>(
  kind: string, pkg: string, relPath: string, base: string | null, fromUrl?: string
): Promise<T> {
  return read<T>(await roots(pkg, base, fromUrl), kind, pkg, relPath);
}

export async function listResources(
  kind: string, pkg: string, base: string | null, fromUrl?: string
): Promise<ResourceIndex[]> {
  return list(await roots(pkg, base, fromUrl), kind, pkg);
}

export async function loadResourceAllTagged<T = unknown>(
  kind: string, pkg: string, relPath: string, base: string | null, fromUrl?: string
): Promise<ResourceHit<T>[]> {
  return readAllTagged<T>(await roots(pkg, base, fromUrl), kind, pkg, relPath);
}
