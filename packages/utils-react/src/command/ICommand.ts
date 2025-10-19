import type { RemoveListener  } from '@sheetxl/utils';
import type { IKeyStroke } from '../types';


/*
 * A command represents an action performed against a model with
 * a given view context.
 *
 * Commands are used by the UI to generate buttons and menus; it can
 * also be used by AI Agents to understand what actions are possible and perform
 * executions.
 *
 * In a model-view design there can be multiple views (contexts) for a single model (state).
 */
export interface ICommand<STATE extends any=any, CONTEXT extends any=void> {
  /**
   * A unique key for the command. This is how the command is identified
   * within the CommandTree
   *
   * @remarks
   * Immutable
   */
  getKey(): string; // the key is immutable
  /**
   * The target that the command operates on.
   */
  getTarget(): ICommand.ITarget;

  /**
   * Indicates if the command is disabled.
   */
  // TODO - this will be a string
  // TODO - also a hidden (for macros + a few others...)
  disabled(): boolean;

  /**
   * Called to execute the command.
   *
   * @param args Optional arguments for the command.
   */
  execute(args?: STATE, hook?: ICommand.Hook<STATE, CONTEXT>): Promise<boolean>;

  /**
   * Represents the model state.
   */
  getState(): STATE;

  /**
   * The current view context associated with the command.
   */
  getContext(): CONTEXT;

  /**
   * Additional information that may be needed to render or make decisions about setting state.
   */
  update(props: ICommand.Properties<STATE, CONTEXT>): ICommand<STATE, CONTEXT>;

  /**
   * Update the callback function for the command.
   * @param callback
   */
  updateCallback(callback: ICommand.Callback<STATE>): ICommand<STATE, CONTEXT>;

  /**
   * Add a listener that will be called when command properties have changed
  */
  addPropertyListener(listener: ICommand.PropertyListener<STATE, CONTEXT>, fireOnListen?: boolean): RemoveListener;

  /**
   * Add a listener that will be called when the command is executed
   * @param listener
   */
  addExecuteListener(listener: ICommand.Hook<STATE, CONTEXT>): RemoveListener;

  /**
   * Get the shortcut(s) associated with the command.
   */
  getShortcut(): IKeyStroke | readonly IKeyStroke[];

  /**
   * Get the label associated with the command.
   */
  getLabel(scope?: string, context?: ICommand.DynamicContext<CONTEXT>): string;

  /**
   * Get the tags associated with the command.
   */
  getTags(context?: ICommand.DynamicContext<CONTEXT>): string[];

  /**
   * Get the description associated with the command.
   */
  getDescription(context?: ICommand.DynamicContext<CONTEXT>): string;

  /**
   * Get the icon associated with the command.
   */
  getIcon(context?: ICommand.DynamicContext<CONTEXT>): React.ReactElement | string;
}

/**
 * @see
 * ### **Interface**
 *
 * {@link ICommand}
 */
export namespace ICommand {
  /**
   * Used to interactive with a dom element.
   *
   * @remarks
   * * When dispatching keystrokes the target is used to determine if the keystroke
   * can be consumed by the element.
   * * Many commands will refocus the target after they have completed. The target focus will be called.
   */
  // TODO - rename as target is ambiguous
  export interface ITarget {
    /**
     * Used to determine if a dom element is contained with the group.
     *
     * @param element
     *
     * @remarks
     * This is used for validating keystrokes and focus traversal.
     */
    contains(element: Node | null): boolean;
    /**
     * Called after a command is executed.
     */
    focus(): void;
  }

  /**
   * The callback function for a command.
   *
   * @remarks
   * When
   */
  // TODO - args are the not state
  export interface Callback<STATE extends any=void> {
    (args?: STATE, command?: ICommand<STATE, unknown>): void | boolean | Promise<boolean> | Promise<void>;
  }

  export type DynamicContext<CONTEXT> = CONTEXT | (() => CONTEXT);
  export type DynamicValue<T, CONTEXT> = T | ((context?: DynamicContext<CONTEXT>) => T);

  /**
   * Properties that can be updated on a command.
   */
  export interface Properties<STATE extends any=void, CONTEXT extends any=void> {
    // TODO - move non-dynamic properties out of the update properties option
    // TODO - .disable(reason: string, add: boolean = true)
    disabled?: boolean | (() => boolean);

    /**
     * Values associated with the command model.
     */
    state?: STATE;
    /**
     * View specific context values
     */
    context?: DynamicContext<CONTEXT>;

    shortcut?: IKeyStroke | IKeyStroke[] | (() => IKeyStroke);

    label?: DynamicValue<string, CONTEXT>;
    tags?: DynamicValue<string[], CONTEXT>;

    /**
     * The ability to override labels for specific context. Useful for content menus
     * For example 'Rename Sheet' command might only want to be displayed as 'Rename' in the content menu.
     */
    scopedLabels?: Record<string, DynamicValue<string, CONTEXT>>;
    description?: DynamicValue<string, CONTEXT>;
    icon?: DynamicValue<React.ReactNode, CONTEXT>;
  }

  export interface PropertyListener<STATE extends any, CONTEXT extends any> {
    /**
     * Called when command properties have changed.
     */
    (props: ICommand.Properties<STATE, CONTEXT>, command: ICommand<STATE, CONTEXT>): void;
  }

  /**
   * A hook that can be passed to a command execute function.
   */
  export interface Hook<STATE extends any, CONTEXT extends any=void> {
    /**
     * If implemented will be called when execute is called. If a promise is return if will wait until
     * this is completed.
     *
     * @param command
     * @param args
     */
    beforeExecute?(command: ICommand<STATE, CONTEXT>, args: STATE): Promise<boolean | void> | boolean | void;
    /**
     * Called when a command has been executed successful.
     */
    onExecute?(command: ICommand<STATE, CONTEXT>, args: STATE): void;
    /**
     * Called when a command failed to executed successfully.
     */
    onError?(command: ICommand<STATE, CONTEXT>, error: any, args: STATE): void;
  }

}
