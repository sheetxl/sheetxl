import { FormulaError, type IRange, type IReferenceRange, type Scalar } from '@sheetxl/primitives';

/**
 * Wraps a value-aggregating reduce callback (SUMIF / AVERAGEIF / MAXIFS / …) so an error in a
 * MATCHED member becomes the whole result, while a non-matched one stays invisible.
 *
 * The selectivity is the point: the conditional aggregates cannot use the engine's reject default,
 * because it would fault on an error the criteria excluded. They follow the same matched-rows-only
 * rule as the database family. The first matched error in scan order wins, not a fixed rank by
 * error kind, which is what latching the accumulator gives.
 *
 * Count flavors do NOT wrap: `COUNTIF(A1:A3,">1")` counts a matched error member.
 */
export function rejectMatchedError(
  fn: (accumulator: Scalar, value: Scalar) => Scalar
): (accumulator: Scalar, value: Scalar) => Scalar {
  return (accumulator: Scalar, value: Scalar): Scalar => {
    if (FormulaError.isError(accumulator)) return accumulator; // latched — first match wins
    if (FormulaError.isError(value)) return value;
    return fn(accumulator, value);
  };
}

/**
 * The member error a paired statistic answers with: `#NULL!` and `#GETTING_DATA` read as `#NUM!`.
 *
 * Shared by the two-array statistics (`CORREL`, `PEARSON`, `RSQ`, `STEYX`, `COVARIANCE.*`, `SLOPE`,
 * `INTERCEPT`, `FORECAST`, `SUMX2MY2` and its siblings, `PROB`, `CHISQ.TEST`, `F.TEST`, `T.TEST`).
 * Which member wins is each function's own scan order; only the kind is mapped. `SUMPRODUCT`,
 * `SUM` and the one-array statistics keep the error as it is.
 */
export function pairedMemberError<E extends FormulaError.Known>(error: E): E {
  const code = error.getCode();
  return (code === FormulaError.Code.Null || code === FormulaError.Code.GettingData ? FormulaError.BuiltIn.Num : error) as E;
}

/**
 * {@link pairedMemberError} of a range's first error, except at a single-cell REFERENCE: that one
 * reads as a direct argument and keeps its error (`PROB(A2,C1,1)` is `#NULL!` where A2 is).
 */
export function pairedRangeError(range: IRange): FormulaError.Known {
  const error = range.firstError()!;
  if (range.size === 1 && (range as IReferenceRange).isIReferenceRange) return error;
  return pairedMemberError(error);
}
