import { describe, it, expect, vi } from 'vitest';

import { CommandScope } from '../../command/CommandScope';

describe('CommandScope (definition store + tree resolution)', () => {
  it('within-scope merge: successive updateCommand calls merge, not clobber', () => {
    const root = new CommandScope('app');
    root.updateCommand('copy', { label: 'Copy', icon: 'copyIcon' });
    root.updateCommand('copy', { callback: () => {} }); // adds callback, keeps label/icon

    const def = root.getDefinition('copy')!;
    expect(def.label).toBe('Copy');
    expect(def.icon).toBe('copyIcon');
    expect(typeof def.callback).toBe('function');
  });

  it('cross-scope cascade: most-specific wins, ancestors fill the rest (anchor = sheet)', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    app.updateCommand('copy', { label: 'Copy', icon: 'copyIcon' }); // chrome on app
    const cb = vi.fn();
    sheet.updateCommand('copy', { callback: cb });                  // action on sheet

    const cmd = app.resolve('copy', sheet)!;
    expect(cmd.getLabel()).toBe('Copy');       // from app (ancestor)
    expect(cmd.getIcon()).toBe('copyIcon');
    expect(cmd.disabled()).toBe(false);        // callback from sheet
    expect(cmd.contributedBy.label).toBe(0);   // app least-specific
    expect(cmd.contributedBy.callback).toBe(1); // sheet most-specific
  });

  it('anchor-sensitive: a contribution off the resolution chain is not seen', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const scripting = app.createChild('scripting');
    app.updateCommand('copy', { label: 'Copy', icon: 'copyIcon' });
    sheet.updateCommand('copy', { callback: () => {} }); // only the sheet wires the action

    expect(app.resolve('copy', scripting)!.disabled()).toBe(true);  // scripting chain: no callback
    expect(app.resolve('copy', sheet)!.disabled()).toBe(false);     // sheet chain: enabled
  });

  it('missing command resolves to undefined (graceful no-op for callers)', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    expect(app.resolve('nope', sheet)).toBeUndefined();
  });

  it('removeCommand drops the contribution', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    sheet.updateCommand('copy', { callback: () => {} });
    expect(app.resolve('copy', sheet)).toBeDefined();
    sheet.removeCommand('copy');
    expect(app.resolve('copy', sheet)).toBeUndefined();
  });

  it('memoizes within a version, re-derives after a change', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    sheet.updateCommand('copy', { label: 'Copy', callback: () => {} });

    const a = app.resolve('copy', sheet);
    const b = app.resolve('copy', sheet);
    expect(a).toBe(b); // same instance — memoized within the version

    sheet.updateCommand('copy', { label: 'Copy!' }); // bumps version
    const c = app.resolve('copy', sheet);
    expect(c).not.toBe(a); // re-derived
    expect(c!.getLabel()).toBe('Copy!');
  });
});

