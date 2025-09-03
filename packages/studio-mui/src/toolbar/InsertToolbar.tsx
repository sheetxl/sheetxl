import React, { memo, forwardRef } from 'react';

// import { AddPhotoAlternate as AddPhotoAlternateIcon } from '@mui/icons-material';
// import { TableView as TableViewIcon } from '@mui/icons-material';

import { useCallbackRef } from '@sheetxl/utils-react';

import {
  CommandButton, CommandToolbar, ExhibitDivider,
  CommandToolbarButtonProps, CommandToolbarProps, themeIcon,
  ICommandToolbarElement
} from '@sheetxl/utils-mui';

import {
  InsertHyperlinkIcon, InsertCommentIcon, InsertTableIcon
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
      {__DEV__ ? <>
        <InsertChartCommandButton
          {...commandPopupProps}
        />
        <ExhibitDivider/>
      </>: null}
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('updateHyperlink'))}
        icon={themeIcon(<InsertHyperlinkIcon/>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('updateComments'))}
        icon={themeIcon(<InsertCommentIcon/>)}
      />
      <InsertImageCommandButton
        {...commandPopupProps}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('insertTable'))}
        icon={themeIcon(<InsertTableIcon/>)} // TODO - create a custom multi-color icon that is nicer.
      />
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

InsertToolbar.displayName = "InsertToolbar";
export { InsertToolbar };