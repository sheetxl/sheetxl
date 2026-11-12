import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { type IWorkbook } from '@sheetxl/sdk';

import { type ILogger, type LogChannels, createLogChannels, resolveLogTimeout } from '@sheetxl/utils';

import {
  type ArgV, type Runner, type RunContext, type RunOptions, type RunTarget, type RunFunction
} from './Types';

/** tiny helper: treat string/URL as path URL */
function toFileUrl(input: string | URL): string {
  return typeof input === 'string'
    ? (input.startsWith('file:') ? input : pathToFileURL(path.resolve(process.cwd(), input)).href)
    : input.href;
}

/** Optional: wrap a promise with a timeout */
async function withTimeout<T>(p: Promise<T>, ms?: number, onTimeoutMsg = 'Runner timed out'): Promise<T> {
  if (!ms || ms <= 0) return p;
  let t: NodeJS.Timeout;
  const timeout = new Promise<never>((_, rej) => (t = setTimeout(() => rej(new Error(onTimeoutMsg)), ms)));
  try { return await Promise.race([p, timeout]); }
  finally { clearTimeout(t!); }
}

/**
 * Register tsx ONCE, for the lifetime of the process. Deliberately never unregistered.
 *
 * TS support has to outlive module *loading*. TS sources defer work to runtime dynamic
 * imports — `@sheetxl/sdk` lazy-loads its FormulaCompiler from `Calculation.start()`, and
 * `@sheetxl/io-xlsx` lazy-loads its XLSXWriter when a workbook is written, which a host may
 * do well after `run()` has returned. Releasing the registration leaves those extensionless
 * TS specifiers to Node's own resolver, which fails with ERR_MODULE_NOT_FOUND.
 *
 * Unregistering is also actively unsafe: Node cannot truly remove module hooks, so tsx's
 * `unregister` only makes its hook inert. If the host process was already running under tsx
 * (`tsx script.ts`), our unregister would neutralize THAT registration too and break TS
 * resolution for code we do not own. Since the hook cannot be removed, holding it is both
 * the safe and the honest option. This is why failures surface with tsx frames still on the
 * stack even though tsx is no longer resolving anything.
 */
let _tsxRegistered: Promise<void> | null = null;

function ensureTsx(): Promise<void> {
  if (!_tsxRegistered) {
    _tsxRegistered = (async () => {
      const { register } = await import('tsx/esm/api');
      // `tsconfig: false` — user scripts load hermetically, ignoring whatever tsconfig.json
      // happens to sit above the cwd. Without this, tsx applies that tsconfig's `paths` to the
      // script's imports; in the monorepo, `packages/cli/tsconfig.json` maps `@sheetxl/sdk` to
      // `../sdk/src`, so scripts loaded SDK *source*, which imports the vite-only
      // `virtual:sheetxl/bundled-locale` module and dies with ERR_UNSUPPORTED_ESM_URL_SCHEME.
      // Scripts must see packages the way an installed client does: via package exports → built
      // output. (That tsconfig deliberately excludes `examples/` for the same reason.)
      register({ tsconfig: false });
    })();
  }
  return _tsxRegistered;
}

/**
 * Inline `{ code }` targets load through `data:text/*,...` URLs. Two things Node will not do
 * for those on its own:
 *  - `data:text/typescript` is an unknown mime to the default loader, and tsx's sync-hook path
 *    (Node >= 22.15) delegates data: URLs instead of claiming them, so the import dies with
 *    'Expected a string to be returned for the "format" from the "load" hook but got null'.
 *    The load hook claims the runner's own inline URLs and transpiles with node:module's
 *    `stripTypeScriptTypes` (sync, dependency-free; emits Node's experimental warning once).
 *  - a data: URL has no directory, so bare specifiers inside inline code
 *    (`import { Workbook } from '@sheetxl/sdk'`) have nowhere to resolve from. The resolve
 *    hook re-parents inline-code imports onto the cwd, so they resolve exactly as they would
 *    from a script file sitting in the cwd.
 * Ordering with tsx is not load-bearing: registered after tsx these run first and short-circuit;
 * registered before, tsx delegates data: URLs down to them. Like tsx, registered once for the
 * process lifetime and never unregistered.
 */
