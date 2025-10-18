import React, { memo, forwardRef } from 'react';

import { Command, useCallbackRef } from '@sheetxl/utils-react';

import {
  CommandButton, CommandToolbar, ExhibitDivider,
  type CommandToolbarButtonProps, type CommandToolbarProps
} from '@sheetxl/utils-mui';

import { OverflowPalette } from './OverflowPalette';

import { InsertFunctionSumCommandPopupButton, InsertFunctionCommandPopupButton } from '../command';

export interface FormulaToolbarProps extends Omit<CommandToolbarProps, "renderToolbarPalette"> {
}

export const FormulaToolbar = memo(forwardRef<HTMLDivElement, FormulaToolbarProps>((props, refForwarded) => {
  const {
    commands,
    parentFloat,
    propsCommandButton: propCommandButtonProps,
    ...rest
  } = props;

  const renderToolbarPalette = useCallbackRef((props: CommandToolbarButtonProps) => {
    const {
      propsCommandButton,
      propsCommandPopup
    } = props;

    // TODO - all of the icons stroke lines are 'too thin' and need to be revisited by a designer, and ai, or me.
    const children = (
    <OverflowPalette
      parentFloat={parentFloat}
    >
      {/* insert function dialog/wizard */}
      <InsertFunctionSumCommandPopupButton
        {...propsCommandPopup}
      />
      <ExhibitDivider/>
      {/* recently used FunctionCategory */}
      {/* create a FunctionCategory popup */}
      <InsertFunctionCommandPopupButton
        category={"financial"}
        {...propsCommandPopup}
      />
      <InsertFunctionCommandPopupButton
        category={"logical"}
        {...propsCommandPopup}
      />
      <InsertFunctionCommandPopupButton
        category={"text"}
        {...propsCommandPopup}
      />
      <InsertFunctionCommandPopupButton
        category={"dateTime"}
        {...propsCommandPopup}
      />
      <InsertFunctionCommandPopupButton
        category={"lookupReference"}
        {...propsCommandPopup}
      />
      <InsertFunctionCommandPopupButton
        category={"mathTrig"}
        {...propsCommandPopup}
      />
      <InsertFunctionCommandPopupButton
        category={"statDist"}
        {...propsCommandPopup}
      />
      <InsertFunctionCommandPopupButton
        category={"engineering"}
        {...propsCommandPopup}
      />
      <InsertFunctionCommandPopupButton
        category={"cube"}
        {...propsCommandPopup}
      />
      <InsertFunctionCommandPopupButton
        category={"information"}
        {...propsCommandPopup}
      />
      <InsertFunctionCommandPopupButton
        category={"database"}
        {...propsCommandPopup}
      />
      <InsertFunctionCommandPopupButton
        category={"web"}
        {...propsCommandPopup}
      />
      <InsertFunctionCommandPopupButton
        category={"custom"}
        {...propsCommandPopup}
      />
      <ExhibitDivider/>
      {/* trace precedents */}
      {/* trace dependents */}
      <CommandButton
        {...propsCommandButton}
        command={(commands.getCommand('sheetViewToggleFormulaView') as Command<boolean>)}
        scope={"view"}
      />
      <ExhibitDivider/>
      {/* calculate options*/}
      <CommandButton
        {...propsCommandButton}
        command={(commands.getCommand('calculateAll'))}
      />
      <CommandButton
        {...propsCommandButton}
        command={(commands.getCommand('calculate'))}
      />
      {/* <CommandButton
        {...propsCommandButton}
        command={(commands.getCommand('calculateSettings'))} // calculateSettings
      /> */}
      {/* add automation here */}
    </OverflowPalette>);

    // pivot
    // shapes
    // map
    // custom widgets
    return children;
  }, [commands]);

  return (
    <CommandToolbar
      ref={refForwarded}
      commands={commands}
      parentFloat={parentFloat}
      propsCommandButton={propCommandButtonProps}
      renderToolbarPalette={renderToolbarPalette}
      {...rest}
    />
  );
}));

FormulaToolbar.displayName = "FormulaToolbar";