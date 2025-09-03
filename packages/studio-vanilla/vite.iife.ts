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
        name: 'SheetXL',
        fileName: () => 'loader.js'
      },
      rollupOptions: {}
    },
    server: {}
  },
  isUI: true,
  includeReact: true,
  includeSheetXL: true
});