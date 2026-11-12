/**
 * Snippet classification and source transforms — shared by every transport that accepts inline
 * code (`sheetxl -e` / stdin on the CLI, the `run` tool's `code`/`path` on MCP).
 *
 * @remarks
 * **What the source means is decided by the code itself, not by how it arrived.** A module with a
 * top-level default export is a *script*: it is handed the run context and its return value is the
 * result. Anything else is a *snippet*: the author writes what they would type at a prompt, and the
 * contract promises two things a bare paste into an async function does not give them —
 *  1. **implicit await**: nothing in a snippet is ever written `await`, yet a promise-returning
 *     statement must have settled before the next one runs;
 *  2. **the final expression is the result**: exactly like a REPL, or `node -p`;
 *  3. **values are current**: calculation is asynchronous, so a formula set by one statement is
 *     settled before the next statement runs — `setFormula('=1+1')` then `getValue()` reads `2`,
 *     the way it reads in Excel, rather than the `null` a bare paste would see.
 *
 * **A snippet that is a function is called.** Its value is the function — `async ({ wb }) => …` as
 * the final expression, or a snippet that is only `function main(ctx) { … }` — so it is called with
 * the context, typed as a script's entry would be, and its return is the result. `export default` in
 * front of an arrow or an anonymous function, with nothing else exported, is ceremony for the same
 * thing and runs the same way: the script form is kept for what needs it, a named entry or exports.
 *
 * This is the same problem Node's REPL solves in `lib/internal/repl/await.js`, and it is solved the
 * same way: **parse for real, then rewrite the top-level statements from the AST.** Statement
 * boundaries, declarator lists, binding patterns, ASI, comments, regex-vs-division and template
 * nesting are all a parser's job, and every one of them is a bug when they are a scanner's instead.
 * The one place we deliberately diverge from the REPL is the await: Node makes the author write it,
 * and a snippet's author never does.
 *
 * Because the source is TypeScript, the parser is TypeScript's — `createSourceFile`, parse-only, no
 * `Program`. It is the same module the `ScriptCompiler` links, so the transform and the linter can
 * never disagree about what a snippet means, and a transport that already compiles (MCP) pays
 * nothing for it: the module is loaded once per process and cached.
 *
 * **Nothing here degrades silently.** The transform is deterministic: either the snippet parsed, in
 * which case it is rewritten exactly once, or it did not, in which case it is wrapped verbatim so
 * the loader that runs it reports the authoritative syntax error against real positions. A snippet
 * is never quietly run with the contract switched off.
 *
 * The generated wrapper is deliberately the *validated* macro shape (named default export, typed
 * context parameter) so the identical source compiles on every path: the CLI's type-stripping
 * loader ignores the annotations, and the `ScriptCompiler`'s linter requires them.
 */

type TypeScriptModule = typeof import('typescript');
type SourceFile = import('typescript').SourceFile;
type VariableStatement = import('typescript').VariableStatement;

/**
 * The TypeScript module, lazily and once.
 *
 * @remarks
 * Imported directly rather than through `@sheetxl/scripting`'s `lib/typescript` conditional export,
 * which exists to pick the node or browser build. Parsing is node-side by architecture rather than
 * by preference: a snippet is wrapped AND COMPILED in the tool layer, and only the compiled module
 * crosses to a webview — whose CSP blocks the compiler outright (see `SessionRegistry`). Parsing
 * therefore happens wherever compiling already does, so there is only ever one build to pick. If
 * that ever stops being true, this function is the seam: point it back at the conditional export.
 *
 * Resolves to `null` rather than throwing when TypeScript is absent — it is an optional peer, and a
 * snippet that cannot be *transformed* can still be *run*. See {@link prepare}, which says so out
 * loud rather than pretending the contract held.
 */
let _tsPromise: Promise<TypeScriptModule | null> | null = null;

function getTypescript(): Promise<TypeScriptModule | null> {
  if (!_tsPromise) {
    _tsPromise = (async () => {
      try {
        // TypeScript ships CommonJS: under ESM the namespace carries the module on `default`, while
        // cjs-module-lexer also surfaces the named exports. Prefer `default`, accept either.
        const mod: any = await import('typescript');
        return (mod.default ?? mod) as TypeScriptModule;
      } catch {
        return null;
      }
    })();
  }
  return _tsPromise;
}

