import { INotifier, NotifierOptions } from './INotifier';

/**
 * Implements INotifier by using console.
 *
 * @remarks
 * Overrides can be provided by setting a setOverrides .
 */
export class DefaultNotifier implements INotifier {
  protected _onceMessageKeys = new Set<string>();
  protected _overrides: Partial<INotifier> | null;

  /**
   * Override the default notifier.
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

    const details = options?.details;

    const overrides = this._overrides;
    if (overrides) {
      const fn = overrides[key];
      if (fn) {
        fn.bind(overrides)(message, options);
        return;
      }
    }
    if (details === undefined) {
      console[key](message);
    } else {
      console[key](message, details);
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

export const Notifier = new DefaultNotifier();
