import { describe, it, expect, vi } from 'vitest';

import { KeyModifiers, type IKeyStroke } from '../../types';

import { CommandScope } from '../../command/CommandScope';
import { ManualActivation } from '../../command/ActivationTracker';
import { CommandResolver } from '../../command/CommandResolver';
import { KeyBindingDispatcher } from '../../command/KeyBindingDispatcher';

const ctrlS: IKeyStroke = { key: 'S', modifiers: [KeyModifiers.Ctrl] };
const ctrlB: IKeyStroke = { key: 'B', modifiers: [KeyModifiers.Ctrl] };

function keydown(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', { cancelable: true, ...init });
}

describe('KeyBindingDispatcher', () => {
  it('matches a ctrl shortcut, dispatches it, and prevents default', () => {
    const app = new CommandScope('app');
    const cb = vi.fn();
    app.updateCommand('save', { callback: cb, shortcut: ctrlS });
    const resolver = new CommandResolver(app, new ManualActivation(app));

    const e = keydown({ key: 's', code: 'KeyS', ctrlKey: true });
    expect(new KeyBindingDispatcher(resolver).dispatch(e)).toBe(true);
    expect(cb).toHaveBeenCalledOnce();
    expect(e.defaultPrevented).toBe(true);
    resolver.dispose();
  });

  it('dispatches through the override chain — the anchor decides which callback runs', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const rootCb = vi.fn();
    const sheetCb = vi.fn();
    // The shortcut lives at the root; the child overrides ONLY the callback.
    app.updateCommand('whoami', { shortcut: ctrlB, callback: rootCb });
    sheet.updateCommand('whoami', { callback: sheetCb });

    // Anchored at the child → the more-specific (overriding) callback wins.
    const child = new CommandResolver(app, new ManualActivation(sheet));
    expect(new KeyBindingDispatcher(child).dispatch(keydown({ key: 'b', code: 'KeyB', ctrlKey: true }))).toBe(true);
    expect(sheetCb).toHaveBeenCalledOnce();
    expect(rootCb).not.toHaveBeenCalled();
    child.dispose();

    // Anchored at the root → the base callback runs (same shortcut still resolves).
    const root = new CommandResolver(app, new ManualActivation(app));
    expect(new KeyBindingDispatcher(root).dispatch(keydown({ key: 'b', code: 'KeyB', ctrlKey: true }))).toBe(true);
    expect(rootCb).toHaveBeenCalledOnce();
    root.dispose();
  });

  describe('punctuation chords are authored as the character the event carries', () => {
    /** Ctrl+Shift+/ as the browser delivers it: shift has already made `key` the SHIFTED character. */
    const ctrlShiftSlash = (): KeyboardEvent =>
      keydown({ key: '?', code: 'Slash', ctrlKey: true, shiftKey: true });

    it('matches the shifted character, not the unshifted one on the same physical key', () => {
      const app = new CommandScope('app');
      const shifted = vi.fn();
      const unshifted = vi.fn();
      app.updateCommand('selectArray', { callback: shifted, shortcut: { key: '?', modifiers: [KeyModifiers.Ctrl, KeyModifiers.Shift] } });
      app.updateCommand('other', { callback: unshifted, shortcut: { key: '/', modifiers: [KeyModifiers.Ctrl, KeyModifiers.Shift] } });
      const resolver = new CommandResolver(app, new ManualActivation(app));

      expect(new KeyBindingDispatcher(resolver).dispatch(ctrlShiftSlash())).toBe(true);
      expect(shifted).toHaveBeenCalledOnce();
      // `ctrl+shift+/` is a DEAD spelling: the event yields `Slash` (code) and `?` (key), never `/`.
      // `scripts/command-chord-lint.mjs` rejects it in the catalogs; this is why.
      expect(unshifted).not.toHaveBeenCalled();
      resolver.dispose();
    });

    it('the physical code token is the other spelling that works', () => {
      const app = new CommandScope('app');
      const cb = vi.fn();
      app.updateCommand('selectArray', { callback: cb, shortcut: { key: 'Slash', modifiers: [KeyModifiers.Ctrl, KeyModifiers.Shift] } });
      const resolver = new CommandResolver(app, new ManualActivation(app));

      expect(new KeyBindingDispatcher(resolver).dispatch(ctrlShiftSlash())).toBe(true);
      expect(cb).toHaveBeenCalledOnce();
      resolver.dispose();
    });

    it('an unshifted punctuation chord still matches its own character (Ctrl+/)', () => {
      const app = new CommandScope('app');
      const cb = vi.fn();
      app.updateCommand('showKeyboardShortcuts', { callback: cb, shortcut: { key: '/', modifiers: [KeyModifiers.Ctrl] } });
      const resolver = new CommandResolver(app, new ManualActivation(app));

      expect(new KeyBindingDispatcher(resolver).dispatch(keydown({ key: '/', code: 'Slash', ctrlKey: true }))).toBe(true);
      expect(cb).toHaveBeenCalledOnce();
      resolver.dispose();
    });

    it('a DIGIT chord survives shift — its code normalizes back to the digit (Ctrl+Shift+1)', () => {
      const app = new CommandScope('app');
      const cb = vi.fn();
      app.updateCommand('formatNumberFormatNumberStyle', { callback: cb, shortcut: { key: '1', modifiers: [KeyModifiers.Ctrl, KeyModifiers.Shift] } });
      const resolver = new CommandResolver(app, new ManualActivation(app));

      expect(new KeyBindingDispatcher(resolver).dispatch(keydown({ key: '!', code: 'Digit1', ctrlKey: true, shiftKey: true }))).toBe(true);
      expect(cb).toHaveBeenCalledOnce();
      resolver.dispose();
    });
  });

  it('returns false (no preventDefault) for an unbound key', () => {
    const app = new CommandScope('app');
    app.updateCommand('save', { callback: vi.fn(), shortcut: ctrlS });
    const resolver = new CommandResolver(app, new ManualActivation(app));

    const e = keydown({ key: 'x', code: 'KeyX', ctrlKey: true });
    expect(new KeyBindingDispatcher(resolver).dispatch(e)).toBe(false);
    expect(e.defaultPrevented).toBe(false);
    resolver.dispose();
  });

  it('FOCUS is not a defer signal — only the event ORIGIN is', () => {
    // The dispatch law: the dispatcher is the terminal handler; a key it *receives* is one the
    // z-stack did not consume, so it dispatches on its own merit. There is no "is the focus an
    // input?" second-guess — the text-entry backstop below asks where the event was BORN
    // (`event.target`), which is a property of the keystroke, not of the document's focus.
    const app = new CommandScope('app');
    const plain = vi.fn();
    const combo = vi.fn();
    app.updateCommand('typeA', { callback: plain, shortcut: { key: 'A' } });
    app.updateCommand('save', { callback: combo, shortcut: ctrlS });
    const resolver = new CommandResolver(app, new ManualActivation(app));
    const dispatcher = new KeyBindingDispatcher(resolver);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Focused input, but the event carries no origin (a hand-built/synthesized key) ⇒ unrestricted.
    expect(dispatcher.dispatch(keydown({ key: 'a', code: 'KeyA' }))).toBe(true);
    expect(plain).toHaveBeenCalledOnce();

    expect(dispatcher.dispatch(keydown({ key: 's', code: 'KeyS', ctrlKey: true }))).toBe(true);
    expect(combo).toHaveBeenCalledOnce();

    input.remove();
    resolver.dispose();
  });

  describe('origin containment bounds a scope to its region', () => {
    /** A key event as DELIVERED (dispatched on `el`, so `event.target` is the origin). */
    const from = (el: Element, init: KeyboardEventInit): KeyboardEvent => {
      const e = keydown({ bubbles: true, ...init });
      el.dispatchEvent(e); // sets `target`; nothing is listening, so this is just a stamp
      return e;
    };

    /**
     * The studio's real shape. `sheet` BOUNDS itself to the sheet element (`attachBounds` — its
     * commands act on the grid selection); `pane` is a focus region inside it; `app` stays element-less
     * because its commands (save) are genuinely global. The task pane renders OUTSIDE the sheet element
     * — a sibling in the studio's split pane, bridged to the scope by React context, not by the DOM.
     */
    const setup = (): {
      dispatcher: KeyBindingDispatcher; fired: string[]; sheet: CommandScope;
      taskPaneInput: HTMLInputElement; sheetEl: HTMLElement; paneEl: HTMLElement;
      dispose: () => void;
    } => {
      const app = new CommandScope('app');
      const fired: string[] = [];
      const sheetEl = document.createElement('div');
      const paneEl = document.createElement('div'); // the pane's Stage, inside the sheet
      sheetEl.appendChild(paneEl);
      document.body.appendChild(sheetEl);

      const sheet = app.createChild('sheet');
      const removeBounds = sheet.attachBounds(sheetEl);
      sheet.updateCommand('clearContents', { callback: () => fired.push('clearContents'), shortcut: { key: 'Delete' } });
      sheet.updateCommand('commit', { callback: () => fired.push('commit'), shortcut: { key: 'Enter' } });
      const pane = sheet.createChild('pane');
      pane.attachElement(paneEl);
      pane.updateCommand('navDown', { callback: () => fired.push('navDown'), shortcut: { key: 'ArrowDown' } });
      app.updateCommand('save', { callback: () => fired.push('save'), shortcut: ctrlS });

      const taskPaneInput = document.createElement('input');
      document.body.appendChild(taskPaneInput); // sibling of `sheetEl`, not inside it
      const resolver = new CommandResolver(app, new ManualActivation(pane));
      return {
        dispatcher: new KeyBindingDispatcher(resolver), fired, sheet, taskPaneInput, sheetEl, paneEl,
        dispose: () => { resolver.dispose(); removeBounds(); sheetEl.remove(); taskPaneInput.remove(); }
      };
    };

    it('keeps a bounded scope shortcut off a keystroke born outside its region', () => {
      // The bug: `Delete` typed in a studio task pane ran the sheet `clearContents` — clearing the
      // grid and dirtying the workbook — because the `sheet` scope was element-less, i.e. unrestricted.
      const { dispatcher, fired, taskPaneInput, dispose } = setup();

      const del = from(taskPaneInput, { key: 'Delete', code: 'Delete' });
      expect(dispatcher.dispatch(del)).toBe(false);
      expect(del.defaultPrevented).toBe(false); // the browser still deletes the character
      expect(dispatcher.dispatch(from(taskPaneInput, { key: 'ArrowDown', code: 'ArrowDown' }))).toBe(false);
      expect(fired).toEqual([]);

      dispose();
    });

    it('still dispatches for a keystroke born INSIDE the region — including from an editable there', () => {
      // The case the banned target-type defer got wrong: the cell editor is a textarea inside the pane
      // that deliberately lets its commit/leave keys propagate. Containment asks WHERE, not WHAT.
      const { dispatcher, fired, paneEl, dispose } = setup();
      const cellEditor = document.createElement('textarea');
      paneEl.appendChild(cellEditor);

      expect(dispatcher.dispatch(from(cellEditor, { key: 'Enter', code: 'Enter' }))).toBe(true);
      expect(dispatcher.dispatch(from(cellEditor, { key: 'ArrowDown', code: 'ArrowDown' }))).toBe(true);
      expect(dispatcher.dispatch(from(cellEditor, { key: 'Delete', code: 'Delete' }))).toBe(true);
      expect(fired).toEqual(['commit', 'navDown', 'clearContents']);

      dispose();
    });

    it('leaves an element-less scope unrestricted — ctrl+S saves from anywhere', () => {
      const { dispatcher, fired, taskPaneInput, dispose } = setup();

      expect(dispatcher.dispatch(from(taskPaneInput, { key: 's', code: 'KeyS', ctrlKey: true }))).toBe(true);
      expect(fired).toEqual(['save']);

      dispose();
    });

    it('attachBounds does NOT name a focus region — the deeper pane stays the anchor', () => {
      // Bounds-only is the whole point: the sheet owns the commands, the pane owns the focus leaf.
      // Both look the same to `contains`, but only `attachElement` lands in the tree's region index —
      // so focus inside the grid keeps resolving to the pane, not to the sheet above it.
      const { sheet, sheetEl, paneEl, dispose } = setup();
      expect(sheet.getRegion(sheetEl)).toBeUndefined();     // bounded, but not a focus region
      expect(sheet.getRegion(paneEl)).toBeDefined();        // the pane IS one (same shared index)
      expect(sheet.findScope(paneEl)?.key).toBe('pane');    // ...and it is what a focus there finds
      expect(sheet.contains(paneEl)).toBe(true);            // while containment still covers the sheet
      dispose();
    });
  });

  it('does not consume a key bound to a disabled command (no callback in chain)', () => {
    const app = new CommandScope('app');
    app.updateCommand('save', { shortcut: ctrlS }); // shortcut but no callback ⇒ disabled
    const resolver = new CommandResolver(app, new ManualActivation(app));

    const e = keydown({ key: 's', code: 'KeyS', ctrlKey: true });
    expect(new KeyBindingDispatcher(resolver).dispatch(e)).toBe(false);
    expect(e.defaultPrevented).toBe(false);
    resolver.dispose();
  });

  it('stops propagation on consume, but lets an unmatched key bubble', () => {
    const app = new CommandScope('app');
    app.updateCommand('save', { callback: vi.fn(), shortcut: ctrlS });
    const resolver = new CommandResolver(app, new ManualActivation(app));
    const dispatcher = new KeyBindingDispatcher(resolver);

    const hit = keydown({ key: 's', code: 'KeyS', ctrlKey: true });
    const hitStop = vi.spyOn(hit, 'stopPropagation');
    expect(dispatcher.dispatch(hit)).toBe(true);
    expect(hitStop).toHaveBeenCalledOnce();

    const miss = keydown({ key: 'x', code: 'KeyX', ctrlKey: true });
    const missStop = vi.spyOn(miss, 'stopPropagation');
    expect(dispatcher.dispatch(miss)).toBe(false);
    expect(missStop).not.toHaveBeenCalled(); // unmatched ⇒ free to bubble to the next region

    resolver.dispose();
  });

  it('responder chain: an inner region consumes, the outer one does not re-handle', () => {
    const app = new CommandScope('app');
    const region = app.createChild('region');
    const appCb = vi.fn();
    const regionCb = vi.fn();
    app.updateCommand('act', { shortcut: ctrlB, callback: appCb }); // shortcut + base
    region.updateCommand('act', { callback: regionCb });             // override the callback

    const outerEl = document.createElement('div');
    const innerEl = document.createElement('div');
    outerEl.appendChild(innerEl);
    document.body.appendChild(outerEl);

    // Outer dispatcher anchored at app; inner anchored at the region (more specific).
    const outer = new CommandResolver(app, new ManualActivation(app));
    const inner = new CommandResolver(app, new ManualActivation(region));
    const offOuter = new KeyBindingDispatcher(outer).attach(outerEl);
    const offInner = new KeyBindingDispatcher(inner).attach(innerEl);

    innerEl.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', ctrlKey: true, bubbles: true, cancelable: true })
    );

    expect(regionCb).toHaveBeenCalledOnce(); // innermost (most-specific) won
    expect(appCb).not.toHaveBeenCalled();    // stopPropagation kept the outer dispatcher out

    offInner(); offOuter(); outerEl.remove();
    inner.dispose(); outer.dispose();
  });

  it('origin containment: a region-scoped command only fires for events born inside its region element', () => {
    // The task-pane bug shape: selection-nav is authored on a pane layer (whose chain inherits the
    // pane's Stage element as its region); an ArrowDown born in an ORTHOGONAL subtree (a task-pane
    // input) must NOT dispatch it — while one born inside the pane (incl. a key a layer deliberately
    // let propagate, e.g. the editor's commit Enter) must.
    const app = new CommandScope('app');
    const pane = app.createChild('pane');
    const selection = pane.createChild('layer:selection');
    const nav = vi.fn();
    const undo = vi.fn();
    selection.updateCommand('nav', { callback: nav, shortcut: { key: 'ArrowDown' } });
    // An element-less (workbook/app-level) scope stays unrestricted — chrome keystrokes keep working.
    app.updateCommand('undo', { callback: undo, shortcut: { key: 'Z', modifiers: [KeyModifiers.Ctrl] } });

    const rootEl = document.createElement('div');
    const paneEl = document.createElement('div');
    const taskPaneEl = document.createElement('div');
    rootEl.append(paneEl, taskPaneEl);
    document.body.appendChild(rootEl);
    const offRegion = pane.attachElement(paneEl); // the pane names its Stage; layers inherit it

    const resolver = new CommandResolver(app, new ManualActivation(selection), { keyBindings: false });
    const dispatcher = new KeyBindingDispatcher(resolver);
    const offKeys = dispatcher.attach(rootEl);

    // Born in the orthogonal subtree: the binding does not exist for this origin — not consumed,
    // no preventDefault (the input keeps its caret key).
    const outside = new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true, cancelable: true });
    taskPaneEl.dispatchEvent(outside);
    expect(nav).not.toHaveBeenCalled();
    expect(outside.defaultPrevented).toBe(false);

    // Born inside the pane's region: dispatches.
    const inside = new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true, cancelable: true });
    paneEl.dispatchEvent(inside);
    expect(nav).toHaveBeenCalledOnce();
    expect(inside.defaultPrevented).toBe(true);

    // The app-level command has no region anywhere up its authoring chain — fires from anywhere.
    taskPaneEl.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true, cancelable: true })
    );
    expect(undo).toHaveBeenCalledOnce();

    offKeys(); offRegion(); rootEl.remove();
    resolver.dispose();
  });

  it('origin containment is per-CONTRIBUTION: a partially-blocked command falls through to the permitted portion', () => {
    // One command key contributed at TWO levels: a workbook-level base callback and a pane-layer
    // override. A key born in the pane runs the override (normal cascade); a key born in an
    // orthogonal subtree omits ONLY the layer's portion — the same keystroke falls through to the
    // workbook-level callback instead of losing the binding entirely.
    const app = new CommandScope('app');
    const workbook = app.createChild('workbook');
    const pane = workbook.createChild('pane');
    const layer = pane.createChild('layer:clipboard');
    const baseCb = vi.fn();
    const layerCb = vi.fn();
    workbook.updateCommand('copy', { shortcut: { key: 'C', modifiers: [KeyModifiers.Ctrl] }, callback: baseCb });
    layer.updateCommand('copy', { callback: layerCb });

    const rootEl = document.createElement('div');
    const paneEl = document.createElement('div');
    const taskPaneEl = document.createElement('div');
    rootEl.append(paneEl, taskPaneEl);
    document.body.appendChild(rootEl);
    const offRegion = pane.attachElement(paneEl);

    const resolver = new CommandResolver(app, new ManualActivation(layer));
    const offKeys = new KeyBindingDispatcher(resolver).attach(rootEl);
    const ctrlCDown = (): KeyboardEvent =>
      new KeyboardEvent('keydown', { key: 'c', code: 'KeyC', ctrlKey: true, bubbles: true, cancelable: true });

    // Born inside the pane: the layer override wins (unchanged cascade).
    paneEl.dispatchEvent(ctrlCDown());
    expect(layerCb).toHaveBeenCalledOnce();
    expect(baseCb).not.toHaveBeenCalled();

    // Born in the orthogonal subtree: the layer's portion is omitted — the SAME key falls through
    // to the workbook-level callback.
    taskPaneEl.dispatchEvent(ctrlCDown());
    expect(baseCb).toHaveBeenCalledOnce();
    expect(layerCb).toHaveBeenCalledOnce(); // unchanged — the override never fired for the outside key

    offKeys(); offRegion(); rootEl.remove();
    resolver.dispose();
  });

  it('origin containment: the scope decides — a portaled container attached as a second element extends the region', () => {
    // A float/popup portaled to body is DOM-outside the pane's Stage but logically inside its
    // region: the owner attaches the portal container as an ADDITIONAL element on the same scope,
    // and `scope.contains` accepts keys born in either.
    const app = new CommandScope('app');
    const pane = app.createChild('pane');
    const layer = pane.createChild('layer:selection');
    const nav = vi.fn();
    layer.updateCommand('nav', { callback: nav, shortcut: { key: 'ArrowDown' } });

    const rootEl = document.createElement('div');
    const paneEl = document.createElement('div');
    const portalEl = document.createElement('div'); // sibling — a body-level portal, not inside paneEl
    rootEl.append(paneEl, portalEl);
    document.body.appendChild(rootEl);
    const offMain = pane.attachElement(paneEl);

    const resolver = new CommandResolver(app, new ManualActivation(layer));
    const offKeys = new KeyBindingDispatcher(resolver).attach(rootEl);
    const arrowDown = (): KeyboardEvent =>
      new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true, cancelable: true });

    // Not attached yet: the portal is an orthogonal origin — blocked.
    portalEl.dispatchEvent(arrowDown());
    expect(nav).not.toHaveBeenCalled();

    // The float's owner extends the pane's region with the portal container.
    const offPortal = pane.attachElement(portalEl);
    portalEl.dispatchEvent(arrowDown());
    expect(nav).toHaveBeenCalledOnce();

    // The float closes: the region shrinks back — the portal origin is blocked again.
    offPortal();
    portalEl.dispatchEvent(arrowDown());
    expect(nav).toHaveBeenCalledOnce();

    offKeys(); offMain(); rootEl.remove();
    resolver.dispose();
  });

  it('origin containment: detaching the region element lifts the restriction', () => {
    const app = new CommandScope('app');
    const region = app.createChild('region');
    const cb = vi.fn();
    region.updateCommand('act', { callback: cb, shortcut: ctrlB });

    const regionEl = document.createElement('div');
    const outsideEl = document.createElement('div');
    document.body.append(regionEl, outsideEl);
    const offRegion = region.attachElement(regionEl);

    const resolver = new CommandResolver(app, new ManualActivation(region), { keyBindings: false });
    const dispatcher = new KeyBindingDispatcher(resolver);
    const offKeys = dispatcher.attach(document.body);

    outsideEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(cb).not.toHaveBeenCalled();

    offRegion(); // region unmounts its element — the scope chain is element-less again
    outsideEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(cb).toHaveBeenCalledOnce();

    offKeys(); regionEl.remove(); outsideEl.remove();
    resolver.dispose();
  });

  it('getBindings reflects the anchor (overrides resolve through the chain)', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    app.updateCommand('whoami', { shortcut: ctrlB, callback: () => {} });
    const resolver = new CommandResolver(app, new ManualActivation(sheet));

    expect(new KeyBindingDispatcher(resolver).getBindings().get('mod+B')).toBe('whoami');
    resolver.dispose();
  });
});
