import { describe, it, expect, vi } from 'vitest';

import { createElement, useRef, type ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { useWheelScroll, type UseWheelScrollOptions } from '../../scroll/useWheelScroll';
import { PANE_SCROLLER_ATTRIBUTE } from '../../scroll/wheelOwner';

const frame = async (): Promise<void> => {
  await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
};

const mount = async (options: Omit<UseWheelScrollOptions, 'onScrollBy'> & Partial<Pick<UseWheelScrollOptions, 'onScrollBy'>>) => {
  const onScrollBy = options.onScrollBy ?? vi.fn();
  let el: HTMLDivElement | null = null;
  const Host = (): ReactElement => {
    const ref = useRef<HTMLDivElement>(null);
    useWheelScroll(ref, { ...options, onScrollBy });
    return createElement('div', { ref: (node: HTMLDivElement | null) => { (ref as any).current = node; el = node; } });
  };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(createElement(Host)); });
  return {
    el: el as unknown as HTMLDivElement,
    onScrollBy,
    unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
  };
};

const wheel = (el: HTMLElement, init: WheelEventInit): WheelEvent => {
  const e = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(e);
  return e;
};

describe('useWheelScroll — ctrl/⌘+wheel zoom routing', () => {
  it('coalesces a frame of ctrl+wheel events into ONE onZoomBy with the summed pixel delta and the last focal point', async () => {
    const onZoomBy = vi.fn();
    const { el, onScrollBy, unmount } = await mount({ onZoomBy });
    wheel(el, { deltaY: -10, ctrlKey: true, clientX: 10, clientY: 20 });
    wheel(el, { deltaY: -15, ctrlKey: true, clientX: 30, clientY: 40 });
    wheel(el, { deltaY: 5, metaKey: true, clientX: 50, clientY: 60 });
    expect(onZoomBy).not.toHaveBeenCalled();
    await frame();
    expect(onZoomBy).toHaveBeenCalledTimes(1);
    expect(onZoomBy).toHaveBeenCalledWith(-20, 50, 60);
    expect(onScrollBy).not.toHaveBeenCalled();
    await unmount();
  });

  it('normalizes deltaMode lines to pixels', async () => {
    const onZoomBy = vi.fn();
    const { el, unmount } = await mount({ onZoomBy });
    wheel(el, { deltaY: -3, deltaMode: 1, ctrlKey: true });
    await frame();
    expect(onZoomBy).toHaveBeenCalledTimes(1);
    expect(onZoomBy.mock.calls[0][0]).toBeCloseTo(-100, 6);
    await unmount();
  });

  it('a plain wheel never reaches onZoomBy, and a ctrl+wheel never reaches the scroll path or the intercept', async () => {
    const onZoomBy = vi.fn();
    const onWheelScroll = vi.fn();
    const { el, onScrollBy, unmount } = await mount({ onZoomBy, onWheelScroll });
    wheel(el, { deltaY: 100, ctrlKey: true });
    wheel(el, { deltaY: 100 });
    await frame();
    expect(onZoomBy).toHaveBeenCalledTimes(1);
    expect(onScrollBy).toHaveBeenCalledTimes(1);
    expect(onScrollBy).toHaveBeenCalledWith({ top: 100 });
    expect(onWheelScroll).toHaveBeenCalledTimes(1); // the plain wheel only
    await unmount();
  });

  it('without onZoomBy a ctrl+wheel is an ordinary wheel (intercept, then scroll)', async () => {
    const onWheelScroll = vi.fn();
    const { el, onScrollBy, unmount } = await mount({ onWheelScroll });
    wheel(el, { deltaY: 100, ctrlKey: true });
    await frame();
    expect(onWheelScroll).toHaveBeenCalledTimes(1);
    expect(onScrollBy).toHaveBeenCalledWith({ top: 100 });
    await unmount();
  });

  it('prevents the browser default (page zoom) on a ctrl+wheel', async () => {
    const { el, unmount } = await mount({ onZoomBy: vi.fn() });
    const e = wheel(el, { deltaY: 100, ctrlKey: true });
    expect(e.defaultPrevented).toBe(true);
    await unmount();
  });
});

describe('useWheelScroll — scrolling elements inside the pane', () => {
  /** A list inside the pane, 100 px tall over 300 px of content, scrolled to `scrollTop`. */
  const list = (pane: HTMLElement, scrollTop: number, style: Partial<CSSStyleDeclaration> = {}): HTMLDivElement => {
    const el = document.createElement('div');
    Object.assign(el.style, { overflowY: 'auto', ...style });
    Object.defineProperty(el, 'clientHeight', { value: 100 });
    Object.defineProperty(el, 'scrollHeight', { value: 300 });
    el.scrollTop = scrollTop;
    Object.defineProperty(el, 'scrollTop', { value: scrollTop });
    const item = document.createElement('span');
    el.appendChild(item);
    pane.appendChild(el);
    return item;
  };

  it('leaves the wheel to a list that can still scroll that way', async () => {
    const { el, onScrollBy, unmount } = await mount({});
    const item = list(el, 0);
    const e = wheel(item, { deltaY: 100 });
    await frame();
    expect(e.defaultPrevented).toBe(false);
    expect(onScrollBy).not.toHaveBeenCalled();
    await unmount();
  });

  it('scrolls the pane once the list is at its end', async () => {
    const { el, onScrollBy, unmount } = await mount({});
    const item = list(el, 200);
    const e = wheel(item, { deltaY: 100 });
    await frame();
    expect(e.defaultPrevented).toBe(true);
    expect(onScrollBy).toHaveBeenCalledWith({ top: 100 });
    await unmount();
  });

  it('keeps the wheel at the end of a list with overscroll-behavior contain', async () => {
    const { el, onScrollBy, unmount } = await mount({});
    const item = list(el, 0, { overscrollBehaviorY: 'contain' } as Partial<CSSStyleDeclaration>);
    const e = wheel(item, { deltaY: -100 });
    await frame();
    expect(e.defaultPrevented).toBe(true);
    expect(onScrollBy).not.toHaveBeenCalled();
    await unmount();
  });

  it('scrolls the pane over an element marked as the pane\'s own scroller', async () => {
    const { el, onScrollBy, unmount } = await mount({});
    const item = list(el, 0);
    item.parentElement!.setAttribute(PANE_SCROLLER_ATTRIBUTE, '');
    wheel(item, { deltaY: 100 });
    await frame();
    expect(onScrollBy).toHaveBeenCalledWith({ top: 100 });
    await unmount();
  });
});
