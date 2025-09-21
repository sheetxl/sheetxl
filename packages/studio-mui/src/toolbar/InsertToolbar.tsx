import React, { memo, forwardRef } from 'react';

import { useCallbackRef } from '@sheetxl/utils-react';

import {
  CommandButton, CommandToolbar, ExhibitDivider,
  CommandToolbarButtonProps, CommandToolbarProps,
  ICommandToolbarElement
} from '@sheetxl/utils-mui';

import { OverflowPalette } from './OverflowPalette';

import { InsertImageCommandButton } from '../command/InsertImageCommandButton';
import { InsertChartCommandButton } from '../chart/command/InsertChartCommandButton';

const InsertToolbar = memo(forwardRef<ICommandToolbarElement, Omit<CommandToolbarProps, "createToolbarPalette">>((props, refForwarded) => {
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
      {/* pivot */}
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('insertTable'))}
      />
      {/* forms */}
      <InsertImageCommandButton
        {...commandPopupProps}
      />
      {/* shapes */}
      {/* checkbox / controls */}
      {__DEV__ ? <>
        <InsertChartCommandButton
          {...commandPopupProps}
        />
        <ExhibitDivider/>
      </>: null}
      {/* sparklines */}
      {/* slicer */}
      {/* timeline? */}
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('updateHyperlink'))}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('updateComments'))}
      />
      {/* textbox / smartArt / header & footer */}
      {/* symbols (math + unicode) */}
    </OverflowPalette>);


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

InsertToolbar.displayName = "InsertToolbar";
export { InsertToolbar };