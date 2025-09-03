import React, { memo, forwardRef } from 'react';

import { Lock as LockIcon } from '@mui/icons-material';

import { ITheme } from '@sheetxl/sdk';

import { useCallbackRef, Command } from '@sheetxl/utils-react';

import { CommandContext } from '@sheetxl/react';
import {
  CommandButton, ExhibitDivider, CommandToolbar, CommandToolbarButtonProps,
  CommandToolbarProps, themeIcon, FormulaViewIcon, ViewZeroIcon//, LabelIcon
} from '@sheetxl/utils-mui';

import { FullScreenIcon, FullScreenOffIcon } from '@sheetxl/utils-mui';

import {
  FreezeCommandButton, ViewGridLinesCommandButton, ViewHeadingsCommandButton,
  WorkbookViewCommandButton, DocThemeCommandButton
} from '../command';

import { RunScriptCommandButton } from '../script';
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
        icon={<LockIcon color={"secondary"}/>}
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
        icon={themeIcon(<FormulaViewIcon/>)}
        // icon={<LabelIcon
        //   command={commands.getCommand('sheetViewToggleFormulaView')}
        //   scope={"view"}
        // />}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('sheetViewToggleShowZeros') as Command<boolean>)}
        scope={"view"}
        icon={themeIcon(<ViewZeroIcon/>)}
        // icon={<LabelIcon
        //   command={commands.getCommand('sheetViewToggleShowZeros')}
        //   scope={"view"}
        // />}
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
        icon={() => themeIcon((commands.getCommand('fullScreenToggle') as Command<boolean>).state() ? <FullScreenOffIcon/> : <FullScreenIcon/>)}
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