import type React from 'react';

import { Box, type Theme } from '@mui/material';

import { IBorders, type ICell, type IRange } from '@sheetxl/sdk';

import { DynamicIcon, useMeasure, useDevicePixelRatio } from '@sheetxl/utils-react';

import { strokeShadowFilter } from '@sheetxl/utils-mui';

import { StaticBorderRenderer } from '@sheetxl/react';

export interface BorderTemplateIconProps {
  /**
   * The border this icon stands for — the edges a click would draw, with the style and color it
   * would draw them in. `null`, or an all-`None` border, is the empty grid.
   */
  border: Partial<IBorders.Properties> | null;
  /** Mints the per-cell border the renderer draws. */
  createBorder: (properties: Partial<IBorders.Properties>) => IBorders | null;
}

/**
 * A border button's icon: a 5x5 grid of dots with the border itself drawn across it.
 *
 * @remarks
 * The lines are a real {@link StaticBorderRenderer} fed the same strokes the click would write, so
 * every one of these buttons previews its own edit — the current line style and color included.
 * The dots are the cells, and they are drawn only where no line covers them. A diagonal runs
 * corner to corner across the whole grid.
 *
 * Dots and lines share one device-pixel layout: each dot is an odd number of device pixels
 * centered on the pixel a thin line at that boundary fills, so odd-width lines run through the
 * dots' centers and an even-width line keeps its inner pixel on them.
 */
export const BorderTemplateIcon = (props: BorderTemplateIconProps): React.ReactElement => {
  const { border, createBorder } = props;

  const [refMeasure, { width: measureWidth, height: measureHeight }] = useMeasure<HTMLDivElement>();
  const dpr = useDevicePixelRatio();

  // Only the edges that draw; a `None` edge leaves its dots showing.
  const drawn: Partial<IBorders.Properties> = {};
  const edges = border ? (Object.keys(border) as (keyof IBorders.Properties)[]) : [];
  const edgesLength = edges.length;
  for (let i=0; i<edgesLength; i++) {
    const edge = edges[i];
    const borderEdge = border?.[edge];
    if (!borderEdge?.style || borderEdge.style === IBorders.StrokeStyle.None) continue;
    drawn[edge] = {
      style: borderEdge.style,
      color: borderEdge.color,
    };
  }
  const hasDrawn = Object.keys(drawn).length > 0;

  const getBorderAt = (coords: ICell.Coords, _index: number): IBorders | null => {
    if (!createBorder || !hasDrawn) return null;
    const borderPropsRender: Partial<IBorders.Properties> = {
      diagonalUp: drawn.diagonalUp,
      diagonalDown: drawn.diagonalDown
    };
    if (coords.rowIndex === 0) {
      borderPropsRender.top = drawn.top;
      borderPropsRender.bottom = drawn.horizontal;
    } else {
      borderPropsRender.top = drawn.horizontal;
      borderPropsRender.bottom = drawn.bottom;
    }
    if (coords.colIndex === 0) {
      borderPropsRender.left = drawn.left;
      borderPropsRender.right = drawn.vertical;
    } else {
      borderPropsRender.left = drawn.vertical;
      borderPropsRender.right = drawn.right;
    }
    return createBorder(borderPropsRender);
  }

  const size = Math.min(measureWidth, measureHeight);
  const layout = size > 0 ? _layoutGrid(size, dpr) : null;

  let dots = '';
  if (layout) {
    const { start, span, dot } = layout;
    const covered = (i: number, j: number): boolean => (
      (j === 0 && !!drawn.top) ||
      (j === 2 && !!drawn.horizontal) ||
      (j === 4 && !!drawn.bottom) ||
      (i === 0 && !!drawn.left) ||
      (i === 2 && !!drawn.vertical) ||
      (i === 4 && !!drawn.right) ||
      (i === j && !!drawn.diagonalDown) ||
      (i + j === 4 && !!drawn.diagonalUp)
    );
    const dotSize = dot / dpr;
    const half = dotSize / 2;
    for (let j=0; j<5; j++) {
      for (let i=0; i<5; i++) {
        // Dots sit on the grid lines only.
        if ((i % 2 !== 0 && j % 2 !== 0) || covered(i, j)) continue;
        const x = (start + i * span / 4 + 0.5) / dpr - half;
        const y = (start + j * span / 4 + 0.5) / dpr - half;
        dots += `M ${x},${y} h ${dotSize} v ${dotSize} h ${-dotSize} Z `;
      }
    }
  }

  return (
    <DynamicIcon> {/* blank - for sizing */}
      <Box
        ref={refMeasure}
        className="border-icon"
        sx={{
          width: 'var(--icon-size, var(--icon-size-md))',
          height: 'var(--icon-size, var(--icon-size-md))',
          position: 'relative',
          // Muted so the dots read as a guide under the lines rather than as marks of their own:
          // pixel-aligned, they are as crisp as the lines are.
          '& .grid > path': {
            fill: (theme: Theme) => theme.palette.text.secondary,
            opacity: '0.7'
          }
        }}
      >
        {layout ? (<>
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="grid"
            style={{
              top: '0px',
              left: '0px',
              width: `${size}px`,
              height: `${size}px`,
              position: 'absolute',
              overflow: 'visible'
            }}
          >
            <path
              className="fill"
              d={dots}
            />
          </svg>
          <Box
            className='border-container'
            sx={{
              position: 'absolute',
              top: '0px',
              left: '0px',
              width: `${size}px`,
              height: `${size}px`,
              '& svg path': {
                filter: strokeShadowFilter
              }
            }}
          >
            <StaticBorderRenderer
              // `getBorderAt` legitimately returns null (no temporary border for empty edges); the
              // renderer handles that at runtime though its prop type currently declares non-null.
              getBorderAt={getBorderAt as (value: any, index: number) => IBorders}
              getMergeAt={_getMergeAt}
              width={layout.span / dpr}
              height={layout.span / dpr}
              style={{
                top: `${layout.start / dpr}px`,
                left: `${layout.start / dpr}px`,
                width: `${layout.span / dpr}px`,
                height: `${layout.span / dpr}px`,
                position: 'absolute'
              }}
            />
          </Box>
        </>) : null}
      </Box>
    </DynamicIcon>
  )
};

BorderTemplateIcon.displayName = 'BorderTemplateIcon';

/** The whole 2x2, so a diagonal runs corner to corner of the icon rather than of each cell. */
const _templateBox: IRange.Coords = Object.freeze({ rowStart: 0, colStart: 0, rowEnd: 1, colEnd: 1 });
const _getMergeAt = (): IRange.Coords => _templateBox;

/**
 * Where the grid sits in an icon of `size` CSS px, in device pixels.
 *
 * - `start` - the pixel the first line (and first dot) fills.
 * - `span` - device pixels from the first line's pixel to the last's. A multiple of 4, so the
 *   five dots per axis (the lines and the cell middles) all land on whole pixels.
 * - `dot` - the dot's size; odd, so it centers on a line's pixel.
 *
 * A margin of at least one device pixel is left for the pixel a 3-wide or trailing 2-wide line
 * grows past its boundary pixel.
 */
const _layoutGrid = (size: number, dpr: number): { start: number, span: number, dot: number } | null => {
  const device = Math.floor(size * dpr);
  let dot = Math.max(1, Math.round(dpr));
  if (dot % 2 === 0) dot++;
  const margin = Math.max(1, (dot - 1) / 2);
  const span = Math.floor((device - 2 * margin - 1) / 4) * 4;
  if (span < 4) return null;
  const start = Math.floor((device - span - 1) / 2);
  return { start, span, dot };
};
