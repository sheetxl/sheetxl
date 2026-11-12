import type React from 'react';
import { useMemo } from 'react';

import { type IconGlyphKey } from './Types';
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

  /**
   * Retint the walkable stroke to a semantic token. Mirrors `SheetClipboardLayer`
   * (`isCut ? warning : primary`): defaults to `"primary"`, pass `"warning"` for a cut.
   */
  themedType?: "primary" | "accent" | "success" | "info" | "warning" | "error";

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
    themedType = "primary",
    speed = 120,
    dashGap = 3,
    dashLength = 5,
    iconKey,
    packKey,
    style: propsStyle,
    className: propsClassName,
    ...rest
  } = props;

  const styleAnimation: React.CSSProperties | undefined = useMemo(() => {
    if (!isWalking)
      return undefined;
    const totalLength = dashGap + dashLength;
    const totalSpeed = speed * totalLength;

    const retValue = {
      // animation controls
      ["--walk-duration"]: `${totalSpeed}ms`,
      ["--walk-dash-length"]: `${dashLength}px`,
      ["--walk-dash-gap"]: `${dashGap}px`,
    } as React.CSSProperties;

    // Retint the walkable `.primary` layer to a semantic token via the `--icon-primary` override
    // hook (the `.primary` class in DynamicIcon.module.css reads it). "primary" means "no override —
    // keep the layer's own primary color", matching SheetClipboardLayer's default.
    if (themedType && themedType !== "primary") {
      (retValue as Record<string, string>)["--icon-primary"] = `var(--sxl-color-${themedType})`;
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