/**
 * Parses a snippet, or `null` when it cannot be trusted.
 *
 * @remarks
 * `createSourceFile` never throws — a malformed source comes back as a partial tree carrying parse
 * diagnostics. Those diagnostics are not ours to report (the loader or compiler that runs the
 * wrapper produces the real message, with positions that point at the user's own source), but they
 * do mean the tree is not a faithful description of the code, so the transform must not run on it.
 */
async function parseSnippet(code: string): Promise<{ ts: TypeScriptModule; sf: SourceFile } | null> {
  const ts = await getTypescript();
  if (!ts) return null;
  const sf = ts.createSourceFile(
    'snippet.ts', code, ts.ScriptTarget.Latest, /* setParentNodes */ false, ts.ScriptKind.TS
  );
  if (((sf as any).parseDiagnostics?.length ?? 0) > 0) return null;
  return { ts, sf };
}

function countNewlines(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') n++;
  return n;
}

/**
 * A declaration with every initializer awaited — *every* one, not just the first.
 *
 * @remarks
 * `const m = getSheet('a'), n = getSheet('b')` is one statement holding two declarators, and each
 * one binds a name. Awaiting the statement's tail instead of each initializer collapses the rest
 * into a comma expression (`const m = await (getSheet('a'), n = getSheet('b'))`), which parses,
 * drops `n`'s binding, and hands `m` the *last* operand's value.
 */
function emitInitializers(emit: Emitter, sf: SourceFile, stmt: VariableStatement): void {
  let cursor = stmt.getStart(sf);
  for (const declaration of stmt.declarationList.declarations) {
    const initializer = declaration.initializer;
    if (!initializer) continue; // `let a, b = 1` — a bare declarator has nothing to await
    const from = initializer.getStart(sf);
    emit.copy(cursor, from);
    emit.add('await (');
    emit.copy(from, initializer.end);
    emit.add(')');
    cursor = initializer.end;
  }
  emit.copy(cursor, stmt.end);
  emit.terminate();
}

/**
 * A run of the author's own text inside an emitted source: `length` characters that sit at `at`
 * in the emitted text and came from `from` in the snippet.
 */
export interface Span {
  at: number;
  from: number;
  length: number;
}

/**
 * Builds emitted text from two kinds of piece — text the transform ADDS and text it COPIES from
 * the snippet — and remembers where each copy landed.
 *
 * @remarks
 * The rewrite keeps every LINE where it was, but not every column: a statement gains an
 * `await (` and, after the first, the settle ahead of it. Recording the copies as they are made is
 * what lets a compiler position in the emitted text be answered in the author's own coordinates
 * exactly ({@link toSnippetOffset}), not by arithmetic that has to know every insertion.
 */
class Emitter {
  readonly spans: Span[] = [];
  private readonly _parts: string[] = [];
  private _length = 0;

  constructor(private readonly _code: string) {}

  /** Text the transform adds. */
  add(text: string): void {
    this._parts.push(text);
    this._length += text.length;
  }

  /** The author's text `[from, to)`, emitted exactly as written. */
  copy(from: number, to: number): void {
    if (to <= from) return;
    this.spans.push({ at: this._length, from, length: to - from });
    this.add(this._code.slice(from, to));
  }

  /** Exactly one terminating `;` — the statements this emits are never ASI's problem. */
  terminate(): void {
    const last = this._parts[this._parts.length - 1];
    if (!last?.endsWith(';')) this.add(';');
  }

  toString(): string {
    return this._parts.join('');
  }
}

/** The rewritten body, plus whatever had to be lifted out of the wrapper function. */
interface Rewritten {
  body: string;
  /** Where the author's text sits within {@link body}. */
  spans: Span[];
  /** `import` declarations, which are only legal at module scope — with where each came from. */
  hoisted: { text: string; from: number }[];
  /** See {@link Prepared.expectsValue}. */
  expectsValue: boolean;
}

/** The wrapper's own output channels: a call to one is the snippet reporting, and returns nothing. */
const OUTPUT_CALLS = new Set(['log', 'warn', 'error']);

/**
 * Emitted ahead of every top-level statement but the first: the previous statement's writes are
 * calculated before this one reads. `wb` is the wrapper's context binding; optional so a transform
 * exercised against a bare context (tests) still runs. Resolves at once when nothing is pending.
 */
const SETTLE = 'await wb?.whenCalculationReady?.(); ';

