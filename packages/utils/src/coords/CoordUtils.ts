import {
  RangeAxis, type CellCoords, type RangeCoords, type SelectionCoords, type RangeCoordValue
} from './Types';
// tree shake
import { EmptyArray } from '../utils/CommonUtils'

/**
 * Frozen CellCoords for easy comparisons.
 */
export const EmptyCell: CellCoords = Object.freeze({
  colIndex: 0,
  rowIndex: 0
});

/**
 * Frozen RangeCoords for easy comparisons.
 */
export const EmptyRange: RangeCoords = Object.freeze({
  colStart: 0,
  rowStart: 0,
  colEnd: 0,
  rowEnd: 0
});

/**
 * Alias for EmptyRanges
 */
export const EmptyRanges: readonly RangeCoords[] = EmptyArray;

/**
 * Frozen SelectionCoords for easy comparisons.
 */
export const EmptySelection: SelectionCoords = Object.freeze({
  cell: EmptyCell,
  ranges: EmptyArray,
  rangeIndex: -1
});

/**
 * Comparator that sorts ranges by column then row.
 */
export function columnFirstRangeComparator(a: RangeCoords, b: RangeCoords): number {
  if (a.colStart === b.colStart)
    return a.rowStart - b.rowStart;
  return a.colStart - b.colStart;
}

/**
 * Comparator that sorts ranges by row then column.
 */
export function rowFirstRangeComparator(a: RangeCoords, b: RangeCoords): number {
  if (a.rowStart === b.rowStart)
    return a.colStart - b.colStart;
  return a.rowStart - b.rowStart;
}

export function reverseRowFirstRangeComparator(a: RangeCoords, b: RangeCoords): number {
  if (a.rowEnd === b.rowEnd)
    return b.colEnd - a.colEnd;
  return b.rowEnd - a.rowEnd;
}

export function reverseColumnFirstRangeComparator(a: RangeCoords, b: RangeCoords): number {
  if (a.colEnd === b.colEnd)
    return b.rowEnd - a.rowEnd;
  return b.colEnd - a.colEnd;
}

/**
 * Comparator that sorts coords by column then row.
 * Returns > 1 if a is before b.
 */
export function columnFirstCellComparator(a: CellCoords, b: CellCoords): number {
  if (a.colIndex === b.colIndex)
    return a.rowIndex - b.rowIndex;
  return a.colIndex - b.colIndex;
}

/**
 * Comparator that sorts coords by row then column.
 */
export function rowFirstCellComparator(a: CellCoords, b: CellCoords): number {
  if (a.rowIndex === b.rowIndex)
    return a.colIndex - b.colIndex;
  return a.rowIndex - b.rowIndex;
}

/**
 * Comparator that sorts coords by row then column reversed
 */
export function reverseRowFirstCellComparator(a: CellCoords, b: CellCoords): number {
  if (a.rowIndex === b.rowIndex)
    return b.colIndex - a.colIndex;
  return b.rowIndex - a.rowIndex;
}

/**
 * Comparator that sorts coords by column then row reversed
 */
export function reverseColumnFirstCellComparator(a: CellCoords, b: CellCoords): number {
  if (a.colIndex === b.colIndex)
    return b.rowIndex - a.rowIndex;
  return b.colIndex - a.colIndex;
}

/**
 * Returns a Comparator for ranges with support for range axis and reverse.
 */
export function createRangeComparator(
  axis: RangeAxis=RangeAxis.Row,
  reverse: boolean=false
): (a: RangeCoords, b: RangeCoords) => number {
  if (!reverse) {
    if (axis !== RangeAxis.Column) {
      return rowFirstRangeComparator;
    } else {
      return columnFirstRangeComparator
    }
  }

  if (axis !== RangeAxis.Column) {
    return reverseRowFirstRangeComparator;
  } else {
    return reverseColumnFirstRangeComparator
  }
}

/**
 * Returns a Comparator for cells with support for range axis and reverse.
 */
export function createCellComparator(
  axis: RangeAxis=RangeAxis.Row,
  reverse: boolean=false
): (a: CellCoords, b: CellCoords) => number {
  if (!reverse) {
    if (axis !== RangeAxis.Column)
      return rowFirstCellComparator;
    else
      return columnFirstCellComparator
  }

  if (axis !== RangeAxis.Column) {
    return reverseRowFirstCellComparator;
  } else {
    return reverseColumnFirstCellComparator;
  }
}

