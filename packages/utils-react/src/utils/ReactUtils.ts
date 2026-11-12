import { CommonUtils } from '@sheetxl/utils';

import * as detectItImport from 'detect-it';

/* Focusable node names */
export const focusableNodeNames = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export const EmptyCssProperties:React.CSSProperties = {};

/** The `<input>` types that hold editable text (everything but the button / picker kinds). */
const NON_TEXT_INPUT_TYPES = new Set([
  'button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'range', 'color', 'image', 'hidden'
]);

/**
 * Whether `el` is a DOM text-editable — a text `<input>`, a `<textarea>`, or a `contenteditable`. That
 * is: "does the browser's native caret/clipboard apply here", which is the question both the
 * **input-clipboard injector** (whose commands act on this element) and keystroke diagnostics ask. One
 * definition, low in the stack, so the two can't drift.
 */
export function isEditable(el: Element | null | undefined): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') return !NON_TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
  return (el as HTMLElement).isContentEditable === true;
}

/**
 * Replace `[start, end)` of a text field with `text` **as a user edit** — the browser records it on the
 * element's own undo stack, and a native `input` event fires so a controlled React input picks it up.
 *
 * Any programmatic edit that goes around this (assigning `.value`, or pushing new text through React's
 * controlled `value`) is invisible to the browser's undo history — and worse, assigning `.value`
 * *clears* it. So a feature that rewrites the field's text on the user's behalf (paste-insert, the
 * formula editor's F9) has to go through here, or the very next `ctrl+Z` does nothing (or something
 * older and more surprising). This is the same undo stack the input-clipboard injector's `undo`/`redo`
 * drive, which is what makes them one coherent history rather than two.
 *
 * `execCommand` is deprecated but is still the only API that writes to that history; `setRangeText` is
 * the fallback for anywhere it isn't honored (it edits correctly, it just isn't undoable).
 *
 * @returns `false` if the element could not be edited at all.
 */
export function replaceRangeText(
  el: HTMLInputElement | HTMLTextAreaElement,
  start: number,
  end: number,
  text: string
): boolean {
  el.setSelectionRange(start, end);
  // Requires `el` to be the focused element — `execCommand` acts on the document's ACTIVE editable, so
  // without this check an unfocused caller would silently edit whatever else had focus. Guarded for
  // absence (jsdom) and for throwing implementations; either way the fallback below still edits.
  try {
    if (typeof document !== 'undefined' && document.activeElement === el
        && typeof document.execCommand === 'function'
        && document.execCommand('insertText', false, text)) {
      return true;
    }
  } catch { /* fall through to the non-undoable path */ }
  el.setRangeText(text, start, end, 'end');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}


/**
 * Re-export detectIt.
 *
 * @returns The `detect-it` library.
 */
export function detectIt(): {
  supportsPassiveEvents: boolean
  supportsPointerEvents: boolean;
  supportsTouchEvents: boolean;
  deviceType: 'mouseOnly' | 'touchOnly' | 'hybrid';
  primaryInput: 'mouse' | 'touch'
} {
  return detectItImport;
}

/**
 * The current device pixel ratio (always `>= 1`). Safe to call outside the DOM.
 */
