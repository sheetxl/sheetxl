import { describe, expect, it } from 'vitest';

import { RangeAxis, type RangeCoordValue } from '../../coords/Types';
import * as CoordUtils from '../../coords/CoordUtils';
import { OverlappingRange } from '../../coords/OverlappingRangeIterator';
import * as CommonUtils from '../../utils/CommonUtils';

const debug = (..._args: any) => {}
// const debug = console.log;

const collectDetails = (ranges: readonly RangeCoordValue[], options?: OverlappingRange.IteratorOptions) => {
  options = options ?? { axis: RangeAxis.Row };
  const isByCells = options.byCell ?? false;
  let iter = new OverlappingRange.IteratorInstance(ranges, options);

  let results:any[] = [];
  let overlapCounts:any[] = [];
  let intersections:any[] = [];
  let cells:any[] = [];
  let result = iter.next();
  while (!result.done) {
    const val:OverlappingRange.Intersection = result.value;
    results.push(CommonUtils.cloneObject(val));
    overlapCounts.push(val.overlaps.length);
    intersections.push(val.range);
    if (isByCells) {
      cells.push(val.cell);
    }
    result = iter.next();
  }

  // test reverse on every unit test.
  let reverseOverlapCounts:any[] = [];
  let reverseIntersections:any[] = [];
  let reverseCells:any[] = [];
  let reversePassed = true;
  let reverseResults:any[] = [];

  iter = new OverlappingRange.IteratorInstance(ranges, {
    ...options,
    reverse: !options.reverse
  });
  result = iter.next();
  while (!result.done) {
    let val:OverlappingRange.Intersection = result.value;
    val = CommonUtils.cloneObject(val);
    reverseResults.push(CommonUtils.cloneObject(val));
    reverseOverlapCounts.push(val.overlaps.length);
    reverseIntersections.push(val.range);
    if (isByCells) {
      reverseCells.push(val.cell);
    }
    result = iter.next();
  }

  reverseOverlapCounts.reverse();
  if (!CommonUtils.isEqualArrays(overlapCounts, reverseOverlapCounts)) {
    reversePassed = false;
  }
  if (reversePassed) {
    reverseIntersections.reverse();
    if (!CoordUtils.isEqualRangesArrays(intersections, reverseIntersections)) {
      reversePassed = false;
    }
  }
  if (reversePassed) {
    reverseCells.reverse();
    for (let i=0; reversePassed && i<cells.length; i++) {
      if (!CoordUtils.isEqualCells(cells[i], reverseCells[i])) {
        reversePassed = false;
      }
    }
  }

  expect(reversePassed).toEqual(true);

  return {
    overlapCounts,
    intersections,
    cells,
    results,
    reversePassed
  }
}