/**
 * Check if two coords are equal.
 *
 * @param a First CellCoords
 * @param b Second CellCoords
 *
 * @remarks
 * {@link CellCoords.scope} (the sheet a coord lives on) is part of a coord's identity: the same row/col
 * on two different sheets are NOT equal. Backward compatible — a coord with no `scope` compares unchanged
 * against another with no `scope` (`undefined === undefined`).
 */
export function isEqualCells(
  a: CellCoords | null,
  b: CellCoords | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.rowIndex !== b.rowIndex) return false;
  if (a.colIndex !== b.colIndex) return false;
  if (a.scope !== b.scope) return false;
  return true;
};

/**
 * Check if two ranges are equal.
 *
 * @param a First RangeCoords
 * @param b Second RangeCoords
 *
 * @remarks
 * Null safe. {@link RangeCoords.scope} (the sheet the range lives on) is part of identity — see
 * {@link isEqualCells}; a range with no `scope` compares unchanged.
 */
export function isEqualRanges(
  a?: RangeCoords | null,
  b?: RangeCoords | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  if (a.rowStart !== b.rowStart || a.rowEnd !== b.rowEnd)
    return false;
  if (a.colStart !== b.colStart || a.colEnd !== b.colEnd)
    return false;
  if (a.scope !== b.scope)
    return false;

  return true;
};

/**
 * Returns true if `coords` is within `range`.
 *
 * @param cell CellCoords
 * @param range RangeCoords
 *
 * @remarks
 * Null safe
 */
export function isCellWithinRange(
  cell: CellCoords,
  range: RangeCoords
): boolean {
  if (!cell || !range) return false;
  const rowIndex = cell.rowIndex;
  if (rowIndex < range.rowStart || rowIndex > range.rowEnd) {
    return false;
  }
  const colIndex = cell.colIndex
  if (colIndex < range.colStart || colIndex > range.colEnd) {
    return false;
  }
  return true;
};

/**
 * Returns true `inner` range is completely contained within 'outer' range.
 *
 * @param inner Inner range.
 * @param outer Outer range.
 */
export function isRangeWithinRange(
  inner: RangeCoords,
  outer: RangeCoords
): boolean {
  if (!inner || !outer) return false;
  if (inner.rowStart < outer.rowStart || inner.rowEnd > outer.rowEnd) {
    return false;
  }
  if (inner.colStart < outer.colStart || inner.colEnd > outer.colEnd) {
    return false;
  }
  return true;
};

/**
 * Check if 2 ranges overlap.
 *
 * @param a First RangeCoords
 * @param b Second RangeCoords
 */
export function isRangesIntersect(
  a: RangeCoords,
  b: RangeCoords
): boolean {
  if (!a || !b) return false;
  if (a.colStart > b.colEnd || b.colStart > a.colEnd) {
    return false;
  }
  if (a.rowStart > b.rowEnd || b.rowStart > a.rowEnd) {
    return false;
  }
  return true;
};

/**
 * Check if two ranges arrays are equal
 *
 * @param a First Range Array.
 * @param b Second Range Array.
 */
export function isEqualRangesArrays(
  a?: readonly RangeCoords[],
  b?: readonly RangeCoords[]
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  for (let i=0; i<a.length; i++) {
    if (!isEqualRanges(a[i], b[i])) return false;
  }
  return true;
}

/**
 * Returns a flag indicating if the range is valid && colStart === colEnd && rowStart === rowEnd.
 * @param range A RangeCoord to check.
 */
export function isSingleCell(range: RangeCoords | undefined): boolean {
  if (!range) return false;
  if (range.rowEnd !== range.rowStart || range.colStart !== range.colEnd)
    return false;
  return true;
}

/**
 * Create a 1x1 dimension RangeCoord from a CellCoords.
 *
 * @param coords
 * @param reused
 *
 * @remarks
 * Returns null if null is passed in.
 */
export function cellToRange(
  coords: CellCoords | null,
  reused?: RangeCoords
): RangeCoords | null {
  if (!coords) return null;
  let asRange = reused;
  if (!asRange) {
    asRange = {
      ...coords, // We want to capture any additional info (like sheetName).
    } as unknown as RangeCoords;
    delete (asRange as any).colIndex;
    delete (asRange as any).rowIndex;
  };

  asRange.colStart = coords.colIndex ?? 0;
  asRange.rowStart = coords.rowIndex ?? 0
  asRange.colEnd = coords.colIndex ?? 0;
  asRange.rowEnd = coords.rowIndex ?? 0;
  return asRange;
}

