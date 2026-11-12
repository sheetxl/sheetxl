import { type RemoveListener } from '@sheetxl/utils';

import { type ICommandDefinition } from './ICommandDefinition';
import { reduceDefinitions } from './reduceDefinitions';
import { type StaticCommandContributor, type CommandContributionComponent } from './CommandScopeContext';

/**
 * One contributor's **layer** in a `(name, key)` stack. Instance-**independent** presentation
 * (icon/label/shortcut/description/tags) plus any model-free stub/default — never a model-closured
 * callback (that lives on the instance scope, not the shared name; see design/COMMAND-DESIGN.md
 * §"Named scopes"). `contributor` is the layer's identity: re-registering the **same** contributor
 * **replaces** its layer (idempotent re-seed); a **different** contributor **pushes** a new one
 * (last-registered wins the reduce).
 */
interface RegistryLayer {
  contributor: unknown;
  def: Omit<ICommandDefinition<any, any, any>, 'key'>;
}

/**
 * A tracked contribution **session** on a registry name (see {@link CommandRegistry.contribution}) —
 * the registry counterpart of {@link CommandContribution}. Every {@link updateCommand} records the key
 * under this contributor's identity; {@link remove} tears down exactly those layers. Shaped so the
 * existing `register*Definitions(target)` seeders write into a name with no change beyond the target.
 */
export interface CommandRegistryContribution {
  // Generic-compatible with `CommandContribution.updateCommand`, so a `register*Definitions(target)`
  // seeder takes either a scope contribution or this registry one interchangeably.
  updateCommand<STATE = any, CONTEXT = any, ARGS = void>(
    commandKey: string,
    partial: Omit<ICommandDefinition<STATE, CONTEXT, ARGS>, 'key'>
  ): void;
  /** Remove this contributor's layer from every key it touched on this name. Idempotent. */
  remove(): void;
}

/** Fires whenever the registry's contents change (so a bound scope can bump its resolve version). */
export interface CommandRegistryListener {
  onChange?(): void;
}

/**
 * The **flat named registry** — `Map<name, Map<key, layer-stack>>`, **parent-less** (NOT a tree). It
 * holds only **instance-independent, STATIC** command definitions (default presentation + any model-free
 * stub) and **is the catalog**: fully enumerable, seedable at app-init with zero instances mounted.
 *
 * It is the **static** half of "static contribution + dynamic contribution" (design/COMMAND-DESIGN.md
 * §"Named scopes"): a {@link CommandScope} instance carries a `name`, and {@link CommandScope.resolve}
 * folds `registry[name]` in as the least-specific defaults — **but only for a command that also has a
 * live dynamic contribution** (a scope's own def). A static entry with no dynamic contributor stays in
 * the catalog (discoverable) yet does not resolve, so its shortcut never binds. This is why there is **no
 * `catalogOnly`**: an inactive scope simply isn't contributing dynamically, so its statics aren't pulled
 * — the editor's idle F4 falls to `redo` for free, and a `table` command is dormant until a table is
 * active. Element lifecycle ≠ command lifecycle; a mounted scope that stops contributing a key looks, to
 * resolution, exactly like one that unmounted.
 *
 * Names have **no hierarchy** — `app/workbook/movable/sheet/selection/editor` etc. is just typical
 * mounting plus a catalog display-order hint; which name wins at resolve is decided entirely by live
 * instance-tree position, never by the registry.
 *
 * A `(name, key)` is a **layer stack**, not one merged def, so multiple contributors (the core catalog +
 * N plugins) coexist and **remove independently**. Layers reduce by the same {@link reduceDefinitions}
 * policy as the scope chain (override per property; accumulate `disabledReasons`/`tags`), keyed by
 * contributor identity (same → replace, other → push).
 */
export class CommandRegistry {
  /** name → (key → ordered layer stack, least→most specific = push order). */
  protected _byName = new Map<string, Map<string, RegistryLayer[]>>();
  /** name → plugin dynamic contribution components (rendered per live instance; see {@link registerDynamic}). */
  protected _dynamicByName = new Map<string, Set<CommandContributionComponent>>();
  protected _listeners = new Set<CommandRegistryListener>();
  /** Open {@link batch} windows; while > 0 the listener fan-out is suspended (version still bumps). */
  protected _batchDepth = 0;
  protected _batchDirty = false;

  // Note: a language switch re-localizes commands via the CommandCatalogService re-seeding the active
  // locale's pack (which `register`s → `_notify` → scopes re-resolve), NOT via a translator overlay at
  // read time — so the registry no longer subscribes to the language service itself.

