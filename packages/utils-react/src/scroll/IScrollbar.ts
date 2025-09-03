import type React from 'react';

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
  totalSize: number;
  viewportSize : number;
  orientation : ScrollbarOrientation;
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

  // TODO - have scroll button increment be configurable
  scrollButtonIncrement?: number;// | (viewport) => number;
  scrollButtonInitialRepeatDelay?: number;
  scrollButtonAdditionalRepeatDelay?: number;

  createScrollStartButton?: (props: ScrollButtonProps) => React.ReactElement;
  createScrollEndButton?: (props: ScrollButtonProps) => React.ReactElement;
}