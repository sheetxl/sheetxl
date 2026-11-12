/**
 * Browser resource roots: served URL prefixes, searched in order.
 *
 * A library re-bundled by a consumer loses its own `import.meta.url`, so it cannot self-locate its
 * assets the way node's last-resort root does — the host serves them and the roots point at them.
 * `fromUrl` is accepted only so both platform sides share a signature.
 *
 * ## Order for `(kind, pkg, relPath)`
 *
 * 1. anything registered via {@link addResourceRoot} — `<root>/<kind>/<pkg>/<relPath>`
 * 2. an explicitly configured base — kind-INCLUSIVE, so `<base><pkg>/<relPath>`
 *
 * ## Nothing is searched unless the host says so
 *
 * There is no implicit root. A browser cannot tell "not served" from "not there" without asking, and
 * every miss is a request the browser logs as a failed load in the console, which JS cannot suppress.
 * Packages bundle their default language, so an app that serves nothing is healthy and makes zero
 * requests. An app that stages resources (`ResourcesPlugin` puts them at `/resources`) registers that
 * location with `addResourceRoot('/resources')`.
 *
 * ## The root `contents.json` is the authority
 *
 * HTTP cannot enumerate a directory, so every root is asked ONCE for its root-level `contents.json`
 * — the authoritative listing of everything the root contains (files and folders; the build always
 * writes one). From then on the resolver reads only files that listing names, so a request for an
 * absent file never happens at all. A root that lacks the listing (a hand-assembled or legacy host)
 * degrades to probing every address — and the HTML guard in
 * {@link urlRoot.read} stays as belt-and-braces for that path, because most single-page hosts answer
 * an unknown path with `200 text/html`, not a 404.
 */
import { type ResourceIndex, type ResourceRoot, type ResourceRootIndex } from '../Types';
import { read, readAll, readAllTagged, list, CONTENTS_FILE, bridgedResourceRoot, type ResourceHit } from '../Resource';

// A custom resource loader (the "bridged root" adapter) and the type to declare one — the public seam
// for a host that supplies bytes its own way (a VSCode extension host reading node_modules, etc.).
export { bridgedResourceRoot };
export type { ResourceRoot } from '../Types';

/** A root's parsed root-level listing, reduced to what membership checks need. */
interface RootListing {
  files: Set<string>;
  folders: Set<string>;
}

/**
 * One fetch of `<prefix>/contents.json` per root, cached for the session.
 *
 * `null` — cached too — means "this root has no authoritative listing": unreachable, a 404, an HTML
 * fallback, or JSON that is not a {@link ResourceRootIndex}. All of those degrade to probing rather
 * than erroring, because the listing is DISCOVERY: absent discovery has a correct fallback where a
 * broken payload file does not, and being strict here would let one corrupt index take down every
 * resource the root serves perfectly well.
 */
const _rootListings = new Map<string, Promise<RootListing | null>>();

/** Forget fetched root listings — for tests, and hosts whose served resources change underneath them. */
export function clearResourceListingCache(): void {
  _rootListings.clear();
}

function rootListing(prefix: string): Promise<RootListing | null> {
  let cached = _rootListings.get(prefix);
  if (!cached) {
    cached = (async (): Promise<RootListing | null> => {
      let res: Response;
      try {
        res = await fetch(`${prefix}${prefix.endsWith('/') ? '' : '/'}${CONTENTS_FILE}`);
      } catch {
        return null;
      }
      if (!res.ok) return null;
      if ((res.headers.get('content-type') ?? '').includes('text/html')) return null;
      let parsed: Partial<ResourceRootIndex>;
      try {
        parsed = JSON.parse(await res.text());
      } catch {
        return null;
      }
      if (!Array.isArray(parsed?.entries)) return null;
      const files = new Set<string>();
      const folders = new Set<string>(Array.isArray(parsed.folders) ? parsed.folders : []);
      for (const entry of parsed.entries) {
        const p = (entry as { path?: unknown })?.path;
        if (typeof p !== 'string') continue;
        files.add(p);
        // Derive ancestors too, so a hand-written index that only lists files still answers
        // folder-existence questions.
        const parts = p.split('/');
        for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join('/'));
      }
      return { files, folders };
    })();
    _rootListings.set(prefix, cached);
  }
  return cached;
}

