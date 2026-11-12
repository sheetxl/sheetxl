import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { isVirtualKeyboardUp } from '@sheetxl/utils-react';

import { asStory } from '../../components';

/**
 * PROTOTYPE (throwaway): the formula bar as a keyboard accessory. The studio keeps a read-only
 * display bar in place; editing happens in an editor bar portaled to `document.body` and placed on
 * the top of the keyboard. The studio never resizes and nothing scrolls the page on purpose.
 *
 * Plain DOM, no real studio: what it tests is the browsers.
 * 1. Jitter: does the bar hold still on the keyboard while the page scrolls or zooms? Compare the
 *    placements: script from the visual viewport (events or every frame) vs the Chrome VirtualKeyboard
 *    API (`overlaysContent` + `env(keyboard-inset-height)`, placed by the browser, no script), and
 *    locking the page's scroll while editing.
 * 2. Pan: does the browser pan or scroll the page when the hidden field is focused? Try each "park".
 * 3. Zoom: pinch with the keyboard up, with and without scale compensation.
 *
 * Open it top-level on the phone (not in the Storybook UI, whose iframe hides the keyboard):
 * `http://<host>:6006/iframe.html?id=studio-keyboard-accessory-prototype--keyboard-accessory&viewMode=story`
 * The panel at the top right holds the settings (tap its first line) and a log.
 */

type ParkAt = 'visibleTop' | 'displayBar' | 'visibleBottom';
type Placement = 'pageAbsolute' | 'visualViewportBottom' | 'visualViewport' | 'visualViewportEveryFrame' | 'keyboardApi' | 'resizesContent';

interface Settings {
  fullPage: boolean;
  placement: Placement;
  lockScroll: boolean;
  parkAt: ParkAt;
  preventScroll: boolean;
  scaleCompensate: boolean;
  hideWhileZoomed: boolean;
  ownLayer: boolean;
  fadeIn: boolean;
  crossFade: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  fullPage: false,
  placement: 'pageAbsolute',
  lockScroll: false,
  parkAt: 'visibleTop',
  preventScroll: true,
  scaleCompensate: true,
  hideWhileZoomed: false,
  ownLayer: false,
  fadeIn: true,
  crossFade: true
};

/** How long the viewport must be still before the bar fades back in. */
const SETTLE_MS = 150;
const FADE_MS = 150;
/** The least height the keyboard takes, as `isVirtualKeyboardUp` reads it. */
const KEYBOARD_MIN = 150;

interface VirtualKeyboardApi extends EventTarget {
  overlaysContent: boolean;
  boundingRect: DOMRect;
}
const keyboardApi = (): VirtualKeyboardApi | null =>
  (typeof navigator !== 'undefined' ? (navigator as any).virtualKeyboard ?? null : null);

// ---------------------------------------------------------------------------------------------
// Logging: a module store, independent of React state, newest first.

const logStart = performance.now();
const logLines: string[] = [`ready (keyboard API ${keyboardApi() ? 'available' : 'unavailable'})`];
const logListeners = new Set<() => void>();
const log = (text: string): void => {
  logLines.unshift(`${((performance.now() - logStart) / 1000).toFixed(1)}s ${text}`);
  if (logLines.length > 40) logLines.length = 40;
  logListeners.forEach(listener => listener());
};

/** Touch state, so a scroll the finger drives (or its momentum) is not logged as a jump. */
const touch = { active: false, endedAt: 0 };
const touchDriven = (): boolean => touch.active || performance.now() - touch.endedAt < 1500;

/** Where the editor bar was last placed, read by the panel (not React state: no re-render per frame). */
const placed: { top: number | null } = { top: null };

const describeFocus = (): string => {
  const active = document.activeElement as HTMLElement | null;
  if (!active || active === document.body) return 'body';
  return `${active.tagName.toLowerCase()}${active.dataset.proto ? `[${active.dataset.proto}]` : ''}`;
};

// ---------------------------------------------------------------------------------------------
// Page host: a normal scrolling page, or a full-page app that does not scroll.

