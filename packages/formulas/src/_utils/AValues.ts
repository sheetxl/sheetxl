import { FormulaError, ScalarType, type IRange, type IReferenceRange, type Scalar } from '@sheetxl/primitives';

/**
 * The reading the A functions apply to a member their plain twin skips — AVERAGEA, MAXA, MINA,
 * STDEVA, STDEVPA, VARA and VARPA.
 *
 * Text and FALSE are 0, TRUE is 1, and a NUMERIC text is 0 rather than its number. All of it
 * applies to a member of a REFERENCE; inside an ARRAY the A functions are their plain twins —
 * `MAXA({-1,-2,"x"})` is -1 where MAXA over the same three CELLS is 0 — with one exception:
 * AVERAGEA carries the text rule into an array as well, so `AVERAGEA({-1,-2,"x"})` is -1. A
 * BOOLEAN in an array is skipped by every one of them, AVERAGEA included, typed or computed
 * alike: `AVERAGEA({TRUE})` and `AVERAGEA(TRANSPOSE({TRUE}))` are both #DIV/0! while a TRUE CELL
 * averages 1. The split is the reference-vs-array KIND, not literalness.
 *
 * A DIRECT argument never reaches any of this — those slots are typed `number`, so a boolean
 * coerced to 1 and a text failed to #VALUE! before it was boxed.
 *
 * It lives here rather than beside the functions because an exported helper in a category
 * directory registers a formula function, and both category files need it.
 */
export const isReferenceRange = (range: IRange): boolean =>
  !!(range as IReferenceRange).isIReferenceRange;

/** `textInArray` is the one place AVERAGEA differs: 0 for AVERAGEA, skipped for the rest. */
const aFunctionValueOptions = (textInArray: 0 | null): IRange.ValueOptions => Object.freeze({
  coerce: (
    fromValue: Scalar,
    fromType: ScalarType,
    defaultCoerce: (value: Scalar, type: ScalarType) => Scalar,
    range: IRange
  ): Scalar => {
    const reference = isReferenceRange(range);
    if (fromType === ScalarType.String) return reference ? 0 : textInArray;
    if (fromType === ScalarType.Boolean) {
      if (!reference) return null;
      return fromValue ? 1 : 0;
    }
    if (FormulaError.isError(fromValue)) {
      throw fromValue; // propagate
    }
    return null; // ignore rich and other
  }
});

/** MAXA, MINA, STDEVA, STDEVPA, VARA and VARPA. */
export const ValueOptionsAFunctions: IRange.ValueOptions = aFunctionValueOptions(null);

/** AVERAGEA's, which differs in one place: a text member of an ARRAY is 0 rather than skipped. */
export const ValueOptionsAverageA: IRange.ValueOptions = aFunctionValueOptions(0);

/**
 * The same reading applied to a RAW member, for the bodies that need each deviation rather than
 * an aggregate. `reference` is `isReferenceRange` of the range the value came out of.
 */
export const coerceAValue = (v: Scalar, reference: boolean): number | null => {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return reference ? (v ? 1 : 0) : null;
  if (typeof v === 'string') return reference ? 0 : null;
  if (FormulaError.isError(v)) throw v; // an error member propagates, as it does in every A twin
  return null;
};
