import { describe, it, expect } from 'vitest';

import { classify, prepare, toSnippetOffset } from '../Snippet';

/**
 * The snippet contract, exercised through the two promises it makes: every top-level statement is
 * implicitly awaited, and the final expression is the result.
 *
 * @remarks
 * These assert on the *generated wrapper source* rather than on a run, because the wrapper is what
 * every transport shares — the CLI loads it, MCP compiles it — and because a source assertion is
 * what pins the transform itself. {@link runBody} closes the loop for the cases where the question
 * is behavioral (does the binding actually exist?) rather than textual.
 */

/** The body of a prepared snippet — the wrapper minus its prologue and epilogue. */
async function bodyOf(code: string): Promise<string> {
  const { source } = await prepare(code);
  return source;
}

/**
 * Executes a prepared snippet's transform for real, returning `[result, bindings]`.
 *
 * @remarks
 * Runs the rewritten body in an async function with a stub context, so a transform that parses but
 * loses a binding (the multi-declarator defect) fails here even when the source looks plausible.
 */
async function runBody(code: string, probe: string): Promise<any> {
  const { source } = await prepare(code);
  const body = source
    .replace(/^[\s\S]*?let __result: any = undefined;\n/, '')
    .replace(/\n\s*;\n\s*return __result;\n};$/, '');
  const fn = new Function('ctx', `
    return (async () => {
      const { wb, log, warn, error, args } = ctx;
      let __result = undefined;
      ${body}
      ;
      return ${probe};
    })();
  `);
  return fn({ wb: {}, log: () => {}, warn: () => {}, error: () => {}, args: {} });
}

describe('Snippet.classify', () => {
  it.each([
    ['export default function main(ctx) {}', 'script'],
    // `export default` in front of an entry function alone is ceremony: it runs as a snippet.
    ['export default async (ctx) => {}', 'snippet'],
    ['export default function (ctx) {}', 'snippet'],
    ['const n = 1;\nexport default ({ wb }) => n;', 'snippet'],
    // Anything else exported keeps the script form.
    ['export function f(x: number) { return x; }\nexport default ({ wb }) => 1;', 'script'],
    ['function main() {}\nexport { main as default };', 'script'],
    ['export default class Foo {}', 'script'],
    ['wb.getWorksheet("A")', 'snippet'],
    ['const a = 1;\nlog(a);', 'snippet'],
    // A default export the old scanner could confuse itself with — inside a string, not at top level.
    ['log("export default nope")', 'snippet'],
  ])('classifies %j as %s', async (code, form) => {
    expect(await classify(code)).toBe(form);
  });
});

describe('Snippet.prepare — a snippet that is a function is called', () => {
  const CALL = /const __entry: \(ctx: SheetXL\.IScript\.ScriptContext\) => unknown = \((.*)\); __result = await __entry\(ctx\);/s;

  it.each([
    ['async ({ wb }) => wb.getWorksheetAt(0)', 'async ({ wb }) => wb.getWorksheetAt(0)'],
    ['export default async ({ wb }) => { return 1; };', 'async ({ wb }) => { return 1; }'],
    ['export default async function (ctx) { return 1; }', 'async function (ctx) { return 1; }'],
    ['function main(ctx) { return ctx.wb; }', 'function main(ctx) { return ctx.wb; }'],
  ])('calls %j with the context, typed as an entry', async (code, called) => {
    expect(CALL.exec(await bodyOf(code))?.[1]).toBe(called);
  });

  it('leaves a function that is not the snippet alone', async () => {
    // A helper followed by the work, and a function that is only a value along the way.
    for (const code of [`function helper() { return 1; }\nlog(helper());`, `const f = () => 1;\nf()`]) {
      expect(await bodyOf(code)).not.toContain('__entry');
    }
  });

  it('keeps the entry\'s positions in the author\'s own text', async () => {
    const code = `export default async ({ wb }) => wb.nope`;
    const prepared = await prepare(code);
    const at = prepared.source.indexOf('wb.nope');
    expect(toSnippetOffset(prepared, at)).toBe(code.indexOf('wb.nope'));
  });
});

