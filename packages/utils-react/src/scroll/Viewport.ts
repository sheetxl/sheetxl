import { type TopLeft, type Size } from '@sheetxl/utils';

/**
 * View ports are useful for scrolling.
 */
export interface ViewportMetrics extends TopLeft, Size {
  /**
   * The x coordinate of the top-left corner.
   */
  left: number;
  /**
   * The y coordinate of the top-left corner.
   */
  top: number;
  /**
   * The width of the viewport.
   */
  width: number;
  /**
   * The height of the viewport.
   */
  height: number;
  /**
   * The total width of the content within the viewport.
   */
  totalWidth: number;
  /**
   * The total height of the content within the viewport.
   */
  totalHeight: number;
}

/**
 * One step of a zoom gesture (ctrl/⌘+wheel; pinch), requested on the viewport by the ScrollPane that
 * owns the gesture and applied by whoever owns the zoom's model (a sheet element) — the viewport itself
 * only relays it (see {@link IViewport.requestZoom}).
 */
export interface ViewportZoomStep {
  /** The new zoom factor (`1` = 100 %), continuous and already clamped to the gesture's range. */
  zoom: number;
  /** The gesture's own scroll position for this level, in screen (zoomed) px. */
  left: number;
  top: number;
  /** The focal point (cursor, or finger midpoint) in viewport client coordinates. */
  clientX: number;
  clientY: number;
  /**
   * The pan that rode along with this step — how far the fingers' midpoint moved on screen since the
   * previous step, in px, positive toward the right/bottom (so the content follows and scroll
   * decreases). `0` for a wheel, and on `end`.
   */
  panX: number;
  panY: number;
  /**
   * `start` on the first change of a gesture, `move` while it runs, `end` once it is over — for a
   * wheel, after the stream has been quiet for a moment; for touch, on the fingers lifting. `end`
   * repeats the final level so the owner can round, snap and settle.
   */
  phase: 'start' | 'move' | 'end';
}

/**
 * Read-only view of the scroll store. Layers/panes read the current scroll here and subscribe for
 * changes.
 */
export interface ViewportStore {
  /**
   * The current (rendered) scroll snapshot. The returned object is identity-stable until the scroll
   * changes, so it is safe as a `useSyncExternalStore` snapshot.
   */
  getSnapshot(): TopLeft;
  /** Convenience `{ left, top }` of the current (rendered) scroll. */
  getScroll(): TopLeft;
  /** The scroll TARGET the ticker is easing toward (equals current when settled). */
  getTarget(): TopLeft;
  /** Whether the current (rendered) position has reached the target — no easing in progress. */
  isSettled(): boolean;
  /** The zoom factor (`1` = none). Part of the viewport shape so a shared/synced viewport carries it. */
  getZoom(): number;
  /**
   * The raw cell-area client size = the measured client (uncapped by content). The grid reads this
   * for its own pane layout (`min(client, content)`); {@link getMetrics} caps it at content.
   */
  getClient(): Size;
  /**
   * Whether the viewport has everything it needs to clamp + emit: a measured client (observer fired or
   * manual sizes pushed) AND real content AND a positive client. The shared readiness signal that
   * replaces each grid's "pending until ready" gate.
   */
  isReady(): boolean;
  /**
   * The combined viewport (position + measured sizes) as one identity-stable object — what a
   * subscribed ScrollPane reads to size and place its scrollbars.
   */
  getMetrics(): ViewportMetrics;
  /**
   * Subscribe to scroll changes. Driven by the rAF ticker, so the listener fires at most once per
   * animation frame (and only while current is advancing toward target). Returns a remover.
   */
  subscribe(listener: () => void): () => void;
}

/**
 * A drivable viewport: the read {@link ViewportStore} plus the write methods the grid and ScrollPane
 * call. Implemented by {@link Viewport} (a single store) and `AxisViewport` (a per-axis
 * composition of two controllers). This is the single object type that flows between a ScrollPane and
 * its content — pass the SAME instance to both and they stay in sync through it.
 */
