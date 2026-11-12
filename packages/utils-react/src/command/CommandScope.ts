import { type RemoveListener } from '@sheetxl/utils';

import { type ICommandDefinition } from './ICommandDefinition';
import { type CommandRegistry } from './CommandRegistry';
import { type ActivationTracker } from './ActivationTracker';
import { reduceDefinitions, type ReducedDefinition } from './reduceDefinitions';
import {
  createResolvedCommand,
  type ResolvedCommand, type ExecuteHook, type CommandMiddleware
} from './createResolvedCommand';

/** Coarse change notification — fired (root-anchored) on any contribution/active change. */
export interface CommandScopeListener {
  onChange?(): void;
}

/**
 * A tracked contribution **session** on a scope (see {@link CommandScope.contribution}). Every
 * {@link updateCommand} through it records the key; {@link remove} tears down **exactly** those keys
 * in one call — so a contributor's teardown is a single `contribution.remove()` instead of an
 * easy-to-miss, per-key `removeCommand` list (which gets long for large contributors). Re-`updateCommand`
 * for a key already tracked is idempotent.
 */
export interface CommandContribution {
  updateCommand<STATE = any, CONTEXT = any, ARGS = void>(
    commandKey: string,
    partial: Omit<ICommandDefinition<STATE, CONTEXT, ARGS>, 'key'>
  ): void;
  /**
   * Register dispatch {@link CommandMiddleware} on the owning scope — the cross-cutting wrapper for
   * the callbacks this contribution authors (e.g. a sheet's transactional batch/busy wrapper, so each
   * command callback stays pure). Tracked like commands: undone by {@link remove}. This is the
   * authoring facet's equivalent of {@link CommandScope.use}, so a contributor never needs the raw scope.
   */
  use(middleware: CommandMiddleware<any, any, any>): void;
  /**
   * All command keys reachable from the owning scope (its chain → root) whose merged definition
   * carries `tag`. The authoring counterpart of {@link CommandScope.collectKeysByTag} — it lets a
   * contributor apply a **cross-cutting rule by tag** without hand-maintaining a parallel key list:
   * e.g. a sheet's protection reducer does `for (const key of getKeysByTag('mutator')) updateCommand(key,
   * { disabledReasons })`, so the tag authored in the catalog is the single source of truth (the
   * resolved `disabled()` then accumulates the reasons — no new resolve-time machinery needed).
   */
  getKeysByTag(tag: string): string[];
  /** Remove every command + middleware this contribution touched. Idempotent. */
  remove(): void;
}

/**
 * A node in the command **scope** tree — the pure registry (the new-model counterpart of the
 * existing `CommandGroup`, but holding *definitions* instead of instances). A scope holds the
 * **within-scope merged** {@link ICommandDefinition} for each command key; it knows nothing
 * about "active"/focus — *which* leaf to resolve from is the consumer's `anchor` (see
 * `CommandResolver`).
 *
 * {@link resolve} walks the chain from a given `anchor` leaf → root, reducing each scope's
 * contribution least→most specific into a derived {@link ResolvedCommand}. Two merge levels:
 * - **within a scope** — successive {@link updateCommand} calls merge (here);
 * - **across scopes** — the anchor-chain reduction (in {@link resolve}).
 *
 * Also provides change notification ({@link addListener} / {@link invalidate}) and per-key
 * execute observation ({@link addExecuteListener}). It does NOT dispatch — the resolved
 * command's `execute()` does (firing the per-key observers).
 */
export class CommandScope {
  readonly key: string;
  /**
   * The scope's **name** — its key into the flat {@link CommandRegistry} (design/COMMAND-DESIGN.md
   * §"Named scopes"). Defaults to {@link key}; a distinct name lets two instances with different keys
   * (a double-buffer's two `workbook`s, a sheet's per-pane scopes) share one registry entry. At every
   * node of {@link resolve}/{@link collectKeys}, the registry entry for this `name` is folded in as the
   * least-specific (prototype) layer beneath the node's own defs.
   */
  readonly name: string;

  protected _parent: CommandScope | null;
  protected _children = new Map<string, CommandScope>();
  /** This scope's own within-scope merged definitions, by command key. */
  protected _defs = new Map<string, ICommandDefinition>();
  /**
   * What each live {@link contribution} wrote per key, so removing one re-merges the others instead
   * of dropping the key: key → contribution → each field it wrote, with when it wrote it.
   */
  protected _layers = new Map<string, Map<object, Map<string, { value: unknown; seq: number }>>>();
  protected _layerSeq = 0;
  /** Dispatch middleware authored on THIS scope (wraps callbacks this scope contributes). */
  protected _middleware: CommandMiddleware<any, any, any>[] = [];
  /** Teardown for a contribution bound at {@link createChild} (its `setup`'s returned disposer). */
  protected _setupDisposer?: RemoveListener;

