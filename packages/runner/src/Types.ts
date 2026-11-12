export type Notifier = typeof import('@sheetxl/sdk').Notifier;

import { type IWorkbook } from '@sheetxl/sdk';

import { type LogRenderer, type MaybePromise } from '@sheetxl/utils';

/**
 * Arguments passed after `--` on the CLI (`sheetxl -f <script> [workbook] -- [args...]`).
 *
 * Parsing rules:
 * - Long flags: `--key=value` or `--key value`
 * - Short flags: `-k value` or `-v`
 * - Positionals: tokens not starting with `-` (appear in `_.`)
 * - Optional: we also accept `-long=value` as a long flag.
 * - Repeated flags: last one wins (no arrays).
 * - Types: values are strings or booleans; scripts can coerce as needed.
 */
// TODO - args as Type (coercion helpers)
export type ArgV = {
  /** Tail as typed by the user (everything after <script>). */
  raw: string[];
  /** Parsed flags (long/short) with string or boolean values. */
  kv: Record<string, string | boolean>;
  /** Positional args (order preserved). */
  _: string[];
} & {
  /**
   * Named flags, also spread onto the object itself — `args.region` and `args.kv.region` are the
   * same value. This is what makes `args` read identically on the CLI and on MCP (where it is the
   * caller's JSON object). `raw`/`kv`/`_` win on a collision.
   */
  [name: string]: any;
};


/**
 * The run context — the five members every run sees, on every transport, and the implicit globals
 * of an inline snippet: `wb`, `log`, `warn`, `error`, `args`. Nothing else (in particular, no
 * `console`): a script needing the SDK's module surface imports it like any other module.
 */
export type RunContext = {
  /**
   * All tail args after the script
   */
  readonly args: ArgV;
  /**
   * The workbook the run is against — from `--in`, or `null` when there is none.
   */
  readonly wb: IWorkbook | null;
  /**
   * The reporting channel — findings and results.
   *
   * @remarks
   * Variadic and value-taking, like `console.log`: `log('rows:', n)` and `log(range.getStats())`
   * both work. An SDK object renders as its markdown report when the host supplies a renderer
   * (the CLI does); otherwise it falls back to JSON.
   *
   * A promise is awaited and logs as its settled value, so `log(sheet.evaluate(…))` needs no
   * `await`. Output order is still call order.
   */
  readonly log: (...args: any[]) => void;
  /** Diagnostics: something surprising but survivable. Travels separately from `log` (stderr). */
  readonly warn: (...args: any[]) => void;
  /** Diagnostics: something wrong. Travels separately from `log` (stderr). */
  readonly error: (...args: any[]) => void;

  // signal?: AbortSignal;
  // cwd?: string;
  // env?: Record<string,string>;
  // timeoutMs?: number;
}

/**
 * The function signature for a script run by the CLI or the MCP `run` tool.
 *
 * @remarks
 * The return value is the run's RESULT, the same contract a snippet's final expression has, so it
 * is deliberately unconstrained — a tally, an `ICellRange`, a `getStats()` object. Returning
 * nothing is normal: a run whose output is its `log` has no answer to hand back.
 *
 * An `IWorkbook` is the one return that is also *structural*: it becomes the workbook the next
 * stage runs against, on top of being the result. Nothing else is inspected — an array is just an
 * array.
 *
 * Sync or async, both real: `function main(ctx): number[]` is as valid as the `async` spelling.
 */
export type RunFunction = (ctx: RunContext) => MaybePromise<IWorkbook | any | void>;

/**
 * Possible targets for the runner to execute
 */
export type RunTarget =
  | string                                  // path or URL to .ts/.tsx/.js/.mjs/.cjs
  | URL
  | { code: string; filename?: string }     // inline code, optional virtual filename
  | { runner: RunFunction };

export interface RunOptions {
  /**
   * What to run — a path, a URL, inline code, or a function.
   *
   * @remarks
   * An array runs as a serial pipeline: each stage gets the workbook the one before it left, and
   * the run answers with the LAST stage's return value. That makes a chain lossy in one corner —
   * an early stage that swapped the workbook is only visible if the last stage hands it back — so
   * a host that needs per-stage reporting calls `run` once per target instead, which is what the
   * CLI does (it owns the error report for the target that failed).
   */
  target: RunTarget | RunTarget[];
  /** The host's output sink (toasts on a UI host, the console on the CLI). Not exposed to scripts. */
  notifier?: Notifier;
  /**
   * Renders an SDK object logged by the script as its markdown report.
   *
   * @remarks
   * Injected because the renderer registry lives in `@sheetxl/query`. The CLI passes a closure
   * over `renderMarkdown` and its workbook; without it, logged objects fall back to JSON.
   */
  render?: LogRenderer;
  signal?: AbortSignal;
  timeoutMs?: number;
  /**
   * How long a finished stage waits for what it logged to settle, in milliseconds. `0` waits
   * indefinitely.
   *
   * @remarks
   * `log(promise)` prints what the promise settles to, so a stage is not done until its log is. A
   * value still unsettled when this elapses prints as `[pending]`; nothing is thrown and the rest
   * of the log is kept. Independent of `timeoutMs`, which bounds the script itself.
   *
   * @defaultValue `DEFAULT_LOG_TIMEOUT_MS` (10 seconds)
   */
  logTimeoutMs?: number;
  cwd?: string;
  ts?: { enabled?: boolean; cacheDir?: string };
}

/**
 * Run any RunFunction with a built in context.
 *
 * @remarks
 * The two data inputs are positional — the workbook the run is against, and the args it was given.
 * Everything else is host wiring and lives in {@link RunOptions}, including `target`, which is why
 * the options are required rather than optional.
 *
 * **Hands back exactly what the entry returned**, undisturbed — see {@link RunFunction}. A host
 * that also needs the workbook the run ended on reads it off that value when it is one:
 *
 * ```ts
 * const result = await run(wb, args, { target: 'transform.ts' });
 * const ended = (result as IWorkbook)?.isIWorkbook ? result as IWorkbook : wb;
 * ```
 *
 * Always a promise, even for a sync entry: resolving a target loads modules.
 *
 * `args` is spelled `ArgV | undefined` rather than `args?` because TypeScript will not let an
 * optional parameter precede a required one — a run with no args passes `undefined` for it.
 */
export type Runner = (
  workbook: IWorkbook | null,
  args: ArgV | undefined,
  options: RunOptions
) => Promise<IWorkbook | any | void>;