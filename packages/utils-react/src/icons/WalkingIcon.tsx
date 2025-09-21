import React, { useMemo } from 'react';

import type { IconGlyphKey } from './Types';
import { DynamicIcon, type DynamicIconProps } from './DynamicIcon';

/**
 * This wraps an icon with a walking stroke animation.
 *
 * @remarks
 * This requires a 'delegating' glyph icons to passed.
 * This will then use CSS animation to create a walking stroke effect.
 */
export interface WalkingIconProps extends DynamicIconProps {
  /** The key of the icon this must be available in the DynamicIconService. */
  iconKey: IconGlyphKey;
  /** Animate the stroke marching effect. */
  isWalking: boolean;

  /** Map the accent layer to a semantic token; defaults to "info". */
  themedType?: "accent" | "success" | "info" | "warn" | "error";

  /** Animation speed in milliseconds. */
  speed?: number;
  dashGap?: number;
  dashLength?: number;
}

// TODO - have speed calculated based on dash length of strokes
// TODO - should we allow for dynamic children or always use Icon
export function WalkingIcon(props: WalkingIconProps) {
  const {
    isWalking = false,
    themedType = "info",
    speed = 120,
    dashGap = 3,
    dashLength = 5,
    iconKey,
    packKey,
    style: propsStyle,
    className: propsClassName,
    ...rest
  } = props;

  const styleAnimation:React.CSSProperties = useMemo(() => {
    if (!isWalking)
      return;
    const totalLength = dashGap + dashLength;
    const totalSpeed = speed * totalLength;

    const retValue = {
      // animation controls
      ["--walk-duration"]: `${totalSpeed}ms`,
      ["--walk-dash-length"]: `${dashLength}px`,
      ["--walk-dash-gap"]: `${dashGap}px`,
    } as React.CSSProperties;

    // TODO - why !== 'accent'?
    if (themedType && themedType !== "accent") {
      retValue["--icon-accent"] = `var(--icon-${themedType})`;
    }
    return retValue;
  }, [isWalking, speed, dashGap, dashLength, themedType]);

  const className = useMemo(() => {
    if (!isWalking) return propsClassName;
    return propsClassName + ' walking';
  }, [isWalking, propsClassName]);

  return (
    <DynamicIcon
      iconKey={iconKey}
      packKey={packKey}
      className={className}
      // TODO - memo?
      style={{ ...propsStyle, ...styleAnimation }}
      {...rest}
    />
  );
}