import { RemoveListener  } from '@sheetxl/utils';
import { IKeyStroke } from '../types';

import { ICommand } from './ICommand';


/**
 * A default implementation of ICommand
 */
export class Command<STATE extends any=void, CONTEXT extends any=void> implements ICommand<STATE, CONTEXT> {
  protected _key: string; // the key is immutable
  protected _target: ICommand.ITarget | (() => ICommand.ITarget);

  protected _label: ICommand.DynamicValue<string, CONTEXT>;
  protected _scopedLabels?: Record<string, ICommand.DynamicValue<string, CONTEXT>>;
  protected _description?: ICommand.DynamicValue<string, CONTEXT>;
  protected _icon: ICommand.DynamicValue<React.ReactElement | string, CONTEXT>;
  protected _tags: ICommand.DynamicValue<string[], CONTEXT>;

  protected _shortcut: ICommand.DynamicValue<IKeyStroke | IKeyStroke[] | null, CONTEXT>;
  protected _disabled: ICommand.DynamicValue<boolean, CONTEXT>;

  protected _state: STATE;
  protected _context: CONTEXT;

  protected _callback: ICommand.Callback<STATE>;

  protected _listenersProperties = new Set<ICommand.PropertyListener<STATE, CONTEXT>>(); //WeakSet();
  protected _listenersExecute = new Set<ICommand.Hook<STATE, CONTEXT>>(); //WeakSet();

  constructor(
    key: string,
    target: ICommand.ITarget | (() => ICommand.ITarget) | null,
    props?: ICommand.Properties<STATE, CONTEXT>,
    callback?: ICommand.Callback<STATE>
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
        console.log(`implement: ${this.getLabel()} : ${this.getDescription()}`);
      }
    }
  }

  /** @inheritdoc ICommand.getKey */
  getKey() { return this._key };

  protected _resolve<T=any>(value: ICommand.DynamicValue<T, CONTEXT>, scopedContext?: CONTEXT | (() => CONTEXT)): T {
    if (typeof value === "function") {
      const _context = scopedContext ?? this._context;
      const context = (typeof _context === "function") ? (_context as any)() : _context;
      return (value as any)(context);
    } else
      return value;
  }

  /** @inheritdoc ICommand.getTarget */
  getTarget() { return (typeof this._target === "function") ? this._target() : this._target };

  /** @inheritdoc ICommand.getLabel */
  getLabel(scope?: string, scopedContext?: CONTEXT): string {
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

  /** @inheritdoc ICommand.getDescription */
  getDescription(context?: ICommand.DynamicContext<CONTEXT>): string { return this._resolve<string>(this._description, context) };

  /** @inheritdoc ICommand.getTags */
  getTags(context?: ICommand.DynamicContext<CONTEXT>): string[] { return this._resolve<string[]>(this._tags, context) };

  /** @inheritdoc ICommand.getIcon */
  getIcon(context?: ICommand.DynamicContext<CONTEXT>): React.ReactElement | string { return this._resolve<React.ReactElement | string>(this._icon, context) };

  /** @inheritdoc ICommand.getShortcut */
  getShortcut(): IKeyStroke | readonly IKeyStroke[] { return this._resolve<IKeyStroke | IKeyStroke[] | null>(this._shortcut) };

  /** @inheritdoc ICommand.disabled */
  disabled(): boolean { return this._resolve<boolean>(this._disabled) || !this._callback };

  /** @inheritdoc ICommand.getState */
  getState(): STATE { return this._resolve<STATE>(this._state) };

  /** @inheritdoc ICommand.getContext */
  getContext(): CONTEXT { return (typeof this._context === "function") ? this._context() : this._context };

  /** @inheritdoc ICommand.execute */
  async execute(args: STATE, hook?: ICommand.Hook<STATE, CONTEXT>): Promise<boolean> {
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

  /** @inheritdoc ICommand.addPropertyListener */
  addPropertyListener(listener: ICommand.PropertyListener<STATE, CONTEXT>, fireOnListen:boolean=false): RemoveListener {
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

  /** @inheritdoc ICommand.addExecuteListener */
  addExecuteListener(listener: ICommand.Hook<STATE, CONTEXT>): RemoveListener {
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
    this._listenersExecute.forEach((listener: ICommand.Hook<STATE, CONTEXT>) => {
      listener.onExecute(_this, args);
    });
  }

  protected _notifyError(error: any, args: STATE): void {
    const _this = this; // closure
    this._listenersExecute.forEach((listener: ICommand.Hook<STATE, CONTEXT>) => {
      listener.onError?.(_this, error, args);
    });
  }

  /** @inheritdoc ICommand.updateCallback */
  updateCallback(callback: ICommand.Callback<STATE>):ICommand<STATE, CONTEXT> {
    this._callback = callback || null;
    return this;
  }

  /** @inheritdoc ICommand.update */
  update(props: ICommand.Properties<STATE, CONTEXT>): ICommand<STATE, CONTEXT> {
    if (!props)
      return;

    const appliedProps = this._applyProps(props);
    if (Object.keys(appliedProps).length > 0) {
      // useful for debugging changes
      // console.log('propChanged', this.getKey(), appliedProps);
      this._notifyPropertyChange(appliedProps);
    }
    return this;
  }

  protected _notifyPropertyChange(props: ICommand.Properties<STATE, CONTEXT>): void {
    const _this = this; // closure
    this._listenersProperties.forEach((listener: ICommand.PropertyListener<STATE, CONTEXT>) => {
      listener(props, _this);
    });
  }

  protected _applyProps(props: ICommand.Properties<STATE, CONTEXT>):ICommand.Properties<STATE, CONTEXT> {
    let propsChanged:ICommand.Properties<STATE, CONTEXT> = {};
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
/**
 * A simple command that does not maintain state or context.
 */
export class SimpleCommand extends Command<void, void> {
}