/* cspell:ignore COUNTA SERIESSUM */
/**
 * The one parameter marker that speaks about errors — and it is a RULE, not quite a type. At the
 * type level it is an identity alias (what arrives at any slot may already be an error — `Scalar`
 * says so in its own definition); the marker says the ENGINE DOES NOT AUTO-REJECT a bare error at
 * this slot: it is delivered raw, and the body decides.
 *
 * **There are two kinds of error, and the marker is about the first only:**
 *
 * 1. an error *instead of* a value or a range — `NA()`, an unresolvable name (`#NAME?`), a
 *    union `(A1,C1)` where one rectangle is needed;
 * 2. an error *inside* a range — a cell or member holding `#N/A`.
 *
 * The engine never delivers the first unless the slot declares {@link AcceptError} — any `T`,
 * one meaning. Without the marker the error propagates with its identity (`#N/A` stays `#N/A`)
 * and the body never runs: as the call's answer for a scalar argument, as an error MEMBER of the
 * output under a lift, as the first error in argument order for a flattened list. The single
 * exception needs no marker: a `FormulaError.Known`-typed parameter receives errors because the
 * type declares it.
 *
 * The second is never the engine's business. A valid range is handed over whole, marker or no
 * marker, and a body that cares asks:
 *
 * ```ts
 * if (range.hasError()) return range.firstError();
 * ```
 *
 * placed before its own validation where the member's error outranks it (`LARGE(range-with-#N/A, 0)`
 * is `#N/A`, not `#NUM!`). Aggregators and consumers say it; reshapers and lookups, whose members
 * pass through or are never read, need no line at all. Where a function takes several ranges the
 * lines run in ARGUMENT order — the whole of argument N before N+1, row-major within — which is
 * the which-error-wins order, and a function that pairs its ranges (the paired
 * statistics) orders its own scan the way it pairs.
 *
 * > *A bare error propagates unless your function opts in to seeing it; the members of a range
 * > are yours.*
 *
 * There is no marker for the default. A `RejectError<T>` alias existed and declared nothing the
 * engine did not already do, so it was removed rather than left as a second way to say nothing.
 * `AcceptRefError<T>`, which split the policy by argument shape, retired with the engine's member
 * scan: its range form is this default, and its scalar form (the database `field`) is a range
 * slot whose body reads the one cell.
 */

/**
 * The engine does not auto-reject a bare error at this parameter: it is delivered RAW — a
 * `FormulaError.Known`, never boxed as a 1×1 range — and the body narrows with
 * `FormulaError.isError` (if it cares). A raw error is therefore never confusable with a
 * one-cell range holding an error MEMBER: the two kinds this file keeps apart stay apart in the
 * value itself, and members are no engine concern at all. For the functions whose job is to
 * inspect, replace, or count errors — the IS* family, IFERROR, ERROR.TYPE, TYPE, COUNT and
 * COUNTA — for the binders (`LET`, `LAMBDA`), whose value slots carry an argument unevaluated,
 * and for a body that owns a reading ORDER or a LIFT the engine cannot see (SERIESSUM's
 * coefficients; CONCATENATE broadcasts the error over its lifted ranges, so the SHAPE of the
 * answer is the marker's work).
 *
 * On a TYPED range parameter (`IRange<number>`) the marker also lets error members and failed
 * coercions ride through the typed read as raw members — COUNT ignores them, COUNTA counts them.
 * On an untyped range it changes nothing about members: they arrive raw either way.
 *
 * @example
 * ```ts
 * export function ISERROR(value: AcceptError<Scalar>): Scalar { ... }
 * export function IFERROR(value: AcceptError<Scalar>, valueIfError: AcceptError<Scalar>): Scalar { ... }
 * // Both parameters: an unused error fallback must pass through untouched (IFERROR(5,NA()) → 5).
 * export function COUNT(number: AcceptError<IRange<number>>[]): number { ... }
 * // COUNT(NA()) is 0: the error is a value, and not a number.
 * ```
 */
export type AcceptError<T> = T;