export interface IViewport extends ViewportStore {
  /**
   * Set the scroll TARGET (clamped) and start the ticker if needed.
   *
   * @param animate Animation is a property of the REQUEST, not a global policy: `true` glides to the
   * target (fixed ~{@link SCROLL_ANIMATION_MS} ease-out, long jumps clamped to animate only the
   * arrival — a wheel notch, PageDown, or goto). Omit/`false` for position control (a thumb drag, the
   * touch scroller's per-frame writes, a model restore) — the classic immediate scroll.
   *
   * @returns `true` if the target changed (caller fires its immediate-scroll side effects), else
   * `false` (a no-op move — caller bails).
   */
  setTarget(left: number, top: number, animate?: boolean): boolean;
  /**
   * Set the clamp bounds (structural — total size, viewport size, frozen floors). Re-clamps the
   * current target into the new bounds (e.g. the viewport shrank) and eases to it. Pushed by the grid;
   * the controller, not the grid, owns the clamp.
   */
  setBounds(bounds: ClampBounds): void;
  /**
   * Set the zoom factor and notify subscribers on a change. Zoom is structural (it changes every
   * pane's geometry), so the grid re-renders when this emits. The scroll position (current + target) is
   * rescaled by the zoom ratio so the same cell stays anchored at the top-left and so `scroll / zoom`
   * (the zoom-independent base position) is preserved. Because zoom and scroll are mutated together
   * before the single emit, a listener that reads scroll on this emit sees screen px already consistent
   * with the new zoom.
   *
   * With `left`/`top` (screen px for the NEW zoom) the position is set to them instead of the
   * ratio-rescale, current and target alike, in the same single emit — a focal-point zoom lands zoom
   * and scroll together, with no frame painted at the top-left-anchored position in between.
   */
  setZoom(zoom: number, left?: number, top?: number): void;
  /**
   * Relay a zoom-gesture step to the zoom's owner. The ScrollPane that runs the gesture calls this (as
   * it calls {@link setTarget} for a scroll); the viewport does NOT apply it — zoom is a whole percent
   * owned by a model the viewport knows nothing about — it hands the step to {@link subscribeZoom}
   * listeners, who commit it and push the result back in through {@link setZoom}.
   */
  requestZoom(step: ViewportZoomStep): void;
  /**
   * Listen for zoom-gesture steps ({@link requestZoom}). Returns the unsubscribe.
   */
  subscribeZoom(listener: (step: ViewportZoomStep) => void): () => void;
  /**
   * Push the measured viewport sizes (the grid measures them where it pushes {@link setBounds}; a
   * subscribed ScrollPane reads them via {@link getViewport} to size its scrollbar thumbs). Emits on
   * change.
   *
   * @remarks
   * This is the MANUAL input path — used by a standalone ScrollPane driving arbitrary content (no grid
   * to declare {@link setContent}). Calling it marks the viewport "manual provenance": the manually
   * pushed sizes/bounds win over anything {@link observe}/{@link setContent} would derive.
   */
  setSizes(width: number, height: number, totalWidth: number, totalHeight: number): void;

  /**
   * START measuring: attach a `ResizeObserver` to `el` (the scroll-client box) so the viewport owns its
   * own client-size measurement and derives its clamp bounds internally. Returns an unobserve fn —
   * symmetric with {@link subscribe}/unsubscribe, and the ONLY teardown the viewport has (there is no
   * `dispose`; the rAF ticker is self-terminating and listeners each remove themselves).
   *
   * @remarks
   * Each call is SELF-CONTAINED (its own observer, its own detach), so multiple elements can observe the
   * same viewport concurrently — e.g. split peers each reporting the shared axis (they report the same
   * value by construction; last write wins). A caller tears down exactly what it set up, nothing else —
   * StrictMode mount→cleanup→mount is naturally symmetric. Guarded for absence exactly like the rAF
   * ticker: with no `ResizeObserver` (SSR / non-DOM tests) it resolves an immediate default client so
   * {@link isReady} still becomes true. `null` is a no-op (returns a no-op detach).
   */
  observe(el: Element | null): () => void;

  /**
   * Declare the content geometry (the host — a grid — pushes this): the total scroll extent plus the
   * frozen-pane floors (`min*`, the same `minLeft`/`minTop` a manual {@link setBounds} carries). Calling
   * it switches the viewport into DERIVED-bounds mode — it computes its own bounds from
   * `content − client` and no longer needs the host to push {@link setBounds}. Emits + re-derives.
   */
  setContent(totalWidth: number, totalHeight: number, minLeft?: number, minTop?: number): void;
}

