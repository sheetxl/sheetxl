import {
  type LanguageTag, type RemoveListener, type MessageCatalog,
  DefaultLanguagePackService, fetchLocaleResourceAll, loadPackageLocales, resolveLocaleChain,
  mergeMessageFiles, onResourceRootsChange
} from '@sheetxl/utils';

import {
  type CommandCatalog, type CommandCatalogModule, type CommandCatalogLoader, type ChromeRecord,
  chromeToPartial, asCommandCatalog
} from './CommandCatalog';
import { type StaticCommandContributor } from './CommandScopeContext';
import { DefaultCommandRegistry, type CommandRegistry } from './CommandRegistry';

/** Options for {@link CommandCatalogService.register}. */
export interface RegisterCatalogOptions {
  /**
   * Distinguishes catalogs that OWN the **same** scope (e.g. react `clipboard` and studio `studio`
   * both own `'app'`). Each source gets its own registry layer. Defaults to the `scope`.
   */
  sourceId?: string;
}

/**
 * A package's **bundled default-language** locale slices — statically imported (so the bundler inlines
 * them) and registered as the eager, lowest-precedence floor. This is what lets a plain `npm install`
 * render command chrome and dialog text correctly with NOTHING served. Both planes ride together
 * because one manifest owns both; see {@link CommandCatalogService.registerFromManifest}.
 */
export interface BundledLocaleDefaults {
  /** The package's `t()` call-site strings for the default language (its merged `en/*.msg.json`). */
  messages?: MessageCatalog;
  /** The package's command catalogs for the default language (one per `en/*.cmd.json`). */
  catalogs?: { sourceId: string; catalog: CommandCatalog }[];
}

/**
 * Marks the eager bundled-`en` copy of a source as a SEPARATE, lowest-precedence source so it coexists
 * with — rather than being replaced by — the same package's fetched/override catalog. Registered first
 * (eagerly, at import) it seeds the least-specific registry layer; a fetched override or plugin catalog,
 * seeded later, pushes a more-specific layer and wins per command. The `\0` cannot collide with a real
 * `sourceId`.
 */
const DEFAULT_SOURCE_SUFFIX = '\0default';

/** One `(tag)` slice of a source: an eager catalog or a lazy loader. */
interface CatalogRec {
  catalog?: CommandCatalog;
  loader?: CommandCatalogLoader;
  loading?: Promise<void>;
}

/**
 * A registered catalog **source** — one owning scope's file. Holds a per-language map of slices
 * (each a COMPLETE pack) and a per-target STABLE {@link StaticCommandContributor} (owner scope +
 * any `borrow` targets), whose identity is reused across language switches so a re-seed *replaces*
 * the layer (idempotent) rather than stacking.
 */
interface CatalogSource {
  scope: string;
  sourceId: string;
  byTag: Map<LanguageTag, CatalogRec>;
  /** targetScope → stable contributor that seeds this source's commands belonging to that scope. */
  contributors: Map<string, StaticCommandContributor>;
}

/**
 * The module-init service that owns command **chrome**, structured per `(scope, language)`
 * (I18N-DESIGN.md decision 8). Mirrors `DynamicIconService` / `LanguagePackService`.
 *
 * **Loading model (VSCode-like, one complete pack):** each locale catalog is a self-contained,
 * COMPLETE pack (a build step copies untranslated fields from the default — decision #1), fetched at
 * runtime as a data file (not `import`-inlined, so command strings stay out of the code bundle). The
 * service seeds the **active locale's** pack into a {@link CommandRegistry} via `registerStatic(scope, …)`
 * — the default `en` pack only when that locale isn't registered. There is **no runtime `en ⊕ locale`
 * merge and no fallback layer**: a German session loads German, not English. A command can be BORROWED
 * into other scopes ({@link ChromeRecord.borrow}). On a language switch (observed through
 * `DefaultLanguagePackService`) it loads the new locale's packs and re-seeds, bumping the registry so
 * bound scopes re-resolve — command localization is single-mechanism (which pack is seeded), not a
 * translator overlay on the resolve path.
 */
