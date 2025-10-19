import { CommonUtils, type RemoveListener } from '@sheetxl/utils';

import { KeyModifiers, type IKeyStroke } from '../types';

import { toPrettyKeyCode } from '../utils/ReactUtils';

import { ICommand } from './ICommand';

/**
 * The ICommands namespace contains interfaces for managing collections of commands and
 * dispatching keystrokes to the most specific command.
 *
 * @remarks
 * This is done by creating a hierarchy of command groups and tracking the 'most focused' group.
 * All keystrokes will walk up the commands groups until a command is found.
 *
 */
export namespace ICommands {
  export interface IListener {
    /**
     * Called when the active group has changed.
     * @param source
     */
    onActiveChange?(source: ICommands.IGroup): void;
    /**
     * Called when a command has changed.
     * @param source
     * @param command
     *
     * @remarks
     * For this to be enabled the keys must be provided in the {@link ICommands.IListenerOptions}.
     */
    onCommandChange?(source: ICommands.IGroup, command: ICommand): void;
    /**
     * Called when any change to the resolvable commands has occurred.
     *
     * @remarks
     * This can be either due to changed the active or commands were added
     */
    onGroupChange?(source: ICommands.IGroup): void;
  }

  export interface IListenerOptions {
    /**
     * If provided then the onCommandChange will be called when the command changes.
     */
    keys?: string[];
  }

  /**
   * Contains commands and child command maps.
   */
  export interface ILookup {
    /**
     * Return a command that matches the key.
     *
     * @remarks
     * Search both the current and any child commands groups that are actives.
     */
    getCommand(key: string): ICommand<any, any>;
  }

  /**
   * A command group is a collection of commands and child command groups.
   */
  export interface IGroup extends ICommands.ILookup {
    /**
     * Create a new map to add Commands.
     *
     * @param target {@link ICommand.ITarget}.
     * @param groupKey String description describing the reason for the group. This is presented to the user in the shortcut UI.
     * @param replace If `true` replace the existing commands. If `false` ignores duplicates. If unspecified a warning will be logged for duplicates.
     */
    createChildGroup(target: ICommand.ITarget | (() => ICommand.ITarget), groupKey: string, replace?: boolean): ICommands.IGroup;
    /**
     * Returns the keys associated with the group
     */
    getKey(): string;
    /**
     * Remove the command group from the parent.
     * @remarks
     * If this is the root this operation will have no effect
     */
    removeFromParent(): void;
    /**
     * Returns a group for the given when string.
     */
    getGroup(key: string): ICommands.IGroup | null;
    /**
     * Add a collection of commands to the group.
     * @param commands The commands to add.
     * @param replace If `true` replace the existing commands. If `false` ignores duplicates. If unspecified a warning will be logged for duplicates.
     * @remarks
     * Set the commands for the current node.
     */
    addCommands(commands: readonly ICommand<any, any>[], replace?: boolean): void;
    // /**
    //  * Clears just the commands from the group.
    //  */
    // clear(): void;
    /**
     * Set the command group to the 'focused group.
     * @param key The key of the group to activate. If not provided then the current group is activated.
     */
    activate(key?: string): void;
    /**
     * Return the active group.
     *
     * @remarks
     * This is the group that the dispatch will start from.
     */
    getActive(): ICommands.IGroup;
    /**
     *
     * @param e The keyboard event to dispatch
     */
    dispatchToFocusedCommand(e: React.KeyboardEvent): boolean;
    /**
     * Returns the top most commands group.
     *
     * @remarks
     * If root then will return return itself.
     */
    getRoot(): ICommands.IGroup;
    /**
     * Returns the parent command group.
     *
     * @remarks
     * If root then will return return itself.
     */
    getParent(): ICommands.IGroup | null;
    /**
     * Add listener.
     */
    addListener(listener: ICommands.IListener, options?: ICommands.IListenerOptions): RemoveListener;
    /**
     * Returns a list of all commands in the group and all children commands.
     * @remarks
     * This does not return parent commands.
     */
    getAllCommands(): { command: ICommand<any, any>, groupKey: string}[];
    /**
     * Return a command that matched the keyboard event or `null` if no command was found.
     *
     * @param e The keyboard event.
     */
    findCommandByEvent(e: React.KeyboardEvent): ICommand | null;
  }
}

