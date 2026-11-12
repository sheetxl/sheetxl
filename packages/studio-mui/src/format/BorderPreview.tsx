import type React from 'react';
import { useCallback, useRef, useState } from 'react';

import clsx from 'clsx';

import { alpha, type Theme } from '@mui/material';
import { Box } from '@mui/material';

import { IBorders, type ICell } from '@sheetxl/sdk';

import { useTranslator, type TranslateFn } from '@sheetxl/utils-react';

import { StaticBorderRenderer } from '@sheetxl/react';

/**
 * The lines the diagram lets you click — the six that run along a block's cell boundaries.
 *
 * @remarks
 * The diagonals are not here: they cross the inner rules, and nearest-line picking cannot separate
 * lines that cross at the same point. They are aimed at by the block's outer corners instead (see
 * {@link edgesAt}).
 *
 * The order is the tie-break for a pointer sitting exactly where two lines cross, so the OUTER
 * edges come first — a click on the left edge at its midpoint is aimed at the block's outline, not
 * at the inner rule that happens to end there. The crossing of the two inner rules is not a tie at
 * all: it is its own target (see {@link edgesAt}).
 */
export const PREVIEW_EDGES: readonly IBorders.Edge[] = Object.freeze([
  IBorders.Edge.Top,
  IBorders.Edge.Bottom,
  IBorders.Edge.Left,
  IBorders.Edge.Right,
  IBorders.Edge.Horizontal,
  IBorders.Edge.Vertical
]);

const NO_EDGES: readonly IBorders.Edge[] = Object.freeze([]);

/** Both inner rules — what the center of the diagram aims at. */
const INSIDE_EDGES: readonly IBorders.Edge[] = Object.freeze([
  IBorders.Edge.Horizontal, IBorders.Edge.Vertical
]);

/** Each edge as a target of one. Shared instances, so an unchanged aim is an unchanged value. */
const SINGLE_EDGE = new Map<IBorders.Edge, readonly IBorders.Edge[]>(
  [...PREVIEW_EDGES, IBorders.Edge.DiagonalUp, IBorders.Edge.DiagonalDown].map((edge) => [edge, Object.freeze([edge])])
);

const isDiagonalEdge = (edge: IBorders.Edge): boolean => {
  return edge === IBorders.Edge.DiagonalUp || edge === IBorders.Edge.DiagonalDown;
};

/** The strokes currently drawn on a block, by edge. An absent entry means "no line here". */
export type BorderEdges = Partial<Record<IBorders.Edge, IBorders.StrokeProperties>>;

/** Localized name for a border edge; literal `t()` pairs keep the extractor able to see them. */
export function edgeLabel(t: TranslateFn, edge: IBorders.Edge): string {
  switch (edge) {
    case IBorders.Edge.Top: return t('border.top');
    case IBorders.Edge.Left: return t('border.left');
    case IBorders.Edge.Right: return t('border.right');
    case IBorders.Edge.Bottom: return t('border.bottom');
    case IBorders.Edge.Horizontal: return t('border.insideHorizontal');
    case IBorders.Edge.Vertical: return t('border.insideVertical');
    case IBorders.Edge.DiagonalUp: return t('border.diagonalUp');
    case IBorders.Edge.DiagonalDown: return t('border.diagonalDown');
    default: return edge;
  }
}

/**
 * How far from a line a click still counts as aimed at it, in CSS px.
 *
 * @remarks
 * A ceiling, not a target: {@link edgesAt} shrinks it on a small diagram so no two bands can meet.
 * Past it a click lands on no edge at all — the middle of a cell means nothing here, and toggling
 * whichever line happened to be nearest is worse than doing nothing.
 */
const HIT_DISTANCE = 10;

/** Half the thickness of the band drawn along an edge to show it is the one under the pointer. */
const HIGHLIGHT_HALF = 3;

/** How long a boundary tick is, in CSS px. With {@link TICK_GAP} it has to fit the padding ring. */
const TICK_LENGTH = 5;

/** The clear space between a tick and the block it marks, in CSS px. */
const TICK_GAP = 2;

