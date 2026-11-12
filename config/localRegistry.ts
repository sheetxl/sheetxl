/**
 * A local npm registry (Verdaccio) for consuming dev builds the way a released package is consumed.
 *
 *   node ./config/localRegistry.ts            ← start it (foreground); `pnpm registry:local`
 *
 * `@sheetxl/*` and `sheetxl` live only here: never proxied from npm, so a consumer pointed at this
 * registry for the scope gets the local builds and nothing else. Every other package is proxied from
 * npmjs. Config and storage are in `~/.sheetxl/local-registry/`, outside every repo, so all worktrees
 * share one registry.
 *
 * Publish to it with `pnpm release:local` (config/publishLocal.ts). Point a consumer's `@sheetxl`
 * scope at {@link LOCAL_REGISTRY_URL}, e.g. vscode-ext's `pnpm deps:local`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';

export const LOCAL_REGISTRY_PORT = 4873;
export const LOCAL_REGISTRY_URL = `http://localhost:${LOCAL_REGISTRY_PORT}/`;
export const LOCAL_REGISTRY_DIR = path.join(os.homedir(), '.sheetxl', 'local-registry');

const VERDACCIO = 'verdaccio@6';

/** The Verdaccio config: local-only for the scope, anyone may publish (it listens on localhost only). */
const config = (dir: string): string => `# Written by private/config/localRegistry.ts; edits are overwritten on start.
storage: ${JSON.stringify(path.join(dir, 'storage').replace(/\\/g, '/'))}
auth:
  htpasswd:
    file: ${JSON.stringify(path.join(dir, 'htpasswd').replace(/\\/g, '/'))}
    max_users: 100
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
packages:
  '@sheetxl/*':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
  'sheetxl':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
  '**':
    access: $all
    publish: $authenticated
    proxy: npmjs
server:
  keepAliveTimeout: 60
max_body_size: 500mb
listen: 127.0.0.1:${LOCAL_REGISTRY_PORT}
log: { type: stdout, format: pretty, level: warn }
`;

/** Whether the registry answers. */
export async function isLocalRegistryUp(): Promise<boolean> {
  try {
    const res = await fetch(`${LOCAL_REGISTRY_URL}-/ping`);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * A publish token for the local registry, creating its one user on first use. The credentials are
 * fixed: the registry listens on localhost only and holds nothing but dev builds.
 */
export async function localRegistryToken(): Promise<string> {
  const name = 'local';
  const password = 'local';
  const put = (headers: Record<string, string> = {}): Promise<Response> =>
    fetch(`${LOCAL_REGISTRY_URL}-/user/org.couchdb.user:${name}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ name, password, type: 'user', roles: [], date: new Date().toISOString() })
    });
  // Create the user; once it exists, the same call with its credentials logs in.
  let res = await put();
  if (res.status === 409) {
    res = await put({ authorization: `Basic ${Buffer.from(`${name}:${password}`).toString('base64')}` });
  }
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || !body.token) {
    throw new Error(`Could not get a token from the local registry (${res.status}): ${JSON.stringify(body)}`);
  }
  return body.token as string;
}

async function start(): Promise<void> {
  if (await isLocalRegistryUp()) {
    console.log(`Local registry is already running at ${LOCAL_REGISTRY_URL}`);
    return;
  }
  fs.mkdirSync(LOCAL_REGISTRY_DIR, { recursive: true });
  const configPath = path.join(LOCAL_REGISTRY_DIR, 'config.yaml');
  fs.writeFileSync(configPath, config(LOCAL_REGISTRY_DIR));
  console.log(`Local registry at ${LOCAL_REGISTRY_URL} (storage ${LOCAL_REGISTRY_DIR}). Ctrl+C stops it.`);
  await execa('pnpm', ['dlx', VERDACCIO, '--config', configPath], { stdio: 'inherit' });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