/** The first top-level statement's index when it is the only one that runs, else `-1`. */
function soleStatement(ts: TypeScriptModule, sf: SourceFile): number {
  let sole = -1;
  for (let i = 0; i < sf.statements.length; i++) {
    const stmt = sf.statements[i];
    if (stmt.kind === ts.SyntaxKind.EmptyStatement || ts.isImportDeclaration(stmt) || ts.isImportEqualsDeclaration(stmt)) continue;
    if (sole !== -1) return -1;
    sole = i;
  }
  return sole;
}

/** The function a snippet IS, and where its text starts and ends — see the module remarks. */
interface Entry {
  index: number;
  from: number;
  to: number;
}

/**
 * The snippet's entry function, or `null`: an arrow or function expression as the final statement
 * (behind `export default` or not), an anonymous `export default function`, or a snippet that is
 * only a function declaration. `from` skips `export default`, which the entry does not need.
 */
function findEntry(ts: TypeScriptModule, sf: SourceFile): Entry | null {
  const statements = sf.statements;
  let index = statements.length - 1;
  while (index >= 0 && statements[index].kind === ts.SyntaxKind.EmptyStatement) index--;
  if (index < 0) return null;
  const stmt = statements[index];
  const isFunction = (expression: import('typescript').Expression): boolean => {
    while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
    return ts.isArrowFunction(expression) || ts.isFunctionExpression(expression);
  };
  if ((ts.isExpressionStatement(stmt) || (ts.isExportAssignment(stmt) && !stmt.isExportEquals)) && isFunction(stmt.expression)) {
    return { index, from: stmt.expression.getStart(sf), to: stmt.expression.end };
  }
  if (ts.isFunctionDeclaration(stmt) && stmt.body) {
    const modifiers = ts.getModifiers(stmt) ?? [];
    const exported = modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const isDefault = modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    if ((isDefault && !stmt.name) || (!exported && soleStatement(ts, sf) === index)) {
      let from = stmt.getStart(sf);
      for (const m of modifiers) {
        if (m.kind === ts.SyntaxKind.ExportKeyword || m.kind === ts.SyntaxKind.DefaultKeyword) from = m.end;
      }
      while (from < stmt.end && /\s/.test(sf.text[from])) from++;
      return { index, from, to: stmt.end };
    }
  }
  return null;
}

/**
 * The entry's call, around its text: typed as a script's entry, so its parameters are the context
 * (`({ wb })` is checked as the workbook), and awaited into the result.
 */
const ENTRY_OPEN = 'const __entry: (ctx: SheetXL.IScript.ScriptContext) => unknown = (';
const entryClose = (resultVar: string): string => `); ${resultVar} = await __entry(ctx);`;

/**
 * Rewrites a snippet's top-level statements: implicit await on each, final expression as result,
 * and the calculation settled between statements.
 *
 * @remarks
 * Only *top-level* statements are touched — a `for` body or a nested function is the author's own
 * code and is emitted exactly as written. Leading trivia is emitted verbatim, so comments survive
 * and every line of the body keeps the line number it had in the submitted snippet.
 */
