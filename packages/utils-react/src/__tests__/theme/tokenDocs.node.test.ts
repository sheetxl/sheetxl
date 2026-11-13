import { describe, it, expect } from 'vitest';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The docsite theme-tokens reference lists every token a client can set. A token added to `TokenTheme` without a row
 * there is a token nobody can find.
 */
const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('theming docs', () => {
  it('lists every TokenTheme key', () => {
    const source = read('../../theme/TokenTheme.ts');
    const body = source.slice(source.indexOf('export interface TokenTheme'));
    const keys = [...body.matchAll(/^\s*'([a-z0-9-]+)'\??\s*:/gm)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(20);

    const page = read('../../../../../docsite/docs/45-reference/30-theme-tokens.md');
    const missing = keys.filter((key) => !page.includes(`\`${key}\``));
    expect(missing).toEqual([]);
  });
});
