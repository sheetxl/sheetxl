import { type PublishContext, type GlobalConfig } from 'semantic-release';

export async function publish(_config: GlobalConfig, context: PublishContext) {
  const { logger, nextRelease } = context;

  const version = nextRelease.version;
  logger.log(`📦  Publishing project for version: ${version}`);

  const { execSync } = await import('child_process');
  execSync('pnpm release:packages', { stdio: 'inherit' });

  // Sync to public repo after publishing
  logger.log(`🔄 Syncing to public repo...`);
  try {
    execSync('pnpm release:public-repo', { stdio: 'inherit' });
    logger.log('✅ Public repo sync complete');
  } catch (error) {
    logger.error('❌ Public repo sync failed:', error.message);
    // Don't fail the release if public sync fails
  }

  logger.log('✅ Publish complete');

}
