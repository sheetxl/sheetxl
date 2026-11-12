// Self-referencing conditional subpath — see `Listing.ts`.
import { loadResource as _loadResource } from '@sheetxl/utils/resource';

/**
 * Read and parse one resource file of a package: the highest-precedence copy across the resource
 * roots, then the package's own.
 *
 * @param kind The resource namespace, such as `'locales'` or `'fonts'`.
 * @param pkg The package the resource belongs to.
 * @param relPath The file's path within `<kind>/<pkg>/`.
 * @param base A base to search after the user resource roots, or `null` for none.
 * @param fromUrl Node only. The `import.meta.url` to locate the package's own resources from.
 *
 * @throws when no root has the file; the message lists every location tried.
 */
export function loadResource<T = unknown>(
  kind: string, pkg: string, relPath: string, base: string | null, fromUrl?: string
): Promise<T> {
  return _loadResource<T>(kind, pkg, relPath, base, fromUrl);
}