  /** Root reference (every node points at the root). */
  protected readonly _root: CommandScope;
  // Root-only state (the registry is pure: definitions + resolution + observation — no
  // "active". Which leaf to resolve from is the consumer's `anchor`; see ActiveScope.)
  protected _version = 0;
  protected _resolveCache = new WeakMap<CommandScope, WeakMap<CommandScope, Map<string, ResolvedCommand<any, any, any> | undefined>>>();
  protected _resolveCacheVersion = -1;
  /** root-only: coarse change listeners (fired on any version bump). */
  protected _listeners = new Set<CommandScopeListener>();
  /** root-only: a fan-out window is open for this tick (see {@link _bump}). */
  protected _notifyPending = false;
  /** root-only: bumps arrived while the window was open ⇒ ONE trailing notify when it closes. */
  protected _notifyDirty = false;
  /** root-only: per-command-key execute observers (ripple/close, middleware). `any` ARGS so
   * observers for differently-parameterized commands coexist in one registry map. */
  protected _executeListeners = new Map<string, Set<ExecuteHook<any, any, any>>>();
  /** root-only: the flat named registry consulted as each node's prototype (undefined ⇒ no registry). */
  protected _registry?: CommandRegistry;
  /** root-only: cache for {@link resolveStatic} (the not-in-context by-name fallback), keyed by version. */
  protected _resolveStaticCache = new Map<string, ResolvedCommand<any, any, any> | undefined>();
  protected _resolveStaticCacheVersion = -1;
  /** root-only: unsubscribe from the registry's change notifications (see the ctor). */
  protected _registryUnsub?: RemoveListener;
  /**
   * root-only: the **`element → region source` index** (pull-model focus discovery). A focus region — a
   * pane's `Stage`, an editor leaf — records *its own* focusable element here via {@link attachElement}, and
   * every consumer's {@link FocusActivation} reads it on the focus walk. Living on the **tree** (rather than a
   * parallel side-registry) is deliberate: the map is **shared across resolvers** (studio + script toolbar
   * both resolve focus against the same regions), so it sits *below* the per-container resolvers — at the tree
   * level (design/COMMAND-DESIGN.md §"Fold the region bridge into the tree"). Only **leaf** regions are
   * recorded; the rest of the chain is the {@link getParent} walk. A plain `Map` (not weak): the recording
   * site removes its own entry on unmount, so nothing is retained.
   */
  protected _regions?: Map<Element, AnchorSource>;
  /**
   * This scope's own attached DOM element(s) (recorded by {@link attachElement} or
   * {@link attachBounds}, removed by their removers) — the instance-side record {@link contains}
   * reads for **origin containment** (the root {@link _regions} index is the focus-discovery side of
   * an `attachElement`). Plural: a region may span several containers — its main element plus e.g. a
   * **portaled** float/popup container that is logically inside the region but DOM-outside it.
   */
  protected _elements: Element[] = [];

  constructor(key: string, parent: CommandScope | null = null, opts?: { name?: string; registry?: CommandRegistry }) {
    this.key = key;
    this.name = opts?.name ?? key;
    this._parent = parent;
    this._root = parent ? parent._root : this;
    // A registry is a root concern (shared by the whole tree). Bind it and re-resolve whenever it
    // changes — a registry `register`/`remove` must bump the same version instances cache against.
    if (opts?.registry) {
      this._registry = opts.registry;
      this._registryUnsub = opts.registry.addListener({ onChange: () => this._bump() });
    }
  }

  /**
   * (Re)establish this scope's registry subscription. Idempotent. The owning provider's mount
   * effect calls this so a scope {@link dispose}d on an effect *cleanup* (React StrictMode's
   * mount→unmount→remount) comes back to life instead of staying **permanently deaf to
   * registry changes** — the same resurrect contract as `CommandResolver.connect`. Without it,
   * anything that reaches consumers *only* through the registry listener (a plugin registering
   * statics after mount, a language-pack switch re-deriving translated chrome) silently stops
   * propagating after the StrictMode cycle. Bumps on re-subscribe: the registry may have
   * changed while deaf.
   */
  connect(): void {
    if (!this._registry || this._registryUnsub) return;
    this._registryUnsub = this._registry.addListener({ onChange: () => this._bump() });
    this._bump();
  }

  /**
   * Create (and register) a child scope. The bare form deliberately does **not** bump the version: a
   * fresh child has no definitions, so it changes no resolved command (resolution only sees it once it
   * gets {@link updateCommand} — which bumps — or becomes the anchor). This keeps the endorsed pattern
   * of creating a region's scope during render (`useMemo(() => parent.createChild(key))`) free of a
   * notify-during-render — which would re-enter subscribed consumers (the "setState while rendering"
   * warning). Teardown ({@link dispose}) *does* bump, since it drops contributions.
   *
   * **`contributor` — bind a contribution to the child's lifetime** (so a scope and its commands are
   * created and torn down as one, instead of a separate `useEffect`). It runs immediately with a fresh
   * {@link CommandContribution} for the new child (plus any forwarded `args`), and returns *only its own
   * external-subscription disposer* (e.g. a model listener) — it does **not** manage command removal.
   * `dispose()` does the rest automatically: invoke that disposer **and** clear the child's `_defs`
   * (so the contributed commands go without a per-key list). Declarative call site:
   * `parent.createChild('undo', contributeUndoCommands, { manager, notifier })`.
   *
   * NOTE: the contributor **contributes synchronously**, and contributing bumps (notifies). So — like
   * any `updateCommand` — call this where a contribution-time notify is fine: at **mount** (in `useMemo`,
   * no subscribers yet), NOT mid-render with live subscribers.
   */
  createChild<A extends any[] = []>(
    keyOrOpts: string | { key: string; name?: string },
    contributor?: (contribution: CommandContribution, ...args: A) => RemoveListener | void,
    ...args: A
  ): CommandScope {
    // `{ key, name }` lets a child's registry **name** differ from its tree **key** — e.g. a layer keeps
    // its `layer:selection` key convention while resolving against `registry['selection']`, and (later) a
    // double-buffer's two `workbook`s share one registry entry under distinct keys. Bare string ⇒ name = key.
    const key = typeof keyOrOpts === 'string' ? keyOrOpts : keyOrOpts.key;
    const name = typeof keyOrOpts === 'string' ? undefined : keyOrOpts.name;
    const child = new CommandScope(key, this, { name });
    this._children.set(key, child);
    if (contributor) {
      const disposer = contributor(child.contribution(), ...args);
      if (disposer) child._setupDisposer = disposer;
    }
    return child;
  }

