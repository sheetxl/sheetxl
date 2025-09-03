import {
  CellCoords, RangeCoords, RangeOrientation, SelectionCoords, RangedValue
} from './Types';

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
 * Comparator that sorts ranges by column then row.
 */
export const columnFirstRangeComparator = (a: RangeCoords, b: RangeCoords): number => {
  if (a.colStart === b.colStart)
    return a.rowStart - b.rowStart;
  return a.colStart - b.colStart;
}

/**
 * Comparator that sorts ranges by row then column.
 */
export const rowFirstRangeComparator = (a: RangeCoords, b: RangeCoords): number => {
  if (a.rowStart === b.rowStart)
    return a.colStart - b.colStart;
  return a.rowStart - b.rowStart;
}

const reverseRowFirstRangeComparator = (a: RangeCoords, b: RangeCoords): number => {
  if (a.rowEnd === b.rowEnd)
    return b.colEnd - a.colEnd;
  return b.rowEnd - a.rowEnd;
}

const reverseColumnFirstRangeComparator = (a: RangeCoords, b: RangeCoords): number => {
  if (a.colEnd === b.colEnd)
    return b.rowEnd - a.rowEnd;
  return b.colEnd - a.colEnd;
}

/**
 * Comparator that sorts coords by column then row.
 * Returns > 1 if a is before b.
 */
export const columnFirstCellComparator = (a: CellCoords, b: CellCoords): number => {
  if (a.colIndex === b.colIndex)
    return a.rowIndex - b.rowIndex;
  return a.colIndex - b.colIndex;
}

/**
 * Comparator that sorts coords by row then column.
 */
export const rowFirstCellComparator = (a: CellCoords, b: CellCoords): number => {
  if (a.rowIndex === b.rowIndex)
    return a.colIndex - b.colIndex;
  return a.rowIndex - b.rowIndex;
}

/**
 * Comparator that sorts coords by row then column reversed
 */
export const reverseRowFirstCellComparator = (a: CellCoords, b: CellCoords): number => {
  if (a.rowIndex === b.rowIndex)
    return b.colIndex - a.colIndex;
  return b.rowIndex - a.rowIndex;
}

/**
 * Comparator that sorts coords by column then row reversed
 */
export const reverseColumnFirstCellComparator = (a: CellCoords, b: CellCoords): number => {
  if (a.colIndex === b.colIndex)
    return b.rowIndex - a.rowIndex;
  return b.colIndex - a.colIndex;
}

/**
 * Returns a Comparator for ranges with support for range orientation and reverse.
 */
export const createRangeComparator = (
  orientation: RangeOrientation=RangeOrientation.Row,
  reverse: boolean=false
): ((a: RangeCoords, b: RangeCoords) => number) => {
  if (!reverse) {
    if (orientation !== RangeOrientation.Column) {
      return rowFirstRangeComparator;
    } else {
      return columnFirstRangeComparator
    }
  }

  if (orientation !== RangeOrientation.Column) {
    return reverseRowFirstRangeComparator;
  } else {
    return reverseColumnFirstRangeComparator
  }
}



/**
 * Returns a Comparator for cells with support for range orientation and reverse.
 */
export const createCellComparator = (orientation: RangeOrientation=RangeOrientation.Row, reverse: boolean=false): ((a: CellCoords, b: CellCoords) => number) => {
  if (!reverse) {
    if (orientation !== RangeOrientation.Column)
      return rowFirstCellComparator;
    else
      return columnFirstCellComparator
  }

  if (orientation !== RangeOrientation.Column) {
    return reverseRowFirstCellComparator;
  } else {
    return reverseColumnFirstCellComparator;
  }
}

/**
 * Check if two coords are equal.
 * @param a First CellCoords
 * @param b Second CellCoords
 */
export const isEqualCells = (a: CellCoords | null, b: CellCoords | null): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.rowIndex !== b.rowIndex) return false;
  if (a.colIndex !== b.colIndex) return false;
  return true;
};

/**
 * Check if two ranges are equal.
 *
 * @param a First RangeCoords
 * @param b Second RangeCoords
 *
 * @remarks
 * Null safe
 */
