import { type ICalculation, type ICellRanges } from '@sheetxl/sdk';

// A name alone (a table's or a defined name's) is kept as the name, so the table follows it as it
// grows; anything else is taken as the range it names. A cell address is not a name.
const NAME_PATTERN = /^[A-Za-z_\\][\w.\\]*$/;
const CELL_PATTERN = /^\$?[A-Za-z]{1,3}\$?\d+$/;

/**
 * A pivot table's source as a reference field holds it: the name typed, when it is a bare name, or
 * the one range it names; `null` for anything else.
 */
export const pivotSourceOf = (formula: ICalculation.IFormula | null): ICellRanges | string | null => {
  const ranges = formula?.getReferences() ?? null;
  if (!formula || !ranges || ranges.getCount() !== 1) return null;
  const text = formula.getExpression().trim();
  return NAME_PATTERN.test(text) && !CELL_PATTERN.test(text) ? text : ranges;
};
