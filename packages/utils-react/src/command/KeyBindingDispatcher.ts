import { type RemoveListener } from '@sheetxl/utils';

import { KeyModifiers, type IKeyStroke } from '../types';
import { isEditable } from '../utils/ReactUtils';

import { type CommandResolver } from './CommandResolver';

/**
 * The minimal keyboard-event shape {@link KeyBindingDispatcher.dispatch} needs. Satisfied by BOTH a
 * native `KeyboardEvent` (the {@link KeyBindingDispatcher.attach} path, for generic regions) and a
 * React `KeyboardEvent` (the grid's synthetic terminal-tap path) — so the grid can stay on
 * one event system instead of mixing a native listener into its synthetic Stage dispatch.
 */
export interface DispatchKeyEvent {
  readonly key: string;
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  /**
   * The event's **origin** (the focused element the keystroke was delivered to) — read by the
   * origin-containment rule (see {@link KeyBindingDispatcher.dispatch}). Optional: a caller that
   * can't supply one (a hand-built test event) is treated as unrestricted.
   */
  readonly target?: EventTarget | null;
  preventDefault(): void;
  stopPropagation(): void;
}

/**
 * TEMPORARY keystroke tracing for diagnosing "who ate my key" — off unless the page turns it on:
 * `window.__sxlKeyDebug = true` in the console. Logs every event that REACHES a dispatcher (so a key
 * a widget consumed correctly is visible by its ABSENCE) with the origin element and the verdict.
 */
function keyDebug(event: DispatchKeyEvent, commandKey: string | null, verdict: string): void {
  if (!(globalThis as any).__sxlKeyDebug) return;
  const el = event.target as Element | null;
  const describe = (n: Element | null): string => {
    if (!n?.tagName) return String(n);
    const type = (n as HTMLInputElement).type ? `[type=${(n as HTMLInputElement).type}]` : '';
    const cls = n.getAttribute?.('class')?.split(' ').slice(0, 2).join('.') ?? '';
    return `${n.tagName.toLowerCase()}${type}${cls ? '.' + cls : ''}`;
  };
  const mods = [event.ctrlKey && 'ctrl', event.metaKey && 'meta', event.altKey && 'alt', event.shiftKey && 'shift']
    .filter(Boolean).join('+');
  console.log(
    `[sxl:key] ${mods ? mods + '+' : ''}${event.key} → ${verdict}${commandKey ? ` (${commandKey})` : ''}`,
    { origin: describe(el), editable: isEditable(el), delivery: (event as any).nativeEvent ? 'synthetic' : 'native' }
  );
}

/** Deletion + caret-motion keys, in every modifier combination (`ctrl+Backspace` deletes a word). */
const CARET_KEYS = new Set<string>([
  'Backspace', 'Delete', 'Insert',
  'Home', 'End', 'PageUp', 'PageDown',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'
]);

/**
 * Whether the keystroke is one a **caret** owns: deletion or caret motion — `Delete`, `Backspace`,
 * `Insert`, `Home`/`End`, `PageUp`/`PageDown`, the arrows — in every modifier variant, since
 * `ctrl+Backspace` deletes a word and `shift+ArrowLeft` extends a selection.
 *
 * The **shared** definition of what a focused text widget consumes with `stopPropagation`
 * (`useEditCommit`'s `handleTextKeys`; the grid's `useEditorKeymap` consumes the same set per mode).
 *
 * Two deliberate exclusions:
 * - `Enter` / `Tab` / `Escape` and the function keys — commit/traverse keys the command tree must keep
 *   seeing, even from inside an editor;
 * - the native text chords (`mod` + `a`/`c`/`x`/`v`/`z`/`y`) — those SHOULD reach the dispatcher, where
 *   the **input-clipboard injector** answers them for an editable origin with a leaf contribution that
 *   acts on the focused element. Consuming them at the widget would route copy through the browser
 *   clipboard instead of the app's, so the grid and an input would no longer share one.
 *
 * There is no dispatcher-side counterpart on purpose: a widget consuming its OWN caret keys is
 * unambiguous, whereas the dispatcher second-guessing the target's TYPE is the banned defer (Core law,
 * consequence 1). What keeps a grid command off a key born in a task pane is **origin containment**,
 * not this — see {@link CommandScope.contains}.
 */
export function isCaretKey(event: Pick<DispatchKeyEvent, 'key'>): boolean {
  return CARET_KEYS.has(event.key);
}

