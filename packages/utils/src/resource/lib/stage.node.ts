/**
 * Stage installed packages' `resources/` into a single served tree — the framework-agnostic core of
 * what `ResourcesPlugin` does for a Vite app, callable from ANY build (esbuild, webpack, a plain
 * script, a VSCode extension's packaging step).
 *
 * ## Why a consumer needs this
 *
 * A browser/webview cannot read `node_modules`, and the resolver expects one unified layout —
 * `<base>/<kind>/<pkg>/<relPath>` with an authoritative root `contents.json` — not the per-package
 * `node_modules/<pkg>/resources/<kind>/...` layout the packages ship in. This copies the installed
 * packages' resources INTO that unified layout and (re)writes the root listing, so the result can be
 * served statically and pointed at with a single `addResourceRoot(url)` (or `setLocaleResourceBase`).
 *
 * Kind-agnostic by construction: it copies whatever `resources/<kind>/...` a package ships — locales
 * today, fonts/scripts next — so one staging step covers every resource kind at once.
 *
 * Per-package `contents.json` files are copied **as-is** (they already carry the build's extracted
 * metadata — a catalog's `scope`, a message file's `role`), so this needs no resource-kind
 * registration. Only the ROOT listing is regenerated, by scanning the staged tree (paths only).
 *
 * Node-only (it reads and writes files). The browser twin throws — see `builder.browser.ts`.
 */
import { CONTENTS_FILE } from '../Resource';
import { RESOURCE_DIR, walkResourceFiles, writeRootIndex } from './builder.node';

// Node built-ins loaded through a VARIABLE specifier, same reason as the rest of this lib: a literal
// makes TypeScript demand `@types/node` (present in some monorepo packages, not others) and makes a
// browser bundler try to follow the import.
const _builtin = (name: string): Promise<any> => import(/* @vite-ignore */ /* webpackIgnore: true */ name);

export interface StageResourcesOptions {
  /** Absolute destination dir; the served tree is written as `<outDir>/<kind>/<pkg>/<relPath>`. */
  outDir: string;
  /** Project whose `node_modules` is scanned for installed resource-owning packages. Default: `cwd`. */
  projectRoot?: string;
  /** Only stage packages whose name matches. Default: any package under the `@sheetxl/` scope. */
  filter?: (pkgName: string) => boolean;
  /** Remove `outDir` before staging so a removed/renamed resource cannot linger. Default: `true`. */
  clean?: boolean;
}

export interface StageResourcesResult {
  /** Package names staged (those that actually shipped a `resources/` dir). */
  packages: string[];
  /** Total resource files copied (excluding regenerated listings). */
  files: number;
}

/** Read a package.json, or `null` if absent/unreadable. */
async function _readJson(file: string): Promise<any | null> {
  const fs = await _builtin('node:fs/promises');
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * The installed directory of `dep` as seen from `fromDir`, following symlinks (pnpm/workspace) so the
 * real package — where its own `node_modules` and `resources/` live — is returned.
 */
async function _installedDir(fromDir: string, dep: string): Promise<string | undefined> {
  const fs = await _builtin('node:fs/promises');
  const path = await _builtin('node:path');
  try {
    return await fs.realpath(path.resolve(fromDir, 'node_modules', ...dep.split('/')));
  } catch {
    return undefined;
  }
}

/**
 * Every resource-owning package reachable from `projectRoot`, walked through the dependency graph
 * (not a flat `node_modules` scan) so a transitively-installed pack is found under any package
 * manager's layout. Returns `pkgName -> installedDir`.
 */
async function _discover(
  projectRoot: string,
  filter: (pkgName: string) => boolean
): Promise<Map<string, string>> {
  const fs = await _builtin('node:fs/promises');
  const path = await _builtin('node:path');
  const found = new Map<string, string>();
  const seen = new Set<string>();

  const rootPkg = await _readJson(path.join(projectRoot, 'package.json'));
  const queue: { dep: string; from: string }[] = Object.keys(rootPkg?.dependencies ?? {})
    .concat(Object.keys(rootPkg?.devDependencies ?? {}))
    .filter(filter)
    .map((dep) => ({ dep, from: projectRoot }));

  while (queue.length > 0) {
    const { dep, from } = queue.shift()!;
    if (seen.has(dep)) continue;
    seen.add(dep);
    const dir = await _installedDir(from, dep);
    if (!dir) continue;
    // Keep walking from the installed dir — that is where this package's own deps resolve from.
    const depPkg = await _readJson(path.join(dir, 'package.json'));
    for (const next of Object.keys(depPkg?.dependencies ?? {})) {
      if (filter(next)) queue.push({ dep: next, from: dir });
    }
    try {
      const stat = await fs.stat(path.join(dir, RESOURCE_DIR));
      if (stat.isDirectory()) found.set(dep, dir);
    } catch {
      /* no resources/ — this package contributes nothing */
    }
  }
  return found;
}

/**
 * Stage every installed resource-owning package into `outDir` as `<kind>/<pkg>/<relPath>`, then write
 * the authoritative root `contents.json`. Returns what was staged.
 */
export async function stageResources(options: StageResourcesOptions): Promise<StageResourcesResult> {
  const fs = await _builtin('node:fs/promises');
  const path = await _builtin('node:path');
  const proc = await _builtin('node:process');

  const projectRoot = options.projectRoot ?? proc.cwd();
  const filter = options.filter ?? ((name: string) => name.startsWith('@sheetxl/'));
  const outDir = options.outDir;

  if (options.clean !== false) await fs.rm(outDir, { recursive: true, force: true });

  const packages = await _discover(projectRoot, filter);
  let files = 0;
  for (const [pkgName, dir] of packages) {
    const resourcesDir = path.join(dir, RESOURCE_DIR);
    for (const rel of await walkResourceFiles(resourcesDir)) {
      // `rel` is `<kind>/<...>`. The package-ROOT listing (`resources/contents.json`) is not staged —
      // the staged tree gets its own root listing spanning every package. The per-package-per-kind
      // listing (`<kind>/contents.json`) IS copied: it already carries the build's extracted metadata.
      if (rel === CONTENTS_FILE) continue;
      const slash = rel.indexOf('/');
      if (slash < 0) continue; // a stray file directly under resources/ with no kind — skip
      const kind = rel.slice(0, slash);
      const within = rel.slice(slash + 1);
      const dest = path.join(outDir, kind, pkgName, within);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(path.join(resourcesDir, rel), dest);
      files++;
    }
  }

  // The root listing, written by scanning the staged tree so it cannot disagree with what is on disk.
  await fs.mkdir(outDir, { recursive: true });
  await writeRootIndex(outDir);

  return { packages: [...packages.keys()], files };
}