/**
 * Finds the intersection of 2 ranges.
 *
 * @returns `null` if no intersection.
 */
export function intersectRanges(
  a: RangeCoords | null,
  b: RangeCoords | null,
  reuse?: RangeCoords
): RangeCoords | null {
  if (!a) return reuse ? b : {...b} as RangeCoords; // should intersect null return null?
  if (!b) return reuse ? a : {...a}; // should intersect null return null?
  if (!a && !b) return null;
  if (a.rowStart > b.rowEnd || a.rowEnd < b.rowStart || a.colStart > b.colEnd || a.colEnd < b.colStart)
    return null;
  const colStart = Math.max(a.colStart, b.colStart);
  const rowStart = Math.max(a.rowStart, b.rowStart);
  const colEnd = Math.min(a.colEnd, b.colEnd);
  const rowEnd = Math.min(a.rowEnd, b.rowEnd);

  let retValue:RangeCoords | undefined = reuse;
  if (retValue) {
    retValue.colStart = colStart;
    retValue.rowStart = rowStart;
    retValue.colEnd = colEnd;
    retValue.rowEnd = rowEnd;
  } else {
    retValue = {
      colStart,
      rowStart,
      colEnd,
      rowEnd
    }
  }
  return retValue;
};

/**
 * Finds the union of 2 ranges.
 *
 * @remarks
 * This is `null` safe.
 */
export function unionRanges(
  a: RangeCoords | null,
  b: RangeCoords | null,
  reuse?: RangeCoords
): RangeCoords | null {
  if (!a && !b) return null;
  if (!a) return reuse ? b : {...b} as RangeCoords;
  if (!b) return reuse ? a : {...a};

  const colStart = Math.min(a.colStart, b.colStart);
  const rowStart = Math.min(a.rowStart, b.rowStart);
  const colEnd = Math.max(a.colEnd, b.colEnd);
  const rowEnd = Math.max(a.rowEnd, b.rowEnd);

  let retValue:RangeCoords | undefined = reuse;
  if (retValue) {
    retValue.colStart = colStart;
    retValue.rowStart = rowStart;
    retValue.colEnd = colEnd;
    retValue.rowEnd = rowEnd;
  } else {
    retValue = {
      colStart,
      rowStart,
      colEnd,
      rowEnd
    }
  }
  return retValue;
};

/**
 * Compares two SelectionCoords.
 *
 * @param a First SelectionCoords
 * @param b Second SelectionCoords
 * @returns A flag indicating the values are logically the same.
 */
export function isEqualSelectionCoords(
  a: SelectionCoords,
  b: SelectionCoords
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  if (a.rangeIndex !== b.rangeIndex) return false;
  if (!isEqualCells(a.cell, b.cell)) return false;
  return isEqualRangesArrays(a.ranges, b.ranges);
}

/**
 * Interface for validating RangeCoords.
 */
export interface CoordValidator {
  (coords: RangeCoords, oobMessage?: string): void;
}


/**
 * Returns the smallest RangeCoords that encloses all ranges in the array.
 * Will return null if the range is empty.
 *
 * @param ranges An array of ranges to union.
 */
export function unionRangesArrays(
  ranges: readonly RangeCoords[],
  range?: RangeCoords,
  reuse?: RangeCoords
): RangeCoords | null {
  if (!ranges|| ranges.length === 0)
    return null;
  if (ranges.length === 1 && !range)
    return ranges[0];
  let union: RangeCoords | null = ranges[0];
  for (let i=1; i<ranges.length;i++) {
    union = unionRanges(union, ranges[i], reuse);
  }
  if (range) {
    union = unionRanges(union, range, reuse);
  }
  return union;
}

// /**
//  * Validate a CellCoords.
//  * @param cell The cell to validate.
//  */
// export function isValidCell(cell: CellCoords): boolean {
//   if (!cell) return false;
//   if (typeof cell.colIndex !== 'number' || cell.colIndex < 0) return false;
//   if (typeof cell.rowIndex !== 'number' || cell.rowIndex < 0) return false;
//   return true;
// }

/**
 * Validate a RangeCoords.
 *
 * @param range The range to validate.
 */
