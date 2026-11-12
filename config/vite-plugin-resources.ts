import { type Plugin, type Logger } from 'vite';
import path from 'node:path';
import fs from 'node:fs';

import {
  RESOURCE_DIR, CONTENTS_FILE, resourceKinds, discoverResources, walkResourceFiles, resourcePath,
  buildResourceIndex, writeResourceIndex, rootIndexFromPaths, writeRootIndex, type ResourceSource
} from './resources';

/**
 * Vite plugin: stage every `@sheetxl/*` package's runtime **resources** (locale catalogs today, fonts
 * and script libraries next) for a BUNDLED app — browser or node.
 *
 * A bundled app is exactly the case where a package cannot find its own resources at runtime: bundling
 * destroys `import.meta.url`, so `@sheetxl/sdk` can no longer walk up to its own `package.json`. The
 * app must therefore carry them, and this is what puts them there — into
 * `<outDir>/resources/<kind>/<pkg>/…`, the same layout `~/.sheetxl` and `SHEETXL_RESOURCE_PATH` use.
 * The runtime finds that directory as just another resource ROOT, so nothing is special-cased — but
 * only once the app registers it: a browser app calls `addResourceRoot('/resources')` (there is no
 * implicit root, so a host that serves nothing makes no requests).
 *
 * Browser and node apps differ only in HOW the staged bytes are read (fetch vs disk), never in where
 * they sit — which is why the CLI and Studio share this one plugin.
 *
 * In dev there is no build output, so the same files are served straight from their packages.
 */
export interface ResourcesPluginOptions {
  /** Package/app root (defaults to the Vite project root). */
  root?: string;
  /** The app's `package.json`, for transitive `@sheetxl/*` dependency discovery. */
  pkg?: { dependencies?: Record<string, string> };
  /**
   * **App mode** — stage every bundled dependency's resources. Off (the default) is **library mode**:
   * the package only (re)generates the index for its OWN resource dirs, which is what makes them
   * discoverable once published and what lets the dev server list them.
   */
  app?: boolean;
  /**
   * Node apps copy at `writeBundle` (the output dir is a real directory the process will read from
   * disk); browser apps `emitFile` so the assets join the bundle graph. Defaults to browser.
   */
  node?: boolean;
  /** Absolute output directory — required when `node` is set. */
  outDir?: string;
  verbose?: boolean;
}

const pluginName = 'vite-resources';

