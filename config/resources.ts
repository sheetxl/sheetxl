import path from 'node:path';
import fs from 'node:fs';

/**
 * Resource discovery + staging — the ONE place that knows the on-disk/served layout of runtime data
 * files.
 *
 * A "resource" is a data file shipped beside the code rather than inside the bundle: locale catalogs
 * today, fonts and script libraries next. They are fetched/read at runtime so they stay out of the JS
 * bundle and stay user-overridable.
 *
 * **Canonical layout, everywhere:** resources live under a `resources/` directory; inside it a ROOT
 * adds `<kind>/<pkg>/`, while a package omits `<pkg>` because it *is* the package. So:
 *  - a package's own source and published output — `resources/<kind>/…`
 *  - an app or CLI's staged output — `resources/<kind>/<pkg>/…`
 *  - a user's `~/.sheetxl/resources` or a `SHEETXL_RESOURCE_PATH` entry — `<kind>/<pkg>/…`
 *  - the dev server — `/resources/<kind>/<pkg>/…`
 *
 * The `resources/` segment earns its place wherever the containing directory holds NON-resource
 * content too (a package root has `src/`, `build/`, `package.json`; an app bundle has its assets;
 * `~/.sheetxl` will hold config and cache). A path handed to `SHEETXL_RESOURCE_PATH` names the
 * resource root ITSELF, so it needs no such segment.
 *
 * That single shape is the point: "what we ship" and "what a user drops in" are indistinguishable to
 * the runtime resolver (`packages/utils/src/resource/lib/resource.*.ts`), so neither needs to know
 * about the other.
 */

// The kind registry and the `contents.json` builder live in `packages/utils/src/resource/lib/` — a
// node-only module — so the package build, app staging, and the CLI writing into a user's own root all
// share ONE implementation. This file keeps only what is genuinely build-time: finding which packages
// have resources, and where.
//
// Imported by RELATIVE SOURCE PATH, and this is the ONLY way in: the builder is not part of any
// package's published API. `@sheetxl/utils` publishes a single entry point and the build machinery is
// deliberately not on it. (`@sheetxl/utils`'s own vite config also loads through
// `node_modules/.vite-temp/`, where a package self-reference could not resolve anyway.) The CLI reaches
// these same modules the same way — see `packages/cli/src/commands/resources.ts`.
export {
  RESOURCE_DIR, CONTENTS_FILE, resourceKinds, walkResourceFiles, classifyResource, placeResource,
  buildResourceIndex, writeResourceIndex, rootIndexFromPaths, buildRootIndex, writeRootIndex,
  type ResourceEntry, type ResourceIndex, type ResourceRootIndex
} from '../packages/utils/src/resource/lib/builder.node.ts';

import {
  resourceKinds, RESOURCE_DIR, registerResourceKinds
} from '../packages/utils/src/resource/lib/builder.node.ts';

// Every kind and file type the BUILD must understand, declared by whichever package OWNS that format:
// the SDK defines `locales` and `fonts`, utils-react adds `.cmd.json` to `locales`. `@sheetxl/utils`
// owns the machinery and no kinds at all.
//
// A node host with a narrower dependency set registers only what it can reach — the CLI depends on
// the SDK (so it understands locales and fonts) but carries no React, and lists `.cmd.json` without
// metadata rather than misreading it.
import { SHEETXL_RESOURCE_KINDS } from '../packages/sdk/src/resource/resourceKinds.ts';
import { COMMAND_RESOURCE_KINDS } from '../packages/utils-react/src/command/CommandCatalogResource.ts';

registerResourceKinds(SHEETXL_RESOURCE_KINDS);
registerResourceKinds(COMMAND_RESOURCE_KINDS);

/** The staged/served path for one resource file: `<kind>/<pkg>/<relPath>`. */
export function resourcePath(source: ResourceSource, relPath: string): string {
  return `${source.kind}/${source.name}/${relPath}`;
}

export interface ResourceSource {
  /** The owning package id, e.g. `'@sheetxl/sdk'`. */
  name: string;
  /** The resource kind, e.g. `'locales'`. */
  kind: string;
  /** Absolute path to that package's directory for this kind. */
  dir: string;
}

