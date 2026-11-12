import { type ILogger, type LogLevel } from './ILogger';

/**
 * Renders a value as its markdown report, or returns `null` when the value is not renderable.
 *
 * @remarks
 * Injected by the host rather than imported: the renderer registry lives in `@sheetxl/query`, which
 * depends on the SDK, so neither the SDK nor this package can reach it without a dependency cycle.
 * A host that has it (the CLI, the MCP server) passes `renderMarkdown` straight in - a rejected
 * promise or a throw is treated as "not renderable" and falls back to JSON.
 */
export type LogRenderer = (value: unknown) => string | Promise<string> | null | undefined;

/**
 * The variadic output channels handed to a script or snippet as `log` / `warn` / `error`.
 *
 * @remarks
 * Deliberately NOT an {@link ILogger}: this is the agent-facing surface, so it takes a `console`-style
 * argument list rather than `(message, options)`. Anything an author would reasonably pass renders -
 * strings, values, and SDK objects (a range, a stats report) via the injected {@link LogRenderer}.
 */
export interface LogChannels {
  /** The reporting channel - findings and results. */
  log(...args: any[]): void;
  /** Diagnostics: something surprising but survivable. */
  warn(...args: any[]): void;
  /** Diagnostics: something wrong. */
  error(...args: any[]): void;
  /**
   * Resolves once every queued entry has reached the backing logger.
   *
   * @remarks
   * Rendering an SDK object is async, so a `log(range)` may still be in flight when the script
   * returns. The runtime awaits this before reporting the run, which is what guarantees the log is
   * complete (and correctly ordered) by the time a caller reads it.
   *
   * With `timeoutMs`, a value still unsettled when it elapses prints as `[pending]` and a single
   * `warn` says how many did. Only that value is given up: the rest of its line, and every line
   * queued behind it, is still written in order. Without it (or with `0`), `flush` waits as long
   * as the slowest logged promise - forever for one that never settles.
   */
  flush(options?: { timeoutMs?: number }): Promise<void>;
}

/**
 * How long a finished run waits for what it logged to settle, when nothing configures it.
 *
 * @remarks
 * Generous next to a render or an un-awaited `evaluate`, short next to a tool-call timeout. A host
 * whose scripts log slow promises raises it; `0` removes the bound.
 */
export const DEFAULT_LOG_TIMEOUT_MS = 10_000;

/** The environment variable that sets the log timeout (milliseconds) for a whole session. */
export const LOG_TIMEOUT_ENV = 'SHEETXL_LOG_TIMEOUT';

/**
 * The log timeout in effect, in milliseconds: the first candidate that is a non-negative number,
 * else {@link DEFAULT_LOG_TIMEOUT_MS}.
 *
 * @param candidates In precedence order - narrowest scope first (an option, then the environment,
 * then a stored preference). Strings are accepted, since that is how both of the latter arrive.
 *
 * @remarks
 * An unusable candidate (unset, blank, negative, not a number) falls through to the next rather
 * than throwing: a typo in a shell profile must not stop a run. `0` is a value, not an absence - it
 * means wait indefinitely.
 */
export function resolveLogTimeout(...candidates: unknown[]): number {
  for (const candidate of candidates) {
    const ms = parseLogTimeout(candidate);
    if (ms !== undefined) return ms;
  }
  return DEFAULT_LOG_TIMEOUT_MS;
}

/** One candidate as a log timeout in milliseconds, or `undefined` when it has nothing to say. */
export function parseLogTimeout(candidate: unknown): number | undefined {
  if (typeof candidate === 'string' ? candidate.trim() === '' : typeof candidate !== 'number') {
    return undefined;
  }
  const ms = Number(candidate);
  return Number.isFinite(ms) && ms >= 0 ? ms : undefined;
}

const isPromise = <T = string>(value: unknown): value is Promise<T> =>
  !!value && typeof (value as Promise<T>).then === 'function';

/** Last-resort text for a value no renderer claimed. Compact JSON, never throws. */
const stringify = (value: unknown): string => {
  try {
    const json = JSON.stringify(value);
    if (json !== undefined) return json;
  } catch { /* circular, BigInt, … */ }
  return String(value);
};