/** Where a boundary sits across the block, as a CSS offset that keeps a 1px tick inside it. */
const tickOffset = (fraction: number): string => {
  if (fraction === 0) return '0px';
  if (fraction === 1) return 'calc(100% - 1px)';
  return `calc(${fraction * 100}% - 0.5px)`;
};

/**
 * The ticks that mark where each cell boundary runs, as absolute-position CSS.
 *
 * @remarks
 * One at each end of every boundary, in the ring OUTSIDE the block — Excel's crop marks. They are
 * there whether or not a line is drawn, so an empty diagram still shows which edges it has: two
 * ticks along a side for a block with no inside, three for one with an inner rule to set.
 */
const boundaryTicks = (rowCount: number, columnCount: number): React.CSSProperties[] => {
  const out = `-${TICK_LENGTH + TICK_GAP}px`;
  const ticks: React.CSSProperties[] = [];
  for (let c = 0; c <= columnCount; c++) {
    const left = tickOffset(c / columnCount);
    ticks.push({ left, top: out, width: '1px', height: `${TICK_LENGTH}px` });
    ticks.push({ left, bottom: out, width: '1px', height: `${TICK_LENGTH}px` });
  }
  for (let r = 0; r <= rowCount; r++) {
    const top = tickOffset(r / rowCount);
    ticks.push({ top, left: out, height: '1px', width: `${TICK_LENGTH}px` });
    ticks.push({ top, right: out, height: '1px', width: `${TICK_LENGTH}px` });
  }
  return ticks;
};

/** Whether `edge` is one of the three vertical lines (left, inside-vertical, right). */
const isVerticalEdge = (edge: IBorders.Edge): boolean => {
  return edge === IBorders.Edge.Left
    || edge === IBorders.Edge.Vertical
    || edge === IBorders.Edge.Right;
};

/**
 * Where an edge's LINE runs, as a fraction across the diagram: 0 the near side, 1 the far side.
 *
 * @remarks
 * The inner rules sit at the middle because the diagram is 2x2 — one boundary between the rows and
 * one between the columns, which is the whole reason it is not a single cell.
 */
const edgeOffset = (edge: IBorders.Edge): number => {
  switch (edge) {
    case IBorders.Edge.Top:
    case IBorders.Edge.Left: return 0;
    case IBorders.Edge.Horizontal:
    case IBorders.Edge.Vertical: return 0.5;
    default: return 1;
  }
};

/**
 * The edges a pointer is aimed at: one line, both inner rules at their crossing, a diagonal at a
 * corner, or none.
 *
 * @param x Pointer position relative to the diagram's top-left corner, in CSS px.
 * @param y Pointer position relative to the diagram's top-left corner, in CSS px.
 * @param width The diagram's width in CSS px.
 * @param height The diagram's height in CSS px.
 * @param isAvailable Whether an edge can be drawn at all — the inner rules cannot, on a selection
 * with no inside, and an edge that cannot be drawn must not swallow a click aimed past it.
 *
 * @remarks
 * Nearest line wins, which is the only rule that stays honest where an inner rule meets the
 * outline. Fixed rectangles cannot be: their zones overlap, and whichever paints later takes the
 * whole square.
 *
 * The middle is the exception. Where the two inner rules cross, the pointer is within reach of
 * both and a pixel either way would flip between them, so that square is neither: it aims at the
 * pair, which is the 'Inside' border. Only when both can be drawn — with one inner rule there is
 * no crossing, and the middle is just that rule.
 *
 * The outer corners are the diagonals. A square on each corner, the size of the crossing's and
 * centered on the corner's crop marks, aims at the diagonal that starts there: top-left and
 * bottom-right are `diagonalDown`, top-right and bottom-left `diagonalUp`. The outline is two
 * lines meeting there, so like the crossing the corner is neither of them.
 *
 * Exported because this is the part worth testing directly — jsdom lays nothing out, so a mounted
 * diagram cannot be asked where its lines are.
 */
