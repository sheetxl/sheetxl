import { cp, mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';

/**
 * The pages need no build; this only copies them to `build/` for hosting.
 *
 * `SHEETXL_NPM_TAG` swaps the `@latest` in every CDN URL for another npm dist-tag (the demos host
 * sets `beta` on the beta channel), so the pages themselves never pick a channel.
 */
const OUT_DIR = './build';
const tag = process.env.SHEETXL_NPM_TAG;

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });
for (const file of await readdir('.')) {
  if (file.endsWith('.html')) {
    const html = await readFile(file, 'utf8');
    await writeFile(`${OUT_DIR}/${file}`,
      tag ? html.replaceAll('@sheetxl/studio-vanilla@latest/', `@sheetxl/studio-vanilla@${tag}/`) : html);
  } else if (file.endsWith('.css')) {
    await cp(file, `${OUT_DIR}/${file}`);
  }
}