export function isValidRange(range: RangeCoords): boolean {
  if (!range) return false;
  if (typeof range.colStart !== 'number' || range.colStart < 0) return false;
  if (typeof range.colEnd !== 'number' || range.colEnd < range.colStart) return false;

  if (typeof range.rowStart !== 'number' || range.rowStart < 0) return false;
  if (typeof range.rowEnd !== 'number' || range.rowEnd < range.rowStart) return false;
  return true;
}

/**
 * Returns a union of all ranges.
 *
 * @param range The range to extends
 * @param ranges Surrounding ranges.
 */
// TODO - only used by selection for merge logic.
export function extendRangeToUnionRanges(
  range: Readonly<RangeCoords>,
  ranges: Readonly<RangeCoords[]>
): RangeCoords {
  if (!ranges || ranges.length === 0) return range;
  // We want to return a unioned merged. ranges may only return the intersection.
  let lastRange:RangeCoords = range;
  let currentRange:RangeCoords | null = null;
  while (!isEqualRanges(lastRange, currentRange)) {
    currentRange = lastRange;
    lastRange = extendRangeToIntersectingRanges(currentRange, ranges);
  }
  return lastRange;
};

/**
 * Get maximum bound of an range given other ranges. Returns the union. (useful for to merged cell selection).
 *
 * @param range The range to extends
 * @param ranges Surrounding ranges.
 */
export function extendRangeToIntersectingRanges(
  range: Readonly<RangeCoords>,
  ranges: Readonly<RangeCoords[]>
): RangeCoords {
  if (!ranges || ranges.length === 0) return range;
  const extendedRange = { ...range };

  for (let i=0; i<ranges.length; i++) {
    const intersect = ranges[i];
    if (isRangesIntersect(extendedRange, intersect)) {
      extendedRange.rowStart = Math.min(extendedRange.rowStart, intersect.rowStart);
      extendedRange.colStart = Math.min(extendedRange.colStart, intersect.colStart);
      extendedRange.rowEnd = Math.max(extendedRange.rowEnd, intersect.rowEnd);
      extendedRange.colEnd = Math.max(extendedRange.colEnd, intersect.colEnd);
    }
  }

  return extendedRange;
};

/**
 * Translate a range by a specified row and column index.
 */
export function translateRange(
  range: RangeCoords,
  rowIndex: number = -range.rowStart,
  colIndex: number = -range.colStart,
  reuseRange?: RangeCoords
): RangeCoords {
  if (!reuseRange) {
    return {
      colStart: range.colStart + colIndex,
      rowStart: range.rowStart + rowIndex,
      colEnd: range.colEnd + colIndex,
      rowEnd: range.rowEnd + rowIndex
    }
  }
  reuseRange.colStart = range.colStart + colIndex;
  reuseRange.rowStart = range.rowStart + rowIndex;
  reuseRange.colEnd = range.colEnd + colIndex;
  reuseRange.rowEnd = range.rowEnd + rowIndex;
  return reuseRange;
}

/**
 * Returns a RangeCoord from a shape that has either RangeCoord properties or CellCoord properties.
 *
 * @param rangeOrCoords
 * @returns a new object that has only the values of a RangeCoords.
 */
export function sanitizeRange(
  rangeOrCoords: RangeCoords | CellCoords | null,
  entireRange?: Readonly<RangeCoords>
): RangeCoords | null {
  if (!rangeOrCoords)
    return null;
  if (rangeOrCoords.scope) {
    return {
      colStart: (rangeOrCoords as CellCoords).colIndex ?? (rangeOrCoords as RangeCoords).colStart ?? entireRange?.colStart ?? 0,
      rowStart: (rangeOrCoords as CellCoords).rowIndex ?? (rangeOrCoords as RangeCoords).rowStart ?? entireRange?.rowStart ?? 0,
      colEnd: (rangeOrCoords as CellCoords).colIndex ?? (rangeOrCoords as RangeCoords).colEnd ?? entireRange?.colEnd ?? 0,
      rowEnd: (rangeOrCoords as CellCoords).rowIndex ?? (rangeOrCoords as RangeCoords).rowEnd ?? entireRange?.rowEnd ?? 0,
      scope: rangeOrCoords.scope
    }
  }
  return {
    colStart: (rangeOrCoords as CellCoords).colIndex ?? (rangeOrCoords as RangeCoords).colStart ?? entireRange?.colStart ?? 0,
    rowStart: (rangeOrCoords as CellCoords).rowIndex ?? (rangeOrCoords as RangeCoords).rowStart ?? entireRange?.rowStart ?? 0,
    colEnd: (rangeOrCoords as CellCoords).colIndex ?? (rangeOrCoords as RangeCoords).colEnd ?? entireRange?.colEnd ?? 0,
    rowEnd: (rangeOrCoords as CellCoords).rowIndex ?? (rangeOrCoords as RangeCoords).rowEnd ?? entireRange?.rowEnd ?? 0
  }
}

