import { ScalarType } from './ScalarType';

/**
 * The KIND of one value — the total discriminator over {@link IFunctionArguments.RawArg}, and the
 * vocabulary a RETURN declaration speaks ({@link IFunction.IReturnType.getKind}).
 *
 * @remarks
 * A value's kind and its extent are different axes: `{10}`, `A1` and a bare `10` all reach a
 * range-typed parameter as a 1x1 container, yet they are distinct:
 * `VLOOKUP(10,10,1,TRUE)` is `#N/A` while `VLOOKUP(10,{10},1,TRUE)` is 10, and `TYPE` answers
 * 1 vs 64. The kind is what the CALLER supplied; the extent is merely its size.
 *
 * The scalar kinds ARE {@link ScalarType} values — one vocabulary, so
 * `getKindAt(i) === ScalarType.Boolean` reads naturally — extended with the four kinds only an
 * argument can be: a reference, a non-reference array, a callable, and no argument at all. As an
 * argument kind, {@link ScalarType.Null} means a BLANK value.
 *
 * The names and values are ours. The numeric codes the `TYPE` function answers are a
 * PROJECTION of this kind (see `TYPE`'s implementation), not the kind itself.
 *
 * @see {@link IFunctionArguments.getKindAt}
 */
export const ValueKind = {
  ...ScalarType,
  /** A reference — `A1`, `A1:B3`, or a reference-returning call (`INDEX`, `OFFSET`, `TAKE`). */
  Reference: 'reference',
  /** An ARRAY that is not a reference — `{1,2}`, or a computed one (`SEQUENCE`, `TRANSPOSE(…)`). */
  Array: 'array',
  /** A callable — `LAMBDA(…)`, an eta-reduced function name, or a lambda-valued binding. */
  Lambda: 'lambda',
  /**
   * OMITTED — nothing at this position: the empty comma of `CUMIPMT(,120,…)`, or a position
   * past what the caller wrote. A blank CELL is a `Reference` (blankness is the cell's value).
   * ABSENT-vs-omitted — whether the position exists in the call at all — is not a kind; it is
   * `index >= getLength()`.
   */
  Omitted: 'omitted'
} as const;
export type ValueKind = typeof ValueKind[keyof typeof ValueKind];
