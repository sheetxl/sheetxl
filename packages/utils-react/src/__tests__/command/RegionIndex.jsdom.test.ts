import { describe, it, expect } from 'vitest';

import { CommandScope } from '../../command/CommandScope';
import { LayerActivation } from '../../command/LayerActivation';
import { FocusActivation } from '../../command/FocusActivation';

/**
 * **Pull-model discovery on the tree** — a region names its element → its region **once** via
 * {@link CommandScope.attachElement} (the map lives on the tree root, not a parallel `RegionRegistry`), and
 * each consumer's {@link FocusActivation} — constructed over that same root — reads it on the focus walk,
 * bounded by its own attach root. No `register` into the tracker.
 */
describe('CommandScope region index + FocusActivation (tree-based discovery)', () => {
  it('a consumer reads the tree region index; focus picks the region, z picks the layer', () => {
    const root = new CommandScope('app');
    root.updateCommand('copy', { label: 'Copy' });
    const gridBase = root.createChild('grid');
    gridBase.updateCommand('copy', { label: 'Copy Cells', callback: () => {} });
    const scriptBase = root.createChild('script');
    scriptBase.updateCommand('copy', { label: 'Copy Script', callback: () => {} });

    const gridRegion = new LayerActivation(gridBase);
    const scriptRegion = new LayerActivation(scriptBase);

    const rootEl = document.createElement('div');
    const gridEl = document.createElement('div'); gridEl.tabIndex = 0;
    const scriptEl = document.createElement('div'); scriptEl.tabIndex = 0;
    rootEl.append(gridEl, scriptEl);
    document.body.append(rootEl);

    // Regions name their element ONCE on the tree (not into any tracker) — a live LayerActivation source.
    const rmGrid = gridBase.attachElement(gridEl, gridRegion);
    const rmScript = scriptBase.attachElement(scriptEl, scriptRegion);

    // The consumer OWNS its tracker over the shared tree, initial anchor = grid, bounded to rootEl.
    const region = new FocusActivation(root, gridRegion);
    region.attach(rootEl);

    const label = (): string | undefined => root.resolve('copy', region.getAnchor() ?? undefined)?.getLabel();

    expect(label()).toBe('Copy Cells'); // initial anchor (cold start)

    // z: stack an editor layer in the grid → overrides by stacking (no focus change).
    const editor = root.createChild('g-editor');
    editor.updateCommand('copy', { label: 'Copy Text', callback: () => {} });
    const removeEditor = gridRegion.register(editor, 100);
    expect(label()).toBe('Copy Text');

    // focus: move into the script region → the consumer follows via the tree index.
    scriptEl.focus();
    scriptEl.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(label()).toBe('Copy Script');

    // focus back to the grid → its stack (editor still on top) resolves.
    gridEl.focus();
    gridEl.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(label()).toBe('Copy Text');

    removeEditor();
    expect(label()).toBe('Copy Cells');

    rmGrid(); rmScript();
    rootEl.remove();
  });

  it('bounds the walk to the attach root; removal deletes the entry', () => {
    const root = new CommandScope('app');
    const grid = root.createChild('grid');

    const rootEl = document.createElement('div');
    const gridEl = document.createElement('div');
    const inner = document.createElement('div'); // chrome with no region of its own
    rootEl.append(gridEl);
    gridEl.append(inner);
    const outside = document.createElement('div');
    document.body.append(rootEl, outside);

    const remove = grid.attachElement(gridEl); // bare scope → fixed source (itself)
    const region = new FocusActivation(root);
    region.attach(rootEl);

    expect(region.findScope(inner)).toBe(grid);   // walks up to the region
    expect(region.findScope(outside)).toBeUndefined();          // outside the attach root
    remove();
    expect(region.findScope(gridEl)).toBeUndefined();           // entry removed on cleanup

    // The tree's unbounded lookup finds the same leaf while attached, and nothing after removal.
    grid.attachElement(gridEl);
    expect(root.findScope(inner)).toBe(grid);

    rootEl.remove();
    outside.remove();
  });

  it('two consumers over one tree differ only by attach root (both see a shared region)', () => {
    const root = new CommandScope('app');
    const grid = root.createChild('grid');

    // studio contains the grid; a nested "scripting" root bounds a second consumer to a subtree.
    const studioEl = document.createElement('div');
    const gridEl = document.createElement('div'); gridEl.tabIndex = 0;
    studioEl.append(gridEl);
    document.body.append(studioEl);
    grid.attachElement(gridEl);

    const studio = new FocusActivation(root);
    studio.attach(studioEl);
    const scripting = new FocusActivation(root);
    scripting.attach(gridEl); // bounded to the grid subtree only

    // Both walks reach the grid region for a node inside it.
    expect(studio.findScope(gridEl)).toBe(grid);
    expect(scripting.findScope(gridEl)).toBe(grid);
    // A node in the studio but outside the scripting root: studio finds nothing (no region above the grid),
    // scripting is out of bounds.
    expect(studio.findScope(studioEl)).toBeUndefined();
    expect(scripting.findScope(studioEl)).toBeUndefined();

    studioEl.remove();
  });
  it('attachBounds names the region WITHOUT naming a focus leaf (the two halves of an attach)', () => {
    // The two jobs an element does for a scope, separated: `attachBounds` = origin containment only
    // (which keystrokes may reach this scope commands); `attachElement` = that PLUS a focus leaf in the
    // tree index. The sheet scope wants the first — it owns the grid commands, but focus inside the grid
    // must anchor at the pane z-stack one level deeper. `CommandScopeProvider` maps `elementRef` to the
    // former and `elementRef region` to the latter.
    const root = new CommandScope('app');
    const sheet = root.createChild('sheet');
    const pane = sheet.createChild('pane');

    const sheetEl = document.createElement('div');
    const paneEl = document.createElement('div'); paneEl.tabIndex = 0;
    const outside = document.createElement('input'); // a task pane, outside the sheet
    sheetEl.append(paneEl);
    document.body.append(sheetEl, outside);

    const rmBounds = sheet.attachBounds(sheetEl);
    const rmRegion = pane.attachElement(paneEl);

    // Containment: identical for both — a key born in the pane is inside the sheet too.
    expect(sheet.contains(paneEl)).toBe(true);
    expect(sheet.contains(outside)).toBe(false);
    // The region index: only the `attachElement` one is a focus leaf, so a focus in the grid resolves
    // to the pane, never to the sheet above it.
    expect(root.getRegion(sheetEl)).toBeUndefined();
    expect(root.getRegion(paneEl)).toBeDefined();
    expect(root.findScope(paneEl)).toBe(pane);
    expect(root.findScope(sheetEl)).toBeUndefined();

    // Removal restores the unrestricted (element-less) default.
    rmBounds();
    expect(sheet.contains(outside)).toBe(true);

    rmRegion();
    sheetEl.remove();
    outside.remove();
  });
  it('a region spans SEVERAL containers — chrome rendered outside it can join', () => {
    // A region is a set of containers, not one subtree. A host may render a scope's chrome (a formula
    // bar, a status bar, a custom toolbar with a search box) outside the element the scope bound
    // itself to, and a keystroke born in that chrome must still reach the scope's commands. The pieces
    // are declared from wherever they render (`useCommandElement`), not by the scope's owner.
    const root = new CommandScope('app');
    const workbook = root.createChild('workbook');

    const workbookEl = document.createElement('div');   // grid + sheet tabs
    const statusBarEl = document.createElement('div');  // host chrome, a sibling
    const taskPaneEl = document.createElement('input'); // NOT part of the region
    document.body.append(workbookEl, statusBarEl, taskPaneEl);

    const rmMain = workbook.attachBounds(workbookEl);
    expect(workbook.contains(statusBarEl)).toBe(false);  // bounded ⇒ the sibling is out...

    const rmChrome = workbook.attachBounds(statusBarEl); // ...until the host says otherwise
    expect(workbook.contains(workbookEl)).toBe(true);
    expect(workbook.contains(statusBarEl)).toBe(true);
    expect(workbook.contains(taskPaneEl)).toBe(false);   // opt-IN: everything else stays out

    // Each piece detaches independently.
    rmChrome();
    expect(workbook.contains(statusBarEl)).toBe(false);
    expect(workbook.contains(workbookEl)).toBe(true);

    rmMain();
    workbookEl.remove(); statusBarEl.remove(); taskPaneEl.remove();
  });
});
