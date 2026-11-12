import type React from 'react';
import { createContext, createElement, useContext, useMemo } from 'react';

import { type RenderSlotFn } from '../components';
import { CommonUtils, Notifier, type NotifierOptions, type INotifier } from "@sheetxl/utils";

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
 * One button in an options / input dialog. A bare `string` is shorthand for `{ label: string }` whose
 * identity is that same string (back-compat).
 *
 * Identity and display are deliberately separate: `label` is what the user SEES — and may be a thunk so
 * a language change while the dialog is open re-localizes it — while `id` is the language-free value the
 * caller COMPARES (`results.option === 'insert'`) and never varies. Whether a button is the default
 * (Enter) or the cancel (Esc) is NOT part of the option: that is contextual to the dialog and set by
 * {@link ShowOptionsOptions.defaultOption} / {@link ShowOptionsOptions.cancelOption}.
 */
export interface InputOption {
  /** Button label. A thunk resolves at render, so a mid-dialog language change re-localizes it. */
  label: string | (() => string);
  /**
   * Stable, language-free identity returned as {@link InputResults.option} and compared by callers.
   * Omit for a display-only button — then the option's own identity is returned (the `string` form, or
   * this object by reference). NOT a thunk: an identity must not vary by language.
   */
  id?: string;
  /**
   * Refuses the option outright: the button renders disabled, and Enter does not activate it as the
   * default. A thunk resolves at render, so a dialog can gate its action on live editor state.
   *
   * @remarks
   * This is for an action that is not OFFERED — a form the user has not made valid yet. It is not
   * {@link ShowOptionsOptions.onValidateOption}, which lets the click through and then refuses to
   * close; use that when the reason only emerges from the attempt (a rejected password).
   */
  disabled?: boolean | (() => boolean);
  /** Render this option's button. Spread `buttonProps` on it. */
  renderButton?: RenderSlotFn<OptionButtonRenderProps>;
}

/** What {@link InputOption.renderButton} is handed. */
export interface OptionButtonRenderProps {
  /** The dialog's wiring for the button: its click, `type` and class. */
  buttonProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
  /** The option is the dialog's default (its submit). */
  isDefaultOption: boolean;
}

/** A dialog option: a plain label/identity `string`, or a rich {@link InputOption}. */
export type OptionInput = string | InputOption;

/**
 * Configuration for an options dialog.
 */
export interface ShowOptionsOptions<T=any, C=any> extends ShowWindowOptions<T, C> {
  /**
   * The dialog buttons: plain identity strings or rich {@link InputOption}s (mixable).
   */
  options?: OptionInput[];
  /**
   * The title of the options panel
   */
  title?: string;
  /**
   * Display text information for the user to make a decision.
   */
  description?: string;
  /**
   * What kind of message this is. `info`, `warning`, `error` and `success` show the matching icon
   * beside the description; `default` (or omitted) shows none.
   */
  type?: NotifierType;
  /**
   * An icon beside the description, in place of the one {@link type} implies. A `string` is an icon
   * key.
   */
  icon?: React.ReactNode | string;
  /**
   * The option that is the default (Enter key), matched against the {@link options} by identity
   * (a `string` matches an option's id/string form, an {@link InputOption} matches by reference).
   * @defaultValue The first option
   */
  defaultOption?: OptionInput;
  /**
   * The cancel option (Esc key), matched against the {@link options} by identity. Gets special styling.
   * @defaultValue 'Cancel'
   */
  cancelOption?: OptionInput;
  /**
   * Call when an option is selected. `option` is the selected option's IDENTITY (its `id` if provided,
   * else the `string` form, else the {@link InputOption} object).
   * @remarks
   * It is possible that the option can be both a cancel and a default option.
   */
  onOption?: (option: OptionInput, isCancel: boolean, isDefault: boolean) => void;
  /**
   * Call when an option is selected. If false is returned, the dialog will not close. INotifier is not
   * provided but can be supplied via the textFieldProps helperText property. `option` is the selected
   * option's identity (see {@link onOption}).
   */
  onValidateOption?: (option?: OptionInput) => boolean | Promise<boolean>;
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

