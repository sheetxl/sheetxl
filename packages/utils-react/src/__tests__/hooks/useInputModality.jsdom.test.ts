import { describe, it, expect, vi, beforeEach } from 'vitest';

const detect = vi.hoisted(() => ({ primaryInput: 'mouse' as 'mouse' | 'touch' }));
vi.mock('detect-it', () => ({
  get primaryInput() { return detect.primaryInput; },
  supportsTouchEvents: true,
  supportsPointerEvents: true,
  supportsPassiveEvents: true,
  deviceType: 'hybrid'
}));

import { getInputModality, subscribeInputModality } from '../../hooks/useInputModality';

const press = (pointerType: string): void => {
  const e = new MouseEvent('pointerdown', { bubbles: true });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  document.body.dispatchEvent(e);
};

describe('input modality', () => {
  let changes = 0;
  let unsubscribe: () => void;
  beforeEach(() => {
    detect.primaryInput = 'mouse';
    changes = 0;
    unsubscribe?.();
    unsubscribe = subscribeInputModality(() => { changes++; });
    press('mouse'); // a known starting point for the module-level last press
    changes = 0;
  });

  it('a mouse-first device starts as mouse', () => {
    expect(getInputModality()).toBe('mouse');
  });

  it('a touch press switches to touch and a mouse press switches back', () => {
    press('touch');
    expect(getInputModality()).toBe('touch');
    expect(changes).toBe(1);
    press('mouse');
    expect(getInputModality()).toBe('mouse');
    expect(changes).toBe(2);
  });

  it('a pen counts as a precise pointer', () => {
    press('touch');
    press('pen');
    expect(getInputModality()).toBe('mouse');
  });

  it('a repeated press of the same kind does not notify', () => {
    press('touch');
    press('touch');
    expect(changes).toBe(1);
  });

  it('a touch-first device stays touch through a mouse press', () => {
    detect.primaryInput = 'touch';
    expect(getInputModality()).toBe('touch');
    press('mouse');
    expect(getInputModality()).toBe('touch');
    expect(changes).toBe(0);
  });
});
