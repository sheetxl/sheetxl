import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { PendingRender, PendingRenderScope, usePendingRender, whenRenderSettled } from '../render';

/**
 * Drawing that finishes after its first paint holds its scope open; a capture waits on
 * `whenRenderSettled` until nothing does.
 */
describe('PendingRender', () => {
  const tracked = (promise: Promise<void>): { settled: boolean } => {
    const state = { settled: false };
    promise.then(() => { state.settled = true; });
    return state;
  };
  const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

  it('settles once every hold is released, including one taken while waiting', async () => {
    const scope = {};
    const first = PendingRender.begin(scope);
    const wait = tracked(whenRenderSettled(scope));
    const second = PendingRender.begin(scope);
    first();
    first();
    await flush();
    expect(wait.settled).toBe(false);
    expect(PendingRender.isPending(scope)).toBe(true);
    second();
    await flush();
    expect(wait.settled).toBe(true);
    expect(PendingRender.isPending(scope)).toBe(false);
  });

  it('settles at once for a scope nothing holds', async () => {
    const wait = tracked(whenRenderSettled({}));
    await flush();
    expect(wait.settled).toBe(true);
  });

  describe('usePendingRender', () => {
    let root: Root | null = null;
    let host: HTMLDivElement | null = null;
    afterEach(async () => {
      await act(async () => { root?.unmount(); });
      host?.remove();
      root = null;
      host = null;
    });

    const View = (props: { scope: object; pending: boolean }): null => {
      usePendingRender(props.pending, props.scope);
      return null;
    };

    it('holds while pending, and releases on false or unmount', async () => {
      const scope = {};
      host = document.createElement('div');
      document.body.appendChild(host);
      root = createRoot(host);
      await act(async () => { root!.render(createElement(View, { scope, pending: true })); });
      expect(PendingRender.isPending(scope)).toBe(true);
      await act(async () => { root!.render(createElement(View, { scope, pending: false })); });
      expect(PendingRender.isPending(scope)).toBe(false);
      await act(async () => { root!.render(createElement(View, { scope, pending: true })); });
      expect(PendingRender.isPending(scope)).toBe(true);
      await act(async () => { root!.unmount(); });
      root = null;
      expect(PendingRender.isPending(scope)).toBe(false);
    });

    it('holds the nearest PendingRenderScope when given none, and nothing without one', async () => {
      const scope = {};
      const Unscoped = (props: { pending: boolean }): null => {
        usePendingRender(props.pending);
        return null;
      };
      host = document.createElement('div');
      document.body.appendChild(host);
      root = createRoot(host);
      await act(async () => {
        root!.render(createElement(PendingRenderScope, { scope }, createElement(Unscoped, { pending: true })));
      });
      expect(PendingRender.isPending(scope)).toBe(true);
      await act(async () => { root!.render(createElement(Unscoped, { pending: true })); });
      expect(PendingRender.isPending(scope)).toBe(false);
    });
  });
});
