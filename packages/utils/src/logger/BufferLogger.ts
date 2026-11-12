import { type ILogger, type LogEntry, type LogLevel, type LogOptions } from './ILogger';

/**
 * Collecting {@link ILogger} backing - records entries in memory instead of writing them out.
 *
 * A host (e.g. the MCP server running a macro in scratch mode) installs this, runs the script, then
 * returns {@link toString} (or {@link getEntries}) as the captured output payload.
 */
export class BufferLogger implements ILogger {
  private readonly _entries: LogEntry[] = [];
  private readonly _seen = new Set<string>();

  private _add(level: LogLevel, message: string, options?: LogOptions): void {
    if (options?.once) {
      if (this._seen.has(options.once)) return;
      this._seen.add(options.once);
    }
    this._entries.push({ level, message, data: options?.data, time: Date.now() });
  }

  debug(message: string, options?: LogOptions): void { this._add('debug', message, options); }
  log(message: string, options?: LogOptions): void { this._add('log', message, options); }
  info(message: string, options?: LogOptions): void { this._add('info', message, options); }
  warn(message: string, options?: LogOptions): void { this._add('warn', message, options); }
  error(message: string | Error, options?: LogOptions): void {
    const text = message instanceof Error ? (message.stack ?? message.message) : message;
    this._add('error', text, options);
  }

  /** The recorded entries, in order. */
  getEntries(): readonly LogEntry[] {
    return this._entries;
  }

  /** Clears all recorded entries and dedup state. */
  clear(): void {
    this._entries.length = 0;
    this._seen.clear();
  }

  /** A flat, human-readable dump of all entries - suitable as a tool-call payload. */
  toString(): string {
    return this._entries
      .map((e) => {
        let line = `[${e.level}] ${e.message}`;
        if (e.data !== undefined) {
          let data: string;
          try {
            data = typeof e.data === 'string' ? e.data : JSON.stringify(e.data);
          } catch {
            data = String(e.data);
          }
          line += ` ${data}`;
        }
        return line;
      })
      .join('\n');
  }
}
