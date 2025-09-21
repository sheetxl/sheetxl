import { RemoveListener } from '@sheetxl/utils';

import {
  IconPackKey, IconGlyphKey, IconPack, IconGlyphPackPair, IconPackInput, IconGlyph
} from './Types';

import { normalizePackInput } from './_Utils';

export interface ResolveOptions {
  packKey?: IconPackKey;
}

type PackModule = { readonly default: IconPack | IconPackInput } & Record<string, unknown>;
type PackLoader = () => Promise<IconPack | IconPackInput | PackModule>;

export function createDynamicIconService() {
  type Rec = { pack?: IconPack; loader?: PackLoader; loading?: Promise<void> };
  const packs = new Map<IconPackKey, Rec>();
  const aliases = new Map<IconPackKey, Map<IconGlyphKey, IconGlyphKey>>();
  let activePackKey: IconPackKey = 'base';

  let listeners = new Map<(key: IconPackKey) => void, RemoveListener>();

  // --- Active --------------------------------------------------------------
  function setActive(packKey: IconPackKey): void {
    // eventing
    activePackKey = packKey;
    for (const cb of listeners.keys()) {
      try {
        cb(packKey);
      } catch (e) {
        // console.error('DynamicIconService active listener error', e);
      }
    }
  }

  function getActive(): IconPackKey {
    return activePackKey;
  }

  function addActiveListener(cb: (key: IconPackKey) => void): RemoveListener {
    const existing = listeners.get(cb);
    if (existing) return existing;
    const retValue = () => {
      // remove listener
      listeners.delete(cb);
    };
    listeners.set(cb, retValue);
    return retValue;
  }

  // --- Registration --------------------------------------------------------
  function register(
    key: IconPackKey,
    packOrLoader: IconPack | IconPackInput | PackLoader
  ) {
    const rec = packs.get(key) ?? {};
    if (typeof packOrLoader === "function") {
      rec.loader = packOrLoader as PackLoader;
    } else {
      rec.pack = normalizePackInput(packOrLoader as IconPackInput | IconPack);
    }
    packs.set(key, rec);
    // default active to first registered
    if (!activePackKey) {
      activePackKey = key;
    }

  }

  // --- Loading -------------------------------------------------------------
  async function _ensureLoaded(packKey?: IconPackKey) {
    const rec = packs.get(packKey ?? activePackKey);
    if (!rec) throw new Error(`Icon pack not registered: ${packKey}`);
    if (rec.pack) return;

    if (!rec.loading) {
      if (!rec.loader) throw new Error(`No loader for icon pack: ${packKey}`);
      rec.loading = rec.loader()
        .then((m) => {
          const raw =
            m && typeof m === "object" && "default" in (m as any)
              ? (m as any).default
              : m;
          rec.pack = normalizePackInput(raw as IconPackInput | IconPack);
        })
        .catch(err => { rec.loading = undefined; throw err; });
    }
    await rec.loading;
  }

  async function prefetch(keys: IconPackKey | IconPackKey[]=activePackKey): Promise<void> {
    const arr = Array.isArray(keys) ? keys : [keys];
    await Promise.all(arr.map(_ensureLoaded));
  }

  function _splitNs(input: string): { ns?: string; key: string } {
    const i = input.indexOf(":");
    return i > 0 ? { ns: input.slice(0, i), key: input.slice(i + 1) } : { key: input };
  }

  function _resolveInPackChain(startPack: IconPackKey, iconKey: IconGlyphKey): IconGlyphPackPair | null {
    const trySets: IconPackKey[] = [startPack, ...(packs.get(startPack)?.pack?.meta.extends ?? [])];
    for (const s of trySets) {
      const rec = packs.get(s);
      if (!rec?.pack) continue;
      const { icons } = rec.pack;
      const aliased = aliases.get(s)?.get(iconKey) ?? iconKey;
      const glyph = icons[aliased] ?? icons[iconKey];
      if (glyph) return { glyph, pack: rec.pack, packKey: s };
    }
    return null;
  }

  function _resolveSync(key: IconGlyphKey, o?: ResolveOptions): IconGlyphPackPair | null {
    const start = o?.packKey ?? activePackKey;

    // If caller explicitly set packKey, keep existing behavior
    if (o?.packKey) return _resolveInPackChain(o.packKey, key);

    if (!key) return null;
    // Namespaced form: "ns:key"
    const { ns, key: plain } = _splitNs(key);
    if (ns) {
      const nsRec = packs.get(ns)?.pack;
      if (nsRec) {
        // apply overrides ONLY if the active pack is loaded
        const activeLoaded = !!packs.get(activePackKey)?.pack;
        if (activeLoaded) {
          const ov = (nsRec as any).__overrides as
            | Record<string, Record<string, IconGlyph>>
            | undefined;
          const hit = ov?.[activePackKey]?.[plain];
          if (hit) return { glyph: hit, pack: nsRec, packKey: ns };
        }

        // fallback to plugin pack's own icons (and its extends)
        const hit2 = _resolveInPackChain(ns, plain);
        if (hit2) return hit2;
      }

      // If the ns pack isn't loaded, async resolve() will load and retry
      return null;
    }

    // Non-namespaced: resolve in the active chain as before
    return _resolveInPackChain(start, key);
  }

  async function resolve(key: IconGlyphKey, o?: ResolveOptions): Promise<IconGlyphPackPair | null> {
    // Try sync first
    let hit = _resolveSync(key, o);
    if (hit) return hit;

    const start = o?.packKey ?? activePackKey;
    const { ns, key: plain } = _splitNs(key);

    if (o?.packKey) {
      // Explicit packKey path: ensure start + extends, then retry
      await _ensureLoaded(start);
      hit = _resolveSync(key, o);
      if (hit) return hit;

      const gbExtends = packs.get(start)?.pack?.meta?.extends ?? [];
      if (gbExtends.length) {
        await Promise.all(gbExtends.map(_ensureLoaded));
        hit = _resolveSync(key, o);
        if (hit) return hit;
      }
    } else if (ns) {
      // Namespaced plugin: load *only* the plugin pack (and its extends if needed)
      await _ensureLoaded(ns);

      // Try again (this will apply override if active pack already happens to be loaded)
      hit = _resolveSync(key, o);
      if (hit) return hit;

      // Also try ns extends
      const nsExtends = packs.get(ns)?.pack?.meta?.extends ?? [];
      if (nsExtends.length) {
        await Promise.all(nsExtends.map(_ensureLoaded));
        hit = _resolveSync(key, o);
        if (hit) return hit;
      }
      // NOTE: we do NOT load the active pack here just to enable overrides.
    } else {
      // Non-namespaced: normal active chain load
      await _ensureLoaded(start);
      hit = _resolveSync(key, o);
      if (hit) return hit;

      const gbExtends = packs.get(start)?.pack?.meta?.extends ?? [];
      if (gbExtends.length) {
        await Promise.all(gbExtends.map(_ensureLoaded));
        hit = _resolveSync(key, o);
        if (hit) return hit;
      }
    }

    if (__DEV__) {
      const fb = packs.get(start)?.pack?.meta?.extends ?? [];
      console.warn(`Icon not found: '${key}' in pack '${start}'${fb.length ? ` (extends: ${fb.join(', ')})` : ''}`);
    }
    return null;
  }
  // --- Utilities -----------------------------------------------------------

  function registerAlias(packKey: IconPackKey, fromKey: IconGlyphKey, toKey: IconGlyphKey) {
    if (!aliases.has(packKey)) aliases.set(packKey, new Map());
    aliases.get(packKey)!.set(fromKey, toKey);
  }

  function has(key: IconGlyphKey, o?: ResolveOptions) { return !!_resolveSync(key, o); }
  function getPack(packKey?: IconPackKey) {
    return packs.get(packKey ?? activePackKey)?.pack;
  }
  function hasPack(packKey: IconPackKey) { return !!packs.get(packKey)?.pack; }
  function listPacks(): IconPackKey[] { return Array.from(packs.keys()); }
  function listIcons(packKey: IconPackKey): string[] {
    const p = packs.get(packKey)?.pack;
    return p ? Object.keys(p.icons) : [];
  }

  return {
    // registration
    register,
    // loading
    prefetch,
    // active
    setActive, getActive,
    // resolve
    resolve,
    // utils
    registerAlias, has, getPack, hasPack, listPacks, listIcons,
    // events
    addActiveListener
  };
}

export const DefaultDynamicIconService = createDynamicIconService();

// Prefetch at boot/SSR if you want zero pop-in.
DefaultDynamicIconService.register(
  'base',
  () => import(/* webpackChunkName: "icons-base" */ './packs/Base')
);