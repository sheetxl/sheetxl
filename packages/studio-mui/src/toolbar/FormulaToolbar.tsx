import React, { memo, forwardRef } from 'react';

import { Command, useCallbackRef } from '@sheetxl/utils-react';

import {
  CommandButton, CommandToolbar, CommandToolbarButtonProps, CommandToolbarProps, ExhibitDivider, LabelIcon, themeIcon
} from '@sheetxl/utils-mui';

import {
  CalculateIcon, CalculateSheetIcon, FormulaViewIcon
} from '@sheetxl/utils-mui';

import { OverflowPalette } from './OverflowPalette';

import { InsertFunctionSumCommandPopupButton, InsertFunctionCommandPopupButton } from '../command';

export interface FormulaToolbarProps extends Omit<CommandToolbarProps, "createToolbarPalette"> {
}

const FormulaToolbar = memo(forwardRef<HTMLDivElement, FormulaToolbarProps>((props, refForwarded) => {
  const {
    commands,
    parentFloat,
    commandButtonProps: propCommandButtonProps,
    ...rest
  } = props;

  const createToolbarPalette = useCallbackRef((props: CommandToolbarButtonProps) => {
    const {
      commandButtonProps,
      commandPopupProps
    } = props;

    // TODO - all of the icons stroke lines are 'too thin' and need to be revisited by a designer, and ai, or me.
    const children = (
    <OverflowPalette
      parentFloat={parentFloat}
    >
      {/* insert function dialog/wizard */}
      <InsertFunctionSumCommandPopupButton
        {...commandPopupProps}
      />
      <ExhibitDivider/>
      {/* recently used FunctionCategory */}
      {/* create a FunctionCategory popup */}
      <InsertFunctionCommandPopupButton
        category={"financial"}
        {...commandPopupProps}
      />
      <InsertFunctionCommandPopupButton
        category={"logical"}
        {...commandPopupProps}
      />
      <InsertFunctionCommandPopupButton
        category={"text"}
        {...commandPopupProps}
      />
      <InsertFunctionCommandPopupButton
        category={"dateTime"}
        {...commandPopupProps}
      />
      <InsertFunctionCommandPopupButton
        category={"lookupReference"}
        {...commandPopupProps}
      />
      <InsertFunctionCommandPopupButton
        category={"mathTrig"}
        {...commandPopupProps}
      />
      <InsertFunctionCommandPopupButton
        category={"statDist"}
        {...commandPopupProps}
      />
      <InsertFunctionCommandPopupButton
        category={"engineering"}
        {...commandPopupProps}
      />
      <InsertFunctionCommandPopupButton
        category={"cube"}
        {...commandPopupProps}
      />
      <InsertFunctionCommandPopupButton
        category={"information"}
        {...commandPopupProps}
      />
      <InsertFunctionCommandPopupButton
        category={"database"}
        {...commandPopupProps}
      />
      <InsertFunctionCommandPopupButton
        category={"web"}
        {...commandPopupProps}
      />
      <InsertFunctionCommandPopupButton
        category={"custom"}
        {...commandPopupProps}
      />
      <ExhibitDivider/>
      {/* trace precedents */}
      {/* trace dependents */}
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('sheetViewToggleFormulaView') as Command<boolean>)}
        scope={"view"}
        icon={themeIcon(<FormulaViewIcon/>)}
        // icon={<LabelIcon
        //   command={commands.getCommand('sheetViewToggleFormulaView')}
        //   scope={"view"}
        // />}
      />
      <ExhibitDivider/>
      {/* calculate options*/}
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('calculateAll'))}
        icon={themeIcon(<CalculateIcon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('calculate'))}
        icon={themeIcon(<CalculateSheetIcon/>)}
      />
      {/* <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('calculateSettings'))} // calculateSettings
        icon={themeIcon(<CalculateSettingsIcon/>)}
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
      commandButtonProps={propCommandButtonProps}
      createToolbarPalette={createToolbarPalette}
      {...rest}
    />
  );
}));

FormulaToolbar.displayName = "FormulaToolbar";
export { FormulaToolbar };