import { describe, it, expect, vi } from 'vitest';

import { KeyModifiers, type IKeyStroke } from '../../types';

import { CommandScope } from '../../command/CommandScope';
import { FocusActivation } from '../../command/FocusActivation';
import { ManualActivation } from '../../command/ActivationTracker';
import { CommandResolver } from '../../command/CommandResolver';

const ctrlS: IKeyStroke = { key: 'S', modifiers: [KeyModifiers.Ctrl] };

function ctrlSDown(): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, bubbles: true, cancelable: true });
}

/** Keybinds are baked into the resolver, bound to the tracker's region — no separate provider. */
describe('CommandResolver — keybinds in lockstep with the tracker region', () => {
  it('auto-binds keystroke handling to a FocusActivation region', () => {
    const app = new CommandScope('app');
    const cb = vi.fn();
    app.updateCommand('save', { callback: cb, shortcut: ctrlS });

    const root = document.createElement('div');
    document.body.appendChild(root);
    const focus = new FocusActivation();
    focus.register(root, app);
    focus.attach(root);

    const resolver = new CommandResolver(app, focus);
    resolver.connect();
    root.dispatchEvent(ctrlSDown());
    expect(cb).toHaveBeenCalledOnce();

    resolver.dispose();
    root.remove();
  });

  it('binds even when the region attaches AFTER the resolver is created (late attach)', () => {
    const app = new CommandScope('app');
    const cb = vi.fn();
    app.updateCommand('save', { callback: cb, shortcut: ctrlS });

    const root = document.createElement('div');
    document.body.appendChild(root);
    const focus = new FocusActivation();
    focus.register(root, app);

    const resolver = new CommandResolver(app, focus); // region not attached yet
    resolver.connect();                               // subscribe; nothing to bind yet (region null)
    focus.attach(root);                               // notifies → resolver binds now

    root.dispatchEvent(ctrlSDown());
    expect(cb).toHaveBeenCalledOnce();

    resolver.dispose();
    root.remove();
  });

  it('a ManualActivation resolver wires NO keybinds (no region — the natural opt-out)', () => {
    const app = new CommandScope('app');
    const cb = vi.fn();
    app.updateCommand('save', { callback: cb, shortcut: ctrlS });

    const root = document.createElement('div');
    document.body.appendChild(root);
    const resolver = new CommandResolver(app, new ManualActivation(app));
    resolver.connect();

    root.dispatchEvent(ctrlSDown());
    expect(cb).not.toHaveBeenCalled();

    resolver.dispose();
    root.remove();
  });

  it('dispose unbinds keystroke handling', () => {
    const app = new CommandScope('app');
    const cb = vi.fn();
    app.updateCommand('save', { callback: cb, shortcut: ctrlS });

    const root = document.createElement('div');
    document.body.appendChild(root);
    const focus = new FocusActivation();
    focus.register(root, app);
    focus.attach(root);

    const resolver = new CommandResolver(app, focus);
    resolver.connect();
    resolver.dispose();

    root.dispatchEvent(ctrlSDown());
    expect(cb).not.toHaveBeenCalled();

    root.remove();
  });
});