/**
 * Maps a keyboard **event → command key**, then dispatches through a {@link CommandResolver}
 * (so a shortcut resolves against the resolver's *anchor* exactly like a button — the same
 * cascade/override). Ctrl/meta are treated alike, with an `e.code` → `e.key` fallback and
 * `Key*`/`Digit*` prefix stripping. See design/COMMAND-DESIGN.md "key dispatching".
 *
 * **The dispatch law (design/COMMAND-DESIGN.md "Core law — one keystroke bubble"):** this is the
 * **terminal handler of one bubble**. A keystroke goes *down the z-stack first* (every layer is
 * offered it via the Stage responder chain; a layer that handles it calls `stopPropagation()`),
 * and only what **no layer consumed** bubbles up to this dispatcher (attached at the region root),
 * which resolves it *up the command scope hierarchy*. So `stopPropagation` is the **only** consume
 * signal — a stopped key never reaches us — and there is **no** competing target-type defer.
 *
 * **Origin containment (the second half of the law):** dispatch resolves **origin-filtered** — the
 * event's origin (`event.target`) is passed into `CommandScope.resolve`, whose gather loop omits
 * every contribution from a node whose **`CommandScope.contains(origin)`** rejects it (the scope
 * OWNS the decision: any of its own `attachElement`ed elements DOM-contains the origin, else its
 * parent decides, none up the chain ⇒ unrestricted — and a region owner can attach a portaled
 * container as an additional element). Per **contribution**, not per command: a key born in a task pane omits a sheet-layer's
 * portion but keeps a `workbook`-level portion of the *same* command — the cascade falls through to
 * the permitted callback — and a command whose every contribution is omitted doesn't resolve at all
 * (the binding doesn't exist for that origin; the key stays with the input). This is what keeps a
 * *pane-layer* command (selection nav, clipboard) from firing off a keystroke born in an
 * **orthogonal** subtree — a task-pane input's ArrowDown moves its caret, not the grid selection —
 * while a keystroke a layer deliberately *lets propagate* (the cell editor's commit Enter) still
 * dispatches, because it originates inside the pane's Stage. NOT a target-*type* rule: it never asks
 * "is the target an input?", only "is the origin inside the contributor's region?" — so it cannot
 * re-introduce the editable-defer that broke edit-mode commits.
 *
 * **Containment only works for scopes that BOUND themselves.** An element-less scope is unrestricted
 * by design (consequence 3) — right for `app`-tier commands (`ctrl+S` must save while the caret is in
 * a task-pane field), wrong for anything acting on the grid. A `sheet`-scope binding left unbounded is
 * how `Delete` came to run `clearContents` from a comment box (clearing cells and dirtying the
 * workbook mid-keystroke). The rule for authors: **if a command needs a UI region, bound its scope**
 * (`CommandScope.attachBounds`); leave a scope element-less only when its commands are genuinely
 * app-global.
 *
 * **Anchor-dependent by construction:** because it asks the resolver, the *same* dispatcher
 * yields different commands as the anchor moves — the app root owns one over the main
 * resolver; a region (e.g. the scripting editor) can own its own over its resolver, so its
 * bindings win only while focused there.
 *
 * Not built yet (seams left): multi-stroke **chords** (a pending-stroke state) and a **user
 * keybinding override** map consulted before the contributed defaults.
 */
export class KeyBindingDispatcher {
  protected readonly _resolver: CommandResolver;
  protected _lastEvent: DispatchKeyEvent | null = null;

  constructor(resolver: CommandResolver) {
    this._resolver = resolver;
  }

  /**
   * The command key bound to `event` at the resolver's current anchor, or `undefined`.
   * Enumerates the keys reachable from the anchor, resolves each **origin-filtered** (see the class
   * doc — resolution omits every contribution whose region doesn't contain the event's origin), and
   * matches its shortcut(s) — so an overridden shortcut resolves through the cascade like any other
   * property, and a fully-omitted command simply doesn't resolve (the binding doesn't exist for this
   * origin; another command on the same shortcut may still match).
   */
  findKey(event: DispatchKeyEvent): string | undefined {
    const candidates = this._eventCandidates(event);
    const origin = this._eventOrigin(event);
    const keys = this._resolver.collectKeys();
    for (const commandKey of keys) {
      const shortcut = this._resolver.resolve(commandKey, origin)?.getShortcut();
      if (!shortcut) continue;
      const list = Array.isArray(shortcut) ? shortcut : [shortcut as IKeyStroke];
      for (const ks of list) {
        if (candidates.has(this._shortcutString(ks))) return commandKey;
      }
    }
    return undefined;
  }

  /** The event's origin as a containment-checkable node, or `null` (unverifiable ⇒ unfiltered). */
  protected _eventOrigin(event: DispatchKeyEvent): Node | null {
    const target = event.target;
    return (target && typeof (target as Node).nodeType === 'number') ? (target as Node) : null;
  }

