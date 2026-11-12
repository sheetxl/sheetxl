/**
 * The shared boundary for fetching versioned locale **resource files** — command catalogs today, SDK
 * spreadsheet-language strings (function names / errors / help) next (I18N-DESIGN.md Plane 3). Both need
 * the same thing: locale data shipped as separate JSON assets, loaded at runtime (out of the code
 * bundle, user-overridable).
 *
 * Locales are one *kind* of resource; the mechanism underneath (`@sheetxl/utils/resource`) is
 * kind-agnostic and fonts will use it next. See that module for the full resolution order — briefly:
 * user resource ROOTS (`SHEETXL_RESOURCE_PATH`, `~/.sheetxl`, {@link addResourceRoot}) first, then the
 * host-configured base ({@link setLocaleResourceBase}), then — node only — the package's own
 * `locales/` located from `import.meta.url`.
 *
 * In the browser there is no implicit location: with no root and no base, nothing is fetched and each
 * package renders its bundled default language. A root may be added at any time — packages that
 * already registered re-discover their locales (see {@link onResourceRootsChange}).
 *
 * **Where the bytes come from is platform-conditional**: an HTTP fetch in the browser, a disk read in
 * node (the CLI and the MCP server are real clients). With the English literals gone from source, a
 * package that cannot load its catalog renders raw KEYS.
 *
 * Framework-free so the SDK and the React command system share one mechanism.
 *
 * URL shape (browser, via the base): `<base><pkg>/<relPath>`, e.g.
 * `/resources/locales/@sheetxl/sdk/de/model.msg.json`.
 */
// Self-referencing conditional subpath — the node/browser twin is picked by the resolving
// environment, and this package's own node and browser builds each inline the one they resolved.
// Same seam `@sheetxl/sdk` uses for `./lib/file`, `./lib/utils`, `./font/FontMeasurer` and
// `./scripting/enumManifest`: internal to the package, never published, never imported across one.
import {
  loadResource, loadResourceAll, loadResourceAllTagged, listResources,
  addResourceRoot as _addResourceRoot
} from '@sheetxl/utils/resource';

import { type RemoveListener } from '../types';
import { type ResourceIndex, type ResourceEntry, type ResourceRoot } from '../resource/Types';

/** The resource namespace locale files live under, in every root and every package. */
const LOCALE_KIND = 'locales';

/** `null` = never configured — which is what lets node fall through to per-package resolution. */
let _base: string | null = null;

const _rootsListeners = new Set<() => void>();

function _notifyRootsChanged(): void {
  for (const listener of [..._rootsListeners]) listener();
}

/**
 * Add a resource ROOT, searched ahead of anything the packages ship.
 *
 * In the browser this is required to load anything beyond the bundled default language — there is
 * no implicit root. An app that stages resources with `ResourcesPlugin` (or `stageResources`) serves
 * them at `/resources`, so it calls `addResourceRoot('/resources')`.
 *
 * May be called before or after packages load; already-registered packages re-discover their locales.
 *
 * @param root a URL prefix (browser) or directory (node) laid out as `<root>/<kind>/<pkg>/<relPath>`,
 *             or a custom {@link ResourceRoot}.
 */
export function addResourceRoot(root: string | ResourceRoot): void {
  // Re-declared here rather than re-exported straight from the seam, because a
  // `export { x } from '@sheetxl/utils/resource'` survives type emit into `LocaleResource.d.ts` — and
  // that subpath does not exist in the published `package.json`, so every consumer of this package's
  // types got TS2307. Note sdk gets away with the same seam only because it never re-exports a symbol
  // out of one; keep it that way here.
  _addResourceRoot(root);
  _notifyRootsChanged();
}

/**
 * Set the base under which package locale resources are served.
 *
 * In the browser this is a URL prefix, e.g. `'/resources/locales/'`. In node it is a DIRECTORY.
 * Unlike a resource ROOT it names the kind itself, so it holds `<pkg>/<relPath>` directly with no
 * `locales/` segment — leave it unset in node unless the host stages the files that way.
 */
