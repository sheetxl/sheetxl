/**
 * Declares a parameter the engine may hand over UNEVALUATED — the argument's subtree is not run
 * before the call, and it runs only if this call's answer needs it.
 *
 * @remarks
 * An argument that is a bare reference has always been cheap to ignore: it resolves into a
 * register and a body that never reads it never dereferences it. An argument that is an
 * EXPRESSION is not — `IF(FALSE,B1+1,1)` evaluates `B1+1` before `IF` runs, so the untaken branch
 * opens `B1` anyway. That is a correctness difference and not a cost one: a read is what decides
 * a circular reference and what registers a volatile, so an arm nobody takes can report a cycle
 * the sheet does not have.
 *
 * The marker is what closes it, and it is a CONTRACT rather than an inference. Nothing in
 * JavaScript intercepts a plain parameter read, so a body holding a deferred value is only safe
 * while it never touches it — which the declaration has to say out loud:
 *
 * ```ts
 * export function IF(
 *   logicalTest: boolean,
 *   valueIfTrue: Lazy<AcceptError<any>>,
 *   valueIfFalse: Lazy<AcceptError<any>, false>
 * ): any {
 *   return logicalTest ? valueIfTrue : valueIfFalse;
 * }
 * ```
 *
 * The parameter is ALWAYS an {@link ILazy} handle and never a union with the bare value, so the
 * body has two things it may do with it and the type says which is which:
 *
 * - **return it unread**, which is what every branch-selecting function does. The engine
 *   recognizes its own handle coming back as the call's result and evaluates that subtree then.
 * - **read it** with {@link ILazy.getValue}, which forces the subtree in place. Synchronous only:
 *   the engine is mid-formula there and has no way to wait, so an ASYNC subtree at a forced
 *   handle is an error rather than a wrong answer.
 *
 * Only the RESULT positions are marked. A condition, an index and a case value are eager, which
 * is what keeps `AND(FALSE,A1)` a circular reference: laziness is a property of what the function
 * READS, not of the syntax around it.
 *
 * The engine may DECLINE to defer at any time and hand the body a handle that is already full —
 * an absent argument, an async subtree, a lift that needs every arm anyway. `getValue()` then
 * returns the value it was built with. The author cannot tell the two apart and must not try.
 *
 * @typeParam T - what the argument evaluates to; the marker is otherwise transparent.
 * @typeParam V - what an ABSENT argument means, as a literal. It replaces the `= false`
 *   initializer an ordinary parameter would carry, which cannot typecheck against a handle;
 *   declaring it makes the parameter optional and the engine supplies the value, so the body
 *   still sees nothing but a handle.
 *
 * @see {@link IFunction.ParameterTypeJSON.lazy}
 */
export type Lazy<T, V = never> = ILazy<T | V>;

/**
 * The handle a {@link Lazy} parameter receives: an argument's subtree, anchored at the calling
 * cell, that has either not been evaluated yet or has been evaluated already.
 *
 * @remarks
 * The brand exists for the same reason {@link Lambda}'s does — the value-layer sites (coercion,
 * the operators, a range's typed read, a cell's final value) RECOGNIZE a handle and refuse it, so
 * that one can never reach a grid, a spill or a named-formula result. A handle is only ever a
 * live call's argument.
 */
export interface ILazy<T = any> {
  /** The brand itself — the property every recognizing site reads. */
  readonly isLazy: true;
  /**
   * Evaluates the argument and answers its value, forcing the subtree where the engine deferred
   * it and answering the value it already has where it declined to.
   *
   * Forced at most once: a second call answers the same value.
   */
  getValue(): T;
}

/** `true` for a deferred-argument handle — see {@link ILazy}. */
export const isLazyValue = (value: unknown): value is ILazy =>
  value !== null && typeof value === 'object' && (value as ILazy).isLazy === true;
