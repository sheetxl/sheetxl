/**
 * Building a resource directory's `contents.json` — the write side of the resource system.
 *
 * **Machinery only.** This module knows how to register kinds, scan a directory, ask each file what
 * it is, and write the listing. It knows nothing about locales, fonts, or commands: every kind is
 * declared by the package that OWNS that format (`@sheetxl/sdk` for locales and fonts,
 * `@sheetxl/utils-react` for command catalogs) and registered by whoever is doing the building.
 *
 * ## Kinds contain file types
 *
 * A **kind** is the namespace — the `<kind>` directory segment, the axis the runtime resolves on
 * (`loadResource(kind, pkg, relPath)`), the thing `~/.sheetxl/resources/<kind>/` is keyed by. A
 * **file type** is how to interpret one file inside a kind. Registration makes that containment
 * explicit, so a file type carries no `kind` field and a typo cannot invent a namespace nobody serves.
 *
 * ## No rollup
 *
 * `contents.json` is a `readdir` with metadata attached: it names EVERY file present, and only files
 * present. A file type that cannot interpret one of them adds no metadata, but never removes it from
 * the listing — a directory does not hide entries it cannot read, and a listing that omits a real
 * file is invisible to every consumer that trusts it.
 *
 * Each entry carries whatever its file type could say about it.
 * There is deliberately no assembled `meta`: the consumer that understands a kind groups the entries
 * itself, and it already had to — `LocaleResource` grouped them for directories with no listing at
 * all. Producing that shape here as well would mean two implementations of one grouping, free to
 * disagree, which is the exact failure that the duplicate locale manifests and the in-source
 * `contents.json` both were.
 *
 * What legitimately stays here is per-file `extract`: reading a catalog's `scope` means opening the
 * file, and a browser must not open N files to discover what it has. That is why this listing exists.
 *
 * **Node-only, and deliberately not published.** Scanning a directory and writing a file are node
 * operations, so the browser twin throws (see `builder.browser.ts`). This is build machinery, not
 * product API: it is absent from `@sheetxl/utils`'s single published entry point, and the two hosts
 * that need it — the build (`config/resources.ts`) and the CLI's `sheetxl resources` command — reach
 * it by relative source path and bundle it.
 *
 * Node built-ins load through {@link _builtin}, whose specifier is a VARIABLE, for the same reason as
 * `resource.node.ts`: a literal makes TypeScript demand `@types/node` (which resolves in some packages
 * of this monorepo and not others) and makes a browser bundler try to follow it.
 */
import {
  type ResourceEntry, type ResourceIndex, type ResourceRootIndex,
  type ResourceFileContext, type ResourceFileType, type ResourceKindDefinition
} from '../Types';
import { CONTENTS_FILE, rootIndexFromPaths } from '../Resource';

const _builtin = (name: string): Promise<any> =>
  import(/* @vite-ignore */ /* webpackIgnore: true */ name);

/**
 * The directory resources live under when the container holds non-resource content too.
 *
 * NOT exported from `@sheetxl/utils` — this is the layout's own business. A host that needs to compose
 * such a path asks {@link resourceRootIn} for it, so the segment stays one string in one place.
 */
export const RESOURCE_DIR = 'resources';

/**
 * The resource ROOT inside a container that holds non-resource content too — `~/.sheetxl` becomes
 * `~/.sheetxl/resources`, an app's output dir becomes `<out>/resources`.
 *
 * Separators are left to the caller to normalize (`path.normalize`), so this stays a pure string
 * function usable on either platform.
 */
export function resourceRootIn(baseDir: string): string {
  return `${baseDir.replace(/[/\\]+$/, '')}/${RESOURCE_DIR}`;
}

/** Whether a file name is a generated listing — the one file a resource directory owns about itself. */
export function isResourceIndex(fileName: string): boolean {
  return fileName === CONTENTS_FILE;
}

/** kind → its file types. */
const _kinds = new Map<string, ResourceFileType[]>();
/** Every file type with the kind it belongs to, longest suffix first. */
let _bySuffix: { kind: string; type: ResourceFileType }[] = [];

function _reindex(): void {
  _bySuffix = [...(_kinds.entries())]
    .flatMap(([kind, types]) => types.map((type) => ({ kind, type })))
    .sort((a, b) => b.type.suffix.length - a.type.suffix.length);
}

/** Declare a kind. Idempotent — a kind may be declared before any file type is added to it. */
export function registerResourceKind(kind: string): void {
  if (!_kinds.has(kind)) _kinds.set(kind, []);
}

/** Add a file type to a kind. Re-registering the same suffix within that kind replaces it. */
export function registerResourceFileType(kind: string, type: ResourceFileType): void {
  registerResourceKind(kind);
  const types = _kinds.get(kind)!;
  const at = types.findIndex((t) => t.suffix === type.suffix);
  if (at >= 0) types[at] = type; else types.push(type);
  _reindex();
}

/** Apply a package's declarative bundle. */
export function registerResourceKinds(definitions: readonly ResourceKindDefinition[]): void {
  for (const { kind, files } of definitions) {
    registerResourceKind(kind);
    for (const type of files ?? []) registerResourceFileType(kind, type);
  }
}

/** Every registered kind. */
export function resourceKinds(): string[] {
  return [..._kinds.keys()];
}

