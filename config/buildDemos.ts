import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Builds every hosted demo into one tree for the shared demos host.
 *
 * An example is a demo when its package.json has a `sheetxl.demo` field. Each one is built with
 * `SHEETXL_DEMO_BASE=/<example>/` so it runs under its own path, then copied to
 * `build/demos/<example>/`. Next to them go `manifest.json` (what the landing site's Demos page lists),
 * an `index.html` that redirects to that page, and one `sheetxl.lic` that every demo finds by walking up from its page.
 *
 * Usage: `pnpm build:demos [example...]` (no names builds all of them).
 */

/** The `sheetxl.demo` field in an example's package.json. */
interface DemoField {
  title: string;
  description: string;
  /** Image path relative to the example; copied beside the built demo. */
  thumb?: string;
  /**
   * Workbook the demo opens with, passed as `?source=`. A relative URL resolves against the demo's
   * own page, so a workbook in the example's `public/` folder works on every host.
   */
  source?: string;
  /** Position on the Demos page; lower comes first, and demos without one follow in folder order. */
  order?: number;
}

/** One entry in `manifest.json`. Paths are relative to the demos host root. */
interface DemoEntry {
  name: string;
  title: string;
  description: string;
  url: string;
  thumb?: string;
}

const EXAMPLES_DIR = './examples';
const OUT_DIR = './build/demos';
const LICENSE_FILE = './examples/studio-mui/public/sheetxl.lic';

async function findDemos(only: string[]): Promise<{ name: string; demo: DemoField }[]> {
  const found: { name: string; demo: DemoField }[] = [];
  for (const entry of await readdir(EXAMPLES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgPath = join(EXAMPLES_DIR, entry.name, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const demo = JSON.parse(await readFile(pkgPath, 'utf8')).sheetxl?.demo as DemoField | undefined;
    if (!demo) continue;
    if (!demo.title || !demo.description) {
      throw new Error(`${pkgPath}: sheetxl.demo needs a title and a description.`);
    }
    found.push({ name: entry.name, demo });
  }
  const unknown = only.filter(name => !found.some(d => d.name === name));
  if (unknown.length > 0) {
    throw new Error(`Not a demo (no sheetxl.demo field): ${unknown.join(', ')}`);
  }
  found.sort((a, b) => (a.demo.order ?? Infinity) - (b.demo.order ?? Infinity));
  return only.length > 0 ? found.filter(d => only.includes(d.name)) : found;
}

async function buildDemo(name: string, demo: DemoField): Promise<DemoEntry> {
  const base = `/${name}/`;
  console.log(`\nBuilding demo '${name}' at ${base}`);
  execSync(`pnpm --filter ./examples/${name} build`, {
    stdio: 'inherit',
    env: { ...process.env, SHEETXL_DEMO_BASE: base },
  });

  const built = join(EXAMPLES_DIR, name, 'build');
  if (!existsSync(join(built, 'index.html'))) {
    throw new Error(`Demo '${name}' built no ${built}/index.html.`);
  }
  const dest = join(OUT_DIR, name);
  await cp(built, dest, { recursive: true });

  const entry: DemoEntry = {
    name,
    title: demo.title,
    description: demo.description,
    url: demo.source ? `${base}?source=${encodeURIComponent(demo.source)}` : base,
  };
  if (demo.thumb) {
    await cp(join(EXAMPLES_DIR, name, demo.thumb), join(dest, demo.thumb));
    entry.thumb = `${base}${demo.thumb}`;
  }
  return entry;
}

/** The landing site's Demos page on each channel; it is the gallery, so the host root sends people there. */
const DEMOS_PAGE_STABLE = 'https://www.sheetxl.com/demos';
const DEMOS_PAGE_BETA = 'https://www.beta.sheetxl.com/demos';

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/**
 * The host root redirects to the landing site's Demos page for its channel, chosen from the hostname so
 * one build serves both. The list underneath is only for a browser without JavaScript.
 */
function renderIndex(entries: DemoEntry[]): string {
  const items = entries.map(e =>
    `      <li><a href="${escapeHtml(e.url)}">${escapeHtml(e.title)}</a> — ${escapeHtml(e.description)}</li>`
  ).join('\n');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SheetXL Demos</title>
    <script>
      location.replace(location.hostname.includes('.beta.')
        ? '${DEMOS_PAGE_BETA}'
        : '${DEMOS_PAGE_STABLE}');
    </script>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 720px; margin: 48px auto; padding: 0 16px; }
      li { margin: 8px 0; }
    </style>
  </head>
  <body>
    <h1>SheetXL Demos</h1>
    <p>See the <a href="${DEMOS_PAGE_STABLE}">Demos page</a>.</p>
    <ul>
${items}
    </ul>
  </body>
</html>
`;
}

async function buildDemos(only: string[]): Promise<void> {
  const demos = await findDemos(only);
  if (demos.length === 0) {
    throw new Error(`No example in ${EXAMPLES_DIR} has a sheetxl.demo field.`);
  }
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const entries: DemoEntry[] = [];
  for (const { name, demo } of demos) {
    entries.push(await buildDemo(name, demo));
  }

  await cp(LICENSE_FILE, join(OUT_DIR, 'sheetxl.lic'));
  await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify({ demos: entries }, null, 2) + '\n');
  await writeFile(join(OUT_DIR, 'index.html'), renderIndex(entries));
  console.log(`\nBuilt ${entries.length} demo(s) into ${OUT_DIR}: ${entries.map(e => e.name).join(', ')}`);
}

buildDemos(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