/**
 * The scroll store + writer + frame loop. Owns scroll position as a plain external store (not React
 * state): one synchronous source of truth that React reads via `useSyncExternalStore`.
 *
 * @remarks
 * Input sets a **target** ({@link setTarget}); a single rAF **ticker** advances **current**
 * toward target each frame, emits to subscribers when current moves, and self-stops when settled.
 * Input never triggers a render directly (it only writes a number),
 * so input rate is decoupled from render rate and bursts/jank can't flood.
 *
 * Animation is per-request (`setTarget(l, t, true)`), standard smooth-scroll semantics:
 * **fixed-duration, time-based ease-out** — every animated scroll takes the same wall-clock time
 * ({@link SCROLL_ANIMATION_MS}) whether it's a PageDown or a goto across 1M rows, because long jumps
 * are **clamped**: the glide starts within {@link ANIMATION_CLAMP_VIEWPORTS} viewports of the target
 * (the rows in between are never painted). Deltas smaller than the ramp finish proportionally sooner.
 * Time-based ⇒ frame-rate independent (identical feel at 60/120Hz). Un-animated targets apply in one
 * step (the classic immediate scroll).
 *
 * Owns clamping too: {@link setBounds} takes the structural bounds (the grid pushes them) and
 * {@link setTarget} clamps every target into them — the grid no longer clamps.
 */
export class Viewport implements IViewport {
  /** The rendered position — what subscribers read. */
  private _current: TopLeft;
  /** Where we're easing toward. */
  private _target: TopLeft;
  /** Clamp bounds for the target; unbounded until the grid pushes structural bounds via setBounds. */
  private _bounds: ClampBounds = { minLeft: 0, maxLeft: Infinity, minTop: 0, maxTop: Infinity };
  /** The in-flight animation (`null` = instant mode: current jumps to target next tick). */
  private _anim: { fromLeft: number; fromTop: number; start: number; duration: number } | null = null;
  /** Zoom factor (1 = none). Viewport state for sharing/sync; the grid drives its metrics. */
  private _zoom: number;
  /** Cached combined viewport (position + sizes); invalidated when either changes. */
  private _viewport: ViewportMetrics | null = null;
  private readonly _listeners = new Set<() => void>();
  private _rafId: number | null = null;

  // ── Measure half (the viewport owns its own client measurement + derives bounds) ────────────────
  /** The ResizeObserver-measured client box (the observed element). `null` until the observer fires. */
  private _measuredClient: Size | null = null;
  /** Content geometry the host declares (see {@link setContent}) — total extent + frozen floors. */
  private _content = { totalWidth: 0, totalHeight: 0, minLeft: 0, minTop: 0 };
  /** True once {@link setContent} was called → derive bounds internally (vs manual {@link setBounds}). */
  private _hasContent = false;
  /** MANUAL provenance: sizes pushed via {@link setSizes} (the standalone story). Wins over measured. */
  private _manualSizes: { width: number; height: number; totalWidth: number; totalHeight: number } | null = null;
  /** MANUAL provenance: bounds pushed via {@link setBounds}. Wins over derived. */
  private _manualBounds: ClampBounds | null = null;

  constructor(
    options?: ViewportOptions) {
    const left = options?.topLeft?.left ?? 0;
    const top = options?.topLeft?.top ?? 0;
    this._current = { left, top };
    this._target = { left, top };
    this._zoom = options?.zoom ?? 1;
  }

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  // NOTE: there is deliberately NO `dispose`. The store has no lifecycle of its own: the rAF ticker is
  // self-terminating (it runs only while `current !== target` and stops on settle — emitting to zero
  // listeners is a harmless no-op), subscribers remove themselves via the unsubscribe fn, and observers
  // detach via the unobserve fn. A destructor here could only cancel an in-flight tick — which is
  // exactly what once stranded `current !== target` forever (the "opens at 0,0" StrictMode bug).

  /** @inheritdoc ViewportStore.getSnapshot */
  getSnapshot(): TopLeft { return this._current; }

  /** @inheritdoc ViewportStore.getScroll */
  getScroll(): TopLeft { return { left: this._current.left, top: this._current.top }; }

  /** @inheritdoc ViewportStore.getTarget */
  getTarget(): TopLeft { return { left: this._target.left, top: this._target.top }; }