export function createCommandCatalogService(registry: CommandRegistry = DefaultCommandRegistry) {
  const sources = new Map<string, CatalogSource>();
  /** scope → its localized display name (from the active/default catalog's `label`). */
  const scopeLabels = new Map<string, string>();
  const labelListeners = new Set<() => void>();
  /** In-flight `manifest.json` registrations — `prefetch` awaits these so the reveal-gate waits for
   *  every locale loader to be registered before it decides what to load. */
  const pendingManifests = new Set<Promise<void>>();
  /** Packages whose manifest is re-discovered when resource roots change. */
  const manifestPackages = new Set<string>();
  /** Piggybacks on the language service so there is one source of truth for "current language". */
  let activeTag: LanguageTag = DefaultLanguagePackService.getActive();

  const sourceKey = (scope: string, sourceId: string): string => `${scope} ${sourceId}`;

  /**
   * Collapse the same catalog file found at several resource roots into one, `layers[0]` (the
   * highest-precedence root) winning. Merged PER COMMAND, not per file, so a user root that supplies
   * two retitled commands keeps the rest of the shipped pack.
   */
  function mergeCatalogs(layers: CommandCatalog[]): CommandCatalog {
    if (layers.length === 1) return layers[0];
    if (layers.length === 0) throw new Error('catalog was not found in any resource root');
    const ordered = [...layers].reverse(); // lowest precedence first, so the highest overwrites
    const commands: CommandCatalog['commands'] = {};
    for (const layer of ordered) {
      for (const [key, rec] of Object.entries(layer.commands ?? {})) {
        commands[key] = { ...commands[key], ...rec };
      }
    }
    // Identity fields (`scope`/`tag`/`version`/`label`) from the highest layer; `commands` merged.
    return { ...Object.assign({}, ...ordered), commands };
  }

  function _catalogOf(m: CommandCatalogModule): CommandCatalog {
    return (m && typeof m === 'object' && 'default' in m ? (m as any).default : m) as CommandCatalog;
  }

  /** `'de-AT'` → `'de'`; `'de'` → `undefined`. Mechanical BCP-47 truncation, never a language choice. */
  function _baseOf(tag: LanguageTag): LanguageTag | undefined {
    const dash = tag.indexOf('-');
    return dash > 0 ? tag.slice(0, dash) : undefined;
  }

  /** The catalog for a source at a tag, if that slice is loaded. */
  function _catalogAt(source: CatalogSource, tag: LanguageTag): CommandCatalog | undefined {
    return source.byTag.get(tag)?.catalog;
  }
  /**
   * The active locale's records for a source, else its BASE tag (`de-AT` → `de`).
   *
   * There is deliberately no `?? en` tail. English is a language, not a fallback: silently backfilling
   * it makes a partial translation look finished, hides exactly the gaps a translator needs to see,
   * and serves a reader who may not know English worse than an untranslated key does. A locale that
   * genuinely wants English behind it declares `inherit: ["en"]`, which is resolved at load.
   */
  function _activeCatalog(source: CatalogSource): CommandCatalog | undefined {
    const base = _baseOf(activeTag);
    return _catalogAt(source, activeTag) ?? (base ? _catalogAt(source, base) : undefined);
  }

  /**
   * Seed (or re-seed) a source's layers for the current active language — its ONE complete pack across
   * the owner scope plus any `borrow` targets. Reuses per-target contributor identity → replaces the
   * layer (idempotent across language switches). Also updates the (localizable) scope display label.
   */
  function _seed(source: CatalogSource): void {
    const catalog = _activeCatalog(source);
    if (!catalog) {
      // No pack for the active language: CLEAR any layers this source seeded for a PRIOR language, so a
      // source that lacks the active language (notably a bundled-`en` floor when the session switches to
      // `de`) leaves no stale chrome behind — English is not a fallback. Without this, the earlier seed
      // would linger under the active language as a low-precedence layer and surface on any command the
      // active pack does not itself define.
      registry.batch(() => {
        for (const [target, contributor] of source.contributors) registry.removeContributor(target, contributor);
      });
      return;
    }

    // The scope's localized display name (from the file's `label`).
    if (catalog.label !== undefined && scopeLabels.get(source.scope) !== catalog.label) {
      scopeLabels.set(source.scope, catalog.label);
      for (const l of labelListeners) l();
    }

    // Every scope this source feeds: its owner + all `borrow` targets in the active pack.
    const targets = new Set<string>([source.scope]);
    for (const rec of Object.values(catalog.commands)) {
      for (const b of rec.borrow ?? []) targets.add(b);
    }

    // One batch for the whole seed: every target's registerStatic (itself batched) folds into a
    // single registry fan-out, so a pack seed wakes subscribers once — not once per command.
    registry.batch(() => {
      for (const target of targets) {
        let contributor = source.contributors.get(target);
        if (!contributor) {
          // Stable per (source, target); reads the current active pack and seeds the commands that
          // belong to `target` (the owner gets all; a borrow target gets only commands that list it).
          contributor = (regTarget) => {
            const active = _activeCatalog(source);
            if (!active) return;
            for (const [key, rec] of Object.entries(active.commands)) {
              const belongs = target === source.scope || (rec.borrow?.includes(target) ?? false);
              if (belongs) regTarget.updateCommand(key, chromeToPartial(rec));
            }
          };
          source.contributors.set(target, contributor);
        }
        registry.registerStatic(target, contributor);
      }
    });
  }

  async function _ensureLoaded(source: CatalogSource, tag: LanguageTag): Promise<void> {
    const rec = source.byTag.get(tag);
    if (!rec || rec.catalog) return;
    if (!rec.loading) {
      if (!rec.loader) return;
      rec.loading = rec.loader()
        .then((m) => { rec.catalog = _catalogOf(m); })
        .catch((err) => { rec.loading = undefined; throw err; });
    }
    await rec.loading;
  }

  /**
   * Register a catalog (or lazy fetch loader) for `(scope, tag)`. `scope` is the owning registry name;
   * a user can override a pack by re-registering the same `(scope, tag)` with their own loader/object.
   */
  function register(
    scope: string,
    tag: LanguageTag,
    catalogOrLoader: CommandCatalog | CommandCatalogLoader,
    options?: RegisterCatalogOptions
  ): void {
    const sourceId = options?.sourceId ?? scope;
    const key = sourceKey(scope, sourceId);
    let source = sources.get(key);
    if (!source) {
      source = { scope, sourceId, byTag: new Map(), contributors: new Map() };
      sources.set(key, source);
    }

    const rec = source.byTag.get(tag) ?? {};
    if (typeof catalogOrLoader === 'function') {
      rec.loader = catalogOrLoader;
      rec.catalog = undefined;
      rec.loading = undefined;
    } else {
      rec.catalog = catalogOrLoader;
    }
    source.byTag.set(tag, rec);

    // Seed when this slice affects the current view. A plain catalog (or user-supplied object) seeds
    // synchronously; a loader kicks off its fetch and seeds when it resolves — the registry bump then
    // re-resolves bound scopes. Awaiting is via `prefetch` (the reveal-gate), not here.
    if (tag === activeTag || tag === _baseOf(activeTag)) {
      if (rec.catalog) _seed(source);
      else void _ensureLoaded(source, tag).then(() => _seed(source)).catch(_loadError);
    }
  }

  function _loadError(e: unknown): void {
    if (__DEV__) console.error('CommandCatalogService: catalog load failed', e);
  }

  /**
   * Register every locale's packs for a package from its build-emitted resource index, read via the
   * shared `LocaleResource` boundary (`@sheetxl/utils`) — so it comes from the resource ROOTS, not
   * `import.meta.url` (unreliable once a library is re-bundled). `pkg` is the owning package id.
   *
   * Reads the package's self-declared locales (VSCode-style, not a global registry) and registers,
   * per locale:
   *  - a command-catalog loader per `(scope, locale)` — this service, and
   *  - the package's flat call-site (`t()`) messages into `DefaultLanguagePackService` —
   *    so a package owns BOTH kinds of its own strings and several packages can contribute to the same
   *    language without clobbering (I18N-DESIGN.md decision 6). One index read serves both.
   *
   * Both kinds resolve along the locale's declared `inherit` chain, flattened HERE at load time so
   * lookup never has to know about fallbacks.
   *
   * `prefetch` awaits the returned promise so the reveal-gate sees every loader.
   *
   * @param defaults the package's **bundled default-language** slices (see {@link BundledLocaleDefaults}),
   *                 statically imported by the caller. Registered eagerly and FIRST — before the async
   *                 fetch loaders — so they seed the lowest-precedence floor: a plain `npm install`
   *                 renders correctly with nothing served, while fetched overrides still win per key.
   *                 When present, an empty resource search is the healthy zero-config state, not an error.
   */
  function registerFromManifest(pkg: string, fromUrl?: string, defaults?: BundledLocaleDefaults): Promise<void> {
    // The eager bundled floor, registered BEFORE the fetch loaders so it seeds the least-specific
    // registry layer (fetched/plugin catalogs, seeded later, override it per command).
    if (defaults?.messages) {
      DefaultLanguagePackService.registerDefaultMessages(pkg, 'en', defaults.messages);
    }
    for (const { sourceId, catalog } of defaults?.catalogs ?? []) {
      register(catalog.scope, 'en', catalog, { sourceId: `${sourceId}${DEFAULT_SOURCE_SUFFIX}` });
    }
    // A root added after import (the host configures resources in its own entry, which runs after the
    // packages it imports) must still contribute. Re-registering a `(scope, tag)` replaces its loader.
    if (!manifestPackages.has(pkg)) {
      manifestPackages.add(pkg);
      onResourceRootsChange(() => { void discoverManifest(pkg, fromUrl, defaults); });
    }
    return discoverManifest(pkg, fromUrl, defaults);
  }

  function discoverManifest(pkg: string, fromUrl?: string, defaults?: BundledLocaleDefaults): Promise<void> {
    const p = loadPackageLocales(pkg, fromUrl)
      .then(async (locales) => {
        const tags = Object.keys(locales);
        if (tags.length === 0) {
          // With a bundled floor this is the HEALTHY zero-config state (no roots served); only a
          // package with no floor is in trouble here.
          if (defaults) return;
          throw new Error(`no locales for '${pkg}' were found in any resource root`);
        }
        for (const tag of tags) {
          const chain = resolveLocaleChain(tag, locales);

          // One registration per DISTINCT (scope, sourceId, file) anywhere in the chain; its loader
          // then merges that file down the chain and across every root, so a user root can override
          // a few commands without restating the pack.
          const cats = new Map<string, { file: string; scope: string; sourceId: string }>();
          for (const t of [...chain].reverse()) { // least-specific first, so nearer entries win
            for (const cat of locales[t]?.catalogs ?? []) {
              cats.set(`${cat.scope}\0${cat.sourceId}`, cat);
            }
          }
          for (const cat of cats.values()) {
            register(cat.scope, tag, async () => {
              const layers = (await Promise.all([...chain].reverse().map((t) =>
                fetchLocaleResourceAll(pkg, `${t}/${cat.file}`, fromUrl)
              ))).flat().map(asCommandCatalog);
              // Built least-specific first; `mergeCatalogs` wants highest precedence first.
              return mergeCatalogs(layers.reverse());
            }, { sourceId: cat.sourceId });
          }

          if (locales[tag].messages?.length) {
            DefaultLanguagePackService.registerMessages(pkg, tag, async () => {
              // Least-specific tag first, so a nearer link in the chain overwrites it. Within a tag,
              // `mergeMessageFiles` keeps root precedence above file order.
              const layers = await Promise.all([...chain].reverse().map((t) =>
                mergeMessageFiles<MessageCatalog>(pkg, t, locales[t]?.messages ?? [], fromUrl)
              ));
              return Object.assign({}, ...layers) as MessageCatalog;
            });
          }
        }
      })
      // A bundled floor means a fetch failure does NOT render keys — the default language still
      // resolves — so it is not the user-facing problem `_loadError` reports. Stay quiet; overrides /
      // other languages simply did not load, the pre-existing behavior.
      .catch((e) => { if (!defaults) _loadError(e); })
      .finally(() => { pendingManifests.delete(p); });
    pendingManifests.add(p);
    return p;
  }

  /**
   * Load a locale across all sources (plus its base tag, `de-AT` → `de`) and seed the registry.
   * **Awaitable** — a host awaits this before its first reveal (`onWorkbookLoad` / `onFirstRender`)
   * so command chrome is present with no flash.
   *
   * No longer also loads `en`: a locale's fallbacks are whatever it declares via `inherit`, already
   * flattened into its own pack at registration, so there is nothing extra to fetch.
   */
  async function prefetch(tag: LanguageTag = activeTag): Promise<void> {
    // Wait for any manifest registrations first, so every locale loader exists before we choose one.
    while (pendingManifests.size) await Promise.all([...pendingManifests]);
    const base = _baseOf(tag);
    await Promise.all([
      ...[...sources.values()].map(async (source) => {
        await _ensureLoaded(source, tag);
        if (base) await _ensureLoaded(source, base);
        _seed(source);
      }),
      // Call-site (`t()`) slices registered by the same manifests — the reveal-gate must cover BOTH
      // kinds of string, or the chrome arrives localized while dialogs/tooltips flash English.
      DefaultLanguagePackService.prefetch(tag)
    ]);
  }

  /** Load `tag`'s packs then re-seed every source. Called on a language switch. */
  async function _activate(tag: LanguageTag): Promise<void> {
    activeTag = tag;
    await prefetch(tag);
  }

  // Re-seed whenever the active language changes (loads the new locale's packs then re-seeds).
  const removeLangListener: RemoveListener = DefaultLanguagePackService.addChangeListener((tag) => {
    void _activate(tag);
  });

  return {
    register,
    registerFromManifest,
    prefetch,
    /** The active language tag currently feeding the registry. */
    getActive: (): LanguageTag => activeTag,
    /** The localized display name for a scope (for the shortcut-keys dialog); the scope key if unknown. */
    getScopeLabel: (scope: string): string => scopeLabels.get(scope) ?? scope,
    /** Listen for scope-label changes (e.g. after a language switch). Returns a remover. */
    onScopeLabelsChange: (listener: () => void): RemoveListener => {
      labelListeners.add(listener);
      return () => { labelListeners.delete(listener); };
    },
    /** Detach the language subscription (tests / teardown). Singletons are app-lifetime. */
    dispose: (): void => removeLangListener()
  };
}

export type CommandCatalogService = ReturnType<typeof createCommandCatalogService>;

/**
 * The shared singleton feeding {@link DefaultCommandRegistry}. Loader modules register their
 * catalogs against this at import; hosts `await prefetch()` before their first reveal.
 */
export const DefaultCommandCatalogService: CommandCatalogService = createCommandCatalogService();
