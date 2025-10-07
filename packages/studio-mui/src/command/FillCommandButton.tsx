import React, { memo, forwardRef } from 'react';

import {
  SimpleCommandPopupButton, CommandPopupButtonProps
} from '@sheetxl/utils-mui';

export interface FillCommandButtonProps extends CommandPopupButtonProps {
}

export const FillCommandButton = memo(
  forwardRef<HTMLElement, FillCommandButtonProps>((props, refForwarded) => {

  return (
    <SimpleCommandPopupButton
      ref={refForwarded}
      {...props}
      popupCommandKeys={[
        'fillDown',
        'fillRight',
        'fillUp',
        'fillLeft'
      ]}
      // quickCommand={'fillDown'}
      scope={'fill'}
      label="Fill"
      tooltip="Fill the selected cells with the value from one of the corners."
      icon={'FillDown'}
    />
  );
}));