import { describe, it, expect, afterEach, vi } from 'vitest';

import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { setEditMode, subscribeEditModeExit } from '@sheetxl/utils-react';

import { StatusBar } from '../statusBar';

/**
 * The status bar's way out of a mode: a ✕ beside the mode's description whenever the mode on the
 * bus carries a `cancel`, on every device. Pressing it runs the cancel; the publisher ends the mode.
 */
describe('StatusBar cancel', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  afterEach(async () => {
    await act(async () => { setEditMode(null); });
    await act(async () => { root?.unmount(); });
    container?.remove();
    root = null;
    container = null;
  });

  /** Publish a mode and wait past the bar's settle delay. */
  const publish = async (mode: Parameters<typeof setEditMode>[0]): Promise<void> => {
    await act(async () => { setEditMode(mode); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 200)); });
  };

  const mount = async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root!.render(createElement(StatusBar)); });
    return {
      cancelButton: (): HTMLElement | null => container!.querySelector('[aria-label="cancel-mode"]'),
      doneButton: (): HTMLElement | null => container!.querySelector('[aria-label="done-mode"]'),
      text: (): string => container!.querySelector('.statusBar')?.textContent ?? ''
    };
  };

  it('idle shows no cancel', async () => {
    const bar = await mount();
    expect(bar.cancelButton()).toBeNull();
    expect(bar.text()).toContain('Ready');
  });

  it('a mode with a cancel shows the ✕ beside its description, and pressing it runs the cancel', async () => {
    const bar = await mount();
    const cancel = vi.fn();
    await publish({ key: 'test', description: 'Dragging', cancel });
    expect(bar.text()).toContain('Dragging');
    const button = bar.cancelButton();
    expect(button).not.toBeNull();

    // The press must not move focus: the mode's owner keeps it.
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
    await act(async () => { button!.dispatchEvent(down); });
    expect(down.defaultPrevented).toBe(true);

    await act(async () => { button!.click(); });
    expect(cancel).toHaveBeenCalledTimes(1);

    // The publisher ends the mode; the ✕ leaves with it.
    await publish(null);
    expect(bar.cancelButton()).toBeNull();
    expect(bar.text()).toContain('Ready');
  });

  it('a mode without a cancel shows no ✕', async () => {
    const bar = await mount();
    await publish({ key: 'test', description: 'Copying' });
    expect(bar.text()).toContain('Copying');
    expect(bar.cancelButton()).toBeNull();
    expect(bar.doneButton()).toBeNull();
  });

  it('a mode with a done shows the ✓, and pressing it runs the done; both marks sit ahead of the text', async () => {
    const bar = await mount();
    const cancel = vi.fn();
    const done = vi.fn();
    await publish({ key: 'test', description: 'Entering', cancel, done });
    const cancelButton = bar.cancelButton();
    const doneButton = bar.doneButton();
    expect(cancelButton).not.toBeNull();
    expect(doneButton).not.toBeNull();
    // ✕, then ✓, then the description — the formula bar's order.
    const text = container!.querySelector('.MuiTypography-caption')!;
    expect(cancelButton!.compareDocumentPosition(doneButton!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(doneButton!.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await act(async () => { doneButton!.click(); });
    expect(done).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('a mode with ways out whose description does not fit hides the rest of the bar', async () => {
    // jsdom has no layout: every element reads as wider than its box.
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(200);
    const client = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
    try {
      await mount();
      const items = (): HTMLElement => container!.querySelector('.statusBar-items') as HTMLElement;
      // Without ways out the description is cut, never the rest.
      await publish({ key: 'test', description: 'Copying' });
      expect(items().style.display).toBe('contents');

      await publish({ key: 'test', description: 'Entering', cancel: vi.fn(), done: vi.fn() });
      expect(items().style.display).toBe('none');

      await publish(null);
      expect(items().style.display).toBe('contents');
    } finally {
      scroll.mockRestore();
      client.mockRestore();
    }
  });

  it('either way out is announced as a way out before it runs', async () => {
    const bar = await mount();
    const order: string[] = [];
    const remove = subscribeEditModeExit((mode, exit) => { order.push(`${mode.key}:${exit}`); });
    await publish({ key: 'test', description: 'Entering', cancel: () => { order.push('cancel'); }, done: () => { order.push('done'); } });

    await act(async () => { bar.doneButton()!.click(); });
    await act(async () => { bar.cancelButton()!.click(); });
    remove();
    expect(order).toEqual(['test:done', 'done', 'test:cancel', 'cancel']);
  });

  it('a mode on the bus for less than the settle delay never shows', async () => {
    const bar = await mount();
    await act(async () => { setEditMode({ key: 'test', description: 'Entering', cancel: vi.fn() }); });
    await act(async () => { setEditMode(null); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 200)); });
    expect(bar.cancelButton()).toBeNull();
    expect(bar.text()).toContain('Ready');
  });
});