  getParent(): CommandScope | null { return this._parent; }
  getRoot(): CommandScope { return this._root; }
  getChild(key: string): CommandScope | undefined { return this._children.get(key); }
  /** The flat named registry bound to this tree (from the root), or `undefined` if none. */
  getRegistry(): CommandRegistry | undefined { return this._root._registry; }

  // --- focus-region index (pull discovery) ----------------------------------

  /**
   * Record `element → source` in the tree's {@link _regions region index} — a **focus region** naming its
   * own focusable element so a consumer's {@link FocusActivation} can anchor there on focus. `source`
   * defaults to **this** scope (a fixed leaf — the formula-bar editor, the script pane); pass a live
   * {@link AnchorSource} (a pane's `LayerActivation`, or a getter) for a **dynamic leaf** whose current
   * value tracks a moving stack top. The entry lands on the **root** (shared by every consumer), so this can
   * be called on any node. Returns a remover the recording site calls on unmount — identity-guarded, so a
   * re-record of the same element by another owner is never clobbered by a stale cleanup.
   */
  attachElement(element: Element, source?: AnchorSource): RemoveListener {
    const root = this._root;
    const src = source ?? this;
    (root._regions ??= new Map()).set(element, src);
    // Also record the element on THIS scope (the region owner) — the origin-containment side of the
    // attach: commands authored at/below this scope only dispatch for keystrokes originating inside
    // one of its elements (see {@link contains} and the KeyBindingDispatcher origin rule). A scope
    // may attach several (a portaled float container extends the region beyond its DOM subtree).
    this._elements.push(element);
    return () => {
      if (root._regions?.get(element) === src) root._regions.delete(element);
      const index = this._elements.indexOf(element);
      if (index !== -1) this._elements.splice(index, 1);
    };
  }

  /**
   * Bound this scope's **region** to `element` for {@link contains origin containment} — WITHOUT
   * naming a focus region. The containment half of {@link attachElement}, alone.
   *
   * Use this when a scope's commands need a UI region but the scope is not a focus *leaf*: the
   * `sheet` scope owns the grid's commands, yet focus inside the grid must keep anchoring at the
   * pane's z-stack (a deeper region), not here. Recording it in the root index would make this scope
   * a candidate anchor and change what a focus lands on; bounding only does not.
   *
   * Leaving a scope unbounded is a **decision, not a default**: an element-less scope is unrestricted
   * (see {@link contains}), so its shortcuts fire from any origin under the dispatch seam — correct
   * for app-tier commands (`ctrl+S` saves while the caret is in a task-pane field), wrong for
   * anything that acts on a region's own UI.
   *
   * **A region is a set of containers, not one subtree.** Call this more than once when the region's UI
   * is not contiguous in the DOM — a host that renders workbook chrome (a formula bar, a status bar, a
   * toolbar with a search box) outside the workbook element adds each piece, and a keystroke born there
   * still reaches the region's commands. A host declares those from where the chrome renders, via
   * `useCommandElement`; the scope's own owner does not have to know about them. Same seam for a
   * **portaled** float — DOM-outside the region, logically inside it.
   *
   * Returns a remover the recording site calls on unmount.
   */
  attachBounds(element: Element): RemoveListener {
    this._elements.push(element);
    return () => {
      const index = this._elements.indexOf(element);
      if (index !== -1) this._elements.splice(index, 1);
    };
  }

  /**
   * The region source recorded **exactly at** `element` (single-element lookup on the root index), or
   * `undefined`. The bounded DOM walk-up is the caller's ({@link FocusActivation.findSource}, region-bounded;
   * or {@link findScope}, unbounded) — this is the per-element primitive both build on.
   */
  getRegion(element: Element): AnchorSource | undefined {
    return this._root._regions?.get(element);
  }