/**
 * Returns an array of RangeCoords from a shape that has either RangeCoord properties or CellCoord properties.
 */
export function sanitizeRangeArray(
  rangeOrCoords: readonly (RangeCoords | CellCoords)[],
  entireRange?: Readonly<RangeCoords>
): RangeCoords[] | null {
  if (!rangeOrCoords)
    return null;
  const rangesOrCoordsLength = rangeOrCoords.length;
  const result: RangeCoords[] = new Array(rangesOrCoordsLength);
  for (let i=0; i<rangesOrCoordsLength; i++) {
    result[i] = sanitizeRange(rangeOrCoords[i], entireRange)!;
  }
  return result;
}


/**
 * Ensure a partial range has default values
 *
 * @param range The range to default.
 * @param defaultPartialRange The default values for the range.
 * @param reuseRange An optional range to reuse for the result.
 */
export function defaultRange(
  range: Partial<RangeCoords>,
  defaultPartialRange: RangeCoords,
  reuseRange?: RangeCoords
): RangeCoords {
  if (!range) return defaultPartialRange;
  if (!reuseRange) {
    return {
      colStart: range.colStart ?? defaultPartialRange.colStart,
      rowStart: range.rowStart ?? defaultPartialRange.rowStart,
      colEnd: range.colEnd ?? defaultPartialRange.colEnd,
      rowEnd: range.rowEnd ?? defaultPartialRange.rowEnd
    }
  }
  reuseRange.colStart = range.colStart ?? defaultPartialRange.colStart;
  reuseRange.rowStart = range.rowStart ?? defaultPartialRange.rowStart;
  reuseRange.colEnd = range.colEnd ?? defaultPartialRange.colEnd;
  reuseRange.rowEnd = range.rowEnd ?? defaultPartialRange.rowEnd;
  return reuseRange;
}

const _reuseEntryMergeArray: [RangeCoordValue | null, RangeCoordValue | null] = [null, null];

// const defaultCanMerge = <T>(a: T, b: T, _isColumn: boolean): T => {
//   if (a === b) return b;
// }

const defaultEntryMerge = (from: [RangeCoordValue, b: RangeCoordValue], destination: RangeCoords, axis: RangeAxis): RangeCoords | null | undefined => {
  if (from[0].value === from[1].value) return destination;
  return undefined;
}

/**
 * Attempts to merge ranges that are guaranteed to not overlap.
 *
 * @defaultValue '2'.
 *
 * @remarks
 * * Setting to '0' will remove overlaps but not attempt to merge.
 * * Setting to '1' will remove overlaps in the initial axis.
 * * Setting to '2' will remove most overlaps but may miss overlaps that resulted from the previous iterations.
 * * Setting to 'Number.MAX_SAFE_INTEGER' will run until no more ranges can be merged.
 */
