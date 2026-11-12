import { describe, it, expect, vi } from 'vitest';

import { Scroller, WHEEL_ZOOM_K } from '../../scroller/Scroller';

const CLIENT = { width: 800, height: 600 };
/** Content in BASE px (the scroller scales it by its level). */
const CONTENT = { width: 10000, height: 20000 };

const createScroller = (level: number = 1) => {
  const callback = vi.fn<(left: number, top: number, zoom: number) => void>();
  const scroller = new Scroller(callback, {
    scrollingX: true,
    scrollingY: true,
    zooming: true,
    minZoom: 0.1,
    maxZoom: 4,
    animating: false
  });
  scroller.setDimensions(CLIENT.width, CLIENT.height, CONTENT.width, CONTENT.height);
  scroller.setZoomLevel(level);
  callback.mockClear();
  return { scroller, callback };
};

const last = (callback: ReturnType<typeof vi.fn>): { left: number; top: number; zoom: number } => {
  const call = callback.mock.calls[callback.mock.calls.length - 1];
  return { left: call[0], top: call[1], zoom: call[2] };
};

/**
 * The scroller is the zoom gesture's owner: it holds the continuous level, the
 * clamp, the proportional wheel factor, and the focal-point derivation. The owner (WorksheetElement)
 * rounds and commits; these tests pin the part that lives here.
 */
describe('Scroller zoom', () => {
  it('zoomTo keeps the fixed point still in content space', () => {
    const { scroller, callback } = createScroller(1);
    scroller.scrollTo(1000, 2000);
    const focal = { left: 300, top: 100 };
    // Content under the focal point before: (scroll + focal) / level.
    const contentX = (1000 + focal.left) / 1;
    const contentY = (2000 + focal.top) / 1;

    scroller.zoomTo(2, false, focal.left, focal.top);
    const { left, top, zoom } = last(callback);
    expect(zoom).toBe(2);
    expect((left + focal.left) / zoom).toBeCloseTo(contentX, 6);
    expect((top + focal.top) / zoom).toBeCloseTo(contentY, 6);
  });

  it('flags the publish as a zoom so an owner can admit it', () => {
    const { scroller, callback } = createScroller(1);
    let seenZooming: boolean | null = null;
    callback.mockImplementation(() => { seenZooming = scroller.__isZooming; });
    scroller.zoomTo(1.5, false, 0, 0);
    expect(seenZooming).toBe(true);
    expect(scroller.__isZooming).toBe(false);
  });

  it('clamps the level to the configured range', () => {
    const { scroller, callback } = createScroller(1);
    scroller.zoomTo(10, false, 0, 0);
    expect(last(callback).zoom).toBe(4);
    scroller.zoomTo(0.01, false, 0, 0);
    expect(last(callback).zoom).toBe(0.1);
  });

  it('doMouseZoom is proportional: one 100px notch is one 15% step, and deltas compose', () => {
    const { scroller, callback } = createScroller(1);
    scroller.doMouseZoom(-100, 0, 0, 0); // wheel away from the user ⇒ in
    expect(last(callback).zoom).toBeCloseTo(1.15, 10);
    scroller.doMouseZoom(100, 0, 0, 0); // and back
    expect(last(callback).zoom).toBeCloseTo(1, 10);
    // Fifty tiny touchpad deltas sum to one notch.
    for (let i = 0; i < 50; i++) scroller.doMouseZoom(-2, 0, 0, 0);
    expect(last(callback).zoom).toBeCloseTo(Math.exp(100 * WHEEL_ZOOM_K), 10);
  });

  it('setZoomLevel re-seats the level without publishing and sizes the scroll range for it', () => {
    const { scroller, callback } = createScroller(1);
    scroller.setZoomLevel(2);
    expect(callback).not.toHaveBeenCalled();
    expect(scroller.__zoomLevel).toBe(2);
    expect(scroller.getScrollMax()).toEqual({
      left: CONTENT.width * 2 - CLIENT.width,
      top: CONTENT.height * 2 - CLIENT.height
    });
  });

  it('scrollTo without a zoom keeps the current level (the position sync must not reset it)', () => {
    const { scroller, callback } = createScroller(1.5);
    scroller.scrollTo(100, 200, false);
    expect(last(callback)).toEqual({ left: 100, top: 200, zoom: 1.5 });
    expect(scroller.__zoomLevel).toBe(1.5);
  });
});

