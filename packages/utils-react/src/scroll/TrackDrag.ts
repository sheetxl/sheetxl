import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Repeat interval (ms) for the parked-at-edge hold: while the thumb is dragged past the track end no
 * pointer-move events fire, so the engine ticks the session's `edgeHold` at this cadence instead.
 */
export const EDGE_HOLD_INTERVAL_MS = 60;
/** Delay (ms) before the first page repeat when pressing and holding the track. */
export const PAGE_INITIAL_DELAY_MS = 260;
/** Interval (ms) between page repeats while holding the track. */
export const PAGE_REPEAT_DELAY_MS = 120;

/** Where a scrollbar press landed: on the thumb, or on the track before/after it. */
export type TrackDragZone = 'thumb' | 'track-before' | 'track-after';

/**
 * Metadata for one parked-at-edge tick. The engine supplies the *heartbeat*; what a tick does — and how
 * it accelerates — is entirely the session's policy (the engine knows nothing about elastic regions).
 */
export interface TrackEdgeTick {
  /** 1-based tick number of the current uninterrupted hold. */
  count: number;
  /** Milliseconds since this hold engaged (an acceleration policy can key off this). */
  heldMs: number;
  /** How far (px) the pointer sits past the track end (0 when exactly at it). */
  overshootPx: number;
}

/**
 * The in-flight gesture returned by {@link TrackDragOptions.onStart}. It carries the *policy* — how the
 * scrollbar maps the gesture to scroll — while the engine owns the *mechanics* (pointer capture, zone
 * hit-testing, the hold timers, and the `dragMode` signal). The 1-D analog of `DragCellsSession`.
 */
export interface TrackDragSession {
  /**
   * Thumb drag: position the thumb's leading edge at `trackPx` (the engine keeps the grab point under
   * the pointer). Values may exceed the track bounds; the policy clamps.
   */
  apply?: (trackPx: number) => void;
  /**
   * Thumb parked past a track end. Advance the scroll one step (policy decides the step — e.g. a
   * virtual scrollbar extends its elastic region, accelerating with `tick.heldMs`) and return whether
   * to keep ticking. Omit for a linear scrollbar: its thumb at the end IS the end.
   */
  edgeHold?: (edge: -1 | 1, tick: TrackEdgeTick) => boolean;
  /**
   * Track press/hold: scroll one page toward `direction`. The engine pages once on press, then repeats
   * — pausing while the thumb has reached the pointer and resuming if the pointer moves further away.
   */
  page?: (direction: -1 | 1) => void;
  /** Finalize on pointer-up. */
  end?: (e: React.PointerEvent) => void;
  /** Public label surfaced as {@link TrackDragResult.dragMode} between down and up. */
  dragMode?: string;
}

export interface TrackDragOptions {
  /** Axis of the track. (Recreate the controller when this changes — the hook keys its memo on it.) */
  vertical: boolean;
  /** Live track rect (screen coords) for pointer → track-px mapping and end detection. */
  getTrackRect: () => DOMRect | null;
  /** Live thumb placement in track px, or `null` when there is no thumb (disabled — no gesture starts). */
  getThumb: () => { offset: number; length: number } | null;
  /**
   * Begin a gesture in `zone`. Return the {@link TrackDragSession} policy — or `null` to decline
   * (disabled, non-primary button already filtered by the engine).
   */
  onStart: (zone: TrackDragZone, e: React.PointerEvent) => TrackDragSession | null;
  /** Notified when the active session's `dragMode` changes (the hook turns this into React state). */
  onDragModeChange?: (mode: string | null) => void;
  edgeHoldIntervalMs?: number;
  pageInitialDelayMs?: number;
  pageRepeatDelayMs?: number;
}

/** The headless controller behind {@link useTrackDrag}. */
export interface TrackDragController {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  /** Stop any hold timer. Call on unmount (the hook wires this). */
  dispose: () => void;
}

/** {@link useTrackDrag}'s result: the three spreadable handlers + the public `dragMode`. */
export interface TrackDragResult {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  /** The in-flight session's {@link TrackDragSession.dragMode}, or `null` between gestures. */
  dragMode: string | null;
}

/**
 * The **scrollbar drag engine** — the 1-D analog of `createDragCells`. One pointer surface (the track)
 * serves all three gestures: thumb drag, track page-and-hold, and the parked-at-edge hold. The engine
 * owns the mechanics — pointer capture, zone hit-testing, one hold timer, last-point re-apply — and has
 * NO scroll policy: an {@link TrackDragOptions.onStart} adapter supplies it as a
 * {@link TrackDragSession}, so a linear and a virtual/elastic scrollbar differ only in the session.
 *
 * @remarks
 * A plain (non-hook) factory so it can be unit-tested with a fake track. The React hook is
 * {@link useTrackDrag}.
 */