export function mergeRangeCoordValues(
  ranges: RangeCoordValue[],
  iterations: number=2,
  getMerge?: (from: [a: RangeCoordValue, b: RangeCoordValue], destination: RangeCoordValue, axis: RangeAxis) => RangeCoordValue | null | undefined,
  axis: RangeAxis=RangeAxis.Row,
  reuseArray?: [RangeCoordValue | null, RangeCoordValue | null]
): RangeCoordValue[] {
  let merged:RangeCoordValue[] = [...ranges]; // for sort. what's a better way?
  if (iterations <= 0 || ranges.length <= 1) return merged;

  let isColumn = axis === RangeAxis.Column;

  let count = 0;
  let didMerge = false;
  do {
    const toMerge = merged.sort(createRangeComparator(isColumn ? RangeAxis.Row : RangeAxis.Column));
    // TODO - further optimize but not creating a new array. instead just slice away the merge ranges.(we could also set merge value to null and splice or sort depending on merged counted)
    merged = [];

    merged.push(toMerge[0]);
    const toMergeLength = toMerge.length;
    let mergedIndex = 0;
    let lastRange:RangeCoordValue = toMerge[0];
    let lastRangeColStart = lastRange.colStart;
    let lastRangeRowStart = lastRange.rowStart;
    let lastRangeColEnd = lastRange.colEnd;
    let lastRangeRowEnd = lastRange.rowEnd;
    for (let i=1; i<toMergeLength; i++) {
      const range = toMerge[i];
      let mergeCandidate = false;
      if (isColumn) {
        mergeCandidate =
          lastRange &&
          lastRangeRowStart === range.rowStart &&
          lastRangeRowEnd === range.rowEnd &&
          lastRangeColEnd + 1 === range.colStart
      } else {
        mergeCandidate =
          lastRange &&
          lastRangeColStart === range.colStart &&
          lastRangeColEnd === range.colEnd &&
          lastRangeRowEnd + 1 === range.rowStart
      }

      // TODO - we should make ths faster by not cloning
      if (mergeCandidate) {
        let destination:RangeCoordValue | null | undefined = {
          colStart: lastRangeColStart,
          rowStart: lastRangeRowStart,
          colEnd: isColumn ? range.colEnd : lastRangeColEnd,
          rowEnd: isColumn ? lastRangeRowEnd : range.rowEnd,
        }
        if (lastRange.value !== undefined) {
          destination.value = lastRange.value;
        }

        if (getMerge) {
          const array: [RangeCoordValue | null, RangeCoordValue | null] = reuseArray ?? [null, null];
          array[0] = lastRange;
          array[1] = range;
          destination = getMerge(array as [RangeCoordValue, RangeCoordValue], destination, axis);
        }
        if (destination) {
          merged[mergedIndex] = destination;
          didMerge = true;
          lastRange = destination;
          lastRangeColStart = lastRange.colStart;
          lastRangeRowStart = lastRange.rowStart;
          lastRangeColEnd = lastRange.colEnd;
          lastRangeRowEnd = lastRange.rowEnd;
          continue;
        }
      }
      merged[++mergedIndex] = range; // not merged
      lastRange = range;
      lastRangeColStart = lastRange.colStart;
      lastRangeRowStart = lastRange.rowStart;
      lastRangeColEnd = lastRange.colEnd;
      lastRangeRowEnd = lastRange.rowEnd;
      // merged.push(range); // not merged
    }
    count++;
    isColumn = !isColumn; // swap axis
    // we set the first didMerge to true so that we try at least 2
    if (count === 1) {
      didMerge = true;
    }
  } while (count < iterations && didMerge && merged.length > 1);

  return merged;
}

/**
 * Interface for incrementally building ranges against minor and optionally major.
 */
export interface IConflatingRanges<T=any> {
  append: (major: number, minor: number, value?: T) => void;
  done: (merge?: boolean | ((from: [RangeCoordValue, b: RangeCoordValue], destination: RangeCoords, axis: RangeAxis) => RangeCoords | null | undefined)) => RangeCoordValue<T>[];
}

/**
 * Returns api for incrementally building ranges against minor and optionally major.
 *
 * @param canMerge A function that can merge values.
 * @param isColumn A flag indicating the ranges are column based. Defaults to `false` (row).
 * @remarks
 * Assumes ordered writes.
 */
export function createConflatingRanges<T=any>(
  canMerge?: (a: T, b: T, isColumn: boolean) => T,
  isColumn: boolean=false
): IConflatingRanges<T> {
  const ranges:RangeCoordValue<T>[] = [];
  let lastRange:RangeCoordValue<T> | null = null;
  let lastValue:T | undefined;
  let lastMajor:number = Number.MIN_SAFE_INTEGER;
  let lastMinor:number = Number.MIN_SAFE_INTEGER;
  const append = (major: number, minor: number, value?: T): void => {
    let merge:boolean = true;
    const isValueDefined = value !== undefined;
    if (isValueDefined) {
      const mergeValue:T | undefined = canMerge ? canMerge(lastValue as T, value!, isColumn) : ((lastValue === value) ? value : undefined);
      if (mergeValue === undefined) {
        merge = false;
      } else {
        value = mergeValue;
      }
    }

    if (merge && minor === lastMinor + 1 && major === lastMajor) {
      if (isColumn)
        lastRange!.rowEnd = minor;
      else
      lastRange!.colEnd = minor;
      lastMinor = minor;
      lastValue = value;
      return;
    }
    if (lastRange) {
      ranges.push(lastRange);
    }
    const colIndex = isColumn ? major : minor;
    const rowIndex = isColumn ? minor : major;
    lastRange = {
      colStart: colIndex,
      rowStart: rowIndex,
      colEnd: colIndex,
      rowEnd: rowIndex
    };
    if (isValueDefined) {
      lastRange.value = value;
    }

    lastMajor = major;
    lastMinor = minor;
    lastValue = value;
  }

  const done = (
    merge?: boolean | ((from: [RangeCoordValue, b: RangeCoordValue], destination: RangeCoords, axis: RangeAxis) => RangeCoords | null | undefined)
  ): RangeCoordValue<T>[] => {
    if (lastRange) {
      ranges.push(lastRange);
      lastRange = null;
    }
    if (!merge) return ranges;
    const mergeFn = merge === true ? defaultEntryMerge : merge;
    return mergeRangeCoordValues(ranges, 3, mergeFn, isColumn ? RangeAxis.Column : RangeAxis.Row, _reuseEntryMergeArray);
  }
  return {
    append,
    done
  }
}

