import { type UserConfig } from 'vite';

import { createLibraryConfig } from '../../config/vite.base.config.ts';
// Relative (not the bare `@sheetxl/scripting/vite/formula-compiler` specifier) so Vite's config
// loader bundles it with esbuild instead of externalizing the .ts through Node's ESM resolver.
import { FormulaCompilerPlugin } from '../scripting/src/plugin/vite.ts';
import pkg from './package.json';

const isDevelopment = process.env.NODE_ENV === 'development';

// Generate the bound formula manifest (entry + decl + desc) into ./src/.generated. The entry
// imports each impl from its real source, so breakpoints/HMR resolve to the originals. The package
// entry IS that generated manifest (there is no committed src/index.ts).
const overrides: UserConfig = {
  plugins: [
    FormulaCompilerPlugin({
      inputDir: './src',
      outputDir: './src/.generated',
      verbose: isDevelopment || process.env.VITE_FORMULA_VERBOSE === 'true',
      skipIfUpCurrent: isDevelopment || process.env.VITE_FORMULA_SKIP_CURRENT === 'true',
    }),
  ],
};

// `declarations` is the declarations alone, for a consumer that reads them without running a function.
export default createLibraryConfig({
  dirname: __dirname,
  pkg,
  overrides,
  entries: {
    index: 'src/.generated/index.ts',
    declarations: 'src/.generated/declarations.ts'
  }
});
