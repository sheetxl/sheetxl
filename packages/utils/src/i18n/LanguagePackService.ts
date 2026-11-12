import { type RemoveListener } from '../types';

import { whenLocalesRegistered } from './_pendingLocales';

import {
  type ITranslator, type LanguagePack, type LanguagePackLoader,
  type LanguageTag, type MessageCatalog
} from './Types';
import { formatMessage } from './formatMessage';

/** The tag whose catalog is the source code itself (inline literals). */
export const ENGLISH_TAG: LanguageTag = 'en';

/**
 * Replace `{name}` placeholders. Unknown params are left literal (visible, debuggable).
 *
 * The plain-substitution degenerate case of {@link formatMessage} — the translator
 * resolves through `formatMessage` (which adds ICU plural/select and needs the
 * language); use this only where a message is known to be simple `{name}` form.
 */
export function interpolate(message: string, params?: Record<string, unknown>): string {
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** `'de-AT'` → `'de'`; `'de'` → `null`. */
function baseTag(tag: LanguageTag): LanguageTag | null {
  const dash = tag.indexOf('-');
  return dash > 0 ? tag.slice(0, dash) : null;
}

/** A per-package UI message slice: an eager catalog or a lazy loader (typically a fetch). */
export type MessageCatalogLoader = () => Promise<MessageCatalog | { default: MessageCatalog }>;

export interface LanguagePackService extends ITranslator {
  /**
   * Register the **host app's** whole pack (or a lazy loader) for a tag. Re-registering replaces.
   *
   * The host is simply the highest-precedence contributor — the same mechanism as
   * {@link registerMessages}, reserved to one id — so an app can override any package's string
   * without editing the package. It differs only in carrying the whole {@link LanguagePack}, which
   * {@link getPack} hands back.
   *
   * Generic over the pack type so a package that EXTENDS {@link LanguagePack} with its own plane
   * (the SDK's function names / error values) can pass an object literal without excess-property
   * errors — and without this package ever knowing those fields exist.
   */
  register<T extends LanguagePack>(tag: LanguageTag, packOrLoader: T | LanguagePackLoader<T>): void;
  /**
   * Register one **package's** whole pack (or a lazy loader) for a tag — the merge-friendly sibling of
   * {@link register}. Unlike the host (one contributor, highest precedence), any number of packages may
   * contribute a pack for the same tag; {@link getPacks} returns them all in precedence order for a
   * consumer to merge. This is how the spreadsheet-language plane (function names / help / errors /
   * booleans) is sourced from the packages that OWN the functions (`@sheetxl/formulas`,
   * `@sheetxl/formulas-extended`) without those packages depending on the SDK — utils stores the pack
   * opaquely; the SDK reads and merges its own plane fields.
   *
   * A pack's `messages` still join the message lookup chain (so a pack slice may also carry `t()`
   * strings); re-registering a `(pkg, tag)` replaces just that contribution.
   */
  registerPack<T extends LanguagePack>(pkg: string, tag: LanguageTag, packOrLoader: T | LanguagePackLoader<T>): void;
  /**
   * Register one **package's** messages for a tag (I18N-DESIGN.md decision 6). Packages own their own
   * call-site (`t()`) strings — shipped as `locales/<tag>/messages.json` and fetched through the
   * shared `LocaleResource` boundary — so several packages, and independently-published plugins, can
   * contribute to the SAME language without clobbering each other. Lookup walks contributors in
   * precedence order: the host first, then packages with the LAST registration winning a key
   * collision — a downstream package (registered later, since it imports its dependencies) can
   * re-word a dependency's key, and a plugin can override anything but the host. Re-registering a
   * `(pkg, tag)` replaces just that contribution.
   */
  registerMessages(pkg: string, tag: LanguageTag, catalogOrLoader: MessageCatalog | MessageCatalogLoader): void;
  /**
   * Register a package's **bundled default-language** messages — the eager, lowest-precedence baseline
   * that makes a plain `npm install` render correctly with NOTHING served (I18N zero-config goal).
   *
   * Unlike {@link registerMessages}, this contributes under a DISTINCT low-precedence id, so it
   * coexists with — and always loses per-key to — a same-package `registerMessages` contribution for
   * the same tag (a host/user override fetched from a resource root, or a plugin's slice). The bundled
   * catalog fills only the keys the override omits: the additive-override contract, now with an
   * always-present floor instead of raw keys.
   *
   * Only the default language (`en`, the source language) is ever bundled; other languages still load
   * through the fetch path. Because the lookup chain only ever includes the active tag and its base
   * tag, a bundled `en` never leaks in as a fallback under a `de` session — it simply is not in that
   * chain — so this preserves "English is a language, not a fallback" for translated sessions.
   */
  registerDefaultMessages(pkg: string, tag: LanguageTag, catalog: MessageCatalog): void;
  /**
   * Activate a language: loads every contributor's messages for it (if lazy) then fires change
   * listeners. Lenient like Excel — an unregistered tag still activates, resolving through its base
   * tag if that is registered, and otherwise rendering keys.
   */
  setActive(tag: LanguageTag): Promise<void>;
  /** The active tag (as requested — may be more specific than the tag that resolves). */
  getActive(): LanguageTag;
  /** Every tag any contributor supplies (always includes `'en'`). */
  getAvailable(): LanguageTag[];
  /** Eagerly load packs without activating (zero pop-in on later switch). */
  prefetch(tags?: LanguageTag | LanguageTag[]): Promise<void>;
  /** The loaded HOST pack for a tag (default: the active resolution), if any. */
  getPack(tag?: LanguageTag): LanguagePack | undefined;
  /**
   * Every loaded pack for a tag — host + package contributions — in ASCENDING precedence order
   * (packages in registration order so the last registration wins under a "later wins" reducer,
   * host after all of them so it overrides everything, matching the message chain). Empty when none
   * are loaded. The domain that owns extra plane fields (the SDK) merges these; utils treats each
   * pack as opaque. Base-tag packs come BEFORE the exact-tag ones, so the more specific locale
   * (`de-AT`) overrides its base (`de`) under the same reducer.
   */
  getPacks(tag?: LanguageTag): LanguagePack[];
  /** Listen for language changes. Returns a remover. */
  addChangeListener(listener: (language: LanguageTag) => void): RemoveListener;
  /**
   * A monotonic counter bumped on every change notification — a language switch AND every late
   * pack/message load that joins the active chain. Unlike {@link getActive} (whose value is unchanged
   * when a contribution lands for the language already in use), this always advances, so a
   * `useSyncExternalStore` snapshot built on it re-renders on those async loads instead of swallowing
   * them (the initial-load race where a string resolves to its key and then never refreshes).
   */
  getRevision(): number;
}

/**
 * The reserved contributor id for the HOST app's own pack. Not a package name (the `\0` guarantees
 * it can never collide with one) and always highest precedence, which is the only sense in which the
 * host is special.
 */
const HOST_ID = '\0host';

/**
 * Prefix marking a contributor as a **bundled default** — the lowest-precedence tier, below every
 * normal package/host contribution. A distinct id (the `\0` guarantees it can never collide with a
 * real package name) lets a package's bundled `en` and its fetched `en` override coexist in the map
 * rather than one replacing the other.
 */
const DEFAULT_PREFIX = '\0default:';

export function createLanguagePackService(): LanguagePackService {
  /**
   * One contribution of messages for one `(contributor, tag)`.
   *
   * `catalog` is what lookup reads, for the host and packages alike. `pack` is extra baggage only the
   * host has — the whole {@link LanguagePack} object, kept so {@link getPack} can hand it back with
   * whatever plane a subtype (the SDK's) added.
   */
  type Rec = {
    catalog?: MessageCatalog;
    pack?: LanguagePack;
    /** `true` when this contribution is a whole pack (host or a package pack) rather than a bare message catalog. */
    isPack?: boolean;
    loader?: () => Promise<unknown>;
    loading?: Promise<void>;
  };

  /**
   * `<contributorId>\0<tag>` → that contributor's messages for that language.
   *
   * ONE map, deliberately. The host used to live in a separate `packs` map, which made it a second
   * kind of thing to load, chain, and enumerate — and `getAvailable` read only that map, so a
   * language contributed purely by packages (now the normal case) reported as unavailable.
   */
  const contributions = new Map<string, Rec>();
  /** Contributor ids in registration order; {@link HOST_ID} is forced first. */
  const order: string[] = [];
  /** Ids registered as bundled defaults ({@link DEFAULT_PREFIX}); forced to the LOWEST precedence tier. */
  const defaultIds = new Set<string>();

  let activeTag: LanguageTag = ENGLISH_TAG;
  /** Resolved lookup chain for the active tag, most-specific first. */
  let activeChain: MessageCatalog[] = [];
  /** Bumped on every `_notify` so a same-tag async load still changes a store snapshot (see `getRevision`). */
  let revision = 0;

  const listeners = new Map<(language: LanguageTag) => void, RemoveListener>();

  const recKey = (id: string, tag: LanguageTag): string => `${id}\0${tag}`;

  function _contribute(
    id: string,
    tag: LanguageTag,
    value: unknown | (() => Promise<unknown>),
    isPack: boolean
  ): void {
    if (!order.includes(id)) {
      if (id === HOST_ID) order.unshift(id);
      else order.push(id);
    }
    const key = recKey(id, tag);
    const rec = contributions.get(key) ?? {};
    rec.isPack = isPack;
    if (typeof value === 'function') {
      rec.loader = value as () => Promise<unknown>;
      rec.catalog = undefined; // a re-register invalidates what was loaded
      rec.pack = undefined;
      rec.loading = undefined;
    } else if (isPack) {
      rec.pack = value as LanguagePack;
      rec.catalog = (value as LanguagePack).messages;
    } else {
      rec.catalog = value as MessageCatalog;
    }
    contributions.set(key, rec);

    // A contribution for the language already in use must join the LIVE chain — registration is
    // async (a package reads its index over the network), so this routinely lands after `setActive`.
    // An eager catalog joins immediately; a loader joins when it resolves, then notifies.
    if (tag === activeTag || tag === baseTag(activeTag)) {
      // An eager catalog joins immediately AND must notify — otherwise a package that registers its
      // messages synchronously after `setActive` updates the chain but leaves mounted consumers frozen
      // on the keys they already rendered (same race as the loader path, minus the await).
      if (rec.catalog) { activeChain = _chainFor(activeTag); _notify(activeTag); }
      else {
        void _ensureRecLoaded(id, tag)
          .then(() => { activeChain = _chainFor(activeTag); _notify(activeTag); })
          .catch((e) => { console.warn(`language messages '${id}' [${tag}] failed to load`, e); });
      }
    }
  }

  function register<T extends LanguagePack>(
    tag: LanguageTag,
    packOrLoader: T | LanguagePackLoader<T>
  ): void {
    _contribute(HOST_ID, tag, packOrLoader, true /*isPack*/);
  }

  function registerPack<T extends LanguagePack>(
    pkg: string,
    tag: LanguageTag,
    packOrLoader: T | LanguagePackLoader<T>
  ): void {
    _contribute(pkg, tag, packOrLoader, true /*isPack*/);
  }

  function registerMessages(
    pkg: string,
    tag: LanguageTag,
    catalogOrLoader: MessageCatalog | MessageCatalogLoader
  ): void {
    _contribute(pkg, tag, catalogOrLoader, false /*isPack*/);
  }

  function registerDefaultMessages(pkg: string, tag: LanguageTag, catalog: MessageCatalog): void {
    const id = DEFAULT_PREFIX + pkg;
    defaultIds.add(id);
    _contribute(id, tag, catalog, false /*isPack*/);
  }

  function _notify(tag: LanguageTag): void {
    revision++;
    for (const cb of listeners.keys()) {
      try {
        cb(tag);
      } catch (e) {
        console.warn('LanguagePackService change listener error', e);
      }
    }
  }

  /** Resolve one `(contributor, tag)` loader, unwrapping a module's `default` either way. */
  async function _ensureRecLoaded(id: string, tag: LanguageTag): Promise<void> {
    const rec = contributions.get(recKey(id, tag));
    if (!rec || rec.catalog) return;
    if (!rec.loading) {
      if (!rec.loader) return;
      rec.loading = rec.loader()
        .then((m: unknown) => {
          const value = (m && typeof m === 'object' && 'default' in m ? (m as any).default : m);
          if (rec.isPack) {
            rec.pack = value as LanguagePack;
            rec.catalog = (value as LanguagePack).messages;
          } else {
            rec.catalog = value as MessageCatalog;
          }
        })
        .catch((err: unknown) => { rec.loading = undefined; throw err; });
    }
    await rec.loading;
  }

  /** Load every contribution for `tag` (ignoring individual failures — each is reported at register). */
  async function _ensureAllLoaded(tag: LanguageTag): Promise<void> {
    const pending: Promise<void>[] = [];
    for (const key of contributions.keys()) {
      const split = key.lastIndexOf('\0');
      if (key.slice(split + 1) !== tag) continue;
      pending.push(_ensureRecLoaded(key.slice(0, split), tag).catch(() => { /* already reported */ }));
    }
    await Promise.all(pending);
  }

  /**
   * Lookup order, most-specific first: every contributor at the exact tag, then the same for the
   * base tag (`de-AT` → `de`). Within one tag, highest precedence first (lookup is first-hit-wins):
   * the host, then normal contributors with the LAST registration first — a later-registered package
   * overrides an earlier one, so a downstream package (whose module init runs after its
   * dependencies') can re-word a dependency's key — then bundled defaults, reversed the same way,
   * as the floor that only fills gaps.
   *
   * The base-tag step resolves WHICH registered tag serves a request; it is not a content fallback.
   * Gaps *within* a locale are filled by its declared `inherit` chain, flattened at LOAD time before
   * the catalog ever reaches this service (see `resolveLocaleChain`). The two compose and neither
   * hardcodes a language.
   */
  function _chainFor(tag: LanguageTag): MessageCatalog[] {
    const chain: MessageCatalog[] = [];
    const push = (t: LanguageTag): void => {
      const pkgs: string[] = [];
      const defs: string[] = [];
      for (const id of order) {
        if (id === HOST_ID) continue;
        (defaultIds.has(id) ? defs : pkgs).push(id);
      }
      for (const id of [HOST_ID, ...pkgs.reverse(), ...defs.reverse()]) {
        const catalog = contributions.get(recKey(id, t))?.catalog;
        if (catalog) chain.push(catalog);
      }
    };
    push(tag);
    const base = baseTag(tag);
    if (base) push(base);
    return chain;
  }

  async function setActive(tag: LanguageTag): Promise<void> {
    // Same reason as `prefetch`: a switch must cover packages whose registration is still in flight.
    await whenLocalesRegistered();
    await _ensureAllLoaded(tag);
    const base = baseTag(tag);
    if (base) await _ensureAllLoaded(base);
    activeTag = tag;
    activeChain = _chainFor(tag);
    _notify(tag);
  }

  function getActive(): LanguageTag {
    return activeTag;
  }

  function getRevision(): number {
    return revision;
  }

  /** Every tag ANY contributor supplies — packages included, which is the normal case. */
  function _registeredTags(): Set<LanguageTag> {
    const tags = new Set<LanguageTag>();
    for (const key of contributions.keys()) tags.add(key.slice(key.lastIndexOf('\0') + 1));
    return tags;
  }

  function getAvailable(): LanguageTag[] {
    return [...new Set<LanguageTag>([ENGLISH_TAG, ..._registeredTags()])];
  }

  async function prefetch(tags?: LanguageTag | LanguageTag[]): Promise<void> {
    // Registration is itself async (a package reads its index over the network), so wait for any
    // in-flight ones FIRST. Otherwise this loads only what happens to be registered right now, the
    // gate opens, and a late-registering package's strings render as keys until its fetch lands.
    await whenLocalesRegistered();
    const arr = tags === undefined
      ? [..._registeredTags()] // resolved AFTER the await — registrations land in between
      : (Array.isArray(tags) ? tags : [tags]);
    await Promise.all(arr.map((t) => _ensureAllLoaded(t)));
    // A prefetch of the ACTIVE language must also publish what it loaded (a reveal-gate awaits this).
    if (arr.includes(activeTag)) activeChain = _chainFor(activeTag);
  }

  /** The HOST pack — the app's override contributor; `getPacks` returns package packs too. */
  function getPack(tag?: LanguageTag): LanguagePack | undefined {
    return contributions.get(recKey(HOST_ID, tag ?? activeTag))?.pack;
  }

  /**
   * Every loaded pack for a tag, in ASCENDING precedence for a "later overrides earlier" reducer —
   * the same order the message chain resolves, just reversed for reduction: base-tag packs before
   * exact-tag packs (`de-AT` overrides `de`, mirroring `_chainFor` where the exact tag is searched
   * first), and within each tag packages in registration order (the last registration wins) with the
   * host after them all. The SDK reduces these into one spreadsheet-language plane.
   */
  function getPacks(tag?: LanguageTag): LanguagePack[] {
    const t = tag ?? activeTag;
    const packs: LanguagePack[] = [];
    const push = (lt: LanguageTag): void => {
      for (const id of order) {
        if (id === HOST_ID) continue;
        const pack = contributions.get(recKey(id, lt))?.pack;
        if (pack) packs.push(pack);
      }
      const host = contributions.get(recKey(HOST_ID, lt))?.pack;
      if (host) packs.push(host);
    };
    const base = baseTag(t);
    if (base) push(base);
    push(t);
    return packs;
  }

  function addChangeListener(listener: (language: LanguageTag) => void): RemoveListener {
    const existing = listeners.get(listener);
    if (existing) return existing;
    const remove = () => { listeners.delete(listener); };
    listeners.set(listener, remove);
    return remove;
  }

  /** First hit across the merged chain (host pack ⊳ package slices, exact tag ⊳ base tag). */
  function _raw(key: string): string | undefined {
    const chainLength = activeChain.length;
    for (let i = 0; i < chainLength; i++) {
      const hit = activeChain[i][key];
      if (hit !== undefined) return hit;
    }
    return undefined;
  }

  function lookup(key: string, params?: Record<string, unknown>): string | undefined {
    const raw = _raw(key);
    // Pack messages format in the pack's language (ICU-subset: {name} + plural/select).
    return raw === undefined ? undefined : formatMessage(raw, params, activeTag);
  }

  function t(key: string, params?: Record<string, unknown>): string {
    return lookup(key, params) ?? key;
  }

  function has(key: string): boolean {
    return _raw(key) !== undefined;
  }

  return {
    register, registerPack, registerMessages, registerDefaultMessages,
    setActive, getActive, getAvailable,
    prefetch, getPack, getPacks,
    addChangeListener, getRevision,
    // ITranslator
    lookup, t, has,
    get language(): LanguageTag { return activeTag; },
    onChange: addChangeListener
  };
}

/**
 * The shared singleton — the boundary command chrome, dialogs, and formula display
 * resolve through (mirrors `DefaultIconService`). Hosts register packs against this
 * and call `setActive` from their language UI.
 */
export const DefaultLanguagePackService: LanguagePackService = createLanguagePackService();

/**
 * The **call-site** translation boundary for non-command strings (dialog prose, chrome
 * tooltips, statusbar text). Packs overlay by key:
 * ```ts
 * label: t('formulaBar.cancel')
 * ```
 * Command/panel chrome does NOT use this — it resolves by convention at the registries.
 *
 * **In React, do not import this — use `useTranslator()` (`@sheetxl/utils-react`), which returns
 * a `t` bound to a language subscription.** This function reads a singleton, so React cannot know
 * its value changed; a component calling it directly renders the string ONCE and silently freezes
 * it at whatever language was active on mount unless that component separately subscribes. The
 * export exists for non-React callers, and `scripts/i18n-chrome-lint.mjs` fails any `.tsx` that
 * imports it.
 *
 * **The English never appears here** — it lives only in the package's `locales/en/messages.json`
 * (I18N-DESIGN.md decision 9). The key is the identity; a second copy of the sentence at the call
 * site tells the next reader nothing and ships the same bytes twice.
 *
 * ```ts
 * t('error.named.nameEmpty')                  // no parameters
 * t('error.named.nameExists', { name })       // with parameters
 * ```
 *
 * A miss renders the key: visible and debuggable, never blank. That is also what happens where no
 * pack can load at all (Node, the CLI) — those contexts need the English pack registered from disk
 * rather than an inline copy at every call site.
 */
export function t(key: string, params?: Record<string, unknown>): string {
  return DefaultLanguagePackService.lookup(key, params) ?? key;
}

/**
 * Declare a message whose **stored value is the key**, not the text.
 *
 * Some user-visible strings are produced as *data* far from where they are rendered — a command's
 * `disabledReasons`, contributed by a model-driven reducer that re-runs on selection/protection
 * changes but NOT on a language switch. Baking English (or any language) into that data freezes it:
 * whatever language was active when the reducer last ran is what the user keeps seeing. It is the
 * same trap as storing a localized formula, and it gets the same answer the rest of this codebase
 * uses — **canonical storage, localized display**:
 *
 * ```ts
 * // …contributed as data: disabledReasons: [messageKey('reason.sheetProtected')]  ← language-free
 * // …rendered:            t(reason)                                               ← localized
 * ```
 *
 * **At runtime this is the identity function** — `messageKey('k')` IS `'k'`. Its whole purpose is
 * to be a marker for `scripts/i18n-extract.mjs`, which scans for `t(` and `messageKey(` to build
 * the key set. That is what makes deleting a call site drop its key from `messages.json`, and what
 * makes a key with no English anywhere FAIL the build. A bare `'reason.sheetProtected'` literal is
 * invisible to all of it, so the key would rot silently. It also tells the next reader that the
 * string is a key resolved elsewhere rather than an identifier.
 *
 * The English is NOT a parameter — it lives only in the package's `locales/en/messages.json`
 * (I18N-DESIGN.md decision 9).
 *
 * Prefer calling this AT THE CALL SITE over hoisting it into a module-level `const`: the const only
 * restates the key under a second name, which is the same duplication decision 9 rejects. (A const
 * holding a `messageKey` is not a correctness bug — the key is static, so it cannot freeze a
 * language the way `const X = t(...)` does, which evaluates its lookup once at import.)
 */
export function messageKey(key: string): string {
  return key;
}
