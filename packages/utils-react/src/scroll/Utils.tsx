import { ScrollbarProps } from './IScrollbar';

import { Scrollbar } from './Scrollbar';
import { NativeScrollbar } from './NativeScrollbar';

/**
  * scan all elements until we find one in the given direction
  * Note - only horizontal at the moment
 */
export const getScrollTo = (currentLocation: number, boundary: number, children: any, isLeft: boolean, defaultValue: number=0): number => {
  for (let i=0; i<children.length; i++) {
    const childBounds = children[i].getBoundingClientRect();
    let relativeLeft = childBounds.left - boundary;
    let relativeRight = relativeLeft + childBounds.width;
    if (isLeft) {
      if (relativeLeft < currentLocation && relativeRight >= currentLocation) {
        return relativeLeft;
      }
    } else {
      if (Math.ceil(relativeRight) > Math.ceil(currentLocation) + 2) {
        return relativeRight;
      }
    }
  }
  return defaultValue;
}

export const defaultRenderScrollbar = (props: ScrollbarProps) => {
  return <Scrollbar {...props} />;
}