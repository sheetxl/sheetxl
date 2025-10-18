
import type { Size, TopLeft } from '@sheetxl/utils';

import type { ScrollableViewport } from '../types';
import type { ScrollbarProps } from './IScrollbar';

export interface IScrollPaneAttributes {
  isScrollPane: () => true;
}

export interface IScrollPaneElement extends HTMLDivElement, IScrollPaneAttributes {};

/**
 * Properties for the ScrollPane
 */
export interface ScrollPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  viewport: ScrollableViewport;

  onScrollViewport?: (scrollPoint: Partial<TopLeft>) => void;

  // customizations
  showHorizontalScrollbar?: boolean;
  showVerticalScrollbar?: boolean;

  createScrollCorner?: (size: Size) => React.ReactNode;

  renderScrollbarHorizontal?: (props: ScrollbarProps) => React.ReactNode;
  renderScrollbarVertical?: (props: ScrollbarProps) => React.ReactNode;
  /**
   * By default the ScrollPane will listen for events on all of the children of the ScrollPane but this
   * allows for a custom element to be specified. Useful when the ScrollPane has some elements
   * that should not be touch enabled (for example headers)
   */
  touchElement?: HTMLElement;
  /**
   * If touch is disabled.
   * @defaultValue false unless no touch events are detected
   */
  disableTouch?: boolean;
  /**
   * Reference to the scroll pane element
   */
  ref?: React.Ref<IScrollPaneElement>
}
