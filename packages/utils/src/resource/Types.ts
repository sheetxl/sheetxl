/**
 * The shape of a resource `contents.json` and of a resource root — shared by the node and browser
 * resolvers, and produced by the build (`lib/builder.node.ts`).
 *
 * Type-only, so importing it costs nothing at runtime on either platform.
 */

// ---------------------------------------------------------------------------------------------
// Declaring a kind — the shapes a package exports to describe a format it OWNS
// ---------------------------------------------------------------------------------------------

/** What a per-file extractor is handed. Readers are lazy so a snippet pays only for what it opens. */
export interface ResourceFileContext {
  /** Path relative to the `<kind>/<pkg>/` root, e.g. `de/sheet.msg.json`. */
  relPath: string;
  /** Just the file name, e.g. `sheet.msg.json`. */
  fileName: string;
  readJson(): Promise<any>;
  readBytes(): Promise<Uint8Array>;
}

/**
 * One recognized file ending within a kind.
 *
 * No `kind` field: a file type is registered INTO a kind, which is what makes the containment real
 * rather than a string that has to match something.
 */
export interface ResourceFileType {
  /** The ending to match, e.g. `.msg.json`. Longest match wins across all kinds. */
  suffix: string;
  /**
   * This file's contribution to its `contents.json` entry, or `null` for "nothing to say".
   *
   * `null` does NOT omit the file — the listing always names every file present.
   */
  extract?(ctx: ResourceFileContext): Promise<Record<string, unknown> | null>;
  /**
   * Where the file goes within `<kind>/<pkg>/`, given the caller-supplied location remainder.
   * `null` means it cannot be determined and the caller must supply more.
   */
  place?(fileName: string, location: string | undefined): string | null;
}

/**
 * A kind and the file types it contains — the declarative form a package exports so a host can
 * register it without importing anything at runtime.
 *
 * Lives HERE, with the other type-only shapes, rather than beside the registry that consumes it. A
 * package that owns a format (`@sheetxl/sdk` for locales and fonts, `@sheetxl/utils-react` for
 * command catalogs) declares one of these and should not have to name a node-only build module to do
 * it — that import would survive into its published `.d.ts` and point at something a consumer
 * installing from npm cannot resolve.
 */
export interface ResourceKindDefinition {
  kind: string;
  files?: ResourceFileType[];
}

/** One file in a resource directory, plus whatever the kind's build extractor knew about it. */
export interface ResourceEntry {
  /** Path relative to the `<kind>/<pkg>/` root. The ONLY field the resolver itself understands. */
  path: string;
  [key: string]: unknown;
}

/**
 * A directory listing with meaning attached.
 *
 * Exists because **the browser cannot enumerate a directory** — discovery ("what fonts are here?")
 * has to be a file there. `entries` is the listing; `meta` is kind-shaped data (a locale's inherit
 * chain, a font's family) that only the consuming layer interprets.
 */
export interface ResourceIndex {
  kind: string;
  package: string;
  entries: ResourceEntry[];
  meta?: Record<string, unknown>;
}

/**
 * The generated listing at the TOP of a resource root (`<root>/contents.json`) — the authoritative
 * statement of what the root contains: every file and every folder under it, no more, no less.
 * (The one exception is itself: a listing does not list itself.)
 *
 * This is what makes a miss impossible by construction for a served root: one fetch of this file and
 * the resolver knows exactly which packages and files the root holds, so it never has to ask for a
 * file that is not there. A root without one (a hand-assembled folder) still works — the resolver
 * falls back to probing.
 */
export interface ResourceRootIndex {
  /** Every file under the root, `path` relative to it (e.g. `locales/@sheetxl/sdk/de/ui.msg.json`). */
  entries: ResourceEntry[];
  /** Every directory under the root, relative to it (e.g. `locales/@sheetxl/sdk`). */
  folders: string[];
}

/**
 * One place resources can come from — a directory, a served URL prefix, and (later) a zip, an OPFS
 * handle, an extension host, or an in-memory map in a test.
 *
 * Roots take the ADDRESS (`kind`, `pkg`, `relPath`) rather than a joined path, so layout is the
 * root's own business: a directory root resolves `<dir>/<kind>/<pkg>/<relPath>`, a package
 * self-location root `<pkgRoot>/<kind>/<relPath>`, a legacy base root `<base>/<pkg>/<relPath>`. That
 * is what lets the resolver stay a plain ordered search with no per-root special cases.
 *
 * This is NOT a filesystem and should not grow into one — no write, stat, or watch. It is the
 * provider half of a search path (`PATH`, classpath, `XDG_DATA_DIRS`); domain-level merging of what
 * it returns happens above it.
 */
export interface ResourceRoot {
  /** Human-readable identity, used to build resolution-failure messages. */
  readonly id: string;
  /** The bytes at this address, or `null` when this root does not have them. */
  read(kind: string, pkg: string, relPath: string): Promise<Uint8Array | null>;
  /**
   * Whether this root holds `relPath` under `<kind>/<pkg>/` — or, with no `relPath`, whether it
   * holds anything for that package at all.
   *
   * Tri-state, and the middle matters: `false` is AUTHORITATIVE absence (backed by the root-level
   * {@link ResourceRootIndex}), so the caller skips the read entirely — that is what makes a miss
   * impossible by construction. `null` means this root cannot say (it has no generated listing) and
   * the caller must probe {@link read} as it always did. Roots with no listing simply omit this.
   *
   * Must not throw: an unreachable or unparseable listing is `null`, never an error — the listing is
   * discovery, and absent discovery has a correct fallback (probing) where a broken FILE does not.
   */
  has?(kind: string, pkg: string, relPath?: string): Promise<boolean | null>;
  /**
   * Paths under `<kind>/<pkg>/`, relative to it, or `null` when unknown.
   *
   * **Optional on purpose**: a served root cannot enumerate a directory over HTTP unless its
   * root-level `contents.json` describes it, and its absence here is exactly that fact stated in the
   * type. Roots that CAN enumerate (a real directory) let a hand-assembled folder work with no build
   * step.
   */
  list?(kind: string, pkg: string): Promise<string[] | null>;
  /** Where this root would look — for diagnostics only. Defaults to `<id>/<kind>/<pkg>/<relPath>`. */
  describe?(kind: string, pkg: string, relPath: string): string;
}