export function ResourcesPlugin(options: ResourcesPluginOptions = {}): Plugin {
  let logger: Logger | undefined;
  let root = options.root ?? process.cwd();

  const sources = (): ResourceSource[] => discoverResources(root, options.pkg);

  const info = (m: string): void => {
    if (options.verbose) (logger?.info(`[${pluginName}] ${m}`) ?? console.log(`[${pluginName}] ${m}`));
  };

  /**
   * Library mode: generate `contents.json` into the package's BUILD output.
   *
   * Never into source. It is a generated description of a directory, and keeping a generated file
   * beside the thing it describes is what made the old `manifest.json` pair rot — it drifts the moment
   * a catalog is edited, and it is one `git add -A` from being committed.
   *
   * Nothing needs it in source: node self-location scans the directory, and the dev server
   * synthesizes it per request (fresher than a file could be).
   */
  const indexBuild = async (): Promise<void> => {
    let any = false;
    for (const kind of resourceKinds()) {
      // The shared copy targets stage `<pkg>/resources` into `build/` before this runs.
      const dir = path.join(root, 'build', RESOURCE_DIR, kind);
      if (!fs.existsSync(dir)) continue;
      const index = await writeResourceIndex(kind, ownName(), dir);
      info(`indexed ${index.entries.length} ${kind} file(s) for ${index.package}`);
      any = true;
    }
    // The ROOT listing — a `resources/` directory always carries an authoritative statement of what
    // it contains, so a consumer never has to ask for something that is not there. Written last,
    // by scanning, so it cannot disagree with what is actually on disk (per-kind listings included).
    if (any) await writeRootIndex(path.join(root, 'build', RESOURCE_DIR));
  };

  /**
   * Every path a set of sources stages (or the dev server serves), relative to the resource root —
   * the per-package `contents.json` files included, since they are served/staged too. This is the
   * material of the root listing in the two places that cannot scan a finished directory: the dev
   * server (nothing is on disk in this shape) and a browser build (`emitFile` is not a directory).
   */
  const stagedPaths = async (all: ResourceSource[]): Promise<string[]> => {
    const out: string[] = [];
    for (const source of all) {
      for (const rel of await walkResourceFiles(source.dir)) {
        if (rel !== CONTENTS_FILE) out.push(resourcePath(source, rel));
      }
      out.push(resourcePath(source, CONTENTS_FILE));
    }
    return out;
  };

  const ownName = (): string => {
    try {
      return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).name ?? '';
    } catch {
      return '';
    }
  };

  return {
    name: pluginName,
    enforce: 'pre',

    configResolved(resolved) {
      logger = resolved.logger;
      if (!options.root) root = resolved.root;
    },

    /**
     * Clear the staged copy BEFORE the shared copy targets refill it.
     *
     * `rollup-plugin-copy` overwrites but never prunes, so a renamed or deleted resource would linger
     * in `build/` — and therefore in the published package — indefinitely. Renaming `messages.json`
     * to `ui.msg.json` produced exactly that: both files present, both listed, silently merged.
     */
    buildStart() {
      // Applies to BOTH modes. Copies overwrite but never prune, so a renamed or deleted resource
      // would linger in `build/` — and therefore in the published package — indefinitely. For an app
      // it is worse than stale: last run's staged tree is still on disk while this run discovers and
      // re-stages, and the listing ends up naming files that no longer exist.
      const target = options.app
        ? (options.outDir ? path.join(options.outDir, RESOURCE_DIR) : undefined)
        : path.join(root, 'build', RESOURCE_DIR);
      if (target && fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
    },

    // After the shared copy targets have staged `resources/` into `build/`.
    async closeBundle() {
      if (!options.app) await indexBuild();
    },

    /**
     * Dev: serve `/resources/<kind>/<pkg>/<path>` from each package's own directory, so editing a
     * catalog in place is picked up with no build step.
     */
    configureServer(server) {
      const prefix = `/${RESOURCE_DIR}/`;
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith(prefix)) return next();
        const rel = decodeURIComponent(req.url.slice(prefix.length).split('?')[0]);

        // The ROOT listing — the authoritative statement of everything served here. Like the
        // per-package listings it is synthesized per request, strictly fresher than a file could be
        // while catalogs are being edited. Because the runtime trusts it, it never asks for a file
        // that is not in it — which is why nothing below needs to special-case a miss.
        if (rel === CONTENTS_FILE) {
          void stagedPaths(sources()).then((paths) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(rootIndexFromPaths(paths), null, 2));
          }).catch(() => next());
          return;
        }

        for (const source of sources()) {
          const own = `${source.kind}/${source.name}/`;
          if (!rel.startsWith(own)) continue;
          const within = rel.slice(own.length);

          // `contents.json` does not exist in source — synthesize it per request, which is strictly
          // fresher than any generated file could be while catalogs are being edited.
          if (within === CONTENTS_FILE) {
            void buildResourceIndex(source.kind, source.name, source.dir).then((index) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(index, null, 2));
            }).catch(() => next());
            return;
          }

          const file = path.join(source.dir, within);
          // Contain the join: a `..` in the URL must not escape the package's resource dir.
          if (!path.resolve(file).startsWith(path.resolve(source.dir))) break;
          if (fs.existsSync(file) && fs.statSync(file).isFile()) {
            if (file.endsWith('.json')) res.setHeader('Content-Type', 'application/json');
            fs.createReadStream(file).pipe(res);
            return;
          }
        }
        // Fall through to Vite — which for an unknown path means the SPA fallback and `200
        // text/html`, exactly what a consumer's host would do. That used to be special-cased into a
        // 404 here, but the root listing makes the case unreachable in the first place (the runtime
        // never requests what the listing does not name), and the runtime treats an HTML answer as
        // "absent" anyway. Dev behaving like a real host is a feature: it exercises that guard.
        next();
      });
    },

    /** Browser app builds: emit as bundle assets, never inlined. */
    async generateBundle() {
      if (!options.app || options.node) return;
      let count = 0;
      for (const source of sources()) {
        for (const rel of await walkResourceFiles(source.dir)) {
          if (rel === CONTENTS_FILE) continue; // regenerated below, never copied
          this.emitFile({
            type: 'asset',
            fileName: `${RESOURCE_DIR}/${resourcePath(source, rel)}`,
            source: fs.readFileSync(path.join(source.dir, rel))
          });
          count++;
        }
        // Regenerated rather than copied: the browser cannot enumerate a directory, so this listing
        // IS discovery there — it has to describe what was actually staged.
        const contents = await buildResourceIndex(source.kind, source.name, source.dir);
        this.emitFile({
          type: 'asset',
          fileName: `${RESOURCE_DIR}/${resourcePath(source, CONTENTS_FILE)}`,
          source: `${JSON.stringify(contents, null, 2)}\n`
        });
        count++;
      }
      // The ROOT listing, built from the exact set just emitted — `emitFile` leaves no directory to
      // scan, so the listing and the staging share one walk and cannot disagree.
      this.emitFile({
        type: 'asset',
        fileName: `${RESOURCE_DIR}/${CONTENTS_FILE}`,
        source: `${JSON.stringify(rootIndexFromPaths(await stagedPaths(sources())), null, 2)}\n`
      });
      info(`staged ${count} resource file(s)`);
    },

    /**
     * Node builds: copy into the output dir. Not `emitFile` — a node app reads these from disk at
     * runtime rather than importing them, so they must not join the bundle graph.
     */
    async writeBundle() {
      if (!options.app || !options.node) return;
      const outDir = options.outDir;
      if (!outDir) {
        logger?.warn(`[${pluginName}] node mode needs \`outDir\`; nothing staged.`);
        return;
      }
      let count = 0;
      for (const source of sources()) {
        for (const rel of await walkResourceFiles(source.dir)) {
          if (rel === CONTENTS_FILE) continue; // regenerated below, never copied
          const dest = path.join(outDir, RESOURCE_DIR, resourcePath(source, rel));
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(path.join(source.dir, rel), dest);
          count++;
        }
        const contentsDest = path.join(outDir, RESOURCE_DIR, resourcePath(source, CONTENTS_FILE));
        const contents = await buildResourceIndex(source.kind, source.name, source.dir);
        fs.mkdirSync(path.dirname(contentsDest), { recursive: true });
        fs.writeFileSync(contentsDest, `${JSON.stringify(contents, null, 2)}\n`);
        count++;
      }
      // The ROOT listing, written last by scanning the staged directory itself — so it describes
      // what is actually on disk, not what this run believes it copied.
      const stagedRoot = path.join(outDir, RESOURCE_DIR);
      fs.mkdirSync(stagedRoot, { recursive: true });
      await writeRootIndex(stagedRoot);
      info(`staged ${count} resource file(s) -> ${outDir}`);
    }
  };
}
