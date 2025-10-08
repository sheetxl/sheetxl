
/**
 * Configuration for non-blocking notifications.
 */
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
   * Details about the notification.
   */
  details?: any;
}

/**
 * Interface that provides notification.
 */
export interface INotifier {

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
   * @param error The error message or object to display.
   * @param options Options for the error notification.
   */
  error(error: string | Error, options?: NotifierOptions): void;

  /**
   * Should return error object exception.
   *
   * @param message The warning message to display.
   * @param options Options for the warning notification.
   */
  warn(message: string, options?: NotifierOptions): void;

  /**
   * For debug logging.
   *
   * @param message The debug message to display.
   * @param options Options for the debug notification.
   */
  debug(message: string, options?: NotifierOptions): void;
}

