import { type UserConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { createLibraryConfig } from '../../config/vite.base.config.ts';
import pkg from './package.json';

const overrides: UserConfig = {
  build: {
    outDir: 'build', // Changes output directory from 'dist' to 'build'
    rollupOptions: {
      // input: {
      //   main: 'index.html',
      // },
    },
  },
  plugins: [
    VitePWA({
      // `src/pwa.tsx` registers the service worker and asks before a new version takes over, so an
      // open session never runs chunks from two different builds.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'SheetXL Studio',
        short_name: 'SheetXL',
        description: 'SheetXL',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#000000',
        background_color: '#ffffff',
        icons: [
          { src: 'img/logo_x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'img/logo_x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
        ]
      },
      workbox: {
        // The whole app is a few megabytes, so all of it is precached and every feature works offline
        // after one install.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,wasm,woff2}'],
        globIgnores: ['licenses/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Chunk names are content hashes, so they need no revision query.
        dontCacheBustURLsMatching: /^assets\//,
        navigateFallback: 'index.html',
        // Opening a file directly (a license, `robots.txt`) is not a route of the app.
        navigateFallbackDenylist: [/\/[^/?]+\.[^/?]+$/],
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Libraries loaded from a CDN when a feature is first used (TypeScript and esbuild for
            // scripting, the XML libraries for FILTERXML). Kept once used; never fetched ahead of use.
            urlPattern: ({ url }) => url.origin === 'https://esm.sh' || url.origin === 'https://cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'sheetxl-cdn',
              expiration: { maxEntries: 200, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
};

export default createLibraryConfig({
  overrides,
  dirname: __dirname,
  pkg,
  isUI: true,
  isApp: true
});