describe('CommandScope.contribution (tracked teardown)', () => {
  it('contributes through the handle and removes exactly its keys in one call', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const contribution = sheet.contribution();
    contribution.updateCommand('undo', { label: 'Undo', callback: () => {} });
    contribution.updateCommand('redo', { label: 'Redo', callback: () => {} });
    expect(app.resolve('undo', sheet)).toBeDefined();
    expect(app.resolve('redo', sheet)).toBeDefined();

    contribution.remove(); // one call — no per-key list
    expect(app.resolve('undo', sheet)).toBeUndefined();
    expect(app.resolve('redo', sheet)).toBeUndefined();
  });

  it('re-updateCommand for a tracked key is idempotent (still one removal)', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const contribution = sheet.contribution();
    contribution.updateCommand('undo', { label: 'Undo' });
    contribution.updateCommand('undo', { callback: () => {} }); // the dynamic re-contribute (sync) pattern
    expect(sheet.getDefinition('undo')).toBeDefined();
    contribution.remove();
    expect(sheet.getDefinition('undo')).toBeUndefined();
  });

  it('removes only its own keys — other contributions to the scope are untouched', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    sheet.updateCommand('copy', { callback: () => {} }); // a direct (untracked) contribution
    const contribution = sheet.contribution();
    contribution.updateCommand('undo', { callback: () => {} });

    contribution.remove();
    expect(sheet.getDefinition('undo')).toBeUndefined(); // its key gone
    expect(sheet.getDefinition('copy')).toBeDefined();   // the other one intact
  });

  it('remove() is idempotent', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const contribution = sheet.contribution();
    contribution.updateCommand('undo', { callback: () => {} });
    contribution.remove();
    expect(() => contribution.remove()).not.toThrow();
    expect(sheet.getDefinition('undo')).toBeUndefined();
  });

  it('use() registers middleware that wraps authored callbacks; remove() unregisters it', async () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const order: string[] = [];
    const contribution = sheet.contribution();
    contribution.use((next) => async (a, c) => { order.push('tx>'); await next(a, c); order.push('<tx'); });
    contribution.updateCommand('bold', { callback: () => { order.push('work'); } });

    await app.resolve('bold', sheet)!.execute();
    expect(order).toEqual(['tx>', 'work', '<tx']); // wrapped

    contribution.remove(); // unregisters BOTH the command and the middleware
    order.length = 0;
    sheet.updateCommand('bold', { callback: () => { order.push('work2'); } }); // re-add raw
    await app.resolve('bold', sheet)!.execute();
    expect(order).toEqual(['work2']); // middleware gone
  });
});

describe('CommandScope tag enumeration (cross-cutting rules by tag)', () => {
  it('collectKeysByTag finds keys whose contribution anywhere on the chain carries the tag', () => {
    const app = new CommandScope('app');
    // Catalog (chrome + tag) authored at the root; behavior contributed lower.
    app.updateCommand('bold', { label: 'Bold', tags: ['mutator'] });
    app.updateCommand('italic', { label: 'Italic', tags: ['mutator'] });
    app.updateCommand('gridlines', { label: 'Gridlines' }); // NOT a mutator
    const sheet = app.createChild('sheet');
    sheet.updateCommand('bold', { callback: () => {} }); // behavior only, no tag here

    const keys = sheet.collectKeysByTag('mutator', sheet).sort();
    expect(keys).toEqual(['bold', 'italic']); // gridlines excluded; tag seen at the root
  });

  it('contribution.getKeysByTag reads from the owning scope → root', () => {
    const app = new CommandScope('app');
    app.updateCommand('bold', { label: 'Bold', tags: ['mutator'] });
    app.updateCommand('gridlines', { label: 'Gridlines' });
    const sheet = app.createChild('sheet');
    const contribution = sheet.contribution();

    expect(contribution.getKeysByTag('mutator').sort()).toEqual(['bold']);
  });

  it('drives a tag-based disable reducer — resolved disabled() accumulates the reason', () => {
    const app = new CommandScope('app');
    app.updateCommand('bold', { label: 'Bold', tags: ['mutator'] });
    app.updateCommand('gridlines', { label: 'Gridlines' }); // view command, never disabled
    const sheet = app.createChild('sheet');
    const contribution = sheet.contribution();
    contribution.updateCommand('bold', { callback: () => {} });
    contribution.updateCommand('gridlines', { callback: () => {} });

    // The reducer: disable every mutator found by tag (no hand-maintained key list).
    for (const key of contribution.getKeysByTag('mutator')) {
      contribution.updateCommand(key, { disabledReasons: ['Sheet is protected'] });
    }

    expect(app.resolve('bold', sheet)!.disabled()).toBe(true);
    expect(app.resolve('bold', sheet)!.disabledReasons()).toEqual(['Sheet is protected']);
    expect(app.resolve('gridlines', sheet)!.disabled()).toBe(false); // untagged ⇒ untouched
  });
});