function rewrite(ts: TypeScriptModule, sf: SourceFile, resultVar: string): Rewritten {
  const code = sf.text;
  const statements = sf.statements;

  // The completion value is the last statement's, and only when that statement is an expression —
  // `const x = 1` evaluates to nothing at a REPL prompt either. Trailing `;` noise is skipped so a
  // snippet does not lose its result to a stray semicolon.
  let resultIndex = -1;
  for (let i = statements.length - 1; i >= 0; i--) {
    if (statements[i].kind === ts.SyntaxKind.EmptyStatement) continue;
    if (ts.isExpressionStatement(statements[i])) resultIndex = i;
    break;
  }

  const entry = findEntry(ts, sf);
  let expectsValue = false;
  if (!entry && resultIndex !== -1) {
    const expression = (statements[resultIndex] as import('typescript').ExpressionStatement).expression;
    expectsValue = !(ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)
      && OUTPUT_CALLS.has(expression.expression.text));
  }
  const hoisted: Rewritten['hoisted'] = [];
  const emit = new Emitter(code);
  let cursor = 0;
  // Nothing has run before the first statement, so there is nothing to settle ahead of it.
  let ran = false;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const start = stmt.getStart(sf);
    emit.copy(cursor, start); // leading trivia: comments and blank lines, as written
    cursor = stmt.end;

    // An `import` cannot live inside the wrapper function. Lift it to module scope and leave its
    // newlines behind, so everything after it keeps its line number.
    if (ts.isImportDeclaration(stmt) || ts.isImportEqualsDeclaration(stmt)) {
      const text = code.slice(start, stmt.end);
      hoisted.push({ text, from: start });
      emit.add('\n'.repeat(countNewlines(text)));
      continue;
    }
    // Same line as the statement it precedes, so every line keeps its number.
    if (ran) emit.add(SETTLE);
    ran = true;
    if (entry?.index === i) {
      emit.add(ENTRY_OPEN);
      emit.copy(entry.from, entry.to);
      emit.add(entryClose(resultVar));
      continue;
    }
    if (ts.isVariableStatement(stmt)) {
      emitInitializers(emit, sf, stmt);
      continue;
    }
    if (ts.isExpressionStatement(stmt)) {
      emit.add(i === resultIndex ? `${resultVar} = await (` : 'await (');
      emit.copy(stmt.expression.getStart(sf), stmt.expression.end);
      emit.add(');');
      continue;
    }
    emit.copy(start, stmt.end); // control flow, declarations, everything else — the author's own
    emit.terminate();
  }
  emit.copy(cursor, code.length); // trailing trivia

  return { body: emit.toString(), spans: emit.spans, hoisted, expectsValue };
}

// ── Classification ────────────────────────────────────────────────────────────

/** How a source will run — see the module remarks for the contract. */
export type SourceForm = 'script' | 'snippet';

/**
 * Whether the source has a top-level default export — the one fact that decides {@link classify}.
 *
 * @remarks
 * All three spellings count: `export default <expr>`, `export default function|class …` (a
 * declaration carrying the modifier, not an export assignment), and `export { x as default }`.
 */
function hasDefaultExport(ts: TypeScriptModule, sf: SourceFile): boolean {
  for (const stmt of sf.statements) {
    if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) return true;
    if (ts.canHaveModifiers(stmt)) {
      const modifiers = ts.getModifiers(stmt);
      if (modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) return true;
    }
    if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      if (stmt.exportClause.elements.some((e) => e.name.text === 'default')) return true;
    }
  }
  return false;
}

/**
 * Last-resort classification when TypeScript will not load.
 *
 * @remarks
 * Deliberately a line-anchored regex and nothing more. The alternative — a hand-rolled tracker for
 * strings, comments and brackets — is the very thing this module replaced: several hundred lines
 * that only run when the real parser is missing, and so are never exercised and never right.
 */
function hasDefaultExportFallback(code: string): boolean {
  return /^\s*export\s+default\b/m.test(code) || /^\s*export\s*\{[^}]*\bas\s+default\b/m.test(code);
}

/**
 * Whether the only export is `export default` in front of an arrow or an anonymous function — the
 * ceremony a snippet's entry does not need (see the module remarks).
 */
