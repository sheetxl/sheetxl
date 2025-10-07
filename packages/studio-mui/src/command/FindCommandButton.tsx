import React, { memo, forwardRef } from 'react';

import {
  SimpleCommandPopupButton, CommandPopupButtonProps
} from '@sheetxl/utils-mui';

export interface FindCommandButtonProps extends CommandPopupButtonProps {
}

/**
 * Menu for Find options
 */
export const FindCommandButton = memo(
  forwardRef<HTMLElement, FindCommandButtonProps>((props, refForwarded) => {

  return (
    <SimpleCommandPopupButton
      ref={refForwarded}
      {...props}
      popupCommandKeys={[
        'find',
        'findReplace',
        'goto'
      ]}
      scope={'find'}
      label="Find & Select"
      tooltip="Find and replace cells or go to a specific location."
      quickCommand={'find'}
      icon={'Find'}
    />
  );
}));