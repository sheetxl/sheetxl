import React, { memo, forwardRef } from 'react';


import { ICommands, ICommand } from '@sheetxl/utils-react';

import {
  FunctionSumIcon, FunctionThinIcon, FloatReference, type CommandButtonOptions
} from '@sheetxl/utils-mui';

import { themeIcon, SimpleCommandPopupButton } from '@sheetxl/utils-mui';


export interface InsertFunctionSumCommandPopupButtonProps extends CommandButtonOptions {
  parentFloat: FloatReference;

  commands: ICommands.IGroup;
}

/**
 * Menu for quick function sum
 */
const InsertFunctionSumCommandPopupButton = memo(
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
      icon={(command: ICommand) => {
        const commandKey:string = command?.key();
        switch (commandKey) {
          case 'insertFunctionSum':
            return themeIcon(<FunctionSumIcon/>);
          case 'insertFunction':
            return themeIcon(<FunctionThinIcon/>);
          default:
            return null;
        }
      }}
    />
  );
}));


InsertFunctionSumCommandPopupButton.displayName = "InsertFunctionSumCommandPopupButton";
export { InsertFunctionSumCommandPopupButton };