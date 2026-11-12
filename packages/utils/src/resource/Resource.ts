/**
 * The platform-independent half of resource resolution: given an ordered list of {@link ResourceRoot}s,
 * read and list.
 *
 * Everything platform-specific now lives in *which roots exist* and *how a root fetches bytes* —
 * `lib/resource.node.ts` and `lib/resource.browser.ts` assemble them and re-export this API unchanged.
 * The search itself is one implementation, so the two sides cannot drift.
 */
import { type ResourceIndex, type ResourceRoot, type ResourceRootIndex } from './Types';

/**
 * The generated listing at the root of every `<kind>/<pkg>/` directory — and, as a
 * {@link ResourceRootIndex}, at the top of every resource root.
 */
export const CONTENTS_FILE = 'contents.json';

/**
 * Assemble a ROOT listing from the file paths a root contains (each relative to the root).
 *
 * Pure and platform-free — shared by the disk-scanning builder (`resource/build`), a bundler
 * emitting assets with no directory to scan, and a dev server synthesizing the listing per request.
 * Folders are the ancestors of every file, so the listing describes the whole tree; both lists are
 * sorted so regenerating an unchanged root is byte-identical.
 */
export function rootIndexFromPaths(paths: readonly string[]): ResourceRootIndex {
  const folders = new Set<string>();
  for (const p of paths) {
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join('/'));
  }
  return {
    entries: [...paths].sort().map((path) => ({ path })),
    folders: [...folders].sort()
  };
}

/**
 * Wrap an async byte-reader into a {@link ResourceRoot} — the minimal "resource loader" adapter.
 *
 * Its whole job is to answer `read(kind, pkg, relPath) -> bytes | null`; where those bytes come from
 * is the caller's business — a `fetch`, an OPFS handle, an in-memory map in a test, or (the motivating
 * case) a bridge to a VSCode **extension host** that reads the installed packages' `resources/` from
 * `node_modules` on disk, which a webview cannot do itself.
 *
 * No `has`/`list` are needed: the resolver falls back to probing, and `list()` is satisfied by `read`
 * returning a package's shipped per-package `contents.json`. Register with `addResourceRoot(root)`.
 * Kind-agnostic — the same loader serves `locales`, `fonts`, and every future kind.
 */
export function bridgedResourceRoot(
  id: string,
  read: (kind: string, pkg: string, relPath: string) => Promise<Uint8Array | null>
): ResourceRoot {
  return { id, read, describe: (kind, pkg, relPath) => `${id}:${kind}/${pkg}/${relPath}` };
}

const _decoder = new TextDecoder();

/** Where a root would look, for diagnostics. */
function describe(root: ResourceRoot, kind: string, pkg: string, relPath: string): string {
  return root.describe?.(kind, pkg, relPath) ?? `${root.id}/${kind}/${pkg}/${relPath}`;
}

/** A hit, tagged with WHICH root produced it. `rank` is the root's index — 0 is highest precedence. */
export interface ResourceHit<T> {
  rank: number;
  id: string;
  value: T;
}

/**
 * Like {@link readAll}, but each hit carries the root it came from.
 *
 * Needed whenever several DIFFERENT files merge into one result: root precedence must dominate file
 * order, and that cannot be recovered from a flat list because a file missing at one root shifts
 * every later index. A user root adding `fr.msg.json` must outrank a package's `model.msg.json`, not
 * lose to it on a filename comparison.
 */
export async function readAllTagged<T = unknown>(
  roots: ResourceRoot[],
  kind: string,
  pkg: string,
  relPath: string
): Promise<ResourceHit<T>[]> {
  const found: ResourceHit<T>[] = [];
  for (let rank = 0; rank < roots.length; rank++) {
    const root = roots[rank];
    // A root with an authoritative listing answers "is it there?" without a request. Only `false`
    // short-circuits: `null` means the root has no listing and must be probed —
    // which is what keeps a hand-assembled folder working.
    if (root.has && await root.has(kind, pkg, relPath) === false) continue;
    let bytes: Uint8Array | null;
    try {
      bytes = await root.read(kind, pkg, relPath);
    } catch {
      continue; // unreadable at this root — try the next
    }
    if (!bytes) continue;
    // Present but unparseable is a real error, not a miss: silently skipping it would strand a user
    // with a typo'd override and no explanation.
    try {
      found.push({ rank, id: root.id, value: JSON.parse(_decoder.decode(bytes)) as T });
    } catch (error: any) {
      throw new Error(
        `resource '${kind}/${pkg}/${relPath}' at '${describe(root, kind, pkg, relPath)}' `
        + `is not valid JSON: ${error?.message ?? error}`
      );
    }
  }
  return found;
}

/**
 * Read + parse EVERY hit for a resource, in root order (highest precedence first).
 *
 * Empty when nothing matched. Callers that layer — a user root overriding part of a shipped catalog —
 * merge these; callers that want one value take the first.
 */
export async function readAll<T = unknown>(
  roots: ResourceRoot[],
  kind: string,
  pkg: string,
  relPath: string
): Promise<T[]> {
  return (await readAllTagged<T>(roots, kind, pkg, relPath)).map((h) => h.value);
}

/** Read + parse the highest-precedence hit. Throws with every location tried when nothing matched. */
export async function read<T = unknown>(
  roots: ResourceRoot[],
  kind: string,
  pkg: string,
  relPath: string
): Promise<T> {
  const found = await readAll<T>(roots, kind, pkg, relPath);
  if (found.length > 0) return found[0];
  const tried = roots.map((r) => describe(r, kind, pkg, relPath));
  throw new Error(
    `resource '${kind}/${pkg}/${relPath}' not found. Looked in:\n  ${tried.join('\n  ')}`
    + (tried.length === 0
      ? '\n  (no resource roots configured — set SHEETXL_RESOURCE_PATH or call addResourceRoot)'
      : '')
  );
}

/**
 * Describe a package's resources of one kind, from every root that has them (highest first).
 *
 * Each root is asked for its generated `contents.json` — the only source of metadata, and the only
 * mechanism a served root has at all. A root that lacks one but CAN enumerate is scanned instead,
 * which is what keeps a hand-dropped `~/.sheetxl/fonts/…` working with no build step.
 */
export async function list(
  roots: ResourceRoot[],
  kind: string,
  pkg: string
): Promise<ResourceIndex[]> {
  const found: ResourceIndex[] = [];
  for (const root of roots) {
    // An authoritative root listing settles both questions up front: whether this root holds
    // anything for the package at all, and whether a generated `contents.json` is among it — so a
    // root that has neither costs no request. `null` (no listing) probes, as it always did.
    const contributes = root.has ? await root.has(kind, pkg) : null;
    if (contributes === false) continue;
    const indexed = root.has ? await root.has(kind, pkg, CONTENTS_FILE) : null;
    if (indexed !== false) {
      try {
        const bytes = await root.read(kind, pkg, CONTENTS_FILE);
        if (bytes) {
          found.push(JSON.parse(_decoder.decode(bytes)) as ResourceIndex);
          continue;
        }
      } catch {
        /* no contents file here — fall through to a scan */
      }
    }
    if (!root.list) continue; // cannot enumerate (a served root) and has no listing: contributes nothing
    try {
      const files = (await root.list(kind, pkg))?.filter((f) => f !== CONTENTS_FILE);
      if (files?.length) found.push({ kind, package: pkg, entries: files.map((p) => ({ path: p })) });
    } catch {
      /* absent directory — this root simply does not contribute */
    }
  }
  return found;
}
