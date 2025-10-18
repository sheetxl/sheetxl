import React, { createContext, useContext, type ReactNode } from 'react';

import { DefaultNotifier, NotifierOptions, INotifier, Notifier } from "@sheetxl/utils";

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
export interface ShowOptionsOptions<T=any, C=any> extends ShowWindowOptions<T, C> {
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
  icon?: React.ReactNode | string;
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
  // TODO - make this a regular render.
  createOptionsButton?: (option: string, props: React.HTMLAttributes<HTMLButtonElement> & React.Attributes, isDefaultOption: boolean) => React.ReactNode;
  /**
   * Call when an option is selected. If false is returned, the the
   * dialog will not close. INotifier is not provided but can
   * be supplied via the textFieldProps helperText property.
   */
  onValidateOption?: (option?: string) => boolean | Promise<boolean>;
};


export interface FocusWindowOptions extends FocusOptions {
  /**
   * Allows for a specific component to be selected.
   *
   * @remarks
   * If a string is provided this will be used as a querySelector to find the initial focusable component.
   */
  selection?: string;
}

export interface ShowWindowOptions<T=any, C=any> {
  /**
   * A value the window can use to display.
   */
  initialValue?: T;

  context?: () => C;

  /**
   * Query selector for the element to focus on show.
   */
  autoFocus?: boolean | string | FocusWindowOptions;

  /**
   * Allow for tracking of key down events.
   *
   * @param e
   * @returns
   */
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /**
   * If true show a backdrop.
   *
   * @remarks
   * Our movable menu achieves modality without a background by listens to global clicks (and focus)
   * @defaultValue false
   */
  isModal?: boolean;

  /**
   * If true the window will not be automatically destroyed when closed.
   */
  disableAutoDestroy?: boolean
}

export interface InputValidationResults {
  valid: boolean;
  message?: string;
}
export interface InputResults {
  input: string;
  option: string;
}
export interface ShowInputOptions<T=string, C=any> extends ShowOptionsOptions<T, C> {

  /**
   * Css style for input
   */
  propsInput?:  React.HTMLAttributes<HTMLInputElement | HTMLTextAreaElement>;

  inputLabel?:  string;

  inputType?: 'text' | 'password' | 'email' | 'number' | 'search' | 'tel' | 'url';

  inputPlaceHolder?: string;

  onInput?: (input?: T, option?: string) => void | Promise<void>;

  /**
   * Call when an option is selected. If false is returned, the the
   * dialog will not close. INotifier is not provided but can
   * be supplied via the textFieldProps helperText property.
   * @remarks
   * Optional the textProps can be updated via the textFieldProps argument
   */
  onValidateInput?: (input?: T, option?: string) => InputValidationResults | Promise<InputValidationResults>;
}

export interface ShowBusyOptions {
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
   * Should return error object exception.
   *
   * @param error The error to show
   */
  showError: (error: Error | string) => void;
  /**
   * Useful when performing a long running operation and you want to inform the user.
   *
   * A return type of a handler will be returned to allow for hideBusy.
   * If multiple calls are made the consumer should continue to indicated blocked
   * until all calls have been hideBusy.
   */
  showBusy: (message: string | React.ReactNode, options?: ShowBusyOptions) => (Promise<() => void>) | (() => void);
  /**
   * Show a dialog for a given type.
   *
   * @param type
   * @param options
   */
  showWindow: (type: string, options?: ShowWindowOptions) => Promise<HTMLElement>;
  /**
   * Provide a user with a list of options to choose from.
   * @param options
   */
  showOptions: (options: ShowOptionsOptions) => Promise<string>;
  /**
   * Provider a user with a way to enter a text input.
   * @param options
   */
  showInput: (options: ShowInputOptions) => Promise<InputResults>;

  // TODO - add an onProgress handler
  // TODO - add an onBackgroundOperation handler
}

export class DefaultReactNotifier extends DefaultNotifier implements IReactNotifier {
  /** @inheritdoc IReactNotifier.setOverrides */
  setOverrides(overrides: Partial<IReactNotifier> | null) {
    super.setOverrides(overrides);
  }

  /** @inheritdoc IReactNotifier.getDelegate */
  getDelegate(): Partial<IReactNotifier> | null {
    return this._overrides;
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
  showBusy(message: string | React.ReactNode, options?: ShowBusyOptions): (Promise<() => void>) | (() => void) {
    const delegate = this.getDelegate();
    if (delegate?.showBusy) {
      return delegate.showBusy(message, options);
    }
    return new Promise((resolve) => { resolve (() => {}); });
  }

  /** @inheritdoc IReactNotifier.showWindow */
  showWindow(type: string, options?: ShowWindowOptions): Promise<HTMLElement> {
    const delegate = this.getDelegate();
    if (delegate?.showWindow) {
      return delegate.showWindow(type, options);
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
  showOptions(options: ShowOptionsOptions): Promise<string> {
    const delegate = this.getDelegate();
    if (delegate?.showOptions) {
      return delegate.showOptions(options);
    }
    return Promise.resolve('');
  }

  /** @inheritdoc IReactNotifier.showInput */
  showInput(options: ShowInputOptions): Promise<InputResults> {
    const delegate = this.getDelegate();
    if (delegate?.showInput) {
      return delegate.showInput(options);
    }
    return Promise.resolve({ input: '', option: '' });
  }
}

// Create a singleton instance of ReactNotifier
const ReactNotifier = new DefaultReactNotifier();

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
    const restore = Notifier.getOverrides();
    Notifier.setOverrides(notifier);
    return () => {
      Notifier.setOverrides(restore);
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