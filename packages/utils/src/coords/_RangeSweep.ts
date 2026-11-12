import { type RangeCoords } from './Types';

/*
 * The flat, allocation-free line-sweep engine over a set of (possibly overlapping) rectangles.
 *
 * The input is a `PieceStore`: rectangles in parallel typed arrays, each carrying a type key and a
 * value. The sweep walks the major axis in bands (maximal spans over which the set of intersecting
 * pieces is constant) and, within a band, the minor axis in intervals of constant, non-empty
 * overlap set. No per-event tree operations and no per-step allocation beyond what a subclass
 * materializes.
 *
 * A region's overlaps are always in STORE order (ascending piece index), whatever started or ended
 * before it. Callers fill the store in an order that can mean something — the sheet's conditional
 * formats arrive in priority order, and a cell takes the first rule that names a property — so the
 * sweep must hand that order back unchanged rather than one that depends on which piece ended where.
 *
 * Coordinates are ORIENTED internally: `M` is the major axis and `m` the minor, and a reverse scan
 * negates both so ascending order is the scan order in every mode.
 *
 * Subclasses decide what a region's overlap set becomes (`_materialize`): the sheet range-state
 * sweep merges values by type key into an intersection object; the generic overlapping-range
 * iterator returns the overlapping values themselves.
 */

/**
 * Pieces: the clipped entries of every searched map, in parallel arrays.
 * @internal
 */
export interface PieceStore {
  count: number;
  rowS: Int32Array;
  rowE: Int32Array;
  colS: Int32Array;
  colE: Int32Array;
  /** Index into `keys`. */
  type: Uint16Array;
  value: any[];
  keys: string[];
}

export const createPieceStore = (capacity: number=64): PieceStore => ({
  count: 0,
  rowS: new Int32Array(capacity),
  rowE: new Int32Array(capacity),
  colS: new Int32Array(capacity),
  colE: new Int32Array(capacity),
  type: new Uint16Array(capacity),
  value: [],
  keys: []
});

export const growInt32 = (arr: Int32Array, size: number): Int32Array => {
  if (arr.length >= size) return arr;
  const grown = new Int32Array(Math.max(size, arr.length * 2));
  grown.set(arr);
  return grown;
}

export const growPieces = (store: PieceStore, size: number): void => {
  if (store.rowS.length >= size) return;
  const capacity = Math.max(size, store.rowS.length * 2);
  store.rowS = growInt32(store.rowS, capacity);
  store.rowE = growInt32(store.rowE, capacity);
  store.colS = growInt32(store.colS, capacity);
  store.colE = growInt32(store.colE, capacity);
  const type = new Uint16Array(capacity);
  type.set(store.type);
  store.type = type;
}

/** Shared counting-sort buckets (grown on demand; the sweep is synchronous so one buffer serves all). */
let _buckets: Int32Array = new Int32Array(1024);
const buckets = (size: number): Int32Array => {
  if (_buckets.length < size) _buckets = new Int32Array(Math.max(size, _buckets.length * 2));
  _buckets.fill(0, 0, size);
  return _buckets;
}

/**
 * The sweep. Pieces are the input; bands and the regions inside them are computed lazily, one band
 * at a time, into reusable arrays. The consumer steps regions (`nextRegion`) or cells
 * (`nextCell` / `seekCell`) and reads the current position from the public fields.
 * @internal
 */
export abstract class RangeSweep<T> {
  private readonly _isColumn: boolean;
  private readonly _isReverse: boolean;
  protected readonly _store: PieceStore;
  private readonly _n: number;
  /* oriented piece extents */
  private readonly _M0: Int32Array;
  private readonly _M1: Int32Array;
  private readonly _m0: Int32Array;
  private readonly _m1: Int32Array;
  /* pieces sorted by M0 (stable) */
  private readonly _order: Int32Array;
  private _nextOrder: number = 0;
  /* active minor events (piece * 2 + isEnd), sorted */
  private _active: Int32Array;
  private _activeLen: number = 0;
  private _scratch: Int32Array;
  private _events: Int32Array = new Int32Array(64);
  /* current band (oriented) */
  private _hasBand: boolean = false;
  private _bandStart: number = 0;
  private _bandEnd: number = 0;
  /* regions of the current band */
  private _rMinS: Int32Array = new Int32Array(64);
  private _rMinE: Int32Array = new Int32Array(64);
  protected _rOff: Int32Array = new Int32Array(65);
  private _rCount: number = 0;
  protected _pool: Int32Array = new Int32Array(256);
  private _overlaps: Int32Array = new Int32Array(16);
  /* per-region intersection cache for multi-major bands stepped by cell */
  private _rInter: (T | undefined)[] | null = null;
  /* cursor */
  private _region: number = -1;
  private _major: number = 0; // oriented, by cell
  private _minor: number = 0; // oriented, by cell
  private _done: boolean = false;

