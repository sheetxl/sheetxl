import React, { memo, forwardRef } from 'react';

import { ITheme } from '@sheetxl/sdk';

import { useCallbackRef, Command } from '@sheetxl/utils-react';

import type { CommandContext } from '@sheetxl/react';

import {
  CommandButton, ExhibitDivider, CommandToolbar,
  type CommandToolbarButtonProps, type CommandToolbarProps
} from '@sheetxl/utils-mui';

import {
  FreezeCommandButton, ViewGridLinesCommandButton, ViewHeadingsCommandButton,
  WorkbookViewCommandButton, DocThemeCommandButton
} from '../command';

import { RunScriptCommandButton } from '../scripting';
import { OverflowPalette } from './OverflowPalette';

export const ViewToolbar = memo(forwardRef<HTMLDivElement,Omit<CommandToolbarProps, "renderToolbarPalette">>((props, refForwarded) => {
  const {
    commands,
    parentFloat,
    propsCommandButton: proppropsCommandButton,
    ...rest
  } = props;

  const renderToolbarPalette = useCallbackRef((props: CommandToolbarButtonProps) => {
    const {
      propsCommandButton,
      propsCommandPopup
    } = props;

    // add zoom
    // Custom views (later)

    const children = (
    <OverflowPalette
      parentFloat={parentFloat}
    >
      <FreezeCommandButton
        {...propsCommandPopup}
      />
      <CommandButton
        {...propsCommandPopup}
        command={(commands.getCommand('protectionSheetToggle') as Command<boolean>)}
      />
      <ExhibitDivider/>
      <ViewGridLinesCommandButton
        {...propsCommandPopup}
      />
      <ViewHeadingsCommandButton
        {...propsCommandPopup}
      />
      <ExhibitDivider/>
      <CommandButton
        {...propsCommandButton}
        command={(commands.getCommand('sheetViewToggleFormulaView') as Command<boolean>)}
        scope={"view"}
      />
      <CommandButton
        {...propsCommandButton}
        command={(commands.getCommand('sheetViewToggleShowZeros') as Command<boolean>)}
        scope={"view"}
      />
      <ExhibitDivider/>
      <WorkbookViewCommandButton
        {...propsCommandPopup}
      />
      <DocThemeCommandButton
        command={(commands.getCommand('selectTheme') as Command<ITheme, CommandContext.Theme>)}
        {...propsCommandPopup}
      />
      <ExhibitDivider/>
      <RunScriptCommandButton
        {...propsCommandPopup}
        scope={"view"}
      />
      <ExhibitDivider/>
      <CommandButton
        {...propsCommandButton}
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
      propsCommandButton={proppropsCommandButton}
      renderToolbarPalette={renderToolbarPalette}
      {...rest}
    />
  );
}));

ViewToolbar.displayName = "ViewToolbar";