import path from 'node:path';
import fs, { type Stats } from 'node:fs';
import type { REPLServer } from 'node:repl';

import chalk from 'chalk';

import * as SDK from '@sheetxl/sdk';
import { WorkbookIO, type ReadWorkbookOptions, type IOWorkbookDetails, type WriteWorkbookOptions } from '@sheetxl/io';
import type { IWorkbook } from '@sheetxl/sdk';

import { type ArgV } from '../types';

export const readFile = (
  fileName: string,
  options?: Omit<ReadWorkbookOptions, 'source'>,
  onStats?: (stats: Stats) => void
) => {
  const normalized = path.normalize(fileName);
  try {
    fs.accessSync(normalized, fs.constants.F_OK | fs.constants.W_OK);
  } catch (err) {
    process.stdout.write(chalk.redBright(`Unable to read file: '${normalized}' at '${process.cwd()}'\n`));
    return null;
  }
  const contents = fs.readFileSync(normalized);
  const stats = fs.statSync(normalized);
  onStats?.(stats);
  const fileObject = new File([contents], normalized);
  return WorkbookIO.read({
    ...options,
    source: fileObject
  });
};

export const readWorkbook = async (
  fileName: string,
  options?: Omit<ReadWorkbookOptions, 'source'>,
  progress?: SDK.TaskProgress<IOWorkbookDetails>,
  onDetails?: (operation: string, stats: Stats | null) => void
): Promise<IWorkbook> => {
  const normalized = path.normalize(fileName);
  const operationProgress = `read: '${path.join(process.cwd(), normalized)}'`;
  const result = await readFile(fileName, {
    progress,
    ...options
  }, (stats) => {
    onDetails?.(operationProgress, stats);
  });
  return result;
};

export const writeWorkbook = async (
  fileName: string,
  workbook: IWorkbook,
  options?: Omit<WriteWorkbookOptions, 'destination'>,
  progress?: SDK.TaskProgress<IOWorkbookDetails>,
  onDetails?: (operation: string, stats: Stats | null) => void
) => {
  const normalized = path.normalize(fileName);
  const fullPath = path.join(process.cwd(), normalized);
  let stats: Stats;
  try {
    // fs.accessSync(normalized, fs.constants.F_OK | fs.constants.W_OK);
    // stats = fs.statSync(fullPath);
  } catch (err) {
    process.stdout.write(chalk.redBright(`Unable to write file: '${normalized}' at '${process.cwd()}'\n`));
    return null;
  }
  const operationProgress = `write: '${fullPath}'`;
  if (onDetails) {
    onDetails?.(operationProgress, null);
  }
  const result = await WorkbookIO.writeFile(normalized, workbook, {
    progress,
    ...options
  });
  return result;
};


export function parseTailArgs(raw: string[]): { raw: string[]; kv: Record<string, string|boolean>; _: string[] } {
  const kv: Record<string, string|boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    const tok = raw[i];

    if (tok === '--') {                   // hard stop
      positional.push(...raw.slice(i + 1));
      break;
    }

    if (tok.startsWith('--')) {           // --long or --long=val
      const [k, v] = tok.slice(2).split('=', 2);
      if (v !== undefined) kv[k] = v;
      else {
        const nxt = raw[i + 1];
        if (nxt && !nxt.startsWith('-')) { kv[k] = nxt; i++; }
        else kv[k] = true;
      }
      continue;
    }

    // Optional exception: accept -long=val as long
    if (/^-[A-Za-z0-9].*=.+$/.test(tok)) {
      const body = tok.slice(1);
      const eq = body.indexOf('=');
      kv[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }

    if (tok.startsWith('-') && tok.length > 1) {
      // short flag or bundle of shorts
      const body = tok.slice(1);
      if (body.length === 1) {
        const k = body;
        const nxt = raw[i + 1];
        if (nxt && !nxt.startsWith('-')) { kv[k] = nxt; i++; }
        else kv[k] = true;
      } else {
        // bundle: -abc → a:true,b:true,c:true
        for (const ch of body) kv[ch] = true;
      }
      continue;
    }

    // k=v positional convenience
    const eq = tok.indexOf('=');
    if (eq > 0) {
      kv[tok.slice(0, eq)] = tok.slice(eq + 1);
      continue;
    }

    positional.push(tok);
  }

  return { raw, kv, _: positional };
}