  /* the current region, sheet coordinates */
  rowStart: number = 0;
  rowEnd: number = 0;
  colStart: number = 0;
  colEnd: number = 0;
  /* the current cell (by cell), sheet coordinates */
  cellRow: number = 0;
  cellCol: number = 0;
  intersection: T = null!;

  constructor(store: PieceStore, bounds: RangeCoords, isColumn: boolean, isReverse: boolean) {
    this._isColumn = isColumn;
    this._isReverse = isReverse;
    this._store = store;
    const n = store.count;
    this._n = n;
    const M0 = new Int32Array(n);
    const M1 = new Int32Array(n);
    const m0 = new Int32Array(n);
    const m1 = new Int32Array(n);
    const majS = isColumn ? store.colS : store.rowS;
    const majE = isColumn ? store.colE : store.rowE;
    const minS = isColumn ? store.rowS : store.colS;
    const minE = isColumn ? store.rowE : store.colE;
    for (let i=0; i<n; i++) {
      if (isReverse) {
        M0[i] = -majE[i]; M1[i] = -majS[i]; m0[i] = -minE[i]; m1[i] = -minS[i];
      } else {
        M0[i] = majS[i]; M1[i] = majE[i]; m0[i] = minS[i]; m1[i] = minE[i];
      }
    }
    this._M0 = M0; this._M1 = M1; this._m0 = m0; this._m1 = m1;

    // stable sort by M0: counting sort when the bounds are dense relative to the pieces
    // (the million-fragment case), comparator sort when they are sparse (a handful of pieces
    // spanning whole columns would otherwise pay a prefix pass over the entire axis).
    const boundsMajS = isColumn ? bounds.colStart : bounds.rowStart;
    const boundsMajE = isColumn ? bounds.colEnd : bounds.rowEnd;
    const range = boundsMajE - boundsMajS + 1;
    const order = new Int32Array(n);
    if (n < 256 || range > n * 16) {
      for (let i=0; i<n; i++) order[i] = i;
      order.sort((a, b) => (M0[a] - M0[b]) || (a - b));
    } else {
      const base = isReverse ? -boundsMajE : boundsMajS;
      const counts = buckets(range + 1);
      for (let i=0; i<n; i++) counts[M0[i] - base + 1]++;
      for (let i=1; i<=range; i++) counts[i] += counts[i - 1];
      for (let i=0; i<n; i++) order[counts[M0[i] - base]++] = i;
    }
    this._order = order;
    this._active = new Int32Array(Math.min(2 * n, 1024));
    this._scratch = new Int32Array(this._active.length);
  }

  /** Build the value of a region from its overlap set (pieces in `_pool[_rOff[region].._rOff[region+1])`). */
  protected abstract _materialize(region: number): T;

  /** Stable id of a piece in scan order (reverse scans invert the push order). */
  private _stable(piece: number): number {
    return this._isReverse ? this._n - 1 - piece : piece;
  }

  /** The minor-event order: closest edge, starts before ends, opposite edge, stable id. */
  private _compareEvents(a: number, b: number): number {
    const pa = a >> 1;
    const pb = b >> 1;
    const ea = a & 1;
    const eb = b & 1;
    const m0 = this._m0;
    const m1 = this._m1;
    const edgeA = ea ? m1[pa] : m0[pa];
    const edgeB = eb ? m1[pb] : m0[pb];
    if (edgeA !== edgeB) return edgeA - edgeB;
    if (ea !== eb) return ea - eb;
    const oppA = ea ? m0[pa] : m1[pa];
    const oppB = eb ? m0[pb] : m1[pb];
    if (oppA !== oppB) return oppA - oppB;
    return this._stable(pa) - this._stable(pb);
  }