  /**
   * Mount the window hidden (do not reveal it) so a later real open is an instant reuse. Implies
   * {@link disableAutoDestroy} (a prewarmed window must be kept alive). Use at idle to move the
   * heavy first-mount cost off the user's open. A no-op if an instance already exists.
   * @defaultValue false
   */
  prewarm?: boolean
}

export interface InputValidationResults {
  valid: boolean;
  message?: string;
}
export interface InputResults {
  input: string;
  /** The selected option's identity (its `id` if provided, else the `string`, else the {@link InputOption}). */
  option: OptionInput;
}
export interface ShowInputOptions<T=string, C=any> extends ShowOptionsOptions<T, C> {

  /**
   * Css style for input
   */
  propsInput?:  React.HTMLAttributes<HTMLInputElement | HTMLTextAreaElement>;

  inputLabel?:  string;

  inputType?: 'text' | 'password' | 'email' | 'number' | 'search' | 'tel' | 'url';

  inputPlaceHolder?: string;

  onInput?: (input?: T, option?: OptionInput) => void | Promise<void>;

  /**
   * Validates the current input. Returning `{ valid: false }` keeps the dialog **open** and shows
   * `message` under the field.
   *
   * @remarks
   * Called in two situations, told apart by `option`:
   * - **`option` is `undefined`** — the user typed. Fires on every keystroke, so this path must stay
   *   cheap (a format/duplicate-name check).
   * - **`option` is set** — the user submitted. This is where expensive work belongs (a network
   *   round-trip, a password derivation); it is awaited, and the activated button shows a spinner
   *   while it runs.
   *
   * An expensive validator MUST therefore branch on `option` — otherwise it runs once per keystroke.
   */
  onValidateInput?: (input?: T, option?: OptionInput) => InputValidationResults | Promise<InputValidationResults>;
}

export interface ShowBusyOptions {
  // TODO - when this is supported we will need to allow for multiple on cancels
  // onCancel?: () => void;

  icon?: React.ReactNode;
}

/**
 * The handle returned by {@link IReactNotifier.showBusy}.
 *
 * @remarks
 * It is callable — calling it dismisses the busy indicator (the historical `hideBusy()` contract) —
 * and also carries methods to update the indicator while it is showing. This keeps every existing
 * `const hideBusy = await showBusy(...); hideBusy();` call working unchanged.
 */
export interface BusyHandle {
  /**
   * Dismiss the busy indicator.
   */
  (): void;
  /**
   * Update the indicator to a determinate state. When `total` is known the indicator shows a
   * percentage / progress bar; passing `total` as `undefined` (or `completed` as `undefined`)
   * returns it to the indeterminate (spinner) state.
   *
   * @param completed The cumulative work done so far.
   * @param total The total work, in the same units as `completed`.
   */
  setProgress(completed?: number, total?: number): void;
  /**
   * Update the message shown beside the indicator.
   */
  setMessage(message: string | React.ReactNode): void;
}

/**
 * Builds a {@link BusyHandle} from a dismiss function (and optional updaters). Used to wrap the
 * plain `hideBusy` callbacks that providers produce, and to supply inert no-op handles where no
 * provider is present.
 */
export function createBusyHandle(
  dismiss: () => void = () => {},
  setProgress: (completed?: number, total?: number) => void = () => {},
  setMessage: (message: string | React.ReactNode) => void = () => {}
): BusyHandle {
  const handle = (() => dismiss()) as BusyHandle;
  handle.setProgress = setProgress;
  handle.setMessage = setMessage;
  return handle;
}

/**
 * An inert {@link BusyHandle} whose methods do nothing. Returned when no busy provider is available.
 */
