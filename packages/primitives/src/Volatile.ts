/**
 * Declares that a function's RESULT can change with nothing dirty, so a cell naming it
 * recalculates on every pass.
 *
 * ```ts
 * export function NOW(): Volatile<number> { ... }
 * ```
 *
 * @see {@link IFunction.ReturnTypeJSON.volatile}
 */
export type Volatile<T> = T;