  /**
   * Sort `len` events (given in ascending stable order, start before end per piece). Returns the
   * buffer holding the result, which may be the scratch buffer.
   *
   * @remarks
   * Comparator sort for small groups; LSD counting sort when the minor span is small relative to
   * the group (the million-fragment case).
   */
  private _sortEvents(events: Int32Array, len: number, minorMin: number, minorMax: number): Int32Array {
    const range = minorMax - minorMin + 1;
    if (len < 256 || range > len * 16) {
      events.subarray(0, len).sort((a, b) => this._compareEvents(a, b));
      return events;
    }
    const m0 = this._m0;
    const m1 = this._m1;
    const src = events;
    let dst = this._scratch;
    if (dst.length < len) dst = this._scratch = new Int32Array(len);
    // pass 1: opposite edge
    let counts = buckets(range + 1);
    for (let i=0; i<len; i++) {
      const ev = src[i];
      counts[((ev & 1) ? m0[ev >> 1] : m1[ev >> 1]) - minorMin + 1]++;
    }
    for (let i=1; i<=range; i++) counts[i] += counts[i - 1];
    for (let i=0; i<len; i++) {
      const ev = src[i];
      dst[counts[((ev & 1) ? m0[ev >> 1] : m1[ev >> 1]) - minorMin]++] = ev;
    }
    // pass 2: starts before ends
    let write = 0;
    for (let i=0; i<len; i++) if ((dst[i] & 1) === 0) src[write++] = dst[i];
    for (let i=0; i<len; i++) if ((dst[i] & 1) === 1) src[write++] = dst[i];
    // pass 3: closest edge
    counts = buckets(range + 1);
    for (let i=0; i<len; i++) {
      const ev = src[i];
      counts[((ev & 1) ? m1[ev >> 1] : m0[ev >> 1]) - minorMin + 1]++;
    }
    for (let i=1; i<=range; i++) counts[i] += counts[i - 1];
    for (let i=0; i<len; i++) {
      const ev = src[i];
      dst[counts[((ev & 1) ? m1[ev >> 1] : m0[ev >> 1]) - minorMin]++] = ev;
    }
    // the buffers rotate: the result lives in the old scratch, the event buffer is free
    this._scratch = src;
    this._events = dst;
    return dst;
  }

  /** Advance to the next band, materializing its regions. `false` when the sweep is exhausted. */
  private _advanceBand(): boolean {
    const n = this._n;
    const M0 = this._M0;
    const M1 = this._M1;
    const order = this._order;
    let active = this._active;
    let activeLen = this._activeLen;

    // 1. drop the pieces that ended with the previous band
    if (this._hasBand) {
      const threshold = this._bandEnd;
      let write = 0;
      for (let i=0; i<activeLen; i++) {
        const ev = active[i];
        if (M1[ev >> 1] > threshold) active[write++] = ev;
      }
      activeLen = write;
    }

    // 2. where the band starts
    let start: number;
    const nextOrder = this._nextOrder;
    if (activeLen > 0) {
      start = this._bandEnd + 1;
    } else {
      if (nextOrder >= n) {
        this._activeLen = 0;
        this._done = true;
        return false;
      }
      start = M0[order[nextOrder]];
    }

    // 3. merge in the pieces starting here
    let groupEnd = nextOrder;
    while (groupEnd < n && M0[order[groupEnd]] === start) groupEnd++;
    const groupCount = groupEnd - nextOrder;
    if (groupCount > 0) {
      const eventCount = 2 * groupCount;
      let events = this._events;
      if (events.length < eventCount) events = this._events = new Int32Array(Math.max(eventCount, events.length * 2));
      const m0 = this._m0;
      const m1 = this._m1;
      let minorMin = Number.MAX_SAFE_INTEGER;
      let minorMax = Number.MIN_SAFE_INTEGER;
      // ascending stable order: forward = ascending piece index, reverse = descending
      let write = 0;
      if (!this._isReverse) {
        for (let i=nextOrder; i<groupEnd; i++) {
          const piece = order[i];
          events[write++] = piece << 1;
          events[write++] = (piece << 1) | 1;
          if (m0[piece] < minorMin) minorMin = m0[piece];
          if (m1[piece] > minorMax) minorMax = m1[piece];
        }
      } else {
        for (let i=groupEnd - 1; i>=nextOrder; i--) {
          const piece = order[i];
          events[write++] = piece << 1;
          events[write++] = (piece << 1) | 1;
          if (m0[piece] < minorMin) minorMin = m0[piece];
          if (m1[piece] > minorMax) minorMax = m1[piece];
        }
      }
      const sorted = this._sortEvents(events, eventCount, minorMin, minorMax);
      const merged = activeLen + eventCount;
      // merge into a buffer that is neither the active list nor the sorted events
      let target = this._scratch;
      if (target === sorted || target.length < merged) target = new Int32Array(Math.max(merged, active.length * 2));
      if (activeLen === 0) {
        target.set(sorted.subarray(0, eventCount));
      } else {
        let a = 0;
        let b = 0;
        let w = 0;
        while (a < activeLen && b < eventCount) {
          if (this._compareEvents(active[a], sorted[b]) <= 0) target[w++] = active[a++];
          else target[w++] = sorted[b++];
        }
        while (a < activeLen) target[w++] = active[a++];
        while (b < eventCount) target[w++] = sorted[b++];
      }
      this._scratch = active.length >= target.length ? active : new Int32Array(target.length);
      active = this._active = target;
      activeLen = merged;
    }
    this._activeLen = activeLen;
    this._nextOrder = groupEnd;

    // 4. where the band ends: the first piece end, or the cell before the next piece start
    let end = groupEnd < n ? M0[order[groupEnd]] - 1 : Number.MAX_SAFE_INTEGER;
    for (let i=0; i<activeLen; i++) {
      const pieceEnd = M1[active[i] >> 1];
      if (pieceEnd < end) end = pieceEnd;
    }
    this._bandStart = start;
    this._bandEnd = end;
    this._hasBand = true;

    this._sweepBand();
    return true;
  }

