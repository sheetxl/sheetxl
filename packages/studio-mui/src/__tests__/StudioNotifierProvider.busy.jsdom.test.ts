import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

import { useNotifier, type BusyHandle, type IReactNotifier } from '@sheetxl/utils-react';

import { StudioNotifierProvider } from '../studio/StudioNotifierProvider';

/**
 * The busy indicator is mounted once and armed per operation, rather than mounted per operation.
 * That saves every command a mount + full-screen first paint (the transactional middleware raises a
 * handle around each one), but it means two things an unmount used to give for free have to be done
 * deliberately — and both of them were, at one point, got wrong here:
 *
 *  - **disarm at once**: work that outlasts the 1.2s delay is on screen when it ends, and anything
 *    that lets a frame paint before the panel stands down leaves it lingering past its operation;
 *  - **a fresh countdown per operation**: a panel that stayed armed between operations carries an
 *    already-elapsed delay, so the next one shows the panel instantly — on work that should have
 *    been silent.
 */
describe('StudioNotifierProvider (busy indicator)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  const mount = async () => {
    let notifier: IReactNotifier | null = null;
    const Probe = (): null => { notifier = useNotifier(); return null; };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(StudioNotifierProvider as never, {
        children: createElement(Probe) as ReactElement
      }));
    });
    return {
      notifier: (): IReactNotifier => notifier!,
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  const panel = (): HTMLElement | null => document.querySelector('.animatable');
  /** Armed = the fade has been started. Whether it is SEEN is the CSS delay's business. */
  const isArmed = (): boolean => !!panel()?.classList.contains('animating');
  const labelText = (): string => panel()?.querySelector('[data-sxl-loading-label]')?.textContent ?? '';

  it('mounts the panel up front, idle', async () => {
    const { unmount } = await mount();
    expect(panel(), 'mounted before any work, so its layer is already painted').not.toBeNull();
    expect(isArmed(), 'and idle').toBe(false);
    await unmount();
  });

  it('arms the fade and sets the label before the caller can block', async () => {
    const { notifier, unmount } = await mount();

    const pending = notifier().showBusy('Sorting');
    // Synchronously — before the caller is even handed the handle, let alone blocks the thread.
    expect(isArmed(), 'fade armed synchronously').toBe(true);
    expect(labelText(), 'label written without a render').toBe('Sorting');

    let handle!: BusyHandle;
    await act(async () => { handle = await Promise.resolve(pending); });
    expect(typeof handle, 'settles to a usable handle').toBe('function');

    await unmount();
  });

  it('disarms in the same tick the work ends — nothing may paint it afterwards', async () => {
    const { notifier, unmount } = await mount();

    let handle!: BusyHandle;
    await act(async () => { handle = await Promise.resolve(notifier().showBusy('Sorting')); });
    expect(isArmed()).toBe(true);

    handle(); // no await, no act: by the time this returns the panel must already be idle
    expect(isArmed(), 'still armed after dismiss — it would linger past its operation').toBe(false);

    await unmount();
  });

  it('gives each operation a fresh countdown', async () => {
    const { notifier, unmount } = await mount();

    let first!: BusyHandle;
    await act(async () => { first = await Promise.resolve(notifier().showBusy('Bold')); });
    first();

    // A second, later operation has to arm again — i.e. it waits for its own commit rather than
    // riding a still-armed panel whose delay has already run down.
    const second = notifier().showBusy('Italic');
    expect(typeof second, 'a later operation re-arms (and so waits) rather than inheriting').toBe('object');
    expect(isArmed()).toBe(true);

    await act(async () => { (await Promise.resolve(second))(); });
    expect(isArmed()).toBe(false);
    await unmount();
  });

  it('a second concurrent operation rides the armed panel, and the panel outlives the first', async () => {
    const { notifier, unmount } = await mount();

    let first!: BusyHandle;
    await act(async () => { first = await Promise.resolve(notifier().showBusy('Opening')); });

    // Already armed: nothing to commit, so this one costs no frame at all.
    const second = notifier().showBusy('Calculating');
    expect(typeof second, 'concurrent raise is synchronous').toBe('function');
    expect(labelText(), 'label follows the most recent operation').toBe('Calculating');

    first();
    expect(isArmed(), 'one of two done — still working').toBe(true);
    (second as BusyHandle)();
    expect(isArmed(), 'all done').toBe(false);

    await unmount();
  });

  it('a burst of fast operations leaves it idle', async () => {
    const { notifier, unmount } = await mount();

    for (let i = 0; i < 10; i++) {
      let handle!: BusyHandle;
      await act(async () => { handle = await Promise.resolve(notifier().showBusy(`op ${i}`)); });
      handle();
      expect(isArmed(), `op ${i} left the panel armed`).toBe(false);
    }
    await unmount();
  });
});