describe('CommandScope.setParent (z-ordered layer chain — override by stacking, not focus)', () => {
  it('re-parenting a layer scope onto the base makes it win by stacking (anchor = top of stack)', () => {
    const root = new CommandScope('app');
    root.updateCommand('copy', { label: 'Copy' }); // catalog chrome
    const base = root.createChild('grid');
    base.updateCommand('copy', { label: 'Copy Cells', callback: () => {} });
    // A layer a client adds — created under the same root, its own scope + copy override.
    const layer = root.createChild('editorLayer');
    layer.updateCommand('copy', { label: 'Copy Text', callback: () => {} });

    // Not stacked yet: resolve from the base → the base command.
    expect(root.resolve('copy', base)!.getLabel()).toBe('Copy Cells');

    // Stack the layer ON the base (base → layer). The registry would anchor at the TOP (`layer`).
    layer.setParent(base);
    expect(root.resolve('copy', layer)!.getLabel()).toBe('Copy Text'); // top-of-stack wins — by stacking

    // Unstack (client removes the layer): the base takes back over.
    layer.setParent(null);
    expect(root.resolve('copy', base)!.getLabel()).toBe('Copy Cells');
  });

  it('chains three layers by z so higher z overrides lower', () => {
    const root = new CommandScope('app');
    const base = root.createChild('base');
    base.updateCommand('k', { label: 'base', callback: () => {} });
    const low = root.createChild('low');   // z=10
    const high = root.createChild('high');  // z=100
    high.updateCommand('k', { label: 'high', callback: () => {} });
    // Registry chains base → low → high (ascending z); high is the anchor (top).
    low.setParent(base);
    high.setParent(low);
    expect(root.resolve('k', high)!.getLabel()).toBe('high'); // deepest (highest z) wins
    // `low` contributes nothing for k, so it transparently falls through to base — proving a layer
    // need not override every command.
    low.updateCommand('k', { label: 'low' }); // chrome only, no callback
    expect(root.resolve('k', high)!.getLabel()).toBe('high'); // high still wins over low+base
  });

  it('rejects a cycle and cross-root moves', () => {
    const root = new CommandScope('app');
    const a = root.createChild('a');
    const b = a.createChild('b');
    expect(() => a.setParent(b)).toThrow(); // would cycle
    const other = new CommandScope('other');
    const c = other.createChild('c');
    expect(() => c.setParent(a)).toThrow(); // different root
  });
});

describe('CommandScope.createChild (contributor binds a contribution to the scope lifetime)', () => {
  it('runs the contributor with a contribution for the new child; its commands resolve', () => {
    const app = new CommandScope('app');
    const child = app.createChild('feature', (contribution) => {
      contribution.updateCommand('act', { label: 'Act', callback: () => {} });
    });
    expect(app.resolve('act', child)!.getLabel()).toBe('Act');
  });

  it('forwards extra args to the contributor (declarative fn + args)', () => {
    const app = new CommandScope('app');
    const seen: unknown[] = [];
    const child = app.createChild(
      'feature',
      (contribution, label: string, n: number) => { seen.push(label, n); contribution.updateCommand('act', { label }); },
      'Hello', 42
    );
    expect(seen).toEqual(['Hello', 42]);
    expect(app.resolve('act', child)!.getLabel()).toBe('Hello');
  });

  it('dispose() invokes the contributor disposer AND clears the contributed commands', () => {
    const app = new CommandScope('app');
    const teardown = vi.fn();
    const child = app.createChild('feature', (contribution) => {
      contribution.updateCommand('act', { callback: () => {} });
      return teardown; // e.g. detach a model listener — the contributor's ONLY teardown duty
    });
    expect(child.getDefinition('act')).toBeDefined();

    child.dispose();
    expect(teardown).toHaveBeenCalledOnce();            // the contributor's external disposer fired
    expect(child.getDefinition('act')).toBeUndefined(); // commands cleared by dispose (no per-key removal)
    expect(app.getChild('feature')).toBeUndefined();    // detached
  });

  it('a contributor that returns nothing still tears down its commands on dispose', () => {
    const app = new CommandScope('app');
    const child = app.createChild('feature', (contribution) => {
      contribution.updateCommand('act', { callback: () => {} });
    });
    child.dispose();
    expect(child.getDefinition('act')).toBeUndefined();
  });
});

