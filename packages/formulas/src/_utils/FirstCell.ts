import { FormulaContext, FormulaError, ValueKind, type IRange, type IReferenceRange, type Scalar } from '@sheetxl/primitives';

/**
 * The answer for a CONTAINER at a slot that reads a multi-cell REFERENCE by its FIRST CELL while
 * an array constant still answers per member — `N` and `T`.
 *
 * @remarks
 * `T(AF1:AF3)` is `"alpha"` and stays a scalar —
 * `ROWS` of it is 1 and `INDEX(…,2,1)` is `#REF!` — while `T({"alpha";"bravo"})` spills 2x1. Both
 * names declare `IRange | Scalar`, so a value and a ONE-CELL reference never reach here (the
 * marshaller dereferences them at the scalar arm, errors included); what arrives is a container,
 * and only its KIND separates the two readings.
 *
 * `paramIndex` is the slot the kind is asked about — 0 for both of today's callers.
 *
 * An error at the first cell of a multi-cell reference propagates here, which is what a one-cell
 * reference does (`T(<#N/A cell>)` is `#N/A`).
 */
export const readFirstOrMembers = <T extends Scalar>(
  container: IRange,
  read: (value: Scalar) => T,
  paramIndex: number = 0
): T => {
  const one = (value: Scalar): T => (FormulaError.isError(value) ? value as T : read(value));
  if (FormulaContext.getArgs().getKindAt(paramIndex) === ValueKind.Reference) {
    return one(container.getValueAt(0, 0));
  }
  return FormulaContext.createRange(
    container.getRowCount(),
    container.getColumnCount(),
    (_value: Scalar, coords: IRange.CellCoords) => one(container.getValueAt(coords.rowIndex, coords.colIndex))
  ) as unknown as T;
};

/**
 * The one cell a multi-cell REFERENCE reads as at a slot declared a plain VALUE.
 *
 * @remarks
 * The choice is the call's implicit-intersection MODE: in VALUE
 * mode the cell the formula's own row and column select — the `@` rule on both axes, `#VALUE!`
 * when the formula cell lies outside the range — and in ARRAY mode the first cell. A one-cell
 * reference is its own cell in either mode.
 *
 * `LeastSquares.readOneCell` in `@sheetxl/formulas-extended` is the same rule; the two packages
 * share only `@sheetxl/primitives`, which is why there are two copies rather than one import.
 */
export const readIntersectedCell = (range: IRange): Scalar => {
  const rows = range.getRowCount();
  const cols = range.getColumnCount();
  const reference = range as IReferenceRange;
  // Only a REFERENCE has a position to intersect against; a multi-cell array never reaches
  // here (its slot lifts, or refuses).
  if ((rows === 1 && cols === 1) || !reference.isIReferenceRange || !FormulaContext.isImplicitIntersect()) {
    return range.getValueAt(0, 0);
  }
  const coords = reference.getCoords();
  const rowRel = FormulaContext.getRow() - coords.rowStart;
  const colRel = FormulaContext.getColumn() - coords.colStart;
  const rowIn = rowRel >= 0 && rowRel < rows;
  const colIn = colRel >= 0 && colRel < cols;
  if (rowIn && colIn) return range.getValueAt(rowRel, colRel);
  if (rowIn && cols === 1) return range.getValueAt(rowRel, 0);
  if (colIn && rows === 1) return range.getValueAt(0, colRel);
  throw FormulaError.BuiltIn.Value;
};
