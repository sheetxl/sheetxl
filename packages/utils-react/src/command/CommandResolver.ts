import { type RemoveListener } from '@sheetxl/utils';

import { type CommandScope } from './CommandScope';
import { type ICommandDefinition } from './ICommandDefinition';
import { type ActivationTracker } from './ActivationTracker';
import { type ResolvedCommand } from './createResolvedCommand';
import { KeyBindingDispatcher, type DispatchKeyEvent } from './KeyBindingDispatcher';

/**
 * A hook that lets a feature **inject a contribution into resolution, given the active DOM element** —
 * consulted per key by {@link CommandResolver.resolve} and spliced as the **most-specific** (leaf)
 * contribution, so it wins the cascade over the scope chain (but loses to the element's own scope, if
 * it authored the key — ordinary `override`). Return `undefined` to contribute nothing for this
 * `(key, element)`.
 *
 * The mechanism is generic — it knows nothing about clipboard or inputs. Its first consumer is the
 * input-clipboard set (`copy`/`cut`/`paste`/`selectAll` acting on a focused text input): the injector
 * gates on "is `element` an editable" and returns the callback + enablement, so a focused input's copy
 * out-resolves the grid's cell copy, and a region with no `copy` (the script editor) gains one — both
 * with no scope-tree surgery. See design/COMMAND-INPUT-CLIPBOARD-PLAN.md.
 */
export type ResolveInjector = (
  commandKey: string,
  element: Element | null
) => Partial<ICommandDefinition> | undefined;

export interface CommandResolverOptions {
  /**
   * Display cadence (ms): coalesce re-emits — covering **both** anchor changes (rapid focus)
   * and scope contribution changes (the tab-spin / `invalidate` case). `0` ⇒ immediate.
   */
  debounce?: number;
  /**
   * Auto-attach **native** keystroke handling to the tracker's region element (default `true`).
   * Set `false` when the host delivers keys to {@link CommandResolver.dispatchKey} itself — e.g. the
   * grid routes them through its (synthetic) Stage responder chain as a terminal `Layer` tap, so it
   * stays on **one** event system instead of mixing a native listener into synthetic dispatch (see
   * design/COMMAND-DESIGN.md "Core law — one keystroke bubble"). The dispatch *logic* is identical
   * either way; only delivery differs.
   */
  keyBindings?: boolean;
  /**
   * The **terminal** node the bounded `(anchor → root)` walk stops at (design/COMMAND-DESIGN.md
   * §"resolution model") — this container's topmost node (e.g. `sheet` for a context menu, the app
   * root for the studio). Omit ⇒ walk to the true tree root (unbounded — the studio default). A
   * container that wants commands defined *above* its `root` **re-anchors**; the engine only offers
   * the bounded walk.
   */
  root?: CommandScope;
}

/**
 * The per-container resolution authority — the second non-React core, paired with
 * {@link CommandScope}. It binds a registry `scope` to an {@link ActivationTracker} (its
 * **anchor** source) and answers `resolve(key)` / `execute(key)` **from the tracker's current
 * anchor**. A single {@link subscribe} coalesces *both* anchor changes and scope contribution
 * changes at the {@link CommandResolverOptions.debounce} cadence, so a consumer subscribes to
 * one thing.
 *
 * `scope` is fixed for the resolver's life; a React provider recreates + {@link dispose}s the
 * resolver when the scope changes (see design/COMMAND-DESIGN.md).
 */
export class CommandResolver {
  readonly scope: CommandScope;
  protected readonly _tracker: ActivationTracker;
  /** The bounded-walk terminal (this container's topmost node); `undefined` ⇒ the true tree root. */
  protected readonly _root?: CommandScope;
  protected readonly _debounceMs: number;
  protected _version = 0;
  protected _listeners = new Set<() => void>();
  protected _timer: ReturnType<typeof setTimeout> | undefined;
  /** Emits arrived while the debounce window was open (⇒ ONE trailing notify when it closes). */
  protected _dirty = false;
  /** Whether the tracker has ever yielded an anchor — the first one flushes undebounced (see {@link _emitAnchorChange}). */
  protected _hadAnchor: boolean = false;
  /** Scope + tracker subscriptions; (re)established by {@link connect}, torn down by {@link dispose}. */
  protected _unsubs: RemoveListener[] = [];
  protected _connected = false;
  /** Resolve-time injectors (see {@link addResolveInjector}); consulted per key in {@link resolve}. */
  protected _injectors = new Set<ResolveInjector>();

  // Keystroke handling, in lockstep with this resolver. The dispatcher (event → command) is always
  // present; how the events reach it differs: the default native auto-attach to the tracker's region
  // element, OR the host calling `dispatchKey` (when `keyBindings` is false).
  protected readonly _keyBindings: KeyBindingDispatcher;
  protected readonly _autoKeyBindings: boolean;
  protected _keyBindsEl: Element | null = null;
  protected _keyBindsDetach: RemoveListener | undefined;