describe("OverlappingRange", () => {

  it("seek first last middle", () => {
    const ranges = [
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 0,
        rowEnd: 2,
        value: '1x3-l'
      },
      {
        colStart: 1,
        rowStart: 0,
        colEnd: 1,
        rowEnd: 2,
        value: '1x3-c'
      },
      {
        colStart: 2,
        rowStart: 0,
        colEnd: 2,
        rowEnd: 2,
        value: '1x3-r'
      }
    ];
    let options: OverlappingRange.IteratorOptions;
    let iter: OverlappingRange.IteratorInstance;
    let result: IteratorResult<OverlappingRange.Intersection>;

    // by column
    options = {
      axis: RangeAxis.Column,
      byCell: true
    };
    iter = new OverlappingRange.IteratorInstance(ranges, options);

    result = iter.next({ colIndex: 0, rowIndex: 1 });
    expect(result.value.overlaps[0].value).toEqual('1x3-l');
    result = iter.next({ colIndex: 2, rowIndex: 1 });
    expect(result.value.overlaps[0].value).toEqual('1x3-r');

    // by row
    options = {
      axis: RangeAxis.Row,
      byCell: true
    };
    iter = new OverlappingRange.IteratorInstance(ranges, options);

    result = iter.next({ colIndex: 0, rowIndex: 1 });
    expect(result.value.overlaps[0].value).toEqual('1x3-l');
    result = iter.next({ colIndex: 2, rowIndex: 1 });
    expect(result.value.overlaps[0].value).toEqual('1x3-r');

    let errorResults: any;
    try {
      result = iter.next({ colIndex: 0, rowIndex: 1 });
    } catch (error: any) {
      errorResults = error;
    }
    expect(errorResults).toBeDefined();
  });

  it("overlapping - last minor, middle major - byCell", () => {
    // minor major start aligned (non aligned ends)
    const ranges = [
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 1,
        rowEnd: 2,
        value: '2x3'
      },
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 0,
        rowEnd: 2,
        value: '1x3'
      },
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 1,
        rowEnd: 1,
        value: '1x1'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // reverse: true,
      // byCell: true
    });
    expect(details.results.length).toBe(6);
    // expect(details.overlapCounts).toEqual([2, 1, 2, 2, 2, 1].reverse());
  });

  it("overlapping - last major, middle minor - byCell", () => {
    // minor major start aligned (non aligned ends)
    const ranges = [
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 2,
        rowEnd: 1,
        value: '3x2'
      },
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 2,
        rowEnd: 0,
        value: '3x1'
      },
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 1,
        rowEnd: 1,
        value: '1x1'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // reverse: true,
      // byCell: true
    });
    expect(details.results.length).toBe(4);
    // expect(details.overlapCounts).toEqual([1, 2, 1, 2]);
    expect(details.reversePassed).toBe(true);
  });

  it("overlapping - neighbor major", () => {
    const ranges = [
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 3,
        rowEnd: 3,
        value: 'tl'
      },
      {
        colStart: 7,
        rowStart: 1,
        colEnd: 9,
        rowEnd: 3,
        value: 'tr'
      },
      {
        colStart: 1,
        rowStart: 7,
        colEnd: 3,
        rowEnd: 9,
        value: 'bl'
      },
      {
        colStart: 7,
        rowStart: 7,
        colEnd: 9,
        rowEnd: 9,
        value: 'br'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // reverse: true,
      byCell: true
    });
    expect(details.results.length).toBe(36);
    expect(details.reversePassed).toBe(true);
    // expect(details.overlapCounts).toEqual([1, 1]);
  });

  it("overlapping - minor gap", () => {
    const ranges = [
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 5,
        rowEnd: 5,
        value: 'top'
      },
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 1,
        rowEnd: 4,
        value: 'left'
      },
      {
        colStart: 4,
        rowStart: 1,
        colEnd: 4,
        rowEnd: 4,
        value: 'right'
      }
    ];
    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // reverse: true
      // byCell: true
    });
    expect(details.results.length).toBe(7);
    expect(details.overlapCounts).toEqual([1, 1, 2, 1, 2, 1, 1]);
  });

  it("overlapping - testing - middle", () => {
    const ranges = [
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 2,
        rowEnd: 0,
        value: 'top'
      },
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 0,
        rowEnd: 2,
        value: 'left'
      },
      {
        colStart: 2,
        rowStart: 0,
        colEnd: 2,
        rowEnd: 2,
        value: 'right'
      },
      {
        colStart: 0,
        rowStart: 2,
        colEnd: 2,
        rowEnd: 2,
        value: 'bottom'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // reverse: true
      // byCell: true
    });
    expect(details.results.length).toBe(8); // not middle
    expect(details.overlapCounts).toEqual([2, 1, 2, 1, 1, 2, 1, 2]);

    //with an overlap
    ranges.push({
      colStart: 0,
      rowStart: 0,
      colEnd: 2,
      rowEnd: 2,
      value: 'outer'
    });

    details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });

    expect(details.results.length).toBe(9);
    expect(details.overlapCounts).toEqual([3, 2, 3, 2, 1, 2, 3, 2, 3]);

    // weird bottom corner.
    ranges.push({
      colStart: 1,
      rowStart: 1,
      colEnd: 2,
      rowEnd: 2,
      value: 'outer'
    });

    details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });

    expect(details.results.length).toBe(9);
    expect(details.overlapCounts).toEqual([3, 2, 3, 2, 2, 3, 3, 3, 4]);
  });

  it("overlapping - testing - byCell", () => {
    const ranges = [
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 1,
        rowEnd: 1,
        value: 'outer'
      },
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 0,
        rowEnd: 0,
        value: 'inner'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      byCell: true
    });
    expect(details.results.length).toBe(4);
    expect(details.overlapCounts).toEqual([2, 1, 1, 1]);
  });

  it("overlapping - minor intersecting (no gaps)", () => {
    const ranges = [
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 5,
        rowEnd: 0,
        value: '1x6 @0'
      },
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 2,
        rowEnd: 0,
        value: '1x3 @0'
      },
      {
        colStart: 3,
        rowStart: 0,
        colEnd: 5,
        rowEnd: 0,
        value: '1x3 @3'
      }
    ];
    let details = collectDetails(ranges, { axis: RangeAxis.Row });
    expect(details.results.length).toBe(2);
    expect(details.overlapCounts).toEqual([2, 2]);
  });

  it("overlapping - minor intersecting (gap with overlaps)", () => {
    const ranges = [
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 5,
        rowEnd: 0,
        value: '1x6 @0'
      },
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 1,
        rowEnd: 0,
        value: '1x2 @0'
      },
      {
        colStart: 4,
        rowStart: 0,
        colEnd: 5,
        rowEnd: 0,
        value: '1x2 @4'
      }
    ];
    let details = collectDetails(ranges, { axis: RangeAxis.Row });
    expect(details.results.length).toBe(3);
    expect(details.overlapCounts).toEqual([2, 1, 2]);
  });

  it("overlapping - minor intersecting 3 starts", () => {
    const ranges = [
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 5,
        rowEnd: 0,
        value: '1x6 @0'
      },
      {
        colStart: 2,
        rowStart: 0,
        colEnd: 5,
        rowEnd: 0,
        value: '1x4 @2'
      },
      {
        colStart: 4,
        rowStart: 0,
        colEnd: 5,
        rowEnd: 0,
        value: '1x2 @4'
      }
    ];

    let details = collectDetails(ranges, { axis: RangeAxis.Row });
    expect(details.results.length).toBe(3);
    expect(details.overlapCounts).toEqual([1, 2, 3]);
  });

  it("overlapping - minor intersecting 3 ends", () => {
    const ranges = [
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 5,
        rowEnd: 0,
        value: '1x6'
      },
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 1,
        rowEnd: 0,
        value: '1x2 @0'
      },
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 3,
        rowEnd: 0,
        value: '1x4 @0'
      }
    ];

    let details = collectDetails(ranges, { axis: RangeAxis.Row });
    expect(details.results.length).toBe(3);
    expect(details.overlapCounts).toEqual([3, 2, 1]);
  });

  it("overlapping - 1 in middle - byCell", () => {
    // minor major start aligned (non aligned ends)
    const ranges = [
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 2,
        rowEnd: 2,
        value: 'outer'
      },
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 1,
        rowEnd: 1,
        value: 'inner'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      byCell: true
    });
    expect(details.results.length).toBe(9);
    expect(details.overlapCounts).toEqual([1, 1, 1, 1, 2, 1, 1, 1, 1]);
  });

  it("overlapping - single range - byCell", () => {
    const ranges = [
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 1,
        rowEnd: 2,
        value: 'i1'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      byCell: true
    });
    expect(details.results.length).toBe(2);
    expect(details.overlapCounts).toEqual([1, 1]);
  });

  it("overlapping - aligned minors end - byCell", () => {
    const ranges = [
      {
        colStart: 2,
        rowStart: 2,
        colEnd: 4,
        rowEnd: 4,
        value: 'i1'
      },
      {
        colStart: 3,
        rowStart: 3,
        colEnd: 4,
        rowEnd: 4,
        value: 'i2'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      byCell: true
    });
    expect(details.results.length).toBe(9);
    expect(details.overlapCounts).toEqual([1, 1, 1, 1, 2, 2, 1, 2, 2]);
  });

  it("overlapping - aligned minors start - byCell", () => {
    // minor major start aligned (non aligned ends)
    const ranges = [
      {
        colStart: 2,
        rowStart: 2,
        colEnd: 3,
        rowEnd: 3,
        value: 'i1'
      },
      {
        colStart: 2,
        rowStart: 2,
        colEnd: 4,
        rowEnd: 4,
        value: 'i2'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      byCell: true
    });
    expect(details.results.length).toBe(9);
    expect(details.overlapCounts).toEqual([2, 2, 1, 2, 2, 1, 1, 1, 1]);
  });

  it("overlapping - aligned minors start", () => {
    // minor major start aligned (non aligned ends)
    const ranges = [
      {
        colStart: 2,
        rowStart: 2,
        colEnd: 3,
        rowEnd: 3,
        value: 'i1'
      },
      {
        colStart: 2,
        rowStart: 2,
        colEnd: 4,
        rowEnd: 4,
        value: 'i2'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });
    expect(details.results.length).toBe(3);
    expect(details.overlapCounts).toEqual([2, 1, 1]);
  });

  it("overlapping - performance major", () => {
    let iter:OverlappingRange.IteratorInstance;
    let result:any;
    let results:any[] = [];
    let ranges:any[] = [];
    // major
    const count = 1000 * 1000; // 1m is taking about 1.1 seconds. Decent. 10 million throws out of memory exception
    for (let i=0; i<count; i++) {
      ranges.push({
        colStart: 1,
        rowStart: i,
        colEnd: 3,
        rowEnd: i,
        value: 'range' + i
      });
    }

    let start = performance.now();
    iter = new OverlappingRange.IteratorInstance(ranges, {
      axis: RangeAxis.Row,
      // reuseIterator: true
    });
    results = [];
    result = iter.next();
    while (!result.done) {
      const val:OverlappingRange.Intersection = result.value;
      // with reuseIterator and no cloning we get incorrect results but this is a performance test
      results.push(val); // CommonUtils.cloneObject(val));
      result = iter.next();
    }
    let end = performance.now();
    debug(`Iterator Major: count: ${count}, time: ${end - start} ms`);
    expect(results.length).toBe(count);

    ranges = [];
    // minor - // 1m is taking about 3.6 seconds. Not bad. 10 million throws out of memory exception but only 16k are allowed in Excel
    for (let i=0; i<count; i++) {
      ranges.push({
        colStart: i,
        rowStart: 1,
        colEnd: i,
        rowEnd: 3,
        value: 'range-minor' + i
      });
    }

    start = performance.now();
    iter = new OverlappingRange.IteratorInstance(ranges, {
      axis: RangeAxis.Row,
      // reuseIterator: true
    });
    results = [];
    result = iter.next();
    while (!result.done) {
      const val:OverlappingRange.Intersection = result.value;
      // with reuseIterator and no cloning we get incorrect results but this is a performance test
      results.push(val); // CommonUtils.cloneObject(val));
      result = iter.next();
    }
    end = performance.now();
    debug(`Iterator Minor: count: ${count}, time: ${end - start} ms`);
    expect(results.length).toBe(count);
  });
