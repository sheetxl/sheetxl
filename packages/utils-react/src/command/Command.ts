import { RemoveListener  } from '@sheetxl/utils';
import { IKeyStroke } from '../types';

import { ICommands } from './ICommands';
/*
 * A command represents an action performed by the UI.
 * It is either done via a keyboard shortcut or through a
 * UI widget (usually a button or menu item).
 */

/*
 * TODO - add type (Useful for CommandButton factory)
 */
export interface ICommandCallback<STATE extends any=void> {
  (args?: STATE, command?: ICommand<STATE, unknown>): void | boolean | Promise<boolean> | Promise<void>;
}

type DynamicContext<CONTEXT> = CONTEXT | (() => CONTEXT);
type DynamicValue<T, CONTEXT> = T | ((context?: DynamicContext<CONTEXT>) => T);

export interface ICommandProperties<STATE extends any=void, CONTEXT extends any=void> {
  // TODO - move non-dynamic properties out of the update properties option
  // TODO - .disable(reason: string, add: boolean = true)
  disabled?: boolean | (() => boolean);
  state?: STATE;
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

export interface ICommandPropertyListener<STATE extends any, CONTEXT extends any> {
  /**
   * Called when command properties have changed.
   */
  (props: ICommandProperties<STATE, CONTEXT>, command: ICommand<STATE, CONTEXT>): void;
}

/**
 * A hook that can be passed to a command execute function.
 */
export interface ICommandHook<STATE extends any, CONTEXT extends any=void> {
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

export interface ICommand<STATE extends any=any, CONTEXT extends any=void> {
  /**
   * A unique key for the command. This is how the command is identified
   * within the CommandTree
   *
   * @remarks
   * Immutable
   */
  key(): string; // the key is immutable
  target(): ICommands.ITarget;

  disabled(): boolean;
  execute(args?: STATE, hook?:ICommandHook<STATE, CONTEXT>): Promise<boolean>;

  /**
   * Represents the current state of the value that can also be set
   */
  state(): STATE;

  context(): CONTEXT;

  /**
   * Additional information that may be needed to render or make decisions about setting state.
   */
  update(props: ICommandProperties<STATE, CONTEXT>): ICommand<STATE, CONTEXT>;

  updateCallback(callback: ICommandCallback<STATE>): ICommand<STATE, CONTEXT>;

  /**
   * This is call when any command properties are changed but not when the callback is changed
  */
  addPropertyListener(listener: ICommandPropertyListener<STATE, CONTEXT>, fireOnListen?: boolean): RemoveListener;

  addExecuteListener(listener: ICommandHook<STATE, CONTEXT>): RemoveListener;

  shortcut(): IKeyStroke | IKeyStroke[];

  label(scope?: string, context?: DynamicContext<CONTEXT>): string;
  tags(context?: DynamicContext<CONTEXT>): string[];
  description(context?: DynamicContext<CONTEXT>): string;
  icon(context?: DynamicContext<CONTEXT>): React.ReactElement | string;
}

export class Command<STATE extends any=void, CONTEXT extends any=void> implements ICommand<STATE, CONTEXT> {
  protected _key: string; // the key is immutable
  protected _target: ICommands.ITarget | (() => ICommands.ITarget);

  protected _label: DynamicValue<string, CONTEXT>;
  protected _scopedLabels?: Record<string, DynamicValue<string, CONTEXT>>;
  protected _description?: DynamicValue<string, CONTEXT>;
  protected _icon: DynamicValue<React.ReactElement | string, CONTEXT>;
  protected _tags: DynamicValue<string[], CONTEXT>;

  protected _shortcut: DynamicValue<IKeyStroke | IKeyStroke[] | null, CONTEXT>;
  protected _disabled: DynamicValue<boolean, CONTEXT>;

  protected _state: STATE;
  protected _context: CONTEXT;

  protected _callback: ICommandCallback<STATE>;

  protected _listenersProperties = new Set<ICommandPropertyListener<STATE, CONTEXT>>(); //WeakSet();
  protected _listenersExecute = new Set<ICommandHook<STATE, CONTEXT>>(); //WeakSet();

  constructor(
    key: string,
    target: ICommands.ITarget | (() => ICommands.ITarget) | null,
    props?: ICommandProperties<STATE, CONTEXT>,
    callback?: ICommandCallback<STATE>
  ) {
    this._key = key;
    this._target = target;
    // if (!target) {
    //   console.warn('target can not be null.', key);
    // }
    this._applyProps(props || {});
    this._callback = callback;
    if (callback === undefined) { // null work
      this._callback = () => {
        console.log(`implement: ${this.label()} : ${this.description()}`);
      }
    }
  }

  key() { return this._key };

  protected _resolve<T=any>(value: DynamicValue<T, CONTEXT>, scopedContext?: CONTEXT | (() => CONTEXT)): T {
    if (typeof value === "function") {
      const _context = scopedContext ?? this._context;
      const context = (typeof _context === "function") ? (_context as any)() : _context;
      return (value as any)(context);
    } else
      return value;
  }

