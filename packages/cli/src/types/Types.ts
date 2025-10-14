export type ModuleSDK = typeof import('@sheetxl/sdk');
export type ModuleIO = typeof import('@sheetxl/io');
export type Notifier = typeof import('@sheetxl/sdk').Notifier;
import { type IWorkbook } from '@sheetxl/sdk';

/**
 * Arguments passed to `sheetxl run <script> [args...]`.
 *
 * Parsing rules:
 * - Long flags: `--key=value` or `--key value`
 * - Short flags: `-k value` or `-v`
 * - Positionals: tokens not starting with `-` (appear in `_.`)
 * - Optional: we also accept `-long=value` as a long flag.
 * - Repeated flags: last one wins (no arrays).
 * - Types: values are strings or booleans; scripts can coerce as needed.
 */
export type ArgV = {
  /** Tail as typed by the user (everything after <script>). */
  raw: string[];
  /** Parsed flags (long/short) with string or boolean values. */
  kv: Record<string, string | boolean>;
  /** Positional args (order preserved). */
  _: string[];
};


export type Context = {
  /**
   * SDK module
   */
  sdk: ModuleSDK;
  /**
   * IO module
   */
  io: ModuleIO;
  /**
   * Notifier for logging and errors
   */
  notifier: Notifier;
  /**
   * All tail args after the script
   */
  args: ArgV;
  /**
   * If a workbook context was provided, it will be here.
   */
  workbook: IWorkbook | null;
}
