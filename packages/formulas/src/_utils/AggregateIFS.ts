import {
  type IRange, FormulaError, type IFormulaContext, type IReferenceRange, type Scalar
} from '@sheetxl/primitives';

/**
 * Internal helper for the *IFS family of aggregation functions.
 * Folds the positions that satisfy EVERY `[criteriaRange, criteria]` pair.
 *
 * @param context - The formula context.
 * @param pairs - The `[criteriaRange, criteria]` groups to evaluate. Each criteria is a single
 *   VALUE: the slot is declared `AcceptError<Scalar>`, so a range in that position is lifted by
 *   the engine and this helper is called once per element. `AcceptError` because an error is a
 *   MATCHABLE criterion, not a fault — `COUNTIF(J1:J3,1/0)` over a `#DIV/0!` cell is 1 and
 *   `SUMIF(J1:J3,NA(),J1:J3)` sums the matched `#N/A` cell.
 * @param aggregateFn - Called for each matching cell position with
 *   `(accumulator, value)`. `accumulator` is `null` on the first matching call.
 *   Return `accumulator` unchanged to skip a value (e.g. non-numeric).
 * @param aggRange - Optional range to read aggregate values from. When omitted
 *   `value` is passed as `true` (useful for COUNTIFS-style counting).
 * @param noMatchDefault - Value to return when no cells match (default `0`).
 *   Pass `null` when the caller needs to distinguish "zero sum" from "no match"
 *   (e.g. AVERAGEIFS, which must return `#DIV/0!` on no match).
 * @param emptyFold - The contribution of the positions that are blank in every range, in closed
 *   form, applied only when EVERY criteria matches a blank. Required, and `null` (a blank
 *   contributes nothing) is a choice like any other: a forgotten blank term is a silently wrong
 *   answer, not a slow one.
 *
 * @remarks
 * ### One sparse pass, no mask
 *
 * This used to build a boolean mask range per criteria pair, `broadcast` them together and then
 * walk the result. Each of those is a full-extent pass, so a whole-column `COUNTIFS` allocated and
 * visited several million cells to answer a question about a few dozen. `alignReduce` races the
 * sides' STORED members instead — a position blank everywhere is never visited, and the mask never
 * exists.
 *
 * Blanks keep their meaning through `emptyFold`: whether a blank matches is a constant per
 * criteria (`evaluator(null)`), so the blank positions contribute one term stated once rather
 * than a million evaluations. `COUNTIFS(A:A,"<>10")` is 1,048,576 and
 * `COUNTIFS(A:A,"<>10",B:B,">0")` is the handful B has members at — the second pair rejects
 * blanks, so the blank term drops out on its own.
 */
export function aggregateIFS(
  context: IFormulaContext,
  pairs: readonly [criteriaRange: IReferenceRange | IRange, criteria: Scalar][],
  aggregateFn: (accumulator: Scalar, value: Scalar) => Scalar,
  aggRange: IRange | undefined,
  noMatchDefault: Scalar,
  emptyFold: ((accumulator: Scalar, count: number) => Scalar) | null
): Scalar {
  const criteriaRanges = pairs.map(pair => pair[0]) as IReferenceRange[];
  // All criteria ranges must have the same dimensions — return #VALUE! otherwise.
  const expectedCols = criteriaRanges[0].getColumnCount();
  const expectedRows = criteriaRanges[0].getRowCount();
  for (let i = 1; i < criteriaRanges.length; i++) {
    if (criteriaRanges[i].getColumnCount() !== expectedCols || criteriaRanges[i].getRowCount() !== expectedRows) {
      throw FormulaError.BuiltIn.Value;
    }
  }
  // The aggregate range is held to the same shape, and this is where the *IFS family parts
  // company with SUMIF: SUMIF RESHAPES its `sum_range` from the top-left, so any shape answers,
  // while `SUMIFS(A1:C1,A1:C1,">1",…)` refuses a `sum_range` that differs — including the same
  // COUNT transposed (`SUMIFS(D1:D3,A1:C1,">1")` is #VALUE!, not 60).
  if (aggRange && (aggRange.getColumnCount() !== expectedCols || aggRange.getRowCount() !== expectedRows)) {
    throw FormulaError.BuiltIn.Value;
  }

  const criteriaCount = criteriaRanges.length;
  const evaluators: IFormulaContext.CriteriaEvaluator[] = new Array(criteriaCount);
  // Whether a blank matches is a constant per criteria, so it is answered once here rather than
  // at every cell. Every criteria has to accept a blank before the blank positions contribute.
  let matchesEmpty = true;
  for (let i=0; i<criteriaCount; i++) {
    const evaluator = context.createCriteria(pairs[i][1]);
    evaluators[i] = evaluator;
    if (!evaluator(null)) matchesEmpty = false;
  }

  // A `null` in `others` means the 1-based POSITION ORDINAL, not an absent side, so the aggregate
  // range is appended only when there is one and its slot is tracked here.
  const others: IRange[] = criteriaRanges.slice(1) as IRange[];
  let aggSlot = -1;
  // Open the aggregate range only at the positions every criteria matched: no other cell of it
  // is read, and that is what decides circularity — `=SUMIFS(A1,B1,C1)` in A1 is a cycle only
  // while B1 matches C1. Blanks cannot match here, so the
  // criteria ranges' walk visits every candidate. A criteria that matches blanks needs every
  // position of the aggregate range too (a blank criteria cell against a value), so it stays in
  // the aligned walk, which opens the whole window.
  let lazyAgg: IRange | null = null;
  if (aggRange) {
    if (matchesEmpty) {
      aggSlot = criteriaCount;
      others.push(aggRange);
    } else {
      lazyAgg = aggRange;
    }
  }

  const accumulator: Scalar = (criteriaRanges[0] as IRange).alignReduce<Scalar, Scalar>(
    others,
    (acc: Scalar, values: (Scalar | null)[], coords: IRange.CellCoords): Scalar => {
      for (let i=0; i<criteriaCount; i++) {
        if (!evaluators[i](values[i])) return acc;
      }
      // COUNTIFS: value is irrelevant, aggregateFn handles counting
      let value: Scalar = true;
      if (lazyAgg) value = lazyAgg.getValueAt(coords.rowIndex, coords.colIndex) ?? null;
      else if (aggSlot >= 0) value = values[aggSlot] ?? null;
      return aggregateFn(acc, value);
    },
    null,
    (matchesEmpty && emptyFold) ? { emptyFold } : undefined
  );
  // Return noMatchDefault when nothing matched (accumulator never left null).
  return accumulator !== null ? accumulator : noMatchDefault;
}