/**
 * Builds the `log` / `warn` / `error` channels for a run context.
 *
 * @param logger The backing sink. `ConsoleLogger` writes out; `BufferLogger` collects (the MCP path).
 * @param options.render Optional renderer for SDK objects - see {@link LogRenderer}.
 *
 * @remarks
 * Ordering is preserved across the sync/async mix: an entry that needs no rendering is written
 * immediately *unless* an earlier entry is still rendering, in which case it queues behind it. So a
 * plain `log('done')` stays synchronous (the CLI streams it) and `log(stats)` never arrives late.
 *
 * A promise argument is awaited and logs as the value it settles to, in call order like any other
 * async entry: `log(sheet.evaluate('=SUM(A:A)'))` prints the result. A rejection prints as
 * `[rejected] …` on the same line.
 */
export function createLogChannels(
  logger: ILogger,
  options?: { render?: LogRenderer }
): LogChannels {
  const render = options?.render;

  const format = (value: unknown): string | Promise<string> => {
    if (typeof value === 'string') return value;
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (value instanceof Error) return value.stack ?? value.message;
    // A promise logs as what it settles to, never as the `{}` it serializes to. A rejection is
    // observed here, so it prints on the line rather than surfacing as an unhandled rejection.
    if (isPromise<unknown>(value)) {
      return Promise.resolve(value).then(
        format,
        async (reason) => `[rejected] ${await format(reason)}`
      );
    }
    if (typeof value !== 'object') return String(value);
    if (render) {
      try {
        const rendered = render(value);
        if (isPromise(rendered)) {
          return rendered.then((text) => text ?? stringify(value), () => stringify(value));
        }
        if (typeof rendered === 'string') return rendered;
      } catch { /* not renderable */ }
    }
    return stringify(value);
  };

  const write = (level: LogLevel, text: string): void => {
    // `log` is the reporting channel; `warn`/`error` are diagnostics. `debug`/`info` are not on the
    // script surface - a script that wants them has `log`.
    if (level === 'warn') logger.warn(text);
    else if (level === 'error') logger.error(text);
    else logger.log(text);
  };

  let tail: Promise<void> = Promise.resolve();
  let queued = 0;
  // Resolved by a `flush` whose time is up: every queued entry races its values against it. Renewed
  // after such a flush, so entries logged later get their own wait.
  let giveUp!: () => void;
  let gaveUp!: Promise<void>;
  const renewGiveUp = (): void => {
    gaveUp = new Promise<void>((resolve) => { giveUp = resolve; });
  };
  renewGiveUp();
  let pending = 0;

  const emit = (level: LogLevel, args: any[]): void => {
    const parts = args.map(format);
    if (queued === 0 && !parts.some(isPromise)) {
      write(level, parts.join(' '));
      return;
    }
    // Filled in as each value settles, so an entry that gives up still prints the ones that made it.
    const settled: (string | undefined)[] = parts.map((part, i) => {
      if (!isPromise(part)) return part;
      part.then((text) => { settled[i] = text; }, () => { settled[i] = '[rejected]'; });
      return undefined;
    });
    queued++;
    tail = tail.then(async () => {
      try {
        await Promise.race([Promise.allSettled(parts), gaveUp]);
        write(level, settled.map((text) => {
          if (text !== undefined) return text;
          pending++;
          return '[pending]';
        }).join(' '));
      } catch {
        // A failing sink (or an unrenderable value that slipped through) must not reject the chain:
        // that would drop every later entry and make `flush` throw. Losing one line beats losing
        // the run.
      } finally {
        queued--;
      }
    });
  };

  return {
    log: (...args: any[]) => emit('log', args),
    warn: (...args: any[]) => emit('warn', args),
    error: (...args: any[]) => emit('error', args),
    flush: async (flushOptions?: { timeoutMs?: number }) => {
      const timeoutMs = flushOptions?.timeoutMs;
      let fired = false;
      const timer = queued > 0 && timeoutMs !== undefined && Number.isFinite(timeoutMs) && timeoutMs > 0
        ? setTimeout(() => { fired = true; giveUp(); }, timeoutMs)
        : undefined;
      try {
        // Each awaited tail may itself have queued more (a render that logs) - settle to quiescence.
        while (queued > 0) await tail;
      } finally {
        clearTimeout(timer);
        if (fired) renewGiveUp();
      }
      if (pending > 0) {
        const count = pending;
        pending = 0;
        write('warn',
          `${count} logged ${count === 1 ? 'value' : 'values'} never settled and printed as [pending]: ` +
          `a logged promise has to resolve before the run ends.`
        );
      }
    }
  };
}