export function setLocaleResourceBase(url: string): void {
  const next = url.endsWith('/') ? url : `${url}/`;
  if (next === _base) return;
  _base = next;
  _notifyRootsChanged();
}

/** The configured base, or `null` when none has been set. */
export function getLocaleResourceBase(): string | null {
  return _base;
}

/**
 * Resolve a locale resource URL: `<base><pkg>/<relPath>`, or `null` when no base is configured.
 *
 * Browser-shaped, and only describes the BASE — it does not account for resource roots, which may
 * outrank it. Use {@link fetchLocaleResource} to actually load.
 *
 * @param pkg     the owning package id, e.g. `'@sheetxl/react'`
 * @param relPath the path within that package's `locales/`, e.g. `'de/model.msg.json'` or `'inherit.json'`
 */
export function resolveLocaleResource(pkg: string, relPath: string): string | null {
  return _base ? `${_base}${pkg}/${relPath}` : null;
}

/**
 * Listen for the set of places resources are loaded from changing — a root added or the base set.
 *
 * Locale discovery subscribes to this so a root added after a package registered still contributes.
 */
export function onResourceRootsChange(listener: () => void): RemoveListener {
  _rootsListeners.add(listener);
  return () => { _rootsListeners.delete(listener); };
}

/**
 * Load + parse the highest-precedence copy of a locale resource. Throws when nothing is found.
 *
 * @param fromUrl `import.meta.url` of a module inside `pkg`. Ignored in the browser; in node it is the
 *                last-resort way the package locates its own `locales/` (see `#resource`).
 */
export function fetchLocaleResource<T = unknown>(
  pkg: string,
  relPath: string,
  fromUrl?: string
): Promise<T> {
  return loadResource<T>(LOCALE_KIND, pkg, relPath, _base, fromUrl);
}

/**
 * Load + parse EVERY copy of a locale resource, highest precedence first (empty when none exist).
 *
 * This is what makes a user-installed pack ADDITIVE rather than all-or-nothing: manifests are unioned
 * across roots so a root can contribute a locale we don't ship, and message files are merged so a root
 * can override a handful of keys without restating the catalog.
 */
export function fetchLocaleResourceAll<T = unknown>(
  pkg: string,
  relPath: string,
  fromUrl?: string
): Promise<T[]> {
  return loadResourceAll<T>(LOCALE_KIND, pkg, relPath, _base, fromUrl);
}

/**
 * Merge several message files for one locale, with **root precedence dominating file order**.
 *
 * Both axes matter and they are not interchangeable: a locale may be split across `errors.msg.json`
 * and `ui.msg.json` (file axis), and every one of those may also exist at several roots (root axis).
 * Sorting by filename alone would let a package's `model.msg.json` beat a user's `fr.msg.json` purely
 * because `m` > `f` — so roots are applied outermost, lowest precedence first, and files merge within
 * a root.
 */
export async function mergeMessageFiles<T extends object>(
  pkg: string,
  tag: string,
  files: string[],
  fromUrl?: string
): Promise<T> {
  const hits = (await Promise.all(
    files.map((file) => loadResourceAllTagged<T>(LOCALE_KIND, pkg, `${tag}/${file}`, _base, fromUrl)
      .then((found) => found.map((hit) => ({ ...hit, file }))))
  )).flat();

  // rank 0 is the highest-precedence root, and `Object.assign` lets the LAST write win — so descend.
  hits.sort((a, b) => (b.rank - a.rank) || a.file.localeCompare(b.file));
  return Object.assign({}, ...hits.map((h) => h.value)) as T;
}