  constructor(scope: CommandScope, tracker: ActivationTracker, options?: CommandResolverOptions) {
    this.scope = scope;
    this._tracker = tracker;
    this._root = options?.root;
    this._debounceMs = options?.debounce ?? 0;
    this._autoKeyBindings = options?.keyBindings ?? true;
    this._keyBindings = new KeyBindingDispatcher(this);
    // NOTE: NO side effects (no connect()) in the constructor. The owning provider's mount effect calls
    // connect(); dispose() on its cleanup. A constructor connect() would LEAK under React StrictMode: it
    // double-invokes the useMemo factory, so a discarded resolver would still have subscribed to the
    // tracker (and later attach a second keydown listener → double dispatch). Effect-only ⇒ only the
    // kept instance (whose effect runs) ever connects.
  }

  /**
   * (Re)establish this resolver's subscriptions to its scope + tracker. Idempotent. Called by the
   * owning provider's mount effect — so a resolver that was
   * {@link dispose}d on an effect *cleanup* (e.g. React StrictMode's mount→unmount→remount, or a
   * transient parent unmount) comes back to life on remount instead of staying permanently deaf.
   * Without this, the useMemo'd instance survives the cleanup but its scope subscription doesn't,
   * so contributions stop reaching `_emit` and consumers freeze.
   */
  connect(): void {
    if (this._connected) return;
    this._connected = true;
    this._unsubs = [
      this.scope.addListener({ onChange: () => this._emit() }),        // contribution changes
      this._tracker.subscribe(() => { this._syncKeyBinds(); this._emitAnchorChange(); }) // anchor / region changes
    ];
    this._syncKeyBinds(); // bind now if the region is already attached
  }

  /**
   * Anchor/region notifications: the tracker's FIRST anchor (`null` → the consumer's one-shot initial
   * anchor, or a first real focus) flushes **immediately**, bypassing any open debounce window — the
   * studio resolves its initial anchor right before the loading reveal, and the reveal must paint
   * enabled commands (a coalesced window here read as a disabled-toolbar flash). Later anchor moves
   * (focus) coalesce through the normal debounce.
   */
  protected _emitAnchorChange(): void {
    if (!this._hadAnchor && this._tracker.getAnchor() !== null) {
      this._hadAnchor = true;
      // Close any open window (dropping its pending trailing flush — the immediate leading notify
      // below covers it) so `_emit` flushes now instead of marking the window dirty.
      if (this._timer !== undefined) { clearTimeout(this._timer); this._timer = undefined; this._dirty = false; }
    }
    this._emit();
  }

  /**
   * Dispatch a keyboard event through this resolver's bindings (event → command at the current
   * anchor). The host's keystroke entry when it delivers keys itself (`keyBindings: false`) — e.g. a
   * grid terminal `Layer` tap calls this with the (synthetic) event, keeping the grid on one event
   * system. Accepts a native or React keyboard event. Returns whether it was consumed.
   */
  dispatchKey(event: DispatchKeyEvent): boolean {
    return this._keyBindings.dispatch(event);
  }

  /**
   * Resolve a command from the tracker's current anchor, bounded by this resolver's `root` terminal.
   * `origin` (keystroke dispatch only) applies per-contribution **origin containment** — see
   * {@link CommandScope.resolve}; buttons/display omit it.
   */
  resolve<STATE = any, CONTEXT = any, ARGS = void>(commandKey: string, origin?: Node | null): ResolvedCommand<STATE, CONTEXT, ARGS> | undefined {
    return this.scope.resolve<STATE, CONTEXT, ARGS>(
      commandKey, this._tracker.getAnchor() ?? undefined, this._collectInjected(commandKey), this._root, origin
    );
  }

  /**
   * The command keys reachable from the current anchor, **bounded by this resolver's `root`** — the
   * enumeration the {@link KeyBindingDispatcher} matches an event against. Bounding it here (not at
   * `scope.collectKeys`) keeps a container from binding shortcuts for commands above its terminal.
   */
  collectKeys(): string[] {
    return this.scope.collectKeys(this.getAnchor(), this._root);
  }

  /**
   * Register a {@link ResolveInjector} — a hook that may contribute a leaf (most-specific) definition
   * for a key, given the active DOM element, on every {@link resolve}. Returns a remover. Re-emits so
   * consumers re-resolve immediately (and again on removal). Both buttons and keystrokes funnel through
   * {@link resolve}, so one registration covers both paths. See design/COMMAND-INPUT-CLIPBOARD-PLAN.md.
   */
  addResolveInjector(injector: ResolveInjector): RemoveListener {
    this._injectors.add(injector);
    this._emit();
    return () => { if (this._injectors.delete(injector)) this._emit(); };
  }

