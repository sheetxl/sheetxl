/**
 * Module-init registration of the `@sheetxl/utils-mui` locale resources.
 *
 * This package ships NO command catalogs — only call-site (`t()`) strings for its own generic chrome
 * (the overflow "More" tooltip, the internal-window Close button). They live in
 * `locales/<tag>/messages.json` and are declared by the same per-locale `manifest.json` the command
 * catalogs use, so one loader covers both kinds of resource (I18N-DESIGN.md decision 6 — packages own
 * their own strings, and several packages merge into one language without clobbering).
 *
 * Fetched at runtime from the host-configured locale base (`setLocaleResourceBase`), not
 * `import.meta.url` — which is unreliable once this library is re-bundled by a consumer.
 */
import { Command } from '@sheetxl/utils-react';

import { messages as enMessages } from 'virtual:sheetxl/bundled-locale';

const { DefaultCommandCatalogService } = Command;

let registered = false;

/** Register this package's locale resources (bundled `en` floor + all fetched locales). Idempotent. */
export function registerUtilsMuiLocales(): void {
  if (registered) return;
  registered = true;
  // `enMessages` is the bundled floor — zero-config `en` with nothing served; fetched packs layer on top.
  void DefaultCommandCatalogService.registerFromManifest('@sheetxl/utils-mui', import.meta.url, { messages: enMessages });
}
