import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { Viewport } from '../../scroll/Viewport';

/**
 * Viewport stores scroll in screen (zoomed) px. The model (WorksheetView) stores zoom-independent (base)
 * px and derives screen px as `base * zoom`. The invariant that keeps the same cell anchored on zoom is:
 *
 *   scroll / zoom  (i.e. base px)  is unchanged by a zoom change.
 *
 * Regression for the freeze+scroll+zoom offset bug: `setZoom` must rescale current + target by the
 * zoom ratio ATOMICALLY (one emit), so a subscriber reading scroll on that emit never divides a
 * stale-zoom scroll by the new zoom (which corrupted the base-px model and shifted the grid).
 */
describe('Viewport.setZoom', () => {
  it('rescales scroll by the zoom ratio so base px (scroll / zoom) is preserved (zoom in)', () => {
    const vp = new Viewport({ topLeft: { left: 100, top: 200 }, zoom: 1 });
    vp.setZoom(2);
    expect(vp.getZoom()).toBe(2);
    expect(vp.getTarget()).toEqual({ left: 200, top: 400 });
    expect(vp.getScroll()).toEqual({ left: 200, top: 400 });
    // the invariant the grid relies on
    expect(vp.getScroll().left / vp.getZoom()).toBe(100);
    expect(vp.getScroll().top / vp.getZoom()).toBe(200);
  });

  it('rescales scroll on zoom out', () => {
    const vp = new Viewport({ topLeft: { left: 100, top: 200 }, zoom: 2 });
    vp.setZoom(1);
    expect(vp.getTarget()).toEqual({ left: 50, top: 100 });
    expect(vp.getScroll()).toEqual({ left: 50, top: 100 });
  });

  it('leaves a zero scroll at zero (the case that always worked, regardless of zoom)', () => {
    const vp = new Viewport({ topLeft: { left: 0, top: 0 }, zoom: 1 });
    vp.setZoom(4);
    expect(vp.getScroll()).toEqual({ left: 0, top: 0 });
    expect(vp.getTarget()).toEqual({ left: 0, top: 0 });
  });

  it('is a no-op when the zoom is unchanged', () => {
    const vp = new Viewport({ topLeft: { left: 100, top: 200 }, zoom: 2 });
    vp.setZoom(2);
    expect(vp.getScroll()).toEqual({ left: 100, top: 200 });
  });

  it('with an explicit position lands zoom + scroll (current AND target) in one emit — a focal-point zoom', () => {
    const vp = new Viewport({ topLeft: { left: 100, top: 200 }, zoom: 1 });
    let seen: { zoom: number; scroll: { left: number; top: number }; settled: boolean } | null = null;
    let emits = 0;
    vp.subscribe(() => { emits++; seen = { zoom: vp.getZoom(), scroll: vp.getScroll(), settled: vp.isSettled() }; });
    vp.setZoom(2, 460, 680);
    expect(emits).toBe(1);
    expect(seen).toEqual({ zoom: 2, scroll: { left: 460, top: 680 }, settled: true });
    expect(vp.getTarget()).toEqual({ left: 460, top: 680 });
  });

  it('composes across multiple zoom steps (base px stays constant throughout)', () => {
    const vp = new Viewport({ topLeft: { left: 65, top: 0 }, zoom: 1 });
    const base = vp.getScroll().left / vp.getZoom(); // 65
    for (const z of [2, 4, 0.5, 1, 3]) {
      vp.setZoom(z);
      expect(vp.getScroll().left / vp.getZoom()).toBeCloseTo(base, 9);
    }
  });
});

/**
 * Invariant: while `current !== target`, the rAF ticker MUST be running so `current` converges.
 *
 * History: the "opens at scroll 0,0" bug was a `dispose()` cancelling the pending rAF on a StrictMode
 * fake-unmount, stranding `current` forever. `dispose` has since been DELETED — the store has no
 * destructor (the ticker is self-terminating; subscribers/observers each release themselves) — so
 * nothing can cancel a pending tick anymore. `setTarget` still keeps a belt-and-braces re-arm on the
 * no-op path (target unchanged but not yet reached → ensure ticking), verified here with a manual rAF
 * mock (the real code path settles instantly when no rAF exists).
 */
describe('Viewport ticker convergence', () => {
  let cbs: Array<FrameRequestCallback | null>;
  let origRAF: typeof globalThis.requestAnimationFrame;
  const flush = (): void => {
    const pending = cbs;
    cbs = [];
    for (const cb of pending) cb?.(0);
  };
  beforeEach(() => {
    cbs = [];
    origRAF = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => cbs.push(cb)) as typeof globalThis.requestAnimationFrame;
  });
  afterEach(() => {
    globalThis.requestAnimationFrame = origRAF;
  });

  it('re-issuing a still-pending target keeps the ticker armed and converges', () => {
    const vp = new Viewport(); // starts at 0,0
    expect(vp.setTarget(0, 540)).toBe(true);  // target moves → schedules a tick
    expect(vp.getScroll()).toEqual({ left: 0, top: 0 }); // not yet advanced (tick pending)
    // Re-seed to the SAME target (a StrictMode remount re-runs the seed effect). Returns false (no
    // target change) and must leave the ticker armed.
    expect(vp.setTarget(0, 540)).toBe(false);
    flush();
    expect(vp.getScroll()).toEqual({ left: 0, top: 540 }); // converged
  });

  it('does not schedule a tick when re-issuing a target already reached (settled)', () => {
    const vp = new Viewport();
    vp.setTarget(0, 540);
    flush(); // converge to 540
    expect(vp.getScroll()).toEqual({ left: 0, top: 540 });
    cbs = []; // clear
    expect(vp.setTarget(0, 540)).toBe(false); // already there → no work
    expect(cbs.length).toBe(0); // no wasted rAF
  });
});