export const isEqualRanges = (a?: RangeCoords, b?: RangeCoords): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;

  if (a.rowStart !== b.rowStart || a.rowEnd !== b.rowEnd)
    return false;
  if (a.colStart !== b.colStart || a.colEnd !== b.colEnd)
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
export const isCellWithinRange = (cell: CellCoords, range: RangeCoords): boolean => {
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
 * @param inner Inner range.
 * @param outer Outer range.
 */
export const isRangeWithinRange = (inner: RangeCoords, outer: RangeCoords): boolean => {
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
export const isRangesIntersect = (a: RangeCoords, b: RangeCoords): boolean => {
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
 * @param a First Range Array.
 * @param b Second Range Array.
 */
export const isEqualRangesArrays = (a?: readonly RangeCoords[], b?: readonly RangeCoords[]): boolean => {
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
export const isSingleCell = (range: RangeCoords | undefined): boolean => {
  if (!range) return false;
  if (range.rowEnd !== range.rowStart || range.colStart !== range.colEnd)
    return false;
  return true;
};

/**
 * Create a 1x1 dimension RangeCoord from a CellCoords.
 *
 * @param coords
 * @param reused
 *
 * @remarks
 * Returns null if null is passed in.
 */
export const cellToRange = (coords: CellCoords, reused?: RangeCoords): RangeCoords => {
  if (!coords)
    return null;
  let asRange = reused;
  if (!asRange) {
    asRange = {
      ...coords, // We want to capture any additional info (like sheetName).
    } as unknown as RangeCoords;
    delete (asRange as unknown as CellCoords).colIndex;
    delete (asRange as unknown as CellCoords).rowIndex;
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
export const intersectRanges = (a: RangeCoords, b: RangeCoords, reuse?: RangeCoords): RangeCoords => {
  if (!a) return reuse ? b : {...b}; // should intersect null return null?
  if (!b) return reuse ? a : {...a}; // should intersect null return null?
  if (!a && !b) return null;
  if (a.rowStart > b.rowEnd || a.rowEnd < b.rowStart || a.colStart > b.colEnd || a.colEnd < b.colStart)
    return null;
  const colStart = Math.max(a.colStart, b.colStart);
  const rowStart = Math.max(a.rowStart, b.rowStart);
  const colEnd = Math.min(a.colEnd, b.colEnd);
  const rowEnd = Math.min(a.rowEnd, b.rowEnd);

  let retValue:RangeCoords = reuse;
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
  return retValue
};

/**
 * Finds the union of 2 ranges.
 *
 * @remarks
 * This is `null` safe.
 */
export const unionRanges = (a: RangeCoords, b: RangeCoords, reuse?: RangeCoords): RangeCoords => {
  if (!a && !b) return null;
  if (!a) return reuse ? b : {...b};
  if (!b) return reuse ? a : {...a};

  const colStart = Math.min(a.colStart, b.colStart);
  const rowStart = Math.min(a.rowStart, b.rowStart);
  const colEnd = Math.max(a.colEnd, b.colEnd);
  const rowEnd = Math.max(a.rowEnd, b.rowEnd);

  let retValue:RangeCoords = reuse;
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
  return retValue
};


/**
 * Returns an index for the first range that the coord is contained within or -1 if not found.
 */
export const indexOfCoords = (coords: CellCoords, ranges: readonly RangeCoords[]): number => {
  const cellAsRange = {
    colStart: coords.colIndex,
    rowStart: coords.rowIndex,
    colEnd: coords.colIndex,
    rowEnd: coords.rowIndex
  }
  for (let i=ranges.length-1; i>=0; i--)
    if (isRangesIntersect(cellAsRange, ranges[i]))
      return i;
  return -1;
};

/**
 * Compares two SelectionCoords.
 * @param a First SelectionCoords
 * @param b Second SelectionCoords
 * @returns A flag indicating the values are logically the same.
 */
// TODO - Sheet is using this but shouldn't be required.
export const isEqualSelectionCoords = (a: SelectionCoords, b: SelectionCoords): boolean => {
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
export const unionRangesArrays = (ranges: readonly RangeCoords[], range?: RangeCoords, reuse?: RangeCoords): RangeCoords => {
  if (!ranges|| ranges.length === 0)
    return null;
  if (ranges.length === 1 && !range)
    return ranges[0];
  let union = ranges[0];
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
// export const isValidCell = (cell: CellCoords): boolean => {
//   if (!cell) return false;
//   if (typeof cell.colIndex !== 'number' || cell.colIndex < 0) return false;
//   if (typeof cell.rowIndex !== 'number' || cell.rowIndex < 0) return false;
//   return true;
// }

/**
 * Validate a RangeCoords.
 * @param range The range to validate.
 */
export const isValidRange = (range: RangeCoords): boolean => {
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
export const extendRangeToUnionRanges = (range: Readonly<RangeCoords>, ranges: Readonly<RangeCoords[]>): RangeCoords => {
  if (!ranges || ranges.length === 0) return range;
  // We want to return a unioned merged. ranges may only return the intersection.
  let lastRange:RangeCoords = range;
  let currentRange:RangeCoords = null;
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
export const extendRangeToIntersectingRanges = (range: Readonly<RangeCoords>, ranges: Readonly<RangeCoords[]>): RangeCoords => {
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
export const translateRange = (range: RangeCoords, rowIndex: number=-range.rowStart, colIndex: number=-range.colStart, reuseRange?: RangeCoords): RangeCoords => {
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
export const sanitizeRange = (rangeOrCoords: RangeCoords | CellCoords): RangeCoords => {
  if (!rangeOrCoords)
    return null;
  return {
    colStart: (rangeOrCoords as CellCoords).colIndex ?? (rangeOrCoords as RangeCoords).colStart ?? 0,
    rowStart: (rangeOrCoords as CellCoords).rowIndex ?? (rangeOrCoords as RangeCoords).rowStart ?? 0,
    colEnd: (rangeOrCoords as CellCoords).colIndex ?? (rangeOrCoords as RangeCoords).colEnd ?? 0,
    rowEnd: (rangeOrCoords as CellCoords).rowIndex ?? (rangeOrCoords as RangeCoords).rowEnd ?? 0
  }
}

/**
 * Ensure a partial range has default values
 */
export const defaultRange = (range: Partial<RangeCoords>, defaultPartialRange: RangeCoords, reuseRange?: RangeCoords): RangeCoords => {
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

const _reuseEntryMergeArray: [null, null] = [null, null];

// const defaultCanMerge = <T>(a: T, b: T, _isColumn: boolean): T => {
//   if (a === b) return b;
// }

const defaultEntryMerge = (from: [RangedValue, b: RangedValue], destination: RangeCoords, orientation: RangeOrientation): RangeCoords | null | undefined => {
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
 * * Setting to '1' will remove overlaps in the initial orientation.
 * * Setting to '2' will remove most overlaps but may miss overlaps that resulted from the previous iterations.
 * * Setting to 'Number.MAX_SAFE_INTEGER' will run until no more ranges can be merged.
 */
export function mergeRangedValues(
  ranges: RangedValue[],
  iterations: number=2,
  getMerge?: (from: [RangedValue, b: RangedValue], destination: RangedValue, orientation: RangeOrientation) => RangedValue | null | undefined,
  orientation: RangeOrientation=RangeOrientation.Row,
  reuseArray?: [null, null]
): RangedValue[] {
  let merged:RangedValue[] = [...ranges]; // for sort. what's a better way?
  if (iterations <= 0 || ranges.length <= 1) return merged;

  let isColumn = orientation === RangeOrientation.Column;

  let count = 0;
  let didMerge = false;
  do {
    const toMerge = merged.sort(createRangeComparator(isColumn ? RangeOrientation.Row : RangeOrientation.Column));
    // TODO - further optimize but not creating a new array. instead just slice away the merge ranges.(we could also set merge value to null and splice or sort depending on merged counted)
    merged = [];

    merged.push(toMerge[0]);
    const toMergeLength = toMerge.length;
    let mergedIndex = 0;
    let lastRange:RangedValue = toMerge[0];
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
        let destination:RangedValue = {
          colStart: lastRangeColStart,
          rowStart: lastRangeRowStart,
          colEnd: isColumn ? range.colEnd : lastRangeColEnd,
          rowEnd: isColumn ? lastRangeRowEnd : range.rowEnd,
        }
        if (lastRange.value !== undefined) {
          destination.value = lastRange.value;
        }

        if (getMerge) {
          const array = reuseArray ?? [null, null];
          array[0] = lastRange;
          array[1] = range;
          destination = getMerge(array, destination, orientation);
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
    isColumn = !isColumn; // swap orientation
    // we set the first didMerge to true so that we try at least 2
    if (count === 1) {
      didMerge = true;
    }
  } while (count < iterations && didMerge && merged.length > 1);

  return merged;
}

export interface IConflatingRanges<T=any> {
  append: (major: number, minor: number, value?: T) => void;
  done: (merge?: boolean | ((from: [RangedValue, b: RangedValue], destination: RangeCoords, orientation: RangeOrientation) => RangeCoords | null | undefined)) => RangedValue<T>[];
}

/**
 * Returns api for incrementally building ranges against minor and optionally major.
 *
 * @param canMerge A function that can merge values.
 * @param isColumn A flag indicating the ranges are column based. Defaults to `false` (row).
 * @remarks
 * Assumes ordered writes.
 */
export const createConflatingRanges = <T=any>(
  canMerge?: (a: T, b: T, isColumn: boolean) => T,
  isColumn: boolean=false
): IConflatingRanges => {
  const ranges:RangedValue<T>[] = [];
  let lastRange:RangedValue<T>;
  let lastValue:T;
  let lastMajor:number = Number.MIN_SAFE_INTEGER;
  let lastMinor:number = Number.MIN_SAFE_INTEGER;
  const append = (major: number, minor: number, value?: T): void => {
    let merge:boolean = true;
    const isValueDefined = value !== undefined;
    if (isValueDefined) {
      const mergeValue:T = canMerge ? canMerge(lastValue, value, isColumn) : ((lastValue === value) ? value : undefined);
      if (mergeValue === undefined) {
        merge = false;
      } else {
        value = mergeValue;
      }
    }

    if (merge && minor === lastMinor + 1 && major === lastMajor) {
      if (isColumn)
        lastRange.rowEnd = minor;
      else
      lastRange.colEnd = minor;
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
    merge?: boolean | ((from: [RangedValue, b: RangedValue], destination: RangeCoords, orientation: RangeOrientation) => RangeCoords | null | undefined)
  ): RangedValue<T>[] => {
    if (lastRange) {
      ranges.push(lastRange);
      lastRange = null;
    }
    if (!merge) return ranges;
    const mergeFn = merge === true ? defaultEntryMerge : merge;
    return mergeRangedValues(ranges, 3, mergeFn, isColumn ? RangeOrientation.Column : RangeOrientation.Row, _reuseEntryMergeArray);
  }
  return {
    append,
    done
  }
}
