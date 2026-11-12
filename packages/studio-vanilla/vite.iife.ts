import { createLibraryConfig } from '../../config/vite.base.config.ts';
import pkg from './package.json';

export default createLibraryConfig({
  dirname: __dirname,
  pkg,
  overrides: {
    // Aliases can likely be removed for this specific build
    resolve: {},
    build: {
      // The output directory for this specific build
      outDir: 'build/cdn',
      minify: true,
      sourcemap: false, // Not needed for the loader
      lib: {
        entry: 'src/loader.ts',
        formats: ['umd'],
        name: 'SheetXL'
      },
      // Provide an explicit single UMD output. Without an `output` here the base config injects its
      // default ES+CJS *array*, which silently overrides `lib.formats: ['umd']` (Vite warns
      // "build.lib.formats will be ignored...") and the loader ends up as ESM/CJS instead of UMD.
      rollupOptions: {
        output: {
          name: 'SheetXL',
          entryFileNames: 'loader.js'
          // No inlineDynamicImports: UMD can't code-split, so Vite already forces codeSplitting:false
          // (which inlines dynamic imports). Setting it explicitly is redundant and warns.
        }
      }
    },
    server: {}
  },
  isUI: true,
  includeReact: true,
  includeSheetXL: true
});