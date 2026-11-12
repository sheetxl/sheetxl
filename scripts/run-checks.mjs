/**
 * Run every catalog/i18n check and report ALL of them.
 *
 *   node scripts/run-checks.mjs                  # the lints
 *   node scripts/run-checks.mjs --check-extract  # + `i18n-extract --check` first (CI)
 *
 * These used to be `&&`-chained in `package.json`, which stops at the first failure — so a branch
 * with three unrelated problems reported one, and each fix revealed the next, one CI round-trip at
 * a time. Every check here is independent (none consumes another's output), so there is no reason
 * to serialize the reporting: run them all, print each under its own heading, and summarize what
 * failed at the end. The exit code is still non-zero if ANY check failed.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const CHECKS = [
  ['command chords', 'command-chord-lint.mjs', '--check'],
  ['catalog locales', 'i18n-catalog.mjs', '--check'],
  ['language packs', 'i18n-lint.mjs', '--packs'],
  ['group keys', 'i18n-groupkey-lint.mjs', '--strict-convention'],
  ['command chrome', 'i18n-chrome-lint.mjs', '--strict-hardcoded']
];
if (process.argv.includes('--check-extract')) {
  CHECKS.unshift(['message extraction', 'i18n-extract.mjs', '--check']);
}

const failed = [];
for (const [name, script, ...args] of CHECKS) {
  console.log(`\n[1m─── ${name} ───[0m`);
  const result = spawnSync(process.execPath, [path.join(__dirname, script), ...args], {
    stdio: 'inherit', cwd: repoRoot
  });
  if (result.status !== 0) failed.push(name);
}

console.log('');
if (failed.length === 0) {
  console.log(`[32m✓ all ${CHECKS.length} checks passed[0m`);
  process.exit(0);
}
console.error(`[31mFAILED ${failed.length} of ${CHECKS.length} check(s): ${failed.join(', ')}[0m`);
console.error('Each section above is independent — fix them together, not one CI run at a time.');
process.exit(1);