/**
 * A root served under a URL prefix.
 *
 * `segments` varies by layout exactly as on node: a resource root serves `<kind>/<pkg>/`, while a
 * configured base serves `<pkg>/` (it already names the kind).
 */
function urlRoot(prefix: string, segments: (kind: string, pkg: string) => string[]): ResourceRoot {
  const url = (kind: string, pkg: string, relPath: string): string =>
    `${prefix}${prefix.endsWith('/') ? '' : '/'}${[...segments(kind, pkg), relPath].join('/')}`;
  return {
    id: prefix,
    describe: url,
    async read(kind, pkg, relPath) {
      let res: Response;
      try {
        res = await fetch(url(kind, pkg, relPath));
      } catch {
        return null; // network/CORS failure at this root
      }
      if (!res.ok) return null;
      // A single-page host answers an unknown path with `200 text/html` — its index — rather than a
      // 404. Treat that as ABSENT: we asked for a resource and were handed the app shell, which is
      // this environment's way of saying the file is not there. The authoritative root listing makes
      // this request not happen at all when the file is known absent; the guard stays for roots with
      // no listing, where probing is all there is.
      const type = res.headers.get('content-type') ?? '';
      if (type.includes('text/html')) return null;
      return new Uint8Array(await res.arrayBuffer());
    },
    async has(kind, pkg, relPath) {
      const listing = await rootListing(prefix);
      if (!listing) return null; // no authoritative listing — the caller probes
      const dir = segments(kind, pkg).join('/');
      if (relPath == null) return listing.folders.has(dir);
      return listing.files.has(`${dir}/${relPath}`);
    },
    // HTTP cannot enumerate a directory — but the root listing can stand in for one, which lets a
    // served folder that never got its own `contents.json` still be discovered.
    async list(kind, pkg) {
      const listing = await rootListing(prefix);
      if (!listing) return null;
      const dir = `${segments(kind, pkg).join('/')}/`;
      return [...listing.files].filter((f) => f.startsWith(dir)).map((f) => f.slice(dir.length));
    }
  };
}

/** Registered roots, in precedence order. */
const _roots: ResourceRoot[] = [];

/** Register a URL prefix (or a custom {@link ResourceRoot}) served as `<root>/<kind>/<pkg>/<relPath>`. */
export function addResourceRoot(root: string | ResourceRoot): void {
  const resolved = typeof root === 'string'
    ? urlRoot(root.endsWith('/') ? root.slice(0, -1) : root, (kind, pkg) => [kind, pkg])
    : root;
  if (resolved.id && !_roots.some((r) => r.id === resolved.id)) _roots.push(resolved);
}

/** Every root for one lookup, in precedence order. */
function roots(base: string | null): ResourceRoot[] {
  const out = [..._roots];
  if (base) out.push(urlRoot(base, (_kind, pkg) => [pkg]));
  return out;
}

export async function loadResourceAll<T = unknown>(
  kind: string, pkg: string, relPath: string, base: string | null, _fromUrl?: string
): Promise<T[]> {
  return readAll<T>(roots(base), kind, pkg, relPath);
}

export async function loadResource<T = unknown>(
  kind: string, pkg: string, relPath: string, base: string | null, _fromUrl?: string
): Promise<T> {
  return read<T>(roots(base), kind, pkg, relPath);
}

export async function listResources(
  kind: string, pkg: string, base: string | null, _fromUrl?: string
): Promise<ResourceIndex[]> {
  return list(roots(base), kind, pkg);
}

export async function loadResourceAllTagged<T = unknown>(
  kind: string, pkg: string, relPath: string, base: string | null, _fromUrl?: string
): Promise<ResourceHit<T>[]> {
  return readAllTagged<T>(roots(base), kind, pkg, relPath);
}
