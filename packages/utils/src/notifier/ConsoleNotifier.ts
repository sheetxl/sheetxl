import { type INotifier, type NotifierOptions } from './INotifier';

/**
 * Implements INotifier by writing to the console.
 *
 * @remarks
 * The global {@link Notifier} is one. To send its messages somewhere else (a logging service, a
 * CLI's own streams), pass the methods to replace to {@link ConsoleNotifier.setOverrides}; the rest
 * still write to the console.
 */
export class ConsoleNotifier implements INotifier {
  protected _onceMessageKeys = new Set<string>();
  protected _overrides: Partial<INotifier> | null = null;

  /**
   * Replaces some or all of the methods. Pass `null` to write everything to the console again.
   *
   * @param overrides
   */
  setOverrides(overrides: Partial<INotifier> | null) {
    this._overrides = overrides ?? null;
  }

  /**
   * Returns the delegate notifier.
   */
  getOverrides(): Partial<INotifier> | null {
    return this._overrides;
  }

  protected _write(key: keyof INotifier, message: any, options?: NotifierOptions): void {
    if (options?.onceKey) {
      const onceMessageKeys = this._onceMessageKeys;
      if (onceMessageKeys.has(options.onceKey)) return;
      onceMessageKeys.add(options.onceKey);
    }

    const meta = options?.meta;

    const overrides = this._overrides;
    if (overrides) {
      const fn = overrides[key];
      if (fn) {
        fn.bind(overrides)(message, options);
        return;
      }
    }
    if (meta === undefined) {
      console[key](message);
    } else {
      console[key](message, meta);
    }
  }

  /** @inheritdoc INotifier.log */
  log(message: string, options?: NotifierOptions): void {
    return this._write('log', message, options);
  }

  /** @inheritdoc INotifier.error */
  error(error: string | Error, options?: NotifierOptions): void {
    return this._write('error', error, options);
  }

  /** @inheritdoc INotifier.warn */
  warn(message: string, options?: NotifierOptions): void {
    return this._write('warn', message, options);
  }

  /** @inheritdoc INotifier.debug */
  debug(message: string, options?: NotifierOptions): void {
    return this._write('debug', message, options);
  }
}

/**
 * The notifier the SDK reports through: warnings about a file it loaded, errors from a script, and
 * so on. It writes to the console unless overridden.
 */
export const Notifier = new ConsoleNotifier();
