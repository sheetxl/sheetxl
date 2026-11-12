import { type UserConfig } from 'vite';

import { createLibraryConfig } from '../../config/vite.base.config.ts';
import { IconPackPlugin } from '../../config/vite-plugin-icon-pack.ts';
import pkg from './package.json';

// Icon packs are authored as exported JSON; the build optimizes their path data.
const overrides: UserConfig = {
  plugins: [IconPackPlugin()]
};

export default createLibraryConfig({ dirname: __dirname, pkg, overrides, isUI: true });