describe('CommandScope (dispatch + per-key observers)', () => {
  function tree() {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    return { app, sheet };
  }

  it('cmd.execute() runs the resolved callback (returns true) and ripples all observers', async () => {
    const { app, sheet } = tree();
    const cb = vi.fn();
    sheet.updateCommand('copy', { callback: cb });
    const toolbar = vi.fn();
    const contextMenu = vi.fn();
    app.addExecuteListener('copy', { onExecute: toolbar });
    app.addExecuteListener('copy', { onExecute: contextMenu });

    await expect(app.resolve('copy', sheet)!.execute()).resolves.toBe(true);
    expect(cb).toHaveBeenCalledOnce();
    expect(toolbar).toHaveBeenCalledOnce();      // dual ripple — both observers fire
    expect(contextMenu).toHaveBeenCalledOnce();
  });

  it('beforeExecute returning false cancels (callback + onExecute skipped)', async () => {
    const { app, sheet } = tree();
    const cb = vi.fn();
    const onExecute = vi.fn();
    sheet.updateCommand('copy', { callback: cb });
    app.addExecuteListener('copy', { beforeExecute: () => false, onExecute });
    await expect(app.resolve('copy', sheet)!.execute()).resolves.toBe(false);
    expect(cb).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('disabled command does not run or fire onExecute', async () => {
    const { app, sheet } = tree();
    const onExecute = vi.fn();
    sheet.updateCommand('copy', { callback: () => {}, disabledReasons: ['protected'] });
    app.addExecuteListener('copy', { onExecute });
    await expect(app.resolve('copy', sheet)!.execute()).resolves.toBe(false);
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('onError fires and the error rethrows', async () => {
    const { app, sheet } = tree();
    const boom = new Error('boom');
    const onError = vi.fn();
    sheet.updateCommand('copy', { callback: () => { throw boom; } });
    app.addExecuteListener('copy', { onError });
    await expect(app.resolve('copy', sheet)!.execute()).rejects.toBe(boom);
    expect(onError).toHaveBeenCalledWith(expect.anything(), boom, undefined);
  });

  it('live hooks: a listener added AFTER resolve still fires on cmd.execute', async () => {
    const { app, sheet } = tree();
    sheet.updateCommand('copy', { callback: () => {} });
    const cmd = app.resolve('copy', sheet)!; // resolved first
    const late = vi.fn();
    app.addExecuteListener('copy', { onExecute: late }); // subscribed after
    await cmd.execute();
    expect(late).toHaveBeenCalledOnce();
  });

  it('addListener.onChange fires on contribution and stops after removal', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const onChange = vi.fn();
    const remove = app.addListener({ onChange });
    sheet.updateCommand('copy', { callback: () => {} }); // bump → notify
    expect(onChange).toHaveBeenCalled();

    const before = onChange.mock.calls.length;
    remove();
    sheet.updateCommand('copy', { label: 'X' });
    expect(onChange.mock.calls.length).toBe(before); // no more after removal
  });
});

describe('CommandScope fan-out (leading + trailing per tick)', () => {
  it('notifies the first bump synchronously and coalesces the rest of the tick into one trailing notify', async () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const onChange = vi.fn();
    app.addListener({ onChange });
    const v0 = app.getVersion();

    sheet.updateCommand('copy', { label: 'A' });
    expect(onChange).toHaveBeenCalledTimes(1);   // leading edge, synchronous
    sheet.updateCommand('cut', { label: 'B' });
    sheet.updateCommand('paste', { label: 'C' });
    expect(onChange).toHaveBeenCalledTimes(1);   // same tick: held
    expect(app.getVersion()).toBe(v0 + 3);        // ...but the version is never stale
    expect(app.resolve('paste', sheet)!.getLabel()).toBe('C');

    await Promise.resolve();
    expect(onChange).toHaveBeenCalledTimes(2);   // one trailing notify for the burst

    sheet.updateCommand('copy', { label: 'D' });
    expect(onChange).toHaveBeenCalledTimes(3);   // a new tick leads again
  });

  it('sends no trailing notify for a lone bump', async () => {
    const app = new CommandScope('app');
    const onChange = vi.fn();
    app.addListener({ onChange });
    app.invalidate();
    await Promise.resolve();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('a throwing listener does not leave the window open', async () => {
    const app = new CommandScope('app');
    const remove = app.addListener({ onChange: () => { throw new Error('boom'); } });
    expect(() => app.invalidate()).toThrow('boom');
    remove();
    await Promise.resolve();
    const onChange = vi.fn();
    app.addListener({ onChange });
    app.invalidate();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('CommandScope.invalidate (trigger, not a contribution)', () => {
  it('bumps version + notifies and forces re-resolution, without changing values', async () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    sheet.updateCommand('copy', { label: 'Copy', callback: () => {} });
    await Promise.resolve(); // close the setup tick's fan-out window

    const onChange = vi.fn();
    app.addListener({ onChange });
    const before = app.resolve('copy', sheet);
    const v0 = app.getVersion();

    app.invalidate();

    expect(app.getVersion()).toBeGreaterThan(v0);  // bumped
    expect(onChange).toHaveBeenCalled();           // containers told to re-resolve
    const after = app.resolve('copy', sheet);
    expect(after).not.toBe(before);                // re-derived (fresh instance)
    expect(after!.getLabel()).toBe('Copy');        // value unchanged (no contribution)
  });
});

describe('CommandScope.dispose (feature/region teardown)', () => {
  it('detaches the scope from its parent and drops its contributions', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    app.updateCommand('copy', { label: 'Copy', icon: '📋' });   // chrome on app
    sheet.updateCommand('copy', { callback: () => {} });         // action on sheet

    expect(app.resolve('copy', sheet)!.disabled()).toBe(false);  // sheet supplies the callback
    const v0 = app.getVersion();

    sheet.dispose();

    expect(app.getChild('sheet')).toBeUndefined();               // detached from the tree
    expect(app.getVersion()).toBeGreaterThan(v0);                // resolvers told to re-resolve
    expect(sheet.getDefinition('copy')).toBeUndefined();         // its defs dropped
    // App-level resolution no longer sees the sheet's callback.
    expect(app.resolve('copy', app)!.disabled()).toBe(true);
  });

  it('a stale anchor on a disposed scope still resolves up the (detached) parent chain', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    app.updateCommand('copy', { label: 'Copy', callback: () => {} }); // app has a full command

    sheet.dispose(); // a resolver might still hold `sheet` as its anchor briefly

    const cmd = app.resolve('copy', sheet); // resolve from the disposed anchor
    expect(cmd).toBeDefined();
    expect(cmd!.getLabel()).toBe('Copy');   // walked up to app rather than throwing
  });

  it('recursively disposes children', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const editor = sheet.createChild('editor');
    editor.updateCommand('run', { callback: () => {} });

    sheet.dispose();

    expect(app.getChild('sheet')).toBeUndefined();
    expect(sheet.getChild('editor')).toBeUndefined();   // grandchild detached too
    expect(editor.getDefinition('run')).toBeUndefined(); // and emptied
  });

  it('is idempotent', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    sheet.dispose();
    expect(() => sheet.dispose()).not.toThrow();
    expect(app.getChild('sheet')).toBeUndefined();
  });
});

describe('CommandScope.use (dispatch middleware, bound to the authoring scope)', () => {
  it('auto-wraps callbacks the scope authors; the inner callback stays pure', async () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const order: string[] = [];
    sheet.use((next) => async (args, command) => {
      order.push(`begin:${command?.getLabel()}`);
      await next(args, command);
      order.push('commit');
    });
    sheet.updateCommand('bold', { label: 'Bold', callback: () => { order.push('work'); } }); // pure

    await app.resolve('bold', sheet)!.execute();
    expect(order).toEqual(['begin:Bold', 'work', 'commit']);
  });

  it('is NOT inherited — a child scope authoring its own callback runs raw', async () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const selection = sheet.createChild('selection');
    const seen: string[] = [];
    sheet.use((next) => async (a, c) => { seen.push('sheet-tx'); return next(a, c); });
    selection.updateCommand('clear', { label: 'Clear', callback: () => { seen.push('raw'); } });

    await app.resolve('clear', selection)!.execute(); // resolves selection→sheet→app
    expect(seen).toEqual(['raw']); // sheet's middleware did NOT wrap selection's callback
  });

  it('binds to the authoring scope even when resolved from a deeper anchor', async () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const selection = sheet.createChild('selection');
    const seen: string[] = [];
    sheet.use((next) => async (a, c) => { seen.push('tx'); return next(a, c); });
    sheet.updateCommand('bold', { label: 'Bold', callback: () => { seen.push('bold'); } });

    await app.resolve('bold', selection)!.execute(); // anchor=selection, callback authored by sheet
    expect(seen).toEqual(['tx', 'bold']);
  });

  it('first-registered middleware is outermost', async () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const order: string[] = [];
    sheet.use((next) => async (a, c) => { order.push('A>'); await next(a, c); order.push('<A'); });
    sheet.use((next) => async (a, c) => { order.push('B>'); await next(a, c); order.push('<B'); });
    sheet.updateCommand('x', { callback: () => { order.push('x'); } });

    await app.resolve('x', sheet)!.execute();
    expect(order).toEqual(['A>', 'B>', 'x', '<B', '<A']);
  });

  it('a child that overrides the callback uses the child\'s middleware (here: none)', async () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const selection = sheet.createChild('selection');
    const seen: string[] = [];
    sheet.use((next) => async (a, c) => { seen.push('sheet-tx'); return next(a, c); });
    sheet.updateCommand('act', { label: 'Act', callback: () => { seen.push('sheet-cb'); } });
    selection.updateCommand('act', { callback: () => { seen.push('sel-cb'); } }); // overrides callback

    await app.resolve('act', selection)!.execute();
    expect(seen).toEqual(['sel-cb']); // selection's callback wins → selection's (no) middleware
  });
});

