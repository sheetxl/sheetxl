import { describe, it, expect } from 'vitest';

import { CommandScope } from '../../command/CommandScope';
import { LayerActivation } from '../../command/LayerActivation';
import { FocusActivation } from '../../command/FocusActivation';

/**
 * **Focus × z composition** on the real core primitives ({@link FocusActivation} over
 * {@link LayerActivation}): focus picks the region, z picks the layer within it, and a bare-scope region
 * resolves as a fixed source. A `LayerActivation` source is read live via `getAnchor()`.
 */
describe('focus × z composition (FocusActivation over LayerActivation)', () => {
  it('focus picks the region, z picks the layer — one toolbar resolve', () => {
    const root = new CommandScope('app');
    root.updateCommand('copy', { label: 'Copy' });   // shared chrome
    root.updateCommand('run', { label: 'Run' });      // chrome only (script provides behavior)

    const gridBase = root.createChild('grid');
    gridBase.updateCommand('copy', { label: 'Copy Cells', callback: () => {} });
    const scriptBase = root.createChild('script');
    scriptBase.updateCommand('copy', { label: 'Copy Script', callback: () => {} });
    scriptBase.updateCommand('run', { label: 'Run Script', callback: () => {} });

    const gridRegion = new LayerActivation(gridBase);
    const scriptRegion = new LayerActivation(scriptBase);
    const region = new FocusActivation(null, gridRegion); // initial anchor: the grid region

    // DOM: root contains two focusable region elements.
    const rootEl = document.createElement('div');
    const gridEl = document.createElement('div'); gridEl.tabIndex = 0;
    const scriptEl = document.createElement('div'); scriptEl.tabIndex = 0;
    rootEl.append(gridEl, scriptEl);
    document.body.append(rootEl);
    region.attach(rootEl);
    region.register(gridEl, gridRegion);
    region.register(scriptEl, scriptRegion);

    const label = (key: string): string | undefined => root.resolve(key, region.getAnchor() ?? undefined)?.getLabel();
    const enabled = (key: string): boolean => { const c = root.resolve(key, region.getAnchor() ?? undefined); return !!c && !c.disabled(); };

    // Cold start → default region (grid).
    expect(label('copy')).toBe('Copy Cells');
    expect(enabled('run')).toBe(false);

    // z: stack an editor layer in the grid → copy overrides by stacking (no focus change).
    const editor = root.createChild('g-editor');
    editor.updateCommand('copy', { label: 'Copy Text', callback: () => {} });
    const removeEditor = gridRegion.register(editor, 100);
    expect(label('copy')).toBe('Copy Text');

    // focus: move into the script region → the toolbar follows (focus picks the region).
    scriptEl.focus();
    expect(label('copy')).toBe('Copy Script');
    expect(enabled('run')).toBe(true);

    // z within the script region → run overrides.
    const debug = root.createChild('s-debug');
    debug.updateCommand('run', { label: 'Run Debug', callback: () => {} });
    scriptRegion.register(debug, 100);
    expect(label('run')).toBe('Run Debug');

    // focus back to the grid → its stack (editor still on top) resolves; run gone again.
    gridEl.focus();
    expect(label('copy')).toBe('Copy Text');
    expect(enabled('run')).toBe(false);

    // unstack the grid editor → base takes back over.
    removeEditor();
    expect(label('copy')).toBe('Copy Cells');
  });

  it('registers a bare-scope region (ConstantActivation auto-wrap)', () => {
    const root = new CommandScope('app');
    root.updateCommand('copy', { label: 'Copy' });
    const gridBase = root.createChild('grid');
    gridBase.updateCommand('copy', { label: 'Copy Cells', callback: () => {} });
    const dialog = root.createChild('dialog'); // a plain static region, no layers
    dialog.updateCommand('copy', { label: 'Copy Field', callback: () => {} });

    const region = new FocusActivation(null, gridBase);  // initial anchor as a bare scope

    const rootEl = document.createElement('div');
    const gridEl = document.createElement('div'); gridEl.tabIndex = 0;
    const dialogEl = document.createElement('div'); dialogEl.tabIndex = 0;
    rootEl.append(gridEl, dialogEl);
    document.body.append(rootEl);
    region.attach(rootEl);
    region.register(gridEl, gridBase);      // bare scope
    region.register(dialogEl, dialog);      // bare scope

    const label = (): string | undefined => root.resolve('copy', region.getAnchor() ?? undefined)?.getLabel();

    expect(label()).toBe('Copy Cells');     // seed
    dialogEl.focus();
    expect(label()).toBe('Copy Field');     // focus picks the static region
    gridEl.focus();
    expect(label()).toBe('Copy Cells');
  });
});
