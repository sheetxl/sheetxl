import {
  createContext, useContext, useEffect, useMemo, useRef,
  type ComponentType, type ReactNode
} from 'react';

import { type RemoveListener } from '@sheetxl/utils';

import { type CommandScope, type CommandContribution, type AnchorSource } from './CommandScope';
import { type CommandMiddleware } from './createResolvedCommand';
import { CommandChainContext, useCommandChain, useCommandOrder } from './CommandChainContext';

/**
 * Provides the registry {@link CommandScope} to descendants — the app/workbook root, or a
 * nested **feature** scope. A container's *resolution* (its `anchor` + cadence) lives in a
 * `CommandResolver` provided by `CommandAnchorProvider`, not here.
 */
export const CommandScopeContext = createContext<CommandScope | null>(null);

export function useCommandScope(): CommandScope | null {
  return useContext(CommandScopeContext);
}

/**
 * The write surface a **static** seeder needs — just `updateCommand`. Satisfied by BOTH a scope's
 * {@link CommandContribution} and the registry's `CommandRegistryContribution`, so one seeder writes into a
 * live scope's defaults OR a registry name interchangeably. (Static is permanent: no `remove`/`use`/disposer.)
 */
export type CommandCatalogTarget = Pick<CommandContribution, 'updateCommand'>;

/**
 * A **static** command contributor — seeds instance-independent presentation (icon/label/shortcut/tags) into
 * the catalog. No model, no disposer (permanent); the function reference is its stacking identity.
 */
export type StaticCommandContributor = (target: CommandCatalogTarget) => void;

/**
 * A **dynamic** command contributor — attaches model-closured behavior (callback/state/dynamic
 * `disabledReasons`, and any `use()` middleware) to a live scope for its lifetime. `data` is the single
 * per-instance context bundle (the model **and** its services together — the model-vs-services split was
 * ambiguous, so it's one thing). Returns a disposer for external subscriptions (or nothing).
 */
export type DynamicCommandContributor<T = any> = (contribution: CommandContribution, data: T) => RemoveListener | void;

/**
 * A feature's (or plugin's) command contribution — implements **either** half or **both**: `static` seeds the
 * catalog (by name), `dynamic` runs on live scope instances. This is the single shape a plugin registers to
 * inject into a named scope (design/COMMAND-DESIGN.md §"Named scopes").
 */
export interface CommandContributor<T = any> {
  static?: StaticCommandContributor;
  dynamic?: DynamicCommandContributor<T>;
}

/** Props the generic provider passes to each registered dynamic contribution component. */
export interface CommandContributionComponentProps<T = any> {
  /** The live named scope instance to contribute onto (via `scope.contribution()`). */
  scope: CommandScope;
  /** The scope's `data` bundle (the spec-determined shape). */
  data: T;
}

/**
 * A **plugin's** dynamic contribution — a React **component** rendered by the generic provider **at** the named
 * scope, so it inherits the React context there (free to use hooks like `useTaskPane()`) and contributes via
 * `props.scope.contribution()`. Renders `null`. Distinct from the scope's own {@link DynamicCommandContributor}
 * (a pure function): a plugin one may need hooks, so it is a component. Registered via
 * `CommandRegistry.registerDynamic(name, …)` and mounted by {@link CommandScopeProvider}.
 */
export type CommandContributionComponent<T = any> = ComponentType<CommandContributionComponentProps<T>>;

/**
 * The **declarative** form accepted by {@link CommandScopeProvider} in place of a pre-built scope: "create a
 * `scopeName` child of the container's ambient scope, run the `contributor`'s `dynamic` half on it for its
 * lifetime, and provide it." DRYs the create-child + contribute + provide boilerplate. The scope tree mirrors
 * the container tree because the child is created off {@link useCommandScope}.
 */
export interface CommandScopeSpec<T = any> {
  /** The child's tree key (or `{ key, name }` when the registry name differs from the key). */
  scopeName: string | { key: string; name?: string };
  /**
   * The feature's contributor; its `dynamic` half runs on the created scope (its `static` half is seeded
   * elsewhere). Optional: a scope can exist purely as a **named region** that OTHERS contribute into (the
   * script editor's, contributed by its toolbar and its editor commands) — the create/dispose/region
   * plumbing is the same either way.
   */
  contributor?: CommandContributor<T>;
  /** The single per-instance context bundle passed to `dynamic`. **Memoize it** — a new object re-runs it. */
  data?: T;
}

