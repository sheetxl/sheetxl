import { readFile, writeFile } from 'fs/promises';
import path from 'path';

import { type VerifyReleaseContext, type GlobalConfig } from 'semantic-release';

// export async function prepare(_config: GlobalConfig, context: PrepareContext) {
export async function verifyRelease(_config: GlobalConfig, context: VerifyReleaseContext) {
  const { logger, nextRelease } = context;

  const version = nextRelease.version;
  const rootPkgPath = path.resolve(process.cwd(), 'package.json');
  logger.log(`🔧 Building project for version: ${version}`);

  logger.log('📦 Updating root package.json version');
  const pkgRaw = await readFile(rootPkgPath, 'utf-8');
  const pkg = JSON.parse(pkgRaw);
  pkg.version = version;
  await writeFile(rootPkgPath, JSON.stringify(pkg, null, 2) + '\n');

  logger.log('🔨 Running build script');
  const { execSync } = await import('child_process');
  execSync('pnpm -r --workspace-concurrency=1 --bail --filter="./packages/*" build', { stdio: 'inherit' });

  logger.log('✅ Build and version sync complete');

}
