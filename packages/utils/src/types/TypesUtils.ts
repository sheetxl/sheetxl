import { TopLeft, Rectangle, Bounds } from './Types';

/**
 * Frozen TopLeft for easy comparisons.
 */
export const EmptyTopLeft: TopLeft = Object.freeze({
  left: 0,
  top: 0
});

/**
 * Frozen Rectangle for easy comparisons.
 */
export const EmptyRect: Rectangle = Object.freeze({
  left: 0,
  top: 0,
  bottom: 0,
  right: 0,
});

/**
 * Frozen Bounds for easy comparisons.
 */
export const EmptyBounds: Bounds = Object.freeze({
  x: 0,
  y: 0,
  width: 0,
  height: 0
});

// /**
//  * DimensionsFlags with both options set.
//  */
// export const DimensionsFlagBoth: DimensionsFlags = Object.freeze({
//   width: true,
//   height: true
// });
