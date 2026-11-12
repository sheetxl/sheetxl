import { type Scalar } from './Scalar';
import { type ValueKind } from './ValueKind';
import { type IRange } from './IRange';
import { type Lambda } from './Lambda';
import { type IFunction } from './IFunction';

/**
 * The current call's arguments, as the body sees them — argument **reflection**.
 *
 * @remarks
 * A declaration answers "what does this parameter mean?", and the marshaller coerces every
 * argument to it. That is right for the overwhelming majority of parameters. What it cannot answer
 * is anything about *this particular call*:
 *
 * - What did the caller write there — a value, a cell, an array, nothing at all?
 * - What was the value BEFORE the parameter's type coerced it?
 * - Was that empty slot an omission, or a blank cell the caller pointed at?
 *
 * Some functions have behaviors that turn on exactly those questions, and they cluster at
 * parameters declared `any` — where there is nothing to express as a type. `CUMIPMT` refuses a boolean at every slot while `FV` coerces one at
 * every slot; the difference is not the values, it is that `CUMIPMT`'s slots are `any` and its
 * body decides.
 *
 * It is REFLECTION and nothing else — two questions, and no third:
 *
 * | question | answers |
 * | --- | --- |
 * | *what was supplied* | {@link getLength}, {@link getKindAt} |
 * | *what it is* | {@link getRawAt}, {@link getKindAt} |
 *
 * Coercion is deliberately absent. A body that wants a number calls
 * {@link IFormulaContext.parseAsNumber} on the value this hands it — that already takes a value,
 * already propagates an incoming error with its identity, and already answers `#VALUE!` for a
 * boolean, which IS the rule an `any` slot needs. There is no coercion an index can do that a
 * value cannot.
 *
 * Obtained from `FormulaContext.getArgs()`, and valid ONLY while the body that asked for it is
 * running. A body must not retain it across an `await`, a callback, or a nested evaluation — the
 * views are pooled by dispatch depth, so the one at your depth is handed to the next call at that
 * depth.
 *
 * ```typescript
 * export function CUMIPMT(rate: Scalar, nper: Scalar): number {
 *   const args = FormulaContext.getArgs();
 *   if (args.getKindAt(0) === ValueKind.Omitted) return FormulaError.BuiltIn.NA; // `CUMIPMT(,120,…)`
 *   const asNumber = FormulaContext.parseAsNumber(args.getRawAt(0) as Scalar);  // TRUE is #VALUE!
 *   // …
 * }
 * ```
 *
 * @see {@link IFormulaContext.getArgs}
 */
export interface IFunctionArguments {
  /**
   * How many PARAMETERS the caller supplied.
   *
   * @remarks
   * Indexing throughout matches the BODY's own signature, never the raw call positions
   * (see {@link getRawAt}). `index >= getLength()` is an ABSENT argument — one the caller never
   * wrote, whose own JS initializer supplied the value. That is a different thing from an OMITTED
   * one; see {@link isOmittedAt}.
   */
  getLength(): number;

  /**
   * This invocation's value at `index`, uncoerced.
   *
   * @param index The PARAMETER index — the position in the body's own signature.
   *
   * @remarks
   * A `Scalar` means the argument IS a value; an {@link IRange} means a container whose members
   * the body reads itself (a reference materializes on demand); a {@link Lambda} means a callable.
   *
   * At a REPEATING parameter (`Repeating<T>`, or a rest parameter) this is the ARRAY of that
   * group's values — one entry per argument the caller wrote — and {@link getRepeatingArgsAt} is the
   * per-argument view of the same thing. Indexing by parameter rather than by call position is
   * what lets a body ask its questions in the vocabulary it declared:
   *
   * ```typescript
   * // IFS(condition: Repeating<[logicalTest: boolean, logicalTrue: AcceptError<any>]>)
   * args.getRawAt(0);                       // [test1, value1, test2, value2, …]
   * args.getRepeatingArgsAt(0).getRawAt(0);     // test1
   * ```
   *
   * **Under a lift** the call broadcasts and the body runs once per output cell; this reports the
   * value for THIS invocation — the member at the current broadcast position for a lifted argument,
   * the whole argument for one that is not lifting. That is what every identified caller wants: a
   * body checking for a boolean must see the member, not the array around it.
   *
   * One boundary is worth knowing: under a lift at a parameter that declares a CONCRETE scalar
   * type, the member has already been converted by that declaration, so the raw and coerced answers
   * coincide there. At the `Scalar` slots this interface exists for, nothing coerces and the value
   * is the member exactly as the caller's range holds it.
   *
   * A reference UNION (`(A1:A3,C1:C3)`) is an array too — one `IReferenceRange` per area — which
   * is how a body whose slot took the areas apart can still tell one argument's union from two
   * arguments (`SUMPRODUCT` refuses the first and accepts the second).
   */
  getRawAt(index: number): IFunctionArguments.RawArg | IFunctionArguments.RawArg[];

  /**
   * A nested view over one REPEATING parameter's arguments, so a body can ask the same questions
   * one level down — `getRepeatingArgsAt(0).isOmittedAt(1)`.
   *
   * @param index The PARAMETER index of the repeating group (or rest parameter).
   *
   * @remarks
   * The nested view is FLAT over the group's arguments: a period-2 group repeated three times reads
   * as six, in call order. That is where "which one was omitted" has an answer at all — the group
   * as a whole cannot be omitted, only one of its arguments can.
   *
   * At a non-repeating parameter this returns an EMPTY view (`getLength()` of 0) rather than
   * throwing, so a body that folds over its groups needs no special case.
   */
  getRepeatingArgsAt(index: number): IFunctionArguments;

