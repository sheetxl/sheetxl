// import fs from 'node:fs';
import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseJsonc } from 'jsonc-parser';

import { glob } from 'glob';
import { execaCommand as exec, execa } from 'execa';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// replace the workspace protocol with latest for any private packages
function updatePrivateDependencies(dependencies: Record<string, string>, privatePackages: string[]): void {
  if (!dependencies) return;
  Object.keys(dependencies).forEach(function(key) {
    if (key.startsWith('@sheetxl/')) {
      const packageName = key.replace('@sheetxl/', '');
      if (privatePackages.includes(packageName)) {
        // Use 'latest' instead of '*' to get the most recent published version
        dependencies[key] = `*`;
      }
    }
  });
}

// remove private package references from tsconfig paths
function updateTsconfigPaths(tsconfig: any, privatePackages: string[]): void {
  if (!tsconfig.compilerOptions?.paths) return;

  Object.keys(tsconfig.compilerOptions.paths).forEach(function(key) {
    if (key.startsWith('@sheetxl/')) {
      const packageName = key.replace('@sheetxl/', '');
      if (privatePackages.includes(packageName)) {
        console.log(`    Removing private path: ${key}`);
        delete tsconfig.compilerOptions.paths[key];
      }
    }
  });

  // Also remove from include array if it references private packages
  if (tsconfig.include && Array.isArray(tsconfig.include)) {
    tsconfig.include = tsconfig.include.filter((includePath: any) => {
      const isPrivatePackage = privatePackages.some(pkg => includePath.includes(`../${pkg}/`));
      if (isPrivatePackage) {
        console.log(`    Removing private include path: ${includePath}`);
      }
      return !isPrivatePackage;
    });
  }
}

// remove private package references from tsconfig paths
function updateTsconfigBuildPaths(tsconfig: any, privatePackages: string[]): void {
  if (!tsconfig.references) return;

  // Also remove from references array if it references private packages
  if (tsconfig.references && Array.isArray(tsconfig.references)) {
    tsconfig.references = tsconfig.references.filter((ref: any) => {
      const isPrivatePackage = privatePackages.some(pkg => ref.path.includes(`/${pkg}`));
      console.log(`    Checking private references...`, ref.path);
      if (isPrivatePackage) {
        console.log(`    Removing private reference: ${ref.path}`);
      }
      return !isPrivatePackage;
    });
  }
}

const rootPath = path.resolve(__dirname, "..");

/**
 * Mirror private repo to public repo, removing private packages and files
 *
 * How this works:
 * 1. Run from private repo: `pnpm run publish-public-repo`
 * 2. Creates workspace at ../deploy-repos/ (peer to private repo)
 * 3. Clones both private and public repos into workspace
 * 4. Uses git filter-repo to remove private content from a copy of private repo
 * 5. Merges filtered private repo history into public repo
 * 6. Updates package.json dependencies to use npm packages
 * 7. Commits and pushes to public repo
 *
 * @returns {Promise<1 | 0>}
 */
