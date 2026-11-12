/**
 * What the resource folder makes public on the main `@sheetxl/utils` entry point: the type-only
 * shapes, plus {@link listResources} and {@link loadResource} for packages that read a resource
 * listing or one of their own resource files.
 *
 * Otherwise deliberately types only. Both halves of the resource system are platform-split and reached through
 * their own conditional subpath — `@sheetxl/utils/resource` for the runtime resolver, and
 * `@sheetxl/utils/resource/build` for the node-only listing builder — so a consumer resolves the
 * implementation that suits its platform. Re-exporting either of those here would put node-only
 * machinery (and `CONTENTS_FILE`, `RESOURCE_DIR`, the whole write side) on the isomorphic barrel and
 * defeat those conditions.
 *
 * The types have no such problem: they are erased, identical on both platforms, and a package that
 * OWNS a resource format has to be able to name {@link ResourceKindDefinition} without importing a
 * build module — that import survives into its published `.d.ts`.
 *
 * {@link listResources} and {@link loadResource} are wrappers, not re-exports: the subpath is not
 * published, so other packages cannot import it, and a re-export would leave that subpath in the
 * emitted `.d.ts`.
 *
 * (`./Resource` is internal shared implementation, imported directly by the two twins. It is not
 * re-exported here: it carries `CONTENTS_FILE` and the raw root-search helpers.)
 */
export * from './Types';
export * from './Listing';
export * from './Loading';
export * from './Channel';
