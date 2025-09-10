import { resolve, isAbsolute, extname } from 'path';
import { builtinModules } from "node:module";
import { readFileSync } from 'fs'; // Import the Node.js file system module
import {
  defineConfig, mergeConfig, type UserConfig, type PluginOption,
  type BuildEnvironmentOptions
} from 'vite';

import { type InputOption, type RollupOptions, type OutputOptions } from 'rollup';

import dts from 'vite-plugin-dts';
import tsconfigPaths from 'vite-tsconfig-paths';
import license from 'rollup-plugin-license';
import copy from 'rollup-plugin-copy';

import terser from '@rollup/plugin-terser';

// only for ui
import react from '@vitejs/plugin-react';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import svgr from 'vite-plugin-svgr';

import { typeCheck } from './vitePluginTypeCheck';
import { obfuscator } from './vitePluginObfuscator';
import { visualizer } from 'rollup-plugin-visualizer';

interface Pkg {
  name: string;
  version?: string;
  description: string;
  peerDependencies?: Record<string, string>;
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
 * (C) 2025-present SheetXL Inc. & Michael T. Ford
 * License: The license can be found at https://www.sheetxl.com/license.
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

const readmeTransform = (contents: Buffer, _filename: string) => {
  return contents.toString() + README_TAIL;
}

function packageNameToPascalCase(packageName: string): string {
  return packageName
    .replace(/@.*\//, '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function updateDependencyVersion(dependencies: Record<string, string>, version: string) {
  if (!dependencies) return;
  Object.keys(dependencies).forEach(function(key) {
    if (key.startsWith('@sheetxl/')) {
      dependencies[key] = `^${version}`;
    }
  });
}

const ASSET_EXTS = new Set([".css", ".scss"]);//, ".sass", ".less", ".styl", ".pcss"]);

const basePkgName = (id: string) => {
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

  build?: BuildEnvironmentOptions;

  isCli?: boolean; // Whether this is a CLI package
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
    isUI = false, // Default to false if not specified
    isApp = false, // Default to false if not specified
    includeReact = (options?.isUI && options?.isApp), // UI apps
    includeSheetXL = false,
  } = options;

   // process.env.NODE_ENV === 'production' &&
  const isNode = isCli || process.env.BUILD_ENV === 'node';

  let overrides = { ...options.overrides } as UserConfig;

  // to use call pnpm --analyze <script>
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
    if (isNode && nodeBuiltins.has(id)) {
      // console.log('exclude node');
      return true;
    }

    const base = basePkgName(id);
    if (peerDeps.has(base) || optionalDependencies.has(base)) {
      // console.log('exclude peer', base);
      return true;
    }
    if (isApp || isCli) return false;
    // Externalize all @sheetxl/* packages (and their subpaths)
    if (!includeSheetXL && sheetxlDeps.has(base)) {
      // console.log('exclude sheetxl', base);
      return true;
    }
    return false;
  };

  let plugins:PluginOption[] = isUI ? [
    react(), // move to only the packages that are ui based.
    cssInjectedByJsPlugin({
    }),
    tsconfigPaths({
      projects: ['./tsconfig.build.json'],
    }),
    svgr(),
  ] : [
    tsconfigPaths({
      projects: ['./tsconfig.build.json'],
    }),
  ];

  plugins.push(typeCheck());

