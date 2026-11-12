import { describe, it, expect } from 'vitest';

import { prepare, toSnippetOffset } from '../Snippet';

/**
 * A compiler reports positions in the wrapper a snippet was compiled in; an author (or an agent)
 * can only act on a position in what they wrote. The transform keeps every line where it was but
 * rewrites statements in place, so the mapping back is recorded as the wrapper is emitted rather
 * than reconstructed by arithmetic.
 */
describe('Snippet positions', () => {
  /** The offset in `source` of the `occurrence`-th `needle` (0-based). */
  const nth = (source: string, needle: string, occurrence = 0): number => {
    let at = -1;
    for (let i = 0; i <= occurrence; i++) at = source.indexOf(needle, at + 1);
    expect(at).toBeGreaterThanOrEqual(0);
    return at;
  };

  it('every recorded span holds exactly the text it claims', async () => {
    const snippets = [
      `wb.getName()`,
      `const s = wb.getWorksheetAt(0);\ns.getRange('B1').getVisible().getValues();`,
      `// first\nconst a = f(1), b = g(2)\nfor (const x of [a, b]) { log(x) }\n/* tail */ a + b // done`,
      `import { x } from 'y';\nimport z from 'z';\nlog(x, z);`,
      `/** Doc. */\nlog(1);`,
      `{ name: wb.getName() }`,
      `const x = (`, // does not parse: wrapped verbatim
    ];
    for (const code of snippets) {
      const prepared = await prepare(code);
      expect(prepared.spans.length).toBeGreaterThan(0);
      let previousEnd = 0;
      for (const span of prepared.spans) {
        expect(prepared.source.slice(span.at, span.at + span.length))
          .toBe(code.slice(span.from, span.from + span.length));
        // In source order and never overlapping — what the lookup relies on.
        expect(span.at).toBeGreaterThanOrEqual(previousEnd);
        previousEnd = span.at + span.length;
      }
    }
  });

  it('maps a position past the settle and the implicit await back to its own column', async () => {
    const code = `const s = wb.getWorksheetAt(0);\ns.getRange('B1').getVisible().getValues();`;
    const prepared = await prepare(code);
    // In the wrapper the second statement is pushed right by the settle and `__result = await (`.
    const inWrapper = nth(prepared.source, 'getValues');
    expect(toSnippetOffset(prepared, inWrapper)).toBe(code.indexOf('getValues'));
    const receiver = nth(prepared.source, `s.getRange('B1')`);
    expect(toSnippetOffset(prepared, receiver)).toBe(code.indexOf(`s.getRange('B1')`));
  });

  it('maps inside every awaited initializer of one declaration', async () => {
    const code = `const a = first(1), b = second(2);`;
    const prepared = await prepare(code);
    expect(toSnippetOffset(prepared, nth(prepared.source, 'first'))).toBe(code.indexOf('first'));
    expect(toSnippetOffset(prepared, nth(prepared.source, 'second'))).toBe(code.indexOf('second'));
    expect(toSnippetOffset(prepared, nth(prepared.source, 'b ='))).toBe(code.indexOf('b ='));
  });

  it('maps a lifted import back to the line it was written on', async () => {
    const code = `log(0);\nimport { x } from 'y';\nlog(x);`;
    const prepared = await prepare(code);
    // The import now leads the module; its text still belongs to the author's line 2.
    expect(prepared.source.startsWith(`import { x } from 'y';`)).toBe(true);
    expect(toSnippetOffset(prepared, prepared.source.indexOf(`'y'`))).toBe(code.indexOf(`'y'`));
    expect(toSnippetOffset(prepared, nth(prepared.source, 'log(x)'))).toBe(code.indexOf('log(x)'));
  });

  it('maps the block-expression and verbatim forms, which are one span each', async () => {
    const block = `{ name: wb.getName() }`;
    const asExpression = await prepare(block);
    expect(asExpression.kind).toBe('expression');
    expect(toSnippetOffset(asExpression, nth(asExpression.source, 'getName'))).toBe(block.indexOf('getName'));

    const broken = `const x = (`;
    const verbatim = await prepare(broken);
    expect(verbatim.kind).toBe('verbatim');
    expect(toSnippetOffset(verbatim, nth(verbatim.source, 'x ='))).toBe(broken.indexOf('x ='));
  });

  it('answers a position in the wrapper\'s own text with the nearest thing the author wrote', async () => {
    const code = `first();\nsecond();`;
    const prepared = await prepare(code);
    // The prologue belongs to no one: the author's first character.
    expect(toSnippetOffset(prepared, 0)).toBe(0);
    // Inside the settle ahead of `second()`: the author's next character.
    expect(toSnippetOffset(prepared, nth(prepared.source, 'whenCalculationReady'))).toBe(code.indexOf('second'));
    // Past everything the author wrote (the epilogue): the end of the last text that is theirs. An
    // expression statement's own `;` is the wrapper's by then, so that is the closing parenthesis.
    expect(toSnippetOffset(prepared, prepared.source.length - 1)).toBe(code.lastIndexOf(';'));
  });
});
