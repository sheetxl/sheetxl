import React from 'react';

export const ToolTipPlacement = { // copied from material as a reusable enum
  BottomEnd: 'bottom-end',
  BottomStart: 'bottom-start',
  Bottom: 'bottom',
  LeftEnd: 'left-end',
  LeftStart: 'left-start',
  Left: 'left',
  RightEnd: 'right-end',
  RightStart: 'right-start',
  Right: 'right',
  TopEnd: 'top-end',
  TopStart: 'top-start',
  Top: 'top'
} as const;
export type ToolTipPlacement = typeof ToolTipPlacement[keyof typeof ToolTipPlacement];

export interface IShowToolTipProperties {
  /**
   * The anchor for the tooltip. x,y are required
   * but width and height can also be provided.
   */
  anchor: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  };

  /**
   * The value to display. This is either a string or a react element
   */
  display?: string | React.ReactElement;

  /**
   * Purely suggestion only
   * If not specified then the consumer will determine
   */
  placement?: ToolTipPlacement;
}