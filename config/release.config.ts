import type { GlobalConfig, PluginSpec } from 'semantic-release';

// const isDryRun = process.argv.includes('--dry-run');
const isNoCi = process.argv.includes('--no-ci');

const plugins:ReadonlyArray<PluginSpec> = [
  [
    '@semantic-release/commit-analyzer',
    {
      preset: 'conventionalcommits',
      releaseRules: [
        { type: 'feat', release: 'minor' },
        { type: 'fix', release: 'patch' },
        { type: 'docs', release: 'patch' },
        { type: 'chore', release: 'patch' }
      ],
    },
  ],
  [
    '@semantic-release/release-notes-generator',
    {
      preset: 'conventionalcommits',
      writerOpts: {
        commitsSort: ['scope', 'subject'],
        groupBy: 'type',
        commitGroupsSort: 'title',
        transform: (commit: any, context: any) => {
          // Clean subject: Remove PR references from commit messages
          let cleanedSubject = commit.subject || '';
          if (cleanedSubject) {
            // Remove "Merge pull request #XX from..." patterns
            cleanedSubject = cleanedSubject.replace(/Merge pull request #\d+ from [^\s]+/gi, '');
            // Remove ", closes #XX" patterns (GitHub auto-added)
            cleanedSubject = cleanedSubject.replace(/,\s*closes\s+#\d+/gi, '');
            // Remove standalone PR references like (#123) or #123
            cleanedSubject = cleanedSubject.replace(/\(#\d+\)/g, '');
            cleanedSubject = cleanedSubject.replace(/#\d+/g, '');
            // Clean up extra whitespace and commas
            cleanedSubject = cleanedSubject.replace(/,\s*$/, '').trim();
          }

          // Clean body: Remove PR references if body exists
          let cleanedBody = commit.body || '';
          if (cleanedBody) {
            cleanedBody = cleanedBody.replace(/Merge pull request #\d+ from [^\s]+/gi, '');
            cleanedBody = cleanedBody.replace(/,\s*closes\s+#\d+/gi, '');
            cleanedBody = cleanedBody.replace(/\(#\d+\)/g, '');
            cleanedBody = cleanedBody.replace(/#\d+/g, '');
            cleanedBody = cleanedBody.replace(/,\s*$/, '').trim();
          }

          console.log('Cleaning PR references from commit:', cleanedSubject, cleanedBody);
          // Return a new immutable object with cleaned messages and no commit hashes
          return {
            ...commit,
            subject: cleanedSubject,
            body: cleanedBody,
            hash: '',
            shortHash: ''
          };
        },
        types: [
          { type: 'feat', section: 'Features' },
          { type: 'fix', section: 'Bug Fixes' },
          { type: 'docs', section: 'Documentation' },
          { type: 'chore', section: 'Chores' },
          { type: 'refactor', section: 'Refactoring' },
          { type: 'test', section: 'Tests' },
          { type: 'build', section: 'Build System' },
          { type: 'ci', section: 'CI/CD' },
        ],
      },
    },
  ],
  './config/prepareBuild.ts',
  '@semantic-release/changelog',
  './config/publishRelease.ts',
];
if (!isNoCi) {
  (plugins as any).push([
    '@semantic-release/github',
      {
      "assets": [
        '!**',
        { "path": "CHANGELOG.md", "label": "Changelog" }
      ],
      // Use PAT to allow triggering other workflows, fallback to GITHUB_TOKEN
      "githubToken": process.env.RELEASE_PAT_TOKEN || process.env.GITHUB_TOKEN,
      // Disable PR comments and updates to avoid permission issues
      "successComment": false,
      "failComment": false,
      "failTitle": false,
      "releasedLabels": false
    }
  ]);
}

const config: Partial<GlobalConfig> = {
  branches: ['main'],
  plugins
};

export default config;