  /** @inheritdoc ViewportStore.isSettled */
  isSettled(): boolean {
    return this._current.left === this._target.left && this._current.top === this._target.top;
  }

  /** @inheritdoc ViewportStore.getZoom */
  getZoom(): number { return this._zoom; }

  private readonly _zoomListeners = new Set<(step: ViewportZoomStep) => void>();
  /** @inheritdoc IViewport.requestZoom */
  requestZoom(step: ViewportZoomStep): void {
    const listeners = Array.from(this._zoomListeners); // copy: a listener may unsubscribe during fan-out
    for (let i=0; i<listeners.length; i++) listeners[i](step);
  }
  /** @inheritdoc IViewport.subscribeZoom */
  subscribeZoom(listener: (step: ViewportZoomStep) => void): () => void {
    this._zoomListeners.add(listener);
    return () => { this._zoomListeners.delete(listener); };
  }

  /** @inheritdoc ViewportStore.getMetrics */
  getMetrics(): ViewportMetrics {
    if (this._viewport) return this._viewport;
    const client = this._effClient();
    const total = this._effTotal();
    // width/height are the VISIBLE window (client capped at content) — the same numbers the grid used
    // to push via `setSizes` (its `containerWidth = min(realizedWidth, contentTotal)`). Scrollbars size
    // their thumbs off this ratio.
    this._viewport = {
      left: this._current.left,
      top: this._current.top,
      width: Math.min(client.width, total.totalWidth),
      height: Math.min(client.height, total.totalHeight),
      totalWidth: total.totalWidth,
      totalHeight: total.totalHeight
    };
    return this._viewport;
  }

  /** @inheritdoc ViewportStore.getClient */
  getClient(): Size {
    return this._effClient();
  }

  /** @inheritdoc ViewportStore.isReady */
  isReady(): boolean {
    const client = this._effClient();
    const total = this._effTotal();
    const measured = this._manualSizes !== null || this._measuredClient !== null;
    return measured && client.width > 0 && client.height > 0 && total.totalWidth > 0 && total.totalHeight > 0;
  }

  /**
   * The effective cell-area client: manual sizes win (the standalone story); otherwise the measured
   * client (the host observes the cell-area element directly, so there is nothing to subtract).
   */
  private _effClient(): Size {
    if (this._manualSizes) return { width: this._manualSizes.width, height: this._manualSizes.height };
    const m = this._measuredClient;
    if (!m) return { width: 0, height: 0 };
    return { width: m.width, height: m.height };
  }

  /** The effective content extent: manual sizes win; otherwise the host-declared content. */
  private _effTotal(): { totalWidth: number; totalHeight: number } {
    if (this._manualSizes) {
      return { totalWidth: this._manualSizes.totalWidth, totalHeight: this._manualSizes.totalHeight };
    }
    return { totalWidth: this._content.totalWidth, totalHeight: this._content.totalHeight };
  }

  /**
   * Derive the clamp bounds from client + content + frozen floors and re-clamp the target into them.
   * This is the single internal path that used to live in the grid's `setBounds` layoutEffect + its two
   * resize re-clamp effects — now self-healing: any measure/content change funnels through here.
   */
  private _deriveBounds(): void {
    if (this._manualBounds) {
      this._applyBounds(this._manualBounds);
      return;
    }
    // Until the viewport is genuinely ready (measured + real content) bounds stay UNBOUNDED, so a
    // model-restored scroll target survives instead of being clamped to 0 (the "opens at 0,0" fix, now
    // at the root). Derived mode only kicks in once `setContent` has been called.
    if (!this._hasContent || !this.isReady()) {
      this._applyBounds({ minLeft: 0, maxLeft: Infinity, minTop: 0, maxTop: Infinity });
      return;
    }
    const client = this._effClient();
    const total = this._effTotal();
    const minLeft = this._content.minLeft;
    const minTop = this._content.minTop;
    this._applyBounds({
      minLeft,
      minTop,
      maxLeft: Math.max(minLeft, total.totalWidth - client.width),
      maxTop: Math.max(minTop, total.totalHeight - client.height)
    });
  }

  /** Set `_bounds` + re-clamp the current target into them (shared by derived + manual paths). */
  private _applyBounds(bounds: ClampBounds): void {
    this._bounds = bounds;
    const left = clampValue(this._target.left, bounds.minLeft, bounds.maxLeft);
    const top = clampValue(this._target.top, bounds.minTop, bounds.maxTop);
    if (left !== this._target.left || top !== this._target.top) {
      this._target = { left, top };
      this._ensureTicking();
    }
  }