// interface ListenerEntry {
//   // the main listener
//   unListener: RemoveListener;
//   listeners: Set<ICommands.IListener> | null;
// }

/**
 * Default implementation of `ICommands.IGroup`.
 */
export class CommandGroup implements ICommands.IGroup {
  protected _target: ICommand.ITarget | (() => ICommand.ITarget) = null;
  protected _groupKey: string = null;

  protected _root: CommandGroup | null = null;
  protected _parent: CommandGroup | null = null;

  protected _focused: CommandGroup; // only set on the root
  protected _nodes: Map<string, CommandGroup>;

  // for debugging
  protected _uuid = CommonUtils.uuidV4();

  protected _children: Map<string, ICommands.IGroup>;

  protected _commandsByKey: Map<string, ICommand<any, any>>;
  protected _commandsByShortcut: Map<string, string>;

  protected _listeners: Set<ICommands.IListener>; //WeakSet;

  // These values are only used from the root context.
  // listeners for keys. These are at the root level. to ensure changes to resolution also notify.
  // we should filter the listeners to not notify for groups belong the listener but we can review later.
  protected _listenersByKey: Map<string, Set<ICommands.IListener> | null>; // only belongs to root.
  protected _unListenersByCommand: Map<ICommand, RemoveListener>; // only belongs to root.
  protected _commandsPropertyListener: ICommand.PropertyListener<any, any>;

  constructor(target: ICommand.ITarget | (() => ICommand.ITarget), groupKey?: string) {
    this._target = target;
    this._groupKey = groupKey ?? null;
    this._root = this;
    this._nodes = new Map();
    this._nodes.set(groupKey, this);
    this._children = new Map();
    this._listeners = new Set();

    this._commandsByKey = new Map();
    this._commandsByShortcut = new Map();

    const _self = this;
    this._unListenersByCommand = new Map<ICommand, RemoveListener>();
    this._listenersByKey = new Map<string, Set<ICommands.IListener> | null>();
    this._commandsPropertyListener = (props: ICommand.Properties<any, any>, command: ICommand<any, any>): void => {
      /** we only use the root listenersByKey */
      const listenersByKey = _self._root._listenersByKey;
      const key = command.getKey();
      const listeners = listenersByKey.get(key);
      if (listeners) {
        _self._notifyCommands(listeners, 'onCommandChange', command);
      }
    }
  }

  private _getCommand(key: string): ICommand<any, any> {
    const command = this._commandsByKey.get(key);
    if (command) return command;
    return this._parent?._getCommand(key) ?? null;
  }

  /** {@inheritDoc ICommands.IGroup.getCommand} */
  getCommand(key: string, _ignoreActive: boolean=false): ICommand<any, any> {
    const focused = this._root._focused;
    let parent = focused;
    let containsActive = focused === this;
    // we return the most specific active group unless we are not in the active group path.
    while (!containsActive && parent) {
      if (parent === this) {
        containsActive = true;
      }
      parent = parent._parent;
    }
    const group = containsActive ? focused : this;
    return group._getCommand(key);
  }

  /** {@inheritDoc ICommands.IGroup.createChildGroup} */
  createChildGroup(target: ICommand.ITarget | (() => ICommand.ITarget), when: string, replace?: boolean): ICommands.IGroup {
    let child:CommandGroup;

    // if !replacing look for existing child
    if (!replace) {
      let node:CommandGroup = this;
      while (node && !child) {
        let existing = node._nodes.get(when);
        if (existing) {
          child = existing;
        }
        node = node._parent;
      };
    }

    if (!child) {
      child = new CommandGroup(target, when);
      child._parent = this;
      child._root = this._root;

      child._unListenersByCommand = null;
      child._listenersByKey = null;
      child._commandsPropertyListener = null;
    }

    const addIfReplace = (nodes: Map<string, CommandGroup>, child: CommandGroup): void => {
      if (nodes.has(when)) {
        if (!replace) {
          if (replace === undefined) {
            console.warn('commandGroup already registered', when);
          }
          return;
        }
      }
      nodes.set(when, child);
    }

    addIfReplace(this._root._nodes, child);
    let parent = this._parent
    while (parent) {
      addIfReplace(this._nodes, child);
      parent = parent._parent;
    }

    this._children.set(when, child);
    this._notify('onGroupChange'); // we don't notify the child
    return child;
  }

