import React, { createContext, useContext, type ReactNode } from 'react';

import { DelegatingNotifier, NotifierOptions, INotifier, Notifier } from "@sheetxl/utils";

/**
 * Indicates the type of notification.
 */
export const NotifierType = {
  Default: 'default', // not needed
  Error: 'error',
  Success: 'success',
  Warning: 'warning',
  Info: 'info'
} as const;
export type NotifierType = typeof NotifierType[keyof typeof NotifierType];

/**
 * Configuration for non-blocking notifications.
 */
// Move to Common? INotification
export interface EnqueueNotifierOptions extends NotifierOptions {
  /**
   * A hint for decorations of the message.
   */
  type?: NotifierType;

  /**
   * Passed directly to the Snackbar component.
   */
  enqueueProps?: Record<string, any>;
}

/**
 * Configuration for an options dialog.
 */
export interface OptionsNotifierOptions extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The options as a list of strings
   */
  options?: string[];
  /**
   * The title of the options panel
   */
  title?: string;
  /**
   * Display text information for the user to make a decision.
   */
  description?: string;
  /**
   * Display an icon next to the description for additional context
   *
   * @remarks
   * Not yet implemented
   */
  icon?: React.ReactNode;
  /**
   * Allows for the option will be the default selected option and the enter key trigger.
   * @defaultValue The first option
   */
  defaultOption?: string;
  /**
   * Allows for the cancel option to be specified. Allow for special styling.
   * @defaultValue 'Cancel'
   */
  cancelOption?: string;
  /**
   * Call when an option is selected.
   * @remarks
   * It is possible that the option can be both a cancel and a default option.
   */
  onOption?: (option: string, isCancel: boolean, isDefault: boolean) => void;
  /**
   * Hook for create custom options buttons
   * @param props
   *
   * @remarks
   * The option is passed as the `children` prop and as the second argument
   */
  createOptionsButton?: (option: string, props: React.HTMLAttributes<HTMLButtonElement> & React.Attributes, isDefaultOption: boolean) => React.ReactNode;
  /**
   * Call when an option is selected. If false is returned, the the
   * dialog will not close. INotifier is not provided but can
   * be supplied via the textFieldProps helperText property.
   */
  onValidateOption?: (option?: string) => boolean | Promise<boolean>;
};

export interface InputValidationResults {
  valid: boolean;
  message?: string;
}
export interface InputResults {
  input: string;
  option: string;
}
export interface InputOptionsNotifierOptions extends OptionsNotifierOptions {

  initialValue?: string;

  /**
   * Css style for input
   */
  inputProps?:  React.HTMLAttributes<HTMLInputElement | HTMLTextAreaElement>;

  inputLabel?:  string;

  inputType?: 'text' | 'password' | 'email' | 'number' | 'search' | 'tel' | 'url';

  inputPlaceHolder?: string;
  // Accommodate arbitrary additional props coming from the `inputProps` prop
//   [arbitrary: string]: any;
// }

  onInputOption?: (input?: string, option?: string) => void;

  /**
   * Call when an option is selected. If false is returned, the the
   * dialog will not close. INotifier is not provided but can
   * be supplied via the textFieldProps helperText property.
   * @remarks
   * Optional the textProps can be updated via the textFieldProps argument
   */
  onValidateInputOption?: (input?: string, option?: string) => InputValidationResults | Promise<InputValidationResults>;
}

export interface BusyNotifierOptions {
  // TODO - when this is supported we will need to allow for multiple on cancels
  // onCancel?: () => void;

  icon?: React.ReactNode;
}

/**
 * Interface that provides popups for the user.
 */
export interface IReactNotifier extends INotifier {
  /**
   * Useful when informing the user of something but are not expecting a response.
   */
  showMessage: (message: string | React.ReactNode, options?: EnqueueNotifierOptions) => void;
  /**
   * Useful when performing a long running operation and you want to inform the user.
   *
   * A return type of a handler will be returned to allow for hideBusy.
   * If multiple calls are made the consumer should continue to indicated blocked
   * until all calls have been hideBusy.
   */
  showBusy: (message: string | React.ReactNode, options?: BusyNotifierOptions) => (Promise<() => void>) | (() => void);
  /**
   * Show a dialog for a given type.
   *
   * @param type
   * @param props
   * @param options
   */
  // TODO - type this
  showWindow: (type: string, props?: any, options?: { disableAutoDestroy?: boolean }) => Promise<HTMLElement>;
  /**
   * Should return error object exception.
   *
   * @param error
   */
  showError: (error: Error | string) => void;
  /**
   * Provide a user with a list of options to choose from.
   * @param options
   */
  showOptions: (options: OptionsNotifierOptions) => Promise<string>;
  /**
   * Provider a user with a way to enter a text input.
   * @param options
   */
  showInputOptions: (options: InputOptionsNotifierOptions) => Promise<InputResults>;

