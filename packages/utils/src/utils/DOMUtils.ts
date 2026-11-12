/**
 * Check if we can use DOM apis.
 */
export const canUseDOM = !!(
  typeof window !== "undefined" &&
  window.document &&
  window.document.createElement
);

/**
 * Opens a file dialog and returns the selected file.
 * @param accepts The file types to accept.
 * @returns A promise that resolves with the selected file, or `null` if the dialog is canceled.
 */
export const openFileDialog = (accepts: string = '*.*'): Promise<File | null> => {
  return new Promise<File | null>((resolve, reject) => {
    if (!canUseDOM) {
      reject('Unable to open dialog with no dom.');
      return;
    }
    const input:HTMLInputElement = document.createElement('input');
    input.type = 'file';
    input.accept = accepts;

    let file:File | null = null;
    let canceled:boolean = false;
    // HACK ALERT -
    // since there is no cancel event for dialogs we use the focus event.
    // We also give it a delay to ensure we get this event after the onchange. Generally on cancel is used for cleanup
    // so a longer time delay should be ok and reduces the risk if fires a false cancel.
    const startCancelTimer = () => {
      setTimeout(() => {
        if (file || canceled)
          return;
        canceled = true;
        resolve(null);
      }, 1000);
    }

    globalThis.addEventListener?.("focus", () => {
      startCancelTimer();
    }, { once: true, passive: true });

    input.onchange = () => {
      file = input.files?.[0] ?? null;
      if (file) {
        if (canceled) {
          console.warn(`File open detected after faux cancel.`, file);
          return;
        }
        resolve(file);
      }
    }
    input.autofocus = true;
    input.click(); // initiate
  });
}

/**
 * Gets the device pixel ratio (DPI) of the current device.
 * @returns The device pixel ratio.
 */
export const getDPI = (): number => {
  let devicePixelRatio = 1;
  if (typeof window === "object") {
    // TODO - add a listener for deviceScale change in ui
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
    // const updatePixelRatio = () => {
    //   console.log('updatePixelRation');
    // }
    // const mqString = `(resolution: ${window.devicePixelRatio}dpx)`;
    // const media = matchMedia(mqString);
    // media.addEventListener("change", updatePixelRatio);
    // removeMedia = () => {
    //   media.removeEventListener("change", updatePixelRatio);
    // };

    devicePixelRatio = window.devicePixelRatio || 1;
  }
  return devicePixelRatio;
}


/**
 * Checks if the given element or any of its children has focus.
 *
 * @param elementSource The element to check for focus.
 * @param ignoreDoc Whether to ignore the document's focus state.
 * @returns True if the element or its children have focus, false otherwise.
 */
export const hasFocus = (
  elementSource: HTMLElement | SVGElement,
  ignoreDoc: boolean=false
): boolean => {
  return (document.hasFocus() || ignoreDoc) && (elementSource === document.activeElement || elementSource?.contains(document.activeElement));
}

let _supportsScrollContainer: boolean | undefined;
/**
 * Whether `scrollIntoView` honors `container`. Browsers that don't know it ignore it (and scroll the page),
 * so probe on a detached element: the options are read before the scroll, which has nothing to move.
 */
const supportsScrollContainer = (): boolean => {
  if (_supportsScrollContainer === undefined) {
    let read = false;
    try {
      document.createElement('div').scrollIntoView({ get container() { read = true; return 'nearest'; } } as ScrollIntoViewOptions);
    } catch { /* ignore */ }
    _supportsScrollContainer = read;
  }
  return _supportsScrollContainer;
}

/**
 * Scrolls `container` just enough to reveal `child` — `scrollIntoView({ block: 'nearest' })`, confined
 * to one scroller.
 *
 * Use this, not `scrollIntoView`, to keep a list's selected row visible. `scrollIntoView` also scrolls
 * every scrollable ancestor, including the page, so a list inside a popup can drag the whole document to
 * wherever the popup happens to be.
 *
 * Where the browser supports `scrollIntoView({ container: 'nearest' })` that is used directly; `container`
 * must then be `child`'s nearest scrollable ancestor.
 *
 * @param container The scrolling element.
 * @param child The element to reveal.
 * @param behavior Instant or smooth scrolling. Defaults to the container's `scroll-behavior`.
 */
export const scrollIntoContainer = (
  container: HTMLElement,
  child: HTMLElement,
  behavior: ScrollBehavior='auto'
): void => {
  if (supportsScrollContainer()) {
    child.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior, container: 'nearest' } as ScrollIntoViewOptions);
    return;
  }
  const outer = container.getBoundingClientRect();
  const inner = child.getBoundingClientRect();
  const top = outer.top + container.clientTop;
  const bottom = top + container.clientHeight;
  let delta = 0;
  if (inner.top < top) {
    delta = inner.top - top;
  } else if (inner.bottom > bottom) {
    delta = Math.min(inner.bottom - bottom, inner.top - top);
  }
  if (delta !== 0) container.scrollBy({ top: delta, behavior });
}

/**
 * Returns a promise that resolves when the specified element gains focus.
 *
 * @param elementSource The element to check for focus.
 * @param ignoreDoc Whether to ignore the document's focus state.
 * @returns A promise that resolves to true if the element gains focus, false otherwise.
 */
// TODO - this can hang so we should add an optional timeout.
export const whenFocus = async (
  elementSource: HTMLElement | SVGElement,
  ignoreDoc: boolean=false
): Promise<boolean> => {
  return new Promise<boolean>((resolve: (input: boolean) => void) => {
    if (hasFocus(elementSource, ignoreDoc)) {
      resolve(true);
    } else {
      elementSource.addEventListener('focusin', () => {
        resolve(true);
      }, { once: true});
    }
    elementSource.focus();
  });
}
