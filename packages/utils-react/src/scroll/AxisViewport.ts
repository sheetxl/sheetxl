import { type TopLeft, type Size } from '@sheetxl/utils';

import {
  type IViewport, type Viewport, type ViewportMetrics, type ClampBounds, type ViewportZoomStep
} from './Viewport';

/**
 * Per-axis routing over (up to) two {@link Viewport}s so one viewport can bind its horizontal and
 * vertical axes to different controllers. Implements {@link IViewport}, so it is interchangeable with a
 * plain {@link Viewport} anywhere a viewport is accepted (a grid, a ScrollPane).
 *
 * @remarks
 * This is what lets grids share scroll WITHOUT sharing both axes:
 * - A sheet **header** follows the main grid's vertical scroll (read-only) while owning its trivial
 *   horizontal — `_v` is the shared viewport (followed), `_h` is the header's own.
 * - **Split** peers share one vertical viewport (a single rAF ticker ⇒ eased/momentum scroll stays
 *   frame-locked) while scrolling horizontally independently — `_v` shared, `_h` each their own.
 *
 * Horizontal reads/writes route to `_h`, vertical to `_v`. When both axes resolve to the SAME viewport
 * (the common case: a standalone grid, or a main grid owning both) it collapses to 1:1 delegation. A
 * FOLLOWED axis is read-only: no `setTarget`/`setBounds` — its owner drives it.
 */
export class AxisViewport implements IViewport {
  private _combined: TopLeft | null = null;
  private _hSnap: TopLeft | null = null;
  private _vSnap: TopLeft | null = null;

  private _vp: ViewportMetrics | null = null;
  private _vpH: ViewportMetrics | null = null;
  private _vpV: ViewportMetrics | null = null;

  constructor(
    private readonly _h: Viewport,
    private readonly _v: Viewport,
    private readonly _followH: boolean,
    private readonly _followV: boolean,
    // Zoom is global (not axis-specific): the authoritative viewport (the shared one if present, else
    // own). Zoom reads/writes route here regardless of axis binding.
    private readonly _zoomCtrl: Viewport
  ) {}

  /** Both axes on one viewport — the transparent 1:1 case. */
  private get _same(): boolean { return this._h === this._v; }

  /** @inheritdoc ViewportStore.getSnapshot */
  getSnapshot(): TopLeft {
    const h = this._h.getSnapshot();
    const v = this._v.getSnapshot();
    if (this._combined && this._hSnap === h && this._vSnap === v) return this._combined;
    this._hSnap = h;
    this._vSnap = v;
    this._combined = { left: h.left, top: v.top };
    return this._combined;
  }

  /** @inheritdoc ViewportStore.getScroll */
  getScroll(): TopLeft { return { left: this._h.getScroll().left, top: this._v.getScroll().top }; }

  /** @inheritdoc ViewportStore.getTarget */
  getTarget(): TopLeft { return { left: this._h.getTarget().left, top: this._v.getTarget().top }; }

  /** @inheritdoc ViewportStore.isSettled */
  isSettled(): boolean {
    const s = this.getScroll();
    const t = this.getTarget();
    return s.left === t.left && s.top === t.top;
  }

  /** @inheritdoc ViewportStore.getZoom */
  getZoom(): number { return this._zoomCtrl.getZoom(); }

  /** @inheritdoc ViewportStore.getClient */
  getClient(): Size {
    return { width: this._h.getClient().width, height: this._v.getClient().height };
  }

  /**
   * @inheritdoc ViewportStore.isReady
   * Ready when each source controller is ready on the axis it contributes (width from `_h`, height from
   * `_v`) — so an own/throwaway controller with only one meaningful axis doesn't block on the other.
   */
  isReady(): boolean {
    if (this._same) return this._h.isReady();
    return this._h.isReadyAxis('width') && this._v.isReadyAxis('height');
  }

  /** @inheritdoc ViewportStore.getMetrics */
  getMetrics(): ViewportMetrics {
    const h = this._h.getMetrics();
    const v = this._v.getMetrics();
    if (this._vp && this._vpH === h && this._vpV === v) return this._vp;
    this._vpH = h;
    this._vpV = v;
    this._vp = {
      left: h.left,
      top: v.top,
      width: h.width,
      height: v.height,
      totalWidth: h.totalWidth,
      totalHeight: v.totalHeight
    };
    return this._vp;
  }