export interface CommandScopeProviderProps {
  /**
   * The command contribution — a {@link CommandScopeSpec} `{ scopeName, contributor, data }`. The provider
   * `createChild`s it off the ambient scope, runs the contributor's `dynamic` half for the scope's lifetime,
   * **joins the ambient pane {@link CommandChain}** (if any) at {@link CommandScopeProviderProps.order order},
   * and disposes it on unmount. **This is the one way a feature, plugin, or grid layer contributes commands**
   * (design/COMMAND-DESIGN.md §"How a layer contributes commands") — one component, no layer-specific API.
   * `null` ⇒ a pass-through (degrade on a bare grid). Mutually exclusive with {@link scope}.
   */
  spec?: CommandScopeSpec | null;
  /**
   * An **already-built** scope to provide, instead of creating one from a {@link spec}. Not created and
   * not disposed here — its owner keeps the lifecycle; this only provides it to descendants and, with an
   * {@link elementRef}, adds that element to its region.
   *
   * This is how chrome declares that it belongs to a scope it does not own: a host rendering a status
   * bar, a formula bar or a custom toolbar OUTSIDE the workbook element wraps it in
   * `<CommandScopeProvider scope={workbookScope} elementRef={…}>`, and both halves follow — its buttons
   * resolve workbook commands, and a keystroke born there reaches them too (see
   * {@link CommandScope.attachBounds}: a region is a set of containers, not one subtree). Provide with
   * no `elementRef` for resolution alone.
   */
  scope?: CommandScope | null;
  /**
   * Dispatch {@link CommandMiddleware} to register on the effective scope (via {@link CommandScope.use}) for
   * this provider's lifetime — so a feature provider can declare its `tx` wrapper without reaching for the
   * scope handle. Wraps the callbacks **this scope authors** (not inherited). Pass a **stable** reference
   * (memoize/const) — a new array each render re-registers.
   */
  use?: CommandMiddleware | readonly CommandMiddleware[];
  /**
   * The z **order** to join the ambient {@link CommandChain} at (a layer's `useLayer().zIndex`). Used only for
   * a **declarative** spec **inside a pane's chain** (mechanism 1, design/COMMAND-DESIGN.md §"Layered
   * resolver"); ignored otherwise. Falls back to the ambient {@link useCommandOrder} (default `0`). This is
   * the one grid-aware value a layer passes — everything else about being a "layer" is ambient.
   */
  order?: number;
  /**
   * The created scope's **element** — the DOM node this scope's commands belong to. Attaching one bounds
   * the scope's region for **origin containment**: its shortcuts then only dispatch for keystrokes born
   * inside the element (the `sheet` scope names the sheet element, so `Delete` → `clearContents` cannot
   * fire from a studio task pane). Leaving it off makes the scope *unrestricted*, which is only right for
   * genuinely app-global commands (`ctrl+S`). See {@link CommandScope.attachBounds}.
   *
   * Pair with {@link region} when the element is also a **focus leaf**. Bounds alone is the default
   * because most scopes are not: the `sheet` scope owns the grid's commands, but focus inside the grid
   * anchors at the pane's z-stack, one level deeper.
   *
   * Typed with a **readonly** `current` (covariant), so any element ref fits — a `useRef<HTMLDivElement>`, or
   * a typed imperative handle (`RefObject<IFormulaBarElement>`) — with no cast at the call site.
   */
  elementRef?: { readonly current: Element | null };
  /**
   * Also make {@link elementRef} a **focus region**: record it in the tree's region index
   * ({@link CommandScope.attachElement}) so a consumer's `FocusActivation` anchors here when focus lands
   * inside it. `true` ⇒ the created scope is the anchor (a formula bar, a script editor — fixed leaves);
   * an {@link AnchorSource} ⇒ a **live** leaf whose current value tracks something that moves (a pane
   * passes its `LayerActivation`, whose anchor is the z-stack top).
   *
   * Ignored without an `elementRef` — "the element only names the leaf"
   * (design/COMMAND-DESIGN.md §Guardrail).
   */
  region?: boolean | AnchorSource;
  /**
   * Hand the **created scope** back *up* to this provider's own parent (populated on mount, cleared on
   * unmount). The output counterpart of {@link elementRef}: it lets a single component **provide a scope AND
   * hold its handle** — e.g. to `resolve`/`execute` a command directly on it — without the provide-above /
   * consume-below split (a parent can't `useCommandScope()` its own child's scope). `null` while there's no
   * created scope (a `null` spec, or a bare grid with no ambient parent).
   */
  scopeRef?: { current: CommandScope | null };
  /**
   * The subtree the scope covers. As a **function** it is handed the ref for {@link elementRef} — attach
   * it to whichever node is the scope's element and the provider binds it, with no ref declaration at
   * the call site:
   *
   * ```tsx
   * <CommandScopeProvider scope={workbookScope}>
   *   {(ref) => <div ref={ref} className="status-bar">…</div>}
   * </CommandScopeProvider>
   * ```
   *
   * An explicit {@link elementRef} wins when both are given (the element already has an owner) — the
   * function still receives it, so the same child code works either way.
   */
  children?: ReactNode | ((elementRef: React.RefObject<any>) => ReactNode);
}