  /**
   * Run `fn` with the listener fan-out suspended, firing ONE notify at close iff anything changed
   * inside. `getVersion()` still bumps per change, so synchronous readers (the resolve caches key on
   * it) are never stale — only the fan-out is coalesced. Nestable: inner batches fold into the
   * outermost. The bulk paths ({@link registerStatic}, a contribution's `remove()`, catalog seeding)
   * run through this so a K-command seed wakes each subscriber once, not K times — per-key fan-out
   * during load-time seeding was a main-thread stall (design/COMMAND-EMIT-PERFORMANCE.md).
   */
  batch(fn: () => void): void {
    this._batchDepth++;
    try { fn(); } finally {
      if (--this._batchDepth === 0 && this._batchDirty) {
        this._batchDirty = false;
        this._listeners.forEach((l) => l.onChange?.());
      }
    }
  }

  /**
   * Trigger a re-resolution **without** changing any registration (mirrors
   * {@link CommandScope.invalidate}) — e.g. the active language changed, so
   * translator-resolved chrome must re-derive.
   */
  invalidate(): void {
    this._notify();
  }

  /**
   * Contribute/replace `partial` for `(name, commandKey)` under `contributor`. Same contributor +
   * key **replaces** the existing layer wholesale (idempotent re-seed — no double-accumulation of
   * `tags`/`disabledReasons`); a new contributor **pushes** a most-specific layer. Bumps listeners.
   */
  register(name: string, commandKey: string, partial: Omit<ICommandDefinition<any, any, any>, 'key'>, contributor: unknown = name): void {
    let byKey = this._byName.get(name);
    if (!byKey) { byKey = new Map(); this._byName.set(name, byKey); }
    let stack = byKey.get(commandKey);
    if (!stack) { stack = []; byKey.set(commandKey, stack); }
    const existing = stack.find((layer) => layer.contributor === contributor);
    if (existing) existing.def = partial;   // replace own layer (idempotent)
    else stack.push({ contributor, def: partial }); // push a new, most-specific layer
    this._notify();
  }

  /** Remove `contributor`'s layer from `(name, commandKey)`. Bumps listeners iff something changed. */
  removeCommand(name: string, commandKey: string, contributor: unknown): void {
    const stack = this._byName.get(name)?.get(commandKey);
    if (!stack) return;
    const index = stack.findIndex((layer) => layer.contributor === contributor);
    if (index === -1) return;
    stack.splice(index, 1);
    if (stack.length === 0) this._byName.get(name)!.delete(commandKey);
    this._notify();
  }

  /**
   * Remove **every** layer `contributor` seeded on `name`, across all command keys. The bulk twin of
   * {@link removeCommand} — used when a whole source drops out of a name (e.g. the catalog service
   * clearing a source that has no pack for the newly-active language, so a bundled-`en` floor leaves no
   * stale chrome behind). Bumps listeners iff something changed.
   */
  removeContributor(name: string, contributor: unknown): void {
    const byKey = this._byName.get(name);
    if (!byKey) return;
    let changed = false;
    for (const [key, stack] of byKey) {
      const index = stack.findIndex((layer) => layer.contributor === contributor);
      if (index === -1) continue;
      stack.splice(index, 1);
      if (stack.length === 0) byKey.delete(key);
      changed = true;
    }
    if (changed) this._notify();
  }

  /**
   * Open a tracked {@link CommandRegistryContribution} on `name` under `contributor` — the registry
   * twin of {@link CommandScope.contribution}. The `register*Definitions(target)` seeders take this as
   * their `target`, so moving a seed from `register(root)` onto a name is a one-argument change.
   * `contributor` defaults to the `name` (one core catalog layer per name); pass a distinct token for a
   * plugin that must coexist with / override the base.
   */
  contribution(name: string, contributor: unknown = name): CommandRegistryContribution {
    const registry = this;
    const keys = new Set<string>();
    return {
      updateCommand<STATE = any, CONTEXT = any, ARGS = void>(
        commandKey: string,
        partial: Omit<ICommandDefinition<STATE, CONTEXT, ARGS>, 'key'>
      ): void {
        keys.add(commandKey);
        registry.register(name, commandKey, partial, contributor);
      },
      remove(): void {
        registry.batch(() => {
          for (const key of keys) registry.removeCommand(name, key, contributor);
        });
        keys.clear();
      }
    };
  }

  /**
   * Seed a **static** contributor for `name` — instance-independent presentation into the catalog, idempotent
   * by the contributor fn's identity (re-register replaces its layer). The app-load counterpart of a feature
   * provider seeding its chrome; a plugin calls this to inject static into an existing name.
   */
  registerStatic(name: string, contributor: StaticCommandContributor): void {
    // Batched: a catalog seed of K commands is one fan-out, not K.
    this.batch(() => contributor(this.contribution(name, contributor)));
  }