export const createTrackDrag = (options: TrackDragOptions): TrackDragController => {
  const {
    vertical, getTrackRect, getThumb, onStart, onDragModeChange,
    edgeHoldIntervalMs = EDGE_HOLD_INTERVAL_MS,
    pageInitialDelayMs = PAGE_INITIAL_DELAY_MS,
    pageRepeatDelayMs = PAGE_REPEAT_DELAY_MS
  } = options;

  let session: TrackDragSession | null = null;
  let zone: TrackDragZone | null = null;
  /** Thumb drag: pointer offset within the thumb at down, so the grab point stays under the pointer. */
  let grabOffset = 0;
  /** Latest pointer position along the track (track px; may be outside `[0, trackLength]`). */
  let lastTrackPx = 0;
  /** Track paging: direction fixed at press — classic scrollbars never reverse mid-hold. */
  let pageDirection: -1 | 1 = 1;
  /** Thumb drag: the engaged track end (0 = pointer inside the track) + hold bookkeeping. */
  let edge: -1 | 0 | 1 = 0;
  let edgeEngagedAt = 0;
  let edgeCount = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stopTimer = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const toTrackPx = (e: React.PointerEvent): number => {
    const rect = getTrackRect();
    if (!rect) return 0;
    return vertical ? e.clientY - rect.top : e.clientX - rect.left;
  };

  const trackLength = (): number => {
    const rect = getTrackRect();
    return rect ? (vertical ? rect.height : rect.width) : 0;
  };

  /* ---- thumb: parked-past-the-end hold ---- */

  const edgeTick = (): void => {
    timer = null;
    if (!session?.edgeHold || !edge) return;
    edgeCount++;
    const overshootPx = edge < 0
      ? Math.max(0, -lastTrackPx)
      : Math.max(0, lastTrackPx - trackLength());
    const engaged = session.edgeHold(edge, {
      count: edgeCount,
      heldMs: Date.now() - edgeEngagedAt,
      overshootPx
    });
    // Not engaged (clamped at the real end) — stop ticking; a pointer move re-arms via updateEdge.
    if (engaged) timer = setTimeout(edgeTick, edgeHoldIntervalMs);
  };

  const updateEdge = (): void => {
    if (!session?.edgeHold) return;
    const next: -1 | 0 | 1 = lastTrackPx < 0 ? -1 : lastTrackPx > trackLength() ? 1 : 0;
    if (next === edge) return;
    edge = next;
    stopTimer();
    if (edge) {
      edgeEngagedAt = Date.now();
      edgeCount = 0;
      timer = setTimeout(edgeTick, edgeHoldIntervalMs);
    }
  };

  /* ---- track: page-toward-the-pointer hold ---- */

  const pageTick = (): void => {
    timer = null;
    if (!session?.page) return;
    const thumb = getThumb();
    if (thumb) {
      // Page only while the pointer is still beyond the thumb in the press direction. Reaching the
      // pointer PAUSES (the timer keeps running) — moving the pointer further away resumes.
      const beyond = pageDirection < 0
        ? lastTrackPx < thumb.offset
        : lastTrackPx > thumb.offset + thumb.length;
      if (beyond) session.page(pageDirection);
    }
    timer = setTimeout(pageTick, pageRepeatDelayMs);
  };

  /* ---- pointer surface ---- */

  const onPointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return; // primary button / touch only
    const thumb = getThumb();
    if (!thumb) return; // no thumb (disabled) — nothing to gesture
    lastTrackPx = toTrackPx(e);
    const nextZone: TrackDragZone =
      lastTrackPx < thumb.offset ? 'track-before'
      : lastTrackPx > thumb.offset + thumb.length ? 'track-after'
      : 'thumb';
    const started = onStart(nextZone, e);
    if (!started) return;
    session = started;
    zone = nextZone;
    edge = 0;
    // Capture so move / up keep firing when the drag leaves the track (for the edge hold).
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    e.stopPropagation();
    if (nextZone === 'thumb') {
      grabOffset = lastTrackPx - thumb.offset;
    } else {
      pageDirection = nextZone === 'track-before' ? -1 : 1;
      session.page?.(pageDirection); // page once on press...
      stopTimer();
      timer = setTimeout(pageTick, pageInitialDelayMs); // ...then repeat after the initial delay
    }
    onDragModeChange?.(started.dragMode ?? null);
  };

  const onPointerMove = (e: React.PointerEvent): void => {
    if (!session) return;
    e.stopPropagation(); // our gesture is in flight — own the move
    lastTrackPx = toTrackPx(e);
    if (zone === 'thumb') {
      session.apply?.(lastTrackPx - grabOffset);
      updateEdge();
    }
    // page zone: lastTrackPx feeds the next tick's beyond-test (pause / resume happens there)
  };

  const onPointerUp = (e: React.PointerEvent): void => {
    const ended = session;
    session = null;
    zone = null;
    edge = 0;
    stopTimer();
    if (!ended) return;
    e.stopPropagation();
    const el = e.currentTarget as Element;
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    onDragModeChange?.(null);
    ended.end?.(e);
  };

  const dispose = (): void => stopTimer();
  return { onPointerDown, onPointerMove, onPointerUp, dispose };
};

/**
 * The React hook over {@link createTrackDrag}: owns the `dragMode` state and stops the hold timer on
 * unmount. The getters and `onStart` are read live through a ref, so consumers' closures over changing
 * values (thumb state, offsets) need no handler rebuild.
 */
export const useTrackDrag = (options: TrackDragOptions): TrackDragResult => {
  const [dragMode, setDragMode] = useState<string | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const controller = useMemo(() => createTrackDrag({
    vertical: optionsRef.current.vertical,
    getTrackRect: () => optionsRef.current.getTrackRect(),
    getThumb: () => optionsRef.current.getThumb(),
    onStart: (zone, e) => optionsRef.current.onStart(zone, e),
    onDragModeChange: setDragMode,
    edgeHoldIntervalMs: optionsRef.current.edgeHoldIntervalMs,
    pageInitialDelayMs: optionsRef.current.pageInitialDelayMs,
    pageRepeatDelayMs: optionsRef.current.pageRepeatDelayMs
  }), [options.vertical]); // recreate only on axis change; everything else reads live via optionsRef
  useEffect(() => () => controller.dispose(), [controller]);

  return {
    onPointerDown: controller.onPointerDown,
    onPointerMove: controller.onPointerMove,
    onPointerUp: controller.onPointerUp,
    dragMode
  };
};
