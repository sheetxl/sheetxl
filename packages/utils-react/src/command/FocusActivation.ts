import { type RemoveListener, type MaybePromise } from '@sheetxl/utils';

import { type CommandScope, type AnchorSource, resolveAnchorSource } from './CommandScope';
import { type ActivationTracker } from './ActivationTracker';

/**
 * A **recallable default-anchor provider** — the function form of {@link FocusActivation}'s initial
 * anchor. Returns a fresh default anchor (an `Element` resolved through the region walk, a fixed
 * {@link AnchorSource}, or `null`), synchronously or as a `Promise`. Invoked at cold-start and re-invoked
 * whenever the live anchor's element is destroyed (the destruction fallback — see the class doc).
 */
export type DefaultAnchorProvider = () => MaybePromise<Element | AnchorSource | null>;

/** The initial-anchor argument: a one-shot value/`Promise` seed, or a recallable {@link DefaultAnchorProvider}. */
export type FocusActivationInitial =
  | MaybePromise<Element | AnchorSource | null>
  | DefaultAnchorProvider;

/**
 * A focus-driven {@link ActivationTracker}: the anchor follows DOM focus **within the region
 * it's attached to**. The new-model counterpart of `CommandGroup._activate` — the element
 * walk and de-dupe guard are kept (the `relatedTarget === null` "just for testing" bail is
 * dropped, so a first focus-in still activates).
 *
 * It is **region-scoped**: `findScope` is bounded by the attached root, so focus *outside*
 * that root never changes the anchor. That's how "main toolbar tracks focus anywhere"
 * (attach to the app root) and "scripting toolbar tracks focus only in the editor" (attach to
 * the editor element) are the *same* class with different attach points — focus leaving the
 * editor simply leaves the scripting tracker's anchor untouched.
 *
 * **The anchor starts `null` and there is no standing "default" slot.** A consumer that wants a
 * live anchor before the user ever focuses supplies an **initial anchor** to the constructor — a
 * value or a `Promise` it resolves at its own lifecycle moment (the studio: the loaded grid's
 * center pane, right before the loading reveal). The initial anchor is a *synthetic first focus*:
 * it lands in the same single slot real focus writes to (an `Element` is resolved through the same
 * region walk a `focusin` takes), does nothing if focus got there first, and is advanced by later
 * focus like any other anchor. Grids never steal real focus for this.
 *
 * **Destruction fallback — a recallable provider (COMMAND-DESIGN.md open-Q5).** If the initial
 * anchor is supplied as a **function**, it is a *default-anchor provider*: invoked once for
 * cold-start AND **re-invoked whenever the live anchor's element is destroyed** — e.g. a resize
 * that shrinks the grid past its min unmounts the focused pane, dropping DOM focus to `<body>`
 * with no `focusin` to observe. Left alone, `getAnchor()` would keep resolving through the now-
 * detached region (the "anchor out of the root" symptom). Instead {@link getAnchor} notices the
 * anchored element is no longer connected, drops it, and asks the provider for a fresh default
 * (the studio: the pane focus *would* land on — last-focused, else center). The consumer owns
 * that policy; the tracker only owns *when* to ask. A one-shot value/`Promise` cannot be re-run,
 * so it seeds once with no recall — pass a function to opt into the fallback.
 *
 * **Leaf-only, two producers (design/COMMAND-DESIGN.md §"resolution model").** This is the `Focus`
 * producer; {@link ManualActivation} is the other. A chain change bumps the root version, so a {@link CommandResolver} — which also
 * subscribes to scope changes — re-resolves and re-reads the live top; no effective-region subscription
 * is needed here.
 */
export class FocusActivation implements ActivationTracker {
  protected _scopes = new Map<Element, AnchorSource>();
  /**
   * The **command tree root** this tracker also *reads* on its focus walk (pull-model discovery —
   * design/COMMAND-DESIGN.md §"Fold the region bridge into the tree"). Focus regions record their element →
   * region on the tree via {@link CommandScope.attachElement}; every consumer's `FocusActivation`
   * (constructed with the same root) discovers them. `findSource` consults this tracker's own `register`ed
   * sources first, then the tree's shared region index (`root.getRegion`). Omit for the standalone case
   * (tests/stories that `register` directly into the tracker).
   */
  protected readonly _root: CommandScope | null;
  protected _rootElement: Element | null = null;
  protected _lastFocusEvent: FocusEvent | null = null;
  protected _current: AnchorSource | null = null;
  /**
   * The **region-owner element** `_current` was resolved through (the pane's `Stage`, the editor
   * leaf — NOT the deepest focused node, which the grid virtualizes/recycles). Watched for
   * destruction: {@link getAnchor} drops the anchor and recalls when this goes `!isConnected`.
   * `null` when the anchor was seeded from a bare {@link AnchorSource} (no element to watch).
   */
  protected _currentElement: Element | null = null;
  /** The recallable default-anchor provider (function-form initial anchor), or `null`. See the class doc. */
  protected _recall: DefaultAnchorProvider | null = null;
  /** Guards against scheduling/running more than one recall at a time (getAnchor is a hot read). */
  protected _recallPending = false;
  protected _listeners = new Set<() => void>();