/** The kind + file type for a file name, or `null` when the ending is unrecognized. */
export function resourceFileType(fileName: string): { kind: string; type: ResourceFileType } | null {
  const lower = fileName.toLowerCase();
  return _bySuffix.find((e) => lower.endsWith(e.type.suffix)) ?? null;
}

// ---------------------------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------------------------

/** Every file under `dir`, relative to it (recursive). */
export async function walkResourceFiles(dir: string, rel = ''): Promise<string[]> {
  const fs = await _builtin('node:fs/promises');
  const path = await _builtin('node:path');
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await walkResourceFiles(path.join(dir, entry.name), r));
    else out.push(r);
  }
  return out;
}

/**
 * Build the listing for one resource directory: scan, then let each file describe itself.
 *
 * A pure function of the directory, so the SAME call serves a package build, an app staging step, and
 * the CLI pointed at a user's own folder.
 */
export async function buildResourceIndex(
  kind: string,
  pkgName: string,
  dir: string
): Promise<ResourceIndex> {
  const fs = await _builtin('node:fs/promises');
  const path = await _builtin('node:path');

  // The listing itself is the ONE deliberate exclusion — a listing does not list itself, and it is
  // regenerated rather than copied.
  const files = (await walkResourceFiles(dir)).filter((f) => f !== CONTENTS_FILE);

  const entries: ResourceEntry[] = [];
  for (const relPath of files) {
    const fileName = relPath.split('/').pop()!;
    const extract = resourceFileType(fileName)?.type.extract;
    // EVERY file lands in the listing. An extractor returning `null` means "I have nothing to say
    // about this", never "pretend it is not there" — the same as an ending nothing recognizes.
    //
    // This is a `readdir` with metadata attached, and a directory does not hide entries it cannot
    // interpret. Dropping them would make the listing lie in the one direction that costs most:
    // a consumer walking it would copy an incomplete tree, and a file present on disk but absent
    // from the listing is invisible to every reader that trusts the listing.
    const fields = extract
      ? await extract({
          relPath,
          fileName,
          readJson: async () => JSON.parse(await fs.readFile(path.join(dir, relPath), 'utf8')),
          readBytes: () => fs.readFile(path.join(dir, relPath))
        })
      : null;
    entries.push({ path: relPath, ...(fields ?? {}) });
  }

  return { kind, package: pkgName, entries };
}

/** Build the listing for `dir` and write it to `<dir>/contents.json`. */
export async function writeResourceIndex(
  kind: string,
  pkgName: string,
  dir: string
): Promise<ResourceIndex> {
  const fs = await _builtin('node:fs/promises');
  const path = await _builtin('node:path');
  const index = await buildResourceIndex(kind, pkgName, dir);
  await fs.writeFile(path.join(dir, CONTENTS_FILE), `${JSON.stringify(index, null, 2)}\n`);
  return index;
}

// ---------------------------------------------------------------------------------------------
// The ROOT listing — `<root>/contents.json`
// ---------------------------------------------------------------------------------------------

/**
 * Build the authoritative listing of an entire resource ROOT: every file and folder under `dir`.
 *
 * This is what lets a browser resolve with zero misses — one fetch of this file says exactly which
 * packages and files the root holds, so nothing absent is ever requested. It names the per-package
 * `contents.json` files too (they are files the root contains); the only exclusion is itself.
 */
export async function buildRootIndex(dir: string): Promise<ResourceRootIndex> {
  const files = (await walkResourceFiles(dir)).filter((f) => f !== CONTENTS_FILE);
  return rootIndexFromPaths(files);
}

/**
 * Build the root listing for `dir` and write it to `<dir>/contents.json`.
 *
 * A scan of the real directory, deliberately — run AFTER staging, it cannot disagree with what was
 * actually staged, which is the parity a generated listing owes its consumers.
 */
export async function writeRootIndex(dir: string): Promise<ResourceRootIndex> {
  const fs = await _builtin('node:fs/promises');
  const path = await _builtin('node:path');
  const index = await buildRootIndex(dir);
  await fs.writeFile(path.join(dir, CONTENTS_FILE), `${JSON.stringify(index, null, 2)}\n`);
  return index;
}

// ---------------------------------------------------------------------------------------------
// Classification + placement (the CLI's half of the same registry)
// ---------------------------------------------------------------------------------------------

/** Which kind a loose file belongs to, or `null` when the ending is unrecognized. */
export function classifyResource(fileName: string): string | null {
  return resourceFileType(fileName)?.kind ?? null;
}

/** Where a classified file goes within `<kind>/<pkg>/`, or `null` when more input is needed. */
export function placeResource(fileName: string, location: string | undefined): string | null {
  const match = resourceFileType(fileName);
  return match?.type.place?.(fileName, location) ?? null;
}

export { CONTENTS_FILE, rootIndexFromPaths };
export type {
  ResourceEntry, ResourceIndex, ResourceRootIndex,
  ResourceFileContext, ResourceFileType, ResourceKindDefinition
} from '../Types';

// Staging installed packages' resources into one served tree — the framework-agnostic core a non-Vite
// consumer (esbuild, webpack, a VSCode extension packaging step) uses in place of `ResourcesPlugin`.
export { stageResources, type StageResourcesOptions, type StageResourcesResult } from './stage.node';
