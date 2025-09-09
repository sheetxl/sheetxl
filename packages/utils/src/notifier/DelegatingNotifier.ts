import { INotifier, NotifierOptions } from './INotifier';

/**
 * Implements both INotifier and TaskProgress by delegating to another instance
 */
export class DelegatingNotifier implements INotifier {
  protected _onceMessageKeys = new Set<string>();
  protected _delegate: Partial<INotifier> | null;

  /**
   * Override the default notifier
   *
   * @param delegate
   */
  setDelegate(delegate: Partial<INotifier> | null) {
    this._delegate = delegate ?? null;
  }

  /**
   * Returns the delegate notifier
   * @returns
   */
  getDelegate(): Partial<INotifier> | null {
    return this._delegate;
  }

  /** @inheritdoc INotifier.log */
  log(message: string, options?: NotifierOptions): void {
    if (options?.onceKey) {
      const onceMessageKeys = this._onceMessageKeys;
      if (onceMessageKeys.has(options.onceKey)) return;
      onceMessageKeys.add(options.onceKey);
    }
    const delegate = this._delegate;
    if (!delegate) return;
    const fn = delegate.log;
    if (!fn) return;
    fn.bind(delegate)(message, options);
  }

  /** @inheritdoc INotifier.error */
  error(error: string | Error, options?: NotifierOptions): void {
    if (options?.onceKey) {
      const onceMessageKeys = this._onceMessageKeys;
      if (onceMessageKeys.has(options.onceKey)) return;
      onceMessageKeys.add(options.onceKey);
    }
    const delegate = this._delegate;
    if (!delegate) return;
    const fn = delegate.error;
    if (!fn) return;
    fn.bind(delegate)(error, options);
  }

  /** @inheritdoc INotifier.warn */
  warn(message: string, options?: NotifierOptions): void {
    if (options?.onceKey) {
      const onceMessageKeys = this._onceMessageKeys;
      if (onceMessageKeys.has(options.onceKey)) return;
      onceMessageKeys.add(options.onceKey);
    }
    const delegate = this._delegate;
    if (!delegate) return;
    const fn = delegate.warn;
    if (!fn) return;
    fn.bind(delegate)(message, options);
  }
}

export const Notifier = new DelegatingNotifier();