export function getDevicePixelRatio(): number {
  return (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
}

/**
 * Round a CSS stroke width to a whole number of device pixels (minimum 1 device
 * pixel), returned in CSS pixels.
 *
 * A fractional device-pixel width (e.g. a 1px CSS stroke at a 1.5 dpr) cannot
 * render crisply - the browser anti-aliases it, and the result drifts as the dpr
 * changes. Rounding to whole device pixels keeps the stroke crisp at any dpr.
 */
export function snapDeviceWidth(cssWidth: number, dpr: number = getDevicePixelRatio()): number {
  return Math.max(1, Math.round(cssWidth * dpr)) / dpr;
}

/**
 * Snap a CSS coordinate to a whole device-pixel boundary.
 *
 * Use for line endpoints and the edges of filled rectangles, so two shapes that
 * share an edge resolve to the same device pixel (no seam, no overlap).
 */
export function snapDeviceEdge(cssPoint: number, dpr: number = getDevicePixelRatio()): number {
  return Math.round(cssPoint * dpr) / dpr;
}

/**
 * Snap the CENTER of a stroke so it renders crisply for the given width.
 *
 * A stroke is crisp when both of its edges land on device-pixel boundaries. That
 * requires an odd device-pixel width to be centered on a half device pixel, and
 * an even width on a whole device pixel. Two layers that snap the same boundary
 * coordinate with the same width resolve to the same device pixels, so they line
 * up with each other (and stay aligned and crisp across device pixel ratios).
 *
 * This is the device-aware replacement for the former (no-op) `boundPixel`.
 *
 * @param cssCenter The desired stroke center, in CSS pixels.
 * @param cssWidth  The stroke width, in CSS pixels (used only for odd/even parity).
 */
export function snapLineCenter(cssCenter: number, cssWidth: number = 1, dpr: number = getDevicePixelRatio()): number {
  const deviceWidth = Math.max(1, Math.round(cssWidth * dpr));
  const halfBias = (deviceWidth % 2) * 0.5; // 0.5 for odd device widths, 0 for even
  return (Math.round(cssCenter * dpr - halfBias) + halfBias) / dpr;
}

/**
 * Which side of a divider an edge belongs to. `leading` = left/top, `trailing` =
 * right/bottom. Determines outward growth for even-width strokes (see {@link edgeCenter}).
 */
export type EdgeKind = 'leading' | 'trailing';

/**
 * The CSS-pixel shift a stroke takes so it grows OUTWARD from its cell.
 *
 * Odd device widths are already centered (one device px each side of the divider) and
 * never shift. Even device widths snap to a whole device pixel, where the centered
 * result lands the extra pixel *before* the divider; a `trailing` edge then shifts +1
 * device px so it sits *after* it (leading stays before). This is the only case that
 * needs a tie-break.
 */
export function edgeTrailingShift(edge: EdgeKind, deviceWidth: number, dpr: number = getDevicePixelRatio()): number {
  return (Math.round(deviceWidth) % 2 === 0 && edge === 'trailing') ? 1 / dpr : 0;
}

/**
 * The snapped CSS center a stroke of `deviceWidth` device px sits at for a boundary at
 * `boundaryCss`, accounting for crisp parity ({@link snapLineCenter}) and edge-aware
 * outward growth ({@link edgeTrailingShift}).
 *
 * This is the single placement rule shared by gridlines, cell borders, and range
 * overlays - anything that calls it lands on the same device pixels and lines up.
 */
export function edgeCenter(boundaryCss: number, edge: EdgeKind, deviceWidth: number, dpr: number = getDevicePixelRatio()): number {
  return snapLineCenter(boundaryCss + edgeTrailingShift(edge, deviceWidth, dpr), deviceWidth / dpr, dpr);
}

export const toPrettyKeyCode = (key: string) => {
  if (key === 'BracketLeft') return '[';
  if (key === 'BracketRight') return ']';
  return CommonUtils.camelToPrettyCase(key);
}

/**
 * Creates a React synthetic event from a native DOM event.
 *
 * @remarks
 * This helper creates a synthetic event wrapper that mimics React's SyntheticEvent behavior,
 * including proper type inference for specific event types (PointerEvent, MouseEvent, etc.).
 *
 * @template T - The element type (extends Element)
 * @template E - The native event type (extends Event)
 *
 * @param event - The native DOM event to wrap
 * @param currentTarget - Optional override for currentTarget (useful for portals/delegated events)
 *
 * @returns A React synthetic event with all standard properties and methods
 *
 * @example
 * ```typescript
 * // Basic usage
 * const syntheticEvent = createSyntheticEvent<HTMLDivElement, PointerEvent>(nativePointerEvent);
 *
 * // With custom currentTarget (for portals)
 * const syntheticEvent = createSyntheticEvent<HTMLDivElement, PointerEvent>(
 *   nativePointerEvent,
 *   portalElement
 * );
 * ```
 */
export const createSyntheticEvent = <T extends Element, E extends Event, R extends React.SyntheticEvent<T, E>>(
  event: E,
  currentTarget?: EventTarget & T
): R => {
  let isDefaultPrevented = false;
  let isPropagationStopped = false;

  const preventDefault = () => {
    isDefaultPrevented = true;
    event.preventDefault();
  };

  const stopPropagation = () => {
    isPropagationStopped = true;
    event.stopPropagation();
  };

  // Create base synthetic event
  const syntheticEvent: React.SyntheticEvent<T, E> = {
    nativeEvent: event,
    currentTarget: (currentTarget || event.currentTarget) as EventTarget & T,
    target: event.target as EventTarget & T,
    bubbles: event.bubbles,
    cancelable: event.cancelable,
    defaultPrevented: event.defaultPrevented,
    eventPhase: event.eventPhase,
    isTrusted: event.isTrusted,
    preventDefault,
    isDefaultPrevented: () => isDefaultPrevented,
    stopPropagation,
    isPropagationStopped: () => isPropagationStopped,
    persist: () => {},
    timeStamp: event.timeStamp,
    type: event.type,
  };

  // Copy all enumerable properties from the native event to support specific event types
  // This automatically includes MouseEvent, PointerEvent, KeyboardEvent properties, etc.
  for (const key in event) {
    if (!(key in syntheticEvent) && typeof event[key] !== 'function') {
      (syntheticEvent as any)[key] = event[key];
    }
  }

  return syntheticEvent as R;
};

/**
 * Finds the React 18/19 root element by walking up the DOM tree.
 * React 18+ attaches event listeners to the root element passed to createRoot().
 *
 * @param element - Any element within the React tree
 * @returns The React root element, or document.body as fallback
 */
// TODO - remove? no longer in use
// export function findReactRootElement(element: HTMLElement | null): HTMLElement {
//   if (!element) return document.body;

//   let current: HTMLElement | null = element;
//   let lastReactRoot: HTMLElement | null = null;

//   // Walk up to find the highest element with React root marker
//   while (current) {
//     const keys = Object.keys(current);
//     // React 18/19 attaches __reactContainer$[randomKey] to the root element
//     const hasReactContainer = keys.some(key => key.startsWith('__reactContainer'));

//     if (hasReactContainer) {
//       lastReactRoot = current;
//     }

//     // Move to parent
//     current = current.parentElement;
//   }

//   // Return the last (highest) React root found, or fallback to document.body
//   return lastReactRoot || element.ownerDocument?.body || document.body;
// }