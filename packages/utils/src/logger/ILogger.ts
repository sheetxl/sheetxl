/**
 * Severity levels for a {@link ILogger} entry. Aligned with the common npm/winston names.
 */
export type LogLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

/**
 * A single recorded log entry (used by collecting loggers such as `BufferLogger`).
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  /** Optional structured data attached to the entry. */
  data?: unknown;
  /** Epoch millis when the entry was recorded. */
  time: number;
}

/**
 * Options for a single log call.
 */
export interface LogOptions {
  /** Structured data attached to the entry. */
  data?: unknown;
  /**
   * Deduplication key. The logger emits at most once per distinct key - e.g. an import that finds
   * many invalid colors can `warn(..., { once: 'invalid-color' })` to surface a single message.
   */
  once?: string;
}

/**
 * A minimal logger for script/macro/runner execution.
 *
 * This is deliberately separate from the UI-oriented `INotifier` (toasts, persistence): it is just
 * an output channel. The default backing logs to the console; a host (e.g. the MCP server) can
 * supply a collecting backing (`BufferLogger`) and return the captured output as a payload.
 */
export interface ILogger {
  debug(message: string, options?: LogOptions): void;
  log(message: string, options?: LogOptions): void;
  info(message: string, options?: LogOptions): void;
  warn(message: string, options?: LogOptions): void;
  error(message: string | Error, options?: LogOptions): void;
}
