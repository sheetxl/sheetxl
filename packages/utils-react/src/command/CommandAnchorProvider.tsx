import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

import { CommandResolver } from './CommandResolver';
import { type CommandScope } from './CommandScope';
import { type ActivationTracker } from './ActivationTracker';
import { useCommandScope, attachWhenReady, type CommandScopeProviderProps } from './CommandScopeContext';

export const CommandResolverContext = createContext<CommandResolver | null>(null);

export function useCommandResolver(): CommandResolver | null {
  return useContext(CommandResolverContext);
}

export interface CommandAnchorProviderProps {
  /** This container's activation — its anchor source (region-scoped focus, or manual). */
  tracker: ActivationTracker;
  /** Display cadence (ms); coalesces anchor + contribution changes for this container. */
  debounce?: number;
  /**
   * Keystroke delivery for this container's resolver:
   * - `true` (default): auto-attach **native** keystroke handling to the tracker's region element
   *   ({@link CommandResolverOptions.keyBindings}).
   * - `false`: the host delivers keys to the resolver's `dispatchKey` itself — e.g. a grid routing
   *   them through its synthetic Stage responder chain, or a toolbar-only container with no
   *   keystroke surface at all.
   * - `'synthetic'`: this provider renders the delivery seam itself — a layout-inert
   *   (`display:contents`) wrapper whose **synthetic** `onKeyDown` feeds `dispatchKey`. In the one
   *   React keystroke bubble it is the outermost handler — the container's "dispatcher of last
   *   resort" — so an inner layer's synthetic `stopPropagation` pre-empts it (a native ancestor
   *   listener would fire ahead of every React handler and could not be pre-empted; that ordering
   *   bug is why this mode exists). The tracker (if it implements
   *   {@link ActivationTracker.attach}) is bounded to the same element, keeping the anchor's
   *   focus region and the key-delivery region identical.
   */
  keyBindings?: boolean | 'synthetic';
  /**
   * Bound this container's **focus walk** to an element: the tracker only follows focus that lands inside
   * it, so focus elsewhere leaves the anchor where it was (a script pane's toolbar stays live while the
   * user clicks into the grid). The consumer-side counterpart of a scope's
   * {@link CommandScopeProviderProps.elementRef} — same element, different job: that one decides which
   * *commands* a keystroke may reach, this one decides where the *anchor* may move.
   *
   * `'synthetic'` delivery bounds the tracker to its own key seam when this is omitted, keeping the
   * anchor's region and the key-delivery region identical.
   */
  elementRef?: { readonly current: Element | null };
  /**
   * The bounded-walk **terminal** — this container's topmost node (e.g. the `sheet` scope for a
   * context menu). Omit ⇒ walk to the true tree root (the studio default). See
   * {@link CommandResolverOptions.root}.
   */
  root?: CommandScope;
  children: ReactNode;
}

/**
 * Per-container provider: binds the ambient registry scope to this container's
 * {@link ActivationTracker} as a {@link CommandResolver}, and provides it to descendants.
 * Each container (main toolbar / scripting toolbar / context menu) wraps its own → different
 * anchors on screen at once. Recreates + disposes the resolver when scope/tracker/debounce/root
 * change.
 */
export function CommandAnchorProvider({ tracker, debounce, keyBindings, root, elementRef, children }: CommandAnchorProviderProps): ReactNode {
  const scope = useCommandScope();
  const synthetic = keyBindings === 'synthetic';
  const resolver = useMemo(
    // 'synthetic' delivery is owned here (the seam below feeds dispatchKey), so the resolver itself
    // never native-attaches — same as a host-delivered `false`.
    () => (scope ? new CommandResolver(scope, tracker, { debounce, keyBindings: synthetic ? false : keyBindings, root }) : null),
    [scope, tracker, debounce, keyBindings, root]
  );
  // connect on mount / re-established on a StrictMode (or transient) remount; dispose on cleanup. The
  // resolver is created in useMemo (so children can resolve during render) but its scope/tracker
  // subscriptions are owned by this effect — connect() makes a disposed-then-reused instance live again.
  useEffect(() => {
    resolver?.connect();
    return () => resolver?.dispose();
  }, [resolver]);
  // Bound the tracker's focus walk: to `elementRef` when given, else — in 'synthetic' mode — to the seam
  // element, so the anchor follows focus within exactly the subtree whose unconsumed keys the seam delivers.
  const refSeam = useRef<HTMLDivElement>(null);
  const boundsRef = elementRef ?? (synthetic ? refSeam : null);
  useEffect(() => {
    if (!boundsRef || !tracker.attach) return undefined;
    return attachWhenReady(boundsRef, (el) => tracker.attach!(el));
  }, [boundsRef, tracker]);
  if (!synthetic) {
    return <CommandResolverContext.Provider value={resolver}>{children}</CommandResolverContext.Provider>;
  }
  return (
    <CommandResolverContext.Provider value={resolver}>
      {/* The synthetic key seam: layout-inert; in the one React keystroke bubble it is this
          container's OUTERMOST handler, so it only sees keys no inner layer consumed. */}
      <div
        className="sxl-command-key-seam"
        style={{ display: 'contents' }}
        ref={refSeam}
        onKeyDown={(e) => { resolver?.dispatchKey(e); }}
      >
        {children}
      </div>
    </CommandResolverContext.Provider>
  );
}

/**
 * An execute-by-key bound to the current container's resolver (anchor included). For
 * imperative dispatch — a "fire" button, a keystroke — where you don't hold a resolved
 * command. A rendered button just calls `cmd.execute()` instead.
 */
export function useCommandExecute(): (commandKey: string, args?: any) => Promise<boolean> {
  const resolver = useCommandResolver();
  return useCallback(
    (commandKey: string, args?: any) => (resolver ? resolver.execute(commandKey, args) : Promise.resolve(false)),
    [resolver]
  );
}
