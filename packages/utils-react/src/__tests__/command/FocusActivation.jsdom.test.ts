import { describe, it, expect } from 'vitest';

import { CommandScope } from '../../command/CommandScope';
import { FocusActivation } from '../../command/FocusActivation';

// Pure DOM-tree walk (no React, no events) — deterministic. jsdom-only.
describe('FocusActivation.findScope (DOM walk)', () => {
  it('returns the nearest registered scope at or above the element', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const focus = new FocusActivation();

    const root = document.createElement('div');
    const sheetEl = document.createElement('div');
    const innerCell = document.createElement('div'); // content/chrome with no scope of its own
    root.appendChild(sheetEl);
    sheetEl.appendChild(innerCell);
    document.body.appendChild(root);

    focus.attach(root);
    focus.register(sheetEl, sheet);

    expect(focus.findScope(innerCell)).toBe(sheet); // walks up to the sheet scope
    expect(focus.findScope(sheetEl)).toBe(sheet);
    expect(focus.findScope(root)).toBeUndefined();  // root element isn't a registered scope

    root.remove();
  });

  it('returns undefined for elements outside the attached root', () => {
    const focus = new FocusActivation();

    const root = document.createElement('div');
    const outside = document.createElement('div');
    document.body.appendChild(root);
    document.body.appendChild(outside);
    focus.attach(root);

    expect(focus.findScope(outside)).toBeUndefined();

    root.remove();
    outside.remove();
  });

  it('unregister removes the mapping', () => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const focus = new FocusActivation();

    const root = document.createElement('div');
    const sheetEl = document.createElement('div');
    root.appendChild(sheetEl);
    document.body.appendChild(root);
    focus.attach(root);

    const remove = focus.register(sheetEl, sheet);
    expect(focus.findScope(sheetEl)).toBe(sheet);
    remove();
    expect(focus.findScope(sheetEl)).toBeUndefined();

    root.remove();
  });
});

// The one-shot INITIAL anchor — a synthetic first focus supplied to the constructor (a value, an
// element resolved through the region walk, or a promise the consumer settles at its own moment).
describe('FocusActivation initial anchor (one-shot)', () => {
  it('a scope initial anchor is the cold-start anchor; no initial → null', () => {
    const app = new CommandScope('app');
    const center = app.createChild('pane:center');

    expect(new FocusActivation().getAnchor()).toBeNull();          // no initial, no focus
    expect(new FocusActivation(null, center).getAnchor()).toBe(center); // initial in effect
  });

  it('a promise initial anchor lands when the consumer resolves it (and notifies)', async () => {
    const app = new CommandScope('app');
    const center = app.createChild('pane:center');
    let resolve!: (v: CommandScope | null) => void;
    const promise = new Promise<CommandScope | null>((res) => { resolve = res; });
    const focus = new FocusActivation(null, promise);

    let notes = 0;
    focus.subscribe(() => { notes++; });
    expect(focus.getAnchor()).toBeNull(); // consumer hasn't resolved yet
    resolve(center);
    await promise;
    expect(focus.getAnchor()).toBe(center);
    expect(notes).toBe(1);
  });

  it('an element initial anchor resolves through the region walk (retrying until the region registers)', async () => {
    const app = new CommandScope('app');
    const center = app.createChild('pane:center');

    const root = document.createElement('div');
    const paneEl = document.createElement('div');
    root.appendChild(paneEl);
    document.body.appendChild(root);

    // Constructed BEFORE attach/register — the same race a first-paint callback has against the
    // registration effect; the seed retries across frames until the walk resolves.
    const focus = new FocusActivation(null, paneEl);
    expect(focus.getAnchor()).toBeNull();
    focus.attach(root);
    focus.register(paneEl, center);
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(undefined))));
    expect(focus.getAnchor()).toBe(center);

    root.remove();
  });

  it('real focus wins: a late-resolving initial anchor is inert once focus produced an anchor', async () => {
    const app = new CommandScope('app');
    const center = app.createChild('pane:center');
    const editor = center.createChild('editor');
    let resolve!: (v: CommandScope | null) => void;
    const promise = new Promise<CommandScope | null>((res) => { resolve = res; });
    const focus = new FocusActivation(null, promise);

    const root = document.createElement('div');
    const editorEl = document.createElement('div');
    editorEl.tabIndex = -1;
    root.appendChild(editorEl);
    document.body.appendChild(root);

    focus.attach(root);
    focus.register(editorEl, editor);

    editorEl.focus();
    editorEl.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(focus.getAnchor()).toBe(editor); // real focus landed first

    let notes = 0;
    focus.subscribe(() => { notes++; });
    resolve(center); // the consumer's initial arrives late
    await promise;
    expect(notes).toBe(0);                  // inert — no notify
    expect(focus.getAnchor()).toBe(editor); // anchor unchanged

    root.remove();
  });

  it('focus gain advances off the initial anchor', () => {
    const app = new CommandScope('app');
    const center = app.createChild('pane:center');
    const editor = center.createChild('editor');
    const focus = new FocusActivation(null, center);

    const root = document.createElement('div');
    const editorEl = document.createElement('div');
    editorEl.tabIndex = -1;
    root.appendChild(editorEl);
    document.body.appendChild(root);

    focus.attach(root);
    focus.register(editorEl, editor);
    expect(focus.getAnchor()).toBe(center); // initial

    editorEl.focus();
    editorEl.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(focus.getAnchor()).toBe(editor); // focus advanced off it

    root.remove();
  });
});

