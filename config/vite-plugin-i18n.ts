import { type Plugin, type Logger } from 'vite';
import path from 'node:path';
import fs from 'node:fs';

import { buildPackageCatalogs } from './i18n-catalog-build.mjs';

/**
 * Vite plugin: the command-catalog i18n build step (I18N-DESIGN.md decision 8 + decision 1), the
 * counterpart of the formula compiler plugin.
 *
 * **Package mode only** — this is a package's *authoring* step: it reads the authored English defaults
 * under `locales/en/*.cmd.json`, VALIDATES every locale (no extra keys), regenerates each shipped
 * locale as a COMPLETE pack (English-filled), and (re)writes the per-locale manifests + package index.
 *
 * It does NOT distribute anything. Getting a package's `locales/` in front of a running app is
 * `ResourcesPlugin`'s job (`vite-plugin-resources.ts`), which stages every kind of resource — locales,
 * fonts, scripts — under one layout rather than locales under a bespoke one.
 *
 * No-ops for packages without a `locales/` dir.
 */
export interface I18nCatalogPluginOptions {
  /** Package root (defaults to the Vite project root). */
  root?: string;
  verbose?: boolean;
}

const pluginName = 'vite-i18n-catalog';

export function I18nCatalogPlugin(options: I18nCatalogPluginOptions = {}): Plugin {
  let logger: Logger | undefined;
  const root = options.root ?? process.cwd();
  const localesDir = path.join(root, 'resources', 'locales');

  const log = () => ({
    info: (m: string) => (logger?.info(`[${pluginName}] ${m}`) ?? console.log(`[${pluginName}] ${m}`)),
    warn: (m: string) => (logger?.warn(`[${pluginName}] ${m}`) ?? console.warn(`[${pluginName}] ${m}`)),
    error: (m: string) => (logger?.error(`[${pluginName}] ${m}`) ?? console.error(`[${pluginName}] ${m}`))
  });

  // --- Package mode: validate + (re)generate this package's own catalogs. ---
  const runPackage = (reason: string, failOnError: boolean): void => {
    if (!fs.existsSync(localesDir)) return;
    const result = buildPackageCatalogs(root, { write: true, logger: log() });
    if (!result) return;
    if (options.verbose) log().info(`${reason}: ${result.catalogs} catalogs, locales [${result.locales.join(', ')}]${result.todos ? `, ${result.todos} TODO` : ''}`);
    if (result.problems > 0 && failOnError) throw new Error(`[${pluginName}] ${result.problems} catalog validation problem(s).`);
  };

  return {
    name: pluginName,
    enforce: 'pre',

    config(_config, { command }) { if (command === 'build') runPackage('build', true); },
    configResolved(resolved) { logger = resolved.logger; },
    buildStart() { runPackage('buildStart', true); },

    configureServer(server) {
      if (fs.existsSync(localesDir)) {
        server.watcher.add(path.resolve(localesDir, '**/*.cmd.json'));
      }
    },

    handleHotUpdate(ctx) {
      if (ctx.file.startsWith(localesDir) && ctx.file.endsWith('.cmd.json')) {
        runPackage('hot-update', false);
      }
    }
  };
}