export interface ArgHelpers {
  has: (k: string) => boolean;
  str: (k: string, d?: string) => string | undefined;
  num: (k: string, d?: number) => number | undefined;
  bool: (k: string, d?: boolean) => boolean;
}

export function makeArgHelpers(args: ArgV): ArgHelpers {
  const v = (k: string) => args.kv[k];
  return {
    has: k => Object.prototype.hasOwnProperty.call(args.kv, k),
    str: (k, d) => {
      const x = v(k); if (x === undefined) return d;
      return typeof x === 'string' ? x : (x ? 'true' : 'false');
    },
    num: (k, d) => {
      const s = typeof v(k) === 'string' ? (v(k) as string) : undefined;
      if (s === undefined) return d;
      const n = Number(s); return Number.isFinite(n) ? n : d;
    },
    bool: (k, d = false) => {
      const x = v(k); if (x === undefined) return d;
      if (typeof x === 'boolean') return x;
      const s = (x as string).toLowerCase();
      return s === '1' || s === 'true' || s === 'yes' || s === 'y';
    },
  };
}


// Names you should never overwrite
const RESERVED = new Set<string>([
  // repl/vm context & common globals
  'global', 'globalThis', 'console', 'process', 'Buffer', 'URL', 'URLSearchParams',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate',
  // repl injected helpers you might add (tweak as needed)
  'wb', 'io', 'sdk', '_'
]);

type ExposeMode = 'methods' | 'all';

interface ScopeOpts {
  /** Only expose function members (default). Use 'all' to also expose data props via accessors. */
  mode?: ExposeMode;
  /** Prefix to apply on collision or for everything, e.g. 'wb_' */
  prefix?: string | null;
  /** Skip names matching this regex (e.g., /^_/ to hide privates) */
  skip?: RegExp | null;
  /** If true, allow overwriting non-reserved names already in the context */
  overwrite?: boolean;
}

/**
 * Introspect `instance` and expose its API on the REPL context.
 * - Optionally exposes non-function props via accessors.
 */
export function installScopeAuto(
  repl: REPLServer,
  instance: unknown,
  key: string,
  opts: ScopeOpts = {},
) {
  const {
    mode = 'methods',
    prefix = null,
    skip = /^_/,
    overwrite = false,
  } = opts;

  const ctx = repl.context as Record<string, any>;

  // Keep a canonical reference
  Object.defineProperty(ctx, key, { value: instance, configurable: true, enumerable: false });

  // Compute the current set of names in context + globalThis to avoid collisions
  const existing = new Set<string>([
    ...Object.getOwnPropertyNames(ctx),
    ...Object.getOwnPropertyNames(globalThis as any),
  ]);
  for (const k of RESERVED) existing.add(k);

  // Walk the prototype chain up to Object.prototype
  let obj: any = instance;
  const defined = new Set<string>();

  while (obj && obj !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(obj)) {
      if (name === 'constructor') continue;
      if (skip && skip.test(name)) continue;

      const targetName = prefix ? `${prefix}${name}` : name;

      const already = existing.has(targetName) || defined.has(targetName);
      if (already && !overwrite) continue;
      if (RESERVED.has(targetName)) continue;

      const desc = Object.getOwnPropertyDescriptor(obj, name);
      if (!desc) continue;

      // Functions: bind to wb
      if (typeof desc.value === 'function') {
        Object.defineProperty(ctx, targetName, {
          configurable: true,
          enumerable: false,
          value: (desc.value as Function).bind(instance),
        });
        defined.add(targetName);
        continue;
      }

      if (mode === 'all') {
        // Accessors or data props: forward get/set to wb[name]
        Object.defineProperty(ctx, targetName, {
          configurable: true,
          enumerable: false,
          get() {
            try {
              return (instance as any)[name];
            } catch {
              return undefined;
            }
          },
          set(v) {
            try {
              (instance as any)[name] = v;
            } catch { /* ignore */ }
          },
        });
        defined.add(targetName);
      }
    }
    obj = Object.getPrototypeOf(obj);
  }
}