  /** @inheritdoc IViewport.setBounds */
  setBounds(bounds: ClampBounds): void {
    // MANUAL provenance: an explicit push wins over derived bounds (the standalone story).
    this._manualBounds = bounds;
    this._applyBounds(bounds);
  }

  /** @inheritdoc IViewport.setSizes */
  setSizes(width: number, height: number, totalWidth: number, totalHeight: number): void {
    const s = this._manualSizes;
    if (s && s.width === width && s.height === height && s.totalWidth === totalWidth && s.totalHeight === totalHeight) {
      return;
    }
    // MANUAL provenance: pushed sizes win over the measured client (see `_effClient`/`_effTotal`).
    this._manualSizes = { width, height, totalWidth, totalHeight };
    this._viewport = null;
    this._deriveBounds();
    this._emit();
  }

  /** @inheritdoc IViewport.observe */
  observe(el: Element | null): () => void {
    return this._observe(el, 'both');
  }

  /**
   * The one observer implementation. Each call is SELF-CONTAINED — it creates its own
   * `ResizeObserver` and returns a detach that tears down exactly that observer, nothing else (no
   * store-level "current observer" slot). So N observers coexist on one store (split peers sharing an
   * axis; a StrictMode remount overlapping its own cleanup) and last write wins on the measurement —
   * concurrent observers of a shared axis report the same value by construction.
   */
  private _observe(el: Element | null, axis: 'both' | 'width' | 'height'): () => void {
    if (!el) return _NOOP;
    const apply = (w: number, h: number): void => {
      const m = this._measuredClient;
      this._setMeasuredClient(
        axis === 'height' ? (m?.width ?? 0) : w,
        axis === 'width' ? (m?.height ?? 0) : h
      );
    };
    if (!_RO_OK()) {
      // No ResizeObserver (SSR / non-DOM test): settle an immediate default so `isReady` can't hang.
      apply(0, 0);
      return _NOOP;
    }
    const ro = new ResizeObserver((entries: ResizeObserverEntry[]) => {
      const cr = entries[0]?.contentRect;
      if (cr) apply(cr.width, cr.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }

  private _setMeasuredClient(width: number, height: number): void {
    const m = this._measuredClient;
    if (m && m.width === width && m.height === height) return;
    this._measuredClient = { width, height };
    this._viewport = null;
    this._deriveBounds();
    this._emit();
  }

  /** @inheritdoc IViewport.setContent */
  setContent(totalWidth: number, totalHeight: number, minLeft: number = 0, minTop: number = 0): void {
    const c = this._content;
    if (this._hasContent && c.totalWidth === totalWidth && c.totalHeight === totalHeight &&
        c.minLeft === minLeft && c.minTop === minTop) {
      return;
    }
    this._hasContent = true;
    this._content = { totalWidth, totalHeight, minLeft, minTop };
    this._viewport = null;
    this._deriveBounds();
    this._emit();
  }

  // ── Per-axis composition helpers (used by AxisViewport; not on IViewport) ────────────────────────
  // A composed viewport (header follower / split peer) shares ONE axis with another controller and owns
  // the other. These write a single axis so a follower/peer can never clobber the shared controller's
  // cross axis (e.g. two split peers must not fight over the shared viewport's width).

  /**
   * Observe `el` but update ONLY the given axis of the measured client (the other axis is left as-is).
   * Self-contained per call like {@link observe}. Returns an unobserve fn.
   */
  observeAxis(el: Element | null, axis: 'width' | 'height'): () => void {
    return this._observe(el, axis);
  }

  /** Declare content for ONE axis only (the other axis's content is left untouched). */
  setContentAxis(axis: 'width' | 'height', total: number, min: number = 0): void {
    const c = this._content;
    const next = axis === 'width'
      ? { totalWidth: total, totalHeight: c.totalHeight, minLeft: min, minTop: c.minTop }
      : { totalWidth: c.totalWidth, totalHeight: total, minLeft: c.minLeft, minTop: min };
    if (this._hasContent && next.totalWidth === c.totalWidth && next.totalHeight === c.totalHeight &&
        next.minLeft === c.minLeft && next.minTop === c.minTop) {
      return;
    }
    this._hasContent = true;
    this._content = next;
    this._viewport = null;
    this._deriveBounds();
    this._emit();
  }

  /**
   * Readiness for a SINGLE axis — measured client + real content along that axis only. A composed
   * viewport is ready when each of its two source controllers is ready on the axis it contributes, so
   * an own/throwaway controller with only one meaningful axis doesn't block on the other.
   */
  isReadyAxis(axis: 'width' | 'height'): boolean {
    const measured = this._manualSizes !== null || this._measuredClient !== null;
    if (!measured) return false;
    const client = this._effClient();
    const total = this._effTotal();
    return axis === 'width'
      ? client.width > 0 && total.totalWidth > 0
      : client.height > 0 && total.totalHeight > 0;
  }

  /** @inheritdoc IViewport.setTarget */
  setTarget(left: number, top: number, animate?: boolean): boolean {
    const b = this._bounds;
    left = clampValue(left, b.minLeft, b.maxLeft);
    top = clampValue(top, b.minTop, b.maxTop);
    if (this._target.left === left && this._target.top === top) {
      // Target unchanged, but enforce the invariant anyway: while current !== target the ticker MUST be
      // running. Nothing in this class can strand it anymore (there is no dispose / rAF cancel), so this
      // is a one-line belt-and-braces re-arm, kept because the invariant is what the whole store leans
      // on. Callers still see `false` (no target change) so their bail-on-no-op is unaffected.
      if (this._current.left !== left || this._current.top !== top) this._ensureTicking();
      return false;
    }
    this._target = { left, top };
    if (animate) this._startAnimation();
    else this._anim = null; // an instant request cancels any glide — position control wins
    this._ensureTicking();
    return true;
  }

  /**
   * Arm the fixed-duration glide toward the (just-set) target. A retarget mid-flight restarts from the
   * CURRENT position with a fresh clock — with an ease-out curve a stream of requests (wheel notches, a
   * held PageDown) reads as one continuous motion.
   */
  private _startAnimation(): void {
    const cur = this._current;
    const t = this._target;
    // Long-jump clamp: teleport to within N viewports of the target and animate only the arrival —
    // constant perceived time and bounded rendering (the content in between is never painted).
    const client = this._effClient();
    const clampW = client.width > 0 ? client.width * ANIMATION_CLAMP_VIEWPORTS : Infinity;
    const clampH = client.height > 0 ? client.height * ANIMATION_CLAMP_VIEWPORTS : Infinity;
    const fromLeft = clampValue(cur.left, t.left - clampW, t.left + clampW);
    const fromTop = clampValue(cur.top, t.top - clampH, t.top + clampH);
    // Fixed duration — with a floor so a small delta (a one-row nudge) finishes proportionally sooner
    // instead of gliding for the full time.
    const distance = Math.max(Math.abs(t.left - fromLeft), Math.abs(t.top - fromTop));
    const duration = Math.min(SCROLL_ANIMATION_MS, distance * ANIMATION_MS_PER_PX);
    if (duration <= FRAME_MS) { // sub-frame: not observable as motion — just jump
      this._anim = null;
      return;
    }
    this._anim = { fromLeft, fromTop, start: _now(), duration };
  }

  /** @inheritdoc IViewport.setZoom */
  setZoom(zoom: number, left?: number, top?: number): void {
    const prev = this._zoom;
    if (prev === zoom) return;
    this._zoom = zoom;
    if (left !== undefined && top !== undefined) {
      // An explicit position for the new zoom (a focal-point zoom): apply it now, current and target
      // alike, so this one emit carries the final (zoom, scroll) pair. Not clamped — the bounds still
      // describe the OLD zoom; the grid re-derives them for the new one and re-clamps the target then.
      this._current = { left: Math.max(0, left), top: Math.max(0, top) };
      this._target = { left: this._current.left, top: this._current.top };
      this._anim = null;
    } else if (prev > 0 && zoom > 0 && (this._current.left !== 0 || this._current.top !== 0 ||
        this._target.left !== 0 || this._target.top !== 0)) {
      // Scroll is stored in screen (zoomed) px, so the same content position scales with zoom. Rescale
      // current + target by the ratio so a zoom change keeps the same cell anchored at the top-left, AND
      // so the (zoom, scroll) pair is mutated atomically — a subscriber that reads scroll on this single
      // emit sees screen px already consistent with the new zoom (no stale-zoom round-trip). Bounds are
      // re-clamped when the grid pushes new structural sizes for the new zoom.
      const ratio = zoom / prev;
      this._current = { left: this._current.left * ratio, top: this._current.top * ratio };
      this._target = { left: this._target.left * ratio, top: this._target.top * ratio };
      // An in-flight glide is rescaled with them so it stays aimed at the same content.
      if (this._anim) {
        this._anim.fromLeft *= ratio;
        this._anim.fromTop *= ratio;
      }
    }
    this._viewport = null;
    this._emit();
  }

  private _emit(): void {
    // copy first: a listener may (un)subscribe during fan-out.
    const listeners = Array.from(this._listeners);
    for (let i=0; i<listeners.length; i++) listeners[i]();
  }

  private _ensureTicking(): void {
    if (this._rafId !== null) return;
    if (typeof requestAnimationFrame !== 'function') {
      // No rAF (SSR / non-DOM test): no frame loop to animate on — settle instantly in one step.
      this._anim = null;
      while (this._advance()) { /* instant apply settles immediately */ }
      return;
    }
    this._rafId = requestAnimationFrame(this._tick);
  }

  private _tick = (): void => {
    this._rafId = null;
    if (this._advance()) this._ensureTicking();
  };

  /**
   * Advance current one frame toward target; emit if it moved. Returns `true` while more frames are
   * needed (an animation in flight), `false` once current has reached target.
   */
  private _advance(): boolean {
    const cur = this._current;
    const target = this._target;
    const anim = this._anim;
    let left: number;
    let top: number;
    let inFlight = false;
    if (anim) {
      const t = (_now() - anim.start) / anim.duration;
      if (t >= 1) {
        left = target.left;
        top = target.top;
        this._anim = null;
      } else {
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic: fast start, decelerate into the target
        left = anim.fromLeft + (target.left - anim.fromLeft) * eased;
        top = anim.fromTop + (target.top - anim.fromTop) * eased;
        inFlight = true;
      }
    } else {
      // Instant: current = target in one step (the classic immediate scroll).
      left = target.left;
      top = target.top;
    }

    if (left === cur.left && top === cur.top) return inFlight;

    this._current = { left, top };
    this._viewport = null;
    this._emit();
    return inFlight;
  }
}

export interface ViewportOptions {
  topLeft?: Partial<TopLeft>;
  zoom?: number;
}

/** Scroll clamp bounds (in scroll px). `min*` are the frozen-region floors; `max*` are total − view. */
export interface ClampBounds {
  minLeft: number;
  maxLeft: number;
  minTop: number;
  maxTop: number;
}

/**
 * Fixed duration (ms) of an animated scroll. Every animated request takes this long regardless of
 * distance — a PageDown and a goto across 1M rows read identically (long jumps are clamped by
 * {@link ANIMATION_CLAMP_VIEWPORTS}); only sub-ramp deltas finish sooner (see
 * {@link ANIMATION_MS_PER_PX}).
 */
export const SCROLL_ANIMATION_MS = 200;

/**
 * Small-delta floor: `duration = min(SCROLL_ANIMATION_MS, distance × this)`. A one-row nudge (~20px)
 * takes ~50ms instead of gliding the full duration; anything beyond ~80px gets the fixed time.
 */
const ANIMATION_MS_PER_PX = 2.5;

/**
 * Long-jump clamp, in viewports: an animated scroll teleports to within this many viewport-sizes of
 * the target and animates only the arrival. Constant perceived time, bounded rendering — the content
 * in between is never painted.
 */
const ANIMATION_CLAMP_VIEWPORTS = 1.5;

/** Animations at or under one frame's worth of time aren't observable as motion — apply instantly. */
const FRAME_MS = 17;

const _now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * ResizeObserver availability — guarded like the rAF ticker for SSR / non-DOM tests. Evaluated at
 * call-time (not module load), and via the bare global (like `requestAnimationFrame`), so a test can
 * inject a mock `ResizeObserver`.
 */
const _RO_OK = (): boolean => typeof ResizeObserver !== 'undefined';

/** Shared no-op unobserve for the null-element / no-RO paths. */
const _NOOP = (): void => { /* nothing to detach */ };

const clampValue = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