const usePageHost = (fullPage: boolean): void => {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('storybook-root');
    const saved = {
      html: html.getAttribute('style'),
      body: body.getAttribute('style'),
      root: root?.getAttribute('style') ?? null
    };
    if (fullPage) {
      html.style.cssText = 'height: 100%; overflow: hidden;';
      body.style.cssText = 'position: static; height: 100%; margin: 0; overflow: hidden;';
      if (root) root.style.cssText = 'position: static; height: 100%; padding: 0;';
    } else {
      html.style.cssText = 'height: auto;';
      body.style.cssText = 'position: static; height: auto; margin: 0;';
      if (root) root.style.cssText = 'position: static; height: auto; padding: 0;';
    }
    window.scrollTo(0, 0);
    const restore = (el: HTMLElement | null, value: string | null): void => {
      if (!el) return;
      if (value === null) el.removeAttribute('style'); else el.setAttribute('style', value);
    };
    return () => {
      restore(html, saved.html);
      restore(body, saved.body);
      restore(root, saved.root);
    };
  }, [fullPage]);
};

/**
 * Adds `interactive-widget=resizes-content` to the viewport meta, so Chrome shrinks the layout for the
 * keyboard and a `bottom: 0` fixed element sits on it; returns the undo.
 */
const resizeContentForKeyboard = (): (() => void) => {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const created = !meta;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1';
    document.head.appendChild(meta);
  }
  const saved = meta.content;
  const parts = saved.split(',').map(part => part.trim()).filter(part => part && !part.startsWith('interactive-widget'));
  meta.content = [...parts, 'interactive-widget=resizes-content'].join(', ');
  log(`viewport meta: ${meta.content}`);
  const target = meta;
  return () => {
    if (created) target.remove(); else target.content = saved;
  };
};

/** Stops the page scrolling while the editor has focus; returns the undo. */
const lockPageScroll = (): (() => void) => {
  const html = document.documentElement;
  const body = document.body;
  const saved = { html: html.style.overflow, body: body.style.overflow, touch: html.style.touchAction };
  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  html.style.touchAction = 'none';
  return () => {
    html.style.overflow = saved.html;
    body.style.overflow = saved.body;
    html.style.touchAction = saved.touch;
  };
};

// ---------------------------------------------------------------------------------------------
// The editor bar: portaled, placed on the keyboard.

interface EditorBarHandle {
  /** Focus the field, from inside the user's tap. */
  open(text: string): void;
}

interface EditorBarProps {
  settings: Settings;
  refDisplayBar: React.RefObject<HTMLDivElement | null>;
  refHandle: React.RefObject<EditorBarHandle | null>;
  onCommit: (text: string) => void;
  /**
   * `true` the first time the bar shows in an edit, `false` when the edit ends: the display bar fades
   * the other way, so the bar looks to have moved.
   */
  onFloatChange: (floating: boolean) => void;
}