  /** {@inheritDoc ICommands.IGroup.getKey} */
  getKey(): string {
    return this._groupKey;
  }

  /** {@inheritDoc ICommands.IGroup.getGroup} */
  getGroup(key: string): ICommands.IGroup | null {
    return this._nodes.get(key);
  }

  protected _addCommands(commands: readonly ICommand<any, any>[], replace: boolean=undefined): void {
    const byKey = this._commandsByKey;
    const byShortcut = this._commandsByShortcut;

    const commandsPropertyListener = this._root._commandsPropertyListener;
    const unListenersByCommand = this._root._unListenersByCommand;
    // const _self = this;
    const commandsLength = commands.length;
    for (let i=0; i<commandsLength; i++) {
      const command = commands[i];
      const commandKey = command.getKey();
      if (byKey.has(commandKey)) {
        if (!replace) {
          if (replace === undefined) {
            console.warn('command already registered', commandKey);
          }
          continue;
        }
      }
      byKey.set(commandKey, command);

      // globally scoped
      let unlistener = unListenersByCommand.get(command);
      if (unlistener) {
        unlistener();
        unListenersByCommand.delete(command);
      }
      // we don't remove as we are about to replace it (save a lookup)
      const unListener = command.addPropertyListener(commandsPropertyListener);
      unListenersByCommand.set(command, unListener);

      const shortcut:IKeyStroke | readonly IKeyStroke[] = command.getShortcut();
      if (!shortcut)
        continue; // no keyboard support for command.

      const asArray:IKeyStroke[] = Array.isArray(shortcut) ? shortcut as IKeyStroke[] : [shortcut as IKeyStroke];

      const asArrayLength = asArray.length;
      for (let i=0; i<asArrayLength; i++) {
      const shortcutString = toShortcutString(asArray[i]);
        const existing = byShortcut.get(shortcutString);
        if (existing && !replace) {
          if (replace === undefined) {
            console.warn(`Shortcut already registered: ${shortcutString}, ${commandKey}, ${existing}.`);
          }
        }
        byShortcut.set(shortcutString, commandKey); // the key of the shortcut not the command
      }
    }
  }

  // /** {@inheritDoc ICommands.IGroup.clear} */
  // clear(): void {
  //   this._commandsByKey.clear();
  //   this._commandsByShortcut.clear();
  //   this._notify('onChange');
  // }

  /** {@inheritDoc ICommands.IGroup.removeFromParent} */
  // TODO - not in use.
  removeFromParent(): void {
    if (!this._parent) return;

    let parent = this._parent;
    let removed = [];
    const groupKey = this._groupKey;
    while (parent) {
      removed.push(parent._nodes);
      parent._nodes.delete(groupKey);
      parent = parent._parent;
    }

    parent = this._parent;

    const removeWhenFromChildren = (group: CommandGroup) => {
      group._children.forEach((node: CommandGroup) => {
        const removedLength = removed.length;
        const nodes = node._nodes;
        for (let i=0; i<removedLength; i++) {
          nodes.delete(removed[i]);
        }
        removeWhenFromChildren(node as CommandGroup);
      });
    };
    removeWhenFromChildren(this);
    // parent._children.delete(this._when);
    this._parent = null;

    // TODO - refocus if we had focus
    this._notify('onGroupChange'); // we don't notify the child
  }

  /** {@inheritDoc ICommands.IGroup.addCommands} */
  addCommands(commands: readonly ICommand<any, any>[], replace?: boolean): void {
    // this._commandsByKey.clear();
    // this._commandsByShortcut.clear();
    this._addCommands(commands, replace);
    this._notify('onGroupChange'); // we don't notify the child
  }

  /** {@inheritDoc ICommands.IGroup.getActive} */
  getActive(): ICommands.IGroup {
    return this._root._focused ?? this._root;
  }

