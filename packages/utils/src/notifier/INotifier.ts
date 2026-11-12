
/**
 * Configuration for non-blocking notifications.
 */
// TODO - align to winstonjs. (To enabled winston to back this api.)
// TODO - Add a meta type
export interface NotifierOptions {
  /**
   * Setting this to true will leave the notification on the screen unless it is dismissed (programmatically or through user interaction).
   * If `false` will be removed after a period of time.
   *
   * @defaultValue false
   */
  persist?: boolean;
  /**
   * Ignores displaying notifications the same `message`.
   *
   * @defaultValue false
   */
  preventDuplicate?: boolean;
  /**
   * If provided then then notification provider should not notify if the same id is used again.
   */
  onceKey?: string;
  /**
   * Structured data/context for the log entry.
   * Can contain any application-specific data like validation errors,
   * import warnings, metrics, etc. Maps to Winston's meta parameter.
   */
  // TODO - create a LogMeta that has type + Record
  meta?: {
    type: string;
    [key: string]: any;
  };
}

/**
 * Interface that provides notification.
 */
export interface INotifier {
  /**
   * For trace level logging.
   *
   * @param message The trace message to display.
   * @param options Options for the trace notification.
   */
  // trace(message: string, options?: NotifierOptions): void;

  /**
   * For debug logging.
   *
   * @param message The debug message to display.
   * @param options Options for the debug notification.
   */
  debug(message: string, options?: NotifierOptions): void;

  /**
   * Useful when informing the user of something but are not expecting a response.
   *
   * @param message The log message to display.
   * @param options Options for the log notification.
   */
  log(message: string, options?: NotifierOptions): void;
  /**
   * Should return error object exception.
   *
   * @param message The warning message to display.
   * @param options Options for the warning notification.
   */
  warn(message: string, options?: NotifierOptions): void;
  /**
   * Should return error object exception.
   *
   * @param error The error message or object to display.
   * @param options Options for the error notification.
   */
  error(error: string | Error, options?: NotifierOptions): void;
}

// export interface ILoggerConfig {
//   setLevel(level: LogLevel | keyof typeof LogLevel): void;
//   getLevel(): LogLevel;
//   isLevelEnabled(level: LogLevel): boolean;
// }

export namespace INotifier {
  /**
   * Npm log levels.
   */
  // export const LogLevel = {
  //   Error: 0,
  //   Warn: 1,
  //   Info: 2,
  //   Http: 3,
  //   Verbose: 4,
  //   Debug: 5,
  //   Silly: 6,
  // } as const;
  // export type L = typeof LogLevel[keyof typeof LogLevel];
  // SysLogLevels - https://datatracker.ietf.org/doc/html/rfc5424
}
