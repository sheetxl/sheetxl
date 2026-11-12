import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { CommandScope } from '../../command/CommandScope';
import { ManualActivation } from '../../command/ActivationTracker';
import { CommandResolver } from '../../command/CommandResolver';

function tree() {
  const app = new CommandScope('app');
  const sheet = app.createChild('sheet');
  const scripting = app.createChild('scripting');
  app.updateCommand('copy', { label: 'Copy', icon: 'copyIcon' }); // chrome on app
  sheet.updateCommand('copy', { callback: () => {} });            // action on sheet only
  return { app, sheet, scripting };
}

/**
 * Let the current tick's scope fan-out window close (its trailing notify runs on a microtask), so
 * the next bump is a leading edge again — tree() setup bumps in the same tick as the test body.
 */
const settle = (): Promise<void> => Promise.resolve();

describe('CommandResolver', () => {
  it('resolves from the tracker anchor (chain = anchor → root), and follows anchor changes', () => {
    const { app, sheet, scripting } = tree();
    const tracker = new ManualActivation(scripting);
    const r = new CommandResolver(app, tracker);
    r.connect();

    expect(r.resolve('copy')!.disabled()).toBe(true);   // scripting chain → no callback
    expect(r.resolve('copy')!.getLabel()).toBe('Copy'); // chrome still cascades from app

    tracker.setAnchor(sheet);
    expect(r.resolve('copy')!.disabled()).toBe(false);  // sheet chain → enabled
    r.dispose();
  });

  it('execute dispatches through the resolved command (fires per-key observers)', async () => {
    const { app, sheet } = tree();
    const onExecute = vi.fn();
    app.addExecuteListener('copy', { onExecute });
    const r = new CommandResolver(app, new ManualActivation(sheet));
    r.connect();

    await expect(r.execute('copy')).resolves.toBe(true);
    expect(onExecute).toHaveBeenCalledOnce();
    r.dispose();
  });

  it('missing command → resolve undefined, execute false', async () => {
    const { app, sheet } = tree();
    const r = new CommandResolver(app, new ManualActivation(sheet));
    r.connect();
    expect(r.resolve('nope')).toBeUndefined();
    await expect(r.execute('nope')).resolves.toBe(false);
    r.dispose();
  });

  it('one subscribe() coalesces BOTH anchor changes and contribution changes', async () => {
    const { app, sheet, scripting } = tree();
    await settle();
    const tracker = new ManualActivation(scripting);
    const r = new CommandResolver(app, tracker);
    r.connect();
    const cb = vi.fn();
    r.subscribe(cb);

    tracker.setAnchor(sheet);                        // anchor change
    expect(cb).toHaveBeenCalledTimes(1);
    sheet.updateCommand('copy', { label: 'Copy!' }); // contribution change
    expect(cb).toHaveBeenCalledTimes(2);
    r.dispose();
  });

  it('dispose detaches from scope + tracker', () => {
    const { app, sheet, scripting } = tree();
    const tracker = new ManualActivation(scripting);
    const r = new CommandResolver(app, tracker);
    r.connect();
    const cb = vi.fn();
    r.subscribe(cb);
    r.dispose();

    tracker.setAnchor(sheet);
    sheet.updateCommand('copy', { label: 'X' });
    expect(cb).not.toHaveBeenCalled();
  });

  describe('debounce', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('fires the leading edge immediately, then coalesces the trailing burst into one emit', async () => {
      const { app, sheet, scripting } = tree();
      await settle();
      const tracker = new ManualActivation(scripting);
      const r = new CommandResolver(app, tracker, { debounce: 100 });
      r.connect();
      const cb = vi.fn();
      r.subscribe(cb);

      tracker.setAnchor(sheet);        // idle → leading edge fires immediately
      expect(cb).toHaveBeenCalledTimes(1);
      sheet.updateCommand('copy', { label: 'A' });
      sheet.updateCommand('copy', { label: 'B' });
      expect(cb).toHaveBeenCalledTimes(1); // trailing burst still pending within the window

      vi.advanceTimersByTime(100);
      expect(cb).toHaveBeenCalledTimes(2); // one coalesced trailing emit
      r.dispose();
    });

    it('re-fires the leading edge for a burst that starts after the window closed', async () => {
      const { app, sheet, scripting } = tree();
      await settle();
      const tracker = new ManualActivation(scripting);
      const r = new CommandResolver(app, tracker, { debounce: 100 });
      r.connect();
      const cb = vi.fn();
      r.subscribe(cb);

      sheet.updateCommand('copy', { label: 'A' }); // leading
      expect(cb).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(100);                  // window closes, no trailing emit pending
      expect(cb).toHaveBeenCalledTimes(1);
      await settle();

      sheet.updateCommand('copy', { label: 'B' }); // idle again → leading fires immediately
      expect(cb).toHaveBeenCalledTimes(2);
      r.dispose();
    });

    it('dispose() inside an open window resets it, so a reconnected resolver still emits', async () => {
      // The StrictMode shape: mount → emit (window opens) → cleanup dispose → remount connect. A
      // stale window would swallow every later emit as "burst in flight" — a permanently silent
      // resolver.
      const { app, sheet, scripting } = tree();
      const tracker = new ManualActivation(scripting);
      const r = new CommandResolver(app, tracker, { debounce: 100 });
      r.connect();
      sheet.updateCommand('copy', { label: 'A' }); // leading → window open
      r.dispose();                                  // cleanup mid-window

      r.connect();
      const cb = vi.fn();
      r.subscribe(cb);
      sheet.updateCommand('copy', { label: 'B' });  // same tick: the scope delivers it on its trailing edge
      await settle();
      expect(cb).toHaveBeenCalledTimes(1);           // …which the reset resolver takes as a fresh leading edge
      r.dispose();
    });
  });

  describe('addResolveInjector (resolve-time leaf injection)', () => {
    it('splices a most-specific contribution that overrides an ENABLED base (bug-1 shape)', async () => {
      const app = new CommandScope('app');
      const base = vi.fn();
      app.updateCommand('copy', { label: 'Copy', callback: base });
      const r = new CommandResolver(app, new ManualActivation(app));
      r.connect();
      expect(r.resolve('copy')!.disabled()).toBe(false); // base is a real, enabled command

      const injected = vi.fn();
      const remove = r.addResolveInjector((key) => (key === 'copy' ? { callback: injected } : undefined));
      await r.execute('copy');
      expect(injected).toHaveBeenCalledOnce();   // injected leaf wins the override
      expect(base).not.toHaveBeenCalled();

      remove();
      await r.execute('copy');                   // removal reverts to the base
      expect(base).toHaveBeenCalledOnce();
      r.dispose();
    });

    it('fills a key the chain does not resolve at all (bug-2 shape)', () => {
      const app = new CommandScope('app');
      const r = new CommandResolver(app, new ManualActivation(app));
      r.connect();
      expect(r.resolve('copy')).toBeUndefined(); // nothing on the chain contributes copy

      r.addResolveInjector((key) => (key === 'copy' ? { callback: () => {} } : undefined));
      const cmd = r.resolve('copy');
      expect(cmd).toBeDefined();
      expect(cmd!.disabled()).toBe(false);       // now resolves, enabled
      r.dispose();
    });

    it('invalidate() forces a re-emit (for injectors gated on live DOM state)', () => {
      const app = new CommandScope('app');
      const r = new CommandResolver(app, new ManualActivation(app));
      r.connect();
      const cb = vi.fn();
      r.subscribe(cb);
      r.invalidate();
      expect(cb).toHaveBeenCalledTimes(1);
      r.invalidate();
      expect(cb).toHaveBeenCalledTimes(2);
      r.dispose();
    });

    it('an injector returning undefined leaves the base untouched; add/remove re-emit', () => {
      const app = new CommandScope('app');
      app.updateCommand('copy', { label: 'Copy', callback: () => {} });
      const r = new CommandResolver(app, new ManualActivation(app));
      r.connect();
      const cb = vi.fn();
      r.subscribe(cb);

      const remove = r.addResolveInjector(() => undefined); // never contributes
      expect(cb).toHaveBeenCalledTimes(1);                  // add re-emits
      expect(r.resolve('copy')!.getLabel()).toBe('Copy');   // base intact
      remove();
      expect(cb).toHaveBeenCalledTimes(2);                  // remove re-emits
      r.dispose();
    });
  });
});
