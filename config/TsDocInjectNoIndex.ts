import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

// Addressed to Google only: the API reference should stay out of Google results (it was
// crowding the sitelinks under the main site), but other engines - the indexes agents search
// through (Bing, Brave) - should keep it. Beta is kept out of every index by the deploy step.
const META_TAG = '<meta name="googlebot" content="noindex, follow">';
const OUT_DIR = "./build/docs";

async function injectMeta(dir: string): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  let count = 0;

  console.log(`Injecting noindex meta into files.`);
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;

    const filePath = join(entry.parentPath, entry.name);
    const html = await readFile(filePath, "utf8");

    if (html.includes(META_TAG)) continue; // already injected, skip

    await writeFile(filePath, html.replace("</head>", `${META_TAG}\n</head>`));
    count++;
  }

  console.log(`Injected noindex meta into ${count} files.`);
}

injectMeta(OUT_DIR).catch((err) => {
  console.error("Failed to inject meta tags:", err);
  process.exit(1);
});