/** Walk up from `start` to the workspace root (the dir with both `packages/` and the pnpm workspace file). */
export function findRepoRoot(start: string): string | undefined {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'packages')) && fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/** The places a package may keep a resource kind — source layout first, then published build outputs. */
function kindDirs(pkgDir: string, kind: string): string[] {
  return [
    `${RESOURCE_DIR}/${kind}`,
    `build/${RESOURCE_DIR}/${kind}`,
    `build/browser/${RESOURCE_DIR}/${kind}`,
    `dist/${RESOURCE_DIR}/${kind}`
  ].map((rel) => path.join(pkgDir, rel));
}

/** Workspace package name → its source directory (empty outside this repo). */
function workspacePackages(appRoot: string): Map<string, string> {
  const byName = new Map<string, string>();
  const repoRoot = findRepoRoot(appRoot);
  if (!repoRoot) return byName;
  const pkgsDir = path.join(repoRoot, 'packages');
  if (!fs.existsSync(pkgsDir)) return byName;
  for (const entry of fs.readdirSync(pkgsDir)) {
    const pkgDir = path.join(pkgsDir, entry);
    try {
      const name = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).name;
      if (name) byName.set(name, pkgDir);
    } catch {
      /* not a package */
    }
  }
  return byName;
}

/**
 * Every `@sheetxl/*` package reachable from `appRoot` that owns at least one resource kind.
 *
 * **Inclusion comes from the transitive dependency graph**, never from "everything in the workspace".
 * An app should carry the resources of the packages it actually bundles and no others — otherwise the
 * CLI ships Studio's MUI catalogs it can never use.
 *
 * **Location** then prefers the workspace source over the installed copy, so monorepo dev serves the
 * files being edited rather than a stale build. Outside this repo there is no workspace and the
 * installed copy is simply used.
 */
export function discoverResources(
  appRoot: string,
  appPkg?: { name?: string; dependencies?: Record<string, string> }
): ResourceSource[] {
  const workspace = workspacePackages(appRoot);
  const found: ResourceSource[] = [];

  // The app's OWN resources, staged alongside its dependencies'. A bundled app that carries chrome of
  // its own (the CLI's banner and help text) is a resource owner like any package — and it cannot
  // self-locate them at runtime for exactly the reason it stages everything else: it is bundled.
  //
  // SOURCE only, never `kindDirs`: that also looks in `build/`, which for the app being built is the
  // directory we are writing INTO. Discovering it would stage the previous run's output — including
  // the dependency trees already staged there — back inside the app's own `<pkg>/` folder, nesting
  // deeper every rebuild.
  if (appPkg?.name) {
    for (const kind of resourceKinds()) {
      const dir = path.join(appRoot, RESOURCE_DIR, kind);
      if (fs.existsSync(dir)) found.push({ name: appPkg.name, kind, dir });
    }
  }

  const seen = new Set<string>();
  const queue: { dep: string; from: string }[] = Object.keys(appPkg?.dependencies ?? {})
    .filter((dep) => dep.startsWith('@sheetxl/'))
    .map((dep) => ({ dep, from: appRoot }));

  while (queue.length > 0) {
    const { dep, from } = queue.shift()!;
    if (seen.has(dep)) continue;
    seen.add(dep);

    let installedDir: string | undefined;
    try {
      // realpath so a pnpm/workspace symlink resolves to the package itself.
      installedDir = fs.realpathSync(path.resolve(from, 'node_modules', ...dep.split('/')));
    } catch {
      installedDir = undefined; // hoisted elsewhere, or a workspace-only package
    }

    // Keep walking from the INSTALLED dir — that is where this package's own `node_modules` lives.
    if (installedDir) {
      try {
        const depPkg = JSON.parse(fs.readFileSync(path.join(installedDir, 'package.json'), 'utf8'));
        for (const next of Object.keys(depPkg.dependencies ?? {})) {
          if (next.startsWith('@sheetxl/')) queue.push({ dep: next, from: installedDir });
        }
      } catch {
        /* unreadable — still stage whatever it has */
      }
    }

    const pkgDir = workspace.get(dep) ?? installedDir;
    if (!pkgDir) continue;
    for (const kind of resourceKinds()) {
      const dir = kindDirs(pkgDir, kind).find((d) => fs.existsSync(d));
      if (dir) found.push({ name: dep, kind, dir });
    }
  }

  return found;
}

