import React, { useState, useMemo, memo, forwardRef } from 'react';

import clsx from 'clsx';

import { Theme } from '@mui/material/styles';
import { SxProps } from '@mui/system';

import { Box } from '@mui/material';

import {
  DynamicIcon, ICommand, Command, ICommands, CommandButtonType
} from '@sheetxl/utils-react';

import { IWorkbook, IColor, IWorkbookProtection } from '@sheetxl/sdk';

import { TabStripRef, useModelListener, CommandContext } from '@sheetxl/react';

import {
  CommandButton, ExhibitMenuItem, ExhibitDivider, FloatReference
} from '@sheetxl/utils-mui';

import { AutoColorPosition } from '../color';

import { ColorCommandButton } from '../../command/ColorCommandButton';

export interface SheetTabMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The workbook.
   */
  workbook: IWorkbook;

  index: number;

  commands: ICommands.IGroup;

  scope?: string
  disabled?: boolean;

  floatReference: FloatReference;
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;

  tabStripRef?: TabStripRef;
}

/**
 * Menu for sheet tab operations such as renaming, deleting, and coloring.
 */
export const SheetTabMenu = memo(forwardRef<HTMLDivElement, SheetTabMenuProps>(
  (props: SheetTabMenuProps, refForwarded) => {
  const {
    workbook,
    index,
    commands,
    scope = "sheet",
    disabled: propDisabled,
    floatReference,
    sx: propSx,
    className: propClassName,
    tabStripRef,
    ...rest
  } = props;

  const [protection, setProtection] = useState<IWorkbookProtection>(workbook?.getProtection());
  useModelListener<IWorkbook, IWorkbook.IListeners>(workbook, {
    onProtectionChange: (source: IWorkbook) => {
      setProtection(source?.getProtection());
    },
  });

  const buttonProps = useMemo(() => {
    return {
      // dense: true,
      // outlined: false,
      // disabled: true
    }
  }, []);

  const commandProps = useMemo(() => {
    return {
      commandHook: {
        beforeExecute: (_command: ICommand<any, any>, _args: any): Promise<boolean | void> | boolean | void => {
          return floatReference.closeAll();
        },
        onExecute(): void {
          //focusRelated();
        },
        onError(): void {
          console.log('onError');
        },
      },
      scope,
      commandState: index,
      disabled: propDisabled || index === undefined,
      parentFloat : floatReference
    }
  }, [propDisabled, floatReference]);

  const commandButtonProps = useMemo(() => {
    return {
      ...buttonProps,
      ...commandProps
    }
  }, [buttonProps, commandProps]);

  const items = (<>
    <CommandButton
      command={commands.getCommand('addSheet')}
      commandState={index}
      {...commandButtonProps}
      variant={CommandButtonType.Menuitem}
      // icon={<ContentCutIcon/>}
    />
    <CommandButton
      command={commands.getCommand('deleteSheet')}
      {...commandButtonProps}
      variant={CommandButtonType.Menuitem}
      // icon={<ContentCutIcon/>}
    />
    {/* TODO - make this a command */}
    <ExhibitMenuItem
      onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault()}}
      onMouseUp={() => {
        Promise.resolve(floatReference.closeAll()).then(() => {
          tabStripRef?.startEdit(index);
        })
      }}
      disabled={propDisabled || !protection.isStructureAllowed()}
      parentFloat={floatReference}
    >
      Rename{scope !== 'sheet' ? ' Sheet' : ''}
    </ExhibitMenuItem>
    <CommandButton
      command={commands.getCommand('duplicateSheet')}
      {...commandButtonProps}
      variant={CommandButtonType.Menuitem}
      // icon={<ContentCutIcon/>}
    />
    {/* TODO - change to ('showDetails('protection') ) */}
    <CommandButton
      command={commands?.getCommand('protectionSheetToggle') as any}//Command<boolean>}
      {...commandButtonProps}
      variant={CommandButtonType.Menuitem}
    />
    <ColorCommandButton
      variant={CommandButtonType.Menuitem}
      command={(commands.getCommand('formatSheetTabColor') as Command<IColor, CommandContext.Color>)}
      icon={<DynamicIcon iconKey="stroke.colored" />}
      // onSelectColor={(color: Color.Color | null, isCustom: boolean) => {
      //   // handleRecent(color, isCustom);
      // }}
      propsPanel={{
        disableAlpha: true,
        autoColorLabel: "No Tab Color",
        autoColorPosition : AutoColorPosition.End,
      }}
      parentFloat={floatReference}
    />
    <ExhibitDivider orientation="horizontal"/>
    <CommandButton
      command={commands.getCommand('hideSheet')}
      {...commandButtonProps}
      variant={CommandButtonType.Menuitem}
    />
    {/* TODO - move sheet left/move sheet right commands */}
  </>);

  return (
    <Box
      ref={refForwarded}
      className={clsx("menu", propClassName)}
      sx={{
        ...propSx,
      }}
      {...rest}
    >
      {items}
    </Box>
  );
}));

SheetTabMenu.displayName = "SheetTabMenu";