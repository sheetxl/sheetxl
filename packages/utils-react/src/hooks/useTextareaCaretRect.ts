import { useCallback, useEffect, useRef } from 'react';

/**
 * A minimal, `DOMRect`-shaped result (all eight box fields + `toJSON`). We build our own instead of
 * `new DOMRect(...)` so the pure {@link composeCaretRect} math stays usable in a non-DOM (node) test
 * env, and so the result can be handed directly to a float **virtual anchor**
 * (`{ getBoundingClientRect(): DOMRect }`) — a plain rect satisfies that contract at runtime.
 */
export interface CaretRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  toJSON(): unknown;
}

/** Build a full {@link CaretRect} (a zero-width caret has `width === 0`) from an origin + size. */
const rectOf = (x: number, y: number, width: number, height: number): CaretRect => ({
  x, y, width, height,
  top: y, left: x, right: x + width, bottom: y + height,
  toJSON() { return { x, y, width, height, top: y, left: x, right: x + width, bottom: y + height }; }
});

/**
 * Compose the viewport-space caret rect from the three measured boxes — the **pure** core of the caret
 * geometry, split out so it can be unit-tested without a layout engine (jsdom does no layout).
 *
 * The caret's offset *within the content* is `marker.left/top − mirror.left/top`: because the mirror
 * copies the textarea's border + padding, that delta measured from the mirror's **border-box** corner
 * equals the same offset from the textarea's border-box corner. Add the textarea's viewport position and
 * subtract its scroll to land on the on-screen caret.
 */
export const composeCaretRect = (p: {
  /** The textarea's border-box origin, viewport space (`textarea.getBoundingClientRect()`). */
  textareaRect: { left: number; top: number };
  /** The mirror's border-box origin, viewport space. */
  mirrorRect: { left: number; top: number };
  /** The caret marker span's box: origin (viewport space) + its line-box height (the caret height). */
  markerRect: { left: number; top: number; height: number };
  /** `textarea.scrollLeft` — the caret shifts left as the field scrolls right. */
  scrollLeft: number;
  /** `textarea.scrollTop`. */
  scrollTop: number;
}): CaretRect => {
  const left = p.textareaRect.left + (p.markerRect.left - p.mirrorRect.left) - p.scrollLeft;
  const top = p.textareaRect.top + (p.markerRect.top - p.mirrorRect.top) - p.scrollTop;
  return rectOf(left, top, 0, p.markerRect.height);
};

/**
 * Computed-style properties the mirror copies from the textarea so its text lays out (and, when the
 * field wraps, breaks) identically. Width + box model come from `offsetWidth` (below), not from here.
 */
const MIRRORED_STYLE_PROPS = [
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontStretch',
  'lineHeight', 'letterSpacing', 'wordSpacing', 'textAlign', 'textIndent', 'textTransform',
  'textRendering', 'whiteSpace', 'wordBreak', 'overflowWrap', 'tabSize'
] as const;

/**
 * Position a hidden mirror `<div>` over `textarea`'s geometry so a marker span can report the caret box.
 * The mirror is forced to `border-box` and sized by `offsetWidth` (which already includes the field's
 * border + padding), so its content column matches the textarea exactly and wrapping agrees.
 */
const syncMirror = (mirror: HTMLElement, textarea: HTMLTextAreaElement): void => {
  const cs = getComputedStyle(textarea);
  const style = mirror.style as unknown as Record<string, string>;
  for (const prop of MIRRORED_STYLE_PROPS) style[prop] = cs[prop as keyof CSSStyleDeclaration] as string;
  style.position = 'absolute';
  style.top = '0';
  style.left = '0';
  style.visibility = 'hidden';
  style.pointerEvents = 'none';
  style.overflow = 'hidden';
  style.boxSizing = 'border-box';
  style.height = 'auto';
  style.width = `${textarea.offsetWidth}px`;
};

/**
 * Measure the on-screen caret rect for `textarea` at `index` (default: the current `selectionStart`).
 * Uses a hidden mirror div — pass a persistent one (the hook does) to avoid per-call DOM churn; omit it
 * and a transient mirror is created + removed. Returns a zero-size rect at the origin when there is no
 * DOM / element (SSR-safe).
 */
