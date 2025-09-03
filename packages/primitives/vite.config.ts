import { createLibraryConfig } from '../../config/vite.base.config';
import pkg from './package.json';

// Export the result of the factory function, passing in our local context.
// We provide no overrides, so it will use all the generated defaults.
export default createLibraryConfig({ dirname: __dirname, pkg });