const INLINE_TS_PREFIX = 'data:text/typescript,';
const INLINE_JS_PREFIX = 'data:text/javascript,';

let _inlineHooksRegistered: Promise<void> | null = null;

function ensureInlineHooks(): Promise<void> {
  if (!_inlineHooksRegistered) {
    _inlineHooksRegistered = (async () => {
      const { registerHooks, stripTypeScriptTypes } = await import('node:module');
      // @types/node (26.x) types only `mode: 'strip'`; Node itself accepts 'transform'
      // (enum/namespace lowering) since v22.13 — widen until DefinitelyTyped catches up.
      const stripTs = stripTypeScriptTypes as
        (code: string, options?: { mode?: 'strip' | 'transform'; sourceUrl?: string }) => string;
      registerHooks({
        resolve(specifier, context, nextResolve) {
          const parent = context.parentURL;
          if (parent && (parent.startsWith(INLINE_TS_PREFIX) || parent.startsWith(INLINE_JS_PREFIX))) {
            const cwdParent = pathToFileURL(path.join(process.cwd(), '_inline_.ts')).href;
            return nextResolve(specifier, { ...context, parentURL: cwdParent });
          }
          return nextResolve(specifier, context);
        },
        load(url, context, nextLoad) {
          if (url.startsWith(INLINE_TS_PREFIX)) {
            const code = decodeURIComponent(url.slice(INLINE_TS_PREFIX.length));
            // stripTypeScriptTypes emits a one-time ExperimentalWarning synchronously on
            // first call; silence emitWarning for just that call window.
            const emitWarning = process.emitWarning;
            process.emitWarning = () => {};
            let source: string;
            try {
              source = stripTs(code, { mode: 'transform' });
            } finally {
              process.emitWarning = emitWarning;
            }
            return { format: 'module', source, shortCircuit: true };
          }
          return nextLoad(url, context);
        },
      });
    })();
  }
  return _inlineHooksRegistered;
}

/** Load a TS/JS module, handling .ts via tsx register() */
async function importModule(moduleRef: string | URL): Promise<any> {
  const href = toFileUrl(moduleRef);
  const ext = path.extname(new URL(href).pathname).toLowerCase();

  if (ext === '.ts' || ext === '.tsx') {
    await ensureTsx();
  }
  return import(href);
}

/**
 * Build a RunContext from options (auto-inject sdk/io/notifier if missing).
 *
 * @remarks
 * Returns the channels alongside the context so the caller can `flush()` them: rendering a logged
 * SDK object is async, and the run is not complete until its output has landed.
 */
async function buildContext(
  workbook: IWorkbook | null,
  args: ArgV | undefined,
  opts: RunOptions
): Promise<{ ctx: RunContext; channels: LogChannels; notifier: NonNullable<RunOptions['notifier']> }> {
  const notifier = opts.notifier ?? (await import('@sheetxl/sdk')).Notifier;

  // The notifier is the sink; the channels are the variadic, value-rendering surface over it.
  // `INotifier` is UI-shaped (toasts, dedup keys) and has no `info` level, so it is adapted rather
  // than cast — `info` folds into `log`, which is where a run's reporting belongs anyway.
  const sink: ILogger = {
    debug: (message: string) => notifier.debug(message),
    log: (message: string) => notifier.log(message),
    info: (message: string) => notifier.log(message),
    warn: (message: string) => notifier.warn(message),
    error: (message: string | Error) => notifier.error(message)
  };
  const channels = createLogChannels(sink, { render: opts.render });

  const ctx: RunContext = {
    args: args ?? { raw: [], kv: {}, _: [] },
    wb: workbook,
    log: channels.log,
    warn: channels.warn,
    error: channels.error,
  };
  return { ctx, channels, notifier };
}