  /**
   * The KIND of the argument at `index` — the total discriminator over {@link getRawAt}'s value.
   *
   * @param index The PARAMETER index — the position in the body's own signature.
   *
   * @remarks
   * Every raw argument is exactly one of a closed set of kinds ({@link ValueKind}), and this
   * answers without materializing anything — a reference stays coords underneath. The scalar
   * kinds ARE `ScalarType` values, so `getKindAt(i) === ScalarType.Boolean` reads naturally.
   *
   * Under a lift this reports THIS invocation's value, like {@link getRawAt} — except the
   * {@link ValueKind.Omitted} answer, which is a fact about the CALL (the caller wrote an empty
   * comma) and does not change per broadcast position. At a REPEATING parameter it answers for
   * the group's FIRST argument; per-argument kinds are one level down —
   * `getRepeatingArgsAt(i).getKindAt(j)`.
   *
   * There are THREE argument positions:
   *
   * | form | position | answer |
   * | --- | --- | --- |
   * | `CUMIPMT(0.01,120,100000,13,24)` | never wrote a 6th | `Omitted` here — the POSITION fact is {@link getLength} (`index >= getLength()`), not a kind |
   * | `CUMIPMT(,120,100000,13,24,0)` | the empty comma | {@link ValueKind.Omitted} |
   * | `CUMIPMT(…,E1)`, E1 blank | a blank CELL | {@link ValueKind.Reference} — blankness is the cell's value, not the argument |
   *
   * The kind is the argument's own and it survives what it passes through:
   * `VLOOKUP(10,10,1,TRUE)` is `#N/A` where `VLOOKUP(10,{10},1,TRUE)` is 10 — scalar vs 1x1
   * array; `TYPE(IF(TRUE,10))` is 1 where `TYPE(IF(TRUE,{10}))` is 64 — a selector carries the
   * kind through in both directions.
   */
  getKindAt(index: number): ValueKind;

  /**
   * True when the argument at `index` is DIRECT — typed into the list of arguments:
   * the evaluated value IS a value, not a container or a callable.
   *
   * @param index The PARAMETER index — the position in the body's own signature.
   *
   * @remarks
   * The derived predicate over {@link getKindAt}: true exactly when the kind is one of the
   * `ScalarType` members. A blank (`ScalarType.Null`) IS a value and is direct; an omitted
   * argument, a reference, an array and a callable are not. Directness is what the
   * direct-vs-member coercion rules key on (`SUM(1,TRUE)` is 2 where `SUM({1,TRUE})` is 1), so
   * a body speaking that vocabulary can ask in it.
   */
  isDirectAt(index: number): boolean;

  /**
   * How many AREAS the argument at `index` covers — 1 for an ordinary reference, more for a
   * union (`(A1:A5,B1:B2)`), and 0 for anything that is not a reference at all.
   *
   * @param index The PARAMETER index — the position in the body's own signature.
   *
   * @remarks
   * {@link getKindAt} deliberately cannot answer this: a union IS a reference and reports
   * {@link ValueKind.Reference}, the same as `A1:A5`. This is the question a body asks when the
   * union is the thing it must decide about, and the three possible answers all come from asking
   * it — flatten every area, refuse, or `#REF!`.
   *
   * Only a {@link IFunction.ParameterTypeJSON.reportType} slot can see a union at all; at every
   * other slot the marshaller has already answered `#VALUE!`.
   */
  getAreaCountAt(index: number): number;

  /**
   * The functions the argument at `index` holds, in row-major order — or `null` unless it holds
   * nothing but functions.
   *
   * @param index The PARAMETER index — the position in the body's own signature.
   *
   * @remarks
   * A formula can pass a function as a value: `LAMBDA(x, x * 2)`, or a built-in by name, as `SUM`
   * is in `BYROW(A1:C3, SUM)`. A `Lambda` parameter takes ONE such value. This is for an untyped
   * parameter that also takes an ARRAY of them, as `HSTACK(SUM, AVERAGE)` makes.
   *
   * The argument's shape is its own: {@link getKindAt} is `Lambda` for one function and `Array`
   * for several, and {@link getRawAt} is that array. A function value IS an {@link IFunction}: a
   * built-in by name answers as the registry's function does, and a `LAMBDA` is one whose
   * {@link IFunction.isLambda} is `true`. A body whose untyped parameter holds the value reads the
   * functions from it directly; this is reflection, for when the declaration does not hand it over.
   *
   * Nothing is collected until every member has proved to be a function, so a data range given by
   * mistake costs one member.
   */
  getFunctionsAt(index: number): readonly IFunction[] | null;

}

/**
 * {@inheritDoc IFunctionArguments}
 *
 * @see
 * ### **Interface**
 *
 * {@link IFunctionArguments}
 */
export namespace IFunctionArguments {
  /**
   * One argument as the caller wrote it — a value, a container, a callable, or nothing.
   *
   * @remarks
   * `undefined` is an OMITTED or ABSENT argument; `null` is a blank, which is a value. A reference
   * union is delivered as `RawArg[]` — one reference per area (see {@link IFunctionArguments.getRawAt}).
   */
  export type RawArg = Scalar | IRange | Lambda | undefined;

}
