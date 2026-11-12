/**
 * Marks an element inside a scroll pane that scrolls on the pane's behalf (its own native scrollbar),
 * so a wheel over it scrolls the pane rather than being left to the element.
 */
export const PANE_SCROLLER_ATTRIBUTE = 'data-sxl-pane-scroller';

const SCROLLS = new Set(['auto', 'scroll', 'overlay']);
const CONTAINS = new Set(['contain', 'none']);

/**
 * Who a wheel belongs to when it lands inside `root`: a scrolling element between the target and
 * `root` takes it, as the browser would give it to that element. The wheel scrolls across when
 * Shift is held or its horizontal delta is the larger.
 *
 * @returns
 * - `'native'`: an element can still scroll that way; the browser scrolls it.
 * - `'contained'`: an element scrolls on that axis and is at its end, but its `overscroll-behavior`
 *   is `contain` or `none`, so the wheel stops there and scrolls nothing.
 * - `null`: nothing inside takes it; `root` scrolls.
 */
export const getWheelOwner = (event: globalThis.WheelEvent, root: HTMLElement): 'native' | 'contained' | null => {
  const { deltaX, deltaY, shiftKey } = event;
  const horizontal = shiftKey || Math.abs(deltaX) > Math.abs(deltaY);
  const delta = shiftKey ? deltaY : (horizontal ? deltaX : deltaY);
  if (delta === 0) return null;
  let el = event.target instanceof Element ? event.target : null;
  while (el && el !== root) {
    if (el.hasAttribute(PANE_SCROLLER_ATTRIBUTE)) return null;
    const size = horizontal ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
    if (size > 0) {
      const style = getComputedStyle(el);
      if (SCROLLS.has(horizontal ? style.overflowX : style.overflowY)) {
        const position = horizontal ? el.scrollLeft : el.scrollTop;
        if (delta < 0 ? position > 0 : position < size - 1) return 'native';
        if (CONTAINS.has(horizontal ? style.overscrollBehaviorX : style.overscrollBehaviorY)) return 'contained';
      }
    }
    el = el.parentElement;
  }
  return null;
};