const resolveRunFunction = async (
  target: RunTarget,
  options: Pick<RunOptions, 'cwd'> = {}
): Promise<RunFunction> => {
  let resolved: RunFunction | null = null;

  /**
   * The loaded module's entry — its default export.
   *
   * @remarks
   * A `.ts` file whose nearest `package.json` does not say `"type": "module"` (anything outside a
   * module package — a scratch script in a temp dir, say) loads as CommonJS, and the ESM interop
   * then presents the real entry as `default.default`. Unwrapping that here is what lets the same
   * script run from inside the repo and from anywhere else.
   */
  const findFn = (loaded: any, label: string): RunFunction => {
    let entry = loaded?.default;
    if (entry && typeof entry !== 'function' && typeof entry.default === 'function') {
      entry = entry.default;
    }
    if (typeof entry !== 'function') {
      throw new Error(
        `Script '${label}' has no runnable entry: export a default function, ` +
        `e.g. \`export default function main(ctx) { … }\`.`
      );
    }
    return entry;
  }

  // Resolve the runnable
  if (typeof target === 'function') { // // disallow?
    resolved = target;                   // function(ctx)
  } else if (typeof target === 'string' || target instanceof URL) {
    // path or URL
    // Guard: existence for local paths (best-effort)
    let loaded: any = null;
    if (typeof target === 'string' && !/^[a-z]+:\/\//i.test(target)) {
      const abs = path.resolve(options.cwd ?? process.cwd(), target);
      if (!fs.existsSync(abs)) throw new Error(`Script not found: ${abs}`);
      fs.accessSync(abs, fs.constants.R_OK);
      loaded = await importModule(abs);
    } else {
      loaded = await importModule(target);
    }
    resolved = findFn(loaded, String(target));
  } else if ('code' in target) {
    // inline code → compile via data URL
    const filename = target.filename ?? 'inline.ts';
    const isTs = filename.endsWith('.ts') || filename.endsWith('.tsx');
    let href: string;
    let loaded: any = null;
    if (isTs) {
      // tsx still registers here for the module graph BELOW the inline code: an inline
      // `import './helper.ts'` (re-parented onto the cwd) is a file: URL that tsx compiles.
      await ensureTsx();
      await ensureInlineHooks();
      href = `${INLINE_TS_PREFIX}${encodeURIComponent(target.code)}`;
      loaded = await import(href);
    } else {
      await ensureInlineHooks();
      href = `${INLINE_JS_PREFIX}${encodeURIComponent(target.code)}`;
      loaded = await import(href);
    }
    resolved = findFn(loaded, filename);
  } else if ('runner' in target) {
    resolved = target.runner;
  } else {
    throw new Error('Invalid run target specified.');
  }

  return resolved;
}

/** Core: run targets as a serial pipeline, each receiving the current workbook.
 *
 * Pipeline semantics:
 * - Targets run **serially** in order, never in parallel.
 * - Each target receives a fresh `RunContext` built with the **current** workbook.
 * - If a target returns an `IWorkbook`, that becomes the workbook for all subsequent targets.
 * - `args` are shared across all targets — they represent pipeline-level configuration,
 *   not per-step input.  This follows the standard Unix convention where environment
 *   variables / flags are visible to every process in a pipeline.
 * - Returns the last target's return value, exactly as it came back.
 */
