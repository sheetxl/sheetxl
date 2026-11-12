import type React from 'react';
import { createContext, useContext } from 'react';

/**
 * Geometry the {@link TouchThumbHandle} grips are drawn into. Published by the {@link ScrollPane}
 * (the only component that knows the full viewport + both gutters) and consumed by the grips deep
 * inside the scrollbar render chain.
 *
 * @remarks
 * The grip's *position along its axis* still comes from its scrollbar's thumb (a virtual scrollbar
 * maps scroll → thumb non-linearly, so only the scrollbar knows where the thumb sits). This frame
 * supplies only the coordinate box: which element to draw into, the viewport size, the reserved
 * corner, and the inset from the edge.
 */
export interface TouchThumbFrame {
  /**
   * Positioned element the grips portal into — the grid viewport box (excludes the scrollbar
   * gutters). Must be `position: relative` so the grips position in its content-relative coords.
   */
  portalTarget: HTMLElement | null;
  /**
   * Content-box width in px (the portal target's size). The vertical grip's cross edge sits at this
   * minus {@link crossInset}, and it is the origin for {@link viewportWidth}.
   */
  width: number;
  /**
   * Content-box height in px (the portal target's size). The horizontal grip's cross edge sits at this
   * minus {@link crossInset}, and it is the origin for {@link viewportHeight}.
   */
  height: number;
  /**
   * The scrollable viewport (cell-area) width in px — `<= ` {@link width}. The horizontal grip travels
   * across this, offset from the left by `width - viewportWidth` (the row-header gutter), so it rides
   * inside the visible cell area rather than the full grid box.
   */
  viewportWidth: number;
  /**
   * The scrollable viewport (cell-area) height in px — `<= ` {@link height}. The vertical grip travels
   * across this, offset from the top by `height - viewportHeight` (the column-header gutter).
   */
  viewportHeight: number;
  /**
   * Reserve at the bottom for the vertical grip (px) so its lowest position clears the horizontal
   * grip's virtual corner. `0` when there is no horizontal grip to avoid.
   */
  reserveVertical: number;
  /**
   * Reserve at the right for the horizontal grip (px) so its right-most position clears the vertical
   * grip's virtual corner. `0` when there is no vertical grip to avoid.
   */
  reserveHorizontal: number;
  /**
   * Distance from the cross edge (right for vertical, bottom for horizontal) to the grip center (px).
   */
  crossInset: number;
}

/**
 * Default grip size (thickness) in px. The long dimension is {@link TOUCH_THUMB_ASPECT} × this.
 */
export const TOUCH_THUMB_SIZE = 22;
/** Long-axis multiplier for the grip (a slightly elongated pill). */
export const TOUCH_THUMB_ASPECT = 1.8;
/** Gap between a grip and the perpendicular grip's corner (used to size the corner reserve). */
export const TOUCH_THUMB_MARGIN = 8;
/** Gap between the grip's leading edge and the viewport start (top for vertical, left for horizontal). */
export const TOUCH_THUMB_MARGIN_START = 4;
/** Gap between the grip's outer edge and the viewport cross edge (right for vertical, bottom for horizontal). */
export const TOUCH_THUMB_MARGIN_CROSS = 8;
/**
 * Gap between the grip's trailing edge and the corner reserve. Negative on purpose: the grip is a
 * rounded pill, so letting it tuck slightly past the reserve brings the rounded corners visually
 * closer to the corner without overlapping the perpendicular grip.
 */
export const TOUCH_THUMB_MARGIN_END = -2;

/**
 * Distance from the cross edge to the grip center. Half the grip thickness plus the cross margin keeps
 * the grip's outer edge that margin inside the viewport edge.
 */
export const touchThumbCrossInset = (size: number = TOUCH_THUMB_SIZE): number =>
  size / 2 + TOUCH_THUMB_MARGIN_CROSS;

/**
 * The corner reserve — how far short of the far edge a grip must stop so it clears the perpendicular
 * grip. Sized so the grip's far extent leaves the other grip's near extent plus a margin.
 */
export const touchThumbCornerReserve = (size: number = TOUCH_THUMB_SIZE): number =>
  size + 2 * TOUCH_THUMB_MARGIN;

const TouchThumbFrameContext = createContext<TouchThumbFrame | null>(null);

export interface TouchThumbFrameProviderProps {
  value: TouchThumbFrame | null;
  children?: React.ReactNode;
}

export const TouchThumbFrameProvider = (props: TouchThumbFrameProviderProps): React.ReactElement => {
  const { value, children } = props;
  return (
    <TouchThumbFrameContext.Provider value={value}>
      {children}
    </TouchThumbFrameContext.Provider>
  );
};

/**
 * Read the {@link TouchThumbFrame} published by the enclosing {@link ScrollPane}. Returns `null`
 * when the grip is rendered outside a ScrollPane (no frame to draw into).
 */
export const useTouchThumbFrame = (): TouchThumbFrame | null => {
  return useContext(TouchThumbFrameContext);
};
