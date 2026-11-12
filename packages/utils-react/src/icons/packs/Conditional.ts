import { type IconPath, type IconGlyphInput, type IconPackInput, type IconsInputRecord } from '../Types';

/**
 * The shapes conditional-format icon sets are drawn from.
 *
 * @remarks
 * Deliberately **one glyph per shape**, not one per set-position. Excel's seventeen built-in sets
 * span some sixty positions but only about two dozen shapes: `3Arrows` and `3ArrowsGray` are the
 * same paths, and so are the four- and five-arrow sets. Color is not baked in either — every path
 * paints `currentColor`, so the set table tints the wrapper and one shape serves every set that
 * uses it. That is also what makes OOXML's per-stop override (a band borrowing its icon from a
 * *different* set) a plain table lookup rather than a new sprite.
 *
 * Shapes are **solid with a derived rim** (`fill outlined`) rather than line art. Excel's icons
 * read as small colored signs at 18px in a 20px row; a 2px-stroke outline glyph at that size is
 * faint and thin, which is the wrong end of the legibility trade for a mark whose whole job is to
 * be scannable down a column. The rim comes from the tint itself (see `.outlined` in
 * DynamicIcon.module.css), so it costs nothing per shape and follows a retint automatically.
 */

const round = (n: number): number => Math.round(n * 100) / 100;

type Pt = readonly [number, number];

/** A closed polygon as an SVG path, at the shared 24x24 viewBox. */
const poly = (points: readonly Pt[]): string =>
  points.map(([x, y], i) => `${i ? 'L' : 'M'}${round(x)} ${round(y)}`).join(' ') + 'Z';

/**
 * Rotates a polygon about the icon's center, clockwise on screen.
 *
 * @remarks
 * Every arrow in every set is the SAME arrow at a different angle — which is exactly how Excel
 * draws them — so they are generated rather than hand-authored five times over.
 */
const rotate = (points: readonly Pt[], degrees: number): Pt[] => {
  const radians = degrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return points.map(([x, y]): Pt => {
    const dx = x - 12;
    const dy = y - 12;
    return [12 + dx * cos - dy * sin, 12 + dx * sin + dy * cos];
  });
};

/** The one arrow, pointing up: a triangular head over a shaft. */
const ARROW: readonly Pt[] = [
  [12, 2.5], [19.5, 12], [15.25, 12], [15.25, 21.5], [8.75, 21.5], [8.75, 12], [4.5, 12]
];

const arrow = (degrees: number): IconGlyphInput => ({
  svg: [{ d: poly(rotate(ARROW, degrees)), className: 'fill outlined' }]
});

/**
 * The one triangle of `3Triangles`, pointing up.
 *
 * @remarks
 * Sharp and flat, NOT the rounded `triangleUp` that `3Signs` uses — Excel draws the two families
 * differently, a road-sign triangle against a bare directional one, and at icon size the corner
 * radius is most of what tells them apart.
 */
const TRIANGLE: readonly Pt[] = [[12, 5.5], [21, 18.5], [3, 18.5]];

const triangle = (degrees: number): IconGlyphInput => ({
  svg: [{ d: poly(rotate(TRIANGLE, degrees)), className: 'fill outlined' }]
});

const solid = (...d: string[]): IconPath[] => d.map(one => ({ d: one, className: 'fill outlined' }));
/** A mark drawn ON a solid shape — white, so it reads as a hole rather than a second color. */
const knockout = (...d: string[]): IconPath[] => d.map(one => ({ d: one, className: 'line heavy knockout' }));
const heavy = (...d: string[]): IconPath[] => d.map(one => ({ d: one, className: 'line heavy' }));

/** Lucide's `circle`, as a path (the source is a `<circle>` element, which `IconPath` cannot hold). */
const CIRCLE = 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0';

/**
 * The four bars every rating set is drawn from, tallest last.
 *
 * @remarks
 * `4Rating` and `5Rating` are the SAME four bars — they differ only in how many levels the bands
 * map onto (one-to-four against zero-to-four), so five glyphs cover both sets rather than nine.
 * No rim on these: at 3.5 units wide an outline would close the gaps between them.
 */
const RATING_BARS = [5, 9, 13, 17].map((height, i) => ({
  d: `M${3 + i * 5} ${21 - height}h3.5v${height}h-3.5z`
}));

const rating = (filled: number): IconGlyphInput => ({
  svg: RATING_BARS.map((bar, i) => ({
    ...bar,
    // An unlit bar still draws — the set reads as a level out of four, not as a shrinking mark.
    className: i < filled ? 'fill' : 'fill tertiary'
  }))
});

/** The four quadrants of `5Quarters`, filled clockwise from twelve o'clock. */
const QUARTER_WEDGES = [
  'M12 2a10 10 0 0 1 10 10h-10z',
  'M22 12a10 10 0 0 1-10 10v-10z',
  'M12 22a10 10 0 0 1-10-10h10z',
  'M2 12a10 10 0 0 1 10-10v10z'
];

/** The five-pointed star of `3Stars`, first point at twelve o'clock. */
const STAR: readonly Pt[] = Array.from({ length: 10 }, (_, i): Pt => {
  const radius = i % 2 === 0 ? 10.5 : 4.4;
  const radians = (-90 + i * 36) * Math.PI / 180;
  return [12 + radius * Math.cos(radians), 12 + radius * Math.sin(radians)];
});