  /** {@inheritDoc ICommands.IGroup.activate} */
  activate(groupKey?: string): void {
    let toActivate:CommandGroup = this;
    if (groupKey) {
      toActivate = this._nodes.get(groupKey);
      if (!toActivate) {
        console.warn('group not found', groupKey);
        return;
      }
    }
    let check = this._root._focused ?? this._root;
    // search focused to root or until we find self.
    while (check) {
      check = check._parent;
    }
    if (this._root._focused === toActivate) {
      return;
    }
    this._root._focused = toActivate;
    this._notify('onGroupChange'); // we don't notify the child
    this._notify('onActiveChange'); // we don't notify the child
  }

  /** {@inheritDoc ICommands.IGroup.findCommandByEvent} */
  findCommandByEvent(e: React.KeyboardEvent): ICommand | null {
    const modifiers = [];
    if (e.altKey) modifiers.push(KeyModifiers.Alt);
    if (e.shiftKey) modifiers.push(KeyModifiers.Shift);
    if (e.ctrlKey) modifiers.push(KeyModifiers.Ctrl);
    if (e.metaKey) modifiers.push(KeyModifiers.Meta);

    let asShortcutString = toShortcutString({
      key: e.code,
      modifiers: modifiers
    });
    const byShortcut = this._commandsByShortcut;
    let commandKey = byShortcut.get(asShortcutString);

    if (!commandKey) {
      asShortcutString = toShortcutString({
        key: e.key,
        modifiers: modifiers
      });
      commandKey = byShortcut.get(asShortcutString);
    }

    if (!commandKey && e.code.startsWith("Digit")) {
      asShortcutString = toShortcutString({
        key: (e.code.substring("Digit".length, e.code.length)),
        modifiers: modifiers
      });
      commandKey = this._commandsByShortcut.get(asShortcutString);
    }
    if (!commandKey && e.code.startsWith("Key")) {
      commandKey = toShortcutString({
        key: (e.code.substring("Key".length, e.code.length)),
        modifiers: modifiers
      });
      commandKey = byShortcut.get(asShortcutString);
    }

    let command: ICommand<any, any> = null;
    if (commandKey) {
      command = this._commandsByKey.get(commandKey);
      if (command && command.disabled()) {
        command = null;
      }
      if (command && (!command.getTarget() || !command.getTarget().contains(e.target as any))) {
        command = null;
      }
    }
    if (command) {
      return command;
    }
    return this._parent?.findCommandByEvent(e) ?? null;
  }

  /** {@inheritDoc ICommands.IGroup.dispatchToFocusedCommand} */
  dispatchToFocusedCommand(e: React.KeyboardEvent): boolean {
    // this._focused = e.target as Node;
    const focused = this.getActive()
    if (!focused) return false;

    if (e.isDefaultPrevented()) return false;
    const command = (focused as CommandGroup).findCommandByEvent?.(e);

    // Useful for debugging keystrokes
    // if (command) {
    //   console.log('commandNew', command, e);
    // } else if (e.code !== 'ShiftLeft' && e.code !== 'ControlLeft') {
    //   console.log('keyNew', e);
    // }

    if (!command)
      return false;

    // we need to allow these through for safari to allow copy paste events
    // if (command.getKey() !== 'copy' && command.getKey() !== 'paste' && command.getKey() !== 'cut') {
    //   console.log('prevent');
    //   e.preventDefault();
    command.execute();
    // e.stopPropagation();
    e.preventDefault();
    // }

    // fire afterCommand
    return true;
  }

  /** {@inheritDoc ICommands.IGroup.getRoot} */
  getRoot(): ICommands.IGroup {
    return this._parent ? this._parent.getRoot() : this;
  }

  /** {@inheritDoc ICommands.IGroup.getParent} */
  getParent(): ICommands.IGroup | null {
    return this._parent;
  }