  /**
   * @param root The command tree **root** to read on the focus walk (pull discovery — regions record via
   * {@link CommandScope.attachElement}). Omit for a standalone tracker whose regions {@link register}
   * directly into it (tests/stories).
   * @param initialAnchor Optional initial anchor. Two forms:
   * - a **one-shot seed** — a fixed {@link AnchorSource} (scope or live getter), an `Element` resolved
   *   through the same region walk a real focus takes (retried a few frames — the region may register
   *   just after the consumer resolves, e.g. a first-paint callback racing the registration effect), or a
   *   `Promise` the consumer settles at its own moment (the studio: post-load, pre-reveal). Seeds once;
   *   inert if real focus set the anchor first.
   * - a **{@link DefaultAnchorProvider}** (a function) — the same synthetic first focus, but *recallable*:
   *   re-invoked whenever the live anchor's element is destroyed (the destruction fallback, class doc).
   */
  constructor(root?: CommandScope | null, initialAnchor?: FocusActivationInitial) {
    this._root = root ?? null;
    if (typeof initialAnchor === 'function') {
      // A function is a recallable provider (an `AnchorSource` getter passed here is treated as one too —
      // the widened meaning, 2026-07-25): seed now, and again on destruction via getAnchor's recall.
      this._recall = initialAnchor as DefaultAnchorProvider;
      this._invokeRecall();
    } else if (initialAnchor != null) {
      if (initialAnchor instanceof Promise) {
        initialAnchor.then((value) => { if (value != null) this._seed(value); }, () => { /* consumer abandoned the seed */ });
      } else {
        this._seed(initialAnchor);
      }
    }
  }

  /**
   * Invoke the {@link DefaultAnchorProvider} and seed its result (an `Element` goes through the region
   * walk, a source lands directly; a `Promise` seeds on settle). No-op if there's no provider or focus
   * has already produced an anchor since the recall was scheduled — the seed is inert either way, but
   * skipping avoids a needless provider call. Clears the pending guard.
   */
  protected _invokeRecall(): void {
    this._recallPending = false;
    if (!this._recall || this._current !== null) return;
    const result = this._recall();
    if (result instanceof Promise) {
      result.then((value) => { if (value != null) this._seed(value); }, () => { /* provider declined */ });
    } else if (result != null) {
      this._seed(result);
    }
  }