  // TODO - add an onProgress handler
  // TODO - add an onBackgroundOperation handler
}

export class DelegatingReactNotifier extends DelegatingNotifier implements IReactNotifier {
  setDelegate(delegate: Partial<IReactNotifier> | null) {
    super.setDelegate(delegate);
  }
  getDelegate(): Partial<IReactNotifier> | null {
    return this._delegate;
  }

  /** @inheritdoc IReactNotifier.showMessage */
  showMessage(message: string | React.ReactNode, options?: EnqueueNotifierOptions): void {
    const delegate = this.getDelegate();
    if (delegate?.showMessage) {
      return delegate.showMessage(message, options);
    }
    if (options?.type === NotifierType.Warning) {
      Notifier.warn(message as string);
      return;
    }
    if (options?.type === NotifierType.Error) {
      Notifier.error(message as string);
      return;
    }
    Notifier.log(message as string);
  }

  /** @inheritdoc IReactNotifier.showBusy */
  showBusy(message: string | React.ReactNode, options?: BusyNotifierOptions): (Promise<() => void>) | (() => void) {
    const delegate = this.getDelegate();
    if (delegate?.showBusy) {
      return delegate.showBusy(message, options);
    }
    return new Promise((resolve) => { resolve (() => {}); });
  }

  /** @inheritdoc IReactNotifier.showWindow */
  showWindow(type: string, props?: any, options?: { disableAutoDestroy?: boolean }): Promise<HTMLElement> {
    const delegate = this.getDelegate();
    if (delegate?.showWindow) {
      return delegate.showWindow(type, props, options);
    }
    // return Promise.resolve(document.createElement('div'));
  }

  /** @inheritdoc IReactNotifier.showError */
  showError(error: any): void {
    const delegate = this.getDelegate();
    if (delegate?.showError) {
      delegate.showError(error);
      return;
    }
    Notifier.error(error);
  }

  /** @inheritdoc IReactNotifier.showOptions */
  showOptions(options: OptionsNotifierOptions): Promise<string> {
    const delegate = this.getDelegate();
    if (delegate?.showOptions) {
      return delegate.showOptions(options);
    }
    return Promise.resolve('');
  }

  /** @inheritdoc IReactNotifier.showInputOptions */
  showInputOptions(options: InputOptionsNotifierOptions): Promise<InputResults> {
    const delegate = this.getDelegate();
    if (delegate?.showInputOptions) {
      return delegate.showInputOptions(options);
    }
    return Promise.resolve({ input: '', option: '' });
  }
}

// Create a singleton instance of ReactNotifier
const ReactNotifier = new DelegatingReactNotifier();

// Create the context with the default ReactNotifier instance
const NotifierContext = createContext<IReactNotifier>(ReactNotifier);

/**
 * Context provider for notifications. Allows custom notification implementations
 * to be provided to components within the provider tree.
 *
 * @example
 * ```tsx
 * const customNotifier = {
 *   showMessage: (message) => toast(message),
 *   showError: (error) => toast.error(error),
 *   // ... other methods
 * };
 *
 * <NotifierProvider notifier={customNotifier}>
 *   <App />
 * </NotifierProvider>
 * ```
 */
export interface NotifierProviderProps {
  children: ReactNode;
  notifier: IReactNotifier;
}

export const NotifierProvider: React.FC<NotifierProviderProps> = ({ children, notifier }) => {
  // Set the singleton delegate when this provider mounts or when notifier changes
  React.useEffect(() => {
    const restore = Notifier.getDelegate();
    Notifier.setDelegate(notifier);
    return () => {
      Notifier.setDelegate(restore);
    };
  }, [notifier]);

  return React.createElement(
    NotifierContext.Provider,
    { value: notifier },
    children
  );
};

/**
 * Hook to access the notification system. Uses the notifier from the nearest
 * NotifierProvider, or falls back to the default ReactNotifier singleton if
 * no provider is found.
 *
 * @returns The notification interface
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const notifier = useNotifier();
 *
 *   const handleClick = () => {
 *     notifier.showMessage('Hello World!', { type: NotifierType.Success });
 *   };
 *
 *   return <button onClick={handleClick}>Show INotifier</button>;
 * }
 * ```
 */
export const useNotifier = (): IReactNotifier => {
  return useContext(NotifierContext);
};