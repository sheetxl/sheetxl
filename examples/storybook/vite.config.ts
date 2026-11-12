import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import * as path from 'path';
import * as fs from 'fs';

import { ResourcesPlugin } from '../../config/vite-plugin-resources';
import { LocaleBundlePlugin } from '../../config/vite-plugin-locale-bundle';
import { licenseKeysDefine } from '../../config/license-keys';

const CURRENT_DIR = process.cwd();
const REPO_DIR = path.resolve(CURRENT_DIR, `../..`);
function getPackage(sourceDir: string) {
  const buffer = fs.readFileSync(path.resolve(sourceDir, 'package.json'));
  return JSON.parse(new TextDecoder().decode(buffer));
}

function getVersion(): string {
  const pkg = getPackage(REPO_DIR);
  return pkg?.version ?? 'unknown';
}
const isProduction = process.env.NODE_ENV === 'production';
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Storybook runs its own Vite pipeline and does not inherit `createLibraryConfig` (where a real app
    // picks up `ResourcesPlugin`). Without it nothing serves `/resources/locales/...`, every locale index
    // request falls through to the SPA shell (200 text/html → treated as absent), and the runtime warns
    // "no locales for '@sheetxl/sdk' in any resource root" and renders raw message keys. In dev this
    // serves each `@sheetxl/*` dependency's locales from source; `app: true` also stages them into the
    // static `storybook build`.
    ResourcesPlugin({ root: CURRENT_DIR, pkg: getPackage(CURRENT_DIR), app: true }),
    // Storybook consumes `@sheetxl/*` as SOURCE, so it hits the `virtual:sheetxl/bundled-locale` import
    // each package's registration uses; this resolves it (as `createLibraryConfig` does for real apps).
    LocaleBundlePlugin(),
  ] as any,
  // NOTE: no vite-tsconfig-paths. It was pointed at tsconfig.build.json (which has no `paths`, only
  // project `references`), so it contributed zero mappings — a no-op. `@sheetxl/*` resolves to source
  // via each package.json's `development` export condition (→ ./src/index.ts), not tsconfig paths.
  server: {
    middlewareMode: false,
    watch: {
      ignored: ["**/node_modules/**", "**/build/**"],
      // cwd: "../.."
      // paths: ["../../packages/**"]
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
  worker: {
    format: 'es', // Use ES modules for workers
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].worker.js', // Remove hash for workers
      }
    }
  },
    define: {
      __DEV__: !isProduction,
      __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
      __BUILD_VERSION__: JSON.stringify(isProduction ? getVersion() : 'local'),
      ...licenseKeysDefine(isProduction && !['local', '0.0.0', 'unknown'].includes(getVersion())),
      // TODO - remove this
      'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
    },
  build: {
    outDir: 'build', // Changes output directory from 'dist' to 'build'
    sourcemap: false,//"hidden" // Enable debugging with source maps
    rollupOptions: {
      input: {
        main: 'index.html',
        // ...workerEntries
      },
      // output: {
      //   // Standard naming for main chunks
      // },
      external: ['crypto', 'typescript', 'esbuild-wasm'],
      plugins: [
      ],
    },
    // minify: false,
    terserOptions: {
      compress: false,
      mangle: false
    },
  }
});
