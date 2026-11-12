import { type RemoveListener } from '@sheetxl/utils';

import { type CommandScope } from './CommandScope';

/**
 * Produces "the current anchor" (resolution leaf) for a {@link CommandResolver} and notifies
 * when it changes. The activation strategy, pluggable per container: focus-driven
 * (`FocusActivation`, region-scoped) or code-driven ({@link ManualActivation}).
 */
export interface ActivationTracker {
  /** The current anchor scope, or `null` before any activation. */
  getAnchor(): CommandScope | null;
  /** Fires when the anchor changes — and, for region trackers, when the region attaches/detaches. */
  subscribe(listener: () => void): RemoveListener;
  /**
   * The DOM region this tracker watches, if any (e.g. a `FocusActivation`'s attached root), or
   * `null`/absent for code-driven trackers ({@link ManualActivation}). A {@link CommandResolver}
   * uses it to attach keystroke handling **on the same element the anchor follows** — keybinds
   * in lockstep with focus, no separate provider. `subscribe` fires when this changes.
   */
  getElement?(): Element | null;
  /**
   * Region trackers (e.g. `FocusActivation`) implement this: start watching `rootElement` as the
   * region of interest, returning the detach. A `CommandAnchorProvider` in `'synthetic'`
   * key-delivery mode bounds its tracker to the seam element through this — the anchor follows
   * focus within exactly the subtree whose unconsumed keys the seam delivers. Absent on
   * code-driven trackers ({@link ManualActivation}).
   */
  attach?(rootElement: Element): RemoveListener;
}

/**
 * A code-driven {@link ActivationTracker}: the anchor is set imperatively (e.g. a context
 * menu's clicked-target snapshot on open). Not focus-driven.
 */
export class ManualActivation implements ActivationTracker {
  protected _current: CommandScope | null;
  protected _listeners = new Set<() => void>();

  constructor(initial: CommandScope | null = null) {
    this._current = initial;
  }

  getAnchor(): CommandScope | null {
    return this._current;
  }

  setAnchor(scope: CommandScope | null): void {
    if (this._current === scope) return;
    this._current = scope;
    this._listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void): RemoveListener {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }
}

/**
 * A **fixed-anchor** {@link ActivationTracker}: always reports the same scope and never notifies. The
 * degenerate "region with no layers" — useful to hand a plain static scope to an API that wants a tracker,
 * so it reads the same as a {@link LayerActivation} stack. (A bare `CommandScope` region does not need one:
 * `attachElement` stores it directly and `resolveAnchorSource` returns it as-is.)
 */
export class ConstantActivation implements ActivationTracker {
  constructor(protected readonly _scope: CommandScope | null) {}
  getAnchor(): CommandScope | null { return this._scope; }
  subscribe(): RemoveListener { return () => { /* never changes */ }; }
}