  /**
   * **Origin containment — the scope decides** (design/COMMAND-DESIGN.md "Core law", consequence 3):
   * whether `node` counts as *within this scope's region*, i.e. whether a keystroke born at `node`
   * may dispatch this scope's contributions. The default policy:
   *
   * - this scope has {@link attachElement attached} element(s) → `true` iff **any** of them
   *   DOM-contains `node`. (Plural is the **portal** seam: a float/popup portaled to `body` is
   *   DOM-outside the region but logically inside it — its owner attaches the portal container as
   *   an additional element and keys born there qualify.)
   * - no elements of its own → **delegate to the parent** — the nearest region-owning ancestor
   *   decides (a pane's z-chain layers all inherit the pane `Stage` via the chain base, so the whole
   *   z-stack shares one region, and a key a layer deliberately lets propagate — the editor's commit
   *   Enter — still qualifies, because it was born inside that Stage).
   * - nothing up the whole chain → `true` (an element-less chain — a sheet/workbook/app-level scope
   *   — is *unrestricted*: its commands may fire from any origin under the dispatch seam).
   *
   * It is a **method on the scope** — not an inline DOM check — precisely so a region owner can make
   * a richer decision than raw containment when the DOM and the logical UI disagree (portals today;
   * anything else tomorrow).
   */
  contains(node: Node): boolean {
    const elements = this._elements;
    if (elements.length > 0) {
      for (let i = 0; i < elements.length; i++) {
        if (elements[i].contains(node)) return true;
      }
      return false;
    }
    return this._parent ? this._parent.contains(node) : true;
  }

  /**
   * The nearest region **scope** at or above `element`: walk `parentElement` to the first
   * {@link attachElement attached} element and **stop** (leaf-finding, unbounded — a live source is resolved
   * to its current scope). This is *leaf-finding*, NOT the resolution walk (design/COMMAND-DESIGN.md
   * §Guardrail): it names the anchor; resolution is the separate `anchor → root` command-parent walk.
   * `undefined` if no attached element is on the ancestor chain.
   */
  findScope(element: Element | null): CommandScope | undefined {
    const regions = this._root._regions;
    if (!regions) return undefined;
    let current: Element | null = element;
    while (current) {
      const source = regions.get(current);
      if (source) return resolveAnchorSource(source) ?? undefined;
      current = current.parentElement;
    }
    return undefined;
  }

  /**
   * Re-attach this scope under a new parent (or detach with `null`). The primitive the **z-ordered
   * layer chain** is built from: a layer registry re-parents each layer's scope into a stack ordered
   * by z (higher z → deeper → wins the cascade), so the unchanged {@link resolve} (which walks
   * `_parent` from the anchor) resolves **top-of-stack first**. This is what lets a *stacked* layer
   * override a command by **stacking**, not by focus — and lets a client add a command-bearing layer
   * with no core special-casing.
   *
   * Reorders **within the same root** (the layer stack shares one registry root); `_root` is fixed at
   * construction, so cross-root moves are rejected. Rejects a cycle. Bumps the root so resolvers
   * re-resolve. No-op if `parent` is already the parent.
   */
  setParent(parent: CommandScope | null): void {
    if (parent === this._parent) return;
    if (parent) {
      if (parent._root !== this._root) throw new Error('setParent only reorders within the same root tree.');
      for (let node: CommandScope | null = parent; node; node = node._parent) {
        if (node === this) throw new Error('setParent would create a cycle.');
      }
    }
    this._parent?._children.delete(this.key);
    this._parent = parent;
    parent?._children.set(this.key, this);
    this._root._bump();
  }

  /**
   * Tear this scope down when the feature/region that owns it unmounts: recursively dispose
   * children, drop this scope's definitions, detach it from its parent (so it stops
   * contributing to resolution), and bump the root version so resolvers re-resolve. The
   * `_parent` pointer is left intact so a stale `anchor` still pointing here resolves *up* the
   * (now-detached) chain rather than throwing — turning a torn-down scope into its parent is
   * the eventual destruction-fallback (design/COMMAND-DESIGN.md, open Q5). Idempotent.
   */
  dispose(): void {
    for (const child of [...this._children.values()]) child.dispose();
    this._children.clear();
    this._setupDisposer?.(); // tear down a contribution bound at createChild (listeners etc.)
    this._setupDisposer = undefined;
    this._defs.clear();
    this._layers.clear();
    this._middleware.length = 0;
    this._registryUnsub?.();
    this._registryUnsub = undefined;
    this._parent?._children.delete(this.key);
    this._root._bump();
  }

  /**
   * Contribute/merge a partial definition for `commandKey` into THIS scope (within-scope
   * merge). `undefined` fields are ignored (don't clobber); `null` is kept (an explicit
   * clear). The cross-scope cascade happens later, in {@link resolve}.
   */
  updateCommand<STATE = any, CONTEXT = any, ARGS = void>(
    commandKey: string,
    partial: Omit<ICommandDefinition<STATE, CONTEXT, ARGS>, 'key'>
  ): void {
    const existing = this._defs.get(commandKey);
    const merged: Partial<ICommandDefinition<STATE, CONTEXT>> = existing ? { ...existing } : { key: commandKey };
    for (const prop in partial) {
      const value = (partial as Record<string, unknown>)[prop];
      if (value === undefined) continue; // ignore (don't clobber)
      (merged as Record<string, unknown>)[prop] = value;
    }
    merged.key = commandKey;
    this._defs.set(commandKey, merged as ICommandDefinition<STATE, CONTEXT>);
    this._root._bump();
  }

