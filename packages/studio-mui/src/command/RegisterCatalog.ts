/**
 * Module-init registration of the `@sheetxl/studio-mui` command **chrome** catalog — the structured
 * replacement for `STUDIO_COMMAND_DEFINITIONS` (I18N-DESIGN.md decision 8). The studio chrome seeds the
 * ambient `app` scope (a second source alongside react's `clipboard`, so it pushes its own layer).
 *
 * Fetch model: catalogs ship as JSON data files under `locales/<locale>/*.cmd.json` (+ a `manifest.json`
 * emitted by the i18n Vite plugin) and load at runtime via `fetch` — see the react loader for the
 * rationale. Async; a host awaits `prefetch()` before its first reveal. Idempotent — safe to call twice.
 */
import { Command } from '@sheetxl/utils-react';

import { messages as enMessages, catalogs as enCatalogs } from 'virtual:sheetxl/bundled-locale';

const { DefaultCommandCatalogService } = Command;

let registered = false;

/** Register the studio command catalogs (bundled `en` floor + all fetched locales) into the registry. */
export function registerStudioCommandCatalogs(): void {
  if (registered) return;
  registered = true;
  const svc = DefaultCommandCatalogService;
  // Bundled floor — zero-config `en` with nothing served; fetched packs / plugins layer on top per command.
  svc.registerFromManifest('@sheetxl/studio-mui', import.meta.url, { messages: enMessages, catalogs: enCatalogs });
  // NO eager prefetch here: at module init the active tag is the default (en), so a warm-up would
  // load ENGLISH before the persisted language preference is known — a wasted fetch and the source of
  // the English flash. The reveal gate (EagerStudio) activates the persisted language and THEN awaits
  // `prefetch()`, so the right — and only the right — locale loads.
}
