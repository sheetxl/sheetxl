import { resolve, isAbsolute, extname, basename } from 'path';
import { builtinModules } from "node:module";
import { readFileSync } from 'fs'; // Import the Node.js file system module
import {
  defineConfig, mergeConfig, type UserConfig, type PluginOption,
  type BuildEnvironmentOptions
} from 'vite';

import { type InputOption, type RolldownOptions, type OutputOptions } from 'rolldown';

import dts from 'vite-plugin-dts';
import license from 'rollup-plugin-license';
import copy from 'rollup-plugin-copy';

import terser from '@rollup/plugin-terser';

// only for ui
import react from '@vitejs/plugin-react';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import svgr from 'vite-plugin-svgr';

import { createRequire } from 'node:module';

import { typeCheck } from './vitePluginTypeCheck';
import { obfuscator } from './vitePluginObfuscator';
import { I18nCatalogPlugin } from './vite-plugin-i18n';
import { ResourcesPlugin } from './vite-plugin-resources';
import { LocaleBundlePlugin } from './vite-plugin-locale-bundle';
import { licenseKeysDefine } from './license-keys';
import { visualizer } from 'rollup-plugin-visualizer';

interface Pkg {
  name: string;
  version?: string;
  description: string;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  license?: string;
  sideEffects?: any;
  author?: string;
  repository?: any;
  bugs?: any;
  homepage?: string;
  keywords?: string[];
}

const createBanner = (pkg: Pkg, version: string) => `/**
 * @license ${pkg.name} - ${pkg.description} - v${version ?? 'local'}
 *
 * (C) 2026-present SheetXL Inc. & Michael T. Ford
 * License: ${pkg.license === 'MIT' ? 'MIT' : 'SheetXL EULA — https://www.sheetxl.com/eula'}
 */`;

const README_TAIL =
`
## 🔗 Learn More

Whether you're ready to build, need help, or just want to see more examples, here's where to go next.

* 💬 **[Join our Discord Community](https://discord.gg/NTKdwUgK9p)** - Get help and connect with the team.
* ⭐ **[Star us on GitHub](https://github.com/sheetxl/sheetxl)** - If you like SheetXL give us a star ⭐ and help others find us!
* 📘 **[Developer Docs](https://www.sheetxl.com/docs)** - Guides and tutorials.
* 🔌 **[API Reference](https://api.sheetxl.com)** - Detailed documentation for all packages.
* 👀 **[Live Demo Gallery](https://www.sheetxl.com/demos)** - A showcase of interactive examples.
* 🖼️ **[Storybook](https://storybook.sheetxl.com)** - Explore and test individual UI components.
* 🌐 **[Website](https://www.sheetxl.com)** - Our Website.

---
`

const readmeTransform = (contents: Buffer, _filename: string): string => {
  return contents.toString() + README_TAIL;
}