  /** Remove this scope's contribution for `commandKey`, every contribution's part of it included. */
  removeCommand(commandKey: string): void {
    this._layers.delete(commandKey);
    if (this._defs.delete(commandKey)) this._root._bump();
  }

  /** Record what `owner` (a {@link contribution}) wrote for `commandKey`, merged with its earlier writes. */
  protected _recordLayer(commandKey: string, owner: object, partial: object): void {
    let owners = this._layers.get(commandKey);
    if (!owners) { owners = new Map(); this._layers.set(commandKey, owners); }
    let fields = owners.get(owner);
    if (!fields) { fields = new Map(); owners.set(owner, fields); }
    const seq = ++this._layerSeq;
    for (const prop in partial) {
      const value = (partial as Record<string, unknown>)[prop];
      if (value !== undefined) fields.set(prop, { value, seq });
    }
  }

  /**
   * Drop what `owner` wrote for `commandKey`. The key goes when nothing else wrote it; otherwise it
   * is rebuilt from the remaining contributions, each field taking its most recent write.
   */
  protected _removeLayer(commandKey: string, owner: object): void {
    const owners = this._layers.get(commandKey);
    if (!owners?.delete(owner)) return;
    if (owners.size === 0) {
      this.removeCommand(commandKey);
      return;
    }
    const latest = new Map<string, { value: unknown; seq: number }>();
    for (const fields of owners.values()) {
      for (const [prop, write] of fields) {
        const current = latest.get(prop);
        if (!current || write.seq > current.seq) latest.set(prop, write);
      }
    }
    const merged: Record<string, unknown> = {};
    for (const [prop, write] of latest) merged[prop] = write.value;
    merged.key = commandKey;
    this._defs.set(commandKey, merged as unknown as ICommandDefinition);
    this._root._bump();
  }

  /**
   * Open a tracked {@link CommandContribution} on THIS scope: `updateCommand` through the handle
   * records each key, and `remove()` removes exactly those — so a contributor (esp. a large one)
   * cleans up with a single call rather than a per-key `removeCommand` list that's easy to fall out
   * of sync. The handle owns *its* part of each key only: when another contribution to this scope
   * wrote the same key, removing this one leaves the other's fields in place.
   */
  contribution(): CommandContribution {
    const scope = this;
    const owner = {};
    const keys = new Set<string>();
    const middlewareRemovers: RemoveListener[] = [];
    return {
      updateCommand<STATE = any, CONTEXT = any, ARGS = void>(
        commandKey: string,
        partial: Omit<ICommandDefinition<STATE, CONTEXT, ARGS>, 'key'>
      ): void {
        keys.add(commandKey);
        scope._recordLayer(commandKey, owner, partial);
        scope.updateCommand<STATE, CONTEXT, ARGS>(commandKey, partial);
      },
      use(middleware: CommandMiddleware<any, any, any>): void {
        middlewareRemovers.push(scope.use(middleware));
      },
      getKeysByTag(tag: string): string[] {
        // Read from the owning scope's chain (this scope → root) — the tag is typically authored on the
        // root catalog, so the walk must start here, not at the root.
        return scope.collectKeysByTag(tag, scope);
      },
      remove(): void {
        for (const key of keys) scope._removeLayer(key, owner);
        keys.clear();
        for (const off of middlewareRemovers) off();
        middlewareRemovers.length = 0;
      }
    };
  }

  /**
   * Register dispatch {@link CommandMiddleware} on THIS scope: it auto-wraps every callback
   * this scope **authors** (so contributor callbacks stay pure — transactional wrapping
   * becomes one `use(tx)` instead of wrapping each command by hand). **Not inherited** — a
   * command's middleware is that of the scope whose callback wins resolution, nothing up the
   * chain. First-registered is outermost. Returns a remover.
   */
  use(middleware: CommandMiddleware<any, any, any>): RemoveListener {
    this._middleware.push(middleware);
    this._root._bump();
    return () => {
      const index = this._middleware.indexOf(middleware);
      if (index !== -1) { this._middleware.splice(index, 1); this._root._bump(); }
    };
  }

  /** This scope's own middleware (authoring order). */
  getMiddleware(): readonly CommandMiddleware<any, any, any>[] { return this._middleware; }

  /** This scope's own (merged) contribution for a key, or `undefined`. */
  getDefinition(commandKey: string): ICommandDefinition | undefined {
    return this._defs.get(commandKey);
  }

  /**
   * All command keys contributed along the chain from `anchor` → root (deduped, order
   * unspecified). The keystroke dispatcher uses this to enumerate the commands that could
   * match an event at the current anchor (then resolves each to read its shortcut).
   */
  collectKeys(anchor: CommandScope = this._root, root: CommandScope = this._root): string[] {
    const keys = new Set<string>();
    const registry = this._root._registry;
    let node: CommandScope | null = anchor;
    while (node) {
      for (const key of node._defs.keys()) keys.add(key);
      // Prototype keys: the registry entry for this node's name contributes chrome-only keys (a command
      // whose presentation lives in the catalog but whose behavior isn't in the chain yet) — so the
      // keystroke dispatcher still enumerates them and a shortcut resolves.
      if (registry) for (const key of registry.keys(node.name)) keys.add(key);
      if (node === root) break; // bounded terminal (inclusive): stop the anchor→root climb here
      node = node._parent;
    }
    return [...keys];
  }