  /** The minor sweep of the current band: intervals of constant, non-empty overlap set. */
  private _sweepBand(): void {
    const active = this._active;
    const activeLen = this._activeLen;
    const m0 = this._m0;
    const m1 = this._m1;
    let rMinS = this._rMinS;
    let rMinE = this._rMinE;
    let rOff = this._rOff;
    let pool = this._pool;
    let overlaps = this._overlaps;
    let overlapsLen = 0;
    let poolLen = 0;
    let rCount = 0;
    let cursor = 0;

    const emit = (from: number, to: number): void => {
      if (rCount >= rMinS.length) {
        rMinS = this._rMinS = growInt32(rMinS, rCount + 1);
        rMinE = this._rMinE = growInt32(rMinE, rCount + 1);
        rOff = this._rOff = growInt32(rOff, rMinS.length + 1); // one past the last region (the end sentinel)
      }
      rMinS[rCount] = from;
      rMinE[rCount] = to;
      rOff[rCount] = poolLen;
      rCount++;
      if (poolLen + overlapsLen > pool.length) pool = this._pool = growInt32(pool, poolLen + overlapsLen);
      for (let i=0; i<overlapsLen; i++) pool[poolLen++] = overlaps[i];
    }

    for (let i=0; i<activeLen; i++) {
      const ev = active[i];
      const piece = ev >> 1;
      if ((ev & 1) === 0) {
        const pos = m0[piece];
        if (overlapsLen > 0 && cursor < pos) emit(cursor, pos - 1);
        if (overlapsLen >= overlaps.length) overlaps = this._overlaps = growInt32(overlaps, overlapsLen + 1);
        // Kept in store order (see the header): insert at the piece's place.
        let index = overlapsLen;
        while (index > 0 && overlaps[index - 1] > piece) {
          overlaps[index] = overlaps[index - 1];
          index--;
        }
        overlaps[index] = piece;
        overlapsLen++;
        cursor = pos;
      } else {
        const pos = m1[piece];
        if (cursor <= pos) emit(cursor, pos);
        // Remove without disturbing the order of the rest.
        let index = overlapsLen - 1;
        while (index >= 0 && overlaps[index] !== piece) index--;
        if (index !== -1) {
          for (let k=index + 1; k<overlapsLen; k++) overlaps[k - 1] = overlaps[k];
          overlapsLen--;
        }
        cursor = pos + 1;
      }
    }
    rOff[rCount] = poolLen;
    this._rCount = rCount;
    this._region = -1;
    this._rInter = null;
  }

