import { describe, it, expect, vi } from 'vitest';

import { CommandScope } from '../../command/CommandScope';
import { CommandRegistry } from '../../command/CommandRegistry';

describe('CommandRegistry (flat named prototype + catalog vs resolution faces)', () => {
  it('prototype consult: registry[name] merges beneath a node\'s own def (chrome + behavior)', () => {
    const registry = new CommandRegistry();
    registry.register('app', 'undo', { label: 'Undo', icon: 'undoIcon', shortcut: { key: 'z' } as any });
    const app = new CommandScope('app', null, { registry });
    const cb = vi.fn();
    app.updateCommand('undo', { callback: cb }); // model-closured behavior on the instance

    const cmd = app.resolve('undo', app)!;
    expect(cmd.getLabel()).toBe('Undo');   // from registry prototype
    expect(cmd.getIcon()).toBe('undoIcon');
    expect(cmd.disabled()).toBe(false);    // callback from the instance
  });

  it('instance def OVERRIDES the registry prototype (proto is least-specific)', () => {
    const registry = new CommandRegistry();
    registry.register('sheet', 'bold', { label: 'Bold (default)' });
    const app = new CommandScope('app', null, { registry });
    const sheet = app.createChild('sheet');
    sheet.updateCommand('bold', { label: 'Bold (sheet)', callback: () => {} });

    expect(app.resolve('bold', sheet)!.getLabel()).toBe('Bold (sheet)');
  });

  it('name != key: a child resolves against registry[name], not registry[key]', () => {
    const registry = new CommandRegistry();
    registry.register('selection', 'moveDown', { label: 'Move Down', shortcut: { key: 'ArrowDown' } as any });
    const app = new CommandScope('app', null, { registry });
    // Tree key keeps the layer convention; registry NAME is 'selection'.
    const layer = app.createChild({ key: 'layer:selection', name: 'selection' });
    layer.updateCommand('moveDown', { callback: () => {} });

    const cmd = app.resolve('moveDown', layer)!;
    expect(cmd.getLabel()).toBe('Move Down'); // consulted registry['selection'] via the node's name
    expect(cmd.disabled()).toBe(false);
    expect(app.collectKeys(layer)).toContain('moveDown');
  });

  it('registry update bumps the shared resolve version (cache invalidates)', () => {
    const registry = new CommandRegistry();
    const app = new CommandScope('app', null, { registry });
    app.updateCommand('save', { callback: () => {} });
    expect(app.resolve('save', app)!.getLabel()).toBeUndefined();

    registry.register('app', 'save', { label: 'Save' });
    expect(app.resolve('save', app)!.getLabel()).toBe('Save'); // re-resolved, not a stale cache hit
  });

  it('static only if dynamic first: a static-only command stays in the catalog but does NOT resolve', () => {
    const registry = new CommandRegistry();
    // The editor pattern: static chrome (F4) registered at startup; behavior is dynamic + session-gated.
    registry.register('editor', 'relativeReferencesToggle', { label: 'Toggle References', shortcut: { key: 'F4' } as any });
    const app = new CommandScope('app', null, { registry });
    const editor = app.createChild('editor');

    // Idle (no dynamic contribution) ⇒ static is not pulled ⇒ does not resolve, so F4 is free for redo.
    expect(app.resolve('relativeReferencesToggle', editor)).toBeUndefined();
    // …but it stays enumerable in the registry (the catalog / shortcut dialog reads this directly).
    expect(registry.keys('editor')).toContain('relativeReferencesToggle');
    expect(registry.resolveDefinition('editor', 'relativeReferencesToggle')!.label).toBe('Toggle References');
    expect(registry.names()).toContain('editor');

    // The editor starts contributing dynamically (edit session opens) ⇒ now the static folds in.
    editor.updateCommand('relativeReferencesToggle', { callback: () => {} });
    const cmd = app.resolve('relativeReferencesToggle', editor)!;
    expect(cmd.getLabel()).toBe('Toggle References'); // static default
    expect(cmd.getShortcut()).toEqual({ key: 'F4' }); // static default
    expect(cmd.disabled()).toBe(false);               // dynamic behavior
  });

  it('static-only does not shadow another command sharing the shortcut (F4 → redo when idle)', () => {
    const registry = new CommandRegistry();
    registry.register('editor', 'relativeReferencesToggle', { label: 'Toggle References', shortcut: { key: 'F4' } as any });
    registry.register('app', 'redo', { label: 'Redo', shortcut: { key: 'F4' } as any });
    const app = new CommandScope('app', null, { registry });
    const editor = app.createChild('editor');
    app.updateCommand('redo', { callback: () => {} }); // redo has a live dynamic contribution

    // relativeReferencesToggle: static only → does not resolve; redo: has dynamic → resolves with F4.
    expect(app.resolve('relativeReferencesToggle', editor)).toBeUndefined();
    expect(app.resolve('redo', editor)!.getShortcut()).toEqual({ key: 'F4' });
  });

  it('contributor identity: same contributor REPLACES (idempotent re-seed, no tag double-accumulate)', () => {
    const registry = new CommandRegistry();
    const seed = (): void => registry.register('sheet', 'bold', { tags: ['mutator'] }, 'sheetCatalog');
    seed(); seed(); seed(); // StrictMode-style re-seed

    expect(registry.resolveDefinition('sheet', 'bold')!.tags).toEqual(['mutator']); // not ['mutator','mutator',…]
    expect(registry.collectKeysByTag('sheet', 'mutator')).toEqual(['bold']);
  });

  it('findByKey: searches prefer names in order, then all names', () => {
    const registry = new CommandRegistry();
    registry.register('sheet', 'find', { label: 'Find (sheet)' });
    registry.register('workbook', 'find', { label: 'Find (workbook)' });
    registry.register('chart', 'chartOnly', { label: 'Chart Only' });

    expect(registry.findByKey('find', ['workbook', 'sheet'])!.name).toBe('workbook'); // prefer wins
    expect(registry.findByKey('find', ['sheet'])!.name).toBe('sheet');
    expect(registry.findByKey('chartOnly', ['sheet', 'workbook'])!.name).toBe('chart'); // prefer miss → all
    expect(registry.findByKey('nope')).toBeUndefined();
  });

  it('resolveStatic (the not-in-context fallback) renders a static-only command DISABLED, bypassing the dynamic gate', () => {
    const registry = new CommandRegistry();
    registry.register('table', 'tableStyle', { label: 'Table Style', icon: 'tableIcon' });
    const app = new CommandScope('app', null, { registry });

    // No table active ⇒ no dynamic ⇒ context resolve is undefined…
    expect(app.resolve('tableStyle', app)).toBeUndefined();
    // …but the consumer fallback still produces a (disabled) command from the static.
    const cmd = app.resolveStatic('tableStyle', ['table'])!;
    expect(cmd.getLabel()).toBe('Table Style');
    expect(cmd.getIcon()).toBe('tableIcon');
    expect(cmd.disabled()).toBe(true); // no callback ⇒ disabled
  });

  it('resolveStatic: a static that carries a (global) callback is executable, not merely display', () => {
    const registry = new CommandRegistry();
    const cb = vi.fn();
    registry.register('app', 'globalThing', { label: 'Global', callback: cb });
    const app = new CommandScope('app', null, { registry });

    const cmd = app.resolveStatic('globalThing')!; // no prefer → search all
    expect(cmd.disabled()).toBe(false); // static callback ⇒ executable
    void cmd.execute();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('batch(): a bulk change fires ONE listener fan-out; the version still bumps per change', () => {
    const registry = new CommandRegistry();
    const onChange = vi.fn();
    registry.addListener({ onChange });
    const v0 = registry.getVersion();

    registry.batch(() => {
      registry.register('sheet', 'bold', { label: 'Bold' });
      registry.register('sheet', 'italic', { label: 'Italic' });
      registry.register('sheet', 'underline', { label: 'Underline' });
      // Synchronous readers inside the batch are never stale — the version is not deferred.
      expect(registry.getVersion()).toBeGreaterThan(v0);
      expect(onChange).not.toHaveBeenCalled(); // …but the fan-out is suspended
    });

    expect(onChange).toHaveBeenCalledTimes(1); // one coalesced notify at close
  });

  it('registerStatic seeds a K-command contributor with a single notify (the load-time seed path)', () => {
    const registry = new CommandRegistry();
    const onChange = vi.fn();
    registry.addListener({ onChange });

    registry.registerStatic('sheet', (target) => {
      target.updateCommand('bold', { label: 'Bold' });
      target.updateCommand('italic', { label: 'Italic' });
      target.updateCommand('underline', { label: 'Underline' });
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(registry.keys('sheet').sort()).toEqual(['bold', 'italic', 'underline']);
  });

  it('a contribution\'s remove() tears down all its keys with a single notify', () => {
    const registry = new CommandRegistry();
    const contribution = registry.contribution('sheet', 'test');
    contribution.updateCommand('bold', { label: 'Bold' });
    contribution.updateCommand('italic', { label: 'Italic' });
    const onChange = vi.fn();
    registry.addListener({ onChange });

    contribution.remove();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(registry.keys('sheet')).toEqual([]);
  });

  it('collectKeysByTag folds registry tags in at the node (chrome moved off the scope)', () => {
    const registry = new CommandRegistry();
    registry.register('sheet', 'bold', { tags: ['mutator'] });
    const app = new CommandScope('app', null, { registry });
    const sheet = app.createChild('sheet');
    sheet.updateCommand('bold', { callback: () => {} }); // behavior only; tag lives in the registry

    expect(sheet.collectKeysByTag('mutator', sheet)).toContain('bold');
  });
});