const EditorBar: React.FC<EditorBarProps> = ({ settings, refDisplayBar, refHandle, onCommit, onFloatChange }) => {
  const refBar = useRef<HTMLDivElement>(null);
  const refField = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(false);
  // Written by the focus handlers themselves, so a placement in the same frame sees it.
  const refEditing = useRef(false);
  const refSettings = useRef(settings);
  refSettings.current = settings;
  const refUnlock = useRef<(() => void) | null>(null);
  const refUnresize = useRef<(() => void) | null>(null);
  // Hidden while the viewport moves; faded back in once it has been still for SETTLE_MS.
  const refMoving = useRef(false);
  const refSettle = useRef(0);
  // The layout height before the keyboard (resizes-content shrinks innerHeight, so it is kept).
  const refBaseline = useRef(0);
  const refSeenKeyboard = useRef(false);
  const refModeSwitchAt = useRef(0);
  const refFloating = useRef(false);
  const refOnFloatChange = useRef(onFloatChange);
  refOnFloatChange.current = onFloatChange;

  /** Places the bar: on the keyboard while editing, else at the park spot (hidden). */
  const place = useCallback((): void => {
    const bar = refBar.current;
    const vv = window.visualViewport;
    if (!bar || !vv) return;
    const s = refSettings.current;
    const isEditing = refEditing.current;
    const zoomed = vv.scale > 1.01;
    const shown = isEditing && !refMoving.current && !(s.hideWhileZoomed && zoomed);
    bar.style.willChange = s.ownLayer ? 'transform' : '';
    bar.style.opacity = shown ? '1' : '0';
    bar.style.pointerEvents = shown ? 'auto' : 'none';
    if (shown && !refFloating.current) {
      refFloating.current = true;
      refOnFloatChange.current(true);
    }

    if (isEditing && !refMoving.current && s.placement === 'resizesContent') {
      // The layout shrinks for the keyboard: the browser keeps the bar on it.
      bar.style.position = 'fixed';
      bar.style.transformOrigin = 'top left';
      bar.style.top = 'auto';
      bar.style.bottom = '0px';
      bar.style.left = '0px';
      bar.style.width = '100%';
      bar.style.transform = '';
      placed.top = bar.getBoundingClientRect().top;
      return;
    }
    if (isEditing && !refMoving.current && s.placement === 'keyboardApi' && keyboardApi()) {
      bar.style.position = 'fixed';
      bar.style.transformOrigin = 'top left';
      if (vv.scale > 1.01) {
        // Pinch-zoomed: on the visible area, the zoom undone; the keyboard height is the browser's.
        const keyboard = keyboardApi()!.boundingRect.height;
        bar.style.bottom = 'auto';
        bar.style.top = `${vv.offsetTop + vv.height - (keyboard + bar.offsetHeight) / vv.scale}px`;
        bar.style.left = `${vv.offsetLeft}px`;
        bar.style.width = `${vv.width * vv.scale}px`;
        bar.style.transform = `scale(${1 / vv.scale})`;
      } else {
        // The browser places it: no script per frame.
        bar.style.top = 'auto';
        bar.style.bottom = 'env(keyboard-inset-height, 0px)';
        bar.style.left = '0px';
        bar.style.width = '100%';
        bar.style.transform = '';
      }
      placed.top = bar.getBoundingClientRect().top;
      return;
    }

    const scale = s.scaleCompensate ? vv.scale : 1;
    if (s.placement === 'pageAbsolute') {
      // Not fixed at all: absolute in page coordinates (`pageTop` is the visible area's top in the
      // page). Drawn where the layout says, with none of Chrome's address-bar adjustment of fixed
      // elements; it scrolls with the page, but the bar is hidden while anything moves anyway.
      const parent = (bar.offsetParent ?? document.body) as HTMLElement;
      const parentRect = parent.getBoundingClientRect();
      const parentTop = parentRect.top + window.scrollY;
      const parentLeft = parentRect.left + window.scrollX;
      const barHeight = bar.offsetHeight / scale;
      const pageTop = isEditing && !refMoving.current
        ? vv.pageTop + vv.height - barHeight
        : vv.pageTop;
      bar.style.position = 'absolute';
      bar.style.bottom = 'auto';
      bar.style.top = `${pageTop - parentTop}px`;
      bar.style.left = `${vv.pageLeft - parentLeft}px`;
      bar.style.width = `${vv.width * scale}px`;
      bar.style.transformOrigin = 'top left';
      bar.style.transform = scale !== 1 ? `scale(${1 / scale})` : '';
      placed.top = isEditing ? bar.getBoundingClientRect().top : null;
      return;
    }
    bar.style.position = 'fixed';
    if (isEditing && !refMoving.current && s.placement === 'visualViewportBottom') {
      // Anchored by its bottom: while the address bar animates, Chrome keeps bottom-anchored fixed
      // elements on the bottom of the screen but pushes top-anchored ones down with the page.
      bar.style.top = 'auto';
      bar.style.bottom = `${window.innerHeight - (vv.offsetTop + vv.height)}px`;
      bar.style.left = `${vv.offsetLeft}px`;
      bar.style.width = `${vv.width * scale}px`;
      bar.style.transformOrigin = 'bottom left';
      bar.style.transform = scale !== 1 ? `scale(${1 / scale})` : '';
      placed.top = bar.getBoundingClientRect().top;
      return;
    }
    bar.style.transformOrigin = 'top left';
    const barHeight = bar.offsetHeight / scale;
    let top: number;
    let left = vv.offsetLeft;
    let width = vv.width * scale;
    if (isEditing && refMoving.current) {
      // Hidden while the viewport moves: kept where the browser can see it, so it does not pan the
      // page to reveal a focused field the keyboard is covering.
      top = vv.offsetTop;
    } else if (isEditing || s.parkAt === 'visibleBottom') {
      top = vv.offsetTop + vv.height - barHeight;
    } else if (s.parkAt === 'displayBar' && refDisplayBar.current) {
      const rect = refDisplayBar.current.getBoundingClientRect();
      top = rect.top;
      left = rect.left;
      width = rect.width * scale;
    } else {
      top = vv.offsetTop;
    }
    bar.style.bottom = 'auto';
    bar.style.top = `${top}px`;
    bar.style.left = `${left}px`;
    bar.style.width = `${width}px`;
    bar.style.transform = scale !== 1 ? `scale(${1 / scale})` : '';
    placed.top = isEditing ? top : null;
  }, [refDisplayBar]);

  /** Hides the bar at once, and fades it back in when the viewport has been still for a moment. */
  const hideUntilStill = useCallback((): void => {
    const bar = refBar.current;
    if (!bar || !refSettings.current.fadeIn || !refEditing.current) return;
    if (!refMoving.current) {
      refMoving.current = true;
      bar.style.transition = 'none';
      bar.style.opacity = '0';
      bar.style.pointerEvents = 'none';
    }
    clearTimeout(refSettle.current);
    refSettle.current = window.setTimeout(() => {
      refMoving.current = false;
      const b = refBar.current;
      if (b) b.style.transition = `opacity ${FADE_MS}ms ease-out`;
      place();
    }, SETTLE_MS);
  }, [place]);

  /** The keyboard going away ends the edit, and focus goes back to the display bar. */
  const onKeyboardChange = useCallback((): void => {
    const vv = window.visualViewport;
    const field = refField.current;
    if (!vv || !field || !refEditing.current) return;
    const up = refBaseline.current - vv.height * vv.scale > KEYBOARD_MIN;
    if (up) {
      refSeenKeyboard.current = true;
      return;
    }
    // The 123 / abc buttons blur and refocus to swap keyboards; that is not the user closing it.
    if (!refSeenKeyboard.current || performance.now() - refModeSwitchAt.current < 800) return;
    log('keyboard closed: edit ends');
    field.blur();
    refDisplayBar.current?.focus({ preventScroll: true });
  }, [refDisplayBar]);

  // Follow the visual viewport: on its events, or every frame while editing.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let frame = 0;
    const schedule = (): void => {
      if (settings.placement !== 'visualViewportEveryFrame') hideUntilStill();
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; place(); });
    };
    let loop = 0;
    const tick = (): void => {
      place();
      loop = requestAnimationFrame(tick);
    };
    if (settings.placement === 'visualViewportEveryFrame' && editing) loop = requestAnimationFrame(tick);
    const api = keyboardApi();
    const onGeometry = (): void => {
      const r = api!.boundingRect;
      log(`keyboard API geometry: y ${Math.round(r.y)} h ${Math.round(r.height)}`);
      schedule();
    };
    api?.addEventListener('geometrychange', onGeometry);
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    vv.addEventListener('resize', onKeyboardChange);
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; place(); });
    return () => {
      vv.removeEventListener('resize', onKeyboardChange);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(loop);
      api?.removeEventListener('geometrychange', onGeometry);
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [place, hideUntilStill, onKeyboardChange, settings, editing]);

  refHandle.current = {
    open: (text: string): void => {
      const field = refField.current;
      if (!field) return;
      const s = refSettings.current;
      field.value = text;
      const api = keyboardApi();
      if (s.placement === 'keyboardApi' && api) api.overlaysContent = true;
      refBaseline.current = window.innerHeight;
      refSeenKeyboard.current = false;
      if (s.placement === 'resizesContent' && !refUnresize.current) refUnresize.current = resizeContentForKeyboard();
      // Placed at the park spot before the focus, so the browser sees it where it was parked.
      place();
      field.focus({ preventScroll: s.preventScroll });
      log(document.activeElement === field
        ? `focus taken (park ${s.parkAt}, preventScroll ${s.preventScroll})`
        : `FOCUS REFUSED (focus ${describeFocus()})`);
      // Where the bar is vs where it should be, and whether it is what the screen shows there.
      for (const delay of [400, 1200]) {
        setTimeout(() => {
          const bar = refBar.current;
          const vv = window.visualViewport;
          if (!bar || !vv) return;
          const rect = bar.getBoundingClientRect();
          const expected = vv.offsetTop + vv.height - rect.height;
          const hit = document.elementFromPoint(rect.left + 4, rect.top + rect.height / 2);
          const onTop = !!hit && bar.contains(hit);
          log(`check ${delay}ms: bar top ${Math.round(rect.top)} expected ${Math.round(expected)} (style top ${bar.style.top} bottom ${bar.style.bottom}), opacity ${bar.style.opacity}, ${onTop ? 'bar on top' : `covered by ${hit?.tagName.toLowerCase() ?? 'nothing'}`}`);
        }, delay);
      }
    }
  };

  const onFocus = (): void => {
    refEditing.current = true;
    setEditing(true);
    if (refSettings.current.lockScroll) refUnlock.current = lockPageScroll();
    // Hidden until the keyboard has finished rising, rather than shown where it is about to cover.
    hideUntilStill();
    place();
    log('editor focused');
  };
  const onBlur = (): void => {
    refEditing.current = false;
    setEditing(false);
    refUnlock.current?.();
    refUnlock.current = null;
    refUnresize.current?.();
    refUnresize.current = null;
    clearTimeout(refSettle.current);
    refMoving.current = false;
    if (refBar.current) refBar.current.style.transition = 'none';
    if (refFloating.current) {
      refFloating.current = false;
      refOnFloatChange.current(false);
    }
    const api = keyboardApi();
    if (api) api.overlaysContent = false;
    place();
    log(`editor blurred (focus now ${describeFocus()})`);
  };

  const keepFocus = (e: React.SyntheticEvent): void => { e.preventDefault(); };

  const switchMode = (mode: 'text' | 'decimal'): void => {
    const field = refField.current;
    if (!field) return;
    field.inputMode = mode;
    refModeSwitchAt.current = performance.now();
    // The platform re-reads the mode on focus.
    field.blur();
    field.focus({ preventScroll: refSettings.current.preventScroll });
  };

  return createPortal(
    <div
      ref={refBar}
      style={{
        position: 'fixed', top: 0, left: 0, zIndex: 1500, boxSizing: 'border-box',
        transformOrigin: 'top left', opacity: 0, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
        background: '#f3f5f8', borderTop: '1px solid #b8c2cc', boxShadow: '0 -2px 6px rgba(0,0,0,0.12)',
        font: '16px sans-serif'
      }}
    >
      <button type="button" onMouseDown={keepFocus} onPointerDown={keepFocus} onClick={() => switchMode('text')}>abc</button>
      <button type="button" onMouseDown={keepFocus} onPointerDown={keepFocus} onClick={() => switchMode('decimal')}>123</button>
      <textarea
        ref={refField}
        data-proto="editor"
        rows={1}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onCommit(e.currentTarget.value);
            e.currentTarget.blur();
          }
        }}
        style={{
          flex: 1, minWidth: 0, resize: 'none', height: 34, boxSizing: 'border-box',
          // Under 16px, iOS zooms the page to a focused field.
          fontSize: 16, padding: '6px 8px', border: '1px solid #8a96a3', borderRadius: 4
        }}
      />
      <button
        type="button"
        onMouseDown={keepFocus}
        onPointerDown={keepFocus}
        onClick={() => {
          const field = refField.current;
          if (!field) return;
          onCommit(field.value);
          field.blur();
        }}
      >
        ✓
      </button>
    </div>,
    document.body
  );
};

