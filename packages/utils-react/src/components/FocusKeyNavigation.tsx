import React, { useCallback, useRef, memo, forwardRef } from 'react';

import { mergeRefs } from 'react-merge-refs';

import { Direction } from '@sheetxl/utils';

export interface FocusKeyNavigationProps extends React.HTMLAttributes<HTMLDivElement> {
  refFocusStart?: React.RefObject<HTMLElement>;

  /**
   * If tab and all tabIndices are the same which direction should the tab scan. Note - shift tab will go the opposite direction
   */
  tabForward?: Direction;

  // wrap? if we tab to the end
}

/**
 * Wrap around a div to allow. This will navigate through enabled divs with tabindex (but only one level deep)
 * It uses the current layout to determine navigation
 * TODO - we need to find an
 * tab/shift-tab navigation
 * arrow key navigation
 *
 * another option is to use rowindex/columnIndex attributes?
 *
 * default direction (for tab)
 */
export const FocusKeyNavigation: React.FC<FocusKeyNavigationProps> = memo(
  forwardRef<any, FocusKeyNavigationProps>((props, refForwarded) => {
  const {
    refFocusStart,
    ...rest
  } = props;

  const refLocal = useRef<HTMLDivElement>(null);

  const handleFocus  = useCallback(() => {
    if (refFocusStart) {
      refFocusStart?.current?.focus();
      return;
    }
    const children = refLocal.current.parentElement.children;
    let found = [];
    // TODO - add all children then sort. For now we just grab the first one.
    const childrenLength = children.length;
    for (let i=0; i<childrenLength && children[i] !== refLocal.current; i++) {
      const child: any = children[i];
      const tabindex = child.getAttribute('tabindex');
      if (tabindex === undefined || tabindex === null || tabindex === '-1')
        continue;
      const disabled = child.getAttribute('disabled');
      if (disabled === 'true')
        continue;
      if (!child.focus)
        continue
      found.push({
        tabindex: parseInt(tabindex),
        child: child
      });
    }
    if (found.length === 0)
      return;
    found.sort(function (a, b) {
      return a.tabindex - b.tabindex;
    });
    found[0].child.focus();
  }, [refFocusStart]);

  return (
    <div
      tabIndex={0}
      ref={mergeRefs([refLocal, refForwarded])}
      onFocus={handleFocus}
      {...rest}
    >
    </div>
  );
}));