  subscribe(listener: () => void): () => void {
    if (this._same) return this._h.subscribe(listener);
    const removeH = this._h.subscribe(listener);
    const removeV = this._v.subscribe(listener);
    return () => { removeH(); removeV(); };
  }

  /** @inheritdoc IViewport.setBounds */
  setBounds(bounds: ClampBounds): void {
    if (this._same) {
      this._h.setBounds(bounds);
      return;
    }
    // Push each owned axis's clamp to its viewport; the cross axis is a don't-care (unbounded).
    if (!this._followH) {
      this._h.setBounds({ minLeft: bounds.minLeft, maxLeft: bounds.maxLeft, minTop: 0, maxTop: Infinity });
    }
    if (!this._followV) {
      this._v.setBounds({ minLeft: 0, maxLeft: Infinity, minTop: bounds.minTop, maxTop: bounds.maxTop });
    }
  }

  /** @inheritdoc IViewport.setSizes */
  setSizes(width: number, height: number, totalWidth: number, totalHeight: number): void {
    if (this._same) {
      this._h.setSizes(width, height, totalWidth, totalHeight);
      return;
    }
    if (!this._followH) {
      const s = this._h.getMetrics();
      this._h.setSizes(width, s.height, totalWidth, s.totalHeight);
    }
    if (!this._followV) {
      const s = this._v.getMetrics();
      this._v.setSizes(s.width, height, s.totalWidth, totalHeight);
    }
  }

  /** @inheritdoc IViewport.setTarget */
  setTarget(left: number, top: number, animate?: boolean): boolean {
    if (this._same) {
      const t = this._h.getTarget();
      // Followed axes are read-only — keep their current target.
      return this._h.setTarget(this._followH ? t.left : left, this._followV ? t.top : top, animate);
    }
    let changed = false;
    if (!this._followH) {
      // `_h`'s top is a don't-care (we read top from `_v`); keep it as-is.
      changed = this._h.setTarget(left, this._h.getTarget().top, animate) || changed;
    }
    if (!this._followV) {
      changed = this._v.setTarget(this._v.getTarget().left, top, animate) || changed;
    }
    return changed;
  }

  /** @inheritdoc IViewport.setZoom */
  setZoom(zoom: number, left?: number, top?: number): void {
    this._zoomCtrl.setZoom(zoom, left, top);
  }

  /** @inheritdoc IViewport.requestZoom — zoom is whole-grid state, so the relay is the zoom controller's. */
  requestZoom(step: ViewportZoomStep): void {
    this._zoomCtrl.requestZoom(step);
  }

  /** @inheritdoc IViewport.subscribeZoom */
  subscribeZoom(listener: (step: ViewportZoomStep) => void): () => void {
    return this._zoomCtrl.subscribeZoom(listener);
  }

  /**
   * @inheritdoc IViewport.observe
   * Route the observed element to each OWNED axis only. A followed axis is driven by its owner (the main
   * grid's ScrollPane observes the shared controller), so we never observe it here — otherwise a header
   * (or a split peer) would clobber the shared controller's cross axis with its own element size.
   */
  observe(el: Element | null): () => void {
    if (this._same) return this._h.observe(el);
    const detachers: Array<() => void> = [];
    if (!this._followH) detachers.push(this._h.observeAxis(el, 'width'));
    if (!this._followV) detachers.push(this._v.observeAxis(el, 'height'));
    return () => { for (let i = 0; i < detachers.length; i++) detachers[i](); };
  }

  /** @inheritdoc IViewport.setContent */
  setContent(totalWidth: number, totalHeight: number, minLeft: number = 0, minTop: number = 0): void {
    if (this._same) {
      this._h.setContent(totalWidth, totalHeight, minLeft, minTop);
      return;
    }
    if (!this._followH) this._h.setContentAxis('width', totalWidth, minLeft);
    if (!this._followV) this._v.setContentAxis('height', totalHeight, minTop);
  }
}
