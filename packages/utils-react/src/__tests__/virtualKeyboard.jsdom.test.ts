import { describe, it, expect, vi, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import {
  createVirtualKeyboardStore, VirtualKeyboardProvider, useVirtualKeyboard, isVirtualKeyboardUp,
  type VirtualKeyboardHandler
} from '../virtualKeyboard';
import { exitEditMode, subscribeEditModeExit } from '../hooks/useEditMode';

/**
 * Keyboard mode: one bus for the sheet, its editors and any keyboard control. Show and hide switch
 * it, the input mode is shared, and the latest registered editor is where typing opens.
 */
describe('virtual keyboard store', () => {
  it('show and hide switch keyboard mode and notify', () => {
    const store = createVirtualKeyboardStore({ disabled: false });
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.isActive()).toBe(false);

    store.show();
    expect(store.isActive()).toBe(true);
    store.show();
    expect(listener).toHaveBeenCalledTimes(1);

    store.hide();
    expect(store.isActive()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('a disabled store never enters keyboard mode, and show says so', () => {
    const store = createVirtualKeyboardStore({ disabled: true });
    expect(store.isEnabled()).toBe(false);
    expect(store.show()).toBe(false);
    expect(store.isActive()).toBe(false);
  });

  it('disabled: false turns keyboard mode on whatever the device', () => {
    const store = createVirtualKeyboardStore({ disabled: false });
    expect(store.isEnabled()).toBe(true);
    expect(store.show()).toBe(true);
  });

  it('the input mode is shared and defaults to letters', () => {
    const store = createVirtualKeyboardStore();
    expect(store.getInputMode()).toBe('text');
    store.setInputMode('decimal');
    expect(store.getState()).toEqual({ active: false, inputMode: 'decimal' });
  });

  it('leaving keyboard mode goes back to letters', () => {
    const store = createVirtualKeyboardStore({ disabled: false });
    store.show();
    store.setInputMode('decimal');
    store.hide();
    expect(store.getState()).toEqual({ active: false, inputMode: 'text' });
  });

  it('the latest registered editor wins, and removing it restores the one before', () => {
    const store = createVirtualKeyboardStore();
    expect(store.getEditorId()).toBeNull();
    const removeBar = store.registerEditor('formula-bar');
    const removeOther = store.registerEditor('other');
    expect(store.getEditorId()).toBe('other');
    removeOther();
    expect(store.getEditorId()).toBe('formula-bar');
    removeBar();
    expect(store.getEditorId()).toBeNull();
  });

  it('jsdom has no virtual keyboard', () => {
    expect(isVirtualKeyboardUp()).toBe(false);
  });
});

describe('VirtualKeyboardProvider', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  afterEach(async () => {
    await act(async () => { root?.unmount(); });
    container?.remove();
    root = null;
    container = null;
  });

  it('shares its store with the subtree, which re-renders on change', async () => {
    const store = createVirtualKeyboardStore({ disabled: false });
    let seen: VirtualKeyboardHandler | null = null;
    let renders = 0;
    const Probe = (): null => {
      seen = useVirtualKeyboard();
      renders++;
      return null;
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root!.render(createElement(VirtualKeyboardProvider, { store }, createElement(Probe))); });
    expect(seen).toBe(store);

    const before = renders;
    await act(async () => { store.show(); });
    expect(renders).toBeGreaterThan(before);
  });
});

describe('exitEditMode', () => {
  it('tells the exit listeners before the mode\'s own way out runs', () => {
    const order: string[] = [];
    const remove = subscribeEditModeExit((mode, exit) => { order.push(`${mode.key}:${exit}`); });
    const mode = { key: 'edit', done: () => { order.push('done'); }, cancel: () => { order.push('cancel'); } };
    exitEditMode(mode, 'done');
    exitEditMode(mode, 'cancel');
    remove();
    exitEditMode(mode, 'done');
    expect(order).toEqual(['edit:done', 'done', 'edit:cancel', 'cancel', 'done']);
  });
});
