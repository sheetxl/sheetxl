import { describe, expect, it } from 'vitest';

import { RangeAxis, type RangeCoords } from '../../coords/Types';
import { InsertCutShift, classifyInsertCut, isRefusedInsertCut } from '../../coords/CoordUtils';

/**
 * The four outcomes of cutting one block and inserting it elsewhere. The model performs the shift and
 * the drag preview colors the I-beam off this same call, so the table below is the contract between
 * them - and every row of it matches Excel (`Range.Cut` + `Range.Insert`).
 */
describe("classifyInsertCut", () => {
  /** `A1:B2` etc, spelled as coords: rows/cols are 0-based and inclusive. */
  const at = (rowStart: number, colStart: number, rows: number, cols: number): RangeCoords => ({
    rowStart, colStart, rowEnd: rowStart + rows - 1, colEnd: colStart + cols - 1
  });
  const cut = at(0, 0, 2, 2); // A1:B2

  it("closes the gap when the two share the band across the shift axis", () => {
    // dropped below itself (A5:B6) and above itself (with the cut moved down), both on columns A:B
    expect(classifyInsertCut(cut, at(4, 0, 2, 2), RangeAxis.Row)).toBe(InsertCutShift.Close);
    expect(classifyInsertCut(at(4, 0, 2, 2), cut, RangeAxis.Row)).toBe(InsertCutShift.Close);
    // the same on the other axis: same rows, dropped at a column line
    expect(classifyInsertCut(cut, at(0, 4, 2, 2), RangeAxis.Column)).toBe(InsertCutShift.Close);
  });

  it("closes for the no-op line immediately past the block's own end", () => {
    expect(classifyInsertCut(cut, at(2, 0, 2, 2), RangeAxis.Row)).toBe(InsertCutShift.Close);
  });

  it("blanks when the block drifted off the band and the shift cannot reach the cut", () => {
    // dragged right, pointer a row low: the insert is at column E, the cut back at A:B
    expect(classifyInsertCut(cut, at(1, 4, 2, 2), RangeAxis.Column)).toBe(InsertCutShift.Blank);
    // bands that cannot touch at all - the cut is below, the insert three columns over
    expect(classifyInsertCut(at(4, 0, 2, 2), at(0, 3, 2, 2), RangeAxis.Row)).toBe(InsertCutShift.Blank);
  });

  it("refuses a line inside the block being cut", () => {
    const tall = at(0, 0, 4, 2); // A1:B4
    expect(classifyInsertCut(tall, at(1, 0, 4, 2), RangeAxis.Row)).toBe(InsertCutShift.Inside);
    expect(classifyInsertCut(tall, at(3, 0, 4, 2), RangeAxis.Row)).toBe(InsertCutShift.Inside);
  });

  it("refuses a shift that would carry only PART of the cut with it", () => {
    // the insert precedes the cut and their bands cross: some of the cut's rows move, not all
    expect(classifyInsertCut(at(0, 4, 2, 2), at(1, 0, 2, 2), RangeAxis.Column)).toBe(InsertCutShift.Tear);
    expect(classifyInsertCut(at(4, 0, 2, 2), at(0, 1, 2, 2), RangeAxis.Row)).toBe(InsertCutShift.Tear);
  });

  it("names the two refusals", () => {
    expect([InsertCutShift.Inside, InsertCutShift.Tear].map(isRefusedInsertCut)).toEqual([true, true]);
    expect([InsertCutShift.Close, InsertCutShift.Blank].map(isRefusedInsertCut)).toEqual([false, false]);
  });
});