const runPipeline: Runner = async (
  workbook: IWorkbook | null,
  args: ArgV | undefined,
  options: RunOptions
): Promise<IWorkbook | any | void> => {
  const target = options.target;
  const targets: RunTarget[] = Array.isArray(target) ? target : [target];

  // Resolve all module imports in parallel upfront — fail fast before any script runs.
  const resolvedFns = await Promise.all(targets.map(t => resolveRunFunction(t, options)));

  const tStartAll = Date.now();
  let current: IWorkbook | null = workbook;
  // The pipeline's answer: the LAST stage's, whatever it returned — reassigned every stage, so a
  // final stage that returns nothing ends the run silent even after an earlier one answered.
  let lastResult: any = undefined;
  // Kept from the last stage so the pipeline summary can reach the sink without building a whole
  // second context (workbook, channels and all) purely to log one line.
  let lastNotifier: NonNullable<RunOptions['notifier']> | null = null;
  const resolvedFnsLength = resolvedFns.length;
  for (let i=0; i<resolvedFnsLength; i++) {
    const fn = resolvedFns[i];
    // Build a fresh context for each stage with the current workbook.
    const { ctx, channels, notifier } = await buildContext(current, args, options);
    lastNotifier = notifier;
    const tStart = Date.now();
    let result: any;
    // A stage is ONE operation on the workbook it was handed, as a macro run is (the SDK's
    // `IScript.run` batches the same way): one undo step, one round of events, and a stage that
    // throws leaves nothing behind. It is also what keeps a script that writes a cell per call
    // linear — inside a batch the writes share the maps the first of them cloned; each on its own
    // commit copies every formula on the sheet.
    // The script works through the batch's own workbook, so what it reaches is part of the stage.
    const stageWorkbook = current;
    const invoke = (stageCtx: RunContext): Promise<any> => Promise.resolve().then(() => fn(stageCtx));
    try {
      result = await withTimeout(
        stageWorkbook !== null
          ? Promise.resolve(stageWorkbook.doBatch((_commit, wb) => invoke({ ...ctx, wb }), 'Run Script'))
          : invoke(ctx),
        options.timeoutMs,
        'Runner timed out'
      );
    } finally {
      // Even a failed stage's logs are the diagnostic — settle them before the error propagates.
      // Bounded: a logged promise that never settles would otherwise hold the run open for good on
      // a host with a live event loop (the MCP server), and drop every line queued behind it.
      await channels.flush({ timeoutMs: resolveLogTimeout(options.logTimeoutMs) });
    }
    const tEnd = Date.now();

    lastResult = result;
    // The ONE inspection of a return value, and only to thread the next stage's workbook — the
    // value itself is handed back untouched, an array as an array. A workbook is structural as
    // well as an answer, so reading it here does not consume it: the caller still receives it,
    // and renders it exactly as it renders a snippet that ended in `wb`.
    if (result != null && (result as IWorkbook).isIWorkbook) {
      current = result as IWorkbook;
    }

    // `debug`, not `log`. A host renders a run as logs-then-payload (the CLI prints the run's
    // result only after `run()` returns), so anything emitted here lands BETWEEN a
    // script's own output and the answer it produced — a divider mid-payload for anyone parsing
    // the stream. The number rarely earns that: the durations worth reading belong to the
    // expensive step and are already carried inline by the operation that spent them
    // (`read … in 49ms`), which leaves this line reporting `0 ms` for a typical script.
    notifier.debug(
      `Run ${resolvedFnsLength === 1 ? '' : `${i + 1}/${resolvedFnsLength} `}completed in ${tEnd - tStart} ms.`
    );
  }

  if (resolvedFnsLength > 1 && lastNotifier) {
    const tEndAll = Date.now();
    lastNotifier.debug(`All runs completed in ${tEndAll - tStartAll} ms.`);
  }

  return lastResult;
}

/**
 * Runs the pipeline with the `SheetXL` global installed.
 *
 * @remarks
 * The declarations a script is written against promise `SheetXL.ISheet.Visibility.Hidden` is a
 * VALUE. A compiled macro gets it from the macro runtime; source run here is type-stripped and
 * imported, so nothing would define it. The install spans module LOADING too, not only the call —
 * a script may read an enum at its top level — and is removed however the run ends.
 */
export const run: Runner = async (
  workbook: IWorkbook | null,
  args: ArgV | undefined,
  options: RunOptions
): Promise<IWorkbook | any | void> => {
  const { withScriptRuntime } = await import('@sheetxl/sdk');
  return withScriptRuntime(() => runPipeline(workbook, args, options));
};

export default {
  run
};