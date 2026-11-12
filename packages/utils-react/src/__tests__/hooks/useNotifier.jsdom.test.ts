import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

import { Notifier } from '@sheetxl/utils';

import {
  ReactNotifierProvider, useNotifier, type IReactNotifier
} from '../../hooks/useNotifier';

const render = async (tree: (probe: ReactNode) => ReactNode): Promise<{ notifier: IReactNotifier, unmount: () => Promise<void> }> => {
  let notifier: IReactNotifier | null = null;
  const Probe = (): null => { notifier = useNotifier(); return null; };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(tree(createElement(Probe))); });
  return { notifier: notifier!, unmount: async () => { await act(async () => { root.unmount(); }); host.remove(); } };
};

const provide = (notifier: Partial<IReactNotifier>, children: ReactNode): ReactNode =>
  createElement(ReactNotifierProvider, { notifier, children });

/**
 * With no provider the notifier shows nothing, and its logging goes to the global `Notifier`.
 * Stacked providers merge per method, and the outermost one wins.
 */
describe('useNotifier', () => {
  afterEach(() => {
    Notifier.setOverrides(null);
    vi.restoreAllMocks();
  });

  it('shows nothing without a provider', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { notifier, unmount } = await render(probe => probe);
    try {
      notifier.showMessage('hello', { type: 'error' });
      expect(await notifier.showOptions({ options: ['OK'] })).toBe('');
      expect(await notifier.showInput({})).toEqual({ input: '', option: '' });
      const hide = await notifier.showBusy('working');
      hide();
      expect(consoleLog).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      await unmount();
    }
  });

  it('sends logging and errors to the global Notifier without a provider', async () => {
    const sink = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    Notifier.setOverrides(sink);
    const { notifier, unmount } = await render(probe => probe);
    try {
      notifier.log('a');
      notifier.warn('b');
      notifier.debug('c');
      notifier.error('d');
      notifier.showError('e');
      expect(sink.log).toHaveBeenCalledWith('a', undefined);
      expect(sink.warn).toHaveBeenCalledWith('b', undefined);
      expect(sink.debug).toHaveBeenCalledWith('c', undefined);
      expect(sink.error.mock.calls.map(call => call[0])).toEqual(['d', 'e']);
    } finally {
      await unmount();
    }
  });

  it('uses the methods a provider supplies and fills the rest', async () => {
    const sink = { log: vi.fn() };
    Notifier.setOverrides(sink);
    const showMessage = vi.fn();
    const { notifier, unmount } = await render(probe => provide({ showMessage }, probe));
    try {
      notifier.showMessage('hello');
      notifier.log('logged');
      expect(showMessage).toHaveBeenCalledWith('hello');
      expect(sink.log).toHaveBeenCalledWith('logged', undefined);
    } finally {
      await unmount();
    }
  });

  it('keeps a method bound to the provider object', async () => {
    class Toasts {
      shown: string[] = [];
      showMessage(message: ReactNode): void { this.shown.push(String(message)); }
    }
    const toasts = new Toasts();
    const { notifier, unmount } = await render(probe => provide(toasts, probe));
    try {
      notifier.showMessage('hello');
      expect(toasts.shown).toEqual(['hello']);
    } finally {
      await unmount();
    }
  });

  it('lets an outer provider win per method while an inner one fills the gaps', async () => {
    const outerMessage = vi.fn();
    const innerMessage = vi.fn();
    const innerOptions = vi.fn(async () => 'Yes');
    const { notifier, unmount } = await render(probe =>
      provide({ showMessage: outerMessage },
        provide({ showMessage: innerMessage, showOptions: innerOptions }, probe)));
    try {
      notifier.showMessage('hello');
      expect(outerMessage).toHaveBeenCalledWith('hello');
      expect(innerMessage).not.toHaveBeenCalled();
      expect(await notifier.showOptions({ options: ['Yes'] })).toBe('Yes');
    } finally {
      await unmount();
    }
  });

  it('leaves the global Notifier alone', async () => {
    const sink = { warn: vi.fn() };
    Notifier.setOverrides(sink);
    const { unmount } = await render(probe => provide({ showMessage: vi.fn(), warn: vi.fn() }, probe));
    try {
      expect(Notifier.getOverrides()).toBe(sink);
    } finally {
      await unmount();
    }
    expect(Notifier.getOverrides()).toBe(sink);
  });
});