describe('Snippet.prepare — multi-declarator declarations', () => {
  // The reported defect: awaiting the statement's tail collapsed the remaining declarators into a
  // comma expression, dropping their bindings ("a is not defined") and mis-binding the first.
  it('awaits every declarator, not just the first', async () => {
    const source = await bodyOf(`const m = wb.getWorksheet('A'), a = wb.getWorksheet('B');\nlog(m);`);
    expect(source).toContain(`const m = await (wb.getWorksheet('A')), a = await (wb.getWorksheet('B'));`);
    expect(source).not.toContain(`await (wb.getWorksheet('A'), a =`);
  });

  it('binds every declarator at runtime', async () => {
    const result = await runBody(
      `const m = Promise.resolve('A'), a = Promise.resolve('B');\nlog(m);`,
      '[m, a]'
    );
    expect(result).toEqual(['A', 'B']);
  });

  it.each([
    ['destructuring', `const { a, b } = { a: 1, b: 2 }, c = 3;\nlog(c);`, '[a, b, c]', [1, 2, 3]],
    ['bare declarator', `let a, b = 2;\nlog(b);`, '[a, b]', [undefined, 2]],
    ['arrow with comma params', `const f = (x, y) => x + y, g = 2;\nlog(g);`, '[f(1, 1), g]', [2, 2]],
    ['array literal', `const xs = [1, 2], y = 3;\nlog(y);`, '[xs, y]', [[1, 2], 3]],
    ['comma inside a string', `const s = "x,y", t = 3;\nlog(t);`, '[s, t]', ['x,y', 3]],
  ])('handles %s', async (_label, code, probe, expected) => {
    expect(await runBody(code, probe)).toEqual(expected);
  });
});

describe('Snippet.prepare — statement boundaries', () => {
  // The larger defect the declarator bug sat inside: the old transform split on `;`, so a
  // semicolon-free snippet was one segment and silently lost BOTH contract promises.
  it('rewrites a snippet with no semicolons at all', async () => {
    const source = await bodyOf(`const a = Promise.resolve(1)\nconst b = Promise.resolve(2)\nlog(a)`);
    expect(source).toContain('const a = await (Promise.resolve(1))');
    expect(source).toContain('const b = await (Promise.resolve(2))');
    expect(source).toContain('__result = await (log(a));');
  });

  it('respects ASI rather than guessing at it', async () => {
    // `x\n[a, b]` is ONE expression — a member access, not two statements — and no amount of
    // newline is a statement boundary there. Splitting on lines would silently change the meaning
    // of the author's code; the parser sees what the engine sees.
    const source = await bodyOf(`const a = [1]\nconst b = Promise.resolve(a)\n[0]`);
    expect(source).toContain('const b = await (Promise.resolve(a)\n[0]);');
  });

  it('awaits and returns across newline-separated statements', async () => {
    // Note the ASI hazard this deliberately avoids: `[a, b]` after an unterminated line would
    // index, not start a new statement. The parser sees the same statements a JS engine does.
    const result = await runBody(
      `const a = Promise.resolve(1)\nconst b = Promise.resolve(2)\nlog(a)`,
      '[a, b]'
    );
    expect(result).toEqual([1, 2]);
  });

  it('keeps the final expression as the result', async () => {
    expect(await runBody(`log('x');\nPromise.resolve(42);`, '__result')).toBe(42);
  });

  it('gives a declaration no result — a declaration evaluates to nothing at a prompt', async () => {
    expect(await runBody(`log('x');\nconst a = 1;`, '__result')).toBeUndefined();
  });

  it('does not lose the result to a trailing semicolon', async () => {
    expect(await runBody(`Promise.resolve(7);;`, '__result')).toBe(7);
  });

  it('leaves nested code alone — only TOP-LEVEL statements are rewritten', async () => {
    const source = await bodyOf(`for (const c of [1, 2]) { log(c) }\nPromise.resolve(1);`);
    expect(source).toContain('for (const c of [1, 2]) { log(c) };');
    expect(source).not.toContain('await (c)');
  });

  it('treats a lone block as the object literal it looks like', async () => {
    const { kind } = await prepare(`{ a: 1 }`);
    expect(kind).toBe('expression');
    expect(await runBody(`{ a: 1 }`, '__result')).toEqual({ a: 1 });
  });
});

describe('Snippet.prepare — TypeScript and trivia', () => {
  it('preserves type annotations verbatim', async () => {
    const source = await bodyOf(`const n: number = 1, s: string = 'x';\nlog(n);`);
    expect(source).toContain(`const n: number = await (1), s: string = await ('x');`);
  });

  it('is not confused by a comment holding a comma or an equals', async () => {
    const result = await runBody(`const a = 1; // set a = 2, b = 3\nlog(a);`, 'a');
    expect(result).toBe(1);
  });

  it('keeps comments and line numbers intact', async () => {
    const { source, lineOffset } = await prepare(`// first\nconst a = 1;\n// second\nlog(a);`);
    expect(source).toContain('// first');
    expect(source).toContain('// second');
    // The user's line 1 must land exactly `lineOffset` lines into the wrapper.
    expect(source.split('\n')[lineOffset]).toContain('// first');
  });

  it('hoists imports out of the wrapper function, where they would be illegal', async () => {
    const { source, lineOffset } = await prepare(`import { x } from 'y';\nlog(x);`);
    const lines = source.split('\n');
    expect(lines[0]).toBe(`import { x } from 'y';`);
    expect(source).not.toContain(`  import { x }`);
    // The import left its line behind, so `log(x)` is still the snippet's line 2.
    expect(lines[lineOffset + 1]).toContain('await (log(x))');
  });
});

