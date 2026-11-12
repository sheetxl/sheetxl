// Self-referencing conditional subpath — see `LocaleResource.ts`. This package's node and browser
// builds each inline the twin they resolved, so other packages reach the resolver through here.
import { listResources as _listResources } from '@sheetxl/utils/resource';

import { type ResourceIndex } from './Types';

/**
 * List the resource indexes published for a package under a resource kind.
 *
 * @param kind The resource namespace, such as `'locales'` or `'templates'`.
 * @param pkg The package the resources belong to.
 * @param base A base to search after the user resource roots, or `null` for none.
 * @param fromUrl Node only. The `import.meta.url` to locate the package's own resources from.
 */
export function listResources(
  kind: string, pkg: string, base: string | null, fromUrl?: string
): Promise<ResourceIndex[]> {
  return _listResources(kind, pkg, base, fromUrl);
}