/**
 * What becomes of the space a CUT range vacates when its block is INSERTED elsewhere - the
 * Shift-drag drop, and the `insertFrom({ isCut: true })` behind it.
 *
 * @remarks
 * Both ends of that operation classify here so they can never disagree: the model, which performs
 * the shift, and the drag preview, which has to say whether a release will be refused before the
 * model is ever called. Applies to a cut and destination on the SAME sheet; a cut lifted from
 * another sheet is always {@link InsertCutShift.Blank}, its gap having nothing to close into.
 */
export const InsertCutShift = {
  /**
   * The gap closes: cells behind the cut slide back along the axis. That closure carries the
   * destination with it when the destination sits after the cut, so the block still lands on the
   * line it was dropped on.
   */
  Close: 'close',
  /** The gap stays open - the source is blanked where it sits and the block lands exactly where drawn. */
  Blank: 'blank',
  /** Refused: the insert line falls inside the very block being cut. */
  Inside: 'inside',
  /** Refused: the insert would shift only PART of the cut, which no rectangle describes. */
  Tear: 'tear'
} as const;
export type InsertCutShift = typeof InsertCutShift[keyof typeof InsertCutShift];

/**
 * Which of the four {@link InsertCutShift} outcomes inserting `insert` while cutting `cut` produces.
 *
 * The gap closes only when the two share a band across `axis` - the cut then shifts as a whole, and
 * a whole shift is the only kind a rectangle can express. Off that band the source is simply blanked
 * unless the insert would drag part of the cut along with it, which is refused. Excel draws the
 * same four lines.
 *
 * @param cut The range being cut.
 * @param insert Where the block lands, sized as dropped - its LEADING edge on `axis` is the line.
 * @param axis Which way the existing cells shift: `Row` down, `Column` right.
 */
export function classifyInsertCut(cut: RangeCoords, insert: RangeCoords, axis: RangeAxis): InsertCutShift {
  const isRow = axis === RangeAxis.Row;
  const isAligned = isRow
    ? (cut.colStart === insert.colStart && cut.colEnd === insert.colEnd)
    : (cut.rowStart === insert.rowStart && cut.rowEnd === insert.rowEnd);
  if (isAligned) {
    /* The line has to be OUTSIDE the block. Landing it within means closing a gap the block is
       still sitting in. The line immediately past either end is fine - that is the no-op drop. */
    const isInside = isRow
      ? (insert.rowStart > cut.rowStart && insert.rowStart <= cut.rowEnd)
      : (insert.colStart > cut.colStart && insert.colStart <= cut.colEnd);
    return isInside ? InsertCutShift.Inside : InsertCutShift.Close;
  }
  /* Off the band the shift still reaches the cut if the cut sits at or after the insert line and
     the two cross - it would then move some of the cut's rows/columns and not the others. */
  const isDisplaced = isRow
    ? (cut.rowEnd >= insert.rowStart && cut.colStart <= insert.colEnd && cut.colEnd >= insert.colStart)
    : (cut.colEnd >= insert.colStart && cut.rowStart <= insert.rowEnd && cut.rowEnd >= insert.rowStart);
  return isDisplaced ? InsertCutShift.Tear : InsertCutShift.Blank;
}

/** Whether an {@link InsertCutShift} is one of the two refusals - a drop that cannot be performed. */
export function isRefusedInsertCut(shift: InsertCutShift): boolean {
  return shift === InsertCutShift.Inside || shift === InsertCutShift.Tear;
}
