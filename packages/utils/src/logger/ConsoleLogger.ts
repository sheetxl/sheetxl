import { type ILogger, type LogLevel, type LogOptions } from './ILogger';

/**
 * Default {@link ILogger} backing - writes to the console. Honors the `once` dedup key.
 */
export class ConsoleLogger implements ILogger {
  private readonly _seen = new Set<string>();

  private _emit(
    level: LogLevel,
    message: string,
    options: LogOptions | undefined,
    sink: (...args: any[]) => void
  ): void {
    if (options?.once) {
      if (this._seen.has(options.once)) return;
      this._seen.add(options.once);
    }
    if (options?.data !== undefined) {
      sink(message, options.data);
    } else {
      sink(message);
    }
  }

  debug(message: string, options?: LogOptions): void {
    this._emit('debug', message, options, console.debug);
  }
  log(message: string, options?: LogOptions): void {
    this._emit('log', message, options, console.log);
  }
  info(message: string, options?: LogOptions): void {
    this._emit('info', message, options, console.info);
  }
  warn(message: string, options?: LogOptions): void {
    this._emit('warn', message, options, console.warn);
  }
  error(message: string | Error, options?: LogOptions): void {
    const text = message instanceof Error ? (message.stack ?? message.message) : message;
    this._emit('error', text, options, console.error);
  }
}
