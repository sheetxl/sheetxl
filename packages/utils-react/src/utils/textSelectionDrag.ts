import { useEffect, useMemo, useRef } from 'react';

import styles from './textSelectionDrag.module.css';

type TextControl = HTMLInputElement | HTMLTextAreaElement;

/**
 * The `<input>` types whose selection API is usable. The others — `number`, `email`, `date` and
 * friends — THROW on `setSelectionRange`, so they can only ever take the native path.
 */
const SELECTABLE_INPUT_TYPES = new Set(['text', 'search', 'url', 'tel', 'password', '']);

/** Most a drag past the edge scrolls the field per tick (px), and how often that tick comes (ms). */
const EDGE_SCROLL_MAX = 24;
const EDGE_SCROLL_INTERVAL = 50;

const asTextControl = (target: EventTarget | null | undefined): TextControl | null => {
  if (target instanceof HTMLTextAreaElement) return target.disabled ? null : target;
  if (target instanceof HTMLInputElement) {
    return (!target.disabled && SELECTABLE_INPUT_TYPES.has(target.type)) ? target : null;
  }
  return null;
};

/**
 * The character offset in `el`'s value under a viewport point — the browser's own text hit-test, the
 * one that places the caret on a click, so wrapping and bidi are its problem rather than ours.
 *
 * The point is CLAMPED into the field's box before asking, which is what makes a drag outside the
 * field work: the answer is always an offset in THIS field's text no matter what the pointer is over,
 * and dragging past an edge reads as the first or last character instead of as nothing.
 */
const offsetAtPoint = (el: TextControl, clientX: number, clientY: number): number | null => {
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = Math.min(Math.max(clientX, rect.left + 1), rect.right - 1);
  const y = Math.min(Math.max(clientY, rect.top + 1), rect.bottom - 1);
  const doc = el.ownerDocument as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const position = doc.caretPositionFromPoint?.(x, y);
  if (position) return position.offset;
  const range = doc.caretRangeFromPoint?.(x, y); // WebKit's older spelling of the same call
  return range ? range.startOffset : null;
};

/** The press {@link TextSelectionDrag.onPointerDown} reads — a React pointer event satisfies it. */
export interface TextSelectionPress {
  button?: number;
  shiftKey?: boolean;
  clientX?: number;
  clientY?: number;
  target?: EventTarget | null;
}

/** {@link useTextSelectionDrag}'s handle — spread onto the field, or wire each handler by name. */
export interface TextSelectionDrag {
  /** Call from the field's `pointerdown` — non-primary buttons are ignored. */
  onPointerDown: (e?: TextSelectionPress) => void;
  /**
   * Refuses the browser's text DRAG-AND-DROP, so a press on the field always means "select".
   *
   * Once a field holds a selection, pressing ON that selection starts a drag of the text instead of a
   * new one — which in app chrome has nowhere to land, so it reads as the no-drop cursor and eats the
   * gesture. It costs most where a click selects the whole value (the font size and name boxes): the
   * next drag, the one meant to pick out part of it, is the one that can't happen.
   */
  onDragStart: (e: { preventDefault: () => void }) => void;
}

/**
 * Keeps a text-selection drag alive once the pointer leaves the field, by two mechanisms.
 *
 * **Driving the selection.** From the press, each move re-reads the character under the pointer
 * (clamped into the field) and sets the selection itself. This is what makes the gesture behave the
 * same wherever the field is: the browser's own drag-extension resolves against the pointer's raw
 * position, which comes out wrong for a field inside a transformed ancestor — the in-grid cell editor
 * is placed by a `transform: translate(…)`, and its selection tracked an x offset by that translate.
 * Asking for the offset explicitly goes through the same hit-test a click does, which is correct there.
 *
 * **Suspending the chrome's veto,** for the presses the first mechanism does not take: a `number` input
 * (the selection API throws on one), a double/triple press (word and line granularity are the browser's),
 * or a shift-press (it extends an existing selection from its own far end). App chrome is
 * `user-select: none` — legitimately, since a drag over a toolbar
 * or the grid means something other than selecting their text — and a browser abandons a drag-selection
 * the moment the node under the pointer can't start one. That `none` states an intent that only holds
 * BETWEEN gestures, and CSS has no way to say "except while a drag is in flight", so the class says it
 * for exactly one. Nothing else becomes selectable in practice: a text control confines its own
 * selection, so the selection cannot leave the field.
 *
 * Wire it to any field whose text is worth dragging across:
 * ```tsx
 * const textDrag = useTextSelectionDrag();
 * <input onPointerDown={textDrag.onPointerDown} onDragStart={textDrag.onDragStart} />
 * ```
 */
