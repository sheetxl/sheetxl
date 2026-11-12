import { describe, it, expect } from 'vitest';

import { IBorders } from '@sheetxl/sdk';

import { edgesAt } from '../format/BorderPreview';

/**
 * Aiming in the border diagram.
 *
 * The six lines cross, so fixed rectangles cannot divide them: the inside-horizontal and
 * inside-vertical zones necessarily overlap in the middle and one of them takes the whole square,
 * which made the horizontal rule unclickable anywhere near the center. Distance to the nearest line
 * has no such square — and a threshold means the middle of a CELL still hits nothing. The one
 * place two lines are equally near, the crossing of the inner rules, aims at both.
 *
 * The picker is pure so it can be tested at all: jsdom lays nothing out, so a mounted diagram has
 * no idea where its own lines are.
 */
describe('border diagram aiming', () => {
  const W = 240;
  const H = 84;
  const all = () => true;
  const INSIDE = [IBorders.Edge.Horizontal, IBorders.Edge.Vertical];
  /** The single edge aimed at, or `null` — most cases aim at one line or at nothing. */
  const one = (edges: readonly IBorders.Edge[]): IBorders.Edge | null => {
    expect(edges.length).toBeLessThanOrEqual(1);
    return edges[0] ?? null;
  };
  const at = (x: number, y: number, isAvailable = all) => one(edgesAt(x, y, W, H, isAvailable));

  it('picks each of the six lines when the pointer is on it', () => {
    expect(at(W / 2, 0)).toBe(IBorders.Edge.Top);
    expect(at(W / 2, H)).toBe(IBorders.Edge.Bottom);
    expect(at(0, H / 2)).toBe(IBorders.Edge.Left);
    expect(at(W, H / 2)).toBe(IBorders.Edge.Right);
    // Off-center along each inner rule, where the two do not compete.
    expect(at(W * 0.25, H / 2)).toBe(IBorders.Edge.Horizontal);
    expect(at(W / 2, H * 0.25)).toBe(IBorders.Edge.Vertical);
  });

  it('gives a crossing with an OUTER edge to the outer edge', () => {
    // The left edge and the inside-horizontal rule meet at the left midpoint. A click there is
    // aimed at the block's outline — the inner rule is the line that ends at that point.
    expect(at(0, H / 2)).toBe(IBorders.Edge.Left);
    expect(at(W / 2, 0)).toBe(IBorders.Edge.Top);
  });

  it('aims at BOTH inner rules around their crossing', () => {
    // Within reach of both lines a pixel either way would flip between them, so the middle is
    // neither: it is the pair.
    expect(edgesAt(W / 2, H / 2, W, H, all)).toEqual(INSIDE);
    expect(edgesAt(W / 2 + 6, H / 2 - 6, W, H, all)).toEqual(INSIDE);
    expect(edgesAt(W / 2 - 10, H / 2 + 10, W, H, all)).toEqual(INSIDE);
  });

  it('gives each inner rule its own line outside the crossing', () => {
    expect(at(W / 2 + 14, H / 2)).toBe(IBorders.Edge.Horizontal);
    expect(at(W / 2 - 14, H / 2)).toBe(IBorders.Edge.Horizontal);
    expect(at(W / 2, H / 2 + 14)).toBe(IBorders.Edge.Vertical);
  });

  it('leaves the middle to the one inner rule a selection has', () => {
    // No crossing without both: a single-row selection's middle is just its vertical rule.
    const noHorizontal = (edge: IBorders.Edge): boolean => edge !== IBorders.Edge.Horizontal;
    expect(at(W / 2, H / 2, noHorizontal)).toBe(IBorders.Edge.Vertical);
    const noVertical = (edge: IBorders.Edge): boolean => edge !== IBorders.Edge.Vertical;
    expect(at(W / 2 + 6, H / 2, noVertical)).toBe(IBorders.Edge.Horizontal);
  });

  it('hits nothing in the middle of a cell', () => {
    expect(at(W * 0.25, H * 0.25)).toBeNull();
    expect(at(W * 0.75, H * 0.75)).toBeNull();
  });

  it('accepts a click just OUTSIDE the diagram, where the outer edges are aimed at', () => {
    // The outer lines sit on the boundary, so half the natural place to click one is past it.
    expect(at(W / 2, -6)).toBe(IBorders.Edge.Top);
    expect(at(-6, H / 2)).toBe(IBorders.Edge.Left);
    expect(at(W + 6, H / 2)).toBe(IBorders.Edge.Right);
    // But not so far out that anywhere in the panel counts.
    expect(at(W / 2, -40)).toBeNull();
  });

  it('is not fooled by a point level with a segment but past its end', () => {
    // Level with the top edge, well off to the left of the diagram: on no edge at all.
    expect(at(-60, 0)).toBeNull();
  });

  it('skips an edge that cannot be drawn rather than swallowing the click', () => {
    // A single-ROW selection has no inside-horizontal. The pointer on the horizontal rule's line
    // is then nearest to nothing available, not silently redirected to another edge.
    const noInner = (edge: IBorders.Edge): boolean =>
      edge !== IBorders.Edge.Horizontal && edge !== IBorders.Edge.Vertical;
    expect(at(W * 0.25, H / 2, noInner)).toBeNull();
    // The outer edges still answer normally.
    expect(at(W * 0.25, 0, noInner)).toBe(IBorders.Edge.Top);
  });

  it('keeps the bands apart on a diagram too small for the full threshold', () => {
    // At 30x30 the full 10px threshold would make the top, inside and bottom bands touch, so the
    // gap between them survives only because the limit shrinks with the diagram.
    expect(edgesAt(15, 15, 30, 30, all)).toEqual(INSIDE);
    expect(edgesAt(8, 8, 30, 30, all)).toEqual([]);
  });

  it('aims at the diagonal that starts at an outer corner, centered on it', () => {
    expect(at(0, 0)).toBe(IBorders.Edge.DiagonalDown);
    expect(at(W, H)).toBe(IBorders.Edge.DiagonalDown);
    expect(at(W, 0)).toBe(IBorders.Edge.DiagonalUp);
    expect(at(0, H)).toBe(IBorders.Edge.DiagonalUp);
    // Out on the crop marks, and just inside the block.
    expect(at(-6, -6)).toBe(IBorders.Edge.DiagonalDown);
    expect(at(6, 6)).toBe(IBorders.Edge.DiagonalDown);
  });

  it('leaves the outline its edges past the corner', () => {
    expect(at(14, 0)).toBe(IBorders.Edge.Top);
    expect(at(0, 14)).toBe(IBorders.Edge.Left);
    // The middle of a corner cell is still nothing.
    expect(at(18, 18)).toBeNull();
  });

  it('gives a corner back to the outline when the diagonal cannot be drawn', () => {
    const noDiagonals = (edge: IBorders.Edge): boolean =>
      edge !== IBorders.Edge.DiagonalUp && edge !== IBorders.Edge.DiagonalDown;
    expect(at(0, 0, noDiagonals)).toBe(IBorders.Edge.Top);
  });

  it('answers null for a diagram that has not been laid out yet', () => {
    expect(edgesAt(0, 0, 0, 0, all)).toEqual([]);
  });
});
