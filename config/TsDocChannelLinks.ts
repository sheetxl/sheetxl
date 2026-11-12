import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

// The API readme and JSDoc links carry the production hosts, the same way docsite content does.
// On the beta channel they are rewritten here so a tester is not sent to the reference or the
// guides for the stable release they are not running. Only `href` values are touched, so a URL
// shown inside a code sample stays literal. See `remarkChannelLinks` in docsite/docusaurus.config.js.
const CHANNEL = process.env.DOCS_CHANNEL || "stable";
const OUT_DIR = "./build/docs";

// The docsite is a path under `www` on stable and its own host on beta, so it is matched first.
const REWRITES: [RegExp, string][] = [
  [/href="https:\/\/www\.sheetxl\.com\/docs(?=["/#?])/g, 'href="https://docs.beta.sheetxl.com'],
  [/href="https:\/\/(api|demo|storybook)\.sheetxl\.com/g, 'href="https://$1.beta.sheetxl.com'],
];

async function rewriteLinks(dir: string): Promise<void> {
  if (CHANNEL !== "beta") return;

  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  let count = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;

    const filePath = join(entry.parentPath, entry.name);
    const html = await readFile(filePath, "utf8");
    const rewritten = REWRITES.reduce((text, [from, to]) => text.replace(from, to), html);
    if (rewritten === html) continue;

    await writeFile(filePath, rewritten);
    count++;
  }

  console.log(`Rewrote ${CHANNEL} channel links in ${count} files.`);
}

rewriteLinks(OUT_DIR).catch((err) => {
  console.error("Failed to rewrite channel links:", err);
  process.exit(1);
});
