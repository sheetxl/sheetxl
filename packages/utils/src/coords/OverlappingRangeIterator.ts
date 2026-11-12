import * as CoordUtils from './CoordUtils';
import { RangeAxis, type CellCoords, type RangeCoords, type RangeCoordValue } from './Types';
import { RangeSweep, type PieceStore } from './_RangeSweep';

const DoneIteratorResult: IteratorResult<any, any> = Object.freeze({
  done: true,
  value: undefined
});

/**
 * Iterate over a collection of overlapping RangeCoords.
 *
 * This will iterator over CellCoords or RangeCoords.
 */

/* alias so that we can name our Iterator 'Iterator' */
type ESIterator<T, TReturn = any, TNext = undefined> = Iterator<T, TReturn, TNext>;

export namespace OverlappingRange {
  export interface IteratorOptions {
    /**
     * The direction of the scan.
     * @defaultValue RangeAxis.Row
     */
    axis?: RangeAxis;
    /**
     * Set iterator to increment by cells within an intersection.
     *
     * @defaultValue false
     *
     * @remarks
     * Depending on the range intersect it is possible that some scan lines will be duplicated.
     * This is desired as it makes merging ranges easier/possible.
     */
    byCell?: boolean;
    /**
     * Iterate in reverse order.
     * @defaultValue false
     */
    reverse?: boolean;
    /**
     * If provided then iterator results will reuse the return results.
     *
     * @defaultValue `undefined` (Creates new instances for each iterator)
     *
     * @remarks
     * - **Performance:** Removes the per-step allocations (the result, range, cell, and overlaps
     *   objects are mutated in place), which matters for large sweeps.
     * - **Safety:** A returned intersection is only valid until the next call to `next` — copy
     *   anything that is retained. Pass an `IteratorResult` to supply the reused buffer yourself.
     */
    reuseIterator?: boolean | IteratorResult<OverlappingRange.Intersection>;
  }

  /**
   * When iterating a cursor is used to track the
   * current location. The coords will always move forward.
   */
  export interface Intersection {
    /**
     * The current coords.
     */
    cell: CellCoords;
    /**
     * This is a non-overlapping virtual range.
     *
     * @remarks
     * This is not guaranteed to be the smallest packing size.
     */
    range: RangeCoords;
    /**
     * All ranges at the intersection. This may be a single range.
     */
    overlaps: RangeCoordValue[];
  }

  export type Iterator = ESIterator<Intersection, Intersection, CellCoords>;

  /** The sweep materializes a region's overlap set as the overlapping values themselves. */
  class OverlapsSweep extends RangeSweep<RangeCoordValue[]> {
    /**
     * When set, `_materialize` refills and returns this single buffer instead of allocating —
     * the reuse contract. Region stepping only: the byCell region cache must keep distinct arrays.
     */
    _reuseOverlaps: RangeCoordValue[] | null = null;
    protected _materialize(region: number): RangeCoordValue[] {
      const rOff = this._rOff;
      const pool = this._pool;
      const values = this._store.value;
      const start = rOff[region];
      const end = rOff[region + 1];
      // built by push so v8 keeps the elements PACKED (new Array(n) is holey for good)
      let overlaps = this._reuseOverlaps;
      if (overlaps) overlaps.length = 0;
      else overlaps = [];
      for (let i=start; i<end; i++) overlaps.push(values[pool[i]]);
      return overlaps;
    }
  }

  /**
   * An adapter over the shared line-sweep engine (`_RangeSweep`): the ranges become pieces (their
   * input order is the stable order), the sweep partitions them into non-overlapping regions, and
   * each step is handed out as a fresh {@link Intersection}.
   */
  export class IteratorInstance implements Iterator, IterableIterator<Intersection> {
    private _sweep: OverlapsSweep | null = null;
    private _isByCell: boolean = false;
    /* scan-order comparator (byCell), for validating seek targets */
    private _cellComparator: ((a: CellCoords, b: CellCoords) => number) | null = null;
    /* the last returned cell (byCell); seeks must land strictly after it. Owned by this iterator
       (mutated in place on the reuse path), never the object handed to the consumer. */
    private _lastCell: CellCoords | null = null;
    /* the in-place result when `reuseIterator` is set */
    private _reuse: IteratorResult<Intersection> | null = null;

