import { DefaultLanguagePackService } from './LanguagePackService';
import {
  mergeMessageFiles, loadPackageLocales, onResourceRootsChange, resolveLocaleChain, type LocaleIndexEntry
} from './LocaleResource';
import { trackLocaleRegistration } from './_pendingLocales';
import { type MessageCatalog } from './Types';

/** In-flight / completed registrations, so a second call for the same package is a no-op. */
const _registered = new Set<string>();
/** Packages already re-discovering on root changes; survives a failed registration being retried. */
const _listening = new Set<string>();

/**
 * Load a locale's messages flattened along its inherit chain, then across files and roots.
 *
 * Three axes, applied outermost-first so each dominates the next:
 *  - **inherit** (`nn` → `nb`): the more specific locale wins, so apply the chain back-to-front.
 *  - **roots** (`~/.sheetxl` over what we ship): the higher-precedence root wins.
 *  - **files** (`errors.msg.json` + `ui.msg.json`): sorted, and only within one root.
 *
 * A locale earlier in the chain therefore beats a later one at EVERY root — a user override of `nb`
 * cannot outrank a shipped `nn` string, which is the intuitive reading of "nn inherits nb".
 */
async function _loadChain(
  pkg: string,
  chain: string[],
  locales: Record<string, LocaleIndexEntry>,
  fromUrl?: string
): Promise<MessageCatalog> {
  // Least-specific tag first, so a nearer link in the chain overwrites it.
  const layers = await Promise.all([...chain].reverse().map((tag) =>
    mergeMessageFiles<MessageCatalog>(pkg, tag, locales[tag]?.messages ?? [], fromUrl)
  ));
  return Object.assign({}, ...layers) as MessageCatalog;
}

/**
 * Register a package's call-site (`t()`) message slices for every locale it ships — the
 * **framework-free** counterpart of `CommandCatalogService.registerFromManifest` (which additionally
 * seeds command catalogs and therefore lives in `utils-react`).
 *
 * For a package that owns only `messages.json` — the SDK, whose strings are model-layer text rather than
 * command chrome — this is the whole story: read the package index (`{ locales: [...] }`), then each
 * `<locale>/manifest.json`, and hand the messages file to {@link DefaultLanguagePackService} as a lazy
 * loader (slices merge per language, so the SDK and the UI packages coexist).
 *
 * **Never rejects**, but it does WARN. Resources load through the platform-conditional
 * {@link fetchLocaleResourceAll} boundary — an HTTP fetch in the browser, a disk read in node. A
 * failure leaves the pack unregistered and every `t(key)` renders its KEY, so the failure is visible
 * in the UI but silent in the console without this warning.
 *
 * **Every resource root contributes**, rather than the first one winning outright: manifests are
 * unioned so a user root can add a locale the package does not ship, and a locale's message files are
 * merged (highest-precedence root last, so it wins per key) so a root can override a handful of keys
 * without restating the catalog.
 *
 * @param pkg the owning package id, e.g. `'@sheetxl/sdk'`
 * @param fromUrl `import.meta.url` of a module inside `pkg`. Ignored in the browser; in node it is
 *                how the package locates its own `locales/` on disk when no root supplies them.
 * @param defaultMessages the package's **bundled default-language** (`en`) catalog, statically imported
 *                by the caller so the bundler inlines it. Registered eagerly as the lowest-precedence
 *                floor (see {@link DefaultLanguagePackService.registerDefaultMessages}) so a plain
 *                `npm install` renders correctly with nothing served; fetched packs still layer on top.
 *                When present, an empty resource search is the healthy zero-config state, not a warning.
 */
export function registerPackageMessages(
  pkg: string,
  fromUrl?: string,
  defaultMessages?: MessageCatalog
): Promise<void> {
  if (_registered.has(pkg)) return Promise.resolve();
  _registered.add(pkg);
  // The bundled floor lands eagerly and synchronously — before any fetch — so the default language is
  // present the instant this package is imported, with zero serving.
  if (defaultMessages) {
    DefaultLanguagePackService.registerDefaultMessages(pkg, 'en', defaultMessages);
  }
  // A root added after import (the host configures resources in its own entry, which runs after the
  // packages it imports) must still contribute. Re-registering a `(pkg, tag)` replaces it.
  if (!_listening.has(pkg)) {
    _listening.add(pkg);
    onResourceRootsChange(() => { void _discover(pkg, fromUrl, defaultMessages); });
  }
  return _discover(pkg, fromUrl, defaultMessages);
}

function _discover(
  pkg: string,
  fromUrl?: string,
  defaultMessages?: MessageCatalog
): Promise<void> {
  // Tracked so the reveal gate (`LanguagePackService.prefetch`) waits for this registration to land,
  // not just for the slices that happen to be registered when it is called.
  return trackLocaleRegistration(loadPackageLocales(pkg, fromUrl)
    .then(async (locales) => {
      const tags = Object.keys(locales);
      if (tags.length === 0) {
        // With a bundled default this is the HEALTHY zero-config state — no roots are served, and the
        // eagerly-registered `en` floor is the whole story. Only a package with NO bundled floor is in
        // trouble here, so only that one throws.
        if (defaultMessages) return;
        throw new Error(`no locales for '${pkg}' were found in any resource root`);
      }
      for (const tag of tags) {
        if (!locales[tag].messages?.length) continue;
        // The locale's own inherit chain, most-specific first — resolved HERE, at load, so the
        // catalog handed to the service is already flattened and lookup stays a flat search.
        const chain = resolveLocaleChain(tag, locales).filter((t) => locales[t]?.messages?.length);
        DefaultLanguagePackService.registerMessages(pkg, tag, () => _loadChain(pkg, chain, locales, fromUrl));
      }
    })
    .catch((error: any) => {
      // Leave the package retryable rather than latching a failure.
      _registered.delete(pkg);
      // A bundled floor means this failure does NOT render keys — the default language still resolves —
      // so it is not the user-facing problem the warning describes. Stay silent (the floor covers it);
      // fetched overrides / other languages simply did not load, which is the pre-existing behavior.
      if (defaultMessages) return;
      // Warn rather than fail silently. The original "a miss just renders the inline English"
      // reasoning is OBSOLETE — the English literals are gone from source (decision 9), so a
      // package that cannot load its catalog now renders raw KEYS (`op.insertCells`) with no
      // other symptom. Once per package, so a retry loop cannot spam.
      console.warn(`@sheetxl: locale messages for '${pkg}' failed to load; text will render as keys.`, error);
    }));
}