  /**
   * Apply the one-shot initial anchor: first real focus wins; an `Element` resolves via the region
   * walk (retrying across a few frames — see the constructor doc), a source lands directly.
   */
  protected _seed(value: Element | AnchorSource, attempts: number = 0): void {
    if (this._current !== null) return; // real focus already produced an anchor — the seed is inert
    if (typeof Element !== 'undefined' && value instanceof Element) {
      const entry = this._findSourceEntry(value);
      if (!entry) {
        // The region may register a beat later (mount effects / rAF retries) — retry briefly.
        if (attempts < 30 && typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => this._seed(value, attempts + 1));
        }
        return;
      }
      this._current = entry.source;
      this._currentElement = entry.element; // watch the region owner for destruction (recall trigger)
    } else {
      this._current = value as AnchorSource;
      this._currentElement = null; // a bare source has no element to watch — no destruction fallback
    }
    this._notify();
  }

  // --- ActivationTracker -----------------------------------------------------

  /**
   * The focus-driven anchor (`null` until the initial anchor / first focus lands). A dynamic-leaf
   * source (a getter) is evaluated **live** each call, so a pane always anchors at its *current* chain top.
   */
  getAnchor(): CommandScope | null {
    // Destruction fallback (COMMAND-DESIGN.md open-Q5): the anchored region's owner element was torn
    // out of the DOM (a resize past the grid min unmounts the focused pane; focus drops to `<body>`
    // with NO focusin to observe). Keeping it would resolve through an orphan out of the root. Drop it
    // and, if a provider was supplied, recall a fresh default. `isConnected` also naturally preserves
    // "blur leaves it": a merely-blurred-but-still-mounted region stays connected, so it's kept.
    if (this._currentElement && !this._currentElement.isConnected) {
      this._current = null;
      this._currentElement = null;
      if (this._recall && !this._recallPending) {
        this._recallPending = true;
        // Defer: recall seeds → notifies listeners, which must not re-enter a resolve running during
        // React render (getAnchor is read from resolve). A microtask runs after the current stack settles.
        Promise.resolve().then(() => this._invokeRecall());
      }
    }
    return resolveAnchorSource(this._current);
  }

  /** The attached region (or `null` before {@link attach}). Keystroke handling binds here. */
  getElement(): Element | null {
    return this._rootElement;
  }

  subscribe(listener: () => void): RemoveListener {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  // --- setup -----------------------------------------------------------------

  /**
   * Associate a DOM element with an {@link AnchorSource} (a provider calls this with its element ref).
   * Pass a **getter** for a dynamic leaf (a pane's `Stage` → its live chain top); a fixed scope for an
   * ordinary region (the editor's own element).
   */
  register(element: Element, source: AnchorSource): RemoveListener {
    this._scopes.set(element, source);
    return () => { this._scopes.delete(element); };
  }

  /**
   * The nearest registered anchor **source** at or above `element`, bounded by the attached root.
   * Pure DOM-tree walk; `undefined` if none, or if `element` is outside the attached root.
   */
  findSource(element: Element | null): AnchorSource | undefined {
    return this._findSourceEntry(element)?.source;
  }

  /**
   * Like {@link findSource}, but also returns the **element the source was matched at** (the region
   * owner — the `Stage`/editor element that registered it, NOT the deeper focused node). The anchor
   * watches that owner element for destruction (see {@link getAnchor}); the grid recycles the deep
   * focused node during virtualization, so watching it would false-trigger the recall.
   */
  protected _findSourceEntry(element: Element | null): { source: AnchorSource; element: Element } | undefined {
    let current: Element | null = element;
    while (current) {
      if (this._rootElement && !this._rootElement.contains(current)) return undefined;
      // This tracker's own registrations first, then the tree's shared region index (pull discovery). A shared
      // hit is a live `AnchorSource` returned by reference, so its identity is stable across focus events (no churn).
      const own = this._scopes.get(current);
      if (own) return { source: own, element: current };
      const shared = this._root?.getRegion(current);
      if (shared) return { source: shared, element: current };
      current = current.parentElement;
    }
    return undefined;
  }

  /**
   * The nearest registered **scope** at or above `element` (a dynamic-leaf source is resolved to its
   * current value). `undefined` if none is registered on the bounded walk.
   */
  findScope(element: Element | null): CommandScope | undefined {
    return resolveAnchorSource(this.findSource(element) ?? null) ?? undefined;
  }

  /** Start tracking focus within `rootElement` (its region of interest). */
  attach(rootElement: Element): RemoveListener {
    this._rootElement = rootElement;
    const handler = (e: Event): void => this._handleFocus(e as FocusEvent);
    rootElement.addEventListener('focusin', handler);
    // Notify: the region is now known, so a resolver can bind keystroke handling here.
    this._notify();
    return () => {
      rootElement.removeEventListener('focusin', handler);
      if (this._rootElement === rootElement) {
        this._rootElement = null;
        this._notify(); // region gone → resolver unbinds
      }
    };
  }

  protected _handleFocus(event: FocusEvent): void {
    // De-dupe the same event (one focus can surface via multiple listeners).
    if (this._lastFocusEvent === event) return;
    this._lastFocusEvent = event;

    const active = (typeof document !== 'undefined' ? document.activeElement : null);
    const entry = this._findSourceEntry((active as Element) ?? (event.target as Element));
    // Only a focus GAIN of a participating region (inside this root) changes the anchor. Focus landing
    // on unmapped chrome (a toolbar button) yields no entry, so the anchor — and the element it watches
    // — are left put ("blur leaves it"). When there IS an entry, refresh the watched owner element even
    // if the source is unchanged (focus moved within the same region to a newer element), then advance
    // the anchor by SOURCE identity — a region's getter is one stable source even as its live top moves.
    if (entry) {
      this._currentElement = entry.element;
      if (entry.source !== this._current) {
        this._current = entry.source;
        this._notify();
      }
    }
  }

  protected _notify(): void {
    this._listeners.forEach((listener) => listener());
  }
}
