import { describe, it, expect, afterEach, beforeEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { useVisualViewportRect, type VisualViewportRect } from '../../hooks/useVisualViewportRect';

/**
 * A stand-in for `window.visualViewport`: the four geometry fields over an EventTarget, so the hook's
 * `resize` / `scroll` subscription is exercised rather than mocked. jsdom has no visual viewport of
 * its own.
 */
class StubViewport extends EventTarget {
  width = 390;
  height = 844;
  offsetTop = 0;
  offsetLeft = 0;
  shrink(by: number): void { this.height -= by; this.dispatchEvent(new Event('resize')); }
  scroll(to: number): void { this.offsetTop = to; this.dispatchEvent(new Event('scroll')); }
}

describe('useVisualViewportRect', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let stub: StubViewport;

  beforeEach(() => {
    stub = new StubViewport();
    Object.defineProperty(window, 'visualViewport', { value: stub, configurable: true, writable: true });
  });
  afterEach(async () => {
    await act(async () => { root?.unmount(); });
    container?.remove();
    root = null;
    container = null;
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true, writable: true });
  });

  const mount = async (enabled?: boolean): Promise<{ rects: (VisualViewportRect | null)[] }> => {
    const rects: (VisualViewportRect | null)[] = [];
    const Host = (): null => {
      rects.push(useVisualViewportRect(enabled));
      return null;
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root!.render(createElement(Host)); });
    return { rects };
  };

  it('reads the viewport on mount', async () => {
    const { rects } = await mount();
    expect(rects.at(-1)).toEqual({ width: 390, height: 844, offsetTop: 0, offsetLeft: 0 });
  });

  it('re-renders when the viewport shrinks (the keyboard rose)', async () => {
    const { rects } = await mount();
    await act(async () => { stub.shrink(300); });
    expect(rects.at(-1)?.height).toBe(544);
  });

  it('re-renders when the viewport scrolls under the layout', async () => {
    const { rects } = await mount();
    await act(async () => { stub.scroll(120); });
    expect(rects.at(-1)?.offsetTop).toBe(120);
  });

  it('keeps the same object while nothing changed', async () => {
    const { rects } = await mount();
    const before = rects.at(-1);
    await act(async () => { stub.dispatchEvent(new Event('resize')); });
    expect(rects.at(-1)).toBe(before);
  });

  it('is null when disabled, and does not listen', async () => {
    const { rects } = await mount(false);
    expect(rects.at(-1)).toBeNull();
    const renders = rects.length;
    await act(async () => { stub.shrink(300); });
    expect(rects.length).toBe(renders);
  });

  it('is null where there is no visual viewport', async () => {
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true, writable: true });
    const { rects } = await mount();
    expect(rects.at(-1)).toBeNull();
  });
});
