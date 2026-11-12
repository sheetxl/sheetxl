import { type UserConfig } from 'vite';

import { createLibraryConfig } from '../../config/vite.base.config.ts';
import pkg from './package.json';

const overrides: UserConfig = {
  build: {
    outDir: 'build', // Changes output directory from 'dist' to 'build'
    rollupOptions: {
    },
  }
};

export default createLibraryConfig({
  overrides,
  dirname: __dirname,
  pkg,
  isUI: true,
  isApp: true
});
