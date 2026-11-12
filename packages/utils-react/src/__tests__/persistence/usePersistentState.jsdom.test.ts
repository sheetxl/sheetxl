import { describe, it, expect, afterEach } from 'vitest';

import { createElement, useEffect, act } from 'react';
import { createRoot } from 'react-dom/client';

import { PersistentStateProvider, InMemoryStore, usePersistentState } from '../../persistence';

/**
 * Hydration is **asynchronous by design** — the store may be IndexedDB or remote — which means the
 * read is issued in the mount commit and resolves at best a microtask later. Anything written in
 * that window is newer than what the read returns, so these pin which side wins.
 *
 * The case that made it matter: a task pane seeding itself from its activation argument in a mount
 * effect (Ctrl+1 asking the format pane for the Number tab) had its choice silently reverted to the
 * stored tab. Nothing the caller could do with the public API avoided it — the read was already in
 * flight before the caller existed.
 */
describe('usePersistentState (hydration vs. a local write)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  /** Mount a probe over `store`; `onMount` runs in a mount effect, i.e. mid-read. */
  const mount = async (store: InMemoryStore, onMount?: (set: (v: string) => void) => void) =>
    mountProbe(store, { onMount });

  it('hydrates the stored value when nothing writes during the read', async () => {
    const store = new InMemoryStore();
    store.setItem(':tab', JSON.stringify('border'));

    const { read, unmount } = await mount(store);
    expect(read()).toBe('border');

    await unmount();
  });

  it('lets a write during the read win, in state and in the store', async () => {
    const store = new InMemoryStore();
    store.setItem(':tab', JSON.stringify('border'));

    const { read, unmount } = await mount(store, (set) => set('number'));
    expect(read()).toBe('number');
    expect(store.getItem(':tab')).toBe(JSON.stringify('number'));

    await unmount();
  });

  it('keeps a write during the read when the store is empty', async () => {
    const store = new InMemoryStore();

    const { read, unmount } = await mount(store, (set) => set('border'));
    expect(read()).toBe('border');
    expect(store.getItem(':tab')).toBe(JSON.stringify('border'));

    await unmount();
  });

  it('shows the default for an empty store without writing it', async () => {
    const store = new InMemoryStore();

    const { read, unmount } = await mount(store);
    expect(read()).toBe('number');
    expect(store.getItem(':tab')).toBeNull();

    await unmount();
  });
});

/**
 * A host sets the starting value of user-adjustable state (the web app enabling the dark grid) with the
 * provider's `defaultValues`; the user's stored choice must still win, and the default must never be
 * written — a written default is indistinguishable from a choice.
 */
describe('usePersistentState (provider defaultValues)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('uses the provider default over the call-site default, without writing it', async () => {
    const store = new InMemoryStore();

    const { read, unmount } = await mountProbe(store, { defaultValues: { tab: 'border' } });
    expect(read()).toBe('border');
    expect(store.getItem(':tab')).toBeNull();

    await unmount();
  });

  it('lets a stored value win over the provider default', async () => {
    const store = new InMemoryStore();
    store.setItem(':tab', JSON.stringify('font'));

    const { read, unmount } = await mountProbe(store, { defaultValues: { tab: 'border' } });
    expect(read()).toBe('font');

    await unmount();
  });

  it('ignores provider defaults for other keys', async () => {
    const store = new InMemoryStore();

    const { read, unmount } = await mountProbe(store, { defaultValues: { other: 'border' } });
    expect(read()).toBe('number');

    await unmount();
  });

  it('resets to the provider default on clear', async () => {
    const store = new InMemoryStore();
    let clear: () => void = () => {};

    const { read, unmount } = await mountProbe(store, {
      defaultValues: { tab: 'border' },
      onMount: (set, doClear) => { set('font'); clear = doClear; }
    });
    expect(read()).toBe('font');

    await act(async () => { clear(); });
    expect(read()).toBe('border');
    expect(store.getItem(':tab')).toBeNull();

    await unmount();
  });

  it('follows a changed provider default while nothing is stored', async () => {
    const store = new InMemoryStore();

    const { read, rerender, unmount } = await mountProbe(store, { defaultValues: { tab: 'border' } });
    expect(read()).toBe('border');

    await rerender({ tab: 'font' });
    expect(read()).toBe('font');

    await unmount();
  });
});

/**
 * Callers memoize on the setter (a command contribution's `data`, for one); a new setter per render
 * re-ran every such memo on any unrelated re-render.
 */
describe('usePersistentState (setter identity)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('keeps setState and clear stable across writes and re-renders', async () => {
    const store = new InMemoryStore();
    const setters = new Set<unknown>();
    const clears = new Set<unknown>();
    let latest: { value: string; set: (v: string) => void; clear: () => void } | undefined;
    // `tick` only forces a re-render with a new prop.
    const Probe = (_props: { tick: number }): null => {
      const [value, set, clear] = usePersistentState<string>('tab', 'number');
      setters.add(set);
      clears.add(clear);
      latest = { value, set: set as (v: string) => void, clear };
      return null;
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const render = async (tick: number) => {
      await act(async () => {
        root.render(createElement(PersistentStateProvider as never, { store, debounceMs: 0 } as never,
          createElement(Probe, { tick })));
      });
    };

    await render(0);
    await act(async () => { latest!.set('border'); });
    expect(latest!.value).toBe('border');
    await render(1);
    await act(async () => { latest!.set('font'); });
    expect(latest!.value).toBe('font');
    expect(store.getItem(':tab')).toBe(JSON.stringify('font'));
    await act(async () => { latest!.clear(); });
    expect(latest!.value).toBe('number');

    expect(setters.size).toBe(1);
    expect(clears.size).toBe(1);

    await act(async () => { root.unmount(); });
    container.remove();
  });
});

/** Mount a `usePersistentState('tab', 'number')` probe over `store`. */
const mountProbe = async (
  store: InMemoryStore,
  options: {
    defaultValues?: Record<string, unknown>;
    onMount?: (set: (v: string) => void, clear: () => void) => void;
  } = {}
): Promise<{
  read: () => string | undefined;
  rerender: (defaultValues: Record<string, unknown>) => Promise<void>;
  unmount: () => Promise<void>;
}> => {
  let latest: string | undefined;
  const Probe = (): null => {
    const [value, setValue, clear] = usePersistentState<string>('tab', 'number');
    latest = value;
    useEffect(() => { options.onMount?.(setValue as (v: string) => void, clear); }, []);
    return null;
  };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = async (defaultValues?: Record<string, unknown>) => {
    await act(async () => {
      root.render(createElement(PersistentStateProvider as never, { store, debounceMs: 0, defaultValues } as never,
        createElement(Probe)));
    });
  };
  await render(options.defaultValues);
  return {
    read: () => latest,
    rerender: render,
    unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
  };
};
