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

/**
 * Attach higher: a layer chains on a named ancestor of the base instead of the layer below, so the
 * layers below and the scopes between drop out of its resolution; layers above still stack on it.
 */
describe('LayerActivation.setAttach (attach higher)', () => {
  const setup = () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    sheet.updateCommand('zoom', { label: 'Zoom', callback: () => {} });
    const cells = sheet.createChild('cells');
    cells.updateCommand('bold', { label: 'Bold', callback: () => {} });
    const base = cells.createChild('pane:c');
    const layers = new LayerActivation(base);
    const selection = base.createChild({ key: 'layer:selection', name: 'selection' });
    selection.updateCommand('copy', { label: 'Copy Cells', callback: () => {} });
    layers.register(selection, 10);
    const movable = base.createChild({ key: 'layer:movable', name: 'movable' });
    movable.updateCommand('group', { label: 'Group', callback: () => {} });
    layers.register(movable, 50);
    const kind = base.createChild({ key: 'layer:movable:chart', name: 'chart' });
    kind.updateCommand('chartType', { label: 'Chart Type', callback: () => {} });
    layers.register(kind, 50.5);
    const resolve = (key: string): string | undefined => app.resolve(key, layers.getAnchor())?.getLabel();
    return { app, sheet, cells, base, layers, selection, movable, kind, resolve };
  };

  it('skips the layers below and the scopes between, keeping the ancestor and the layers above', () => {
    const { sheet, layers, movable, kind, resolve } = setup();
    layers.setAttach(movable, 'sheet');
    expect(movable.getParent()).toBe(sheet);
    expect(layers.getAnchor()).toBe(kind);
    expect(resolve('copy')).toBeUndefined();   // the selection layer below
    expect(resolve('bold')).toBeUndefined();   // cells, between the base and sheet
    expect(resolve('zoom')).toBe('Zoom');      // the ancestor still resolves
    expect(resolve('group')).toBe('Group');
    expect(resolve('chartType')).toBe('Chart Type'); // the layer above still stacks on it
  });

  it('null restores the ordinary place, and both switches notify', () => {
    const { selection, layers, movable, resolve } = setup();
    let bumps = 0;
    layers.subscribe(() => { bumps++; });
    layers.setAttach(movable, 'sheet');
    layers.setAttach(movable, 'sheet'); // unchanged: no re-chain
    expect(bumps).toBe(1);
    layers.setAttach(movable, null);
    expect(bumps).toBe(2);
    expect(movable.getParent()).toBe(selection);
    expect(resolve('copy')).toBe('Copy Cells');
    expect(resolve('bold')).toBe('Bold');
  });

  it('keeps the attachment across a re-chain from a layer joining or leaving', () => {
    const { base, sheet, layers, movable, resolve } = setup();
    layers.setAttach(movable, 'sheet');
    const clipboard = base.createChild({ key: 'layer:clipboard', name: 'clipboard' });
    clipboard.updateCommand('paste', { label: 'Paste Cells', callback: () => {} });
    const remove = layers.register(clipboard, 20); // below the movable
    expect(movable.getParent()).toBe(sheet);
    expect(resolve('paste')).toBeUndefined();
    remove();
    expect(movable.getParent()).toBe(sheet);
  });

  it('chains as usual when no ancestor has the name', () => {
    const { selection, layers, movable, resolve } = setup();
    layers.setAttach(movable, 'nowhere');
    expect(movable.getParent()).toBe(selection);
    expect(resolve('copy')).toBe('Copy Cells');
  });

  it('two panes attaching the same key to one ancestor do not evict each other', () => {
    const { sheet, cells, layers, movable } = setup();
    const otherBase = cells.createChild('pane:tl');
    const otherLayers = new LayerActivation(otherBase);
    const otherMovable = otherBase.createChild({ key: 'layer:movable', name: 'movable' });
    otherLayers.register(otherMovable, 50);
    layers.setAttach(movable, 'sheet');
    otherLayers.setAttach(otherMovable, 'sheet');
    layers.setAttach(movable, null);           // leaving must not drop the other pane's entry
    expect(sheet.getChild('layer:movable')).toBe(otherMovable);
    otherLayers.setAttach(otherMovable, null);
    expect(sheet.getChild('layer:movable')).toBeUndefined();
  });
});