/**
 * Calculation is asynchronous, and a snippet author reads values the way Excel shows them: a formula
 * written by one statement is calculated before the next statement reads it.
 */
describe('Snippet.prepare — settled calculation between statements', () => {
  /** Runs the transform against a context whose `wb` counts settles and reports what each read saw. */
  async function runSettled(code: string): Promise<{ result: any, settles: number }> {
    let settles = 0;
    let value: number | null = null;
    const wb = {
      set: (v: number) => { queueMicrotask(() => { value = v; }); }, // lands after the statement, like calc
      get: () => value,
      whenCalculationReady: () => { settles++; return Promise.resolve(); }
    };
    const { source } = await prepare(code);
    const body = source
      .replace(/^[\s\S]*?let __result: any = undefined;\n/, '')
      .replace(/\n\s*;\n\s*return __result;\n};$/, '');
    const fn = new Function('ctx', `
      return (async () => {
        const { wb, log, warn, error, args } = ctx;
        let __result = undefined;
        ${body}
        ;
        return __result;
      })();
    `);
    const result = await fn({ wb, log: () => {}, warn: () => {}, error: () => {}, args: {} });
    return { result, settles };
  }

  it('settles ahead of every statement but the first, on the same line', async () => {
    const { source, lineOffset } = await prepare(`wb.set(2);\nwb.get();`);
    const lines = source.split('\n');
    expect(lines[lineOffset]).toBe('await (wb.set(2));');
    expect(lines[lineOffset + 1]).toBe('await wb?.whenCalculationReady?.(); __result = await (wb.get());');
  });

  it('reads the value a previous statement wrote', async () => {
    const { result, settles } = await runSettled(`wb.set(2);\nwb.get();`);
    expect(result).toBe(2);
    expect(settles).toBe(1);
  });

  it('settles ahead of declarations and control flow too', async () => {
    const { result, settles } = await runSettled(
      `wb.set(2);\nconst a = wb.get();\nlet b = 0;\nfor (const n of [1]) { b = wb.get() + n; }\n[a, b];`
    );
    expect(result).toEqual([2, 3]);
    expect(settles).toBe(4);
  });

  it('runs without a workbook in the context', async () => {
    expect(await runBody(`const a = 1;\na + 1;`, '__result')).toBe(2);
  });
});

/**
 * The doc slot belongs to the AUTHOR. Downstream, a summary is the undo label and cannot be told
 * apart from an authored one, so a generated summary would name the user's change for them and
 * outrank every host default. These pin the two halves: the slot stays empty unless the author filled
 * it, and their comment reaches the export when they did.
 */
describe('Snippet.prepare — the doc comment', () => {
  it('emits no summary of its own', async () => {
    const { source } = await prepare(`log(1);`);
    expect(source).not.toContain('/**');
  });

  it('promotes the snippet\'s own JSDoc to document the export', async () => {
    const { source } = await prepare(`/** Bump the Q3 target. */\nwb.getRange('A1').setValue(4);`);
    const lines = source.split('\n');
    // Immediately above the export — anywhere else and it documents nothing.
    expect(lines[lines.findIndex((l) => l.startsWith('export default')) - 1])
      .toBe('/** Bump the Q3 target. */');
  });

  it('keeps line mapping exact through a hoisted doc, single- or multi-line', async () => {
    for (const doc of [`/** One line. */`, `/**\n * Two lines.\n */`]) {
      const { source, lineOffset } = await prepare(`${doc}\nlog(1);`);
      // The doc is COPIED, so the author's line 1 is still the doc's first line.
      expect(source.split('\n')[lineOffset]).toBe(doc.split('\n')[0]);
    }
  });

  it('takes the doc comment nearest the code, not a leading license block', async () => {
    const { source } = await prepare(`/* (c) 2026 */\n/** What it does. */\nlog(1);`);
    const lines = source.split('\n');
    expect(lines[lines.findIndex((l) => l.startsWith('export default')) - 1])
      .toBe('/** What it does. */');
  });

  it('ignores a line comment — only a JSDoc block is a description', async () => {
    const { source } = await prepare(`// just a note\nlog(1);`);
    expect(source).not.toContain('/**');
  });
});

describe('Snippet.prepare — failure is never silent', () => {
  it('wraps an unparseable snippet verbatim so the loader reports the real error', async () => {
    const { kind, warning } = await prepare(`const a = (;`);
    expect(kind).toBe('verbatim');
    // No warning: the snippet is genuinely broken and the compiler's message is the better one.
    expect(warning).toBeUndefined();
  });

  it('never emits a bare assignment to an undeclared name', async () => {
    const { source } = await prepare(`const m = 1, a = 2;\nlog(m);`);
    expect(source).not.toMatch(/\(\s*[^)]*,\s*a\s*=/);
  });
});