  /** Set the public region fields for the band × region (and the intersection). */
  private _setRegion(region: number): void {
    const isReverse = this._isReverse;
    // `+ 0` normalizes the -0 that negating a zero coordinate produces
    const majLo = isReverse ? -this._bandEnd + 0 : this._bandStart;
    const majHi = isReverse ? -this._bandStart + 0 : this._bandEnd;
    const a = this._rMinS[region];
    const b = this._rMinE[region];
    const minLo = isReverse ? -b + 0 : a;
    const minHi = isReverse ? -a + 0 : b;
    if (this._isColumn) {
      this.colStart = majLo; this.colEnd = majHi; this.rowStart = minLo; this.rowEnd = minHi;
    } else {
      this.rowStart = majLo; this.rowEnd = majHi; this.colStart = minLo; this.colEnd = minHi;
    }
    const cache = this._rInter;
    if (cache) {
      let intersection = cache[region];
      if (!intersection) intersection = cache[region] = this._materialize(region);
      this.intersection = intersection;
    } else {
      this.intersection = this._materialize(region);
    }
  }

  /** Step to the next region. `false` when exhausted. */
  nextRegion(): boolean {
    if (this._done) return false;
    let region = this._region + 1;
    while (!this._hasBand || region >= this._rCount) {
      if (!this._advanceBand()) return false;
      region = 0;
    }
    this._region = region;
    this._setRegion(region);
    return true;
  }

  private _setCell(region: number): void {
    const isReverse = this._isReverse;
    const major = isReverse ? -this._major + 0 : this._major;
    const minor = isReverse ? -this._minor + 0 : this._minor;
    if (this._isColumn) {
      this.cellCol = major; this.cellRow = minor;
    } else {
      this.cellRow = major; this.cellCol = minor;
    }
    if (region !== this._region) {
      this._region = region;
      this._setRegion(region);
    }
  }

  /** Enter a band for cell stepping: the intersection cache is only worth it when majors replay. */
  private _enterBandByCell(): void {
    this._rInter = this._bandEnd > this._bandStart ? new Array(this._rCount) : null;
    this._major = this._bandStart;
  }

  /** Step to the next cell that has an intersection (major, then minor order). `false` when exhausted. */
  nextCell(): boolean {
    if (this._done) return false;
    let region = this._region;
    if (!this._hasBand || region < 0) {
      if (!this._hasBand) {
        if (!this._advanceBand()) return false;
        this._enterBandByCell();
      }
      this._minor = this._rMinS[0];
      this._setCell(0);
      return true;
    }
    const minor = this._minor + 1;
    if (minor <= this._rMinE[region]) {
      this._minor = minor;
      this._setCell(region);
      return true;
    }
    region++;
    if (region >= this._rCount) {
      region = 0;
      if (++this._major > this._bandEnd) {
        if (!this._advanceBand()) return false;
        this._enterBandByCell();
      }
    }
    this._minor = this._rMinS[region];
    this._setCell(region);
    return true;
  }

  /**
   * Step to the first cell at or after (`rowIndex`, `colIndex`) in scan order that has an
   * intersection; a target at or before the current cell behaves as {@link nextCell}.
   */
  seekCell(rowIndex: number, colIndex: number): boolean {
    if (this._done) return false;
    const isReverse = this._isReverse;
    let targetMajor = this._isColumn ? colIndex : rowIndex;
    let targetMinor = this._isColumn ? rowIndex : colIndex;
    if (isReverse) { targetMajor = -targetMajor; targetMinor = -targetMinor; }
    if (this._hasBand && this._region >= 0) {
      if (targetMajor < this._major || (targetMajor === this._major && targetMinor <= this._minor)) return this.nextCell();
    }
    while (true) {
      if (!this._hasBand || targetMajor > this._bandEnd) {
        if (!this._advanceBand()) return false;
        this._enterBandByCell();
        continue;
      }
      if (targetMajor < this._bandStart) {
        this._major = this._bandStart;
        this._minor = this._rMinS[0];
        this._setCell(0);
        return true;
      }
      this._major = targetMajor;
      // first region ending at or after the target minor
      const rMinE = this._rMinE;
      let lo = 0;
      let hi = this._rCount;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (rMinE[mid] < targetMinor) lo = mid + 1; else hi = mid;
      }
      if (lo < this._rCount) {
        const from = this._rMinS[lo];
        this._minor = from > targetMinor ? from : targetMinor;
        this._setCell(lo);
        return true;
      }
      // past the last region of this major: the next major (or band)
      if (++this._major > this._bandEnd) {
        if (!this._advanceBand()) return false;
        this._enterBandByCell();
        continue;
      }
      this._minor = this._rMinS[0];
      this._setCell(0);
      return true;
    }
  }
}
