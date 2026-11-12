import { memo, forwardRef } from 'react';

import { type CommandButtonOptions, type FloatReference } from '@sheetxl/utils-react';

import { CommandGroup } from '@sheetxl/utils-mui';


export interface InsertFunctionSumCommandPopupButtonProps extends CommandButtonOptions {
}

/**
 * Menu for quick function sum
 */
export const InsertFunctionSumCommandPopupButton = memo(
  forwardRef<HTMLElement, InsertFunctionSumCommandPopupButtonProps>((props, refForwarded) => {
  const {
    ...rest
  } = props;

  return (
    <CommandGroup
      ref={refForwarded}
      groupKey="insertFunctionSumOptions"
      {...rest}
    />
  );
}));

InsertFunctionSumCommandPopupButton.displayName = "InsertFunctionSumCommandPopupButton";
