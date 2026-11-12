import type { Diagnostic } from '@sheetxl/scripting';

import * as Snippet from './Snippet';

/**
 * What a run did that a type check may explain: it threw, or a snippet's final expression came
 * back `undefined`.
 *
 * @remarks
 * `undefined` is a symptom because the SheetXL API never returns it - `null` is the empty answer.
 * A read that produced `undefined` read something that is not there.
 */
export type RunSymptom = 'threw' | 'undefined';

/** `Property 'x' does not exist on type 'T'`, with and without TypeScript's "Did you mean". */
const MISSING_MEMBER_CODES = new Set(['TS2339', 'TS2551']);

/** The findings that can be the reason a run threw a `TypeError` or a `ReferenceError`. */
const THROW_CODES = new Set([
  ...MISSING_MEMBER_CODES,
  'TS2304', 'TS2552', // a name that is not declared
  'TS2448', 'TS2588', // used before its declaration; assigned to a constant
  'TS2531', 'TS2532', 'TS2533', 'TS18047', 'TS18048', 'TS18049', // possibly null or undefined
  'TS2349', 'TS2351', 'TS2721', 'TS2722', 'TS2723', // not callable
]);

/**
 * A missing member on a value the code built itself (`const o = {}`, `const a = []`), which says
 * nothing about the API.
 */
const LOCAL_RECEIVER = /on type '(never|\{\})'/;

/**
 * Whether a failure is one a type check can explain, by the error's `name`. A failure with no
 * name (a thrown string, an error that crossed a wire as its message) is checked too.
 */
export function isExplainable(errorName: string | undefined): boolean {
  return errorName === undefined || errorName === 'TypeError' || errorName === 'ReferenceError';
}

/**
 * Type-checks the source of a run that has already gone wrong, and returns the findings that can
 * explain it.
 *
 * @remarks
 * A run is never type-checked before it executes: the types are for discovery, not enforcement,
 * and most of what a strict check reports about code written to run once (an unannotated `[]`,
 * `catch (e)`, a field added to `{}`) runs correctly. A failed run leaves nothing behind, so
 * running first costs nothing, and the check is paid only by a run with a symptom.
 *
 * The one implementation behind `sheetxl -e` and the MCP `run` tool, so both answer alike.
 *
 * Positions are in `source` as given - a snippet is checked in its wrapper and mapped back.
 * A `threw` finding is an error; an `undefined` one is a warning, as the run completed.
 * Never throws: a diagnosis that fails must not replace the failure it was diagnosing.
 */
export async function diagnoseRun(source: string, symptom: RunSymptom): Promise<Diagnostic[]> {
  try {
    const prepared = await Snippet.classify(source) === 'snippet' ? await Snippet.prepare(source) : null;
    if (symptom === 'undefined' && !prepared?.expectsValue) return [];
    const [{ ScriptCompiler }, { getScriptingDeclarations }] = await Promise.all([
      import('@sheetxl/scripting'),
      import('@sheetxl/sdk'),
    ]);
    // A snippet is checked in the wrapper it ran in — that is what declares `wb` and `log`.
    const { diagnostics } = await ScriptCompiler.compile({
      source: prepared?.source ?? source,
      ambientTypes: await getScriptingDeclarations(),
      lenient: true,
      disableBundle: true,
      disableSourceMap: true,
    });
    const codes = symptom === 'threw' ? THROW_CODES : MISSING_MEMBER_CODES;
    return diagnostics
      .filter(d => d.severity === 'error' && codes.has(d.code)
        && !(MISSING_MEMBER_CODES.has(d.code) && LOCAL_RECEIVER.test(d.message)))
      .map((d): Diagnostic => ({
        ...d,
        start: prepared ? Snippet.toSnippetOffset(prepared, d.start) : d.start,
        ...(symptom === 'undefined' ? { severity: 'warning', message: `${d.message} It reads as undefined.` } : {}),
      }));
  } catch {
    return [];
  }
}
