#!/usr/bin/env node
/**
 * Launcher for THIS checkout's CLI, used two ways:
 *
 *  - `pnpm sheetxl …` from anywhere in the repo (the root `sheetxl` script), and
 *  - `sheetxl-local …` from anywhere on the box, once linked:
 *      `cd scripts/sheetxl-local && pnpm link --global`
 *    The name is deliberately NOT `sheetxl`, so a real installed CLI is never shadowed. It pins to this
 *    checkout by self-location (`import.meta.url`), not by any configured path.
 *
 * Runs the BUILT cli (`packages/cli/build/cli.js`) — same artifact `pnpm --filter sheetxl sheetxl` runs,
 * so it is only as fresh as the last `pnpm --filter sheetxl build`. Running from SOURCE is the debugger's
 * job (`packages/cli/scripts/dev-cli.mts`), which needs `--conditions=development` plus locale hooks.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(here, '..', '..', 'packages', 'cli', 'build', 'cli.js');

if (!fs.existsSync(cli)) {
  console.error(`sheetxl-local: no CLI build at '${cli}'.\nBuild it first:  pnpm --filter sheetxl build`);
  process.exit(1);
}

// `pnpm run` sets cwd to the package that owns the script (the repo root here) and leaves the directory
// the user actually typed from in INIT_CWD. Relative arguments (`--in budget.xlsx`) have to resolve
// against THAT. Absent when invoked as a plain bin, where the cwd is already right.
//
// The CLI already reconciles the two per-argument (`cli/src/utils/_Utils.ts`, which treats
// INIT_CWD !== cwd as the signal). Doing it here as well makes that path a no-op and covers what it
// cannot: `process.cwd()` inside the user's own script. `SHEETXL_IN`/`SHEETXL_OUT` still win either way.
const initCwd = process.env.INIT_CWD;
if (initCwd && fs.existsSync(initCwd)) process.chdir(initCwd);

// The CLI self-locates its staged `build/resources/` from argv[1]; hand it its own path, not this shim's.
process.argv[1] = cli;

await import(pathToFileURL(cli).href);