  /**
   * Gather the injected leaf contributions for `commandKey` from the registered injectors, each fed the
   * **active DOM element** (`document.activeElement` — the resolver's leaf; focus/activation is handled
   * elsewhere). `undefined` when nothing is contributed, so the common path stays fully cached. Each
   * def is normalized to carry `key` so it reduces cleanly.
   */
  protected _collectInjected(commandKey: string): ICommandDefinition[] | undefined {
    if (this._injectors.size === 0) return undefined;
    const element = (typeof document !== 'undefined' ? document.activeElement : null);
    let out: ICommandDefinition[] | undefined;
    for (const injector of this._injectors) {
      const def = injector(commandKey, element);
      if (def) (out ??= []).push({ ...def, key: commandKey });
    }
    return out;
  }

  /** The tracker's current anchor (or the registry root if none) — used by the dispatcher. */
  getAnchor(): CommandScope {
    return this._tracker.getAnchor() ?? this.scope.getRoot();
  }

  /** Resolve + dispatch by key (the imperative / keystroke entry point). */
  execute<ARGS = void>(commandKey: string, args?: ARGS): Promise<boolean> {
    const cmd = this.resolve<any, any, ARGS>(commandKey);
    return cmd ? cmd.execute(args) : Promise.resolve(false);
  }

  /** Monotonic version; bumps on each (debounced) re-emit — a stable `useSyncExternalStore` snapshot. */
  getVersion(): number {
    return this._version;
  }

  /**
   * Force a re-resolution emit. For an {@link addResolveInjector injector} whose result depends on
   * **live DOM state** that changed without a scope/anchor change — e.g. the caret selection in a
   * focused input (a `selectionchange` doesn't touch the scope tree, yet a selection-gated `copy`
   * enablement must re-evaluate). Coalesced by the resolver's debounce like any other emit.
   */
  invalidate(): void {
    this._emit();
  }

  /** Subscribe to re-resolution (anchor OR contribution changed), at the debounce cadence. */
  subscribe(listener: () => void): RemoveListener {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  /**
   * Detach from scope + tracker + keybinds. Called on the provider effect's cleanup (unmount / scope
   * change). Leaves the instance **reusable**: a following {@link connect} re-establishes everything
   * (the StrictMode remount path). `_listeners` is cleared here, but consumers re-subscribe via their
   * own `useSyncExternalStore` on remount, so no listener is lost.
   */
  dispose(): void {
    this._unsubs.forEach((unsub) => unsub());
    this._unsubs = [];
    this._connected = false;
    this._keyBindsDetach?.();
    this._keyBindsDetach = undefined;
    this._keyBindsEl = null;
    // Reset the window state, not just the timeout: a stale `_timer` id would make every post-connect
    // `_emit` read "window open" and only mark dirty — a permanently silent resolver.
    if (this._timer !== undefined) { clearTimeout(this._timer); this._timer = undefined; }
    this._dirty = false;
    this._listeners.clear();
    this._injectors.clear(); // consumers re-add via their own effect on remount (like _listeners)
  }

  /**
   * Bind/rebind keystroke handling to the tracker's current region element. Called on
   * construction and whenever the tracker notifies (the region may attach after mount). A
   * tracker with no element ({@link ManualActivation}) ⇒ no keybinds — the natural opt-out.
   * Region-scoped + bubble-phase, so nested resolvers form a responder chain and multiple
   * app instances stay DOM-isolated.
   */
  protected _syncKeyBinds(): void {
    if (!this._autoKeyBindings) return; // the host delivers keys via dispatchKey()
    const element = this._tracker.getElement?.() ?? null;
    if (element === this._keyBindsEl) return;
    this._keyBindsDetach?.();
    this._keyBindsDetach = undefined;
    this._keyBindsEl = element;
    if (element) {
      this._keyBindsDetach = this._keyBindings.attach(element);
    }
  }

  protected _emit(): void {
    if (!this._debounceMs) { this._notify(); return; }
    // Leading + trailing, ONE timer per burst. When idle (no window open) emit IMMEDIATELY, so the
    // first resolution after mount/settle paints without a debounce delay — the initial toolbar
    // icons, or a settled selection — then open a window. A pure trailing debounce delayed EVERY
    // emit (including that initial one) by the full window, which showed as stale toolbar icons for
    // `debounceMs` on load. Calls landing inside the window only mark it dirty — NO timer operation
    // per call (a load burst of N emits used to churn N clearTimeout/setTimeout pairs, ~half of all
    // load self-time; design/COMMAND-EMIT-PERFORMANCE.md). The window closing flushes ONE trailing
    // notify iff anything arrived, so a sustained stream notifies at the debounce cadence.
    if (this._timer !== undefined) { this._dirty = true; return; }
    this._notify();
    this._timer = setTimeout(() => {
      this._timer = undefined;
      if (this._dirty) { this._dirty = false; this._notify(); }
    }, this._debounceMs);
  }

  protected _notify(): void {
    this._version++;
    this._listeners.forEach((listener) => listener());
  }
}
