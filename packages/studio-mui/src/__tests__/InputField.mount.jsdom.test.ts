import { describe, it, expect } from 'vitest';

import { createElement, act, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { InputField } from '../form';

/**
 * Mount/interaction tests for the MUI `InputField` — the plain-text sibling of `FormulaField`. These
 * lock the CONTRACT the two share through `useEditCommit` (`@sheetxl/react`): the live vs commit
 * channels (`changeOn`), the two-level Escape, an invalid state that blocks every accept path, and the
 * modal ✓/✗ adornments. The formula side of the same contract is covered by `FormulaField.mount`.
 */
describe('InputField (mount)', () => {
  const mount = async (props: Record<string, unknown>): Promise<{
    container: HTMLDivElement;
    input: HTMLInputElement;
    unmount: () => Promise<void>;
  }> => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(InputField as never, props)); });
    return {
      container,
      input: container.querySelector('input') as HTMLInputElement,
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  const type = async (input: HTMLInputElement, text: string): Promise<void> => {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  /** Dispatch `key` and hand back the native event, so a test can read `defaultPrevented`. */
  const press = async (input: HTMLInputElement, key: string): Promise<KeyboardEvent> => {
    const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    await act(async () => { input.dispatchEvent(ev); });
    return ev;
  };

  it('LIVE mode (the default): every keystroke notifies; nothing waits for a commit', async () => {
    const seen: string[] = [];
    const { input, unmount } = await mount({ value: 'Table1', onChangeInput: (v: string) => seen.push(v) });
    expect(input.value).toBe('Table1');
    await act(async () => { input.focus(); });
    await type(input, 'Table2');
    await type(input, 'Table23');
    expect(seen).toEqual(['Table2', 'Table23']);
    await unmount();
  });

  it('LIVE mode: a host echoing each change NORMALIZED does not retype the field mid-edit', async () => {
    // The host holds what it was sent, as it would store it (here, trimmed and upper-cased).
    const Host = () => {
      const [value, setValue] = useState<string>('T1');
      return createElement(InputField as never, {
        value,
        onChangeInput: (v: string) => setValue(v.trim().toUpperCase())
      } as never);
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(Host)); });
    const input = container.querySelector('input') as HTMLInputElement;

    await act(async () => { input.focus(); });
    await type(input, 'ta');
    await type(input, 'tab ');
    expect(input.value).toBe('tab '); // the user's text while they edit
    await press(input, 'Enter');
    expect(input.value).toBe('TAB'); // the edit is done: the value as the host holds it
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('DONE mode: typing is silent; Enter delivers the commit ONCE', async () => {
    const changes: string[] = [];
    const done: Array<[string, string]> = [];
    const { input, unmount } = await mount({
      value: 'Table1',
      changeOn: 'done',
      onChangeInput: (v: string) => changes.push(v),
      onDone: (v: string, args: { reason: string }) => done.push([v, args.reason])
    });
    await act(async () => { input.focus(); });
    await type(input, 'Renamed');
    expect(changes).toEqual([]); // the live channel is suppressed entirely
    expect(done).toEqual([]);
    const enter = await press(input, 'Enter');
    expect(done).toEqual([['Renamed', 'accept']]);
    // `'done'` mode OWNS Enter — the host form must not also submit on it.
    expect(enter.defaultPrevented).toBe(true);
    // The commit re-based the field: the blur that follows must not deliver a second accept.
    await act(async () => { input.blur(); });
    expect(done).toHaveLength(1);
    await unmount();
  });

  it('ESCAPE reverts to the text the edit started from and cancels', async () => {
    const done: Array<[string, string]> = [];
    const { input, unmount } = await mount({
      value: 'Table1', changeOn: 'done',
      onDone: (v: string, args: { reason: string }) => done.push([v, args.reason])
    });
    await act(async () => { input.focus(); });
    await type(input, 'Whoops');
    const esc = await press(input, 'Escape');
    expect(input.value).toBe('Table1'); // back to the session baseline
    expect(esc.defaultPrevented).toBe(true); // ours: there WAS something to undo
    expect(done).toEqual([['Table1', 'cancel']]); // a cancel delivers the reverted value
    // ...and the revert must not then commit on the way out.
    await act(async () => { input.blur(); });
    expect(done).toHaveLength(1);
    await unmount();
  });

  it('ESCAPE ends a TOUCHED session even when the text round-tripped back', async () => {
    // `Table1` → `Table2` → `Table1`: the text matches the session baseline again, but the user IS
    // editing — Escape must close the session, not fall through. (Nothing differs from the committed
    // value, so the ✓/✗ pair has nothing to offer and stays hidden throughout.)
    const done: Array<[string, string]> = [];
    const { container, input, unmount } = await mount({
      value: 'Table1', changeOn: 'done',
      onDone: (v: string, args: { reason: string }) => done.push([v, args.reason])
    });
    const adornment = container.querySelector('[aria-label="commit-input"]')!.closest('.MuiInputAdornment-root');
    await act(async () => { input.focus(); });
    await type(input, 'Table2');
    expect(adornment?.getAttribute('aria-hidden')).toBe('false'); // pending text to accept
    await type(input, 'Table1');
    expect(adornment?.getAttribute('aria-hidden')).toBe('true'); // back to the committed text
    const esc = await press(input, 'Escape');
    expect(esc.defaultPrevented).toBe(true);
    expect(input.value).toBe('Table1');
    expect(done).toEqual([['Table1', 'cancel']]);
    // Still focused, so a fresh session is open — untouched, so the next Escape goes to the host.
    expect((await press(input, 'Escape')).defaultPrevented).toBe(false);
    await unmount();
  });

  it('ESCAPE is NOT captured when nothing changed — a host dialog still closes on it', async () => {
    const { input, unmount } = await mount({ value: 'Table1', changeOn: 'done', onDone: () => {} });
    await act(async () => { input.focus(); });
    const esc = await press(input, 'Escape');
    expect(esc.defaultPrevented).toBe(false);
    await unmount();
  });

  it('INVALID text blocks every accept path and shows the error', async () => {
    const done: string[] = [];
    const { container, input, unmount } = await mount({
      value: 'Table1',
      changeOn: 'done',
      onValidate: (text: string) => { if (text === 'Bad') throw new Error('Name already exists'); },
      onDone: (v: string) => done.push(v)
    });
    await act(async () => { input.focus(); });
    await type(input, 'Bad');
    expect(container.textContent).toContain('Name already exists');
    expect(container.querySelector('.Mui-error')).toBeTruthy();
    await press(input, 'Enter');
    expect(done).toEqual([]); // an accept over an error is swallowed
    await act(async () => { input.blur(); });
    expect(done).toEqual([]); // ...on blur too
    // Fixing it clears the error and lets the commit through.
    await act(async () => { input.focus(); });
    await type(input, 'Good');
    expect(container.querySelector('.Mui-error')).toBeFalsy();
    await press(input, 'Enter');
    expect(done).toEqual(['Good']);
    await unmount();
  });

  it('BLUR commits when dirty and stays silent when clean', async () => {
    const done: string[] = [];
    const { input, unmount } = await mount({
      value: 'Table1', changeOn: 'done', onDone: (v: string) => done.push(v)
    });
    await act(async () => { input.focus(); });
    await act(async () => { input.blur(); });
    expect(done).toEqual([]); // a pass-through focus is not an edit
    await act(async () => { input.focus(); });
    await type(input, 'Renamed');
    await act(async () => { input.blur(); });
    expect(done).toEqual(['Renamed']);
    await unmount();
  });

  it('the ✓/✗ pair is done-mode only, shown while the text differs, and measured while hidden', async () => {
    // `onDone` wired, but live: every change has already gone out, so nothing is pending to accept.
    const live = await mount({ value: 'Table1', onDone: () => {} });
    expect(live.container.querySelector('[aria-label="commit-input"]')).toBeFalsy();
    await live.unmount();

    const done: Array<[string, string]> = [];
    const { container, input, unmount } = await mount({
      value: 'Table1', changeOn: 'done',
      onDone: (v: string, args: { reason: string }) => done.push([v, args.reason])
    });
    // Rendered from the start so the slot keeps its width — but hidden until there is text to accept.
    const adornment = container.querySelector('[aria-label="commit-input"]')!.closest('.MuiInputAdornment-root');
    expect(adornment?.getAttribute('aria-hidden')).toBe('true');
    await act(async () => { input.focus(); });
    expect(adornment?.getAttribute('aria-hidden')).toBe('true'); // focused, nothing typed
    // ✓ commits — the text is the committed value again, so the pair goes back to hidden.
    await type(input, 'Renamed');
    expect(adornment?.getAttribute('aria-hidden')).toBe('false');
    await act(async () => { (container.querySelector('[aria-label="commit-input"]') as HTMLElement).click(); });
    expect(done).toEqual([['Renamed', 'accept']]);
    expect(adornment?.getAttribute('aria-hidden')).toBe('true');
    await unmount();
  });

  it('✗ cancels back to the session baseline', async () => {
    const done: Array<[string, string]> = [];
    const { container, input, unmount } = await mount({
      value: 'Table1', changeOn: 'done',
      onDone: (v: string, args: { reason: string }) => done.push([v, args.reason])
    });
    await act(async () => { input.focus(); });
    await type(input, 'Whoops');
    await act(async () => { (container.querySelector('[aria-label="cancel-input"]') as HTMLElement).click(); });
    expect(input.value).toBe('Table1');
    expect(done).toEqual([['Table1', 'cancel']]);
    await unmount();
  });

  it('a commit leaves focus in the field, and the NEXT edit starts a fresh session', async () => {
    const done: Array<[string, string]> = [];
    const { input, unmount } = await mount({
      value: 'Table1', changeOn: 'done',
      onDone: (v: string, args: { reason: string }) => done.push([v, args.reason])
    });
    await act(async () => { input.focus(); });
    await type(input, 'First');
    await press(input, 'Enter');
    // Editing again re-engages with the COMMITTED text as the new baseline — Escape returns there,
    // not to the pre-commit value.
    await type(input, 'Second');
    await press(input, 'Escape');
    expect(input.value).toBe('First');
    expect(done).toEqual([['First', 'accept'], ['First', 'cancel']]);
    await unmount();
  });

  it('the CARET keys never escape the field — and the chords deliberately do', async () => {
    // "Consume only what you handle", both directions. Deletion + caret motion are the field's: it
    // declares them with `stopPropagation` (never `preventDefault` — the browser's own editing IS the
    // wanted behavior). The native chords are NOT consumed on purpose: they must reach the dispatcher,
    // where the input-clipboard injector answers them for an editable origin (copy through the app's
    // clipboard, undo against this element's own stack rather than the workbook's).
    const { input, unmount } = await mount({ value: 'Table1' });
    const escaped: string[] = [];
    const listener = (e: Event): void => { escaped.push((e as KeyboardEvent).key); };
    document.addEventListener('keydown', listener);
    await act(async () => { input.focus(); });
    for (const key of ['Delete', 'Backspace', 'Home', 'End', 'ArrowLeft', 'ArrowRight']) {
      const ev = await press(input, key);
      expect(ev.defaultPrevented, key).toBe(false); // consumed, but the native edit still happens
    }
    expect(escaped).toEqual([]);
    // The chords, and anything else the field doesn't own, still bubble.
    const chord = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
    await act(async () => { input.dispatchEvent(chord); });
    await press(input, 'F1');
    expect(escaped).toEqual(['z', 'F1']);
    document.removeEventListener('keydown', listener);
    await unmount();
  });

  it('an outside value change re-derives the text (a controlled host)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(InputField as never, { value: 'One' })); });
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('One');
    await act(async () => { root.render(createElement(InputField as never, { value: 'Two' })); });
    expect(input.value).toBe('Two');
    await act(async () => { root.unmount(); });
    container.remove();
  });
});
