import type React from 'react';
import { memo } from 'react';

import { useTheme, type Theme } from '@mui/material';

export interface ColorSetSwatchProps {
  /** The colors, in order, as CSS. */
  colors: readonly string[];
  /** What each color is, in order: shown when it is pointed at. */
  labels?: readonly string[];
  /**
   * How the colors are drawn. `chips`: each a rounded square of its own, overlapping the one
   * before it, for colors that are different things. `ramp`: one rounded bar running from the
   * first color to the last, for shades of one color. Default `chips`.
   */
  variant?: 'chips' | 'ramp';
  /**
   * How large it is drawn: `medium` for a gallery, `icon` for a toolbar button, where it is as tall
   * as the toolbar's other icons (`--icon-size`) so the toolbar keeps its height. Default `medium`.
   */
  size?: 'icon' | 'medium';
  style?: React.CSSProperties;
}

/**
 * How a block of color is finished wherever colors are picked from or shown as a set: its corners'
 * radius, and a faint flat edge over it (no shadow), so that a color close to the surface's is
 * still seen. The color picker's squares and columns take the same, so they read as one family.
 */
export const COLOR_BLOCK_RADIUS = 5;
export const colorBlockEdge = (theme: Theme): Record<string, unknown> => ({
  position: 'relative',
  borderRadius: `${COLOR_BLOCK_RADIUS}px`,
  overflow: 'hidden',
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 'inherit',
    pointerEvents: 'none'
  }
});

/** A chip's side, how far apart chips start (less than a side: they overlap), a corner's radius and the ring's width, per size. */
const CHIPS = { medium: { side: 24, step: 22, radius: COLOR_BLOCK_RADIUS, ring: 2 }, icon: { side: 16, step: 10, radius: 4, ring: 1.5 } } as const;
/** A ramp's height and its corners' radius, per size. */
const RAMP = { medium: { height: 24, radius: COLOR_BLOCK_RADIUS }, icon: { height: 16, radius: 4 } } as const;

/** A rounded square's outline as a path, so that it is not taken for one of the colors. */
const outline = (x: number, y: number, side: number, radius: number): string =>
  `M${x + radius},${y} h${side - 2 * radius} a${radius},${radius} 0 0 1 ${radius},${radius} v${side - 2 * radius} a${radius},${radius} 0 0 1 -${radius},${radius} h-${side - 2 * radius} a${radius},${radius} 0 0 1 -${radius},-${radius} v-${side - 2 * radius} a${radius},${radius} 0 0 1 ${radius},-${radius} z`;

/**
 * A set of colors in small: a theme's, a chart's color set. Colors that are different things are a
 * row of chips, each ringed in the surface's color where it overlaps the one before, and edged
 * faintly so that one the color of the surface is still seen. Shades of one color are a ramp.
 */
export const ColorSetSwatch = memo((props: ColorSetSwatchProps) => {
  const { colors, labels, variant = 'chips', size = 'medium', style: propStyle } = props;
  const theme = useTheme();
  const ramp = variant === 'ramp';
  const chips = CHIPS[size];
  const bar = RAMP[size];
  // A ramp is as wide as chips of as many colors, so a button showing either keeps its width.
  const width = Math.max(0, colors.length - 1) * chips.step + chips.side;
  const block = width / Math.max(1, colors.length);
  const height = ramp ? bar.height : chips.side;
  const style: React.CSSProperties = size === 'icon'
    ? { display: 'block', height: 'var(--icon-size, 16px)', width: 'auto', aspectRatio: `${width} / ${height}`, marginRight: '4px' }
    : { display: 'block', width, height, flex: 'none' };
  const title = (index: number): React.ReactNode => labels?.[index] ? <title>{labels[index]}</title> : null;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden={labels ? undefined : true}
      focusable={false}
      data-variant={variant}
      // A ramp is one bar: its ends are rounded by clipping the whole of it.
      style={{ ...style, ...(ramp ? { borderRadius: bar.radius, overflow: 'hidden' } : { overflow: 'visible' }), ...propStyle }}
    >
      {colors.map((color, index) => {
        if (ramp) return <rect key={index} x={index * block} y={0} width={block} height={bar.height} fill={color}>{title(index)}</rect>;
        const x = index * chips.step + chips.ring / 2;
        const side = chips.side - chips.ring;
        return (
          <g key={index}>
            <rect x={x} y={chips.ring / 2} width={side} height={side} rx={chips.radius} fill={color} stroke={theme.palette.background.paper} strokeWidth={chips.ring}>
              {title(index)}
            </rect>
            <path d={outline(x + chips.ring / 2, chips.ring, side - chips.ring, Math.max(1, chips.radius - chips.ring / 2))} fill="none" stroke={theme.palette.divider} strokeWidth={1} pointerEvents="none"/>
          </g>
        );
      })}
    </svg>
  );
});

ColorSetSwatch.displayName = 'ColorSetSwatch';
