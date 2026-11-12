/**
 * Whether a touch that landed on `target` belongs to the content rather than to the pane's own
 * touch scroller: the same rule the browser's native pan follows for `touch-action`.
 *
 * @remarks
 * The browser pans only when every element from the touch target up to the scrolling element allows
 * it. A `touch-action` that permits no panning on any of them (`none`, or `pinch-zoom` alone) means
 * the element handles the touch itself. The pane's JavaScript scroller is a stand-in for that native
 * pan, so it honors the same declaration: a resize handle, a drag grip, or a selected drawing says
 * `touch-action: none` once, for the browser and for the scroller alike.
 *
 * Only the chain strictly below `root` is read; `root` is the scroller's own element.
 *
 * @param target The element the touch started on.
 * @param root The scrolling element; the walk stops before it.
 * @param touchActionOf Reads an element's computed `touch-action`. Defaults to the DOM's.
 */
export const isTouchOwned = (
  target: EventTarget | null,
  root: Element | null,
  touchActionOf: (element: Element) => string = computedTouchAction
): boolean => {
  let element: Element | null = target instanceof Element ? target : null;
  while (element && element !== root) {
    if (!allowsPan(touchActionOf(element))) return true;
    element = element.parentElement;
  }
  return false;
};

const computedTouchAction = (element: Element): string => {
  const view = element.ownerDocument?.defaultView;
  return view ? view.getComputedStyle(element).touchAction : '';
};

/** `auto`, `manipulation`, and any `pan-*` keyword permit a pan; `none` and a lone `pinch-zoom` do not. */
const allowsPan = (touchAction: string): boolean => {
  const value = touchAction.trim();
  if (value === '' || value === 'auto' || value === 'manipulation') return true;
  return value.split(/\s+/).some((token) => token.startsWith('pan-'));
};
