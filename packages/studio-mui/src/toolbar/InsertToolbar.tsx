import React, { memo, forwardRef } from 'react';

import { useCallbackRef } from '@sheetxl/utils-react';

import {
  CommandButton, CommandToolbar, ExhibitDivider,
  type CommandToolbarButtonProps, type CommandToolbarProps, type ICommandToolbarElement
} from '@sheetxl/utils-mui';

import { OverflowPalette } from './OverflowPalette';

import { InsertImageCommandButton } from '../command';
import { InsertChartCommandButton } from '../chart/command';

export const InsertToolbar = memo(forwardRef<ICommandToolbarElement, Omit<CommandToolbarProps, "renderToolbarPalette">>((props, refForwarded) => {
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
      {/* pivot */}
      <CommandButton
        {...propsCommandButton}
        command={(commands.getCommand('insertTable'))}
      />
      {/* forms */}
      <InsertImageCommandButton
        {...propsCommandPopup}
      />
      {/* shapes */}
      {/* checkbox / controls */}
      {__DEV__ ? <>
        <InsertChartCommandButton
          {...propsCommandPopup}
        />
        <ExhibitDivider/>
      </>: null}
      {/* sparklines */}
      {/* slicer */}
      {/* timeline? */}
      <CommandButton
        {...propsCommandButton}
        command={(commands.getCommand('updateHyperlink'))}
      />
      <CommandButton
        {...propsCommandButton}
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
      propsCommandButton={propCommandButtonProps}
      renderToolbarPalette={renderToolbarPalette}
      {...rest}
    />
  );
}));

InsertToolbar.displayName = "InsertToolbar";