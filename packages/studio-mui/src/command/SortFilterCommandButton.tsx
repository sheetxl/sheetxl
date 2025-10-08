import React, { memo, forwardRef } from 'react';

import {
  SimpleCommandPopupButton, CommandPopupButtonProps
} from '@sheetxl/utils-mui';

export const SortFilterCommandButton = memo(
  forwardRef<HTMLElement, CommandPopupButtonProps>((props, refForwarded) => {

  return (
    <SimpleCommandPopupButton
      ref={refForwarded}
      {...props}
      popupCommandKeys={[
        'sortAscending',
        'sortDescending',
        'sortCustom',
        null, // divider
        'autoFilterToggle',
        'autoFilterClear',
        'autoFilterReapply'

      ]}
      scope={'sortFilter'}
      label="Sort & Filter" // Sort & Filter
      tooltip={(<><span>Organize your data so it's easier to analyze.</span><br/><span>You can sort the selected data from smallest to largest or largest to smallest.</span></>)} // You can sort the selected data from smallest to largest, largest to smallest, or filter our specific values
      icon={'SortFilter'}
    />
  );
}));