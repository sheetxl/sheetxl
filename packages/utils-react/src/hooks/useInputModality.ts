import { useSyncExternalStore } from 'react';

import { detectIt } from '../utils/ReactUtils';

/**
 * How the person is pointing right now: with a finger, or with something precise (a mouse, a
 * trackpad, a pen).
 */
export type InputModality = 'touch' | 'mouse';

/** The most recent press's modality, or `null` before any press. */
let lastPress: InputModality | null = null;
const listeners = new Set<() => void>();
let listening = false;

const primaryInput = (): InputModality => (detectIt().primaryInput === 'touch' ? 'touch' : 'mouse');

/**
 * The current input modality: `'touch'` on a touch-first device, or anywhere the last press was a
 * finger; `'mouse'` once a mouse or pen presses on a mouse-first device.
 *
 * @remarks
 * Touch affordances (selection grips, large handles, touch scroll thumbs) key off this rather than
 * off a static device test, so a laptop with a touchscreen shows them after a tap and hides them
 * after a click. A touch-first device keeps them even when a mouse is plugged in.
 */
export const getInputModality = (): InputModality => {
  if (primaryInput() === 'touch') return 'touch';
  return lastPress ?? 'mouse';
};

const onPointerDown = (e: PointerEvent): void => {
  const next: InputModality = e.pointerType === 'touch' ? 'touch' : 'mouse';
  if (next === lastPress) return;
  const before = getInputModality();
  lastPress = next;
  if (getInputModality() !== before) listeners.forEach((listener) => listener());
};

/**
 * Listen for the modality changing. The document listener is attached while anyone listens.
 *
 * @returns Stops listening.
 */
export const subscribeInputModality = (listener: () => void): (() => void) => {
  listeners.add(listener);
  if (!listening && typeof document !== 'undefined') {
    document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    listening = true;
  }
  return (): void => {
    listeners.delete(listener);
    if (listeners.size === 0 && listening) {
      document.removeEventListener('pointerdown', onPointerDown, { capture: true });
      listening = false;
    }
  };
};

const serverModality = (): InputModality => 'mouse';

/**
 * The current {@link InputModality}, re-rendering when it changes. See {@link getInputModality}.
 */
export const useInputModality = (): InputModality => {
  return useSyncExternalStore(subscribeInputModality, getInputModality, serverModality);
};
