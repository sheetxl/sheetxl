
/**
 * Indicates the type of notification.
 */
export const NotificationType = {
  Default: 'default', // not needed
  Error: 'error',
  Success: 'success',
  Warning: 'warning',
  Info: 'info'
} as const;
export type NotificationType = typeof NotificationType[keyof typeof NotificationType];

/**
 * Configuration for non-blocking notifications.
 */
// Move to Common? INotification
export interface NotificationOptions {
  /**
   * A hint for decorations of the message.
   */
  type?: NotificationType;
  /**
   * Setting this to true will leave the notification on the screen unless it is dismissed (programmatically or through user interaction).
   * If `false` will be removed after a period of time.
   *
   * @defaultValue false
   */
  persist?: boolean;
  /**
   * Ignores displaying multiple snackBars with the same `message`.
   *
   * @defaultValue false
   */
  preventDuplicate?: boolean;
  /**
   * If provided then then notification provider should not notify if the same id is used again.
   */
  onceKey?: string;

  /**
   * Passed directly to the Snackbar component.
   */
  enqueueProps?: Record<string, any>;
}

/**
 * Configuration for an options dialog.
 */
export interface OptionsNotificationOptions extends React.HTMLAttributes<HTMLDivElement> {
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
   * dialog will not close. Notification is not provided but can
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
export interface InputOptionsNotificationOptions extends OptionsNotificationOptions {

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
   * dialog will not close. Notification is not provided but can
   * be supplied via the textFieldProps helperText property.
   * @remarks
   * Optional the textProps can be updated via the textFieldProps argument
   */
  onValidateInputOption?: (input?: string, option?: string) => InputValidationResults | Promise<InputValidationResults>;
}

export interface BusyNotificationOptions {
  // TODO - when this is supported we will need to allow for multiple on cancels
  // onCancel?: () => void;

  icon?: React.ReactNode;
}

/**
 * Interface that provides popups for the user.
 */
export interface Notifier {
  /**
   * Useful when informing the user of something but are not expecting a response.
   */
  showMessage?: (message: string | React.ReactNode, options?: NotificationOptions) => void;
  /**
   * Useful when performing a long running operation and you want to inform the user.
   *
   * A return type of a handler will be returned to allow for hideBusy.
   * If multiple calls are made the consumer should continue to indicated blocked
   * until all calls have been hideBusy.
   */
  showBusy?: (message: string | React.ReactNode, options?: BusyNotificationOptions) => (Promise<() => void>) | (() => void);
  /**
   * Show a dialog for a given type.
   * @param type
   * @param props
   * @param options
   */
  // TODO - type this
  showWindow?: (type: string, props?: any, options?: { disableAutoDestroy?: boolean }) => Promise<HTMLElement>;
  /**
   * Should return error object exception.
   *
   * @param error
   */
  showError?: (error: Error | string) => void;
  /**
   * Provide a user with a list of options to choose from.
   * @param options
   */
  showOptions?: (options: OptionsNotificationOptions) => Promise<string>;
  /**
   * Provider a user with a way to enter a text input.
   * @param options
   */
  showInputOptions?: (options: InputOptionsNotificationOptions) => Promise<InputResults>;

  // TODO - add an onProgress handler
  // TODO - add an onBackgroundOperation handler
}

const onceMessageKeys = new Set<string>();
export const DefaultNotifier: Notifier = {
  showMessage: (message: string | React.ReactNode, options?: NotificationOptions): void => {
    if (options?.onceKey) {
      if (onceMessageKeys.has(options.onceKey)) return;
      onceMessageKeys.add(options.onceKey);
    }

    let out = console.log;
    if (options?.type === NotificationType.Warning || options?.type === NotificationType.Error)
      out = console.warn;

    out(message);
  },
  showBusy: (_message: string | React.ReactNode, _options?: BusyNotificationOptions): Promise<() => void> => {
    return new Promise((resolve) => { resolve (() => {}); });
  },
  showError: (error: any): void => {
    console.error(error);
  }
}