  /**
   * Like {@link collectKeys}, but only keys whose contribution **somewhere along the chain** carries
   * `tag` (tags accumulate across scopes, so a match at any scope on the chain counts). Enables
   * cross-cutting, tag-driven rules — e.g. "disable every `mutator` command when the sheet is
   * protected" — without a hand-maintained parallel key list. Order unspecified; deduped.
   */
  collectKeysByTag(tag: string, anchor: CommandScope = this._root): string[] {
    const keys = new Set<string>();
    const registry = this._root._registry;
    let node: CommandScope | null = anchor;
    while (node) {
      for (const [key, def] of node._defs) {
        if (def.tags?.includes(tag)) keys.add(key);
      }
      // Tags authored in the catalog (e.g. `mutator`) now live in the registry prototype, not on the
      // scope's own defs — fold them in so a contributor's cross-cutting, tag-driven rule still finds them.
      if (registry) for (const key of registry.collectKeysByTag(node.name, tag)) keys.add(key);
      node = node._parent;
    }
    return [...keys];
  }

  getVersion(): number { return this._root._version; }

  /**
   * Trigger a re-resolution **without** changing any contribution — bump version + notify.
   * A contributor calls this when the model/context changed (so dynamic values should
   * re-evaluate) instead of enumerating `updateCommand`s; containers re-resolve on their own
   * cadence (debounce). NOT a substitute for {@link updateCommand} (which sets values).
   */
  invalidate(): void {
    this._root._bump();
  }

  protected _bump(): void {
    const root = this._root;
    root._version++;
    // Coarse notify: subscribers re-resolve; memoized resolve + Object.is lets them re-render only
    // when a key they care about actually changed. The version bumps synchronously on every change,
    // so resolve (its cache keys on it) is never stale. The fan-out is leading + trailing per tick:
    // the first bump notifies synchronously, later bumps in the same tick (a contributor's per-key
    // sync — a selection change re-states ~250 keys) only mark the window dirty, and the microtask
    // closing it fires ONE trailing notify. Bulk registry seeding still batches at the source
    // (CommandRegistry.batch). See design/COMMAND-EMIT-PERFORMANCE.md.
    if (root._notifyPending) { root._notifyDirty = true; return; }
    root._notifyPending = true;
    // Queued before the fan-out, so a throwing listener cannot leave the window open (a deaf scope).
    queueMicrotask(() => {
      root._notifyPending = false;
      if (!root._notifyDirty) return;
      root._notifyDirty = false;
      root._listeners.forEach((l) => l.onChange?.());
    });
    root._listeners.forEach((l) => l.onChange?.());
  }

  // --- subscriptions + execute ----------------------------------------------

  /** Subscribe to coarse changes (re-resolve on fire). Root-anchored. */
  addListener(listener: CommandScopeListener): RemoveListener {
    const root = this._root;
    root._listeners.add(listener);
    return () => { root._listeners.delete(listener); };
  }

  /**
   * Observe executions of a specific command key. Fires for ALL dispatch paths (button,
   * keystroke, programmatic) because the resolved command's `execute()` fires it — the
   * ripple/close + middleware hook. Root-anchored, so it survives command re-derivation.
   */
  addExecuteListener(commandKey: string, hook: ExecuteHook<any, any, any>): RemoveListener {
    const root = this._root;
    let set = root._executeListeners.get(commandKey);
    if (!set) {
      set = new Set();
      root._executeListeners.set(commandKey, set);
    }
    set.add(hook);
    return () => {
      set!.delete(hook);
      if (set!.size === 0) root._executeListeners.delete(commandKey);
    };
  }

  // --- resolution ------------------------------------------------------------