/**
 * The measure half: the viewport OWNS its client measurement (`observe`) and DERIVES its own clamp
 * bounds from client + content + inset — no `setSizes` / `setBounds` pushes from the host. This
 * suite drives measurement through a mock `ResizeObserver` (jsdom has none) so the derivation is
 * exercised without a real layout.
 */
describe('Viewport measure half (observe / setContent / derived bounds)', () => {
  let observed: Map<Element, (rect: { width: number; height: number }) => void>;
  let origRO: any;
  beforeEach(() => {
    observed = new Map();
    origRO = (globalThis as any).ResizeObserver;
    // Minimal mock: capture the callback keyed by element so a test can push a contentRect. Each
    // instance tracks ITS OWN elements and removes exactly those on disconnect — so a detach's
    // isolation (it must not disturb other observers of the same store) is actually exercised.
    (globalThis as any).ResizeObserver = class {
      private _cb: (entries: any[]) => void;
      private _els: Element[] = [];
      constructor(cb: (entries: any[]) => void) { this._cb = cb; }
      observe(el: Element): void {
        this._els.push(el);
        observed.set(el, (rect) => this._cb([{ contentRect: rect } as any]));
      }
      disconnect(): void {
        for (const el of this._els) observed.delete(el);
        this._els = [];
      }
    };
  });
  afterEach(() => {
    (globalThis as any).ResizeObserver = origRO;
  });
  const fireResize = (el: Element, width: number, height: number): void => {
    observed.get(el)?.({ width, height });
  };

  it('is not ready until BOTH a measured client and real content exist', () => {
    const vp = new Viewport();
    const el = {} as unknown as Element;
    expect(vp.isReady()).toBe(false);         // nothing yet
    vp.observe(el);
    fireResize(el, 800, 600);
    expect(vp.isReady()).toBe(false);         // measured, but no content declared
    vp.setContent(5000, 4000);
    expect(vp.isReady()).toBe(true);          // measured + content → ready
  });

  it('derives maxLeft/maxTop as content − client and clamps the target', () => {
    const vp = new Viewport();
    const el = {} as unknown as Element;
    vp.observe(el);
    fireResize(el, 800, 600);
    vp.setContent(5000, 4000);
    // maxLeft = 5000 − 800 = 4200; maxTop = 4000 − 600 = 3400.
    vp.setTarget(9999, 9999);
    expect(vp.getTarget()).toEqual({ left: 4200, top: 3400 });
  });

  it('keeps bounds UNBOUNDED until ready, so a restored target is not clamped to 0 (the "opens at 0,0" fix)', () => {
    const vp = new Viewport();
    const el = {} as unknown as Element;
    // A model restore seeds a non-zero target BEFORE the observer fires and before content is declared.
    vp.setTarget(0, 540);
    expect(vp.getTarget()).toEqual({ left: 0, top: 540 }); // survives (unbounded)
    vp.observe(el);
    fireResize(el, 800, 600);                              // measured, still no content → unbounded
    expect(vp.getTarget()).toEqual({ left: 0, top: 540 }); // still survives
    vp.setContent(5000, 4000);                             // now ready → bounds derived, 540 fits
    expect(vp.getTarget()).toEqual({ left: 0, top: 540 });
  });

  it('lets a manual setSizes/setBounds push WIN over the measured client (the standalone story path)', () => {
    const vp = new Viewport();
    const el = {} as unknown as Element;
    vp.observe(el);
    fireResize(el, 800, 600);
    // The standalone ScrollPane story pushes its own 100×100 window over 1000×1000 content + bounds.
    vp.setSizes(100, 100, 1000, 1000);
    vp.setBounds({ minLeft: 0, maxLeft: 900, minTop: 0, maxTop: 900 });
    expect(vp.getClient()).toEqual({ width: 100, height: 100 });   // manual wins over measured 800×600
    const m = vp.getMetrics();
    expect(m.width).toBe(100);
    expect(m.totalWidth).toBe(1000);
    vp.setTarget(9999, 9999);
    expect(vp.getTarget()).toEqual({ left: 900, top: 900 });       // manual bounds win
  });

  it('supports multiple concurrent observers of one store; a detach removes only its own observer', () => {
    // The split-view case: two peer grids each observe the SHARED vertical controller's height axis.
    // observe is per-call self-contained (like subscribe), so the second observer must not evict the
    // first, and one peer unmounting (detaching) must not stop the other's measurements.
    const vp = new Viewport();
    const elA = {} as unknown as Element;
    const elB = {} as unknown as Element;
    const detachA = vp.observeAxis(elA, 'height');
    const detachB = vp.observeAxis(elB, 'height');
    fireResize(elB, 300, 600);
    expect(vp.getClient().height).toBe(600);
    detachB();                     // peer B unmounts — must tear down ONLY its own observer
    fireResize(elA, 300, 480);     // peer A still measures the shared axis
    expect(vp.getClient().height).toBe(480);
    detachA();
  });

  it('degrades to an immediate {0,0} client when no ResizeObserver exists (SSR / non-DOM)', () => {
    const saved = (globalThis as any).ResizeObserver;
    delete (globalThis as any).ResizeObserver;
    try {
      const vp = new Viewport();
      vp.observe({} as unknown as Element);
      expect(vp.getClient()).toEqual({ width: 0, height: 0 }); // resolved, not hung
    } finally {
      (globalThis as any).ResizeObserver = saved;
    }
  });
});
