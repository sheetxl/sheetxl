/**
 * Declares what a parameter means when the caller supplies it EMPTY — `FIXED(1.5,)`, a comma with
 * nothing before it.
 *
 * @remarks
 * A spreadsheet argument has three positions rather than two, and each carries its own meaning:
 *
 * | call | position | the parameter receives |
 * | --- | --- | --- |
 * | `FIXED(1.5)` | absent | nothing, so the parameter's own initializer applies |
 * | `FIXED(1.5,)` | omitted | whatever this marker declares |
 * | `FIXED(1.5,E1)` | a blank cell | the value `0` / `false` / `""` |
 *
 * The last row is why omission needs a declaration of its own. A blank cell is a VALUE the caller
 * supplied and coerces like any other, so "empty" cannot simply mean "unspecified" everywhere —
 * and functions disagree about which of the two an empty comma resembles.
 *
 * Undeclared, an omitted argument coerces exactly as a blank cell does. Declared, it means `V`
 * where one is given, and otherwise means whatever an absent argument means.
 *
 * @typeParam T - the parameter's type; the marker is otherwise transparent.
 * @typeParam V - what an omitted argument means, where that differs from the absent default.
 *
 * @example An omitted argument means the default, and one initializer serves both positions.
 * ```ts
 * export function FIXED(number: number, decimals: Omittable<number> = 2): string
 * ```
 *
 * @example An omitted argument means something else, so both values are spelled out.
 * ```ts
 * // absent is 1 (approximate); omitted is 0 (exact)
 * export function MATCH(lookupValue: IRange, lookupArray: IRange,
 *   matchType: Omittable<number, 0> = 1): Scalar
 * ```
 *
 * @example An omitted argument is not a value at all, and the body answers for it. Without an
 * initializer to fall back on, the parameter is REQUIRED and the omission reaches it as
 * `undefined` — which is a different thing from the `null` a blank cell coerces to.
 * ```ts
 * export function WEEKNUM(serialNumber: Omittable<Scalar>, returnType: Omittable<Scalar> = 1): number
 * ```
 *
 * Supplying `V` leaves the parameter's type untouched; leaving it off adds `undefined`, so a
 * declaration carrying an initializer sees a plain `T` while one without it is made to handle the
 * omission.
 *
 * @see {@link IFunction.ParameterTypeJSON.omittable}
 */
export type Omittable<T, V = never> = [V] extends [never] ? T | undefined : T;
