import type React from 'react';
import { createContext, createElement, useContext, useMemo, useSyncExternalStore } from 'react';

import { detectIt } from '../utils/ReactUtils';

import { getVirtualKeyboardApi } from './_keyboardApi';

/** The virtual keyboard a text field asks for (its `inputmode`). */
export type VirtualKeyboardInputMode = 'text' | 'decimal' | 'numeric' | 'tel' | 'email' | 'url' | 'search';

/**
 * Configuration for a {@link VirtualKeyboardStore}.
 */
export interface VirtualKeyboardOptions {
  /**
   * Never enter keyboard mode: the grid takes focus itself, and the keyboard comes and goes with
   * each text field as the browser decides. `false` turns keyboard mode on where the device was not
   * detected to have one.
   *
   * @defaultValue `true` on a device with no touch input (no virtual keyboard), else `false`
   */
  disabled?: boolean;
  /** Leave the grid scrolled where it is when the keyboard rises over the active cell. */
  disableScrollIntoView?: boolean;
  /**
   * A tap on the grid keeps keyboard mode, as Excel keeps its keyboard, rather than putting the
   * keyboard away.
   */
  keepOnTap?: boolean;
}

/**
 * The keyboard-mode state.
 */
export interface VirtualKeyboardState {
  /**
   * Whether the sheet is in keyboard mode: a virtual keyboard is up for typing into the sheet, and
   * focusing the sheet lands on its typing input so the keyboard stays.
   */
  readonly active: boolean;
  /** The keyboard every sheet text field asks for. */
  readonly inputMode: VirtualKeyboardInputMode;
}

/**
 * The imperative handle {@link useVirtualKeyboard} returns.
 */
export interface VirtualKeyboardHandler {
  /** The current state. A new object on each change. */
  getState(): VirtualKeyboardState;
  /**
   * Whether keyboard mode is available: the device has a virtual keyboard, and the store is not
   * {@link VirtualKeyboardOptions.disabled}. The counterpart of `document.fullscreenEnabled`; a host
   * leaves keyboard-mode parts (the sheet's keyboard layer) out when it is `false`.
   */
  isEnabled(): boolean;
  /** Shorthand for `getState().active`. */
  isActive(): boolean;
  /** Shorthand for `getState().inputMode`. */
  getInputMode(): VirtualKeyboardInputMode;
  /** Ask for a different keyboard on the sheet's text fields. */
  setInputMode(inputMode: VirtualKeyboardInputMode): void;
  /**
   * Enter keyboard mode. A sheet whose focus is not already in a text field focuses its typing
   * input, which raises the keyboard; browsers raise one only inside a user gesture, so call this
   * from a tap.
   *
   * @returns Whether keyboard mode is on: `false` when it is not {@link isEnabled | enabled}, as
   * `requestFullscreen` refuses where fullscreen is not.
   */
  show(): boolean;
  /**
   * Leave keyboard mode, and go back to the letters keyboard: a field opened later (a double-click
   * into a cell) asks for letters, so the next keyboard does too. A sheet whose typing input has focus
   * hands it to the grid, which lowers the keyboard; an editor that has focus keeps it.
   */
  hide(): void;
  /**
   * Name the editor that typing opens in while in keyboard mode, by the id it parks on the edit
   * session (`EditSession.setActiveEditorId`); a phone's formula bar names itself so a typed key
   * opens the edit there rather than in the cell. The latest registration wins.
   *
   * @returns Removes this registration.
   */
  registerEditor(editorId: string): () => void;
  /** The editor typing opens in while in keyboard mode, or `null` for the cell. */
  getEditorId(): string | null;
  /** The options the store was created with. */
  getOptions(): Readonly<VirtualKeyboardOptions>;
}

/**
 * A virtual keyboard **bus instance**: one keyboard mode shared by the sheet, its editors, and any
 * control that shows or hides the keyboard.
 */
export interface VirtualKeyboardStore extends VirtualKeyboardHandler {
  /** Subscribe to any state change. Returns the remover. */
  subscribe(listener: () => void): () => void;
}

/**
 * The least height, in px, the virtual keyboard takes from the visual viewport. The browser's
 * collapsing address bar takes less, so it never reads as a keyboard.
 */
const KEYBOARD_MIN_HEIGHT = 150;

/**
 * Whether a virtual keyboard is up, read from the visual viewport (the part of the page the keyboard
 * leaves visible). Pinch zoom shrinks the visual viewport too, so its scale is undone first. While a
 * keyboard overlays the page (the browser's VirtualKeyboard API with `overlaysContent`, as a
 * `KeyboardAccessory` sets it), the browser's own report of the keyboard is read instead.
 *
 * @param baseline The layout height to measure against, in px. Defaults to `window.innerHeight`; pass
 *   the height read before the keyboard rose where the page may shrink with it (a host whose viewport
 *   asks for `interactive-widget=resizes-content`).
 */
