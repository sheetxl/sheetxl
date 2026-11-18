import { type RemoveListener } from '@sheetxl/utils';

import { type CommandScope } from './CommandScope';
import { type ActivationTracker } from './ActivationTracker';
import { type CommandChain } from './CommandChainContext';

/**
 * The **z-ordered layer→scope registry** — the anchor source for a *region* whose behavior is composed
 * from stacked layers (selection, clipboard, format painter, the cell editor, …). Each command-bearing
 * layer `register`s its {@link CommandScope} at a z; this chains them (via {@link CommandScope.setParent})
 * into a stack ordered by z — **higher z → deeper → wins** — atop the region's `base`, and reports the
 * **top** as {@link getAnchor}. The unchanged {@link CommandScope.resolve} (which walks `_parent` from
 * the anchor) then resolves **top-of-stack first**: a stacked layer overrides a command by **stacking**,
 * not by focus, and unstacking it restores the layer/base below.
 *
 * This is what makes a feature a *composable* layer — one that both draws and injects commands — and it
 * is the same mechanism whether the layer is ours or a third party's. `LayerActivation` implements
 * {@link ActivationTracker}, so it drops into `CommandResolver` / {@link FocusActivation} (as an
 * {@link AnchorSource}, read live) with no other changes. It has no DOM element of its own — the **region**
 * owns focus/keys (a pane maps its `Stage` element to this stack; see {@link FocusActivation}).
 *
 * A layer may also **attach higher** ({@link setAttach}): chain on a named ancestor of the base instead
 * of the layer below it, so the layers below (and the scopes between the base and that ancestor) drop out
 * of resolution while it is attached. Layers above it still chain on top of it.
 *
 * @remarks
 * Ties (equal z) keep insertion order. Reusing the same scope twice is not supported (register each
 * layer's scope once). The base is never removed; it's the region's always-present floor.
 */
export class LayerActivation implements ActivationTracker, CommandChain {
  protected readonly _base: CommandScope;
  protected _layers: Array<{ scope: CommandScope; z: number; attach: string | null }> = [];
  protected _top: CommandScope;
  protected readonly _listeners = new Set<() => void>();

  constructor(base: CommandScope) {
    this._base = base;
    this._top = base;
  }

  /**
   * Add a layer's scope at priority `z` and re-chain. Returns an unregister that removes it and
   * re-chains the rest (restoring whatever was below). The caller owns the scope's own teardown
   * (`contribution.remove()` / `scope.dispose()`); this only manages stack membership.
   */
  register(scope: CommandScope, z: number): RemoveListener {
    const entry = { scope, z, attach: null as string | null };
    this._layers = [...this._layers, entry];
    this._rechain();
    return () => {
      const next = this._layers.filter((e) => e !== entry);
      if (next.length !== this._layers.length) { this._layers = next; this._rechain(); }
    };
  }

  /**
   * Chain a registered `scope` on the ancestor named `ancestor` (the base or one of its parents, matched
   * by {@link CommandScope.name}) instead of on the layer below it; `null` puts it back in place. When no
   * such ancestor exists the scope chains as usual. No-op for a scope that isn't registered.
   */
  setAttach(scope: CommandScope, ancestor: string | null): void {
    const entry = this._layers.find((e) => e.scope === scope);
    if (!entry || entry.attach === ancestor) return;
    entry.attach = ancestor;
    this._rechain();
  }

  /** The base or its nearest ancestor named `name`. */
  protected _findAncestor(name: string): CommandScope | null {
    for (let node: CommandScope | null = this._base; node; node = node.getParent()) {
      if (node.name === name) return node;
    }
    return null;
  }

  /**
   * Re-link the registered scopes into a chain ordered by z: base → lowest → … → highest (= anchor). An
   * attached layer starts the chain over from its ancestor.
   */
  protected _rechain(): void {
    const sorted = [...this._layers].sort((a, b) => a.z - b.z);
    let parent: CommandScope = this._base;
    for (const entry of sorted) {
      const attached = entry.attach ? this._findAncestor(entry.attach) : null;
      entry.scope.setParent(attached ?? parent);
      parent = entry.scope;
    }
    this._top = parent;
    this._listeners.forEach((listener) => listener());
  }

  /** The region's floor scope (always present, below every layer). */
  getBase(): CommandScope { return this._base; }

  getAnchor(): CommandScope { return this._top; }

  subscribe(listener: () => void): RemoveListener {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }
}
