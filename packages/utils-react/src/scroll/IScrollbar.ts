import type React from 'react';

import type { TouchThumbHandleProps } from './TouchThumbHandle';
import type { ScrollButtonProps } from './ScrollButton';

/*
 * Acts as a sliderBar/scrollbar. It is detached from the component to support both
 * virtual grid and detaching from the component (to create split views etc)
*/
export const ScrollbarOrientation = {
  Horizontal: 'horizontal',
  Vertical: 'vertical'
} as const;
export type ScrollbarOrientation = typeof ScrollbarOrientation[keyof typeof ScrollbarOrientation];

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

  renderScrollButtonStart?: (props: ScrollButtonProps) => React.ReactElement;
  renderScrollButtonEnd?: (props: ScrollButtonProps) => React.ReactElement;

  propsTouchThumb?: Partial<TouchThumbHandleProps>;

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