function packageNameToPascalCase(packageName: string): string {
  return packageName
    .replace(/@.*\//, '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function updateDependencyVersion(dependencies: Record<string, string>, version: string): void {
  if (!dependencies) return;
  Object.keys(dependencies).forEach(function(key) {
    if (key.startsWith('@sheetxl/')) {
      dependencies[key] = `^${version}`;
    }
  });
}

/**
 * Packages the release manifest holds back from npm, or an empty set when the manifest is absent.
 *
 * Resolved optionally, and that is deliberate. `config/release-targets.ts` names packages that
 * have not been announced and the milestone they ship at, so it is excluded from the mirrored
 * source tree — but THIS file is mirrored, because the public packages build with it. An absent
 * manifest therefore is not an error, it is the mirror: nothing in that tree is held, so there is
 * nothing to mark private and the empty set is the right answer.
 */
const heldFromNpm: ReadonlySet<string> = (() => {
  try {
    const { RELEASE_TARGETS } = createRequire(import.meta.url)('./release-targets.ts');
    return new Set(
      Object.entries(RELEASE_TARGETS as Record<string, { npm: string }>)
        .filter(([, t]) => t.npm === 'none')
        .map(([dir]) => dir)
    );
  } catch {
    return new Set<string>();
  }
})();

const ASSET_EXTS = new Set([".css", ".scss"]);//, ".sass", ".less", ".styl", ".pcss"]);

const basePkgName = (id: string): string => {
  // Remove query
  let clean = id.replace(/\?.*$/, "");

  // Remove version suffix if present (e.g., @mui/system@6.5.0 → @mui/system)
  // Handles both scoped and unscoped packages
  const atIndex = clean.lastIndexOf("@");
  if (atIndex > 0) {
    const afterAt = clean.slice(atIndex + 1);
    // crude version pattern check: digits, dots, optional prerelease
    if (/^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/.test(afterAt)) {
      clean = clean.slice(0, atIndex);
    }
  }

  // Scoped package: keep first two segments
  if (clean.startsWith("@")) {
    const parts = clean.split("/", 3);
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : clean;
  }

  // Unscoped: keep first segment
  return clean.split("/", 2)[0];
};

interface CreateViteConfigOptions {
  /** The __dirname of the calling vite.config.ts file */
  dirname: string;
  /** The package.json content */
  pkg: Pkg;
  /** Any package-specific overrides */
  overrides?: UserConfig;
  /** Use number chunks for better caching and obscurity */
  namingPattern?: string;

  /**
   * Per-package obfuscation policy: the list of source-file globs (matched against module ids) to
   * run through the javascript-obfuscator plugin in production builds. Left undefined for packages
   * that don't need it. The generic obfuscation MECHANISM lives in the shared (public) `config/`;
   * this POLICY (which files hold sensitive code) is supplied by the consuming package so it can
   * stay in that package's private source rather than leaking into the public config copy.
   */
  obfuscate?: string[];

  build?: BuildEnvironmentOptions;

  isCli?: boolean; // Whether this is a CLI package (Node-only executable)
  isNodeLib?: boolean; // Whether this is a Node-only library (ESM only, no browser build)
  /**
   * Stage the SDK's script assets — the runtime manifest (`scripting-enums.json`), the authoring
   * surface (`scripting.d.ts`) and its signature index (`scripting-api.json`) — into `build/types/`.
   *
   * @remarks
   * Set by node bundles that BUNDLE `@sheetxl/sdk` rather than resolving it (the CLI, the MCP
   * server). The SDK's node loader finds the manifest by walking UP from its own module looking for
   * an enclosing `types/`; once bundled, that module lives in the *consumer's* `build/assets/`, from
   * where the SDK's own copy is unreachable — so without this, any macro run by the bundle fails
   * with "Unable to locate scripting-enums.json". Staging a copy at `build/types/` puts it exactly
   * where that walk-up already looks, in both the dev tree and the published package.
   */
  stageScriptRuntime?: boolean;
  /**
   * For a node bundle (`isCli`) that inlines its `@sheetxl/*` dependencies: the ones the PUBLISHED
   * manifest keeps, pinned to this release's exact version. Every other `@sheetxl/*` dependency is
   * dropped from it. Left undefined, the manifest lists them all.
   *
   * @remarks
   * The source manifest still lists every one — resource staging (fonts, locales) discovers what to
   * carry from it — but an install of the published package would fetch the code a second time,
   * with all of its own dependencies. What stays is what the bundle resolves at runtime instead of
   * importing (the MCP server reads `@sheetxl/skills` from disk); exact, so it matches the server.
   */
  publishSheetXLDependencies?: string[];
  /**
   * A library's public subpath entries, beside `src/index.ts`: output name → source path relative to
   * the package. Each is built to `esm/<name>.mjs` in the same build as the index, so they share its
   * chunks (one copy of every module) and the package's `exports` maps `./<name>` to it.
   *
   * @remarks
   * For code the index must not reach statically, so that its own `import()` of the same module
   * becomes a real chunk; an entry the index also re-exports would be inlined into the index.
   * An `index` key replaces `src/index.ts` as the package entry (the formula packages build from a
   * generated one).
   */
  entries?: Record<string, string>;
  isUI?: boolean; // Whether this is a UI package
  isApp?: boolean; // Whether this is a library package
  includeReact?: boolean; // If the application should include React
  includeSheetXL?: boolean; // If the application should include SheetXL
 }

export function createLibraryConfig(options: CreateViteConfigOptions) {
  const {
    dirname,
    pkg,
    isCli = false, // Default to false if not specified
    isNodeLib = false, // Default to false if not specified
    stageScriptRuntime = false,
    publishSheetXLDependencies,
    entries,
    isUI = false, // Default to false if not specified
    isApp = false, // Default to false if not specified
    includeReact = (options?.isUI && options?.isApp), // UI apps
    includeSheetXL = false,
  } = options;

   // process.env.NODE_ENV === 'production' &&
  const isNode = isCli || isNodeLib || process.env.BUILD_ENV === 'node';

  /**
   * An app that bundles its dependencies rather than externalizing them — a browser app (`isApp`) or
   * the CLI, which is simply a NODE app. The two differ in target, not in kind, and every decision
   * that follows from "this bundles everything" (externalization, resource staging) keys off this
   * rather than re-testing `isApp || isCli`.
   */
  const isBundledApp = isApp || isCli;

  let overrides = { ...options.overrides } as UserConfig;

  // to use call pnpm --analyze <script> (e.g. pnpm --analyze build)
  const isAnalyze = process.env.npm_config_analyze;
  if (isAnalyze) {
    console.log('Will analyze');
  }

  // const minify = false;

  const isProduction = process.env.NODE_ENV === 'production';
  // TODO - read proper license string
  const defaultNamingPattern = isProduction ? '[hash:16]' : '[name]-[hash:8]';
  let namingPattern = options.namingPattern ?? defaultNamingPattern;

  const repoDir = resolve(dirname, `../..`).replace(/\\/g, '/');
  const rootPkgPath = resolve(repoDir, 'package.json');
  const pkgRaw = readFileSync(rootPkgPath, 'utf-8');
  const pkgRepo = JSON.parse(pkgRaw);
  const version = pkgRepo.version;
  const isLocalVersion = !version || version === 'local' || version === '0.0.0';
  // The version the composed `build/package.json` (and the banner) carry. A dev build that is
  // published to a local registry (config/releasePackages.ts --registry) sets it to a dev prerelease;
  // everything else about the build stays local (no release keys, `__BUILD_VERSION__` is 'local').
  const manifestVersion: string = process.env.SHEETXL_PUBLISH_VERSION || version;
  const buildDir = resolve(dirname, `build`).replace(/\\/g, '/');
  const publishDir = resolve(dirname, `publish`).replace(/\\/g, '/');
  const publishJson = resolve(publishDir, 'package.json').replace(/\\/g, '/');
  const assetFileNames = (assetInfo: any) => {
    if (assetInfo.names && assetInfo.names.includes('style.css')) {
      // No hash for CSS so it can be dynamically loaded
      return `assets/[name][extname]`;
    }
    return `assets/${namingPattern}[extname]`;
  }

  const sheetxlDeps = new Set<string>([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {})
  ].filter((n) => n.startsWith('@sheetxl/')));

  const peerDeps = new Set<string>([
    ...Object.keys(pkg.peerDependencies ?? {}),
  ]);
  const optionalDependencies = new Set<string>([
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ]);

  const pinned = new Set<string>([
    'typescript',
    'esbuild-wasm',
    'crypto',
    'configstore', // from sdk
  ]);

  // 3) Node built-ins — include both "fs" and "node:fs" flavors
  const nodeBuiltins = new Set<string>([
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),
  ]);

  const stripQuery = (id: string) => id.replace(/\?.*$/, "");
  const isCssLike = (id: string) => ASSET_EXTS.has(extname(id));

  const external = (rawSource: string, importer: string | undefined, isResolved: boolean) => {
    const id = stripQuery(rawSource);
    if (id.startsWith('.') || isAbsolute(id)) return false; // keep relative/absolute in bundle
    // avoid externalizing style/assets (even if package-published we are using cssInJSS so this is a no-op
    if (isCssLike(id)) return false;

    if (!includeReact) { // not needed
      if (/^react($|\/)/.test(id)) {
        // console.log('exclude react', !includeReact);
        return true;       // always externalize React in libs
      }
      if (/^react-dom($|\/)/.test(id)) {
        // console.log('exclude reactdom');
        return true;       // always externalize React in libs
      }
    }
    if (pinned.has(id)) {
      // console.log('exclude pinned', id);
      return true;
    }
    // A library's import of its own published JSON asset (the SDK's `@sheetxl/sdk/scripting-enums.json`)
    // stays a bare import, for the consumer's bundler to resolve in the installed package; the
    // file is generated after this build. An app bundles it like anything else.
    if (!isBundledApp && id.startsWith(`${pkg.name}/`) && extname(id) === '.json') {
      return true;
    }
    if (isNode && nodeBuiltins.has(id)) {
      // console.log('exclude node');
      return true;
    }

    const base = basePkgName(id);
    if (peerDeps.has(base) || optionalDependencies.has(base)) {
      // console.log('exclude peer', base);
      return true;
    }
    if (isBundledApp) return false;
    // Externalize all @sheetxl/* packages (and their subpaths)
    if (!includeSheetXL && sheetxlDeps.has(base)) {
      // console.log('exclude sheetxl', base);
      return true;
    }
    return false;
  };

  // NOTE: no vite-tsconfig-paths. It was pointed at tsconfig.build.json (which has no `paths`, only
  // project `references`), so it contributed zero mappings — a no-op. `@sheetxl/*` resolves to source
  // via each package.json's `development` export condition (→ ./src/index.ts), not tsconfig paths.
  let plugins:PluginOption[] = isUI ? [
    react(), // move to only the packages that are ui based.
    cssInjectedByJsPlugin({
      // With subpath entries the plugin would otherwise pick whichever entry comes last.
      jsAssetsFilterFunction: entries ? (chunk) => chunk.isEntry && chunk.name === 'index' : undefined,
    }),
    svgr(),
  ] : [];

  plugins.push(typeCheck());

  // A library's own authoring step: validates + (re)generates its `locales/`. Distribution is the
  // ResourcesPlugin's job, below.
  plugins.push(I18nCatalogPlugin({ root: dirname }));

  // Inline each package's default-language (`en`) pack into the code as the zero-config floor (the
  // `virtual:sheetxl/bundled-locale` import). Runs at build time, so a published package carries its
  // `en` strings with nothing for a consumer to serve; every other language still fetches. See
  // vite-plugin-locale-bundle.ts.
  plugins.push(LocaleBundlePlugin());

  // Resources (locales today; fonts/scripts next). A LIBRARY indexes its own dirs so they are
  // discoverable once published; a BUNDLED app — browser (isApp) or node (isCli) — additionally
  // carries its dependencies', because bundling is exactly what destroys runtime self-location.
  // One plugin, one staged layout; only the write mechanism differs. See vite-plugin-resources.ts.
  plugins.push(ResourcesPlugin({
    root: dirname,
    pkg,
    app: isBundledApp,
    node: isNode,
    outDir: resolve(dirname, `build/${isNode ? (isCli ? '' : 'node') : 'browser'}`),
    verbose: true
  }));

  // Add middleware to serve TypeScript declaration files during development
  if (!isProduction && isUI) {
    plugins.push({
      name: 'serve-types-middleware',
      configureServer(server) {
        // The ambient authoring d.ts and its companion runtime enum value map are both emitted to
        // packages/sdk/build/types by `build:types-scripting`; serve them as /types/* in dev.
        const scriptingAssets: { route: string; file: string; type: string }[] = [
          { route: '/types/scripting.d.ts', file: 'scripting.d.ts', type: 'text/plain; charset=utf-8' },
          { route: '/types/scripting-enums.json', file: 'scripting-enums.json', type: 'application/json; charset=utf-8' },
          { route: '/types/scripting-api.json', file: 'scripting-api.json', type: 'application/json; charset=utf-8' },
        ];
        for (const asset of scriptingAssets) {
          server.middlewares.use(asset.route, async (req, res, next) => {
            try {
              // assumes this is running from the root/examples/xxx directory
              const assetPath = resolve(dirname, `../../packages/sdk/build/types/${asset.file}`);
              const content = readFileSync(assetPath, 'utf-8');
              res.setHeader('Content-Type', asset.type);
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cache-Control', 'no-cache');
              res.end(content);
            } catch (error: any) {
              console.warn(`Scripting asset not found (${asset.file}):`, error.message);
              res.statusCode = 404;
              res.end(`${asset.file} not found. Run \`pnpm build:types-scripting\` first.`);
            }
          });
        }
      }
    });
  }

  // We have to not generate for node as there is a race condition
  // when generating types 2x quickly (file system race I think)
  if ((!isApp && !isNode) || isCli || isNodeLib) {
    plugins.push(dts({
      // The output directory for the final bundled .d.ts files
      outDir: resolve(dirname, `build/types`),
      // This is a crucial option. It tells the plugin to bundle all
      // type declarations into a single file for each entry point.
      // This prevents the messy, scattered .d.ts files.
      tsconfigPath: resolve(dirname, './tsconfig.build.json'),
      exclude: ['src/loader.ts'],
      // rollupTypes uses api-extractor, which crashes analyzing complex types (e.g. @sheetxl/sdk)
      // and is brittle across TS versions. Emit standard per-file declarations + an index entry
      // instead (vite-plugin-dts 4 honors outDir). Also fixes the "clean build" failure.
      rollupTypes: false,
      insertTypesEntry: true,
      // CLI builds use rollupOptions.input (not build.lib), so vite-plugin-dts emits a benign
      // "you are building a library that may not need to generate declaration files" warning even
      // though it still generates types from the input entries (mcp/cli both publish ./build/types).
      // Raise the plugin's log level for CLI so that false positive is silenced; errors still surface.
      ...(isCli ? { logLevel: 'error' as const } : {})
    }));
  }
  if (isProduction) {
    // Obfuscate only the files a package explicitly designates (its `obfuscate` policy). Packages that
    // pass nothing (the default) skip the plugin entirely — the include list lives in their private
    // source, not in this shared/public config. See CreateViteConfigOptions.obfuscate.
    if (options.obfuscate?.length) {
      plugins.push(obfuscator({ include: options.obfuscate }));
    }
    // terser runs as a 2nd minify pass on top of vite's built-in esbuild minify. On rolldown (vite 8)
    // *app* builds it mangles the bundled @monaco-editor/loader AMD setup → "define is not a function"
    // when Monaco's CDN modules load. Libs externalize Monaco so they're unaffected; apps rely on
    // vite's esbuild minify (verified to work with Monaco). Skip the extra terser pass for apps.
    //
    // Why keep terser (it's what triggers PLUGIN_TIMINGS, suppressed in onwarn below)? It produces the
    // smallest output. Benchmarked on studio-mui esm gzip: terser 167 KB vs the rolldown/esbuild
    // builtins 173 KB, and `build.minify: true` (oxc) a much-worse 210 KB. The builtins are
    // same-speed-and-larger, not faster-and-comparable — so the extra pass earns its keep. Don't
    // "optimize" it away without re-running that comparison.
    if (!isApp) {
      plugins.push(terser({
        maxWorkers: 4,
          format: {
          comments: /@vite-ignore|webpackIgnore/
        }
      }));
    }
    plugins.push(license({
      banner: createBanner(pkg, manifestVersion),
        thirdParty: {
        output: resolve(dirname, 'build/licenses/dependencies.txt'),
        includePrivate: false
      }
    }) as any);
  }
  if (isAnalyze) {
    plugins.push(visualizer({
      filename: resolve(dirname, `build/analyze/bundle.html`),
      // exclude: [ { file: '*/**/typescript.js' }],
      // exclude: externalPicoMatch,
      gzipSize: true,
    }));
  };


  plugins.push(
    copy({
      copySync: true,
      targets: [
        { src: `${publishDir}/*`, dest: `${buildDir}` }, // copy publish dir to build

        // Locale resource packs (command catalogs) — data files fetched at runtime, so they must ship
        // with the published package. One canonical `build/resources/…`; a consuming app's plugin
        // discovers it under node_modules and serves it at the configured base.
        // A LIBRARY's own resources sit at `build/resources/<kind>/` — it *is* the package, so no
        // `<pkg>` segment. A bundled app must NOT be copied this way: `ResourcesPlugin` stages its
        // own resources under `<kind>/<pkg>/` alongside its dependencies', and doing both left the
        // CLI's catalogs at `locales/en/` where a scan reads `en` as a package name.
        ...(isBundledApp ? [] : [
          { src: `${dirname}/resources`.replace(/\\/g, '/'), dest: `${buildDir}` }
        ]),

        // The SDK's script-runtime manifest, staged where the SDK's own walk-up looks for it once
        // the SDK is bundled into this package. See `stageScriptRuntime`.
        // The authoring surface rides with it, for the same reason: a bundle that compiles scripts
        // (`run`, `compile`) type-checks them against `scripting.d.ts`, found by the same walk-up —
        // as is the signature index the `api` lookup reads.
        ...(stageScriptRuntime ? ['scripting-enums.json', 'scripting.d.ts', 'scripting-api.json'].map((asset) => ({
          src: resolve(repoDir, `packages/sdk/build/types/${asset}`).replace(/\\/g, '/'),
          dest: `${buildDir}/types`
        })) : []),


        { src: `${repoDir}/README.md`, dest: `${buildDir}` },
        { src: `${dirname}/README.md`.replace(/\\/g, '/'), dest: `${buildDir}`, transform: readmeTransform },
        { src: `${publishDir}/README.md`, dest: `${buildDir}`, transform: readmeTransform },

        { src: `${repoDir}/LICENSE.md`, dest: `${buildDir}` },
        { src: `${dirname}/LICENSE.md`.replace(/\\/g, '/'), dest: `${buildDir}` },
        { src: `${publishDir}/LICENSE.md`, dest: `${publishDir}` },
        // Optional, per-package: reproduces the notices that a bundled third-party license
        // requires us to ship. Only packages that vendor such code have one (today: sdk, for
        // the numfmt fork under src/numFmt/vendor). Bundled — not npm-resolved — code is
        // invisible to rollup-plugin-license's third-party walk, so it cannot be generated.
        { src: `${dirname}/THIRD-PARTY-NOTICES.md`.replace(/\\/g, '/'), dest: `${buildDir}` },
        {
          src: publishJson, dest: `${buildDir}`,
          transform: (contents: Buffer, _filename: string) => {
            let jsonPublish = JSON.parse(contents.toString());
            jsonPublish = {
              name: pkg.name,
              description: pkg.description,
              version: manifestVersion,
              license: pkg.license,
              ...jsonPublish,
            }

            // Mark held packages private in the composed manifest.
            //
            // Weaker than it looks, and worth being precise about. npm's guard is
            // `if (workspace && manifest.private)` (lib/commands/publish.js, npm 11.16) — it fires
            // only while iterating workspaces, so a direct `cd build && pnpm publish` in this
            // directory publishes a private package without complaint. Verified against npm 11.16
            // and pnpm 10.12.
            //
            // So this is a signal and a workspace-iteration guard, NOT the thing standing between
            // the agentic product and the registry. The gates that actually hold are, in order:
            // config/releasePackages.ts (resolves the publish set from the manifest), the absent
            // `release:package` script, and — the only registry-enforced one — an npm automation
            // token scoped to just the publishable packages.
            //
            // Inert otherwise: nothing reads build/package.json except the publish step (examples
            // resolve through the *source* package.json exports).
            if (heldFromNpm.has(basename(dirname))) {
              jsonPublish.private = true;
            }
            // jsonPublish.module = `esm/index${minify ? '.min' : ''}.js`;
            // jsonPublish.main = `cjs/index${minify ? '.min' : ''}.js`;
            // if (isProduction) {
            //   jsonPublish.publishConfig = {
            //     access: "public"
            //   };
            // }
            if (pkg.sideEffects) {
              jsonPublish.sideEffects = pkg.sideEffects;
            }
            if (pkg.homepage) {
              jsonPublish.homepage = pkg.homepage;
            }
            if (pkg.repository) {
              jsonPublish.repository = pkg.repository;
            }
            if (pkg.bugs) {
              jsonPublish.bugs = pkg.bugs;
            }
            if (pkg.author) {
              jsonPublish.author = pkg.author;
            }
            if (pkg.keywords) {
              jsonPublish.keywords = pkg.keywords;
            }

            if (pkg.dependencies) {
              jsonPublish.dependencies = { ...pkg.dependencies };
              updateDependencyVersion(jsonPublish.dependencies, manifestVersion);
              if (isCli && publishSheetXLDependencies) {
                for (const name of Object.keys(jsonPublish.dependencies)) {
                  if (!name.startsWith('@sheetxl/')) continue;
                  if (publishSheetXLDependencies.includes(name)) jsonPublish.dependencies[name] = manifestVersion;
                  else delete jsonPublish.dependencies[name];
                }
              }
            }
            if (pkg.peerDependencies) {
              jsonPublish.peerDependencies = { ...pkg.peerDependencies };
              updateDependencyVersion(jsonPublish.peerDependencies, manifestVersion);
            }
            // Without it every optional peer publishes as required, and npm installs it (or `npm ls`
            // reports it missing) for consumers that never load it.
            if (pkg.peerDependenciesMeta) {
              jsonPublish.peerDependenciesMeta = { ...pkg.peerDependenciesMeta };
            }
            if (!isCli) {
              if (pkg.devDependencies) {
                jsonPublish.devDependencies = { ...pkg.devDependencies };
                updateDependencyVersion(jsonPublish.devDependencies, manifestVersion);
              }
            }
            return JSON.stringify(jsonPublish, null, 2);
          },
          rename: () => 'package.json'
        }
      ],
      // verbose: true
  }),
  )

  // Group the React runtime into a single 'react' chunk. Function form: rolldown (vite 8's
  // bundler) only supports manualChunks as a function, not the object `{ name: [...] }` form.
  const manualChunks = includeReact ? (id: string): string | undefined => {
    if (/[\\/]node_modules[\\/](react|react-dom)[\\/]/.test(id)) {
      return 'react';
    }
    return undefined;
  } : undefined

  // we don't want to merge
  const defaultOutputs:OutputOptions[]|OutputOptions|undefined = !isApp ? [
    // --- Configuration for libs - ESM only ---
    {
      format: 'es',
      // All paths are hardcoded for the ESM output
      entryFileNames: entries ? 'esm/[name].mjs' : 'esm/index.mjs',
      chunkFileNames: `esm/${namingPattern}.mjs`,
      assetFileNames,
      manualChunks
    },
  ] : {
    // Hashed like every chunk: a cached entry from an older deployment would request chunks that no
    // longer exist.
    entryFileNames: `assets/${namingPattern}.js`,
    chunkFileNames: `assets/${namingPattern}.js`,
    assetFileNames: `assets/${namingPattern}[extname]`,
    manualChunks,
  };

  const rollupOptions: RolldownOptions = overrides.build?.rollupOptions || {};
  let output: OutputOptions | OutputOptions[] | undefined = undefined;
  let input: InputOption | undefined = rollupOptions?.input;

  // Use the standard esm output unless a package supplies its own rollup `output`. (Overriding
  // only `build.lib.entry` - e.g. the formula packages pointing at their generated entry - must NOT
  // disable the default output naming, or package.json `import` (esm/index.mjs) won't resolve.)
  if (!overrides.build?.rollupOptions?.output && !isCli) {
    output = defaultOutputs;
  }

  if (!isApp && !isCli && !(rollupOptions?.input as any)?.['cli']) {
    overrides.build = {
      ...overrides.build,
      lib: {
        entry: entries ? {
          index: resolve(dirname, 'src/index.ts'),
          ...Object.fromEntries(Object.entries(entries).map(([name, src]) => [name, resolve(dirname, src)])),
        } : resolve(dirname, 'src/index.ts'),
        name: packageNameToPascalCase(pkg.name),
        cssFileName: 'style',//packageNameToPascalCase(pkg.name),
        ...overrides.build?.lib,
      }
    }
  }

  const defaultConfig:UserConfig = defineConfig({
    // `pnpm build:demos` builds each demo app under its own path on the shared demos host
    // (`/<example>/`). Unset, an app is served from the root.
    ...(isApp && process.env.SHEETXL_DEMO_BASE ? { base: process.env.SHEETXL_DEMO_BASE } : {}),
    worker: {
      format: 'es',
      rolldownOptions: {
        output: {
          codeSplitting: false, // ✅ Bundle everything in workers
        }
      }
    },
    // Force a single physical copy of React/emotion. In this monorepo some package dirs (e.g.
    // packages/utils-mui) are symlinked into sibling workspaces (vscode-ext), whose `pnpm install`
    // can repoint their node_modules at a different React. dedupe makes Vite resolve these from the
    // app root regardless, preventing "Invalid hook call" / "@emotion/react already loaded".
    ...(isUI ? {
      resolve: {
        dedupe: [
          'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime',
          '@emotion/react', '@emotion/styled', '@emotion/cache',
        ],
      },
    } : {}),
    // optimizeDeps: {
    //   // exclude: isProduction ? external as string[] : ['typescript'],
    // },
    define: {
      __DEV__: !isProduction,
      __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
      __BUILD_VERSION__: JSON.stringify(isLocalVersion ? 'local' : version),
      ...licenseKeysDefine(!isLocalVersion),
      // TODO - remove this
      'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
      // Third-party code we BUNDLE still reaches for node's `process` (react-draggable's
      // `process.env.DRAGGABLE_DEBUG`, path-browserify's `process.cwd()`). A consumer whose bundler
      // does not shim `process` - rsbuild/rspack and esbuild do not - gets a "process is not defined"
      // ReferenceError at runtime, so fold these away in the browser output.
      //
      // Targeted keys ON PURPOSE: defining `process` itself would flip our own
      // `typeof process !== 'undefined'` guards to the NODE path inside a browser.
      ...(isNode ? {} : {
        'process.env.DRAGGABLE_DEBUG': 'undefined',
        'process.cwd': '(() => "/")',
      })
    },
    plugins,
    build: {
      // base: './',
      // sourcemap: true,
      // minify: false,
      // minify: 'terser', // 'esbuild'
      // terserOptions: {
      //   mangle: true,
      //   compress: true,
      //   format: {
      //     comments: false,
      //     // comments: /@license/i, // Only keep license comments
      //   },
      // },
      // Apps own their output directory, and hashed chunks from earlier builds would otherwise pile up
      // in it (and be precached by the app's service worker).
      emptyOutDir: isApp,
      ssr: isNode,              // same as top-level ssr:true
      target: isNode ? 'node22' : 'esnext',
      outDir: resolve(dirname, `build/${isNode ? (isCli ? '' : 'node') : 'browser'}`),
      lib: false,
      // cssCodeSplit: false, // ✅ keeps CSS inline in JS
      rollupOptions: {
        input,
        external,
        output,
        onwarn(warning, next) {
          if ((
            warning.code === 'EMPTY_BUNDLE' ||
            warning.code === 'MISSING_GLOBAL_NAME' ||
            warning.code === 'CIRCULAR_DEPENDENCY') ||
            (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes(`use client`)) ||
            warning.message.includes('Use of eval in') // node modules
          ) {
            // https://github.com/rollup/rollup/issues/4699
            // rollup doesn't like circular dependencies but they are allowed by es
            return;
          }
          // PLUGIN_TIMINGS just reports that a plugin was slow (here: the terser minify pass, which is
          // kept deliberately — it produces the smallest bundle, smaller than rolldown/esbuild builtins).
          // There is nothing to fix and no timing threshold to tune, so silence this informational notice.
          if (warning.code === 'PLUGIN_TIMINGS') {
            return;
          }
          // CLI builds bundle everything into a single executable (external() returns false for isCli),
          // so code-splitting is intentionally disabled and every dynamic import is "ineffective for
          // splitting" by design. Silence that diagnostic for CLI bundles only; library builds (where a
          // defeated lazy split is a real problem) keep it active.
          if (isCli && warning.code === 'INEFFECTIVE_DYNAMIC_IMPORT') {
            return;
          }
          return next(warning);
        }
      }
    },
    preview: {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
        'Access-Control-Allow-Headers': '*',
        // 'Cross-Origin-Opener-Policy': 'same-origin',
        // 'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'unsafe-none',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
      }
    },
    server: {
      middlewareMode: false,
      watch: {
        ignored: ["**/node_modules/**", "**/build/**"],
        // ignored: ["!**/node_modules/**"] // Ensure package changes trigger reloads
      },
      headers: {
        // "Cross-Origin-Opener-Policy": "same-origin",
        // "Cross-Origin-Embedder-Policy": "require-corp",
        'Cross-Origin-Opener-Policy': 'unsafe-none',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
      },
      // hmr: {
      //   overlay: true // Show HMR errors in the browser
      // }
    },
  });

  // Deeply merge the generated default config with any package-specific overrides
  let retValue = mergeConfig(defaultConfig, overrides);

  // The browser build aliases `path` to a POSIX shim (monaco imports it implicitly). This must NOT
  // apply under Vitest: tests use real OS paths (e.g. os.tmpdir() FS round-trips), and path-browserify
  // treats Windows drive letters as relative — joining them onto cwd and breaking FS tests. The root
  // vitest.config.ts is unaffected (it never calls this factory), but a package-scoped run
  // (`vitest --root packages/<pkg>`) loads this config, so guard the alias out during tests.
  if (!isNode && !process.env.VITEST) {
    retValue = mergeConfig(retValue, {
      resolve: {
        alias: {
          // `monaco-editor-auto-typings` (bundled by @sheetxl/scripting-react) imports bare `path`.
          // Verified 2026-07-28 by pointing this at a nonexistent package and building all 18:
          // scripting-react was the ONLY failure, so it is the only package that needs the alias.
          path: 'path-browserify',
        }
      }
    });
  }
  // console.log(`Generated Vite config for ${pkg.name} at ${dirname}: \n${JSON.stringify(retValue, null, 2)}`);
  return retValue;
}