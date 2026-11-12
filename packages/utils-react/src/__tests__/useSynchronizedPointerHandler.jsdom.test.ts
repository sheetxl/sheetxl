import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { useSynchronizedPointerHandler } from '../hooks/useSynchronizedPointerHandler';

/**
 * A press always ends: when the window loses the pointer (another app or a system overlay such as a
 * screenshot tool takes it) or the browser cancels it, the gesture still hears its release — once.
 */
describe('useSynchronizedPointerHandler release', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  afterEach(async () => {
    await act(async () => { root?.unmount(); });
    container?.remove();
    root = null;
    container = null;
  });

  const frame = (): Promise<void> => act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });

  const mount = async (processTouch: boolean): Promise<{ target: HTMLElement; ups: number[] }> => {
    const ups: number[] = [];
    const Host = (): React.ReactElement => {
      const onPointerDown = useSynchronizedPointerHandler({
        processTouch,
        onPointerDown: () => {},
        onPointerUp: () => { ups.push(1); }
      });
      return createElement('div', { 'data-testid': 'target', onPointerDown });
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root!.render(createElement(Host)); });
    const target = container.querySelector('[data-testid="target"]') as HTMLElement;
    return { target, ups };
  };

  const press = async (target: HTMLElement): Promise<void> => {
    await act(async () => {
      target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }));
    });
  };

  it('ends the press when the window loses focus', async () => {
    const { target, ups } = await mount(true);
    await press(target);

    window.dispatchEvent(new Event('blur'));
    await frame();
    expect(ups.length).toBe(1);

    // The real release that may follow is not delivered a second time.
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    await frame();
    expect(ups.length).toBe(1);
  });

  it('ends the press when the browser cancels the pointer', async () => {
    const { target, ups } = await mount(true);
    await press(target);

    document.dispatchEvent(new MouseEvent('pointercancel', { bubbles: true }));
    await frame();
    expect(ups.length).toBe(1);
  });

  it('ends a mouse-mode press when the window loses focus', async () => {
    const { target, ups } = await mount(false);
    await press(target);

    window.dispatchEvent(new Event('blur'));
    await frame();
    expect(ups.length).toBe(1);
  });
});
