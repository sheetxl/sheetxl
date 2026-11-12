import type React from 'react';

import { type RenderSlotFn } from '../components';

import { type TouchThumbHandleProps } from './TouchThumbHandle';
import { type ScrollButtonProps } from './ScrollButton';
import { type TrackEdgeTick } from './TrackDrag';

/*
 * Acts as a sliderBar/scrollbar. It is detached from the component to support both
 * virtual grid and detaching from the component (to create split views etc)
*/
export const ScrollbarOrientation = {
  Horizontal: 'horizontal',
  Vertical: 'vertical'
} as const;
export type ScrollbarOrientation = typeof ScrollbarOrientation[keyof typeof ScrollbarOrientation];

/**
 * The thumb-drag lifecycle event — fired by the desktop thumb and the touch grip alike.
 *
 * @remarks
 * Carries the ELEMENT being dragged so drag UI needs no coordinate math or DOM spelunking: hand it to
 * the float system as the anchor (a virtual reference + placement) and the tooltip infra does the
 * rest — correct for the thumb and the grip, which live in different places.
 */
export interface ThumbDragEvent {
  /** `true` on grab, `false` on release. */
  dragging: boolean;
  /** The element being dragged — the scrollbar's thumb or the large touch grip. */
  element: HTMLElement | null;
  /** Which control is dragging. */
  source: 'thumb' | 'touch';
}

export interface ScrollbarProps extends React.HTMLAttributes<HTMLElement> {
  offset: number;
  viewportSize: number;
  totalSize: number;
  orientation: ScrollbarOrientation;
  onScrollOffset: (offset: number, viewportSize: number, totalSize: number) => void;

  /**
   * Add custom scrollButtons.
   * This should only be set to true if you have used css styling to hide the default scrollButtons
   * using:
    ::-webkit-scrollbar-button: {
      display: 'none'
    }
   *
   * @defaultValue false
   */
  showCustomScrollButtons?: boolean;

  /**
   * The minimum size of the thumb in pixels.
   *
   * @defaultValue 24
   */
  minThumbSize?: number;

  /**
   * The maximum size of the thumb in pixels.
   *
   * @defaultValue undefined (no maximum size)
   */
  maxThumbSize?: number;
  /**
   * The amount to increment the scroll position when the scroll button is clicked.
   * This can be a fixed number or a function that takes the current offset, viewport size,
   * and total size and returns the increment amount.
   */
  scrollButtonIncrement?: number | ((offset: number, viewport: number, totalSize: number) => number);
  scrollButtonInitialRepeatDelay?: number;
  scrollButtonAdditionalRepeatDelay?: number;

  /** The button at the track's start. `null` for none. */
  renderScrollButtonStart?: RenderSlotFn<ScrollButtonProps> | null;
  /** The button at the track's end. `null` for none. */
  renderScrollButtonEnd?: RenderSlotFn<ScrollButtonProps> | null;

  propsTouchThumb?: Partial<TouchThumbHandleProps>;

  /**
   * Called on a repeating tick while the thumb is dragged past a track end and held there. Advance the
   * scroll one step and return whether more scroll remains (`false` stops the ticking).
   *
   * @remarks
   * This is how an elastic/virtual wrapper (e.g. `VirtualScrollbar`) extends its region under a held
   * thumb — the scrollbar itself has no elastic knowledge. Leave unset for a linear scrollbar: its
   * thumb at the track end IS the real end, so there is nothing to extend.
   */
  onThumbEdgeHold?: (edge: -1 | 1, tick: TrackEdgeTick) => boolean;

  /**
   * Thumb-drag lifecycle — fired for both the desktop thumb and the touch grip (raw DOM events can't
   * represent this faithfully: pointer capture retargets the release, and the engine filters
   * non-primary/disabled presses). A virtual/elastic wrapper pins its region while a drag is in
   * flight; a client anchors drag UI (tooltips) to {@link ThumbDragEvent.element}.
   */
  onThumbDrag?: (event: ThumbDragEvent) => void;

  propsThumb?: React.HTMLAttributes<HTMLElement>;
  /**
   * Reference to the underling element
   */
  ref?: React.Ref<IScrollbarElement>;
}

export interface IScrollbarAttributes extends HTMLDivElement {
  isScrollbar: () => true;
  //scrollTo: (args: any) =>;
}

export interface IScrollbarElement extends IScrollbarAttributes, HTMLDivElement {};
