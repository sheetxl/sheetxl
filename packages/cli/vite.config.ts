import * as path from 'path';

import { type UserConfig } from 'vite';

import preserveShebang from 'rollup-plugin-preserve-shebang';

import { createLibraryConfig } from '../../config/vite.base.config.ts';
import pkg from './package.json';

const overrides: UserConfig = {
  ssr: {
    // noExternal: true,
    target: 'node'
  },
  publicDir: false, // we manually copy assets
  build: {
    ssr: true,
    target: 'node22',
    sourcemap: false, // not for cli
    rollupOptions: {
      input: {
        cli: path.resolve(__dirname, 'src/cli.ts'),
        index: path.resolve(__dirname, 'src/index.ts'),
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js', // Output cli.js and index.js
        chunkFileNames: 'assets/[hash:16].js',
        assetFileNames: 'assets/[hash:16][extname]'
      },
      plugins: [preserveShebang()]
    }
  }
};


// Export the result of the factory function with our custom overrides
export default createLibraryConfig({
  dirname: __dirname,
  pkg,
  overrides,
  isUI: false,
  isCli: true
});