  // Add middleware to serve TypeScript declaration files during development
  if (!isProduction && isUI) {
    plugins.push({
      name: 'serve-types-middleware',
      configureServer(server) {
        server.middlewares.use('/types/scripting.d.ts', async (req, res, next) => {
          try {
            // assumes this is running from the root/examples/xxx directory
            const typesPath = resolve(dirname, '../../packages/sdk/build/types/scripting.d.ts');
            const content = readFileSync(typesPath, 'utf-8');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'no-cache');
            res.end(content);
          } catch (error) {
            console.warn('TypeScript declaration file not found:', error.message);
            res.statusCode = 404;
            res.end('TypeScript declaration file not found. Run `pnpm build:types-scripting` first.');
          }
        });
      }
    });
  }

  // We have to not generate for node as there is a race condition
  // when generating types 2x quickly (file system race I think)
  if (!isApp && !isNode) {
    plugins.push(dts({
      // The output directory for the final bundled .d.ts files
      outDir: resolve(dirname, `build/types`),
      // This is a crucial option. It tells the plugin to bundle all
      // type declarations into a single file for each entry point.
      // This prevents the messy, scattered .d.ts files.
      tsconfigPath: resolve(dirname, './tsconfig.build.json'),
      exclude: ['src/loader.ts'],
      rollupTypes: true,
      insertTypesEntry: true
    }));
  }
  if (isProduction) {
    plugins.push(obfuscator());  // obfuscate if needed
    plugins.push(terser({
      maxWorkers: 4,
        format: {
        comments: /@vite-ignore|webpackIgnore/
      }
    }));
    plugins.push(license({
      banner: createBanner(pkg, version),
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

        { src: `${repoDir}/README.md`, dest: `${buildDir}` },
        { src: `${dirname}/README.md`.replace(/\\/g, '/'), dest: `${buildDir}`, transform: readmeTransform },
        { src: `${publishDir}/README.md`, dest: `${buildDir}`, transform: readmeTransform },

        { src: `${repoDir}/LICENSE.md`, dest: `${buildDir}` },
        { src: `${dirname}/LICENSE.md`.replace(/\\/g, '/'), dest: `${buildDir}` },
        { src: `${publishDir}/LICENSE.md`, dest: `${publishDir}` },
        {
          src: publishJson, dest: `${buildDir}`,
          transform: (contents: Buffer, _filename: string) => {
            let jsonPublish = JSON.parse(contents.toString());
            jsonPublish = {
              name: pkg.name,
              description: pkg.description,
              version,
              license: pkg.license,
              ...jsonPublish,
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
              updateDependencyVersion(jsonPublish.dependencies, version);
            }
            if (pkg.peerDependencies) {
              jsonPublish.peerDependencies = { ...pkg.peerDependencies };
              updateDependencyVersion(jsonPublish.peerDependencies, version);
            }
            if (!isCli) {
              if (pkg.devDependencies) {
                jsonPublish.devDependencies = { ...pkg.devDependencies };
                updateDependencyVersion(jsonPublish.devDependencies, version);
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

  const manualChunks = includeReact ? {
    // This is where you can define your manual chunks for ESM
    'react': ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
  } : undefined

  // we don't want to merge
  const defaultOutputs:OutputOptions[]|OutputOptions|undefined = !isApp ? [
    // --- Configuration for libs - ESM & CJS Build ---
    {
      format: 'es',
      // All paths are hardcoded for the ESM output
      entryFileNames: 'esm/index.mjs',
      chunkFileNames: `esm/${namingPattern}.mjs`,
      assetFileNames,
      manualChunks
    },
  ] : {
    entryFileNames: `assets/index.js`,
    chunkFileNames: `assets/${namingPattern}.js`,
    assetFileNames: `assets/${namingPattern}[extname]`,
  };

  if (!isNode && !isCli && Array.isArray(defaultOutputs)) {
    defaultOutputs.push({
      format: 'cjs',
      // All paths are hardcoded for the CJS output
      entryFileNames: 'cjs/index.cjs',
      chunkFileNames: `cjs/${namingPattern}.cjs`,
      assetFileNames,
      manualChunks
    });
  }

  const rollupOptions: RollupOptions = overrides.build?.rollupOptions || {};
  let output: OutputOptions | OutputOptions[] | undefined = undefined;
  if (!overrides.build?.lib && !isCli) {
    output = defaultOutputs;
  }

  const input: InputOption | undefined = rollupOptions?.input;
  if (!isApp && !rollupOptions?.input?.['cli']) {
    overrides.build = {
      ...overrides.build,
      lib: {
        entry: resolve(dirname, 'src/index.ts'),
        name: packageNameToPascalCase(pkg.name),
        cssFileName: 'style',//packageNameToPascalCase(pkg.name),
        ...overrides.build?.lib,
      }
    }
  }

  const defaultConfig:UserConfig = defineConfig({
    worker: {
      format: 'es',
        rollupOptions: {
        output: {
          inlineDynamicImports: true, // ✅ Bundle everything in workers
          manualChunks: undefined,
        }
      }
    },
    // resolve: {
    //   dedupe: ['@sheetxl/react-util']
    // },
    // optimizeDeps: {
    //   // exclude: isProduction ? external as string[] : ['typescript'],
    // },
    define: {
      __DEV__: !isProduction,
      __BUILD_DATE__: JSON.stringify(new Date().toDateString()),
      __BUILD_VERSION__: JSON.stringify(isLocalVersion ? 'local' : version),
      // TODO - remove this
      'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
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
      emptyOutDir: false,
      ssr: isNode,              // same as top-level ssr:true
      target: isNode ? 'node22' : 'esnext',
      outDir: resolve(dirname, `build/${isNode ? (isCli ? '' : 'node') : 'browser'}`),
      lib: false,
      // cssCodeSplit: false, // ✅ keeps CSS inline in JS
      rollupOptions: {
        input,
        maxParallelFileOps: 20, // make lower if "Too many open files" errors on Windows
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
          return next(warning);
        }
      }
    },
    preview: {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
        'Access-Control-Allow-Headers': '*',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      }
    },
    server: {
      middlewareMode: false,
      watch: {
        ignored: ["**/node_modules/**", "**/build/**"],
        // ignored: ["!**/node_modules/**"] // Ensure package changes trigger reloads
      },
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
      // hmr: {
      //   overlay: true // Show HMR errors in the browser
      // }
    },
  });

  // Deeply merge the generated default config with any package-specific overrides
  let retValue = mergeConfig(defaultConfig, overrides);

  if (!isNode) {
    retValue = mergeConfig(retValue, {
      resolve: {
        alias: {
          // monaco doesn't import explicitly, so we need to alias it
          path: 'path-browserify',
        }
      }
    });
  }
  // console.log(`Generated Vite config for ${pkg.name} at ${dirname}: \n${JSON.stringify(retValue, null, 2)}`);
  return retValue;
}