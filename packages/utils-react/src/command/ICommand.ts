/**
 * Shared command value types.
 */
export namespace ICommand {
  /**
   * Used to interact with a dom element.
   *
   * @remarks
   * * When dispatching keystrokes the target is used to determine if the keystroke
   * can be consumed by the element.
   * * Many commands will refocus the target after they have completed. The target focus will be called.
   */
  export interface ITarget extends HTMLElement {
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

  export type DynamicContext<CONTEXT> = CONTEXT | (() => CONTEXT);
  export type DynamicValue<T, CONTEXT> = T | ((context?: DynamicContext<CONTEXT>) => T);
}
