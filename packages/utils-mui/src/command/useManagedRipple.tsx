import type React from 'react';
import { useRef, useMemo, useCallback } from 'react';

import TouchRippleImport, {
  type TouchRippleActions, type TouchRippleProps
} from '@mui/material/ButtonBase/TouchRipple';

// The subpath's `.d.ts` types the default export as a bare `ForwardRefRenderFunction` (not a
// forwardRef component), so TS rejects it as JSX. At runtime it IS a `React.forwardRef(...)`
// component — cast to the usable component type.
const TouchRipple = TouchRippleImport as unknown as React.ForwardRefExoticComponent<
  TouchRippleProps & React.RefAttributes<TouchRippleActions>
>;

const RIPPLE_DURATION = 180;

export interface ManagedRipple {
  /**
   * An always-mounted ripple surface. Render it as a child of the (position: relative) button and
   * set `disableRipple` on that button so MUI's own ripple doesn't double up.
   */
  ripple: React.ReactNode;
  /** Fire a one-shot ripple. Safe to call from any command dispatch path (click, keystroke, remote). */
  trigger: () => void;
}

/**
 * A self-managed ripple, decoupled from MUI ButtonBase's *lazy* ripple.
 *
 * MUI (v6+) mounts a button's `TouchRipple` lazily: `touchRippleRef.current` stays `null` until the
 * user first pointer-/focus-interacts with THAT button. That defeats a programmatic ripple fired for
 * *remote* command execution — a toolbar button flashing when its keyboard shortcut runs while the
 * grid is focused — because the ref is null and `start()` no-ops. We instead render our OWN
 * always-mounted `TouchRipple`, so {@link ManagedRipple.trigger} works regardless of prior interaction.
 * The command button disables MUI's built-in ripple and lets this one handle every dispatch path
 * (which is what `useCommands` already routes through `onExecute`).
 */
export function useManagedRipple(): ManagedRipple {
  const refRipple = useRef<TouchRippleActions>(null);

  const ripple = useMemo(() => (
    <TouchRipple ref={refRipple} center={false} />
  ), []);

  const trigger = useCallback(() => {
    refRipple.current?.start(undefined, { center: true });
    setTimeout(() => refRipple.current?.stop(), RIPPLE_DURATION);
  }, []);

  return { ripple, trigger };
}
