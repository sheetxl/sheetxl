import { createLibraryConfig } from '../../config/vite.base.config.ts';
import pkg from './package.json';

export default createLibraryConfig({ dirname: __dirname, pkg,
  isUI: true,
  includeReact: true,
  includeSheetXL: true
});