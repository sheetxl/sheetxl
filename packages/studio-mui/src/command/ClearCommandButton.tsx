import React, { memo, forwardRef } from 'react';

import {
  SimpleCommandPopupButton, CommandPopupButtonProps
} from '@sheetxl/utils-mui';

export interface ClearCommandButtonProps extends CommandPopupButtonProps {}

export const ClearCommandButton = memo(
  forwardRef<HTMLElement, ClearCommandButtonProps>((props, refForwarded) => {

  return (
    <SimpleCommandPopupButton
      ref={refForwarded}
      {...props}
      popupCommandKeys={[
        'clearAll',
        'clearFormats',
        'clearContents',
        'clearComments',
        'clearHyperlinks'
      ]}
      scope={'clear'}
      // quickCommand={'clearAll'}
      label="Clear"
      tooltip="Clear everything in the cell, or remove just the formatting or contents." // "Delete everything in the cell, or remove just the formatting, contents, comments or hyperlinks."
      icon={'ClearAll'}
    />
  );
}));
