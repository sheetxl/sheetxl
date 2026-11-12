import { createVitestConfig } from '../../config/vitest.shared.config';

/**
 * Package-local vitest config so `vitest` (CLI or IDE extension) works from this directory.
 * Without it vitest falls back to `vite.config.ts` — the library BUILD config — and tests die
 * on the `virtual:sheetxl/bundled-locale` import. See `config/vitest.shared.config.ts`.
 */
export default createVitestConfig();