/**
 * The part of a polygon left of a vertical line, as a polygon.
 *
 * @remarks
 * Sutherland-Hodgman against the one edge — which is all the half star needs, and less than an SVG
 * `clipPath` would cost (a glyph is a list of paths; it has nowhere to put a clip).
 */
const clipLeftOf = (points: readonly Pt[], x: number): Pt[] => {
  const clipped: Pt[] = [];
  // A vertex sitting exactly ON the line is also its own crossing, so the two would be emitted back
  // to back as a zero-length edge.
  const push = (point: Pt): void => {
    const last = clipped[clipped.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) return;
    clipped.push(point);
  };
  const count = points.length;
  for (let i = 0; i < count; i++) {
    const current = points[i];
    const previous = points[(i + count - 1) % count];
    const isIn = current[0] <= x;
    const wasIn = previous[0] <= x;
    if (isIn !== wasIn) {
      const t = (x - previous[0]) / (current[0] - previous[0]);
      push([x, previous[1] + t * (current[1] - previous[1])]);
    }
    if (isIn) push(current);
  }
  return clipped;
};

/**
 * A star filled none / half / all the way.
 *
 * @remarks
 * The unfilled remainder is a faded star rather than an outline, the same choice the rating bars
 * make: at 16px an outlined star is a smudge, while a tint of the set's own gold still reads as a
 * star that is not lit.
 */
const star = (filled: 0 | 1 | 2): IconGlyphInput => ({
  svg: [
    { d: poly(STAR), className: filled === 2 ? 'fill' : 'fill tertiary' },
    ...(filled === 1 ? [{ d: poly(clipLeftOf(STAR, 12)), className: 'fill' }] : [])
  ]
});

/** The four boxes of `5Boxes`, filled left to right. */
const BOXES = [0, 1, 2, 3].map(i => `M${2.25 + i * 5} 9.75h4.5v4.5h-4.5z`);

const boxes = (filled: number): IconGlyphInput => ({
  svg: BOXES.map((d, i) => ({ d, className: i < filled ? 'fill' : 'fill tertiary' }))
});

const quarters = (filled: number): IconGlyphInput => ({
  svg: [
    ...QUARTER_WEDGES.slice(0, filled).map(d => ({ d, className: 'fill' })),
    // The ring goes on TOP so a filled quadrant does not swallow the outline it sits against.
    { d: CIRCLE, className: 'line heavy' }
  ]
});

const icons: IconsInputRecord = {
  // --- directional (one arrow, five angles) ------------------------------
  'arrowUp': arrow(0),
  'arrowUpRight': arrow(45),
  'arrowRight': arrow(90),
  'arrowDownRight': arrow(135),
  'arrowDown': arrow(180),

  'triangleUpSharp': triangle(0),
  'triangleDownSharp': triangle(180),
  /** The middle band of `3Triangles` — no direction, so no triangle. */
  'dash': { svg: solid('M3 10.4h18v3.2H3z') },

  // --- shapes ------------------------------------------------------------
  'circle': { svg: solid(CIRCLE) },
  /**
   * The lamp of `3TrafficLights2` / `4TrafficLights`, which Excel seats in a dark housing. The
   * `rimmed` class swaps the tint-derived rim for a near-black one; the lamp keeps its own color.
   */
  'circleRimmed': { svg: [{ d: CIRCLE, className: 'fill outlined rimmed' }] },
  'triangleUp': { svg: solid('M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z') },
  'diamond': { svg: solid('M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0Z') },
  'flag': { svg: solid('M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2a8 8 0 0 1 4 1 8 8 0 0 0 4 1 6 6 0 0 0 2.8-.7 1 1 0 0 1 1.2.15 1 1 0 0 1 0 .85V13a1 1 0 0 1-.6.9A6 6 0 0 1 16 14a8 8 0 0 1-4-1 8 8 0 0 0-4-1 6 6 0 0 0-4 1.4') },

  // --- symbols -----------------------------------------------------------
  // Bare marks carry the tint on a heavy stroke; the circled set puts the tint in the disc and
  // knocks the mark out of it in white, which is how Excel draws both families.
  'check': { svg: heavy('M20 6.5 9.5 17 4 11.5') },
  'cross': { svg: heavy('M18.5 5.5 5.5 18.5', 'M5.5 5.5 18.5 18.5') },
  'exclamation': { svg: heavy('M12 4v10', 'M12 19.5h.01') },
  'circleCheck': { svg: [...solid(CIRCLE), ...knockout('m8 12.2 2.6 2.6L16 9.4')] },
  'circleCross': { svg: [...solid(CIRCLE), ...knockout('m15.5 8.5-7 7', 'm8.5 8.5 7 7')] },
  'circleExclamation': { svg: [...solid(CIRCLE), ...knockout('M12 6.5v6', 'M12 16.6h.01')] },

  // --- generated families ------------------------------------------------
  'rating0': rating(0),
  'rating1': rating(1),
  'rating2': rating(2),
  'rating3': rating(3),
  'rating4': rating(4),

  'star0': star(0),
  'star1': star(1),
  'star2': star(2),

  'boxes0': boxes(0),
  'boxes1': boxes(1),
  'boxes2': boxes(2),
  'boxes3': boxes(3),
  'boxes4': boxes(4),

  'quarters0': quarters(0),
  'quarters1': quarters(1),
  'quarters2': quarters(2),
  'quarters3': quarters(3),
  'quarters4': quarters(4)
};

const pack: IconPackInput = {
  meta: {
    label: 'Conditional Formatting',
    license: 'ISC (Lucide)',
    defaultViewBox: '0 0 24 24'
  },
  icons
};

export default pack;
