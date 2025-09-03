import { createLibraryConfig } from '../../config/vite.base.config.ts';
import pkg from './package.json';


export default createLibraryConfig({
  dirname: __dirname,
  pkg,
  overrides: {
    resolve: {
      alias: {
        // 'react': path.resolve(__dirname, 'src/polyfills/react.ts'),
        // 'react/jsx-runtime': path.resolve(__dirname, 'src/polyfills/react.ts'),
        // 'react-dom/client': path.resolve(__dirname, 'src/polyfills/react-dom-client.ts'),
        // // Add an alias for react-dom's main entry too, just in case
        // 'react-dom': path.resolve(__dirname, 'src/polyfills/react-dom.ts'),
      },
    },
    build: {
      outDir: 'build/cdn',
      minify: true,
      sourcemap: false, // not for cdn
      lib: {
        name: 'StudioVanilla',
        entry: 'src/sheetxl.ts',
        formats: ['es']
      },
      rollupOptions: {
        output: {
          entryFileNames: 'index.js',
          chunkFileNames: 'assets/[hash:16].js',
          assetFileNames: 'assets/[hash:16][extname]'
        }
      }
    }
  },
  isUI: true,
  includeReact: true,
  includeSheetXL: true
});