export function createNoopBusyHandle(): BusyHandle {
  return createBusyHandle();
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
   * Returns a {@link BusyHandle}: call it to dismiss the indicator, or use its `setProgress` /
   * `setMessage` methods to update it while it shows. If multiple calls are made the consumer should
   * continue to indicate blocked until all handles have been dismissed.
   */
  showBusy: (message: string | React.ReactNode, options?: ShowBusyOptions) => (Promise<BusyHandle>) | BusyHandle;
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
  showOptions: (options: ShowOptionsOptions) => Promise<OptionInput>;
  /**
   * Provider a user with a way to enter a text input.
   * @param options
   */
  showInput: (options: ShowInputOptions) => Promise<InputResults>;

  // TODO - add an onProgress handler
  // TODO - add an onBackgroundOperation handler
}

const NotifierMethods: readonly (keyof IReactNotifier)[] = [
  'debug', 'log', 'warn', 'error',
  'showMessage', 'showError', 'showBusy', 'showWindow', 'showOptions', 'showInput'
];

/**
 * Takes each method from the first notifier that has it. Methods are bound, so a class instance
 * works as well as a plain object.
 */
const mergeNotifiers = (...notifiers: (Partial<IReactNotifier> | null | undefined)[]): Partial<IReactNotifier> => {
  const merged: Partial<IReactNotifier> = {};
  for (const key of NotifierMethods) {
    for (const notifier of notifiers) {
      const method = notifier?.[key];
      if (typeof method === 'function') {
        (merged as any)[key] = method.bind(notifier);
        break;
      }
    }
  }
  return merged;
};

/**
 * What {@link useNotifier} does for a method no provider supplies: show nothing, and send logging
 * and errors to the global {@link Notifier}.
 */
const Unprovided: IReactNotifier = {
  debug: (message, options) => Notifier.debug(message, options),
  log: (message, options) => Notifier.log(message, options),
  warn: (message, options) => Notifier.warn(message, options),
  error: (error, options) => Notifier.error(error, options),
  showMessage: () => {},
  showError: (error) => Notifier.error(error),
  showBusy: () => Promise.resolve(createNoopBusyHandle()),
  showWindow: () => Promise.resolve(document.createElement('div')),
  showOptions: () => Promise.resolve(''),
  showInput: () => Promise.resolve({ input: '', option: '' })
};

const NotifierContext = createContext<Partial<IReactNotifier>>(CommonUtils.EmptyObject);

export interface ReactNotifierProviderProps {
  children: React.ReactNode;
  /**
   * The methods this provider implements. The ones it leaves out come from a provider further out,
   * or do what {@link useNotifier} does with no provider.
   */
  notifier: Partial<IReactNotifier>;
}

/**
 * Shows the messages, dialogs and busy indicators that components below it ask for through
 * {@link useNotifier}.
 *
 * @remarks
 * Providers stack **per method, and the outermost wins**. An app that wraps a studio in a provider
 * with only `showMessage` replaces the studio's toasts and keeps its dialogs.
 *
 * The provider affects React components only. To redirect the SDK's own messages, override the
 * global {@link Notifier}.
 *
 * @example
 * ```tsx
 * const notifier = {
 *   showMessage: (message) => toast(message),
 *   showError: (error) => toast.error(String(error))
 * };
 *
 * <ReactNotifierProvider notifier={notifier}>
 *   <App />
 * </ReactNotifierProvider>
 * ```
 */
export const ReactNotifierProvider: React.FC<ReactNotifierProviderProps> = ({ children, notifier }) => {
  const outer = useContext(NotifierContext);
  const merged = useMemo(() => mergeNotifiers(outer, notifier), [outer, notifier]);
  return createElement(
    NotifierContext.Provider,
    { value: merged },
    children
  );
};

/**
 * Returns the notifier for showing the user messages, dialogs and busy indicators.
 *
 * @remarks
 * Every method is always present. With no {@link ReactNotifierProvider} above, messages, dialogs and
 * busy indicators show nothing (a dialog resolves as if cancelled), and `log`, `warn`, `error` and
 * `showError` go to the global {@link Notifier}.
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
  const provided = useContext(NotifierContext);
  return useMemo(() => mergeNotifiers(provided, Unprovided) as IReactNotifier, [provided]);
};