// ---------------------------------------------------------------------------------------------
// The stand-in studio: toolbar, grid, display bar, tabs. It never changes size.

const FakeStudio: React.FC<{
  value: string;
  refDisplayBar: React.RefObject<HTMLDivElement | null>;
  onOpen: () => void;
  /** The editor bar is floating: the display bar keeps its space, its content faded out. */
  floating: boolean;
}> = ({ value, refDisplayBar, onOpen, floating }) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid #8a96a3', background: '#fff', font: '14px sans-serif' }}>
    <div style={{ height: 40, flex: 'none', display: 'flex', alignItems: 'center', padding: '0 10px', background: '#e8ecf1', borderBottom: '1px solid #b8c2cc' }}>
      Toolbar
    </div>
    <div
      style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        backgroundImage: 'linear-gradient(#dde3ea 1px, transparent 1px), linear-gradient(90deg, #dde3ea 1px, transparent 1px)',
        backgroundSize: '64px 24px'
      }}
    />
    <div
      ref={refDisplayBar}
      tabIndex={-1}
      onPointerDown={() => log('display bar pressed')}
      onClick={onOpen}
      style={{
        height: 46, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px',
        background: '#f3f5f8', borderTop: '1px solid #b8c2cc', cursor: 'text'
      }}
    >
      <span style={{ color: '#667', opacity: floating ? 0 : 1, transition: `opacity ${FADE_MS}ms ease-out` }}>A1</span>
      <span style={{ opacity: floating ? 0 : 1, transition: `opacity ${FADE_MS}ms ease-out`, flex: 1, padding: '6px 8px', border: '1px solid #c8d0d8', borderRadius: 4, background: '#fff', minHeight: 20 }}>
        {value || <span style={{ color: '#99a' }}>Tap to edit</span>}
      </span>
    </div>
    <div style={{ height: 32, flex: 'none', display: 'flex', alignItems: 'center', gap: 16, padding: '0 10px', background: '#e8ecf1', borderTop: '1px solid #b8c2cc' }}>
      <b>Sheet1</b><span>Sheet2</span><span>Sheet3</span>
    </div>
  </div>
);