;

  it("overlapping - neighbor minor", () => {
    const ranges = [
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 3,
        rowEnd: 3,
        value: 'range1'
      },
      {
        colStart: 4,
        rowStart: 1,
        colEnd: 6,
        rowEnd: 3,
        value: 'range2'
      },
      {
        colStart: 7,
        rowStart: 1,
        colEnd: 9,
        rowEnd: 3,
        value: 'range3'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });
    expect(details.results.length).toBe(3);
    expect(details.overlapCounts).toEqual([1, 1, 1]);
  });

  it("overlapping - gap minor no overlap", () => {
    const ranges = [
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 3,
        rowEnd: 3,
        value: 'range1'
      },// gap
      {
        colStart: 5,
        rowStart: 1,
        colEnd: 5,
        rowEnd: 3,
        value: 'range2'
      },
      {
        colStart: 7,
        rowStart: 1,
        colEnd: 9,
        rowEnd: 3,
        value: 'range3'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });
    expect(details.results.length).toBe(3);
    expect(details.overlapCounts).toEqual([1, 1, 1]);
  });

  it("overlapping - gaps major", () => {
    const ranges = [
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 3,
        rowEnd: 3,
        value: 'range1'
      },
      {
        colStart: 1,
        rowStart: 4,
        colEnd: 3,
        rowEnd: 6,
        value: 'range2'
      },
      {
        colStart: 1,
        rowStart: 7,
        colEnd: 3,
        rowEnd: 9,
        value: 'range3'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });
    expect(details.results.length).toBe(3);
    expect(details.overlapCounts).toEqual([1, 1, 1]);
  })

  it("overlapping - neighbor major", () => {
    const ranges = [
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 3,
        rowEnd: 3,
        value: 'range1'
      },
      { // gap
        colStart: 1,
        rowStart: 5,
        colEnd: 3,
        rowEnd: 5,
        value: 'range2'
      },
      {
        colStart: 1,
        rowStart: 7,
        colEnd: 3,
        rowEnd: 9,
        value: 'range3'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });
    expect(details.results.length).toBe(3);
    expect(details.overlapCounts).toEqual([1, 1, 1]);
  })

  it("overlapping - single bounds with multiple overlaps", () => {
    const ranges = [
      {
        colStart: 1,
        rowStart: 3,
        colEnd: 1,
        rowEnd: 3,
        value: 'range1'
      },
      {
        colStart: 1,
        rowStart: 3,
        colEnd: 1,
        rowEnd: 3,
        value: 'range2'
      },
      {
        colStart: 1,
        rowStart: 3,
        colEnd: 1,
        rowEnd: 3,
        value: 'range3'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      byCell: true
    });
    expect(details.results.length).toBe(1);
    expect(details.overlapCounts).toEqual([3]);
  });

  it("overlapping - single", () => {
    const ranges = [
      {
        colStart: 1,
        rowStart: 3,
        colEnd: 1,
        rowEnd: 3,
        value: 'outer'
      }
    ];
    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });
    expect(details.results.length).toBe(1);
    expect(details.overlapCounts).toEqual([1]);
  });

  it("overlapping - horizontal overlap", () => {
    const ranges = [
      {
        colStart: 1,
        rowStart: 2,
        colEnd: 7,
        rowEnd: 8,
        value: 'outer'
      },
      {
        colStart: 1,
        rowStart: 3,
        colEnd: 2,
        rowEnd: 5,
        value: 'l'
      },
      {
        colStart: 5,
        rowStart: 3,
        colEnd: 7,
        rowEnd: 5,
        value: 'b'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });
    expect(details.results.length).toBe(5);
    expect(details.overlapCounts).toEqual([1, 2, 1, 2, 1]);
  });

  it("overlapping - vertical overlap", () => {
    // minor major start aligned (non aligned ends)
    const ranges = [
      {
        colStart: 1,
        rowStart: 2,
        colEnd: 3,
        rowEnd: 10,
        value: 'outer'
      },
      {
        colStart: 2,
        rowStart: 2,
        colEnd: 2,
        rowEnd: 4,
        value: 't'
      },
      {
        colStart: 2,
        rowStart: 7,
        colEnd: 2,
        rowEnd: 10,
        value: 'b'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });
    expect(details.results.length).toBe(7);
    expect(details.overlapCounts).toEqual([1, 2, 1, 1, 1, 2, 1]);
  });

  it("OverlappingRange2 - multiple test cases (build out)", () => {
    const ranges = [
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 7,
        rowEnd: 6,
        value: 'o'
      },
      {
        colStart: 2,
        rowStart: 2,
        colEnd: 2,
        rowEnd: 11,
        value: 'l'
      },
      {
        colStart: 4,
        rowStart: 2,
        colEnd: 4,
        rowEnd: 4,
        value: 'r'
      },
      {
        colStart: 4,
        rowStart: 9,
        colEnd: 4,
        rowEnd: 9,
        value: 'r2'
      },
      {
        colStart: 6,
        rowStart: 4,
        colEnd: 6,
        rowEnd: 4,
        value: 'r3'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });
    expect(details.results.length).toBe(20);
    expect(details.overlapCounts).toEqual([1, 1, 2, 1, 2, 1, 1, 2, 1, 2, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1]);

    details = collectDetails(ranges, {
      axis: RangeAxis.Column,
      // byCell: true
    });
    expect(details.results.length).toBe(14);
    expect(details.overlapCounts).toEqual([1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1]);
  });

  it("overlapping - gaps between minors", () => {
    // minor major start aligned (non aligned ends)
    const ranges = [
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 5,
        rowEnd: 5,
        value: 'outer'
      },
      {
        colStart: 2,
        rowStart: 2,
        colEnd: 2,
        rowEnd: 4,
        value: 'left'
      },
      {
        colStart: 4,
        rowStart: 2,
        colEnd: 4,
        rowEnd: 3, // deliberately smaller
        value: 'right'
      }
    ];
    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });
    expect(details.results.length).toBe(10);
    expect(details.overlapCounts).toEqual([1, 1, 2, 1, 2, 1, 1, 2, 1, 1]);
  });

  it("overlapping - horizontal aligned start", () => {
    // minor major start aligned (non aligned ends)
    const ranges = [
      {
        colStart: 2,
        rowStart: 2,
        colEnd: 4,
        rowEnd: 4,
        value: 'before'
      },
      {
        colStart: 2,
        rowStart: 2,
        colEnd: 6,
        rowEnd: 4,
        value: 'after'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });
    expect(details.results.length).toBe(2);
    expect(details.overlapCounts).toEqual([2, 1]);
  });

  it("overlapping - horizontal intersection ", () => {
    // minor major start aligned (non aligned ends)
    const ranges = [
      {
        colStart: 2,
        rowStart: 2,
        colEnd: 4,
        rowEnd: 4,
        value: 'before'
      },
      {
        colStart: 4,
        rowStart: 2,
        colEnd: 6,
        rowEnd: 4,
        value: 'after'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });
    expect(details.results.length).toBe(3);
    expect(details.overlapCounts).toEqual([1, 2, 1]);
  });

  it("overlapping - horizontal ", () => {
    // minor major start aligned (non aligned ends)
    const ranges = [
      {
        colStart: 2,
        rowStart: 2,
        colEnd: 4,
        rowEnd: 4,
        value: 'before'
      },
      {
        colStart: 6,
        rowStart: 2,
        colEnd: 8,
        rowEnd: 4,
        value: 'after'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });
    expect(details.results.length).toBe(2);
    expect(details.overlapCounts).toEqual([1, 1]);
  });

  it("overlapping - vertical ", () => {
    // minor major start aligned (non aligned ends)
    const ranges = [
      {
        colStart: 2,
        rowStart: 2,
        colEnd: 4,
        rowEnd: 4,
        value: 'above'
      },
      {
        colStart: 2,
        rowStart: 6,
        colEnd: 4,
        rowEnd: 8,
        value: 'below'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });
    expect(details.results.length).toBe(2);
    expect(details.overlapCounts).toEqual([1, 1]);
  });

  it("overlapping - aligned ends", () => {
    // minor major start aligned (non aligned ends)
    const ranges = [
      {
        colStart: 2,
        rowStart: 2,
        colEnd: 4,
        rowEnd: 4,
        value: 'i1'
      },
      {
        colStart: 3,
        rowStart: 3,
        colEnd: 4,
        rowEnd: 4,
        value: 'i2'
      }
    ];
    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });
    expect(details.results.length).toBe(3);
    expect(details.overlapCounts).toEqual([1, 1, 2]);
  });

  it("rangeScan - no overlap", () => {
    const ranges = [
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 2,
        rowEnd: 1,
        value: 'tl'
      },
      {
        colStart: 4,
        rowStart: 1,
        colEnd: 5,
        rowEnd: 1,
        value: 'tr'
      },
      {
        colStart: 1,
        rowStart: 3,
        colEnd: 2,
        rowEnd: 3,
        value: 'bl'
      },
      {
        colStart: 4,
        rowStart: 3,
        colEnd: 5,
        rowEnd: 3,
        value: 'br'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });
    expect(details.results.length).toBe(4);

    details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      reverse: true,
      // byCell: true
    });
    expect(details.results.length).toBe(4);

  });

  it("rangeScan - overlapping", () => {
    const ranges = [
      {
        colStart: 6,
        rowStart: 4,
        colEnd: 8,
        rowEnd: 10,
        value: 'a'
      },
      {
        colStart: 4,
        rowStart: 5,
        colEnd: 7,
        rowEnd: 6,
        value: 'l'
      },
      {
        colStart: 7,
        rowStart: 6,
        colEnd: 10,
        rowEnd: 7,
        value: 'r'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
    });
    expect(details.results.length).toBe(13);

    details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // byCell: true
      reverse: true
    });
    expect(details.results.length).toBe(13);
  });

  it("Simple - 2 vertical by cell", () => {
    const ranges = [
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 2,
        rowEnd: 2,
        value: 'l'
      },
      {
        colStart: 3,
        rowStart: 1,
        colEnd: 4,
        rowEnd: 2,
        value: 'r'
      }
    ]

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
    });
    expect(details.results.length).toBe(2);

    details = collectDetails(ranges, {
      axis: RangeAxis.Column,
    });
    expect(details.results.length).toBe(2);

    details = collectDetails(ranges, {
      axis: RangeAxis.Column,
      // reverse: true,
      byCell: true
    });
    expect(details.results.length).toBe(8);
  });

  it("Use for merge", () => {
    let ranges = [
      {
        colStart: 3,
        rowStart: 0,
        colEnd: 4,
        rowEnd: 4,
        value: "o",
      },
      {
        colStart: 5,
        rowStart: 0,
        colEnd: 5,
        rowEnd: 1,
        value: "o",
      },
      {
        colStart: 5,
        rowStart: 3,
        colEnd: 5,
        rowEnd: 4,
        value: "o",
      },
      {
        colStart: 6,
        rowStart: 0,
        colEnd: 7,
        rowEnd: 4,
        value: "o",
      },
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 1,
        rowEnd: 4,
        value: "o",
      },
      {
        colStart: 2,
        rowStart: 0,
        colEnd: 2,
        rowEnd: 1,
        value: "o",
      },
      {
        colStart: 2,
        rowStart: 3,
        colEnd: 2,
        rowEnd: 4,
        value: "o",
      },
    ]

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // reverse: true,
      // byCell: true
    });
    expect(details.results.length).toBe(13);

    ranges = [
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 1,
        rowEnd: 1,
        value: 'tl'
      },
      {
        colStart: 1,
        rowStart: 0,
        colEnd: 2,
        rowEnd: 1,
        value: 'tr'
      },
      {
        colStart: 0,
        rowStart: 1,
        colEnd: 1,
        rowEnd: 2,
        value: 'bl'
      },
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 2,
        rowEnd: 2,
        value: 'br'
      },
    ];

    details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // reverse: true,
      // byCell: true
    });
    expect(details.results.length).toBe(9);

  });

  it("Uses for merging nodes", () => {
    const ranges = [
      {
        colStart: 4,
        rowStart: 4,
        colEnd: 5,
        rowEnd: 5,
        value: 'tl'
      },
      {
        colStart: 6,
        rowStart: 4,
        colEnd: 7,
        rowEnd: 7,
        value: 'r'
      },
      {
        colStart: 4,
        rowStart: 6,
        colEnd: 5,
        rowEnd: 7,
        value: 'bl'
      }
    ];

    let mergedCols:any[] = [];
    let iter = new OverlappingRange.IteratorInstance(ranges, { axis: RangeAxis.Row });
    let result = iter.next();
    while (!result.done) {
      const val:OverlappingRange.Intersection = result.value;
      const range = val.range;//unionRangesArrays(val.ranges); // since they don't overlap they should always be 1.
      const lastRange:any = mergedCols[mergedCols.length - 1];
      if (lastRange &&
          lastRange.rowStart === range.rowStart &&
          lastRange.rowEnd === range.rowEnd &&
          lastRange.colEnd + 1 === range.colStart) {
        mergedCols[mergedCols.length - 1] = {
          ...lastRange,
          colEnd: range.colEnd
        }
      } else {
        mergedCols.push(range); // only 1
      }
      result = iter.next();
    }

    const merged:any[] = [];
    iter = new OverlappingRange.IteratorInstance(mergedCols, { axis: RangeAxis.Column });
    result = iter.next();
    while (!result.done) {
      const val:OverlappingRange.Intersection = result.value;
      const range = val.range;//unionRangesArrays(val.ranges); // since they don't overlap they should always be 1.
      const lastRange:any = merged[merged.length - 1];
      if (lastRange &&
          lastRange.colStart === range.colStart &&
          lastRange.colEnd === range.colEnd &&
          lastRange.rowEnd + 1 === range.rowStart) {
        merged[merged.length - 1] = {
          ...lastRange,
          rowEnd: range.rowEnd
        }
      } else {
        merged.push(range); // only 1
      }
      result = iter.next();
    }

    expect(merged.length).toBe(1);
  });

  it("rangeScan 4 large", () => {
    const ranges = [
      {
        colStart: 0,
        rowStart: 0,
        colEnd: 9,
        rowEnd: 9,
        value: 'tl'
      },
      {
        colStart: 10,
        rowStart: 0,
        colEnd: 19,
        rowEnd: 9,
        value: 'tr'
      },
      {
        colStart: 0,
        rowStart: 10,
        colEnd: 9,
        rowEnd: 19,
        value: 'bl'
      },
      {
        colStart: 10,
        rowStart: 10,
        colEnd: 19,
        rowEnd: 19,
        value: 'br'
      }
    ];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // reverse: true,
      // byCell: true
    });
    expect(details.results.length).toBe(4);
  });

  it("Complex", () => {
    const ranges = [
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 2,
        rowEnd: 3,
        value: 'tl'
      },
      {
        colStart: 1,
        rowStart: 3,
        colEnd: 2,
        rowEnd: 5,
        value: 'bl'
      },
      {
        colStart: 2,
        rowStart: 3,
        colEnd: 3,
        rowEnd: 4,
        value: 'red border'
      },
      {
        colStart: 2,
        rowStart: 4,
        colEnd: 4,
        rowEnd: 4,
        value: 'pink'
      }
    ]

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // reverse: true,
      byCell: true
    });
    expect(details.results.length).toBe(13);

    details = collectDetails(ranges, {
      axis: RangeAxis.Column,
      // reverse: true,
      byCell: true
    });
    expect(details.results.length).toBe(13);

    details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // reverse: true,
      // byCell: true
    });
    expect(details.results.length).toBe(9);

    details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      reverse: true,
      // byCell: true
    });
    expect(details.results.length).toBe(9);
  });

  it("Two vertical", () => {
    const ranges = [
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 2,
        rowEnd: 10,
        value: 'tl'
      },
      {
        colStart: 3,
        rowStart: 1,
        colEnd: 4,
        rowEnd: 9,
        value: 'br'
      }
    ]

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // reverse: true,
      byCell: true
    });
    expect(details.results.length).toBe(38);
  });

  it("Uneven", () => {
    const ranges = [
      {
        colStart: 1,
        rowStart: 1,
        colEnd: 2,
        rowEnd: 3,
        value: 'tl'
      },
      {
        colStart: 2,
        rowStart: 3,
        colEnd: 4,
        rowEnd: 4,
        value: 'br'
      },
      {
        colStart: 4,
        rowStart: 1,
        colEnd: 4,
        rowEnd: 1,
        value: 'corner'
      }
    ]

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // reverse: true,
      byCell: true
    });
    expect(details.results.length).toBe(12);
  });

  it("Empty", () => {
    const ranges: any = [];

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // reverse: true,
      byCell: true
    });
    expect(details.results.length).toBe(0);
  });

  it("Completely overlapping", () => {
    const ranges = [
      {
        rowStart: 1,
        rowEnd: 2,
        colStart: 1,
        colEnd: 2,
        value: 'tl'
      },
      {
        rowStart: 1,
        rowEnd: 2,
        colStart: 1,
        colEnd: 2,
        value: 'm'
      },
      {
        rowStart: 1,
        rowEnd: 2,
        colStart: 1,
        colEnd: 2,
        value: 'br'
      }
    ]
    let results:any[] = [];
    let resultsReverse:any[] = [];
    let iter:OverlappingRange.IteratorInstance;
    let result:any;

    iter = new OverlappingRange.IteratorInstance(ranges, { axis: RangeAxis.Row, byCell: true });
    result = iter.next();
    while (!result.done) {
      const val:OverlappingRange.Intersection = result.value;
      results.push(val);
      result = iter.next();
    }
    expect(results.length).toEqual(4); // each results has 3
    for (let i=0; i<results.length; i++) {
      expect(results[i].overlaps.length).toEqual(3)
    }

    iter = new OverlappingRange.IteratorInstance(ranges, { axis: RangeAxis.Row, byCell: true, reverse: true });
    result = iter.next();
    while (!result.done) {
      const val:OverlappingRange.Intersection = result.value;
      resultsReverse.push(val);
      result = iter.next();
    }
    expect(resultsReverse.length).toEqual(4); // each results has 3
    for (let i=0; i<resultsReverse.length; i++) {
      expect(resultsReverse[i].overlaps.length).toEqual(3)
    }

  });

  it("1 overlap column and 1 gap row", () => {
    const ranges = [
      {
        rowStart: 1,
        rowEnd: 2,
        colStart: 1,
        colEnd: 2,
        value: 'tl'
      },
      {
        rowStart: 3,
        rowEnd: 4,
        colStart: 3,
        colEnd: 4,
        value: 'br'
      }
    ]

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // reverse: true,
      byCell: true
    });
    expect(details.results.length).toBe(8);
  });

  it("1 overlap column and 1 gap row", () => {
    const ranges = [
      {
        rowStart: 1,
        rowEnd: 2,
        colStart: 1,
        colEnd: 3,
        value: 'tl'
      },
      {
        rowStart: 1,
        rowEnd: 2,
        colStart: 3,
        colEnd: 4,
        value: 'tr'
      },
      {
        rowStart: 4,
        rowEnd: 5,
        colStart: 1,
        colEnd: 2,
        value: 'bl'
      },
      {
        rowStart: 4,
        rowEnd: 5,
        colStart: 3,
        colEnd: 4,
        value: 'br'
      }
    ]

    let details = collectDetails(ranges, {
      axis: RangeAxis.Row,
      // reverse: true,
      byCell: true
    });
    expect(details.results.length).toBe(16);
  });

});
