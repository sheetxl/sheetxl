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
        transform: (commit, context) => {
          // Return a new object without commit hashes
          return {
            ...commit,
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