  /**
   * Match `event` and, if it maps to an enabled command, `preventDefault()` +
   * `stopPropagation()` + dispatch it (the resolver's `execute` fires the ripple/observers).
   * Returns whether the event was consumed.
   *
   * **Responder chain:** dispatchers attach to their region's element, so DOM bubbling makes
   * the innermost region fire first; consuming (`stopPropagation`) keeps a parent region's
   * dispatcher from re-handling it, while an unmatched key is left to bubble up to the next
   * region and ultimately the Studio-level backstop.
   *
   * **No target-type defer (the dispatch law).** A key that *reaches* `dispatch` is one the
   * z-stack did not consume, so it is dispatched on its own merit — there is no "is the focus an
   * input?" second-guess. A widget that wants a key (a focused text input, the cell editor in edit
   * mode) opts out by `stopPropagation`-ing it, so `dispatch` is never called for it. This is what
   * keeps consumption to a single signal (design/COMMAND-DESIGN.md "Core law — one keystroke
   * bubble"); the editable-target heuristic that used to live here was a competing rule and is gone.
   * The one *structural* gate is **origin containment** (see the class doc): resolution itself omits
   * every contribution whose region doesn't contain the event's origin — about *where the key was
   * born*, never *what kind of element* it was born on.
   */
  dispatch(event: DispatchKeyEvent): boolean {
    // De-dupe the same event surfacing via multiple attach points on this dispatcher.
    if (this._lastEvent === event) {
      keyDebug(event, null, 'de-duped (reached dispatch again)');
      return false;
    }
    this._lastEvent = event;

    const commandKey = this.findKey(event);
    if (!commandKey) { keyDebug(event, null, 'unmatched'); return false; } // let it bubble to the next region up
    // Resolve with the SAME origin filter the match used — the executed callback must be the
    // permitted portion (a task-pane key runs the workbook-level callback, not a pane-layer override).
    const cmd = this._resolver.resolve(commandKey, this._eventOrigin(event));
    if (!cmd) { keyDebug(event, commandKey, 'unresolved at this origin'); return false; }
    if (cmd.disabled()) { keyDebug(event, commandKey, 'disabled'); return false; } // a real binding but unavailable — let the key through
    // Consumed: take the key and stop a parent region's dispatcher from re-handling it.
    keyDebug(event, commandKey, 'EXECUTED');
    event.preventDefault();
    event.stopPropagation();
    void cmd.execute();
    return true;
  }

  /** Attach a `keydown` listener to `target` (document, or a region element to scope it). */
  attach(target: Document | Element): RemoveListener {
    const handler = (e: Event): void => { this.dispatch(e as KeyboardEvent); };
    target.addEventListener('keydown', handler);
    return () => target.removeEventListener('keydown', handler);
  }

  /** Introspection/testing: the current `shortcutString → commandKey` map at the anchor. */
  getBindings(): Map<string, string> {
    const map = new Map<string, string>();
    for (const commandKey of this._resolver.collectKeys()) {
      const shortcut = this._resolver.resolve(commandKey)?.getShortcut();
      if (!shortcut) continue;
      const list = Array.isArray(shortcut) ? shortcut : [shortcut as IKeyStroke];
      for (const ks of list) map.set(this._shortcutString(ks), commandKey);
    }
    return map;
  }

  // --- matching --------------------------------------------------------------

  /** Both candidate canonical strings for an event: from `e.code` and from `e.key`. */
  protected _eventCandidates(event: DispatchKeyEvent): Set<string> {
    return keyEventCanonicals(event);
  }

  protected _shortcutString(ks: IKeyStroke): string {
    return keyStrokeToCanonical(ks);
  }
}

/**
 * The canonical, match-stable string for a contributed shortcut — the exact form the dispatcher
 * compares against at dispatch time (ctrl/meta collapsed to `mod`, key token normalized). Exposed
 * so UI (e.g. the shortcut reference's "press a key" capture mode) can match a live keystroke
 * against contributed bindings identically to how they actually fire.
 */
export function keyStrokeToCanonical(ks: IKeyStroke): string {
  const mods = ks.modifiers ?? [];
  const mod = mods.includes(KeyModifiers.Ctrl) || mods.includes(KeyModifiers.Meta);
  return modPrefix(mod, mods.includes(KeyModifiers.Alt), mods.includes(KeyModifiers.Shift))
    + normalizeKeyToken(ks.key);
}

/**
 * Both canonical strings a keyboard event could match (from `e.code` and from `e.key`) — the
 * counterpart to {@link keyStrokeToCanonical}. A shortcut matches the event when its canonical
 * form is in this set.
 */
export function keyEventCanonicals(event: DispatchKeyEvent): Set<string> {
  const prefix = modPrefix(event.ctrlKey || event.metaKey, event.altKey, event.shiftKey);
  return new Set([
    prefix + normalizeKeyToken(event.code),
    prefix + normalizeKeyToken(event.key)
  ]);
}

/** Canonical, order-stable modifier prefix; ctrl and meta collapse to `mod` (treated alike). */
function modPrefix(mod: boolean, alt: boolean, shift: boolean): string {
  return (mod ? 'mod+' : '') + (alt ? 'alt+' : '') + (shift ? 'shift+' : '');
}

/** Normalize a key token so an event and a contributed shortcut compare equal. */
function normalizeKeyToken(raw: string): string {
  if (!raw) return '';
  if (raw.length > 3 && raw.startsWith('Key')) return raw.slice(3).toUpperCase();   // 'KeyB' → 'B'
  if (raw.length > 5 && raw.startsWith('Digit')) return raw.slice(5);               // 'Digit1' → '1'
  if (raw.length === 1) return raw.toUpperCase();                                    // 'b'/'B' → 'B'
  return raw; // 'Enter', 'Escape', 'ArrowRight', 'F2', 'Slash', …
}