/**
 * Attach `ref.current` once it exists — the element may be null for a frame (the provider mounts above
 * the element it names), so retry on the next frame until it lands or the effect is torn down.
 */
export function attachWhenReady(
  ref: { readonly current: Element | null },
  attach: (el: Element) => RemoveListener
): RemoveListener {
  let cancelled = false;
  let remove: RemoveListener | undefined;
  const tryAttach = (): void => {
    if (cancelled) return;
    const el = ref.current;
    if (!el) { requestAnimationFrame(tryAttach); return; }
    remove = attach(el);
  };
  tryAttach();
  return () => { cancelled = true; remove?.(); };
}

/**
 * **A scope and its element** — the one declarative way a feature, plugin, grid layer, or host renders a
 * subtree that belongs to a command scope. Two forms, same shape:
 *
 * - {@link CommandScopeProviderProps.spec spec} — CREATE a child of the ambient scope: `createChild`, run
 *   the contributor for its lifetime, **join the ambient pane {@link CommandChain}** at
 *   {@link CommandScopeProviderProps.order order}, dispose on unmount. How a feature contributes commands.
 * - {@link CommandScopeProviderProps.scope scope} — PROVIDE an already-built one, untouched lifecycle. How
 *   chrome that renders outside a scope's element still belongs to it.
 *
 * Either way {@link CommandScopeProviderProps.elementRef elementRef} names the subtree's element, bounding
 * the scope's region (and, with {@link CommandScopeProviderProps.region region}, naming a focus leaf).
 * Optionally registers dispatch middleware via {@link CommandScopeProviderProps.use}.
 */
