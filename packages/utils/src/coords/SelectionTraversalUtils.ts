import { Direction } from '../types/Types';

import { type CellCoords, type RangeCoords, type SelectionCoords } from './Types';
import {
  isEqualSelectionCoords, isRangesIntersect, isRangeWithinRange, intersectRanges
} from './CoordUtils';

/**
 * Callback that reports how many consecutive headers (rows or columns) are hidden starting at
 * `index`. Returns `0` when `index` itself is visible. Used to skip hidden headers while traversing.
 *
 * @param index The header index to test.
 * @param reverse Scan toward lower indices (used when moving Up/Left).
 */
export interface HiddenHeadersAt {
  (index: number, reverse?: boolean): number;
}

/**
 * Scans from `index` in `direction` until it lands on a visible (non-hidden) header.
 *
 * @param hiddenAt Hidden-header port. When omitted, `index` is returned unchanged.
 * @param index The index to start from.
 * @param direction The direction to scan.
 * @param limit The furthest **visible, in-bounds** header the scan may reach (inclusive). When every
 *   header from `index` to the grid edge is hidden, the scan would otherwise march off the grid and
 *   return an out-of-range index; instead it stops and returns `limit`. Omit to scan unbounded.
 *
 * @remarks
 * Only safe when the caller guarantees a visible header exists ahead.
 */
export function traverseHiddenHeaders(
  hiddenAt: HiddenHeadersAt | undefined,
  index: number,
  direction: Direction,
  limit?: number
): number {
  if (!hiddenAt)
    return index;
  let newIndex = index;
  const forward = (direction === Direction.Right || direction === Direction.Down);
  while (true) {
    const hiddenCount = hiddenAt(newIndex, !forward);
    if (hiddenCount === 0)
      return newIndex;
    const candidate = forward ? newIndex + hiddenCount : newIndex - hiddenCount;
    // Every header from here to the edge is hidden — skipping them all would run past the grid. Stop
    // at the caller's visible in-bounds `limit` rather than returning an out-of-range index.
    if (limit !== undefined && (forward ? candidate > limit : candidate < limit))
      return limit;
    newIndex = candidate;
  }
}

/**
 * Cycles the **active cell** to the next cell *within the current selection*, the Tab/Enter
 * traversal (it never changes which ranges are selected — only the active cell and active range
 * index). Semantics:
 * - **wraps** at a range edge to the next row/column of that range;
 * - **visits each cell once** (steps over a merged cell after its first visit);
 * - **jumps to the next range** (cycling) when stepping off the last corner of the active range;
 * - **skips hidden** rows/columns via the optional ports.
 *
 * Pure: it holds no sheet/grid state — merged cells and hidden headers come in through the
 * {@link GetRangeFromCell} / {@link HiddenHeadersAt} ports. The merge-unaware caller passes
 * `CoordUtils.cellToRange` and no hidden ports. Returns the new {@link SelectionCoords} (the
 * `ranges` reference is preserved), or `selection` unchanged when the active cell is outside the
 * active range.
 *
 * @param selection The current selection.
 * @param direction The step direction (Right/Left/Down/Up).
 * @param getRangeFromCell Merged-cell lookup port.
 * @param hiddenRowsAt Hidden-row port (optional).
 * @param hiddenColumnsAt Hidden-column port (optional).
 * @param originalSelection Internal — the start selection, used to stop the recursive scan after a
 *   full loop (do not pass).
 */