// The dynamic leaf — a getter source (a pane's Stage → its live chain top) is evaluated live (mechanism 2).
describe('FocusActivation dynamic leaf (getter source)', () => {
  it('a function initial anchor is now a recallable PROVIDER (invoked once for cold-start)', () => {
    // Widened meaning (2026-07-25): a function passed as the initial anchor is a DefaultAnchorProvider,
    // called once now (and again on destruction — see the destruction-fallback suite), NOT a live-eval
    // getter. Live-getter-as-source behavior lives on the register() path (the next test).
    const app = new CommandScope('app');
    const base = app.createChild('pane:center');

    let provided: CommandScope = base;
    const focus = new FocusActivation(null, () => provided); // provider → seeds `provided` once

    expect(focus.getAnchor()).toBe(base);       // seeded from the provider at construction
    provided = base.createChild('layer:selection');
    expect(focus.getAnchor()).toBe(base);       // NOT re-evaluated — a provider seeds, it isn't a live source
  });

  it('focus gain on a Stage element anchors at its getter, tracked by source identity', () => {
    const app = new CommandScope('app');
    const paneBase = app.createChild('pane:center');
    const focus = new FocusActivation();

    const root = document.createElement('div');
    const stageEl = document.createElement('div'); stageEl.tabIndex = 0;
    root.appendChild(stageEl);
    document.body.appendChild(root);

    let top: CommandScope = paneBase;
    focus.attach(root);
    const source = (): CommandScope => top;
    focus.register(stageEl, source);

    stageEl.focus();
    stageEl.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(focus.getAnchor()).toBe(paneBase); // anchored via the getter

    // The chain top advances (a layer mounts); no new focus event, yet getAnchor reflects it live.
    top = paneBase.createChild('layer:selection');
    expect(focus.getAnchor()).toBe(top);

    // Re-focusing the same Stage is the same SOURCE → no spurious anchor churn.
    let notes = 0;
    focus.subscribe(() => { notes++; });
    stageEl.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(notes).toBe(0);

    root.remove();
  });
});

// Destruction fallback (COMMAND-DESIGN.md open-Q5): when the anchored region's owner element is torn out
// of the DOM (a resize past the grid min drops focus to <body> with no focusin), getAnchor drops the
// orphan and re-invokes the provider for a fresh default.
describe('FocusActivation destruction fallback (recallable provider)', () => {
  it('drops the anchor when its element is destroyed and recalls the provider', async () => {
    const app = new CommandScope('app');
    const paneA = app.createChild('pane:A');
    const paneB = app.createChild('pane:B');

    const root = document.createElement('div');
    const elA = document.createElement('div');
    const elB = document.createElement('div');
    root.appendChild(elA);
    root.appendChild(elB);
    document.body.appendChild(root);

    // The provider returns whichever pane element is currently the "would-focus" one.
    let wouldFocus: Element = elA;
    const focus = new FocusActivation(null, () => wouldFocus);
    focus.attach(root);
    focus.register(elA, paneA);
    focus.register(elB, paneB);

    // Cold-start seeds an ELEMENT, which retries across frames until the region registers (as it does
    // just above, after construction). Let the retry land.
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(undefined))));
    expect(focus.getAnchor()).toBe(paneA); // cold-start seeded through the region walk at elA

    // Resize destroys pane A's element; the provider now points at pane B.
    elA.remove();
    wouldFocus = elB;

    expect(focus.getAnchor()).toBeNull();   // orphan dropped synchronously — no resolving out of root
    await Promise.resolve();                // flush the deferred recall microtask
    expect(focus.getAnchor()).toBe(paneB);  // re-homed to the fresh default

    root.remove();
  });

  it('"blur leaves it": a still-connected anchored element is NOT recalled', async () => {
    const app = new CommandScope('app');
    const pane = app.createChild('pane:center');

    const root = document.createElement('div');
    const stageEl = document.createElement('div'); stageEl.tabIndex = 0;
    const chromeEl = document.createElement('button'); // unmapped chrome
    root.appendChild(stageEl);
    root.appendChild(chromeEl);
    document.body.appendChild(root);

    let recalls = 0;
    const focus = new FocusActivation(null, () => { recalls++; return stageEl; });
    focus.attach(root);
    focus.register(stageEl, pane);
    recalls = 0; // ignore the cold-start invocation

    stageEl.focus();
    stageEl.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(focus.getAnchor()).toBe(pane);

    // Focus moves to chrome (still mounted) — the anchor and its watched element stay put, no recall.
    chromeEl.focus();
    chromeEl.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(focus.getAnchor()).toBe(pane);
    await Promise.resolve();
    expect(recalls).toBe(0); // stageEl still connected → no destruction, no recall

    root.remove();
  });

  it('a one-shot value/promise initial anchor has NO recall (dropped, stays dropped)', async () => {
    const app = new CommandScope('app');
    const pane = app.createChild('pane:center');

    const root = document.createElement('div');
    const el = document.createElement('div');
    root.appendChild(el);
    document.body.appendChild(root);

    const focus = new FocusActivation(null, el); // one-shot ELEMENT seed (not a function → no provider)
    focus.attach(root);
    focus.register(el, pane);
    // Seeding an element retries across frames until the region registers.
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(undefined))));
    expect(focus.getAnchor()).toBe(pane);

    el.remove();
    expect(focus.getAnchor()).toBeNull(); // dropped
    await Promise.resolve();
    expect(focus.getAnchor()).toBeNull(); // and stays null — no provider to recall

    root.remove();
  });
});
