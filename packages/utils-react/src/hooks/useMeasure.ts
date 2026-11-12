import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * `useLayoutEffect` in the browser, `useEffect` where there is no DOM (so server rendering doesn't warn).
 */
export const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * The content box of a measured element, in CSS px. Same fields as a ResizeObserver `contentRect`:
 * `x`/`y` (and `left`/`top`) are the padding offsets, not a page position.
 */
export type MeasureRect = Pick<DOMRectReadOnly, 'x' | 'y' | 'top' | 'left' | 'right' | 'bottom' | 'height' | 'width'>;

/**
 * A callback ref; attach it to the element to measure.
 */
export type MeasureRef<E extends Element> = (element: E | null) => void;

const EMPTY_RECT: MeasureRect = Object.freeze({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 });

const sameRect = (a: MeasureRect, b: MeasureRect): boolean =>
  a.width === b.width && a.height === b.height && a.x === b.x && a.y === b.y;

const toRect = (r: MeasureRect): MeasureRect =>
  ({ x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, left: r.left, bottom: r.bottom, right: r.right });

/**
 * The content box as a ResizeObserver would report it, read synchronously. `null` when the element has
 * no layout box (not an `HTMLElement`, `display: none`, inline).
 */
const readContentRect = (element: Element): MeasureRect | null => {
  if (!(element instanceof HTMLElement)) return null;
  const style = getComputedStyle(element);
  let width = parseFloat(style.width);
  let height = parseFloat(style.height);
  if (isNaN(width) || isNaN(height)) return null;
  const padLeft = parseFloat(style.paddingLeft) || 0;
  const padTop = parseFloat(style.paddingTop) || 0;
  if (style.boxSizing === 'border-box') {
    width -= padLeft + (parseFloat(style.paddingRight) || 0)
      + (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0);
    height -= padTop + (parseFloat(style.paddingBottom) || 0)
      + (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
  }
  width = Math.max(0, width);
  height = Math.max(0, height);
  return { x: padLeft, y: padTop, width, height, top: padTop, left: padLeft, bottom: padTop + height, right: padLeft + width };
};

/**
 * Tracks the content-box size of an element.
 *
 * @remarks
 * Returns all zeros until the ref is attached; the element is measured as soon as it is attached
 * (before paint) and again whenever a ResizeObserver reports a change. The returned rect keeps its
 * identity while the size is unchanged. Where `ResizeObserver` is unavailable the rect stays zero.
 *
 * Changes from CSS transforms are not observed; see `useAnimatedMeasure`.
 *
 * @example
 * ```tsx
 * const [refMeasure, { width }] = useMeasure<HTMLDivElement>();
 * return <div ref={refMeasure}>{width}px wide</div>;
 * ```
 */
export function useMeasure<E extends Element = Element>(): [MeasureRef<E>, MeasureRect] {
  const [element, setElement] = useState<E | null>(null);
  const [rect, setRect] = useState<MeasureRect>(EMPTY_RECT);
  const refRect = useRef<MeasureRect>(rect);

  const ref = useCallback<MeasureRef<E>>((next: E | null) => setElement(next), []);

  useIsomorphicLayoutEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return;
    const update = (next: MeasureRect) => {
      if (sameRect(refRect.current, next)) return;
      refRect.current = next;
      setRect(next);
    };
    const initial = readContentRect(element);
    if (initial) update(initial);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) update(toRect(entry.contentRect));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [ref, rect];
}
