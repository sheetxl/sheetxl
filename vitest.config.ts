import { createVitestConfig } from './config/vitest.shared.config';

// The actual configuration lives in config/vitest.shared.config.ts, shared with the per-package
// vitest.config.ts files so `vitest` also works from a package directory (CLI or IDE extension).
export default createVitestConfig();
