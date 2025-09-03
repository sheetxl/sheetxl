import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

import * as path from 'path';
import * as fs from 'fs';

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
    tsconfigPaths({
      projects: ['./tsconfig.build.json'],
    })
  ] as any,
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
      maxParallelFileOps: 20, // make lower if "Too many open files" errors on Windows
      output: {
        entryFileNames: 'assets/[name].worker.js', // Remove hash for workers
      }
    }
  },
    define: {
      __DEV__: !isProduction,
      __BUILD_DATE__: JSON.stringify(new Date().toDateString()),
      __BUILD_VERSION__: JSON.stringify(isProduction ? getVersion() : 'local'),
      // TODO - remove this
      'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
    },
  build: {
    outDir: 'build', // Changes output directory from 'dist' to 'build'
    sourcemap: false,//"hidden" // Enable debugging with source maps
    rollupOptions: {
      maxParallelFileOps: 1, // make lower if "Too many open files" errors on Windows
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