/** Two fingers, as the DOM would report them (only what the scroller reads). */
const touches = (...points: Array<[number, number]>): TouchList =>
  points.map(([pageX, pageY]) => ({ pageX, pageY })) as unknown as TouchList;

describe('Scroller pinch', () => {
  it('measures the pinch against the start distance: fingers twice as far apart ⇒ level × 2', () => {
    const { scroller, callback } = createScroller(1);
    scroller.scrollTo(1000, 1000);
    scroller.doTouchStart(touches([400, 300], [500, 300]), 0); // distance 100, midpoint (450, 300)
    expect(scroller.__isGesturing).toBe(true);
    scroller.doTouchMove(touches([350, 300], [550, 300]), 16); // distance 200, same midpoint
    const { zoom } = last(callback);
    expect(zoom).toBe(2);
    // No midpoint movement ⇒ no pan rides along.
    expect(scroller.__gestureMoveX).toBe(0);
    expect(scroller.__gestureMoveY).toBe(0);
  });

  it('is absolute across moves (closing back to the start distance restores the start level)', () => {
    const { scroller, callback } = createScroller(1.5);
    scroller.doTouchStart(touches([0, 0], [100, 0]), 0);
    scroller.doTouchMove(touches([0, 0], [150, 0]), 16);
    expect(last(callback).zoom).toBeCloseTo(2.25, 10);
    scroller.doTouchMove(touches([0, 0], [100, 0]), 32);
    expect(last(callback).zoom).toBeCloseTo(1.5, 10);
  });

  it('reports the midpoint pan of each move alongside the zoom', () => {
    const { scroller } = createScroller(1);
    scroller.scrollTo(1000, 1000);
    scroller.doTouchStart(touches([400, 300], [500, 300]), 0);
    scroller.doTouchMove(touches([380, 310], [520, 310]), 16); // midpoint (450,310): moved +0, +10
    expect(scroller.__gestureMoveX).toBe(0);
    expect(scroller.__gestureMoveY).toBe(10);
    scroller.doTouchMove(touches([400, 310], [540, 310]), 32); // midpoint (470,310): moved +20, +0
    expect(scroller.__gestureMoveX).toBe(20);
    expect(scroller.__gestureMoveY).toBe(0);
  });

  it('clamps the pinch level and clears the gesture on touch end', () => {
    const { scroller, callback } = createScroller(3);
    scroller.doTouchStart(touches([0, 0], [100, 0]), 0);
    scroller.doTouchMove(touches([0, 0], [300, 0]), 16); // ×3 ⇒ 9, clamped
    expect(last(callback).zoom).toBe(4);
    scroller.doTouchEnd(32);
    expect(scroller.__isGesturing).toBe(false);
    expect(scroller.__pinchStartDistance).toBe(0);
    expect(scroller.__gestureMoveX).toBe(0);
  });

  it('a wheel zoom carries no pan, even right after a touch move did', () => {
    const { scroller } = createScroller(1);
    scroller.doTouchStart(touches([0, 0], [100, 0]), 0);
    scroller.doTouchMove(touches([10, 0], [110, 0]), 16); // pan +10
    expect(scroller.__gestureMoveX).toBe(10);
    scroller.doTouchEnd(32);
    scroller.doMouseZoom(-100, 48, 0, 0);
    expect(scroller.__gestureMoveX).toBe(0);
  });
});
