import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { useKeyboardResize, type KeyboardResize } from '../virtualKeyboard';

/** A visual viewport the test moves: the part of the page the keyboard leaves visible. */
interface FakeViewport extends EventTarget {
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
  scale: number;
}

/**
 * A host that is the page (the `'resize'` mode) shrinks to the part of the screen the
 * keyboard leaves, follows the visible area's offset, and scrolls the page back to the top. Only the
 * keyboard counts: the address bar is not a keyboard.
 */
describe('useKeyboardResize', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let vv: FakeViewport;
  let latest: KeyboardResize | null = null;
  const scrollTo = vi.fn();

  beforeEach(() => {
    vv = Object.assign(new EventTarget(), {
      width: window.innerWidth, height: window.innerHeight, offsetTop: 0, offsetLeft: 0, scale: 1
    });
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    scrollTo.mockClear();
    vi.spyOn(window, 'scrollTo').mockImplementation(scrollTo as never);
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  afterEach(async () => {
    await act(async () => { root?.unmount(); });
    container?.remove();
    root = null;
    container = null;
    latest = null;
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    vi.restoreAllMocks();
  });

  const Probe = ({ enabled }: { enabled: boolean }): null => {
    latest = useKeyboardResize(enabled);
    return null;
  };
  const mount = async (enabled: boolean): Promise<void> => {
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () => { root!.render(createElement(Probe, { enabled })); });
  };
  const viewport = async (height: number, offsetTop: number = 0): Promise<void> => {
    await act(async () => {
      vv.height = height;
      vv.offsetTop = offsetTop;
      vv.dispatchEvent(new Event('resize'));
    });
  };

  it('gives up the keyboard\'s height, and follows the visible area\'s offset, while it is up', async () => {
    await mount(true);
    expect(latest).toEqual({ inset: 0, offsetTop: 0 });

    await viewport(window.innerHeight - 300, 40);
    expect(latest).toEqual({ inset: 300, offsetTop: 40 });

    await viewport(window.innerHeight);
    expect(latest).toEqual({ inset: 0, offsetTop: 0 });
  });

  it('the address bar is not a keyboard', async () => {
    await mount(true);
    await viewport(window.innerHeight - 56);
    expect(latest).toEqual({ inset: 0, offsetTop: 0 });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls the page back while the keyboard is up, and once as it goes', async () => {
    await mount(true);
    Object.defineProperty(window, 'scrollY', { value: 120, configurable: true });
    await viewport(window.innerHeight - 300);
    expect(scrollTo).toHaveBeenCalledTimes(1);

    await viewport(window.innerHeight);
    expect(scrollTo).toHaveBeenCalledTimes(2);

    // Down, and staying down: the page is the user's.
    await viewport(window.innerHeight - 10);
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it('does nothing while not enabled', async () => {
    await mount(false);
    Object.defineProperty(window, 'scrollY', { value: 120, configurable: true });
    await viewport(window.innerHeight - 300, 40);
    expect(latest).toEqual({ inset: 0, offsetTop: 0 });
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
