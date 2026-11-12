import { type ResourceKindDefinition } from '@sheetxl/utils';

/**
 * The `.cmd.json` command-catalog file type, as a plain descriptor.
 *
 * **This package owns the format, so this package declares it.** `@sheetxl/utils` has no idea what a
 * `scope` or a `sourceId` is and should not — the generic message format it does own is `.msg.json`;
 * command chrome is a `utils-react` concept that simply does not exist a layer down.
 *
 * Exported as DATA rather than as a self-registering side-effect module, for two reasons:
 *  - the only import is a type (erased), so nothing is pulled into any bundle that touches this file;
 *  - build tooling loads it as source by relative path, where a package-specifier import of another
 *    workspace package resolves as native ESM and cannot follow extensionless TS imports.
 *
 * Register it with `registerResourceFileType` from a node context that needs command catalogs
 * indexed. A host that does not (the CLI carries no React) simply lists such files without metadata.
 */
const COMMAND_CATALOG_FILE_TYPE = {
  suffix: '.cmd.json',
  async extract(ctx: { relPath: string; fileName: string; readJson(): Promise<any> }) {
    // Catalogs live exactly one level down, in `<tag>/`.
    const parts = ctx.relPath.split('/');
    if (parts.length !== 2) return null;
    // `scope` is authored inside the catalog; `sourceId` is the file stem, which distinguishes two
    // catalogs that own the same scope.
    const scope = (await ctx.readJson().catch(() => null))?.scope;
    if (!scope) return null; // unreadable or not a catalog — better omitted than registered broken
    return {
      locale: parts[0],
      role: 'catalog',
      scope,
      sourceId: ctx.fileName.replace(/\.cmd\.json$/, '')
    };
  },
  // The locale TAG is not inferable from the file, so it comes from the location remainder.
  place: (fileName: string, location: string | undefined) =>
    (location ? `${location}/${fileName}` : null)
};

/**
 * Adds `.cmd.json` to the `locales` kind the SDK declares — the kind is a namespace, and more than
 * one package may contribute file types to it.
 */
export const COMMAND_RESOURCE_KINDS: readonly ResourceKindDefinition[] = [
  { kind: 'locales', files: [COMMAND_CATALOG_FILE_TYPE] }
];