  /**
   * Register a plugin's **dynamic** contribution {@link CommandContributionComponent} for `name` — a React
   * component {@link CommandScopeProvider} renders at **every live instance** of that named scope (so it
   * inherits the React context there and contributes via `props.scope.contribution()`). Returns a remover.
   */
  registerDynamic(name: string, component: CommandContributionComponent): RemoveListener {
    let set = this._dynamicByName.get(name);
    if (!set) { set = new Set(); this._dynamicByName.set(name, set); }
    set.add(component);
    this._notify();
    return () => { if (set!.delete(component)) this._notify(); };
  }

  /** The registered dynamic contribution components for `name` (registration order). */
  getDynamic(name: string): CommandContributionComponent[] {
    const set = this._dynamicByName.get(name);
    return set ? [...set] : [];
  }

  /**
   * The reduced, instance-independent definition for `(name, commandKey)` — the whole layer stack
   * folded by {@link reduceDefinitions} (least→most specific). Read by {@link CommandScope.resolve} as
   * a node's static defaults AND by the catalog (shortcut dialog / palette). `undefined` if nothing is
   * registered.
   */
  resolveDefinition(name: string, commandKey: string): ICommandDefinition | undefined {
    const stack = this._byName.get(name)?.get(commandKey);
    if (!stack || stack.length === 0) return undefined;
    const reduced = reduceDefinitions(commandKey, stack.map((layer) => ({ key: commandKey, ...layer.def })));
    return { key: commandKey, ...reduced.props };
  }

  /**
   * Find a key's static definition by searching names in `prefer` order first, then **all** names — the
   * lookup a *consumer's* not-in-context fallback composes (design/COMMAND-DESIGN.md §"Named scopes"): a
   * toolbar prefers the names it represents, then falls back to any name (so a plugin's command registered
   * under an unforeseen name still shows). Returns the first match's `name` + reduced def, or `undefined`
   * if no name has the key. This is a pure search — the *policy* (whether to fall back, the `prefer` list)
   * lives in the consumer, never in resolution/dispatch.
   */
  findByKey(commandKey: string, prefer?: readonly string[]): { name: string; def: ICommandDefinition } | undefined {
    if (prefer) {
      for (const name of prefer) {
        const def = this.resolveDefinition(name, commandKey);
        if (def) return { name, def };
      }
    }
    for (const name of this._byName.keys()) {
      const def = this.resolveDefinition(name, commandKey);
      if (def) return { name, def };
    }
    return undefined;
  }

  /** All names with at least one registered command. */
  names(): string[] { return [...this._byName.keys()]; }

  /** All command keys registered on `name` (deduped; order unspecified). */
  keys(name: string): string[] {
    const byKey = this._byName.get(name);
    return byKey ? [...byKey.keys()] : [];
  }

  /**
   * Command keys on `name` whose **reduced** definition carries `tag`. The registry counterpart of
   * {@link CommandScope.collectKeysByTag}, so a tag authored in the catalog (e.g. `mutator`) is still
   * found by a contributor's cross-cutting rule after the chrome moved off the scope and into the
   * registry. Order unspecified; deduped.
   */
  collectKeysByTag(name: string, tag: string): string[] {
    const byKey = this._byName.get(name);
    if (!byKey) return [];
    const matches: string[] = [];
    for (const key of byKey.keys()) {
      if (this.resolveDefinition(name, key)?.tags?.includes(tag)) matches.push(key);
    }
    return matches;
  }

  /** Subscribe to registry changes (a bound {@link CommandScope} re-resolves on fire). */
  addListener(listener: CommandRegistryListener): RemoveListener {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  /**
   * Monotonic change counter — a `useSyncExternalStore` snapshot for consumers that read registry
   * chrome directly (e.g. command-button entries). Bumps whenever the catalog changes, including the
   * async re-seed after a language switch (which a language-tag snapshot alone would miss).
   */
  getVersion(): number {
    return this._version;
  }
  protected _version = 0;

  protected _notify(): void {
    this._version++; // always synchronous — sync readers/caches must never see a stale version
    if (this._batchDepth > 0) { this._batchDirty = true; return; }
    this._listeners.forEach((l) => l.onChange?.());
  }
}

/**
 * The shared **singleton** command registry — the catalog + plugin static/dynamic registrations, mirroring
 * {@link DefaultCommandButtonRegistry}. `CommandRootProvider` uses this as its registry, so a plugin's
 * `registerStatic` / `registerDynamic` at app-init reaches resolution and the per-instance mount machinery.
 */
export const DefaultCommandRegistry = new CommandRegistry();
