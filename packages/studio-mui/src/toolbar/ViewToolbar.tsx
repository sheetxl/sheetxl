import React, { memo, forwardRef } from 'react';

import { ITheme } from '@sheetxl/sdk';

import { useCallbackRef, Command } from '@sheetxl/utils-react';

import { CommandContext } from '@sheetxl/react';
import {
  CommandButton, ExhibitDivider, CommandToolbar, CommandToolbarButtonProps,
  CommandToolbarProps
} from '@sheetxl/utils-mui';

import {
  FreezeCommandButton, ViewGridLinesCommandButton, ViewHeadingsCommandButton,
  WorkbookViewCommandButton, DocThemeCommandButton
} from '../command';

import { RunScriptCommandButton } from '../scripting';
import { OverflowPalette } from './OverflowPalette';

const ViewToolbar = memo(forwardRef<HTMLDivElement,Omit<CommandToolbarProps, "createToolbarPalette">>((props, refForwarded) => {
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

    // add zoom
    // Custom views (later)

    const children = (
    <OverflowPalette
      parentFloat={parentFloat}
    >
      <FreezeCommandButton
        {...commandPopupProps}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('protectionSheetToggle') as Command<boolean>)}
      />
      <ExhibitDivider/>
      <ViewGridLinesCommandButton
        {...commandPopupProps}
      />
      <ViewHeadingsCommandButton
        {...commandPopupProps}
      />
      <ExhibitDivider/>
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('sheetViewToggleFormulaView') as Command<boolean>)}
        scope={"view"}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('sheetViewToggleShowZeros') as Command<boolean>)}
        scope={"view"}
      />
      <ExhibitDivider/>
      <WorkbookViewCommandButton
        {...commandPopupProps}
      />
      <DocThemeCommandButton
        command={(commands.getCommand('selectTheme') as Command<ITheme, CommandContext.Theme>)}
        {...commandPopupProps}
      />
      <ExhibitDivider/>
      <RunScriptCommandButton
        {...commandPopupProps}
        scope={"view"}
      />
      <ExhibitDivider/>
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('fullScreenToggle') as Command<boolean>)}
        scope={"view"}
      />
    </OverflowPalette>);
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

ViewToolbar.displayName = "ViewToolbar";
export { ViewToolbar };