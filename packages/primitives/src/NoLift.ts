/**
 * Declares that a SCALAR parameter refuses a multi-cell REFERENCE with `#VALUE!` instead of
 * broadcasting over it.
 *
 * The native functions lift: `ROUND(B1:B3,3)` spills three results. Excel's Analysis-ToolPak
 * heritage refuses at the slot instead — `EDATE(A1:A3,1)` is `#VALUE!` — and the refusal is per
 * PARAMETER: `NETWORKDAYS.INTL` refuses a reference at its two date slots and lifts one at its
 * `weekend` slot. Three qualifications:
 *
 * | argument at the slot | answer |
 * | --- | --- |
 * | a multi-cell REFERENCE, `A1:A3` | `#VALUE!` — the call never runs |
 * | an ARRAY, `{3,4,5}` | lifts as usual (`MROUND({3,4,5},5)` spills) |
 * | a one-cell reference or a value | an ordinary argument |
 *
 * Only a scalar slot can lift, so the marker means nothing on a range, list or lambda parameter
 * and the linter refuses it there. A REPEATING scalar slot is also never this marker's business —
 * it absorbs a container as members whatever the function's heritage (`GCD(C1:C3)` is 4); its
 * ATP reading is `NoFilter<T>`.
 *
 * At the type level it is `T`.
 *
 * @example
 * ```ts
 * export function NETWORKDAYS_INTL(
 *   startDate: NoLift<Scalar>, endDate: NoLift<Scalar>, weekend?: Scalar, holidays?: Flatten<Scalar>
 * ): number { ... }
 * ```
 */
export type NoLift<T> = T;
