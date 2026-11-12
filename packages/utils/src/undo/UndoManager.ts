import { type RemoveListener } from '../types';

/*
 TODO -
  1. We should have the max be a function of size of operations
*/

/**
 * Indicates that an option is repeatable.
 */
export interface IRepeatableOperation {
  /**
   * A human readable description of the operation.
   */
  readonly description: string;
  /**
   * Repeat the operation.
   */
  repeat(): void;
}

/**
 * An operation that can be undone.
 */
export interface IUndoOperation {
  /**
   * A human readable description of the operation.
   */
  readonly description: string;
  /**
   * The size of the undo operation. This allows the undo stack to be based on the operation size NOT the stack size.
   * For example a very large write operation will take more memory than many small ones.
   */
  readonly size?: number;
  /**
   * Undo the operations
   *
   * @returns redo function or void if not re-doable
   */
  undo(): (() => void) | void;
}

/**
 * One entry of the undo or redo stack, as a view shows it.
 */
export interface UndoEntry {
  /**
   * What the entry did. May be a message key; resolve it for display (`t()` passes plain text through).
   */
  readonly description: string;
  /**
   * Who made it, when the stack knows (`'user'`, `'agent'`, `'macro'`, or a collaborator). `null` when
   * it does not.
   */
  readonly author: string | null;
  /**
   * What was recorded with the entry — `command` is the key of the command that made it, when one did.
   */
  readonly meta: Readonly<Record<string, string>>;
}

export interface IUndoManagerListener {
  // onUndo?(): void;

  // onRedo?(): void;

  onStackChange?(): void;
}

/*
 * Internal interface for tracking undo/redos.
 *
 * @internal @hidden
 */
interface OperationHandler {
  description: string;
  undo: () => (() => void) | void;
  redo: (() => void) | void | null;
}

/**
 * A stack of undo/redo actions.
 */
export class UndoManager {

  private _listeners: Set<IUndoManagerListener>; //WeakSet;
  private _maxStack: number;

  private _undoStack: OperationHandler[];
  private _redoStack: OperationHandler[];

  /** protected so derived managers (e.g. log-backed ones) can honor repeat-when-no-redo */
  protected _repeatOperation: IRepeatableOperation | null

  private _undoDescriptions: readonly string[] | null = null;
  private _redoDescriptions: readonly string[] | null = null;

  /**
   * Creates a new undo manager.
   *
   * @remarks
   * By default the stack is limited to 100 items to match Excel. This can be changed by setting the maxStack argument.
   */
  constructor(maxStack: number=100) {
    this._maxStack = maxStack;
    this._undoStack = [];
    this._redoStack = [];
    this._repeatOperation = null;
    this._listeners = new Set();
  }

  get maxStack(): number {
    return this._maxStack;
  }

  /**
   * Undo the last actions on the stack.
   *
   * @param count number of actions to undo, default is 1.
   */
  undo(count: number=1): void {
    if (this._undoStack.length === 0)
      return;
    let notify = false;
    try {
      // for each item on the stack. Pop it off of the stack and
      for (let i=0;i<count && this._undoStack.length > 0 ;i++) {
        const handler = this._undoStack[this._undoStack.length-1];
        handler.redo = handler.undo();
        this._undoStack.pop(); // after action incase of error
        if (typeof handler.redo === 'function')
          this._redoStack.push(handler);
        else
          this._redoStack = [];
        notify = true;
      }
    } catch (error: any) {
      throw error;
    } finally {
      if (notify)
        this._notifyOnStackChange();
    }
  }

  /**
   * Redo the last redo actions on the stack.
   *
   * @param count number of actions to undo, default is 1.
   *
   * @remarks
   * The redo stack a list of all items that have an undo.
   * Adding another item to the undo stack
   */
  redo(count: number=1): void {
    // move back to undo
    if (this._redoStack.length === 0) {
      if (this._repeatOperation !== null) {
        this._repeatOperation.repeat();
      }
      return;
    }
    let notify = false;
    try {
      // for each item on the stack. Pop it off of the stack and
      for (let i=0;i<count && this._redoStack.length > 0 ;i++) {
        const handler = this._redoStack[this._redoStack.length-1];
        // only handlers whose undo returned a redo function are pushed onto the redo stack
        (handler.redo as () => void)();
        this._redoStack.pop(); // after action incase of error
        this._undoStack.push(handler);
        notify = true;
      }
    } catch (error: any) {
      throw error;
    } finally {
      if (notify)
        this._notifyOnStackChange();
    }
  }

