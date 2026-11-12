/**
 * Build every package and publish it to the local registry, so a consumer (vscode-ext, a demo app)
 * installs this tree's packages exactly as it installs a release.
 *
 *   pnpm registry:local     ← in another terminal, once (config/localRegistry.ts)
 *   pnpm release:local      ← this: build, then publish under the `beta` dist-tag
 *   pnpm release:local --no-build   ← publish the builds already on disk (from a release:local run)
 *
 * The version is the current npm beta plus `.local.<timestamp>` (`0.8.0-beta.17.local.20261108143000`):
 * newer than the beta it was built on, older than the next real one, and on the same `beta` tag, so a
 * consumer that asks for `beta` gets it. The builds are dev builds: only their manifests carry the
 * version (`SHEETXL_PUBLISH_VERSION`), and nothing is signed with release keys.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { execa } from 'execa';

import { LOCAL_REGISTRY_URL, isLocalRegistryUp, localRegistryToken } from './localRegistry.ts';

const noBuild = process.argv.includes('--no-build');

/** The beta on npm, as the base of the local version; a fixed base when npm is unreachable. */
async function npmBeta(): Promise<string> {
  try {
    const res = await fetch('https://registry.npmjs.org/@sheetxl%2fsdk', {
      headers: { accept: 'application/vnd.npm.install-v1+json' }
    });
    const beta = res.ok ? ((await res.json()) as any)['dist-tags']?.beta : undefined;
    if (typeof beta === 'string') return beta;
  } catch {
    /* offline: fall through */
  }
  return '0.0.0-beta';
}

const stamp = (d: Date): string => d.toISOString().replace(/[-:T]/g, '').slice(0, 14);

/** The version the builds on disk were composed with, for `--no-build`. */
function builtVersion(): string {
  const manifest = fileURLToPath(new URL('../packages/sdk/build/package.json', import.meta.url));
  return JSON.parse(fs.readFileSync(manifest, 'utf-8')).version;
}

async function run(): Promise<number> {
  if (!(await isLocalRegistryUp())) {
    console.error(`\n  ❌ No local registry at ${LOCAL_REGISTRY_URL}. Start it with \`pnpm registry:local\`.\n`);
    return 1;
  }
  const version = noBuild ? builtVersion() : `${await npmBeta()}.local.${stamp(new Date())}`;
  if (!version.includes('.local.')) {
    console.error(`\n  ❌ The builds on disk are at ${version}, not a local version. Run without --no-build.\n`);
    return 1;
  }
  const env = { ...process.env, SHEETXL_PUBLISH_VERSION: version };

  if (!noBuild) {
    console.log(`\n  Building every package at ${version} ...\n`);
    await execa('pnpm', ['run', 'build'], { stdio: 'inherit', env });
  }

  const token = await localRegistryToken();
  const { exitCode } = await execa('node', ['./config/releasePackages.ts', '--registry', LOCAL_REGISTRY_URL], {
    stdio: 'inherit', env: { ...env, SHEETXL_REGISTRY_TOKEN: token }, reject: false
  });
  if (exitCode === 0) {
    console.log(`  Install it: point the @sheetxl scope at ${LOCAL_REGISTRY_URL} (vscode-ext: \`pnpm deps:local\`).\n`);
  }
  return exitCode ?? 1;
}

run().then((code) => { process.exitCode = code; }, (error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