// ---------------------------------------------------------------------------------------------
// Panel: settings, live readings and the log.

/** Everything worth pasting: device, settings, the readings now, and the whole log (oldest first). */
const report = (settings: Settings): string => {
  const vv = window.visualViewport;
  return [
    `ua: ${navigator.userAgent}`,
    `settings: ${JSON.stringify(settings)}`,
    `now: scrollY ${Math.round(window.scrollY)} | vv top ${vv?.offsetTop} h ${vv?.height} zoom ${vv?.scale} | inner ${window.innerWidth}x${window.innerHeight} | kb ${isVirtualKeyboardUp() ? 'up' : 'down'} | bar ${placed.top} | focus ${describeFocus()}`,
    ...logLines.slice().reverse()
  ].join('\n');
};

/**
 * Copies `text`. Over plain http on a LAN address `navigator.clipboard` is missing, so this falls back
 * to `execCommand('copy')` on a read-only field (read-only: no keyboard).
 */
const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.style.cssText = 'position: fixed; top: 0; left: 0; width: 1px; height: 1px; opacity: 0;';
  document.body.appendChild(field);
  field.select();
  field.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  field.remove();
  return ok;
};

const Panel: React.FC<{
  settings: Settings;
  onChange: (next: Settings) => void;
}> = ({ settings, onChange }) => {
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    const bump = (): void => setTick(t => t + 1);
    logListeners.add(bump);
    vv?.addEventListener('resize', bump);
    vv?.addEventListener('scroll', bump);
    window.addEventListener('scroll', bump, { passive: true });
    return () => {
      logListeners.delete(bump);
      vv?.removeEventListener('resize', bump);
      vv?.removeEventListener('scroll', bump);
      window.removeEventListener('scroll', bump);
    };
  }, []);
  const vv = window.visualViewport;
  const r = (n: number | undefined): string => (n === undefined ? '-' : String(Math.round(n * 10) / 10));
  const set = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    log(`setting ${key} = ${String(value)}`);
    onChange({ ...settings, [key]: value });
  };
  return (
    <div
      style={{
        position: 'fixed', top: 4 + (vv?.offsetTop ?? 0), right: 4, left: 4, zIndex: 2000, boxSizing: 'border-box',
        padding: '6px 8px', borderRadius: 6, font: '11px monospace', background: 'rgba(0,0,0,0.78)', color: '#fff'
      }}
    >
      <button
        type="button"
        onClick={async () => {
          const ok = await copyText(report(settings));
          log(ok ? 'copied the log' : 'COPY FAILED');
        }}
        style={{ float: 'right', marginLeft: 6, font: '12px sans-serif', padding: '4px 10px' }}
      >
        copy
      </button>
      <div onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }}>
        {open ? '▾' : '▸'} y {r(window.scrollY)} | vv top {r(vv?.offsetTop)} h {r(vv?.height)} zoom {r(vv?.scale)} | inner {window.innerHeight} | kb {isVirtualKeyboardUp() ? 'up' : 'down'} | bar {placed.top === null ? '-' : r(placed.top)}
      </div>
      {logLines.slice(0, open ? 14 : 3).map((line, i) => <div key={i} style={{ color: i === 0 ? '#ffd27a' : '#ddd' }}>{line}</div>)}
      {open ? (
        <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
          <label><input type="checkbox" checked={settings.fullPage} onChange={e => set('fullPage', e.target.checked)} /> full page (no page scroll)</label>
          <label>placement <select value={settings.placement} onChange={e => set('placement', e.target.value as Placement)}>
            <option value="pageAbsolute">script, absolute in the page (not fixed)</option>
            <option value="visualViewportBottom">script, anchored by bottom</option>
            <option value="visualViewport">script, anchored by top</option>
            <option value="visualViewportEveryFrame">script, every frame</option>
            <option value="keyboardApi">keyboard API (Chrome)</option>
            <option value="resizesContent">resizes-content (bottom: 0)</option>
          </select></label>
          <label><input type="checkbox" checked={settings.lockScroll} onChange={e => set('lockScroll', e.target.checked)} /> lock page scroll while editing</label>
          <label>park <select value={settings.parkAt} onChange={e => set('parkAt', e.target.value as ParkAt)}>
            <option value="visibleTop">visible top</option>
            <option value="displayBar">display bar</option>
            <option value="visibleBottom">visible bottom</option>
          </select></label>
          <label><input type="checkbox" checked={settings.preventScroll} onChange={e => set('preventScroll', e.target.checked)} /> focus preventScroll</label>
          <label><input type="checkbox" checked={settings.scaleCompensate} onChange={e => set('scaleCompensate', e.target.checked)} /> undo pinch zoom</label>
          <label><input type="checkbox" checked={settings.hideWhileZoomed} onChange={e => set('hideWhileZoomed', e.target.checked)} /> hide while zoomed</label>
          <label><input type="checkbox" checked={settings.crossFade} onChange={e => set('crossFade', e.target.checked)} /> display bar fades as the bar floats</label>
          <label><input type="checkbox" checked={settings.fadeIn} onChange={e => set('fadeIn', e.target.checked)} /> hide while moving, fade in when still</label>
          <label><input type="checkbox" checked={settings.ownLayer} onChange={e => set('ownLayer', e.target.checked)} /> own layer (will-change)</label>
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------

const Filler: React.FC<{ label: string; height: number }> = ({ label, height }) => (
  <section
    style={{
      height, padding: 24, boxSizing: 'border-box',
      background: 'repeating-linear-gradient(0deg, #f4f6f8, #f4f6f8 40px, #e9edf1 40px, #e9edf1 80px)',
      font: '14px sans-serif', color: '#445'
    }}
  >
    {label}
  </section>
);

const Template: React.FC = () => {
  // As the real KeyboardAccessory does: the browser places the bar where it offers the keyboard API,
  // script placement from the visual viewport elsewhere.
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    placement: keyboardApi() ? 'keyboardApi' : 'visualViewport'
  }));
  const [value, setValue] = useState('');
  const [floating, setFloating] = useState(false);
  const refDisplayBar = useRef<HTMLDivElement>(null);
  const refEditor = useRef<EditorBarHandle>(null);
  usePageHost(settings.fullPage);

  // Jumps and pans no touch caused, and the keyboard coming and going.
  useEffect(() => {
    const vv = window.visualViewport;
    let lastY = window.scrollY;
    let lastTop = vv?.offsetTop ?? 0;
    let lastUp = isVirtualKeyboardUp();
    const onTouchStart = (): void => { touch.active = true; };
    const onTouchEnd = (): void => { touch.active = false; touch.endedAt = performance.now(); };
    const onScroll = (): void => {
      const y = window.scrollY;
      if (Math.abs(y - lastY) > 20 && !touchDriven()) log(`PAGE JUMP ${Math.round(lastY)} → ${Math.round(y)} (focus ${describeFocus()})`);
      lastY = y;
    };
    let lastSize = '';
    const onViewport = (): void => {
      if (!vv) return;
      const size = `h ${Math.round(vv.height)} top ${Math.round(vv.offsetTop)} inner ${window.innerHeight}`;
      if (size !== lastSize) {
        log(`viewport ${size}`);
        lastSize = size;
      }
      const up = isVirtualKeyboardUp();
      if (up !== lastUp) {
        log(`keyboard ${up ? 'up' : 'down'} (inner ${window.innerHeight}, vv h ${Math.round(vv.height)}, focus ${describeFocus()})`);
        lastUp = up;
      }
      if (Math.abs(vv.offsetTop - lastTop) > 20 && !touchDriven()) {
        log(`VIEWPORT PAN ${Math.round(lastTop)} → ${Math.round(vv.offsetTop)} (focus ${describeFocus()})`);
      }
      lastTop = vv.offsetTop;
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onViewport);
    vv?.addEventListener('resize', onViewport);
    vv?.addEventListener('scroll', onViewport);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onViewport);
      vv?.removeEventListener('resize', onViewport);
      vv?.removeEventListener('scroll', onViewport);
    };
  }, []);

  const studio = (
    <FakeStudio
      value={value}
      refDisplayBar={refDisplayBar}
      onOpen={() => refEditor.current?.open(value)}
      floating={floating && settings.crossFade}
    />
  );

  return (
    <>
      <Panel settings={settings} onChange={setSettings} />
      {settings.fullPage ? (
        <div style={{ height: '100%' }}>{studio}</div>
      ) : (
        <div>
          <Filler label="Page content above the studio. Scroll down." height={900} />
          <div style={{ height: 500, margin: '0 12px' }}>{studio}</div>
          <Filler label="Page content below the studio." height={900} />
        </div>
      )}
      <EditorBar
        settings={settings}
        refDisplayBar={refDisplayBar}
        refHandle={refEditor}
        onCommit={(text) => { setValue(text); log(`commit "${text}"`); }}
        onFloatChange={setFloating}
      />
    </>
  );
};

export const KeyboardAccessory = asStory(Template);
KeyboardAccessory.storyName = 'Keyboard Accessory';

const Story = {
  title: 'Studio/Keyboard Accessory (prototype)',
  component: KeyboardAccessory,
};
export default Story;