  /**
   * Resolve a command by gathering its contributions along the chain from `anchor` → root,
   * reducing them least→most specific, and deriving a {@link ResolvedCommand}. `anchor` is the
   * **resolution leaf**; it defaults to the registry **root**. A consumer (`useCommands({
   * anchor })`) sets it — normally to the focus-driven active scope (an {@link ActiveScope}
   * the consumer reads), or to a context menu's snapshot. Returns `undefined` when no **dynamic**
   * contribution for the key exists on the chain — a registry (static) catalog entry alone does not
   * resolve (see the "static only if dynamic first" note below). Memoized by version, per `anchor`.
   *
   * `origin` (keystroke dispatch only — buttons/display omit it) applies **origin containment** per
   * contribution: a node whose {@link contains} rejects the event's origin contributes nothing to
   * this resolve, so the cascade falls through to the permitted portion (or to `undefined` when
   * everything is omitted). See the gather-loop comment below.
   */
  resolve<STATE = any, CONTEXT = any, ARGS = void>(
    commandKey: string,
    anchor: CommandScope = this._root,
    injected?: readonly ICommandDefinition[],
    root?: CommandScope,
    origin?: Node | null
  ): ResolvedCommand<STATE, CONTEXT, ARGS> | undefined {
    const trueRoot = this._root;
    // The bounded-walk **terminal** (design/COMMAND-DESIGN.md §"resolution model"): the chain climbs
    // `anchor → root` (inclusive) and *stops* — `root` is this container's topmost node (e.g. `sheet`
    // for a context menu, the app root for the studio), NOT necessarily the tree root. Undefined ⇒ walk
    // to the true tree root (unbounded). Normalized to a real scope so it can key the cache.
    const terminal = root ?? trueRoot;
    // Injected contributions (a `CommandResolver` splicing the active DOM element's defaults at the
    // leaf — see `CommandResolver.addResolveInjector`) are caller/DOM-driven, NOT version-tracked, so
    // they must **bypass the resolve cache** in both directions — otherwise a stale cached command
    // would mask the injection, or a cached injected command would outlive the element that produced it.
    const hasInjected = !!injected && injected.length > 0;
    if (trueRoot._resolveCacheVersion !== trueRoot._version) {
      trueRoot._resolveCache = new WeakMap();
      trueRoot._resolveCacheVersion = trueRoot._version;
    }
    // Cache keyed by (anchor, terminal): two containers sharing an anchor but bounded at different roots
    // (studio→app vs context-menu→sheet) resolve DIFFERENTLY, so must not share a cache slot.
    let byTerminal = trueRoot._resolveCache.get(anchor);
    if (!byTerminal) { byTerminal = new WeakMap(); trueRoot._resolveCache.set(anchor, byTerminal); }
    let byKey = byTerminal.get(terminal);
    if (!byKey) { byKey = new Map(); byTerminal.set(terminal, byKey); }
    // An origin-less resolve (buttons/display — the hot path) can return the cached command up front.
    // An origin-FILTERED resolve must walk first: only if the walk omitted nothing is the result
    // identical to the unfiltered one (and the cache usable) — see the post-walk cache read below.
    if (!hasInjected && !origin && byKey.has(commandKey)) {
      return byKey.get(commandKey) as ResolvedCommand<STATE, CONTEXT, ARGS> | undefined;
    }

    // Walk `anchor` → `terminal`, gathering DYNAMIC contributions (a scope's own model-closured defs) and
    // STATIC ones (the flat registry's instance-independent defaults for each node's name) separately.
    // `dynamic`/`statics` collect most-specific-first (anchor → root); `dynamic` tracks the authoring
    // scope so middleware can bind to whoever wrote the callback (statics carry no scope).
    //
    // **Origin containment (design/COMMAND-DESIGN.md "Core law", consequence 3), per contribution:**
    // when a keystroke `origin` is supplied, a node whose {@link contains} rejects it contributes
    // NOTHING here — its dynamic def AND its registry proto are omitted, so the cascade falls
    // through to the less-specific portion (a `workbook`-level callback still resolves from a task
    // pane while the sheet-layer override of the same key is omitted), and a command whose every
    // contribution is omitted resolves to `undefined` (the binding does not exist for that origin).
    // The scope OWNS the decision (`contains` — its portal seam), not an inline DOM check.
    const registry = trueRoot._registry;
    const dynamic: { def: ICommandDefinition; scope: CommandScope }[] = [];
    const statics: ICommandDefinition[] = [];
    let omitted = false; // did origin filtering drop anything? (false ⇒ result is origin-independent)
    let node: CommandScope | null = anchor;
    while (node) {
      const def = node._defs.get(commandKey);
      const proto = registry?.resolveDefinition(node.name, commandKey);
      if (def || proto) {
        if (origin && !node.contains(origin)) {
          omitted = true; // born outside this node's region — this node contributes nothing
        } else {
          if (def) dynamic.push({ def, scope: node });
          if (proto) statics.push(proto);
        }
      }
      if (node === terminal) break; // bounded terminal (inclusive): stop the anchor→root climb here
      node = node._parent;
    }
    // Origin supplied but nothing omitted ⇒ identical to the unfiltered resolve: safe to share its cache.
    if (!hasInjected && origin && !omitted && byKey.has(commandKey)) {
      return byKey.get(commandKey) as ResolvedCommand<STATE, CONTEXT, ARGS> | undefined;
    }
    // **Static is only found if there is a dynamic first.** A command that exists solely as a static
    // catalog entry (its scope isn't contributing it right now — an idle editor's F4, a `table` command
    // with no table active) stays enumerable in the registry (the catalog) but does NOT resolve here, so
    // its shortcut never binds and falls through to whoever else claims it (F4 → `redo`). Element
    // lifecycle ≠ command lifecycle: a mounted scope that simply stops contributing a key is, to
    // resolution, identical to one that unmounted. An injected leaf default counts as a dynamic.
    const chain: ICommandDefinition[] = [];
    const chainScopes: (CommandScope | undefined)[] = [];
    const hasDynamic = dynamic.length > 0 || hasInjected;
    if (hasDynamic) {
      // Assemble least → most specific: static defaults (least) → scope dynamics → injected leaf (most).
      for (let i = statics.length - 1; i >= 0; i--) { chain.push(statics[i]); chainScopes.push(undefined); }
      for (let i = dynamic.length - 1; i >= 0; i--) { chain.push(dynamic[i].def); chainScopes.push(dynamic[i].scope); }
      // Injected defs are the most-specific (the leaf, below no one), carry NO authoring scope, so a
      // leaf-injected callback runs raw — unwrapped by any scope's transactional middleware (correct: an
      // element default, not scope-authored work).
      if (hasInjected) { for (const def of injected!) { chain.push(def); chainScopes.push(undefined); } }
    }

    let resolved: ResolvedCommand<STATE, CONTEXT, ARGS> | undefined;
    if (chain.length > 0) {
      const reduced = reduceDefinitions(commandKey, chain) as ReducedDefinition<STATE, CONTEXT, ARGS>;
      // Auto-wrap the winning callback with the **authoring scope's** middleware (bound to the
      // scope that contributed `callback`; NOT inherited up the chain).
      const callbackFrom = reduced.contributedBy['callback'];
      if (reduced.props.callback && callbackFrom !== undefined) {
        const middleware = chainScopes[callbackFrom]?.getMiddleware();
        if (middleware && middleware.length > 0) {
          let composed: any = reduced.props.callback;
          for (let i = middleware.length - 1; i >= 0; i--) composed = middleware[i](composed);
          reduced.props.callback = composed;
        }
      }
      // Inject a LIVE per-key hook accessor so the resolved command's execute() fires the
      // ripple/observers itself — a button can just call cmd.execute(). Live (not a snapshot)
      // so observers subscribing after this resolve still fire.
      resolved = createResolvedCommand<STATE, CONTEXT, ARGS>(
        reduced,
        () => trueRoot._executeListeners.get(commandKey)
      );
    }
    // Never cache a DOM-driven result: injected defs and an origin-FILTERED reduction (something was
    // omitted) are both event/element-dependent. An origin that omitted nothing is origin-independent
    // and cached like any other.
    if (!hasInjected && !omitted) byKey.set(commandKey, resolved);
    return resolved;
  }

