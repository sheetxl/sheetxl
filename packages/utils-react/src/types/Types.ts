
export const KeyModifiers = {
  Shift: 'shift',
  Alt: 'alt',
  Ctrl: 'ctrl',
  Meta: 'meta' // we treat this as ctrl
} as const;
export type KeyModifiers = typeof KeyModifiers[keyof typeof KeyModifiers];

export interface IKeyStroke {
  readonly key: string;

  // TODO - remove modifiers const.
  // shift?: boolean;
  // ctrl?: boolean;
  // alt?: boolean;
  // meta?: boolean;
  readonly modifiers?: KeyModifiers[];
}

export const KeyCodes = {
  BackSpace: 8,
  Tab: 9,
  Clear: 12,
  Enter: 13,
  Shift: 16,
  Control: 17,
  Alt: 18,
  Pause: 19,
  CapsLock: 20,
  Escape: 27,
  Space: 32,
  PageUp: 33,
  PageDown: 34,
  End: 35,
  Home: 36,
  Left: 37,
  Up: 38,
  Right: 39,
  Down: 40,
  Insert: 45,
  Delete: 46,
  Digit_8: 56,
  // A: 65,
  // B: 66,
  // C: 67,
  Y: 89,
  Z: 90,
  Meta: 91,
  F1: 112,
  F2: 113,
  F3: 114,
  F4: 115,
  F5: 116,
  F6: 117,
  F7: 118,
  F8: 119,
  F9: 120,
  F10: 121,
  F11: 122,
  F12: 123,
  NumLock: 144,
  ScrollLock: 145,
  BackSlash: 220,
  Slash: 191,
  BracketRight: 221,
  BracketLeft: 219,
  /** Android/IME composition key - used when virtual keyboards send composite input */
  Composition: 229,
  // Semicolon: 186,
  // Quote: 222,
} as const;
export type KeyCodes = typeof KeyCodes[keyof typeof KeyCodes];


export const MouseButtonCodes = {
  Left: 1,
  Middle: 2,
  Right: 3,
} as const;
export type MouseButtonCodes = typeof MouseButtonCodes[keyof typeof MouseButtonCodes];

export interface TextSelectionRange {
  start: number;
  end: number;
  direction?: 'forward' | 'backward' | 'none'
}