describe('CommandScope contributions sharing a key', () => {
  it('removing one contribution keeps what another wrote for the same key', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const plugin = sheet.contribution();
    const protection = sheet.contribution();
    const callback = vi.fn();
    plugin.updateCommand('insertThing', { callback });
    protection.updateCommand('insertThing', { disabledReasons: [] });

    // The protection pass re-runs: its contribution is torn down and made again.
    protection.remove();
    expect(app.resolve('insertThing', sheet)!.disabled()).toBe(false);
    const again = sheet.contribution();
    again.updateCommand('insertThing', { disabledReasons: ['reason.locked'] });
    expect(app.resolve('insertThing', sheet)!.disabledReasons()).toEqual(['reason.locked']);

    again.remove();
    expect(app.resolve('insertThing', sheet)!.disabledReasons()).toEqual([]);
    expect(sheet.getDefinition('insertThing')!.callback).toBe(callback);

    plugin.remove();
    expect(sheet.getDefinition('insertThing')).toBeFalsy();
  });

  it('rebuilds a shared key with the most recent writer\'s fields winning', () => {
    const scope = new CommandScope('app');
    const first = scope.contribution();
    const second = scope.contribution();
    const third = scope.contribution();
    first.updateCommand('k', { label: 'first', icon: 'firstIcon' });
    second.updateCommand('k', { label: 'second' });
    third.updateCommand('k', { label: 'third' });
    first.updateCommand('k', { icon: 'firstIcon2' });

    third.remove();
    const def = scope.getDefinition('k')!;
    expect(def.label).toBe('second');
    expect(def.icon).toBe('firstIcon2');
  });
});