export function edgesAt(
  x: number,
  y: number,
  width: number,
  height: number,
  isAvailable: (edge: IBorders.Edge) => boolean
): readonly IBorders.Edge[] {
  if (width <= 0 || height <= 0) return NO_EDGES;
  // Two bands would exactly touch at a fifth of the span, so stay under that on a small diagram.
  const limit = Math.min(HIT_DISTANCE, width / 5, height / 5);

  if (
    INSIDE_EDGES.every(isAvailable)
    && Math.abs(x - width / 2) <= limit
    && Math.abs(y - height / 2) <= limit
  ) {
    return INSIDE_EDGES;
  }

  const nearLeft = Math.abs(x) <= limit;
  const nearRight = Math.abs(x - width) <= limit;
  const nearTop = Math.abs(y) <= limit;
  const nearBottom = Math.abs(y - height) <= limit;
  if ((nearLeft || nearRight) && (nearTop || nearBottom)) {
    const diagonal = nearLeft === nearTop ? IBorders.Edge.DiagonalDown : IBorders.Edge.DiagonalUp;
    if (isAvailable(diagonal)) return SINGLE_EDGE.get(diagonal)!;
  }

  let best: IBorders.Edge | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const edge of PREVIEW_EDGES) {
    if (!isAvailable(edge)) continue;
    const vertical = isVerticalEdge(edge);
    // Distance to the SEGMENT, not to the infinite line it lies on. A line is only as long as it
    // is drawn: level with the top edge but well off to the left of the diagram is on no edge, and
    // an inner rule stops at the block's outline rather than reaching out past it.
    const span = vertical ? height : width;
    const along = vertical ? y : x;
    const beyond = Math.max(0, -along, along - span);
    const across = (vertical ? x : y) - edgeOffset(edge) * (vertical ? width : height);
    const distance = Math.hypot(beyond, across);
    // Strictly nearer, so a pointer exactly on a crossing falls back to PREVIEW_EDGES' order.
    if (distance < bestDistance) {
      bestDistance = distance;
      best = edge;
    }
  }
  return best && bestDistance <= limit ? SINGLE_EDGE.get(best)! : NO_EDGES;
}

export interface BorderPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * What is drawn on each edge of the selected block right now.
   *
   * @remarks
   * Resolved DATA, not accessors: each edge of a block is read from a different cell (see
   * `FormatSelection.getEdgeStroke`), and the panel is the one that knows which. Values also keep
   * this component honestly re-rendering — a bag of stable callbacks looks unchanged to React even
   * when the cells underneath have changed completely.
   */
  edges: BorderEdges;
  /** Mints the per-cell border the renderer draws. */
  createBorder: (properties: Partial<IBorders.Properties>) => IBorders | null;
  /**
   * Toggle edges with the panel's active pen, as one edit.
   *
   * @remarks
   * One edge for a line; both inner rules for the middle of the diagram, where they cross.
   */
  onToggleEdges: (edges: readonly IBorders.Edge[]) => void;
  /**
   * Edges this selection cannot draw — the inner rules, on a selection with no inside.
   *
   * @remarks
   * They are left OUT, not greyed out, and the diagram reshapes around them: a selection with no
   * inside draws one cell rather than four with two dead lines through them. A target that cannot
   * do anything is not information, and offering it is what made the inner rules feel broken.
   */
  omittedEdges?: readonly IBorders.Edge[];

  disabled?: boolean;
  height?: number;
}

/**
 * Excel's Format Cells → Border diagram: a block of cells whose edges you click to draw or clear.
 *
 * @remarks
 * Two cells by two, not one — the inner rules have nowhere to show on a single cell, and they are
 * half of what a border edit is about. The lines are a real {@link StaticBorderRenderer} fed the
 * selection's own strokes, so what you click is what the grid will draw.
 *
 * Aiming is by DISTANCE rather than by zone (see {@link edgesAt}), and the feedback is the edge
 * itself: hovering lights the line a click would toggle, along its whole length — both inner
 * rules, over their crossing. Shading a quadrant says "somewhere around here"; a lit line says
 * which line.
 */
