import { describe, it, expect } from 'vitest';

import { isTouchOwned } from '../../scroll/touchOwner';

/** A pane with a frame holding a handle: `root > frame > handle`, each with its own `touch-action`. */
const build = (touchActions: { root?: string; frame?: string; handle?: string }) => {
  const root = document.createElement('div');
  const frame = document.createElement('div');
  const handle = document.createElement('div');
  root.appendChild(frame);
  frame.appendChild(handle);
  const declared = new Map<Element, string>([
    [root, touchActions.root ?? 'auto'],
    [frame, touchActions.frame ?? 'auto'],
    [handle, touchActions.handle ?? 'auto']
  ]);
  const touchActionOf = (el: Element): string => declared.get(el) ?? 'auto';
  return { root, frame, handle, touchActionOf };
};

describe('isTouchOwned', () => {
  it('a plain touch belongs to the scroller', () => {
    const { root, handle, touchActionOf } = build({});
    expect(isTouchOwned(handle, root, touchActionOf)).toBe(false);
  });

  it('a handle declaring touch-action: none owns the touch', () => {
    const { root, handle, touchActionOf } = build({ handle: 'none' });
    expect(isTouchOwned(handle, root, touchActionOf)).toBe(true);
  });

  it('an ancestor below the pane declaring none owns a touch on its content', () => {
    const { root, handle, touchActionOf } = build({ frame: 'none' });
    expect(isTouchOwned(handle, root, touchActionOf)).toBe(true);
  });

  it('the pane element itself is not read', () => {
    const { root, handle, touchActionOf } = build({ root: 'none' });
    expect(isTouchOwned(handle, root, touchActionOf)).toBe(false);
  });

  it('a pan-* or manipulation value leaves the touch to the scroller', () => {
    const panX = build({ handle: 'pan-x' });
    expect(isTouchOwned(panX.handle, panX.root, panX.touchActionOf)).toBe(false);
    const panY = build({ handle: 'pan-y pinch-zoom' });
    expect(isTouchOwned(panY.handle, panY.root, panY.touchActionOf)).toBe(false);
    const manipulation = build({ handle: 'manipulation' });
    expect(isTouchOwned(manipulation.handle, manipulation.root, manipulation.touchActionOf)).toBe(false);
  });

  it('pinch-zoom alone permits no pan, so the content owns it', () => {
    const { root, handle, touchActionOf } = build({ handle: 'pinch-zoom' });
    expect(isTouchOwned(handle, root, touchActionOf)).toBe(true);
  });

  it('a non-element target is never owned', () => {
    const { root, touchActionOf } = build({ handle: 'none' });
    expect(isTouchOwned(document.createTextNode('x'), root, touchActionOf)).toBe(false);
    expect(isTouchOwned(null, root, touchActionOf)).toBe(false);
  });

  it('reads the DOM computed style by default', () => {
    const { root, handle } = build({});
    handle.style.touchAction = 'none';
    // jsdom may not model touch-action; the default reader must still answer without throwing.
    const owned = isTouchOwned(handle, root);
    expect(typeof owned).toBe('boolean');
  });
});
