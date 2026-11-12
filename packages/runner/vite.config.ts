import { createLibraryConfig } from '../../config/vite.base.config.ts';
import pkg from './package.json';

// Export the result of the factory function, passing in our local context.
// Runner is a Node-only library, so we use the isNodeLib flag
export default createLibraryConfig({
  dirname: __dirname,
  pkg,
  isNodeLib: true
});