import { describe, it, expect } from 'vitest';

import { CommandScope } from '../../command/CommandScope';
import { LayerActivation } from '../../command/LayerActivation';

/**
 * The **mechanism a chain-aware `CommandScopeProvider` relies on** (item 5 / #5, design/COMMAND-DESIGN.md
 * §"Layered resolver"): a declarative layer spec creates its scope off the pane **base** (the ambient scope)
 * and JOINS the pane's {@link LayerActivation} chain at its `order` (z). The unchanged
 * {@link CommandScope.resolve} then walks the resulting parent chain top→down. This is the class-level twin
 * of `<CommandScopeProvider spec order={z}/>`; the React wiring on top is typecheck-verified (the provider's
 * effect calls exactly `chain.register(scope, order)` then `scope.dispose()`).
 */
describe('CommandChain — declarative layer join (create-off-base + register-at-order)', () => {
  it('joins at order, resolves top→down, and reparents on a middle insert', () => {
    const app = new CommandScope('app');
    const paneBase = app.createChild('pane:center');
    paneBase.updateCommand('copy', { label: 'Copy Cells', callback: () => {} });
    const chain = new LayerActivation(paneBase);
    const top = (): CommandScope => chain.getAnchor();

    // What CommandScopeProvider does per layer: createChild off the ambient (base), then chain.register(scope, z).
    const selection = paneBase.createChild({ key: 'layer:selection', name: 'selection' });
    selection.updateCommand('fill', { label: 'Fill', callback: () => {} });
    const rmSel = chain.register(selection, 10);

    expect(app.resolve('fill', top())?.getLabel()).toBe('Fill');
    expect(app.resolve('copy', top())?.getLabel()).toBe('Copy Cells'); // falls through to the base

    // The editor joins ABOVE selection and overrides copy by stacking (no focus change).
    const editor = paneBase.createChild({ key: 'layer:editor', name: 'editor' });
    editor.updateCommand('copy', { label: 'Copy Text', callback: () => {} });
    const rmEd = chain.register(editor, 100);
    expect(app.resolve('copy', top())?.getLabel()).toBe('Copy Text'); // editor wins
    expect(app.resolve('fill', top())?.getLabel()).toBe('Fill');      // fill still falls through to selection

    // REPARENT-ON-INSERT: a movable mounts BETWEEN selection(10) and editor(100).
    const movable = paneBase.createChild({ key: 'layer:movable', name: 'movable' });
    movable.updateCommand('fill', { label: 'Fill Movable', callback: () => {} });
    const rmMov = chain.register(movable, 50);
    expect(app.resolve('fill', top())?.getLabel()).toBe('Fill Movable'); // movable(50) now over selection(10)
    expect(app.resolve('copy', top())?.getLabel()).toBe('Copy Text');    // editor(100) still tops copy

    // The editor unmounts → copy falls back to the base; the rest of the stack re-chains.
    rmEd();
    expect(app.resolve('copy', top())?.getLabel()).toBe('Copy Cells');
    expect(app.resolve('fill', top())?.getLabel()).toBe('Fill Movable');

    rmMov();
    expect(app.resolve('fill', top())?.getLabel()).toBe('Fill'); // back to selection
    rmSel();
    expect(app.resolve('fill', top())).toBeUndefined(); // no layer contributes fill; base has none
  });

  it('a scope that joined the chain is disposed after unregister (provider teardown order)', () => {
    const app = new CommandScope('app');
    const paneBase = app.createChild('pane:center');
    const chain = new LayerActivation(paneBase);

    const layer = paneBase.createChild({ key: 'layer:selection', name: 'selection' });
    layer.updateCommand('fill', { label: 'Fill', callback: () => {} });
    const unregister = chain.register(layer, 10);
    expect(app.resolve('fill', chain.getAnchor())?.getLabel()).toBe('Fill');

    // The provider's cleanup is `unregister()` then `scope.dispose()` — the stack re-chains, then teardown.
    unregister();
    layer.dispose();
    expect(chain.getAnchor()).toBe(paneBase);                 // stack empty → top is the base
    expect(app.resolve('fill', chain.getAnchor())).toBeUndefined();
  });
});
