/**
 * The coordinates of a cell in a 2D space.
 */
export interface CellCoords {
  /**
   * The column index of the cell.
   */
  colIndex: number;
  /**
   * The row index of the cell.
   */
  rowIndex: number;

  // TODO - review this again
  sheetName?: string;
}

// TODO - make RangeCoords interface into this one
/*
export interface RangeCoord {
  from: CellCoord,
  to: CellCoord
}
*/
/**
 * The coordinates of a cell range in a 2D space.
 * The rowStart and colStart must be less than or equal to rowEnd and colEnd respectively.
 * If all of the values are the same this represents a single cell.
 */
export interface RangeCoords {
  /**
   * Left column
   */
  colStart: number;
  /**
   * Top row
   */
  rowStart: number;
  /**
   * Right column
   */
  colEnd: number;
  /**
   * Bottom row
   */
  rowEnd: number;

  // TODO - review this again
  sheetName?: string;
}

export const RangeOrientation = {
  Column: 'column',
  Row: 'row'
} as const;
export type RangeOrientation = typeof RangeOrientation[keyof typeof RangeOrientation];

/**
 * Allows for either direction or both. (But not none).
 */
export const RangeOrientations = {
  ...RangeOrientation,
  Both: 'both'
} as const;
export type RangeOrientations = typeof RangeOrientations[keyof typeof RangeOrientations];


// /**
//  * Used when a true or false feels more natural.
//  */
// export type BooleanOrOrientation = boolean | RangeOrientation;

/**
 * Represents a selection of ranges with an active range and an active cell.
 */
export interface SelectionCoords {
  /**
   * The cell coordinates that will receive
   * actions that operate on a single cell.
   * @remarks
   */
  cell: Readonly<CellCoords>;
  /**
   * A list of cell ranges that are currently selected.
   * @remarks
   * If this is missing it will be assumed to have a ranges of length 1 that matches the
   * CellCoords.
   */
  ranges?: readonly RangeCoords[];
  /**
   * The current range if any ranges are selected.
   * @defaultValue 'ranges.length - 1'
   *
   * @remarks
   * If the rangeIndex is outside the ranges bounds this will be the defaultValue.
   */
  rangeIndex?: number;
}

/**
 * A RunCoords represents a discrete set of values in a single dimension.
 *
 * A `RunCoords` min and max are inclusive of the values;
 * so a run of length 1 would have a min equal to max.
```
  // length of 1
  let coord:RunCoords = {
    min: 3,
    max: 3
  }
```
 *
 * @remarks
 * A max of less than a min is invalid.
 */
export interface RunCoords {
  min: number;
  max: number;
}

/**
 * Extends RangeCoords to include a value.
 */
export interface RangedValue<T=any> extends RangeCoords {
  /**
   * The value of the range.
   *
   * @remarks
   * This is optional because it may be used to represent a range of cells that are not yet set.
   */
  value?: T;
}

/**
 * Used to toggle an action on either rows or columns.
 */
// export interface RangeOrientationFlags {
//   [RangeOrientation.Column]?: boolean;
//   [RangeOrientation.Row]?: boolean;
// }