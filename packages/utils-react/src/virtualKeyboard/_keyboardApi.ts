/**
 * The browser's VirtualKeyboard API (`navigator.virtualKeyboard`): Chromium only, and only in a secure
 * context (HTTPS, or localhost). With `overlaysContent` on, the keyboard covers the page instead of
 * shrinking the visual viewport, and the browser reports its rectangle (and the CSS
 * `env(keyboard-inset-*)` values) itself.
 */
export interface VirtualKeyboardApi extends EventTarget {
  overlaysContent: boolean;
  readonly boundingRect: DOMRectReadOnly;
}

/** The browser's VirtualKeyboard API, or `null` where it is unavailable. */
export const getVirtualKeyboardApi = (): VirtualKeyboardApi | null => {
  if (typeof navigator === 'undefined') return null;
  return ((navigator as unknown as { virtualKeyboard?: VirtualKeyboardApi }).virtualKeyboard) ?? null;
};