  target() { return (typeof this._target === "function") ? this._target() : this._target };
  label(scope?: string, scopedContext?: CONTEXT): string {
    const _label = this._scopedLabels?.[scope] || this._label;
    let label: string = null;
    if (typeof _label === "function") {
      const _context = scopedContext ?? this._context
      const context = (typeof _context === "function") ? _context() : _context;
      label = _label(context);
    } else {
      label = _label
    }
    return label;
  };
  description(context?: DynamicContext<CONTEXT>): string { return this._resolve<string>(this._description, context) };
  tags(context?: DynamicContext<CONTEXT>): string[] { return this._resolve<string[]>(this._tags, context) };
  icon(context?: DynamicContext<CONTEXT>): React.ReactElement | string { return this._resolve<React.ReactElement | string>(this._icon, context) };

  shortcut() { return this._resolve<IKeyStroke | IKeyStroke[] | null>(this._shortcut) };
  disabled() { return this._resolve<boolean>(this._disabled) || !this._callback };
  state() { return this._resolve<STATE>(this._state) };

  context() { return (typeof this._context === "function") ? this._context() : this._context };

  async execute(args: STATE, hook?: ICommandHook<STATE, CONTEXT>): Promise<boolean> {
    if (this.disabled() || !this._callback) return;
    try {
      let shouldExecute:any = true;
      if (hook?.beforeExecute) {
        shouldExecute = hook?.beforeExecute(this, args);
      }
      const shouldExecuteResults:boolean | void = await Promise.resolve(shouldExecute);
      if (shouldExecuteResults === false) {
        return false;
      }

      const resolved = this._callback.bind(this)(args, this);
      const result:boolean | void = await Promise.resolve(resolved);
      if (result === false) {
        return false;
      }
      hook?.onExecute?.(this, args)
      this._notifyExecute(args);
    } catch (error: any) {
      console.warn(error);
      hook?.onError(this, error, args);
      this._notifyError(args, error);
      return false;
    }
    return true;
  }

  /**
   * This is call when any command properties are changed but not when the callback is changed
   */
  addPropertyListener(listener: ICommandPropertyListener<STATE, CONTEXT>, fireOnListen:boolean=false): RemoveListener {
    if (!listener)
      throw new Error('listener must be specified');
    // This function takes a function that is called when a value is updated
    const listeners = this._listenersProperties;
    const removeListener:RemoveListener = (): void => {
      listeners.delete(listener);
    };
    listeners.add(listener);
    if (fireOnListen)
      listener({}, this);
    return removeListener;
  }

  addExecuteListener(listener: ICommandHook<STATE, CONTEXT>): RemoveListener {
    if (!listener)
      throw new Error('listener must be specified');
    // This function takes a function that is called when a value is updated
    const listeners = this._listenersExecute;
    const removeListener:RemoveListener = function () {
      listeners.delete(listener);
    };
    listeners.add(listener);
    return removeListener;
  }

  protected _notifyExecute(args: STATE): void {
    const _this = this; // closure
    this._listenersExecute.forEach((listener: ICommandHook<STATE, CONTEXT>) => {
      listener.onExecute(_this, args);
    });
  }

  protected _notifyError(error: any, args: STATE): void {
    const _this = this; // closure
    this._listenersExecute.forEach((listener: ICommandHook<STATE, CONTEXT>) => {
      listener.onError?.(_this, error, args);
    });
  }

  updateCallback(callback: ICommandCallback<STATE>):ICommand<STATE, CONTEXT> {
    this._callback = callback || null;
    return this;
  }

  update(props: ICommandProperties<STATE, CONTEXT>): ICommand<STATE, CONTEXT> {
    if (!props)
      return;

    const appliedProps = this._applyProps(props);
    if (Object.keys(appliedProps).length > 0) {
      // useful for debugging changes
      // console.log('propChanged', this.key(), appliedProps);
      this._notifyPropertyChange(appliedProps);
    }
    return this;
  }

  protected _notifyPropertyChange(props: ICommandProperties<STATE, CONTEXT>): void {
    const _this = this; // closure
    this._listenersProperties.forEach((listener: ICommandPropertyListener<STATE, CONTEXT>) => {
      listener(props, _this);
    });
  }

  protected _applyProps(props: ICommandProperties<STATE, CONTEXT>):ICommandProperties<STATE, CONTEXT> {
    let propsChanged:ICommandProperties<STATE, CONTEXT> = {};
    let _this = this;
    Object.keys(props).forEach((key) => {
      let value = props[key];
      if (_this['_' + key] !== value) {
        _this['_' + key] = propsChanged[key] = value;
      }
    });
    return propsChanged;
  }
}
export class SimpleCommand extends Command<void, void> {
}