function isEntryOnlyExport(ts: TypeScriptModule, sf: SourceFile): boolean {
  const entry = findEntry(ts, sf);
  if (!entry) return false;
  return sf.statements.every((stmt, i) => {
    if (i === entry.index) return true;
    if (ts.isExportAssignment(stmt) || ts.isExportDeclaration(stmt)) return false;
    return !(ts.canHaveModifiers(stmt) && ts.getModifiers(stmt)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
  });
}

/**
 * `script` when the source has a top-level default export; `snippet` otherwise — and when that
 * export is only an entry function (`export default async ({ wb }) => …`), which runs as a snippet.
 */
export async function classify(code: string): Promise<SourceForm> {
  const parsed = await parseSnippet(code);
  // A source that will not parse cannot be a script: a script must at minimum expose an entry.
  if (!parsed) return hasDefaultExportFallback(code) ? 'script' : 'snippet';
  const { ts, sf } = parsed;
  return hasDefaultExport(ts, sf) && !isEntryOnlyExport(ts, sf) ? 'script' : 'snippet';
}

// ── Wrapping ─────────────────────────────────────────────────────────────────

export interface WrapOptions {
  /**
   * Statements emitted after the body, before the closing brace. Sees `__result` (the final
   * expression's value) and the destructured context (`wb`, `log`, …). Defaults to
   * `return __result;` — the script-contract shape, where the return value is the run's result.
   */
  epilogue?: string;
}

/** A snippet wrapped as a run-function module, ready to compile or load. */
export interface Prepared {
  /** The complete wrapper module source. */
  source: string;
  /**
   * Which transform produced it: the statement-level rewrite (implicit await, final expression is
   * the result), a single parenthesized expression, or the snippet verbatim — which means neither
   * promise was kept and {@link warning} says why.
   */
  kind: 'expression' | 'statements' | 'verbatim';
  /**
   * Lines of wrapper prologue before the first line of user code. Exact for every kind: the
   * rewrite emits the original trivia, so no line moves. It places LINES only — to point a
   * compiler position back into the snippet, line and column, use {@link toSnippetOffset}.
   */
  lineOffset: number;
  /** Where the author's text sits within {@link source}, in source order. */
  spans: Span[];
  /**
   * Whether the snippet ends in an expression whose value is its answer — not a statement, not a
   * call to `log`/`warn`/`error`, and not an entry function, which may return nothing as a script
   * may. Such a snippet answering `undefined` read something that is not there.
   */
  expectsValue: boolean;
  /**
   * Set only when the contract could not be honored — no implicit await, no result. Callers should
   * surface it; a snippet quietly returning `undefined` is worse than one that failed.
   */
  warning?: string;
}

/**
 * Lines of prologue {@link wrapBody} emits before the body. Kept adjacent to the template so the
 * two cannot drift. A hoisted doc comment is counted separately — see {@link leadingDoc}.
 */
const PROLOGUE_LINES = 3;

/**
 * The label a host should fall back to for an unnamed snippet run.
 *
 * @remarks
 * Exported rather than emitted as the wrapper's own JSDoc, which is the author's slot and must stay
 * empty when the author left it empty — see {@link leadingDoc}. A caller passes this as the SDK's
 * `RunOptions.defaultDescription`, the floor *below* a documented entry's summary. Deliberately not
 * "inline snippet": nothing is being inlined anywhere, code is being run.
 */
export const DEFAULT_DESCRIPTION = 'Run Snippet';

/**
 * Wraps a snippet body as a run-function module.
 *
 * @remarks
 * The destructure is the snippet contract: `wb`/`log`/`warn`/`error`/`args` are the five implicit
 * globals — `console.log` is not part of it (it bypasses the output channel). The wrapper is the
 * validated macro shape — a NAMED default export with a typed context parameter — because the
 * `ScriptCompiler`'s linter requires both, while type-stripping loaders simply erase them.
 *
 * `doc` is the author's own leading JSDoc, promoted to document the export. The wrapper emits NO doc
 * of its own: a generated summary is indistinguishable from an authored one downstream, and the
 * summary is what names the undo entry — so inventing one silently outranks every host default and
 * tells the user something the author never said.
 */
const wrapBody = (
  body: string, epilogue: string, hoisted: string[] = [], doc?: string
): { source: string; bodyStart: number } => {
  const head = [
    ...hoisted,
    ...(doc ? [doc] : []),
    `export default async function __snippet(ctx: SheetXL.IScript.ScriptContext): Promise<void> {`,
    `  const { wb, log, warn, error, args } = ctx;`,
    `  let __result: any = undefined;`,
  ].join('\n') + '\n';
  const tail = [
    body,
    // Terminates the body explicitly: a snippet ending in a line comment would otherwise swallow
    // the epilogue's first line.
    `  ;`,
    epilogue,
    `};`
  ].join('\n');
  return { source: head + tail, bodyStart: head.length };
};

/**
 * The snippet's own leading JSDoc (`/** … *\/`), or `undefined`.
 *
 * @remarks
 * A snippet's comment is the only way its author can name what it does, and until this it went
 * nowhere: the wrapper's doc slot sits above `export default` while the body — trivia and all — is
 * emitted INSIDE the function, where a doc comment documents nothing. Hoisting it makes the comment
 * the label the user sees in the undo menu, on both forms: a script documents its default export, a
 * snippet documents itself.
 *
 * COPIED, not moved: the body is emitted verbatim so a diagnostic's line still maps back through
 * {@link Prepared.lineOffset} by simple subtraction. The duplicate reads oddly in the generated
 * source and is worth exactly that.
 *
 * The LAST block comment wins, which is what TypeScript itself attaches — a file-leading license
 * block followed by a real doc comment resolves to the doc comment.
 */
function leadingDoc(ts: TypeScriptModule, sf: SourceFile): string | undefined {
  const first = sf.statements[0];
  if (!first) return undefined;
  const ranges = ts.getLeadingCommentRanges(sf.text, 0);
  if (!ranges?.length) return undefined;
  for (let i = ranges.length - 1; i >= 0; i--) {
    const range = ranges[i];
    if (range.kind !== ts.SyntaxKind.MultiLineCommentTrivia) continue;
    // Every JSDoc is a block comment; not every block comment is a JSDoc.
    const text = sf.text.slice(range.pos, range.end);
    if (text.startsWith('/**')) return text;
  }
  return undefined;
}

/**
 * The wrapper module for a snippet — one deterministic transform, never a ladder.
 *
 * @remarks
 * A snippet that is nothing but `{ … }` parses as a *block*, exactly as it would at a Node REPL
 * prompt, so `-e '{ name: s.getName() }'` would otherwise run as a labelled statement and produce
 * nothing. The REPL recovers by re-reading such input parenthesized; so does this, which also
 * sidesteps any position mapping — the whole snippet is the expression.
 */
export async function prepare(code: string, options?: WrapOptions): Promise<Prepared> {
  const epilogue = options?.epilogue ?? `  return __result;`;
  const parsed = await parseSnippet(code);

  if (!parsed) {
    const reason = (await getTypescript())
      // The snippet did not parse. Wrapping it verbatim hands the loader/compiler the user's own
      // source to complain about, which produces a better message than anything we could invent.
      ? undefined
      : 'TypeScript is unavailable, so this snippet ran without implicit await or a result value. ' +
        'Install the `typescript` peer dependency to restore them.';
    const { source, bodyStart } = wrapBody(code, epilogue);
    return {
      source,
      kind: 'verbatim',
      lineOffset: PROLOGUE_LINES,
      spans: [{ at: bodyStart, from: 0, length: code.length }],
      expectsValue: false,
      warning: reason
    };
  }

  const { ts, sf } = parsed;
  const statements = sf.statements;
  // The author's doc, promoted above the export — and counted, since it precedes the body.
  const doc = leadingDoc(ts, sf);
  const docLines = doc ? countNewlines(doc) + 1 : 0;
  if (statements.length === 1 && ts.isBlock(statements[0])) {
    const opening = `  __result = await (\n`;
    const { source, bodyStart } = wrapBody(`${opening}${code}\n  );`, epilogue, [], doc);
    return {
      source,
      kind: 'expression',
      lineOffset: PROLOGUE_LINES + docLines + 1,
      spans: [{ at: bodyStart + opening.length, from: 0, length: code.length }],
      expectsValue: true,
    };
  }

  const { body, spans, hoisted, expectsValue } = rewrite(ts, sf, '__result');
  const hoistedTexts = hoisted.map((h) => h.text);
  const hoistedLines = hoisted.length > 0 ? countNewlines(hoistedTexts.join('\n')) + hoisted.length : 0;
  const { source, bodyStart } = wrapBody(body, epilogue, hoistedTexts, doc);
  // The lifted imports lead the module, one per line; the body's own spans follow, shifted to where
  // the body landed. Both are already in source order, so the whole list is.
  let at = 0;
  const hoistedSpans = hoisted.map((h): Span => {
    const span = { at, from: h.from, length: h.text.length };
    at += h.text.length + 1;
    return span;
  });
  return {
    source,
    kind: 'statements',
    lineOffset: PROLOGUE_LINES + hoistedLines + docLines,
    spans: [...hoistedSpans, ...spans.map((s) => ({ ...s, at: s.at + bodyStart }))],
    expectsValue,
  };
}

/**
 * Where an offset into a prepared {@link Prepared.source} sits in the snippet the author wrote.
 *
 * @remarks
 * Exact wherever the offset falls in the author's own text, which is where a compiler puts a
 * diagnostic about it. An offset in text the wrapper added has no place in the snippet, so it
 * answers with the nearest thing that does: the author's next character, or the end of their last
 * text when nothing of theirs follows.
 */
export function toSnippetOffset(prepared: Prepared, offset: number): number {
  let before: Span | null = null;
  for (const span of prepared.spans) {
    if (span.at > offset) {
      const inside = before !== null && offset < before.at + before.length;
      return inside ? before!.from + (offset - before!.at) : span.from;
    }
    before = span;
  }
  if (!before) return 0;
  return before.from + Math.min(offset - before.at, before.length);
}
