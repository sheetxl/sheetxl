import { describe, it, expect } from 'vitest';

import { composeCaretRect } from '../hooks/useTextareaCaretRect';

/**
 * The DOM/mirror plumbing needs a real layout engine (jsdom does none — every `getBoundingClientRect`
 * is zero), so it is exercised in Storybook, not here. What we CAN pin down deterministically is the
 * coordinate composition, which is where the off-by-a-border/scroll bugs actually live.
 */
describe('composeCaretRect', () => {
  it('maps the caret offset within the content to viewport space', () => {
    // Textarea at (100, 50). Mirror parked at the origin. Caret 30px right / 4px down into the content.
    const rect = composeCaretRect({
      textareaRect: { left: 100, top: 50 },
      mirrorRect: { left: 0, top: 0 },
      markerRect: { left: 30, top: 4, height: 16 },
      scrollLeft: 0,
      scrollTop: 0
    });
    expect(rect.left).toBe(130);
    expect(rect.top).toBe(54);
    expect(rect.width).toBe(0);     // a caret is a zero-width position
    expect(rect.height).toBe(16);
    expect(rect.bottom).toBe(70);
  });

  it('cancels the mirror origin so only the in-content delta survives', () => {
    // Mirror not at the origin (e.g. a positioned ancestor): its corner must subtract out cleanly.
    const rect = composeCaretRect({
      textareaRect: { left: 100, top: 50 },
      mirrorRect: { left: 8, top: 8 },
      markerRect: { left: 38, top: 12, height: 16 },
      scrollLeft: 0,
      scrollTop: 0
    });
    expect(rect.left).toBe(130); // 100 + (38 - 8)
    expect(rect.top).toBe(54);   // 50 + (12 - 8)
  });

  it('shifts the caret opposite the scroll offset', () => {
    const rect = composeCaretRect({
      textareaRect: { left: 100, top: 50 },
      mirrorRect: { left: 0, top: 0 },
      markerRect: { left: 200, top: 4, height: 16 },
      scrollLeft: 120,
      scrollTop: 3
    });
    expect(rect.left).toBe(180); // 100 + 200 - 120
    expect(rect.top).toBe(51);   // 50 + 4 - 3
  });

  it('produces a DOMRect-shaped result (usable as a float virtual anchor)', () => {
    const rect = composeCaretRect({
      textareaRect: { left: 10, top: 20 },
      mirrorRect: { left: 0, top: 0 },
      markerRect: { left: 5, top: 0, height: 18 },
      scrollLeft: 0,
      scrollTop: 0
    });
    expect(rect.x).toBe(rect.left);
    expect(rect.y).toBe(rect.top);
    expect(rect.right).toBe(rect.left + rect.width);
    expect(rect.bottom).toBe(rect.top + rect.height);
    expect(rect.toJSON()).toMatchObject({ x: 15, y: 20, width: 0, height: 18 });
  });
});
