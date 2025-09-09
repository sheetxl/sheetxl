
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
}

/**
 * Interface that provides notification.
 */
export interface INotifier {

  /**
   * Useful when informing the user of something but are not expecting a response.
   */
  log(message: string, options?: NotifierOptions): void;

  /**
   * Should return error object exception.
   *
   * @param error
   */
  error(error: string | Error, options?: NotifierOptions): void;

  /**
   * Should return error object exception.
   *
   * @param error
   */
  warn(message: string, options?: NotifierOptions): void;
  // TODO - add an onProgress handler
  // TODO - add an onBackgroundOperation handler
}

