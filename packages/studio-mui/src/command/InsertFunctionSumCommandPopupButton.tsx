import React, { memo, forwardRef } from 'react';

import { ICommands, type CommandButtonOptions } from '@sheetxl/utils-react';

import { FloatReference } from '@sheetxl/utils-mui';

import { SimpleCommandPopupButton } from '@sheetxl/utils-mui';


export interface InsertFunctionSumCommandPopupButtonProps extends CommandButtonOptions {
  parentFloat: FloatReference;

  commands: ICommands.IGroup;
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
    <SimpleCommandPopupButton
      ref={refForwarded}
      {...rest}
      popupCommandKeys={[
        'insertFunctionSum',
        'insertFunctionAverage',
        'insertFunctionCount',
        'insertFunctionMax',
        'insertFunctionMin',
        null,// divider
        'insertFunction',
      ]}
      quickCommand={'insertFunctionSum'}
      popupScope={'insertFunction'}
      label="Quick Function"
      tooltip="More functions."
    />
  );
}));

InsertFunctionSumCommandPopupButton.displayName = "InsertFunctionSumCommandPopupButton";