  /** {@inheritDoc ICommands.IGroup.addListener} */
  addListener(listener: ICommands.IListener, options?: ICommands.IListenerOptions): RemoveListener {
    // This function takes a function that is called when a value is updated
    const listeners = this._listeners;
    const keys = options?.keys;
    const listenersByKey = this._root._listenersByKey;

    if (keys && !listener.onCommandChange) {
      throw new Error(`keys were provided but the listener does not contain 'onCommandChange'.`);
    }

    let setsRemove:Set<ICommands.IListener>[] = null;
    const removeListener:RemoveListener = (): void => {
      if (setsRemove) {
        const setsRemoveLength = setsRemove.length;
        for (let i=0; i<setsRemoveLength; i++) {
          const set = setsRemove[i];
          set.delete(listener);
        }
      }
      listeners.delete(listener);
    };
    if (keys) {
      const keysLength = keys.length;
      for (let i=0; i<keysLength; i++) {
        const key = keys[i];
        if (!key) continue; // ignore empty keys
        let set:Set<ICommands.IListener> = listenersByKey.get(key);
        if (!set) {
          set = new Set();
          listenersByKey.set(key, set);
        }
        if (!setsRemove) setsRemove = [];
        setsRemove.push(set);
        set.add(listener);
      }
    }
    listeners.add(listener);
    return removeListener;
  }

  // These are global
  protected _notifyCommands(listeners: Set<ICommands.IListener>, key: keyof ICommands.IListener, args?: any): void  {
    const _self = this;
    setTimeout(() => {
      listeners.forEach((listener: ICommands.IListener) => {
        listener[key]?.(_self, args);
      });
  }, 0);
  }

  // TODO - should this be global?
  protected _notify(key: keyof ICommands.IListener, args?: any): void  {
    const _self = this;
    setTimeout(() => {
      _self._listeners.forEach((listener: ICommands.IListener) => {
        listener[key]?.(_self, args);
      });
      if (_self._parent) {
        _self._parent._notify(key, args);
      }
  }, 0);
    // if (this._children) {
    //   this._children.forEach((child: CommandGroup) => {
    //     child._notify(key);
    //   });
    // }
  }

  /** {@inheritDoc ICommands.IGroup.getAllCommands} */
  getAllCommands(): { command: ICommand<any, any>, groupKey: string }[] {
    const retValue = [];
    const groupKey = this._groupKey;
    this._commandsByKey.forEach((value: ICommand<any, any>) => {
      retValue.push({ command: value, groupKey });
    });
    this._children.forEach((child: CommandGroup) => {
      retValue.push(...child.getAllCommands());
    });
    return retValue;
  }
}

const CTRL_KEY_DESCRIPTION = (CommonUtils.getOS() === CommonUtils.OSType.MacOS || CommonUtils.getOS() === CommonUtils.OSType.IOS) ? `Cmd` : `Ctrl`;
const CTRL_KEY_SYMBOL = (CommonUtils.getOS() === CommonUtils.OSType.MacOS || CommonUtils.getOS() === CommonUtils.OSType.IOS) ? `⌘` : `^`;


// TODO - move to ICommands namespace
export const toShortcutString = (keyStroke: IKeyStroke, modifierSymbol: boolean=false): string => {
  const modifiersAsMap = {};
  for (let i=0;keyStroke.modifiers && i<keyStroke.modifiers.length; i++)
    modifiersAsMap[keyStroke.modifiers[i]] = true;

  // Always the same order.
  let asString = '';
  if (modifiersAsMap?.[KeyModifiers.Ctrl] || modifiersAsMap?.[KeyModifiers.Meta])
    asString += (asString.length > 0 ? '+' : '') + (modifierSymbol ? CTRL_KEY_SYMBOL : CTRL_KEY_DESCRIPTION);
  if (modifiersAsMap?.[KeyModifiers.Alt])
    asString += (modifierSymbol ? '⌥' : 'Alt'); // Option on Mac/iOIS, also different icon
  if (modifiersAsMap?.[KeyModifiers.Shift])
    asString += (asString.length > 0 ? '+' : '') + (modifierSymbol ? '⇧' : 'Shift');
  // if (modifiersAsMap?.[KeyModifiers.Meta])
  //   asString += (asString.length > 0 ? '+' : '') + (modifierSymbol ? '⌘' : 'Cmd');

  // Todo - Use the unshifted keyCode ()
  asString += ((asString.length > 0 ? '+' : '') + toPrettyKeyCode(keyStroke.key));
  return asString;
}