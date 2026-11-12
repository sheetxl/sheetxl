import { describe, it, expect } from 'vitest';

import {
  createLogChannels, resolveLogTimeout, parseLogTimeout, DEFAULT_LOG_TIMEOUT_MS
} from '../../logger/LogChannels';
import type { ILogger } from '../../logger/ILogger';

const collect = (): { lines: string[]; logger: ILogger } => {
  const lines: string[] = [];
  const push = (level: string) => (message: string | Error) => {
    lines.push(`${level}: ${String(message)}`);
  };
  const logger = {
    debug: push('debug'),
    log: push('log'),
    info: push('info'),
    warn: push('warn'),
    error: push('error')
  } as ILogger;
  return { lines, logger };
};

describe('resolveLogTimeout', () => {
  it('takes the first usable candidate, in order', () => {
    expect(resolveLogTimeout(2500, '9000')).toBe(2500);
    expect(resolveLogTimeout(undefined, '9000', 100)).toBe(9000);
    expect(resolveLogTimeout(undefined, undefined, 100)).toBe(100);
  });

  it('keeps 0, which means wait indefinitely', () => {
    expect(resolveLogTimeout('0', 5000)).toBe(0);
    expect(resolveLogTimeout(0)).toBe(0);
  });

  it('falls through anything unusable, down to the default', () => {
    expect(resolveLogTimeout('soon', ' ', -1, NaN, null, true, {}, '750')).toBe(750);
    expect(resolveLogTimeout('soon', -1)).toBe(DEFAULT_LOG_TIMEOUT_MS);
    expect(resolveLogTimeout()).toBe(DEFAULT_LOG_TIMEOUT_MS);
  });

  it('parses one candidate', () => {
    expect(parseLogTimeout(' 1500 ')).toBe(1500);
    expect(parseLogTimeout('1.5e3')).toBe(1500);
    expect(parseLogTimeout('')).toBeUndefined();
    expect(parseLogTimeout(Infinity)).toBeUndefined();
  });
});

describe('createLogChannels', () => {
  it('writes plain values synchronously', () => {
    const { lines, logger } = collect();
    const channels = createLogChannels(logger);
    channels.log('rows:', 3, { a: 1 }, null, undefined);
    expect(lines).toEqual(['log: rows: 3 {"a":1} null undefined']);
  });

  it('logs a promise as the value it resolves to', async () => {
    const { lines, logger } = collect();
    const channels = createLogChannels(logger);
    channels.log('total:', Promise.resolve(42));
    channels.log(Promise.resolve({ a: 1 }));
    expect(lines).toEqual([]);
    await channels.flush();
    expect(lines).toEqual(['log: total: 42', 'log: {"a":1}']);
  });

  it('keeps call order when a later entry is synchronous', async () => {
    const { lines, logger } = collect();
    const channels = createLogChannels(logger);
    let resolve!: (value: string) => void;
    channels.log(new Promise<string>((r) => { resolve = r; }));
    channels.log('after');
    channels.warn('diagnostic');
    resolve('first');
    await channels.flush();
    expect(lines).toEqual(['log: first', 'log: after', 'warn: diagnostic']);
  });

  it('prints a rejection on the line instead of dropping it', async () => {
    const { lines, logger } = collect();
    const channels = createLogChannels(logger);
    channels.log('result:', Promise.reject('no such sheet'));
    channels.log('next');
    await channels.flush();
    expect(lines).toEqual(['log: result: [rejected] no such sheet', 'log: next']);
  });

  it('renders the resolved value, not the promise', async () => {
    const { lines, logger } = collect();
    const seen: unknown[] = [];
    const channels = createLogChannels(logger, {
      render: (value) => {
        seen.push(value);
        return (value as { report?: string }).report ?? null;
      }
    });
    const stats = { report: '## Stats' };
    channels.log(Promise.resolve(stats));
    await channels.flush();
    expect(seen).toEqual([stats]);
    expect(lines).toEqual(['log: ## Stats']);
  });

  it('gives up on a value that never settles, and only on that value', async () => {
    const { lines, logger } = collect();
    const channels = createLogChannels(logger);
    channels.log('stuck:', new Promise(() => {}), 'ok:', Promise.resolve(1));
    channels.log('after');
    await channels.flush({ timeoutMs: 20 });
    expect(lines).toEqual([
      'log: stuck: [pending] ok: 1',
      'log: after',
      'warn: 1 logged value never settled and printed as [pending]: ' +
        'a logged promise has to resolve before the run ends.'
    ]);
  });

  it('does not wait out the timeout when everything settles', async () => {
    const { lines, logger } = collect();
    const channels = createLogChannels(logger);
    channels.log(Promise.resolve('quick'));
    const start = Date.now();
    await channels.flush({ timeoutMs: 5000 });
    expect(Date.now() - start).toBeLessThan(1000);
    expect(lines).toEqual(['log: quick']);
  });

  it('waits again for entries logged after a flush gave up', async () => {
    const { lines, logger } = collect();
    const channels = createLogChannels(logger);
    channels.log(new Promise(() => {}));
    await channels.flush({ timeoutMs: 10 });
    lines.length = 0;
    channels.log(new Promise((resolve) => setTimeout(() => resolve('late'), 20)));
    await channels.flush({ timeoutMs: 2000 });
    expect(lines).toEqual(['log: late']);
  });

  it('treats a timeout of 0 as no bound', async () => {
    const { lines, logger } = collect();
    const channels = createLogChannels(logger);
    channels.log(new Promise((resolve) => setTimeout(() => resolve('slow'), 30)));
    await channels.flush({ timeoutMs: 0 });
    expect(lines).toEqual(['log: slow']);
  });

  it('awaits a promise that resolves to another async render', async () => {
    const { lines, logger } = collect();
    const channels = createLogChannels(logger, {
      render: async () => 'rendered'
    });
    channels.log(Promise.resolve({}));
    await channels.flush();
    expect(lines).toEqual(['log: rendered']);
  });
});