async function run(): Promise<1 | 0> {
  try {
    const pathRepos = path.join(rootPath, "../deploy-repos");
    const pathPrivate = path.join(pathRepos, "private");
    const pathPublic = path.join(pathRepos, "sheetxl");

    // Clean up any existing workspace
    fs.removeSync(pathRepos);
    fs.mkdirSync(pathRepos, { recursive: true });

    console.log('📦 Setting up repositories...');

    // Check if we're running in GitHub Actions
    const isCI = process.env.GITHUB_ACTIONS === 'true';

    if (isCI) {
      // In CI, we're already in the private repo, so just clone public and copy private
      console.log('   Running in GitHub Actions - using current repo as private source');
      // Use HTTPS with token for cloning to avoid SSH key issues
      await exec(`git clone git@github.com:sheetxl/sheetxl.git`, { cwd: pathRepos });

      // Copy current repo to pathPrivate for processing
      fs.copySync(rootPath, pathPrivate, {
        filter: (src, dest) => {
          const relativePath = path.relative(rootPath, src);
          // Exclude node_modules and .git directories (but not files containing .git like .gitignore)
          if (relativePath.includes('node_modules') || relativePath === '.git' || relativePath.startsWith('.git/')) {
            // console.log(`   Excluding: ${relativePath}`);
            return false;
          }
          // Include everything else, including dotfiles like .gitignore
          return true;
        }
      });

      // Initialize git in the copied private repo
      await exec(`git init`, { cwd: pathPrivate });
      await exec(`git add .`, { cwd: pathPrivate });
      await execa('git', ['commit', '-m', 'Initial commit from CI'], { cwd: pathPrivate });
    } else {
      // Local development - clone both repos
      console.log('   Running locally - cloning both repositories');
      await exec(`git clone git@github.com:sheetxl/sheetxl.git`, { cwd: pathRepos });
      await exec(`git clone git@github.com:sheetxl/private.git`, { cwd: pathRepos });
    }

    const privatePackages = [
      'sdk',
      'scripting',
      'react',
      'grid-react'
    ];

    // Get current version and release notes from private repo latest release
    console.log('🚀 Getting latest release version and notes from private repo...');
    let currentVersion:string;
    let privateReleaseNotes:string;

    try {
      // Explicitly specify the repository for gh command to work in both local and CI environments
      const { stdout: releaseOutput } = await exec('gh release view --repo sheetxl/private --json tagName,body', { cwd: pathPrivate });
      const releaseData = JSON.parse(releaseOutput);
      currentVersion = releaseData.tagName.replace(/^v/, ''); // Remove 'v' prefix if present
      privateReleaseNotes = releaseData.body || `Release v${currentVersion}`;
      console.log(`   Found release version: ${currentVersion}`);
    } catch (error: any) {
      console.warn('error', error);
      console.log('   ⚠️  No release found error, using latest git tag for testing...');
      try {
        const { stdout: tagOutput } = await exec('git describe --tags --abbrev=0', { cwd: pathPrivate });
        currentVersion = tagOutput.trim().replace(/^v/, '');
        privateReleaseNotes = `Test release v${currentVersion}`;
        console.log(`   Using tag version: ${currentVersion}`);
      } catch (tagError) {
        console.log('   ⚠️  No tags found, using version 0.0.1-test');
        currentVersion = '0.0.1-test';
        privateReleaseNotes = 'Test release';
      }
    }

    console.log('� Filtering private repo to remove private content...');

    // Create a new branch in private repo for filtering
    await exec(`git checkout -b private-source`, { cwd: pathPrivate });

    // Filter out private packages
    console.log('   Removing private packages...');
    for (const pkg of privatePackages) {
      await exec(`git filter-repo --path packages/${pkg} --invert-paths --force`, { cwd: pathPrivate });
    }

    // Filter out files with PRIVATE in name
    console.log('   Removing PRIVATE files...');
    await exec(`git filter-repo --path-glob *PRIVATE*.md --invert-paths --force`, { cwd: pathPrivate });

    // Filter out license files
    console.log('   Removing license files...');
    await exec(`git filter-repo --path-glob examples/**/sheetxl.lic --invert-paths --force`, { cwd: pathPrivate });
    await exec(`git filter-repo --path-glob docsite/static/sheetxl.lic --invert-paths --force`, { cwd: pathPrivate });

    console.log('🔀 Replacing public repo content with filtered private repo...');

    // // Check if public repo is empty (no main branch)
    // let isEmptyRepo = false;
    // try {
    //   await exec(`git show-ref --verify refs/heads/main`, { cwd: pathPublic });
    // } catch (error: any) {
    //   console.log('   📝 Public repo appears to be empty, will create initial commit');
    //   isEmptyRepo = true;
    // }

    // if (!isEmptyRepo) {
    //   // Remove all tracked files from public repo (keeping .git directory)
    //   await exec(`git rm -rf .`, { cwd: pathPublic });
    // }

    // Copy all files from filtered private repo to public repo using fs-extra
    const tempDir = path.join(pathRepos, 'temp-extract');
    fs.mkdirSync(tempDir, { recursive: true });

    // Extract clean content from filtered private repo
    await exec(`git checkout-index -a --prefix=${tempDir}/`, { cwd: pathPrivate });

    // Copy to public repo (excluding .git)
    fs.copySync(tempDir, pathPublic, {
      filter: (src) => {
        const relativePath = path.relative(tempDir, src);
        // Only exclude the .git directory itself, not files containing .git
        return !(relativePath === '.git' || relativePath.startsWith('.git/'));
      }
    });

    // Clean up temp directory
    fs.removeSync(tempDir);

    console.log('📝 Updating package.json files...');

    // Dynamically find all package.json files in packages directory
    // Find package.json files in both packages and examples directories
    const packageJSONs = await glob(['packages/*/package.json', 'examples/*/package.json'], {
      cwd: pathPublic
    });

    for (const packageJsonPath of packageJSONs) {
      const fullPath = path.resolve(pathPublic, packageJsonPath);
      const packageJSON = fs.readJsonSync(fullPath);

      console.log(`  Updating dependencies in: ${packageJsonPath}`);
      updatePrivateDependencies(packageJSON.dependencies, privatePackages);
      updatePrivateDependencies(packageJSON.peerDependencies, privatePackages);
      updatePrivateDependencies(packageJSON.devDependencies, privatePackages);

      fs.writeJsonSync(fullPath, packageJSON, { spaces: 2 });
    }

    // Find and update tsconfig.json files in both packages and examples directories
    console.log('🔧 Updating tsconfig.json files...');
    const tsconfigFiles = await glob(['packages/*/tsconfig.json', 'examples/*/tsconfig.json'], {
      cwd: pathPublic
    });

    for (const tsconfigPath of tsconfigFiles) {
      const fullPath = path.resolve(pathPublic, tsconfigPath);
      if (fs.existsSync(fullPath)) {
        console.log(`  Updating tsconfig paths in: ${tsconfigPath}`);
        try {
          const rawContent = fs.readFileSync(fullPath, 'utf8');
          const tsconfigContent = parseJsonc(rawContent);
          updateTsconfigPaths(tsconfigContent, privatePackages);
          fs.writeJsonSync(fullPath, tsconfigContent, { spaces: 2 });
        } catch (error: any) {
          console.log(`    ⚠️  Error parsing ${tsconfigPath}: ${error.message}`);
          console.log(`    📄 Skipping this file...`);
        }
      }
    }

    console.log('🔧 Updating tsconfig.build.json files...');
    const tsconfigBuildFiles = await glob(['packages/*/tsconfig.build.json', 'examples/*/tsconfig.build.json'], {
      cwd: pathPublic
    });

    for (const tsconfigBuildPath of tsconfigBuildFiles) {
      const fullPath = path.resolve(pathPublic, tsconfigBuildPath);
      if (fs.existsSync(fullPath)) {
        console.log(`  Updating tsconfig.build references in: ${tsconfigBuildPath}`);
        try {
          // Read as text and parse with JSONC parser to handle comments
          const rawContent = fs.readFileSync(fullPath, 'utf8');
          const tsconfigContent = parseJsonc(rawContent);

          updateTsconfigBuildPaths(tsconfigContent, privatePackages);

          // Write back as clean JSON (without comments)
          fs.writeJsonSync(fullPath, tsconfigContent, { spaces: 2 });
        } catch (error: any) {
          console.log(`    ⚠️  Error parsing ${tsconfigBuildPath}: ${error.message}`);
          console.log(`    📄 Skipping this file...`);
        }
      }
    }


    console.log('� Updating lockfile to resolve latest versions...');
    // Remove existing lockfile so pnpm install resolves "*" to latest versions
    const lockfilePath = path.join(pathPublic, 'pnpm-lock.yaml');
    if (fs.existsSync(lockfilePath)) {
      fs.removeSync(lockfilePath);
      console.log('   Removed existing lockfile');
    }

    // Install dependencies to create fresh lockfile that resolves "*" to latest versions
    await execa('pnpm', ['install'], { cwd: pathPublic });

    console.log('🚀 Committing and pushing changes...');
    await exec(`git add .`, { cwd: pathPublic });
    console.log('🚀 Added files...');
    await exec(`git status`, { cwd: pathPublic }); // Show what's being committed

    // Check if there are changes to commit
    try {
      const { stdout: statusOutput } = await exec('git status --porcelain', { cwd: pathPublic });
      if (statusOutput.trim() === '') {
        console.log('ℹ️  No changes to commit, skipping commit step');
      } else {
        // Use simple commit message without any quotes or special characters
        const commitMessage = `sync update from private repo v${currentVersion}`;
        console.log(`🚀 Committing... ${commitMessage}`);
        await execa('git', ['commit', '-m', `update v${currentVersion}`], { cwd: pathPublic });
        console.log('🚀 Pushing changes...');
        await exec(`git push -u origin main`, { cwd: pathPublic });
      }
    } catch (error: any) {
      console.log(`   ⚠️  Error checking git status: ${error.message}`);
      // Try to commit anyway in case of git status issues
      const commitMessage = `sync update from private repo v${currentVersion}`;
      console.log(`🚀 Committing... ${commitMessage}`);
      await execa('git', ['commit', '-m', `update v${currentVersion}`], { cwd: pathPublic });
      console.log('🚀 Pushing changes...');
      await exec(`git push -u origin main`, { cwd: pathPublic });
    }

    // Tag with current version
    console.log(`🏷️  Tagging with version: v${currentVersion}`);

    // Check if tag already exists in public repo
    try {
      const { stdout: existingTags } = await exec('git tag -l', { cwd: pathPublic });
      const tagExists = existingTags.split('\n').includes(`v${currentVersion}`);

      if (tagExists) {
        console.log(`   ⚠️  Tag v${currentVersion} already exists in public repo`);
        console.log(`   🔄 Updating existing tag...`);
        await exec(`git tag v${currentVersion} --force`, { cwd: pathPublic });
        await exec(`git push origin v${currentVersion} --force`, { cwd: pathPublic });
      } else {
        console.log(`   🔖 Creating new tag v${currentVersion}`);
        await exec(`git tag v${currentVersion}`, { cwd: pathPublic });
        await exec(`git push origin v${currentVersion}`, { cwd: pathPublic });
      }
    } catch (error: any) {
      console.log(`   ⚠️  Error checking tags, creating new tag: ${error.message}`);
      await exec(`git tag v${currentVersion}`, { cwd: pathPublic });
      await exec(`git push origin v${currentVersion}`, { cwd: pathPublic });
    }

    // Create GitHub release in public repo
    console.log(`🚀 Creating GitHub release v${currentVersion} in public repo...`);
    try {
      // Check if release already exists
      const { stdout: existingReleases } = await exec('gh release list --json tagName', { cwd: pathPublic });
      const releases = JSON.parse(existingReleases);
      const releaseExists = releases.some((release: any) => release.tagName === `v${currentVersion}`);

      if (releaseExists) {
        console.log(`   ⚠️  Release v${currentVersion} already exists in public repo`);
        console.log(`   🔄 Updating existing release...`);
        await execa(`gh`, ['release', 'edit', `v${currentVersion}`, '--notes', privateReleaseNotes], { cwd: pathPublic });
      } else {
        console.log(`   ⬆️ Creating new release v${currentVersion}`);
        await execa(`gh`, ['release', 'create', `v${currentVersion}`, '--title', `Release v${currentVersion}`, '--notes', privateReleaseNotes], { cwd: pathPublic });
      }
    } catch (error: any) {
      console.log(`   ⚠️  Error creating release: ${error.message}`);
      console.log(`   💡 Make sure GitHub CLI is installed and authenticated`);
    }

    console.log('✅ Public repo mirror updated successfully!');
    console.log(`   Version: v${currentVersion}`);
    console.log(`   Removed ${privatePackages.length} private packages`);

    return 0;
  } catch (error: any) {
    console.log();
    console.error(`  ${error.message}`);
    console.log();
    return 1;
  }
}

run().then((code: number) => {
  process.exit(code);
});