    constructor(ranges: readonly RangeCoordValue[], options?: IteratorOptions) {
      if (!ranges || ranges.length === 0)
        return;

      let isColumn = true;
      let isReverse = false;
      let isByCell = false;
      let reuse: boolean | IteratorResult<Intersection> | undefined;
      if (options) {
        isColumn = (options.axis ?? RangeAxis.Column) !== RangeAxis.Row;
        isReverse = options.reverse ?? false;
        isByCell = options.byCell ?? false;
        reuse = options.reuseIterator;
      }
      this._isByCell = isByCell;
      if (reuse) {
        const result: IteratorResult<Intersection> = typeof reuse === 'boolean'
          ? { done: false, value: { cell: null!, range: null!, overlaps: null! } }
          : reuse;
        result.done = false;
        let value = result.value;
        if (!value) value = result.value = { cell: null!, range: null!, overlaps: null! };
        if (!value.range) value.range = { colStart: 0, rowStart: 0, colEnd: 0, rowEnd: 0 };
        value.cell = isByCell ? (value.cell ?? { colIndex: -1, rowIndex: -1 }) : null!;
        this._reuse = result;
      }

      const n = ranges.length;
      const store: PieceStore = {
        count: n,
        rowS: new Int32Array(n),
        rowE: new Int32Array(n),
        colS: new Int32Array(n),
        colE: new Int32Array(n),
        type: new Uint16Array(n), // a single type: the range itself
        value: [], // filled by push below: v8 keeps it PACKED
        keys: ['range']
      };
      let rowMin = Number.MAX_SAFE_INTEGER;
      let rowMax = Number.MIN_SAFE_INTEGER;
      let colMin = Number.MAX_SAFE_INTEGER;
      let colMax = Number.MIN_SAFE_INTEGER;
      for (let i=0; i<n; i++) {
        const range = ranges[i];
        store.rowS[i] = range.rowStart;
        store.rowE[i] = range.rowEnd;
        store.colS[i] = range.colStart;
        store.colE[i] = range.colEnd;
        // overlaps hand out the original objects. The legacy iterator froze them because it swept
        // over the live ranges; the sweep snapshots the coords into typed arrays here, so a caller
        // mutation can no longer corrupt the scan and the (per-object, costly) freeze is dropped.
        store.value.push(range);
        if (range.rowStart < rowMin) rowMin = range.rowStart;
        if (range.rowEnd > rowMax) rowMax = range.rowEnd;
        if (range.colStart < colMin) colMin = range.colStart;
        if (range.colEnd > colMax) colMax = range.colEnd;
      }
      const bounds: RangeCoords = { rowStart: rowMin, rowEnd: rowMax, colStart: colMin, colEnd: colMax };
      const sweep = this._sweep = new OverlapsSweep(store, bounds, isColumn, isReverse);
      if (isByCell) {
        this._cellComparator = CoordUtils.createCellComparator(isColumn ? RangeAxis.Column : RangeAxis.Row, isReverse);
      } else if (reuse) {
        // region stepping under reuse never allocates: one overlaps buffer, refilled per region
        sweep._reuseOverlaps = [];
      }
    }

    /**
     * Returns the next Intersection as a IteratorResult.
     */
    next(nextCell?: CellCoords): IteratorResult<Intersection> {
      const sweep = this._sweep;
      if (!sweep) return DoneIteratorResult;

      const isByCell = this._isByCell;
      let hasNext: boolean;
      if (nextCell) {
        if (!isByCell) {
          throw new Error('nextCell is only supported when byCell is true');
        }
        const lastCell = this._lastCell;
        if (lastCell && this._cellComparator!(lastCell, nextCell) >= 0) {
          throw new Error('nextCell must be after the current iteration cell');
        }
        hasNext = sweep.seekCell(nextCell.rowIndex, nextCell.colIndex);
      } else {
        hasNext = isByCell ? sweep.nextCell() : sweep.nextRegion();
      }
      if (!hasNext) {
        this._sweep = null;
        return DoneIteratorResult;
      }

      const reuse = this._reuse;
      if (reuse) {
        // in-place: nothing allocates per step. By cell the overlaps are the region's array
        // (stable until the region is left); the reuse contract makes handing it out safe.
        const value = reuse.value;
        reuse.done = false;
        const range = value.range;
        range.colStart = sweep.colStart;
        range.rowStart = sweep.rowStart;
        range.colEnd = sweep.colEnd;
        range.rowEnd = sweep.rowEnd;
        if (isByCell) {
          const cell = value.cell;
          cell.colIndex = sweep.cellCol;
          cell.rowIndex = sweep.cellRow;
          let lastCell = this._lastCell;
          if (!lastCell) lastCell = this._lastCell = { colIndex: 0, rowIndex: 0 };
          lastCell.colIndex = sweep.cellCol;
          lastCell.rowIndex = sweep.cellRow;
        }
        value.overlaps = sweep.intersection;
        return reuse;
      }

      let cell: CellCoords = null!; // null when !byCell; Intersection.cell does not model this
      // Fresh objects per step: consumers may retain the intersection. By cell the sweep shares one
      // overlaps array across the cells of a region, so it is copied; by region it is already fresh.
      let overlaps = sweep.intersection;
      if (isByCell) {
        cell = this._lastCell = { colIndex: sweep.cellCol, rowIndex: sweep.cellRow };
        overlaps = overlaps.slice();
      }
      return {
        done: false,
        value: {
          cell,
          range: {
            colStart: sweep.colStart,
            rowStart: sweep.rowStart,
            colEnd: sweep.colEnd,
            rowEnd: sweep.rowEnd
          },
          overlaps
        }
      };
    }

    return(_value?: Intersection): IteratorResult<Intersection> {
      return DoneIteratorResult;
    }
    throw(_e?: any): IteratorResult<Intersection> {
      return DoneIteratorResult;
    }

    [Symbol.iterator](): IterableIterator<Intersection> {
      return this;
    }
  }
}