export const isVirtualKeyboardUp = (baseline?: number): boolean => {
  if (typeof window === 'undefined') return false;
  // A keyboard that overlays the page leaves the visual viewport alone; the browser reports it instead.
  const api = getVirtualKeyboardApi();
  if (api?.overlaysContent) return api.boundingRect.height > KEYBOARD_MIN_HEIGHT;
  const vv = window.visualViewport;
  if (!vv) return false;
  return (baseline ?? window.innerHeight) - vv.height * vv.scale > KEYBOARD_MIN_HEIGHT;
};

/**
 * Create an isolated virtual keyboard store.
 */
export const createVirtualKeyboardStore = (options?: VirtualKeyboardOptions): VirtualKeyboardStore => {
  const storeOptions: Readonly<VirtualKeyboardOptions> = Object.freeze({ ...options });
  const enabled = !(storeOptions.disabled ?? detectIt().deviceType === 'mouseOnly');
  let state: VirtualKeyboardState = { active: false, inputMode: 'text' };
  const editors: string[] = [];
  const listeners = new Set<() => void>();
  const update = (next: Partial<VirtualKeyboardState>): void => {
    if ((next.active ?? state.active) === state.active && (next.inputMode ?? state.inputMode) === state.inputMode) return;
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };
  return {
    getState: (): VirtualKeyboardState => state,
    isEnabled: (): boolean => enabled,
    isActive: (): boolean => state.active,
    getInputMode: (): VirtualKeyboardInputMode => state.inputMode,
    setInputMode: (inputMode: VirtualKeyboardInputMode): void => update({ inputMode }),
    show: (): boolean => {
      if (!enabled) return false;
      update({ active: true });
      return true;
    },
    hide: (): void => update({ active: false, inputMode: 'text' }),
    registerEditor: (editorId: string): (() => void) => {
      editors.push(editorId);
      return (): void => {
        const index = editors.lastIndexOf(editorId);
        if (index >= 0) editors.splice(index, 1);
      };
    },
    getEditorId: (): string | null => editors[editors.length - 1] ?? null,
    getOptions: (): Readonly<VirtualKeyboardOptions> => storeOptions,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }
  };
};

// The DEFAULT store: the zero-config, app-wide keyboard, used by every consumer with no
// VirtualKeyboardProvider above it. Created on first use, so the device is detected in the browser.
let _defaultStore: VirtualKeyboardStore | null = null;
const defaultStore = (): VirtualKeyboardStore => {
  if (!_defaultStore) _defaultStore = createVirtualKeyboardStore();
  return _defaultStore;
};

const VirtualKeyboardContext = createContext<VirtualKeyboardStore | null>(null);

export interface VirtualKeyboardProviderProps extends VirtualKeyboardOptions {
  /** The bus instance to share. Omit to create one for this subtree from the options. */
  store?: VirtualKeyboardStore;
  children?: React.ReactNode;
}

/**
 * Share one virtual keyboard bus with a subtree: the sheet, its editors, and any keyboard control an
 * app adds (a "show keyboard" button calls `useVirtualKeyboard().show()`). With no `store` a fresh one
 * is created from the options, stable while they are unchanged.
 */
export const VirtualKeyboardProvider = (props: VirtualKeyboardProviderProps): React.ReactElement => {
  const { store, disabled, disableScrollIntoView, keepOnTap, children } = props;
  const own = useMemo(
    () => store ?? createVirtualKeyboardStore({ disabled, disableScrollIntoView, keepOnTap }),
    [store, disabled, disableScrollIntoView, keepOnTap]
  );
  return createElement(VirtualKeyboardContext.Provider, { value: own }, children);
};

/**
 * Resolve the enclosing bus **instance**: the nearest {@link VirtualKeyboardProvider}'s store, else
 * the app-wide default, enabled on a device with touch input. Never `null`: where there is no
 * virtual keyboard the store reports `isEnabled() === false` and `show()` refuses, as the
 * fullscreen API does where fullscreen is unavailable. Non-reactive; use {@link useVirtualKeyboard}
 * to also re-render.
 */
export const useVirtualKeyboardStore = (): VirtualKeyboardStore => {
  return useContext(VirtualKeyboardContext) ?? defaultStore();
};

/**
 * Access the enclosing virtual keyboard bus. Reading re-renders on change.
 */
export const useVirtualKeyboard = (): VirtualKeyboardHandler => {
  const store = useVirtualKeyboardStore();
  useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return store;
};
