/**
 * Declares a REPEATING PARAMETER GROUP: one declared parameter whose arguments arrive as a
 * fixed-size cycle repeated N times. `SUMIFS(sum, r1, c1, r2, c2, …)` is one `sumRange` followed
 * by a `[criteriaRange, criteria]` group repeated as many times as the caller supplied.
 *
 * At the type level it is `T[]`, so the body reads exactly what it is handed:
 *
 * | declaration | period | body receives |
 * | --- | --- | --- |
 * | `Repeating<[a: IRange, b: Scalar]>` | 2 | `[IRange, Scalar][]` |
 * | `Repeating<IRange>` | 1 | `IRange[]` |
 *
 * **Period 1 is spelled without the tuple** — a one-element tuple is a compiler error, because
 * `[IRange][]` and `IRange[]` would otherwise be two ways to say the same thing. A period-1 group
 * takes its slot name from the parameter itself, so `array: Repeating<IRange>` shows as
 * `array1, array2, …` — the same display a rest parameter gets, and the reason `Repeating` can
 * replace the `first + ...rest` split that reads as `array, rest1, rest2`.
 *
 * ### Why this exists rather than a rest parameter
 *
 * `...rest: T[]` has ONE type for every trailing argument, so a period-2 group has to declare its
 * slots as their union — which makes the criteria slots of pairs 2+ invisible to every consumer
 * that reads the declaration per position. The implicit-intersection site predicate is the one
 * that matters: it saw `SUMIFS`'s criteria as a range parameter and under-marked the formula.
 * A group binds argument `i` to slot `(i − prefix) % period`, so every repetition types the same
 * as the first.
 *
 * A group also carries a real MINIMUM: at least one repetition is required. That is the whole
 * difference from a rest parameter, which is 0-or-more and remains the spelling for it:
 *
 * ```ts
 * ...x: T[]                    // 0 or more
 * x: T[]                       // 1 or more  (a period-1 group; an array IS a repeat of one)
 * x: Repeating<[a: A, b: B]>   // 1 or more, period 2+
 * ```
 *
 * So `x?: T[]` is refused — it would be a second way to say `...x: T[]`.
 *
 * ### Arity is arithmetic, never type-directed
 *
 * `n = (argc − prefix − suffix) / period`, and a non-zero remainder is an error.
 *
 * ### The one short form
 *
 * The LAST slot of a group may be declared optional, which means exactly one thing: it may be
 * omitted when there is a single repetition. `SORTBY`'s legal arities are 2 and 1+2n and nothing
 * else — `SORTBY(array, by1)` is legal, `SORTBY(array, by1, o1, by2)` is not. It is not a general
 * "the final element of the final group may be omitted" rule; that rule would accept a formula
 * that must be refused. An optional slot anywhere else in the group is a compiler error.
 *
 * ### The maximum, `Max`
 *
 * The second type argument is the largest number of arguments the WHOLE CALL accepts: one
 * number per NAME, compared against the call's total argument count and
 * refused at entry (`Excess_function_arguments`), never a count of this parameter's own share.
 * `SWITCH`'s 254 therefore covers its `expression` and its trailing `default` as well as the
 * pairs, and `CHOOSEROWS`' covers its `array`.
 *
 * It defaults to **255**, which is the ceiling for most names and the highest any name carries.
 * Declare it only where a name draws the line lower — `XOR`, `IFS`, `SWITCH`, `LAMBDA`, `LET`,
 * `AGGREGATE`, `SORTBY`, `MAXIFS`, `MINIFS`, `CONCAT`, `TEXTJOIN`, `HSTACK`, `VSTACK`,
 * `CHOOSEROWS`, `CHOOSECOLS` and every DOTTED
 * descriptive spelling (`STDEV.S`, `VAR.P`, `MODE.MULT`, …) all stop at 254 where their legacy
 * twins take 255. It cannot be derived from the shape, so it belongs to the declaration.
 *
 * A REST parameter is the one place `Repeating` may be written alongside `...`, and only with an
 * explicit `Max`: `...rest: Repeating<T, 254>` keeps the rest parameter's own 0-or-more meaning
 * and adds nothing but the ceiling. A bare `Repeating<T>` on a rest parameter stays an error —
 * that is the spelling collision the marker exists to avoid.
 *
 * @example
 * ```ts
 * export function SUMIFS(
 *   sumRange: IRange,
 *   criteria: Repeating<[criteriaRange: IReferenceRange, criteria: AcceptError<Scalar>]>
 * ): IRange {
 *   for (const [range, test] of criteria) { ... }
 * }
 *
 * export function HSTACK(array: Repeating<IRange, 254>): IRange {
 *   return array.reduce((acc, next) => acc.concat(next, IRange.Axis.Column));
 * }
 * ```
 */
export type Repeating<T, Max extends number = 255> = T[];
