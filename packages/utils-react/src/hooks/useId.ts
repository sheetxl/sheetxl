import React from 'react';
import { useState, useLayoutEffect, useEffect } from 'react';

let serverHandoffComplete = false;
let count = 0;

var index = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

const genId = () => "sheetxl-ui-" + count++;

function useMockId() {
  const [id, setId] = useState(() => serverHandoffComplete ? genId() : undefined);
  index(() => {
    if (id == null) {
      setId(genId());
    }
  }, []);
  useEffect(() => {
    if (!serverHandoffComplete) {
      serverHandoffComplete = true;
    }
  }, []);
  return id;
}

// `toString()` prevents bundlers from trying to `import { useId } from 'react'`
const useReactId = (React as any)[/*#__PURE__*/'useId'.toString()];
/**
 * Uses React 18's built-in `useId()` when available, or falls back to a
 * slightly less performant (requiring a double render) implementation for
 * earlier React versions.
 *
 * @see {@link https://movable-ui.com/docs/useId}
 */

export const useId = useReactId != null ? useReactId : useMockId;