  /**
   * Returns `true` if there are undo actions on the stack.
   */
  hasUndo(): boolean {
    return this._undoStack.length > 0;
  }

  getTopUndoDescription(): string | null {
    if (this._undoStack.length === 0)
      return null;

    return this._undoStack[this._undoStack.length-1].description;
  }

  /**
   * Returns `true` if there are redo actions on the stack.
   *
   * @remarks
   * These can be either as a result of an undo or a repeatable action.
   */
  hasRedo(): boolean {
    return this._redoStack.length > 0 || this._repeatOperation !== null;
  }

  getTopRedoDescription(): string | null {
    if (this._repeatOperation !== null)
      return this._repeatOperation.description;

    if (this._redoStack.length === 0)
      return null;

    return this._redoStack[this._redoStack.length-1].description;
  }

  getUndoDescriptions(): readonly string[] {
    if (this._undoDescriptions)
      return this._undoDescriptions;

    const descriptions = [];
    for (let i=this._undoStack.length-1;i>=0;i--) {
      descriptions.push(this._undoStack[i].description);
    }
    this._undoDescriptions = descriptions;
    return this._undoDescriptions;
  }

  getRedoDescriptions(): readonly string[] {
    if (this._redoDescriptions)
      return this._redoDescriptions;

    const descriptions = [];
    for (let i=this._redoStack.length-1;i>=0;i--) {
      descriptions.push(this._redoStack[i].description);
    }
    if (descriptions.length === 0 && this._repeatOperation !== null)
      descriptions.push(this._repeatOperation.description);
    this._redoDescriptions = Object.freeze(descriptions);
    return this._redoDescriptions;
  }

  /**
   * The undo stack, most recent first, with what is known about each entry. Parallel to
   * {@link getUndoDescriptions}.
   *
   * @remarks
   * This stack records descriptions only; a stack over a richer log overrides this to report who
   * made each entry and what was recorded with it.
   */
  getUndoEntries(): readonly UndoEntry[] {
    return this.getUndoDescriptions().map(toEntry);
  }

  /** The redo stack (or the repeatable action), next first. Parallel to {@link getRedoDescriptions}. */
  getRedoEntries(): readonly UndoEntry[] {
    return this.getRedoDescriptions().map(toEntry);
  }

  /**
   * Add an undo operation to the stack.
   */
  addUndoOperation(operation: IUndoOperation): void {
    const handler: OperationHandler = {
      description: operation.description,
      undo: operation.undo,
      redo: null
    }
    this._undoStack.push(handler);
    this._redoStack = [];

    // remove if more than max
    if (this._undoStack.length > this._maxStack) {
      this._undoStack.shift();
    }
    this._notifyOnStackChange();
  }

  /**
   * Sets repeatable action.
   *
   * @remarks
   * A repeatable action is an action that a user can do multiple times 'usually on various selections'. For example styling a field
   * adding a similar operation to the undo stack is usually expected and has to be done done separately by the caller.
   *
   * * Clears the redo stack and does NOT add this operation to the undo stack.
   */
  setRepeatableOperation(operation: IRepeatableOperation | null): void {
    this._repeatOperation = operation ?? null;
    this._redoStack = [];
    this._notifyOnStackChange();
  }

  /**
   * Clear the stack.
   */
  clear(notify: boolean=true): void {
    this._undoStack = [];
    this._redoStack = [];
    this._repeatOperation = null;

    this._undoDescriptions = null;
    this._redoDescriptions = null;
    if (notify)
      this._notifyOnStackChange();
  }

  addListener(listener: IUndoManagerListener): RemoveListener {
    // This function takes a function that is called when a value is updated
    const listeners = this._listeners;
    const removeListener:RemoveListener = (): void => {
      listeners.delete(listener);
    };
    listeners.add(listener);
    return removeListener;
  }

  protected _notifyOnStackChange(): void  {
    this._undoDescriptions = null;
    this._redoDescriptions = null;
    this._listeners.forEach((listener: IUndoManagerListener) => {
      listener.onStackChange?.();
    });
  }
}

const NO_META: Readonly<Record<string, string>> = Object.freeze({});
const toEntry = (description: string): UndoEntry => ({ description, author: null, meta: NO_META });