/** What a package's `contents.json` records about one of its locales (`meta.locales[tag]`). */
export interface LocaleIndexEntry {
  tag: string;
  /**
   * Locales to fall back through, in order, when this one lacks a key. Declared by the package that
   * ships the locale and resolved at LOAD time — see {@link resolveLocaleChain}.
   */
  inherit?: string[];
  /** Message-catalog file names for this locale. Several `*.msg.json` may split one package's text. */
  messages?: string[];
  catalogs?: { file: string; scope: string; sourceId: string }[];
}

/**
 * Every resource root's index for a package's locales, highest precedence first.
 *
 * The index subsumes the older `manifest.json` pair (package index + per-locale manifest) into one
 * file; callers fall back to those when a root predates it or a user hand-dropped a folder.
 */
export function listLocaleResources(pkg: string, fromUrl?: string): Promise<ResourceIndex[]> {
  return listResources(LOCALE_KIND, pkg, _base, fromUrl);
}

/**
 * Endings this layer recognizes when a root has no generated listing to describe itself.
 *
 * A built listing carries `role` per entry and these are not consulted; they exist so a folder a user
 * assembled by hand still works. The FORMATS are owned elsewhere (`@sheetxl/sdk` declares `.msg.json`,
 * `@sheetxl/utils-react` declares `.cmd.json`) — this is only a naming fallback, not a second
 * definition of what those files are.
 */
const MESSAGE_SUFFIX = '.msg.json';
const CATALOG_SUFFIX = '.cmd.json';

/** The optional authored file declaring a locale's fallback chain. */
const INHERIT_FILE = 'inherit.json';

/**
 * Group one root's entries into locales — the ONLY place that grouping happens.
 *
 * The build used to produce this shape too, as `meta.locales` in `contents.json`, and this ran only
 * when that was absent. Two implementations of one grouping had to agree forever; deleting the
 * build-side one is the same call as deleting the duplicate manifests.
 *
 * Entries produced by a build already carry `locale` / `role` / `scope` / `sourceId`, because reading
 * a catalog's `scope` means opening it and a browser must not open N files to find out what it has.
 * Entries from a bare directory scan (a folder a user assembled, where nothing generated a listing)
 * carry only `path`, so the same conventions are applied by name — and a `.cmd.json` is opened, which
 * is exactly the cost the listing exists to avoid.
 *
 * `inherit` is the one thing no scan can infer (it is knowledge, not structure), so it is declared in
 * `inherit.json` by hand-made roots and packages alike.
 */
async function _localesFromEntries(
  pkg: string,
  entries: ResourceEntry[],
  fromUrl?: string
): Promise<Record<string, LocaleIndexEntry>> {
  // `inherit.json` is optional and most packages have none. The listing already says whether it is
  // there, so do not go asking — a miss costs a request per package per load, and on a single-page
  // host a miss is answered with the app shell rather than a 404.
  const declaresInherit = entries.length === 0
    || entries.some((entry) => entry.path === INHERIT_FILE);
  const inherit = declaresInherit
    ? (await loadResourceAll<Record<string, string[]>>(
        LOCALE_KIND, pkg, INHERIT_FILE, _base, fromUrl
      ))[0] ?? {}
    : {};

  const locales: Record<string, LocaleIndexEntry> = {};
  const entryFor = (tag: string): LocaleIndexEntry => (locales[tag] ??= {
    tag, ...(inherit[tag]?.length ? { inherit: inherit[tag] } : {})
  });

  await Promise.all(entries.map(async (entry) => {
    const parts = entry.path.split('/');
    if (parts.length !== 2) return; // locale files live exactly one level down
    const [pathTag, name] = parts;
    const tag = (entry.locale as string | undefined) ?? pathTag;

    if (entry.role === 'messages' || name.endsWith(MESSAGE_SUFFIX)) {
      (entryFor(tag).messages ??= []).push(name);
      return;
    }
    if (entry.role !== 'catalog' && !name.endsWith(CATALOG_SUFFIX)) return;
    // A build extracted `scope` already; an unindexed folder has not, so open the file.
    const scope = (entry.scope as string | undefined)
      ?? (await loadResourceAll<{ scope?: string }>(LOCALE_KIND, pkg, entry.path, _base, fromUrl))[0]?.scope;
    if (!scope) return;
    (entryFor(tag).catalogs ??= []).push({
      file: name,
      scope,
      sourceId: (entry.sourceId as string | undefined) ?? name.replace(/\.cmd\.json$/, '')
    });
  }));
  // Deterministic: several message files merge, and the order must not depend on readdir.
  for (const rec of Object.values(locales)) {
    rec.messages?.sort();
    rec.catalogs?.sort((a, b) => a.file.localeCompare(b.file));
  }
  for (const tag of Object.keys(inherit)) entryFor(tag);
  return locales;
}

