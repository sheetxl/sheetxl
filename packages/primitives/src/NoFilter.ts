/**
 * Declares that the members reaching a REPEATING scalar parameter are COERCED rather than
 * filtered — one that cannot be coerced is `#VALUE!` for the whole call.
 *
 * The native functions FILTER: `SUM({1,"8",TRUE})` is 1, the text and the boolean skipped, and a
 * blank cell contributes nothing. Excel's Analysis-ToolPak heritage coerces at the slot instead,
 * and the difference is visible in both directions:
 *
 * | argument | native (`SUM`) | this marker (`GCD`) |
 * | --- | --- | --- |
 * | numeric text, `{6,"8",12}` | skipped | parses — `GCD({6,"8",12})` is 2 |
 * | a boolean, `{6,TRUE,12}` | skipped | `#VALUE!` for the whole call |
 * | a blank inside a multi-cell range | skipped | reads 0 — `LCM(6,A1:A2)` is 0 |
 *
 * A DIRECT argument follows the same rule (`GCD(6,TRUE,12)` is `#VALUE!` where `SUM(6,TRUE,12)`
 * is 19). A one-cell blank reference and an omitted argument are still skipped either way: they
 * never became members.
 *
 * Only a repeating slot has members to filter, so the marker means nothing on a plain scalar,
 * range or lambda parameter and the linter refuses it there. It is the repeating counterpart of
 * {@link NoLift}, which is the same heritage's reading of a NON-repeating scalar slot.
 *
 * It may be written over the group or on the slot — `NoFilter<number[]>` and `NoFilter<number>[]`
 * mean the same thing, as they do for `AcceptError`.
 *
 * At the type level it is `T`.
 *
 * @example
 * ```ts
 * export function GCD(number: NoFilter<number>[]): number { ... }
 * ```
 */
export type NoFilter<T> = T;
