import { CommonUtils } from '@sheetxl/utils';

import * as detectItImport from 'detect-it';

/* Focusable node names */
export const focusableNodeNames = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export const EmptyCssProperties:React.CSSProperties = {};


/**
 * Re-export detectIt.
 *
 * @returns The `detect-it` library.
 */
export function detectIt(): {
  supportsPassiveEvents: boolean
  supportsPointerEvents: boolean;
  supportsTouchEvents: boolean;
  deviceType: 'mouseOnly' | 'touchOnly' | 'hybrid';
  primaryInput: 'mouse' | 'touch'
} {
  return detectItImport;
}

function deviceAligned(cssPoint: number): number {
  const dpr = window.devicePixelRatio || 1;
  // snap to nearest half-device-pixel center
  return Math.round(cssPoint * dpr) / dpr + (0.5 / dpr);
}

export function boundPixel(cssPoint: number, _increase: boolean=false, _absOffset: number=0): number {
  // const dpr = window.devicePixelRatio || 1;
  // // snap to nearest half-device-pixel center
  // return Math.floor(cssPoint * dpr) / dpr + (0.5 / dpr);
  // pixel = Math.round(pixel);
  // absOffset = 0;

  // let scaledValue = value * devicePixelRatio;
  // if (Math.round(scaledValue) % 2 === 0) {
  //   // If even, adjust to the nearest odd
  //   value += (1 / devicePixelRatio);
  // }
  // return value;

  // const devicePixelRatio = window.devicePixelRatio || 1;

  // // Combine absolute offset with pixel and scale it
  // const absPixel = absOffset + pixel;
  // const scaledValue = absPixel * devicePixelRatio;
  // if (scaledValue % 2 !== 0) {
  //   pixel += 1 / devicePixelRatio;
  // }
  return cssPoint;

  // const aligned = Math.round(Math.round(absPixel * devicePixelRatio) / devicePixelRatio);
  // if (aligned % 2 !== 0) {
  //   pixel += increase ? 1 : -1;
  // }
  // return pixel;
  // Check if the scaled value is even or odd
  // if (Math.floor(scaledPixel) % 2 !== 0) {
  //   // If it's odd, adjust the original pixel to align to an even boundary
  //   pixel += increase ? 1 : -1;
  // }

  // return pixel;
  // return Math.round(pixel * ratio) / ratio;// - 0.1;
  // const ratio = window.devicePixelRatio || 1;
  // return Math.round(pixel * ratio) / ratio;// - 0.1;
  // return pixel;
  // return pixel;
  // const rnd = Math.round(pixel);
  // // if even then adjust by 0.2 to make it odd (to align to a pixel)
  // if (rnd % 2 === 0) return rnd + ((increase ? 1 : -1) * 0.2);
  // return rnd;
}


export const toPrettyKeyCode = (key: string) => {
  if (key === 'BracketLeft') return '[';
  if (key === 'BracketRight') return ']';
  return CommonUtils.camelToPrettyCase(key);
}


export const createSyntheticEvent = <T extends Element, E extends Event>(event: E): React.SyntheticEvent<T, E> => {
  let isDefaultPrevented = false;
  let isPropagationStopped = false;
  const preventDefault = () => {
    isDefaultPrevented = true;
    event.preventDefault();
  }
  const stopPropagation = () => {
    isPropagationStopped = true;
    event.stopPropagation();
  }
  return {
    nativeEvent: event,
    currentTarget: event.currentTarget as EventTarget & T,
    target: event.target as EventTarget & T,
    bubbles: event.bubbles,
    cancelable: event.cancelable,
    defaultPrevented: event.defaultPrevented,
    eventPhase: event.eventPhase,
    isTrusted: event.isTrusted,
    preventDefault,
    isDefaultPrevented: () => isDefaultPrevented,
    stopPropagation,
    isPropagationStopped: () => isPropagationStopped,
    persist: () => {},
    timeStamp: event.timeStamp,
    type: event.type,
  };
}