  /**
   * Resolve a command **purely from the static registry** — the *not-in-context* primitive a consumer's
   * fallback composes, deliberately bypassing the "static only if a dynamic exists" rule that governs the
   * context {@link resolve}. Use it to show a command whose scope isn't currently contributing (a toolbar's
   * disabled button; a `table` command with no table) — the result is **disabled** if the static has no
   * `callback`, or **executable** if it carries a global one. `prefer` is the consumer's priority list of
   * names ({@link CommandRegistry.findByKey} searches it first, then all names).
   *
   * **Never call this from dispatch.** The keyboard dispatcher resolves only via {@link resolve}, so an
   * inert static never binds a shortcut (an idle editor's F4 stays free for `redo`). The *policy* — whether
   * to fall back at all, and the `prefer` list — is entirely the consumer's; the core never decides it.
   * Returns `undefined` if the key is registered under no name. Memoized by version.
   */
  resolveStatic<STATE = any, CONTEXT = any, ARGS = void>(
    commandKey: string,
    prefer?: readonly string[]
  ): ResolvedCommand<STATE, CONTEXT, ARGS> | undefined {
    const root = this._root;
    const registry = root._registry;
    if (!registry) return undefined;
    if (root._resolveStaticCacheVersion !== root._version) {
      root._resolveStaticCache.clear();
      root._resolveStaticCacheVersion = root._version;
    }
    const cacheKey = commandKey + '\0' + (prefer ? prefer.join(',') : '');
    if (root._resolveStaticCache.has(cacheKey)) {
      return root._resolveStaticCache.get(cacheKey) as ResolvedCommand<STATE, CONTEXT, ARGS> | undefined;
    }
    const found = registry.findByKey(commandKey, prefer);
    let resolved: ResolvedCommand<STATE, CONTEXT, ARGS> | undefined;
    if (found) {
      const reduced = reduceDefinitions(commandKey, [found.def]) as ReducedDefinition<STATE, CONTEXT, ARGS>;
      // No authoring scope ⇒ a global callback (if any) runs unwrapped by middleware — like a registry proto.
      resolved = createResolvedCommand<STATE, CONTEXT, ARGS>(
        reduced,
        () => root._executeListeners.get(commandKey)
      );
    }
    root._resolveStaticCache.set(cacheKey, resolved);
    return resolved;
  }
}

/**
 * An anchor **source** registered against a DOM element (via {@link CommandScope.attachElement}) — three
 * forms, all resolved to a leaf scope:
 * - a fixed {@link CommandScope} — an ordinary region (the formula-bar editor names its own element → its scope);
 * - an {@link ActivationTracker} (e.g. a pane's `LayerActivation`) — the **dynamic leaf**
 *   (design/COMMAND-DESIGN.md §"Layered resolver", mechanism 2): its `getAnchor()` is read *live*, so focusing
 *   a pane's `Stage` anchors at the **current** top of that pane's z-chain (the non-focusable-layer case);
 * - a **getter** (`() => CommandScope | null`) — the general escape hatch.
 */
export type AnchorSource = CommandScope | ActivationTracker | (() => CommandScope | null);

/** Evaluate an {@link AnchorSource} to its current scope: a scope is returned as-is; a tracker's `getAnchor()`
 *  and a getter are read **live** (so a layer stack's moving top is always current). */
export function resolveAnchorSource(source: AnchorSource | null): CommandScope | null {
  if (!source) return null;
  if (source instanceof CommandScope) return source;
  if (typeof source === 'function') return source();
  return source.getAnchor(); // an ActivationTracker (a pane's LayerActivation) — its live stack top
}