export function findNextCellWithinSelection(
  selection: SelectionCoords,
  direction: Direction = Direction.Right,
  getRangeFromCell: (coords: CellCoords) => RangeCoords,
  hiddenRowsAt?: HiddenHeadersAt,
  hiddenColumnsAt?: HiddenHeadersAt,
  originalSelection: SelectionCoords | null = null
): SelectionCoords {
  // Recursed all the way back to the start (everything else was hidden) — stop.
  if (originalSelection && isEqualSelectionCoords(originalSelection, selection))
    return selection;

  // The traversal requires a fully-populated selection; `ranges`/`rangeIndex` are only optional
  // on the SelectionCoords interface for sparse (single-cell) selections.
  const ranges = selection.ranges!;
  const rangeIndex = selection.rangeIndex!;
  const range = ranges[rangeIndex];

  if (!isRangesIntersect({
      rowStart: selection.cell.rowIndex,
      colStart: selection.cell.colIndex,
      rowEnd: selection.cell.rowIndex,
      colEnd: selection.cell.colIndex
  }, range)) return selection;

  let nextActiveCell: CellCoords = { ...selection.cell };
  let nextActiveRangeIndex = rangeIndex;

  // Try to move one cell. Bound the hidden-skip to one past the range edge: if every header from
  // here to the edge is hidden the scan stops at `range.edge ± 1` (which still trips the "stepped off
  // the corner" checks below → wrap / next range) instead of marching off the grid.
  switch (direction) {
    case Direction.Right:
      nextActiveCell.colIndex = traverseHiddenHeaders(hiddenColumnsAt, nextActiveCell.colIndex + 1, direction, range.colEnd + 1);
      break;
    case Direction.Left:
      nextActiveCell.colIndex = traverseHiddenHeaders(hiddenColumnsAt, nextActiveCell.colIndex - 1, direction, range.colStart - 1);
      break;
    case Direction.Down:
      nextActiveCell.rowIndex = traverseHiddenHeaders(hiddenRowsAt, nextActiveCell.rowIndex + 1, direction, range.rowEnd + 1);
      break;
    case Direction.Up:
      nextActiveCell.rowIndex = traverseHiddenHeaders(hiddenRowsAt, nextActiveCell.rowIndex - 1, direction, range.rowStart - 1);
      break;
  }

  const traverseRanges = (forward: boolean): void => {
    if (forward) {
      nextActiveRangeIndex = rangeIndex >= ranges.length - 1 ? 0 : rangeIndex + 1;
      const nextRange = ranges[nextActiveRangeIndex];
      nextActiveCell = { colIndex: nextRange.colStart, rowIndex: nextRange.rowStart };
    } else {
      nextActiveRangeIndex = rangeIndex <= 0 ? ranges.length - 1 : rangeIndex - 1;
      const nextRange = ranges[nextActiveRangeIndex];
      nextActiveCell = { colIndex: nextRange.colEnd, rowIndex: nextRange.rowEnd };
    }
  };

  // If we stepped off the corner of the selection, traverse to the start of the next range (or self).
  if (direction === Direction.Right &&
    nextActiveCell.colIndex > range.colEnd &&
    nextActiveCell.rowIndex === range.rowEnd) {
      traverseRanges(true);
  } else if (direction === Direction.Left &&
    nextActiveCell.colIndex < range.colStart &&
    nextActiveCell.rowIndex === range.rowStart) {
      traverseRanges(false);
  } else if (direction === Direction.Down &&
    nextActiveCell.colIndex === range.colEnd &&
    nextActiveCell.rowIndex > range.rowEnd) {
      traverseRanges(true);
  } else if (direction === Direction.Up &&
    nextActiveCell.colIndex === range.colStart &&
    nextActiveCell.rowIndex < range.rowStart) {
      traverseRanges(false);
  } else { // in the middle — wrap to the next row/column of the same range
    let rowIndex: number = nextActiveCell.rowIndex;
    let colIndex: number = nextActiveCell.colIndex;

    // The wrap to the next row/column: bound to one past the perpendicular range edge (same reasoning
    // as the primary move) so a fully-hidden run doesn't march off the grid before the `> range.rowEnd`
    // / `< range.rowStart` reset below folds it back to the range start.
    switch (direction) {
      case Direction.Right:
        if (colIndex > range.colEnd) {
          rowIndex = traverseHiddenHeaders(hiddenRowsAt, rowIndex + 1, direction, range.rowEnd + 1);
          colIndex = range.colStart;
          if (rowIndex > range.rowEnd) {
            rowIndex = range.rowStart;
          }
        }
        break;
      case Direction.Left:
        if (colIndex < range.colStart) {
          rowIndex = traverseHiddenHeaders(hiddenRowsAt, rowIndex - 1, direction, range.rowStart - 1);
          colIndex = range.colEnd;
          if (rowIndex < range.rowStart) {
            rowIndex = range.rowEnd;
          }
        }
        break;
      case Direction.Down:
        if (rowIndex > range.rowEnd) {
          colIndex = traverseHiddenHeaders(hiddenColumnsAt, colIndex + 1, direction, range.colEnd + 1);
          rowIndex = range.rowStart;
          if (colIndex > range.colEnd) {
            colIndex = range.colStart;
          }
        }
        break;
      case Direction.Up:
        if (rowIndex < range.rowStart) {
          colIndex = traverseHiddenHeaders(hiddenColumnsAt, colIndex - 1, direction, range.colStart - 1);
          rowIndex = range.rowEnd;
          if (colIndex < range.colStart) {
            colIndex = range.colEnd;
          }
        }
        break;
    }
    nextActiveCell = { rowIndex, colIndex };
  }

  // See if we landed inside a merged cell.
  let nextCoordsRange = getRangeFromCell(nextActiveCell);
  if (!isRangeWithinRange(nextCoordsRange, range)) {
    // If it intersects we are in a merged cell straddling the edge; otherwise go to the next range.
    const intersectedRange = intersectRanges(nextCoordsRange, range);
    if (intersectedRange) {
      nextCoordsRange = intersectedRange;
    }
  }

  // Account for the merged cell being partially hidden — pull each edge inward to its first visible
  // header. Bound each scan to the OPPOSITE edge of the merge (`nextCoordsRange`): the visible portion
  // of the cell lives within it, so a fully-hidden edge stops at the merge boundary rather than
  // marching off the grid (the case that let an out-of-range cell escape for a hidden 1x1 at a
  // selection edge with everything beyond hidden).
  const nextVisibleRange: RangeCoords = {
    rowStart: traverseHiddenHeaders(hiddenRowsAt, nextCoordsRange.rowStart, Direction.Down, nextCoordsRange.rowEnd),
    colStart: traverseHiddenHeaders(hiddenColumnsAt, nextCoordsRange.colStart, Direction.Right, nextCoordsRange.colEnd),
    rowEnd: traverseHiddenHeaders(hiddenRowsAt, nextCoordsRange.rowEnd, Direction.Up, nextCoordsRange.rowStart),
    colEnd: traverseHiddenHeaders(hiddenColumnsAt, nextCoordsRange.colEnd, Direction.Left, nextCoordsRange.colStart)
  };

  if (nextVisibleRange.rowStart !== nextActiveCell.rowIndex || nextVisibleRange.colStart !== nextActiveCell.colIndex) {
    switch (direction) {
      case Direction.Right:
        if (ranges[nextActiveRangeIndex].colStart === nextVisibleRange.colStart &&
            ranges[nextActiveRangeIndex].colEnd === nextVisibleRange.colEnd) { // merge spans the full range
          nextActiveCell.rowIndex = nextVisibleRange.rowEnd;
        }
        nextActiveCell.colIndex = nextVisibleRange.colEnd;
        break;
      case Direction.Left:
        if (ranges[nextActiveRangeIndex].colStart === nextVisibleRange.colStart &&
            ranges[nextActiveRangeIndex].colEnd === nextVisibleRange.colEnd) { // merge spans the full range
          nextActiveCell.rowIndex = nextVisibleRange.rowStart;
        }
        if (nextActiveCell.rowIndex === nextVisibleRange.rowStart) {
          nextActiveCell.colIndex = nextVisibleRange.colStart + 1;
        } else {
          nextActiveCell.colIndex = nextVisibleRange.colStart;
        }
        break;
      case Direction.Down:
        if (ranges[nextActiveRangeIndex].rowStart === nextVisibleRange.rowStart &&
            ranges[nextActiveRangeIndex].rowEnd === nextVisibleRange.rowEnd) { // merge spans the full range
          nextActiveCell.colIndex = nextVisibleRange.colEnd;
        }
        nextActiveCell.rowIndex = nextVisibleRange.rowEnd;
        break;
      case Direction.Up:
        if (ranges[nextActiveRangeIndex].rowStart === nextVisibleRange.rowStart &&
            ranges[nextActiveRangeIndex].rowEnd === nextVisibleRange.rowEnd) { // merge spans the full range
          nextActiveCell.colIndex = nextVisibleRange.colStart;
        }
        if (nextActiveCell.colIndex === nextVisibleRange.colStart) {
          nextActiveCell.rowIndex = nextVisibleRange.rowStart + 1;
        } else {
          nextActiveCell.rowIndex = nextVisibleRange.rowStart;
        }
        break;
    }
    // Recursively scan for the next non-hidden cell.
    return findNextCellWithinSelection({
        cell: nextActiveCell,
        ranges: selection.ranges,
        rangeIndex: nextActiveRangeIndex
      },
      direction,
      getRangeFromCell,
      hiddenRowsAt,
      hiddenColumnsAt,
      originalSelection ?? selection);
  }

  return {
    ranges: selection.ranges,
    cell: nextActiveCell,
    rangeIndex: nextActiveRangeIndex
  };
}
