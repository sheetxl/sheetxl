import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import {
  KeyboardAccessory, getKeyboardAccessoryTop, isVirtualKeyboardUp, type KeyboardAccessoryProps
} from '../virtualKeyboard';

/** A visual viewport the test moves: the part of the page the keyboard leaves visible. */
interface FakeViewport extends EventTarget {
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
  scale: number;
}

/**
 * The accessory rides the keyboard: hidden while the visual viewport moves, parked at the top of the
 * visible area while hidden, placed on the keyboard and shown once the viewport has been still, and
 * the keyboard going away is reported.
 */
describe('KeyboardAccessory', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let vv: FakeViewport;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    vv = Object.assign(new EventTarget(), {
      width: window.innerWidth, height: window.innerHeight, offsetTop: 0, offsetLeft: 0, scale: 1
    });
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  });

  afterEach(async () => {
    await act(async () => { root?.unmount(); });
    container?.remove();
    root = null;
    container = null;
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
    vi.useRealTimers();
  });

  const render = async (props: Partial<KeyboardAccessoryProps>): Promise<void> => {
    container ??= document.body.appendChild(document.createElement('div'));
    root ??= createRoot(container);
    await act(async () => {
      root!.render(createElement(KeyboardAccessory, { floating: false, ...props },
        createElement('div', { style: { height: '40px' } }, 'bar')));
    });
  };
  const accessory = (): HTMLElement => document.querySelector('.sxl-keyboard-accessory') as HTMLElement;
  /** Lets the frames and the settle timer run. */
  const settle = async (): Promise<void> => {
    await act(async () => { vi.advanceTimersByTime(400); });
  };
  /** The keyboard rising: the visible area loses `height` px at the bottom. */
  const keyboardUp = async (height: number): Promise<void> => {
    await act(async () => {
      vv.height = window.innerHeight - height;
      vv.dispatchEvent(new Event('resize'));
    });
  };

  it('portals out of its host, hidden, and stays hidden while not floating', async () => {
    await render({});
    expect(container!.contains(accessory())).toBe(false);
    expect(document.body.contains(accessory())).toBe(true);
    await settle();
    expect(accessory().style.opacity).toBe('0');
    expect(accessory().style.pointerEvents).toBe('none');
    expect(getKeyboardAccessoryTop()).toBeNull();
  });

  it('floating, it waits for the viewport to be still, then shows on the bottom of the visible area', async () => {
    const shown = vi.fn();
    await render({ floating: true, onShownChange: shown });
    // Parked at the top of the visible area until still.
    expect(accessory().style.opacity).toBe('0');
    expect(accessory().style.top).toBe('0px');

    await keyboardUp(300);
    expect(accessory().style.opacity).toBe('0');
    await settle();
    expect(accessory().style.opacity).toBe('1');
    const top = vv.height - accessory().offsetHeight;
    expect(accessory().style.top).toBe(`${top}px`);
    expect(getKeyboardAccessoryTop()).toBe(top);
    expect(shown).toHaveBeenLastCalledWith(true);
  });

  it('hides at once when the viewport moves, parked at its top, and comes back when still', async () => {
    const shown = vi.fn();
    await render({ floating: true, onShownChange: shown });
    await keyboardUp(300);
    await settle();
    expect(accessory().style.opacity).toBe('1');

    await act(async () => {
      vv.offsetTop = 40;
      vv.dispatchEvent(new Event('scroll'));
    });
    expect(accessory().style.opacity).toBe('0');
    expect(shown).toHaveBeenLastCalledWith(false);
    expect(getKeyboardAccessoryTop()).toBeNull();
    await act(async () => { vi.advanceTimersByTime(20); });
    expect(accessory().style.top).toBe('40px');

    await settle();
    expect(accessory().style.opacity).toBe('1');
    expect(accessory().style.top).toBe(`${40 + vv.height - accessory().offsetHeight}px`);
  });

  it('reports the keyboard going away while floating, once it has been seen up', async () => {
    const closed = vi.fn();
    await render({ floating: true, onKeyboardClose: closed });
    // Down without having been up: nothing to report.
    await act(async () => { vv.dispatchEvent(new Event('resize')); });
    expect(closed).not.toHaveBeenCalled();

    await keyboardUp(300);
    await keyboardUp(0);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('a page that shrinks with the keyboard still reads it, against the height before it rose', async () => {
    const closed = vi.fn();
    await render({ floating: true, onKeyboardClose: closed });
    const before = window.innerHeight;
    // `interactive-widget=resizes-content`: the layout shrinks with the keyboard.
    Object.defineProperty(window, 'innerHeight', { value: before - 300, configurable: true });
    try {
      await act(async () => {
        vv.height = before - 300;
        vv.dispatchEvent(new Event('resize'));
      });
      Object.defineProperty(window, 'innerHeight', { value: before, configurable: true });
      await act(async () => {
        vv.height = before;
        vv.dispatchEvent(new Event('resize'));
      });
      expect(closed).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'innerHeight', { value: before, configurable: true });
    }
  });

  it('stops floating: hidden and the published top cleared', async () => {
    await render({ floating: true });
    await keyboardUp(300);
    await settle();
    expect(getKeyboardAccessoryTop()).not.toBeNull();

    await render({ floating: false });
    await settle();
    expect(accessory().style.opacity).toBe('0');
    expect(getKeyboardAccessoryTop()).toBeNull();
  });

  it('undoes pinch zoom', async () => {
    await render({ floating: true });
    await act(async () => {
      vv.scale = 2;
      vv.width = window.innerWidth / 2;
      vv.height = window.innerHeight / 2;
      vv.dispatchEvent(new Event('resize'));
    });
    await settle();
    expect(accessory().style.transform).toBe('scale(0.5)');
    expect(accessory().style.width).toBe(`${window.innerWidth}px`);
  });

  it('follows its content into a new portal root and places it there', async () => {
    await render({});
    const first = accessory();
    // The shared root goes when its last user lets go for a moment (a remount); the next one is new.
    document.querySelector('.sxl-portal-root')!.remove();
    expect(first.isConnected).toBe(false);

    await render({ floating: true });
    await keyboardUp(300);
    await settle();
    expect(accessory()).not.toBe(first);
    expect(accessory().isConnected).toBe(true);
    expect(accessory().style.opacity).toBe('1');
    expect(accessory().style.width).toBe(`${window.innerWidth}px`);
  });

  describe("with the browser's VirtualKeyboard API", () => {
    /** `navigator.virtualKeyboard`: the keyboard's rectangle as the browser reports it. */
    interface FakeKeyboardApi extends EventTarget {
      overlaysContent: boolean;
      boundingRect: { x: number, y: number, width: number, height: number };
    }
    let api: FakeKeyboardApi;
    beforeEach(() => {
      api = Object.assign(new EventTarget(), {
        overlaysContent: false, boundingRect: { x: 0, y: 0, width: 0, height: 0 }
      });
      Object.defineProperty(navigator, 'virtualKeyboard', { value: api, configurable: true });
    });
    afterEach(() => {
      Object.defineProperty(navigator, 'virtualKeyboard', { value: undefined, configurable: true });
    });
    /** The keyboard as the browser reports it: `height` px over the bottom of the page. */
    const keyboardGeometry = async (height: number): Promise<void> => {
      await act(async () => {
        api.boundingRect = { x: 0, y: window.innerHeight - height, width: window.innerWidth, height };
        api.dispatchEvent(new Event('geometrychange'));
      });
    };

    it('overlays the keyboard only while floating, and the browser places it', async () => {
      await render({ floating: false });
      expect(api.overlaysContent).toBe(false);

      await render({ floating: true });
      expect(api.overlaysContent).toBe(true);
      await keyboardGeometry(300);
      await settle();
      expect(accessory().style.opacity).toBe('1');
      expect(accessory().style.top).toBe('auto');
      expect(getKeyboardAccessoryTop()).not.toBeNull();

      await render({ floating: false });
      expect(api.overlaysContent).toBe(false);
    });

    it('a focus inside overlays at once, before the owner has rendered it floating', async () => {
      await render({});
      const field = document.createElement('input');
      accessory().appendChild(field);
      await act(async () => { field.focus(); });
      expect(api.overlaysContent).toBe(true);
      await act(async () => { field.blur(); });
      expect(api.overlaysContent).toBe(false);
      field.remove();
    });

    it('reads the keyboard from the browser while it overlays, and reports it going away', async () => {
      const closed = vi.fn();
      await render({ floating: true, onKeyboardClose: closed });
      await keyboardGeometry(300);
      // The visual viewport has not moved: the keyboard overlays the page.
      expect(vv.height).toBe(window.innerHeight);
      expect(isVirtualKeyboardUp()).toBe(true);

      await keyboardGeometry(0);
      expect(isVirtualKeyboardUp()).toBe(false);
      expect(closed).toHaveBeenCalledTimes(1);
    });

    it('pinch-zoomed, it sits on the keyboard in the visible area with the zoom undone', async () => {
      await render({ floating: true });
      await keyboardGeometry(300);
      await act(async () => {
        vv.scale = 2;
        vv.width = window.innerWidth / 2;
        vv.height = window.innerHeight / 2;
        vv.offsetTop = 100;
        vv.dispatchEvent(new Event('resize'));
      });
      await settle();
      expect(accessory().style.transform).toBe('scale(0.5)');
      expect(accessory().style.width).toBe(`${window.innerWidth}px`);
      // The keyboard's 300 screen px are 150 of the zoomed page's.
      expect(accessory().style.top).toBe(`${100 + window.innerHeight / 2 - (300 + accessory().offsetHeight) / 2}px`);
    });

    it('lets go of the overlay when it unmounts', async () => {
      await render({ floating: true });
      expect(api.overlaysContent).toBe(true);
      await act(async () => { root?.unmount(); });
      root = null;
      expect(api.overlaysContent).toBe(false);
    });
  });
});