/**
 * Every locale a package offers, unioned across all resource roots.
 *
 * Each root is listed (from its generated `contents.json`, or by scanning when it has none) and its
 * entries grouped into locales here.
 *
 * Union, never first-wins: a user root contributing `fr` must ADD it rather than replace the shipped
 * set, and a root overriding one field of `de` must not drop the rest.
 */
export async function loadPackageLocales(
  pkg: string,
  fromUrl?: string
): Promise<Record<string, LocaleIndexEntry>> {
  const merged: Record<string, LocaleIndexEntry> = {};
  /**
   * Lowest precedence first, so a higher root wins the scalar fields (`inherit`).
   *
   * The FILE LISTS are unioned, not replaced: each root contributes whatever catalogs it holds, and
   * every listed file is then resolved across all roots by `fetchLocaleResourceAll`. Replacing them
   * would mean a user root adding one `fr.msg.json` HIDES the package's own catalogs — which is the
   * opposite of the additive contract, and was masked while every package used the same filename.
   */
  const apply = (locales: Record<string, LocaleIndexEntry | undefined>): void => {
    for (const [tag, entry] of Object.entries(locales)) {
      if (!entry) continue;
      const prior = merged[tag];
      // A hand-written listing may name a single catalog as a bare string.
      const incoming = typeof entry.messages === 'string' ? [entry.messages] : entry.messages;
      const messages = [...new Set([...(prior?.messages ?? []), ...(incoming ?? [])])].sort();
      const catalogs = [...(prior?.catalogs ?? []), ...(entry.catalogs ?? [])];
      const byId = new Map(catalogs.map((c) => [`${c.scope}\0${c.sourceId}`, c]));
      merged[tag] = {
        ...prior, ...entry, tag,
        ...(messages.length ? { messages } : {}),
        ...(byId.size ? { catalogs: [...byId.values()] } : {})
      };
    }
  };

  const listings = await listLocaleResources(pkg, fromUrl);
  for (const listing of [...listings].reverse()) {
    apply(await _localesFromEntries(pkg, listing.entries ?? [], fromUrl));
  }
  return merged;
}

/**
 * Flatten a locale's declared `inherit` into a concrete lookup order, most-specific first.
 *
 * Two rules, in this order:
 *  1. the locale itself, then anything it explicitly declares (`nn` → `nb`), transitively;
 *  2. BCP-47 truncation (`de-AT` → `de`), applied to each — mechanical, so never declared.
 *
 * There is deliberately **no implicit English tail**. English is a language, not a fallback: a
 * Japanese user seeing scattered English is worse served than one seeing an untranslated key, and a
 * package that genuinely wants English last can just declare it.
 */
export function resolveLocaleChain(
  tag: string,
  locales: Record<string, LocaleIndexEntry | undefined>
): string[] {
  const chain: string[] = [];
  const visit = (t: string): void => {
    if (!t || chain.includes(t)) return;
    chain.push(t);
    for (const next of locales[t]?.inherit ?? []) visit(next);
    const dash = t.indexOf('-');
    if (dash > 0) visit(t.slice(0, dash));
  };
  visit(tag);
  return chain;
}