export const useTextSelectionDrag = (): TextSelectionDrag => {
  // The in-flight gesture's teardown, held so it can run WITHOUT its own release: a field unmounted
  // mid-drag (a dialog closed from under the pointer) would otherwise strand the class on `<html>` and
  // leave the whole app selectable for the rest of the session. Doubles as the "already armed" flag.
  const endRef = useRef<(() => void) | null>(null);
  useEffect(() => () => { endRef.current?.(); }, []);

  return useMemo(() => ({
    onPointerDown: (e?: TextSelectionPress): void => {
      if (e?.button !== undefined && e.button !== 0) return; // a non-primary press starts no selection
      if (endRef.current) return;

      // A shift-press extends an existing selection from its own far end — the browser's rule, and it
      // keeps the native path (and the class alone) rather than having that rule restated here.
      const field = e?.shiftKey ? null : asTextControl(e?.target);
      const anchor = (field && e?.clientX !== undefined && e?.clientY !== undefined)
        ? offsetAtPoint(field, e.clientX, e.clientY)
        : null;
      // Whether this press is ours to drive. A double/triple press hands it back — see `onNativeDown`.
      let driving = field !== null && anchor !== null;
      let lastX = e?.clientX ?? 0;
      let lastY = e?.clientY ?? 0;

      const extendTo = (x: number, y: number): void => {
        if (!driving || !field || anchor === null) return;
        const offset = offsetAtPoint(field, x, y);
        if (offset === null) return;
        field.setSelectionRange(
          Math.min(anchor, offset), Math.max(anchor, offset),
          offset < anchor ? 'backward' : 'forward'
        );
      };

      const onMove = (ev: PointerEvent): void => {
        lastX = ev.clientX;
        lastY = ev.clientY;
        extendTo(lastX, lastY);
      };

      /**
       * Takes the gesture off the browser. Its own drag-extension does not yield to ours — it re-wrote
       * the selection immediately after every one of our writes, from the same anchor to whatever its
       * (transform-blind) reading of the pointer said, so the two simply alternated. Cancelling the
       * mousedown's default stops that drag before it starts; the focus and initial caret it would have
       * placed become ours.
       *
       * It has to be the MOUSE event, twice over: preventing `pointerdown` does not cancel the
       * compatibility mousedown, and the click count — which is how a double/triple press is
       * identified — is only ever on the mouse event (a pointer event's `detail` is always 0).
       */
      const onNativeDown = (me: MouseEvent): void => {
        if (!field || anchor === null) return;
        if (me.detail > 1) { driving = false; return; } // word / line granularity is the browser's
        me.preventDefault();
        const hadFocus = field.ownerDocument.activeElement === field;
        field.focus({ preventScroll: true });
        // A field that selects itself on focus (the name box) has just done so, and collapsing to the
        // press would undo it — so the caret is only placed when the press landed in a field that was
        // ALREADY focused, or when arriving left nothing selected. A drag from here still wins: it
        // extends from this press's anchor, replacing whatever focus selected.
        if (hadFocus || field.selectionStart === field.selectionEnd) {
          field.setSelectionRange(anchor, anchor);
        }
      };

      /**
       * The autoscroll that suppressing the native drag took away: a field whose text runs past its box
       * scrolls while the drag sits beyond an edge. On a TICK rather than only on movement, because the
       * gesture this serves is holding the pointer still out there and waiting.
       */
      const onTick = (): void => {
        if (!driving || !field) return;
        const rect = field.getBoundingClientRect();
        const dx = lastX < rect.left ? lastX - rect.left : (lastX > rect.right ? lastX - rect.right : 0);
        const dy = lastY < rect.top ? lastY - rect.top : (lastY > rect.bottom ? lastY - rect.bottom : 0);
        if (!dx && !dy) return;
        const clamp = (d: number): number => Math.max(-EDGE_SCROLL_MAX, Math.min(EDGE_SCROLL_MAX, d));
        field.scrollLeft += clamp(dx);
        field.scrollTop += clamp(dy);
        extendTo(lastX, lastY);
      };

      // `<html>`, because the rule reaches the pointer's node by descending from wherever the class
      // lands — and the grid, the toolbar and a portaled dialog share no closer ancestor.
      const root = document.documentElement;
      const tick = driving ? window.setInterval(onTick, EDGE_SCROLL_INTERVAL) : 0;
      const end = (): void => {
        endRef.current = null;
        root.classList.remove(styles['dragging']);
        if (tick) window.clearInterval(tick);
        // Normally already spent (`once`), but a press that never produces a mousedown would strand it.
        window.removeEventListener('mousedown', onNativeDown, true);
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', end, true);
        window.removeEventListener('pointercancel', end, true);
      };
      endRef.current = end;
      root.classList.add(styles['dragging']);
      if (driving) window.addEventListener('mousedown', onNativeDown, { capture: true, once: true });
      // The moves and the release routinely land OUTSIDE the field — the whole point — so both are
      // watched at the window.
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', end, true);
      window.addEventListener('pointercancel', end, true);
    },
    onDragStart: (e: { preventDefault: () => void }): void => { e.preventDefault(); }
  }), []);
};
