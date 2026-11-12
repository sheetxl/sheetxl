
import { type Size } from '@sheetxl/utils';

import { type RenderSlotFn } from '../components';

import { type IViewport } from './Viewport';
import { type ScrollbarProps } from './IScrollbar';

/**
 * Props for the scroll corner.
 *
 * @remarks
 * This is the square area between the horizontal and vertical scrollbars.
 * It will only be rendered if both scrollbars are visible.
 */
export interface ScrollCornerProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * The size of the scroll corner.
   *
   * @remarks
   * Optional — the corner is a grid cell sized by the scrollbar gutters, so a renderer can simply fill
   * its cell (`width/height: 100%`) rather than reading this.
   */
  size?: Size;
}
export interface IScrollPaneAttributes {
  isScrollPane: () => true;
}

export interface IScrollPaneElement extends HTMLDivElement, IScrollPaneAttributes {};

/**
 * Properties for the ScrollPane
 */
export interface ScrollPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The scroll viewport — an {@link IViewport} (a `Viewport`, or an `AxisViewport` for
   * per-axis sharing). The ScrollPane **subscribes** to it for position + sizes and drives scroll into
   * it (scrollbar/wheel/touch → `setTarget`).
   */
  viewport?: IViewport;
  /**
   * Disable mouse-wheel scrolling. Wheel (which drives the {@link ScrollPaneProps.viewport}) is on by
   * default; set this to turn it off.
   *
   * @defaultValue false
   */
  disableMouseWheel?: boolean;
  /**
   * Wheel intercept. Return `false` to consume the event (skip scrolling).
   */
  onWheelScroll?: (event: globalThis.WheelEvent) => boolean | void;
  /**
   * Enable the zoom gesture (ctrl/⌘+wheel; pinch). The ScrollPane's scroller owns the gesture — the
   * proportional factor, the clamp, the continuous level — and requests each step on the
   * {@link ScrollPaneProps.viewport} (`requestZoom`), exactly as it drives scroll into it; whoever owns
   * the zoom's model listens there (`subscribeZoom`) and commits.
   *
   * @defaultValue false
   */
  zoomable?: boolean;

  // customizations
  showHorizontalScrollbar?: boolean;
  showVerticalScrollbar?: boolean;

  /** The corner where the two scrollbars meet. `null` leaves it empty. */
  renderScrollCorner?: RenderSlotFn<ScrollCornerProps> | null;

  /** `null` for no horizontal scrollbar, the gutter kept. */
  renderScrollbarHorizontal?: RenderSlotFn<ScrollbarProps> | null;
  /** `null` for no vertical scrollbar, the gutter kept. */
  renderScrollbarVertical?: RenderSlotFn<ScrollbarProps> | null;
  /**
   * If touch is disabled.
   *
   * @defaultValue false unless no touch events are detected.
   */
  disableTouch?: boolean;
  /**
   * Reference to the scroll pane element
   */
  ref?: React.Ref<IScrollPaneElement>
}