export function CommandScopeProvider({ spec, scope, use, order, elementRef, region, scopeRef, children }: CommandScopeProviderProps): ReactNode {
  const parent = useCommandScope();
  const chain = useCommandChain();          // the pane's z-chain, or null outside a pane
  const ambientOrder = useCommandOrder();
  const joinOrder = order ?? ambientOrder;

  // Declarative form: create the child off the container's ambient scope (so the scope tree mirrors the
  // container tree). Keyed on the stable name, NOT the spec object identity, so an inline spec literal
  // doesn't re-create the scope each render. Bare createChild doesn't notify → useMemo-at-mount is safe.
  const specName = spec ? (typeof spec.scopeName === 'string' ? spec.scopeName : spec.scopeName.key) : null;
  // NOTE: keyed on `specName` (stable string), not `spec`/`spec.scopeName` identity — intentional, so an
  // inline `{ scopeName, ... }` literal doesn't re-create the scope each render.
  const created = useMemo(
    () => (spec && parent ? parent.createChild(spec.scopeName) : null),
    [parent, specName]
  );
  // The scope this provider is ABOUT: the one it created, or the one it was handed. Only `created` gets a
  // lifecycle here — a passed-in `scope` is its owner's.
  const effective = created ?? scope ?? null;

  // Own the created scope's lifecycle. Inside a pane's chain it JOINS at `joinOrder` (mechanism 1 —
  // reparent-on-insert by z; design/COMMAND-DESIGN.md §"Layered resolver"); otherwise it stays parented at its
  // React ancestor (the createChild default). Unregister BEFORE dispose so the stack re-chains ahead of teardown.
  useEffect(() => {
    if (!created) return undefined;
    const unregister = chain ? chain.register(created, joinOrder) : undefined;
    return () => { unregister?.(); created.dispose(); };
  }, [created, chain, joinOrder]);

  // Run the contributor's `dynamic` half on the created scope for its lifetime, tearing down on unmount /
  // data change.
  const dynamic = spec?.contributor?.dynamic;
  const data = spec?.data;
  useEffect(() => {
    if (!created || !dynamic) return undefined;
    const contribution = created.contribution();
    const dispose = dynamic(contribution, data);
    return () => { if (typeof dispose === 'function') dispose(); contribution.remove(); };
  }, [created, dynamic, data]);

  useEffect(() => {
    if (!created || !use) return;
    const list = Array.isArray(use) ? use : [use];
    const removers = list.map((middleware) => created.use(middleware));
    return () => { for (const remove of removers) remove(); };
  }, [created, use]);

  // Expose the scope up to the parent (output ref) — so one component can provide + hold the handle.
  useEffect(() => {
    if (!scopeRef) return undefined;
    scopeRef.current = effective;
    return () => { scopeRef.current = null; };
  }, [scopeRef, effective]);

  // Name this scope's element. BOUNDS by default (origin containment — the shortcuts only fire for keys
  // born inside it); `region` additionally records it in the tree's region index as a focus leaf, with the
  // scope as the anchor source or, when `region` IS a source, that live one. `children` as a function is
  // handed this ref, so a call site can name its element without declaring one.
  const refOwn = useRef<Element | null>(null);
  const refElement = elementRef ?? refOwn;
  // Only bind when an element was actually promised — an explicit `elementRef`, or function children that
  // are handed `refOwn` to attach. Otherwise there is no element to wait for, and waiting would spin the
  // retry frame-after-frame for the provider's whole life.
  const named = !!elementRef || typeof children === 'function';
  useCommandElement(named ? effective : null, refElement, region);

  // Plugin dynamic contributions registered for this scope's NAME (`CommandRegistry.registerDynamic`) — mounted
  // here, AT the scope, so each inherits the React context (free to use hooks) and contributes via
  // `props.scope.contribution()`. Only the declarative (`created`) form mounts these; a pre-built scope's owner
  // renders its own. Registered at app-init, so the set is stable by mount.
  const dynamicComponents = useMemo(
    () => (created ? (created.getRegistry()?.getDynamic(created.name) ?? []) : []),
    [created]
  );

  return (
    <CommandScopeContext.Provider value={effective}>
      {/* A scope that JOINED the chain consumes it: its descendants parent normally (chain → null), so a
          nested feature under a layer doesn't re-join the z-stack. A null spec passes the chain through. */}
      <CommandChainContext.Provider value={created ? null : chain}>
        {created && dynamicComponents.map((Contribution, i) => (
          <Contribution key={i} scope={created} data={data} />
        ))}
        {typeof children === 'function' ? children(refElement as React.RefObject<any>) : children}
      </CommandChainContext.Provider>
    </CommandScopeContext.Provider>
  );
}

/**
 * Name a scope's **element** — the primitive {@link CommandScopeProvider} is built on, for a component
 * that already owns both. Bounds the scope's region ({@link CommandScope.attachBounds}) so its commands
 * only dispatch for keystrokes born inside the element; `region` additionally records it in the tree's
 * region index as a focus leaf (`true` ⇒ the scope is the anchor, an {@link AnchorSource} ⇒ a live leaf).
 *
 * Prefer the provider — `<CommandScopeProvider scope={…} elementRef={…}>` — which also puts the scope in
 * context for the subtree; reach for the hook when the element and the scope are already in hand and
 * there is nothing to wrap.
 *
 * Re-attaches when `scope`, `elementRef` or `region` changes and detaches on unmount. A `null` scope is a
 * no-op, so a chromeless host degrades quietly.
 */
export function useCommandElement(
  scope: CommandScope | null | undefined,
  elementRef: { readonly current: Element | null },
  region?: boolean | AnchorSource
): void {
  useEffect(() => {
    if (!scope) return undefined;
    if (!region) return attachWhenReady(elementRef, (el) => scope.attachBounds(el));
    const source = region === true ? undefined : region;
    return attachWhenReady(elementRef, (el) => scope.attachElement(el, source));
  }, [scope, elementRef, region]);
}