export const getTextareaCaretRect = (
  textarea: HTMLTextAreaElement | null | undefined,
  index?: number,
  mirror?: HTMLElement,
  padding: number = 0
): CaretRect => {
  if (!textarea || typeof document === 'undefined') return rectOf(0, 0, 0, 0);

  const value = textarea.value;
  const caret = Math.max(0, Math.min(index ?? textarea.selectionStart ?? value.length, value.length));

  const owned = !mirror;
  const el = mirror ?? document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  syncMirror(el, textarea);

  // Text up to the caret, then a marker span holding the remainder. The remainder (not just a bare
  // marker) makes the boundary wrap exactly as the textarea will; a trailing caret needs a non-empty
  // marker to acquire a line box, so fall back to a zero-width space.
  el.textContent = value.slice(0, caret);
  const marker = document.createElement('span');
  marker.textContent = value.slice(caret) || '​';
  el.appendChild(marker);

  if (owned) document.body.appendChild(el);
  try {
    const cs = getComputedStyle(textarea);
    const markerBox = marker.getBoundingClientRect();
    const mirrorBox = el.getBoundingClientRect();
    const lineHeight = markerBox.height || parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2 || 0;
    const rect = composeCaretRect({
      textareaRect: textarea.getBoundingClientRect(),
      mirrorRect: mirrorBox,
      markerRect: { left: markerBox.left, top: markerBox.top, height: lineHeight },
      scrollLeft: textarea.scrollLeft,
      scrollTop: textarea.scrollTop
    });
    // `padding` pulls the anchor LEFT so a popup with its own left inset lines its content up with the
    // offset (e.g. a panel padded 10px anchored at a token start reads flush under the token). No-op at 0.
    return padding ? rectOf(rect.left - padding, rect.top, 0, rect.height) : rect;
  } finally {
    if (owned) el.remove();
    else el.textContent = ''; // release the marker; keep the persistent mirror around
  }
};

/** What {@link useTextareaCaretRect} returns. */
export interface TextareaCaretRectHandle {
  /** Measure the caret rect now, at `index` (default: live `selectionStart`); `padding` pulls it left. */
  getCaretRect(index?: number, padding?: number): CaretRect;
  /**
   * A stable **virtual element** (`{ getBoundingClientRect }`) that re-measures on every read — pass it
   * straight to a float `anchor` so the popup tracks the position as it moves. `index` may be a fixed
   * number, a live getter (e.g. a token-start offset, so the popup anchors to the token rather than the
   * caret), or omitted (follows `selectionStart`). `padding` (fixed or live) pulls the anchor left so a
   * popup with its own left inset lines up flush under the offset.
   */
  caretAnchor(
    index?: number | (() => number),
    padding?: number | (() => number)
  ): { getBoundingClientRect(): CaretRect };
}

/**
 * Caret geometry for a `<textarea>`: turn a caret offset into a viewport rect you can anchor a float
 * (dropdown / function tip / range hint) to. The workhorse behind the formula editor's popups; also the
 * measurement seam the token-highlight overlay reuses. DOM-only (no SDK), so it lives here alongside the
 * other generic hooks and is shared by both the inline cell editor and the formula bar.
 *
 * @param ref A ref to the textarea to measure.
 *
 * @remarks
 * Backed by one persistent hidden mirror div (created on mount, removed on unmount) that copies the
 * textarea's font / padding / border / wrap so measurement matches what the user sees — including zoom,
 * since the grid applies zoom via font-size (not a transform), which the computed style already carries.
 */
export const useTextareaCaretRect = (
  ref: React.RefObject<HTMLTextAreaElement | null>
): TextareaCaretRectHandle => {
  const mirrorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const mirror = document.createElement('div');
    mirrorRef.current = mirror;
    document.body.appendChild(mirror);
    return () => { mirror.remove(); mirrorRef.current = null; };
  }, []);

  const getCaretRect = useCallback(
    (index?: number, padding?: number): CaretRect =>
      getTextareaCaretRect(ref.current, index, mirrorRef.current ?? undefined, padding),
    [ref]
  );

  const caretAnchor = useCallback(
    (index?: number | (() => number), padding?: number | (() => number)) => ({
      getBoundingClientRect: (): CaretRect =>
        getCaretRect(
          typeof index === 'function' ? index() : index,
          typeof padding === 'function' ? padding() : padding
        )
    }),
    [getCaretRect]
  );

  return { getCaretRect, caretAnchor };
};
