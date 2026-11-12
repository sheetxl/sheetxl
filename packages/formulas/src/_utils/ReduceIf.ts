import {
  FormulaContext,
  type IRange, type IReferenceRange, type Scalar
} from '@sheetxl/primitives';

/**
 * Internal helper for the *IF family — `COUNTIF`, `SUMIF`, `AVERAGEIF` and the public `REDUCEIF`.
 * Folds the members of `range` that satisfy `criteria`, reading the folded value from `reduceRange`
 * when one is given.
 *
 * @param range The range whose members are tested.
 * @param criteria The criteria expression.
 * @param reduceRange The range to read folded values from. Omit for the criteria range itself.
 * @param fn Called with `(accumulator, value)` for each matching position.
 * @param emptyFold The contribution of the positions that are blank in BOTH ranges, in closed
 *   form — see the blank note below. Required, and `null` (apply `fn`) is a choice like any
 *   other: a forgotten blank term is a silently wrong answer, not a slow one.
 */
export function reduceIf(
  range: IReferenceRange,
  criteria: Scalar,
  reduceRange: IReferenceRange | undefined | null,
  fn: (accumulator: Scalar, value: Scalar) => Scalar,
  emptyFold: ((accumulator: Scalar, count: number) => Scalar) | null
): Scalar {
  let reduce: IRange | null = null;
  if (reduceRange) {
    // If reduceRange is provided use only the top left.
    // a reference is required because the dependency is implicit
    reduce = FormulaContext.getResizedReference(reduceRange.getCoords(), range.getRowCount(), range.getColumnCount());
  }
  const evalCriteria = FormulaContext.createCriteria(criteria);
  const matchesEmpty = evalCriteria(null);

  // always 0 otherwise the fold's first matching call would see `null`
  const initial: Scalar = 0;

  if (reduce && !matchesEmpty) {
    // Open `reduceRange` only at the positions that matched: no other cell of it is read, and
    // that is what decides circularity — `=SUMIF(B1,C1,A1)` in A1 is a cycle only while B1
    // matches C1. A blank cannot match here, so the
    // criteria range's sparse walk visits every candidate.
    let accumulator: Scalar = initial;
    const entries = (range as IRange).entries<Scalar>();
    let result = entries.next();
    while (!result.done) {
      const entry = result.value;
      if (evalCriteria(entry.value)) {
        const coords = entry.coords;
        accumulator = fn(accumulator, (reduce as IRange).getValueAt(coords.rowIndex, coords.colIndex) ?? null);
      }
      result = entries.next();
    }
    return accumulator;
  }

  // A criteria that matches blanks needs every position of BOTH ranges — a blank in `range`
  // against a value in `reduceRange` counts — so the aligned walk stays, and it opens the whole
  // window; the blank-in-both positions are folded in closed form.
  return (range as IRange).alignReduce<Scalar, Scalar>(
    reduce ? [reduce] : [],
    (accumulator: Scalar, values: (Scalar | null)[]): Scalar => {
      if (!evalCriteria(values[0])) return accumulator;
      // A position past the clamped window is a cell that cannot exist, which reads as blank.
      return fn(accumulator, (reduce ? values[1] : values[0]) ?? null);
    },
    initial,
    matchesEmpty
      ? { emptyFold: emptyFold ?? ((accumulator, count) => applyBlank(fn, accumulator, count)) }
      : undefined
  );
}

/**
 * The fallback when the caller has no closed form — the public `REDUCEIF`, whose `fn` is a user
 * LAMBDA. The fix-point bail settles the absorbing shape (a fold a blank does not move, which is
 * most of them) in two calls; anything else genuinely depends on the multiplicity.
 */
function applyBlank(
  fn: (accumulator: Scalar, value: Scalar) => Scalar,
  accumulator: Scalar,
  count: number
): Scalar {
  let acc = fn(accumulator, null);
  if (count === 1) return acc;
  const next = fn(acc, null);
  if (next === acc) return acc;
  acc = next;
  for (let i=2; i<count; i++) {
    acc = fn(acc, null);
  }
  return acc;
}

/**
 * `emptyFold` for a fold that COUNTS every matching position — `COUNTIF`, and the count half of
 * `AVERAGEIF` when it has no separate average range.
 */
export const countBlanks = (accumulator: Scalar, count: number): Scalar => {
  return ((accumulator as number) ?? 0) + count;
};

/**
 * `emptyFold` for a fold a blank cannot move — `SUMIF`, `MAXIFS`, `MINIFS`, and every fold that
 * skips non-numeric members.
 */
export const ignoreBlanks = (accumulator: Scalar, _count: number): Scalar => {
  return accumulator;
};
