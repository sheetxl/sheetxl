import { describe, it, expect } from 'vitest';

import { CommandScope } from '../../command/CommandScope';
import { LayerActivation } from '../../command/LayerActivation';

/**
 * `LayerActivation` — the z-ordered layer→scope registry. Anchor = the stack top; higher z wins by
 * stacking; unregister restores what was below.
 */
describe('LayerActivation (z-ordered layer chain)', () => {
  const setup = () => {
    const root = new CommandScope('app');
    root.updateCommand('copy', { label: 'Copy' }); // chrome
    const base = root.createChild('grid');
    base.updateCommand('copy', { label: 'Copy Cells', callback: () => {} });
    return { root, base, layers: new LayerActivation(base) };
  };
  const label = (root: CommandScope, anchor: CommandScope): string | undefined => root.resolve('copy', anchor)?.getLabel();

  it('anchors at the base when no layers are registered', () => {
    const { root, base, layers } = setup();
    expect(layers.getAnchor()).toBe(base);
    expect(label(root, layers.getAnchor())).toBe('Copy Cells');
  });

  it('a registered layer becomes the anchor and overrides by stacking', () => {
    const { root, layers } = setup();
    const editor = root.createChild('editor');
    editor.updateCommand('copy', { label: 'Copy Text', callback: () => {} });
    layers.register(editor, 100);
    expect(layers.getAnchor()).toBe(editor);
    expect(label(root, layers.getAnchor())).toBe('Copy Text'); // top-of-stack wins
  });

  it('orders by z (higher wins) and a layer need not override every command', () => {
    const { root, layers } = setup();
    const low = root.createChild('low');    // z=10, no copy override (chrome-only)
    low.updateCommand('copy', { label: 'low copy' });
    const high = root.createChild('high');  // z=100, overrides
    high.updateCommand('copy', { label: 'Copy High', callback: () => {} });
    layers.register(high, 100);
    layers.register(low, 10);
    expect(layers.getAnchor()).toBe(high);            // highest z is the top
    expect(label(root, layers.getAnchor())).toBe('Copy High');
  });

  it('unregister restores the layer/base below and notifies', () => {
    const { root, base, layers } = setup();
    let bumps = 0;
    layers.subscribe(() => { bumps++; });
    const editor = root.createChild('editor');
    editor.updateCommand('copy', { label: 'Copy Text', callback: () => {} });
    const remove = layers.register(editor, 100);
    expect(label(root, layers.getAnchor())).toBe('Copy Text');
    expect(bumps).toBe(1);

    remove();
    expect(layers.getAnchor()).toBe(base);
    expect(label(root, layers.getAnchor())).toBe('Copy Cells');
    expect(bumps).toBe(2);
  });
});
