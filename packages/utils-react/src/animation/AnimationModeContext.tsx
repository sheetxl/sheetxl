import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react';

const MODES = {
  IDLE: 'idle',
  SCROLLING: 'scrolling',    // highest interrupt priority
  ZOOMING: 'zooming',
  SELECTING: 'selecting',
  // add more as needed
};

const PRIORITY = {
  [MODES.IDLE]: 0,
  [MODES.SELECTING]: 1,
  [MODES.SCROLLING]: 2,      // scroll/zoom beat everything
  [MODES.ZOOMING]: 2,
};

export interface AnimationMode {
  mode: 'idle' | 'interrupted';
  interrupt: () => void;
}

const AnimationModeContext = createContext<AnimationMode>({
  mode: 'idle',
  interrupt: () => {},  // no-op default so no-provider case still works
});

export function useAnimationMode() {
  return useContext(AnimationModeContext); // always works, fallback to 'idle'
}


export function AnimationModeProvider({ children }: { children?: ReactNode }) {
  const parentMode = useAnimationMode();
  const [localMode, setLocalMode] = useState(MODES.IDLE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const interrupt = useCallback(() => {
    setLocalMode(MODES.IDLE);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setLocalMode(MODES.IDLE), 400);
  }, []);

  const mode = localMode === 'interrupted' || parentMode?.mode === 'interrupted'
    ? 'interrupted'
    : 'idle';

  return (
    <AnimationModeContext.Provider value={{ mode, interrupt }}>
      {children}
    </AnimationModeContext.Provider>
  );
}