export const BorderPreview = (props: BorderPreviewProps): React.ReactElement => {
  const {
    edges,
    createBorder,
    onToggleEdges,
    omittedEdges,
    disabled = false,
    height = 104,
    className: propClassName,
    ...rest
  } = props;

  const t = useTranslator();
  const refSurface = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<readonly IBorders.Edge[]>(NO_EDGES);

  /** Whether the diagram shows `edge` at all. Independent of `disabled`, which greys the lot. */
  const isShown = useCallback((edge: IBorders.Edge): boolean => {
    return !(omittedEdges?.includes(edge) ?? false);
  }, [omittedEdges]);

  const isAvailable = useCallback((edge: IBorders.Edge): boolean => {
    return !disabled && isShown(edge);
  }, [disabled, isShown]);

  // The diagram is only as big as the selection has parts: two rows when there is a boundary
  // between rows to draw on, two columns when there is one between columns.
  const rowCount = isShown(IBorders.Edge.Horizontal) ? 2 : 1;
  const columnCount = isShown(IBorders.Edge.Vertical) ? 2 : 1;

  // Decompose the block's edges onto each of the four cells: the outer edges belong to the cells on
  // that side, and each inner rule is the shared edge of the two cells it runs between.
  const getBorderAt = useCallback((coords: ICell.Coords): IBorders | null => {
    // First and last are the same cell when there is only one of it, which is what collapses the
    // diagram cleanly: the single cell then carries the block's outline and nothing else.
    return createBorder({
      top: coords.rowIndex === 0 ? edges.top : edges.horizontal,
      bottom: coords.rowIndex === rowCount - 1 ? edges.bottom : edges.horizontal,
      left: coords.colIndex === 0 ? edges.left : edges.vertical,
      right: coords.colIndex === columnCount - 1 ? edges.right : edges.vertical,
      // A diagonal is a property of every cell it is written to, so each cell draws its own.
      diagonalUp: edges.diagonalUp,
      diagonalDown: edges.diagonalDown
    });
  }, [edges, createBorder, rowCount, columnCount]);

  /** The edges under a pointer event, in the diagram's own coordinates. */
  const edgesFromEvent = useCallback((
    event: React.PointerEvent | React.MouseEvent
  ): readonly IBorders.Edge[] => {
    const surface = refSurface.current;
    if (!surface) return NO_EDGES;
    const rect = surface.getBoundingClientRect();
    return edgesAt(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
      isAvailable
    );
  }, [isAvailable]);

  return (
    <Box
      className={clsx('sxl-border-preview', propClassName)}
      // Before the handlers, not after: a caller's stray `onClick` would otherwise replace the one
      // the diagram needs to work at all.
      {...rest}
      // Aiming is tracked on the OUTER box so the padding ring counts too: the outer edges are
      // drawn on the boundary of the diagram, and half of the natural place to click one of them
      // is just outside it.
      onPointerMove={(event: React.PointerEvent) => setHovered(edgesFromEvent(event))}
      onPointerLeave={() => setHovered(NO_EDGES)}
      onClick={(event: React.MouseEvent) => {
        const targets = edgesFromEvent(event);
        if (targets.length > 0) onToggleEdges(targets);
      }}
      sx={{
        position: 'relative',
        boxSizing: 'border-box',
        height: `${height}px`,
        width: '100%',
        padding: '10px',
        cursor: hovered.length > 0 ? 'pointer' : 'default',
        borderRadius: (theme: Theme) => `${theme.shape.borderRadius}px`,
        border: (theme: Theme) => `1px solid ${theme.palette.divider}`,
        opacity: disabled ? 0.6 : 1
      }}
    >
      <Box ref={refSurface} sx={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Four faint blocks behind the lines, so the diagram reads as CELLS rather than as an
            empty rectangle with an outline — the cue the preset icons give. Not interactive. */}
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
            gridTemplateRows: `repeat(${rowCount}, 1fr)`,
            gap: '2px',
            pointerEvents: 'none',
            '& > div': {
              backgroundColor: (theme: Theme) => alpha(theme.palette.text.primary, 0.05)
            }
          }}
        >
          {Array.from({ length: rowCount * columnCount }, (_unused, index) => <div key={index}/>)}
        </Box>

        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            '& > div': {
              position: 'absolute',
              backgroundColor: (theme: Theme) => theme.palette.text.secondary
            }
          }}
        >
          {boundaryTicks(rowCount, columnCount).map((tick, index) => <div key={index} style={tick}/>)}
        </Box>

        {/* Under the strokes, so a line that is already drawn stays legible on top of its own
            highlight rather than being covered by it. The tint is the wrapper's opacity over
            solid bands, so two bands that cross do not darken where they overlap. */}
        {hovered.length > 0 ? (
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              opacity: 0.22,
              '& > div': {
                position: 'absolute',
                borderRadius: `${HIGHLIGHT_HALF}px`,
                backgroundColor: (theme: Theme) => theme.palette.text.primary
              },
              '& line': {
                stroke: (theme: Theme) => theme.palette.text.primary
              }
            }}
          >
            {hovered.filter((edge) => !isDiagonalEdge(edge)).map((edge) => <div key={edge} style={edgeBand(edge)}/>)}
            {hovered.some(isDiagonalEdge) ? (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
              >
                {hovered.filter(isDiagonalEdge).flatMap((edge) => diagonalBands(edge, rowCount, columnCount))}
              </svg>
            ) : null}
          </Box>
        ) : null}

        <StaticBorderRenderer
          getBorderAt={getBorderAt as never}
          rowCount={rowCount}
          columnCount={columnCount}
          style={{ position: 'absolute', inset: 0, height: '100%', width: '100%' }}
        />

        {/* One real button per edge, laid along its line — the keyboard and screen-reader view of
            the same six targets, and where the focus ring goes. They take no pointer: aiming with
            a mouse is the container's job, and a box that swallows clicks is what `edgesAt`
            replaces. A keyboard Enter/Space still fires `onClick`. */}
        {PREVIEW_EDGES.filter(isShown).map((edge) => (
          <Box
            key={edge}
            component="button"
            type="button"
            aria-label={edgeLabel(t, edge)}
            aria-pressed={!!edges[edge]}
            title={edgeLabel(t, edge)}
            disabled={!isAvailable(edge)}
            // Keyboard only — a mouse never reaches these. A keyboard click carries no useful
            // coordinates, so it must not also reach the container, which would read (0,0) and
            // toggle whichever edge is nearest the top-left corner on top of this one.
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation();
              onToggleEdges(SINGLE_EDGE.get(edge)!);
            }}
            sx={{
              position: 'absolute',
              appearance: 'none',
              background: 'transparent',
              border: 'none',
              padding: 0,
              pointerEvents: 'none',
              borderRadius: `${HIGHLIGHT_HALF}px`,
              '&:focus-visible': {
                outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`
              },
              ...edgeBand(edge)
            }}
          />
        ))}
      </Box>
    </Box>
  );
};

BorderPreview.displayName = 'BorderPreview';

/** The strip an edge occupies in the diagram, as absolute-position CSS. */
function edgeBand(edge: IBorders.Edge): React.CSSProperties {
  const offset = `calc(${edgeOffset(edge) * 100}% - ${HIGHLIGHT_HALF}px)`;
  return isVerticalEdge(edge)
    ? { top: 0, bottom: 0, left: offset, width: `${HIGHLIGHT_HALF * 2}px` }
    : { left: 0, right: 0, top: offset, height: `${HIGHLIGHT_HALF * 2}px` };
}

/**
 * The bands a diagonal occupies, one per cell, in the 0..100 space of the highlight's SVG. Drawn
 * per cell because that is where the grid draws it.
 */
function diagonalBands(edge: IBorders.Edge, rowCount: number, columnCount: number): React.ReactElement[] {
  const bands: React.ReactElement[] = [];
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < columnCount; c++) {
      const x1 = (c / columnCount) * 100;
      const x2 = ((c + 1) / columnCount) * 100;
      const y1 = (r / rowCount) * 100;
      const y2 = ((r + 1) / rowCount) * 100;
      const isDown = edge === IBorders.Edge.DiagonalDown;
      bands.push(
        <line
          key={`${edge}:${r}:${c}`}
          x1={x1}
          y1={isDown ? y1 : y2}
          x2={x2}
          y2={isDown ? y2 : y1}
          strokeWidth={HIGHLIGHT_HALF * 2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      );
    }
  }
  return bands;
}
