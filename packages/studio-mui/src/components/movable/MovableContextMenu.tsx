import React, { useMemo, memo, forwardRef } from 'react';

import { Theme } from '@mui/material/styles';
import { SxProps } from '@mui/system';

import { Box } from '@mui/material';

import { IMovable } from '@sheetxl/sdk';

import { ICommand, Command, ICommands, CommandButtonType } from '@sheetxl/utils-react';

import { useModelListener } from '@sheetxl/react';

import {
  SimpleCommandPopupButton, FloatReference, ExhibitDivider, CommandButton
} from '@sheetxl/utils-mui';

import { WalkingCopyCommandButton } from '../../command/WalkingCopyCommandButton';

export interface MovableContextMenuProps extends React.HTMLAttributes<HTMLDivElement> {

  movable: IMovable;

  commands?: ICommands.IGroup;

  disabled?: boolean;
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;

  floatReference: FloatReference;
}

const MovableContextMenu: React.FC<MovableContextMenuProps> = memo(forwardRef<HTMLDivElement, MovableContextMenuProps>((props: MovableContextMenuProps, refForwarded) => {
  const {
    movable,
    commands,
    disabled: propDisabled,
    sx: propSx,
    floatReference,
    ...rest
  } = props;

  useModelListener<IMovable, IMovable.IListeners>(movable, {
    onAnyChange(_source: IMovable): void {

    }
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
      disabled: propDisabled,
      parentFloat : floatReference
    }
  }, [propDisabled, floatReference]);

  const commandButtonProps = useMemo(() => {
    return {
      variant: CommandButtonType.Menuitem,
      ...buttonProps,
      ...commandProps
    }
  }, [buttonProps, commandProps]);

  const commandPopupProps = useMemo(() => {
    return {
      commands,
      variant: CommandButtonType.Menuitem,
      parentFloat: floatReference,
      ...commandProps
    }
  }, [commands, commandProps, floatReference]);

  const contextOptions = [];
  const contextBefore = [];


  const items = (<>
    {/* <CommandButton
      command={commands.getCommand('cut')}
      {...commandButtonProps}
      variant={CommandButtonType.Menuitem}
      icon={<ContentCutIcon/>}
    /> */}
    <WalkingCopyCommandButton
      command={commands.getCommand('copy')}
      {...commandButtonProps}
      variant={CommandButtonType.Menuitem}
    />
    {contextBefore}
    <ExhibitDivider orientation="horizontal"/>
    <SimpleCommandPopupButton
      {...commandPopupProps}
      popupCommandKeys={[
        'moveToFront',
        'moveForward',
      ]}
      quickCommand={'moveToFront'}
    />
    <SimpleCommandPopupButton
      {...commandPopupProps}
      popupCommandKeys={[
        'moveToBack',
        'moveBackward',
      ]}
      quickCommand={'moveToBack'}
    />
    <ExhibitDivider orientation="horizontal"/>
    <CommandButton
      {...commandButtonProps}
      command={(commands.getCommand('toggleLockAspectRatio') as Command<boolean>)}
    />
    <ExhibitDivider orientation="horizontal"/>
    <SimpleCommandPopupButton
      {...commandPopupProps}
      popupCommandKeys={[
        'formatDrawAlignLeft',
        'formatDrawAlignCenter',
        'formatDrawAlignRight',
        null,
        'formatDrawAlignTop',
        'formatDrawAlignMiddle',
        'formatDrawAlignBottom',
        null,
        'formatDrawDistributeHorz',
        'formatDrawDistributeVert',
        // null,
        // 'formatDrawFlipHorz',
        // 'formatDrawFlipVert',
        // null,
        // 'formatDrawSwapShapesHorz',
        // 'formatDrawSwapShapesVert',
        // null,
        // 'formatDrawGroup',
        // 'formatDrawUngroup'
      ]}
      label="Align"
      icon="DrawAlignLeft"
      tooltip="Quickly change the placement of your drawings."
    />
    <ExhibitDivider orientation="horizontal"/>
    <SimpleCommandPopupButton
      {...commandPopupProps}
      popupCommandKeys={[
        'formatAnchorTypeTwoCell',
        'formatAnchorTypeOneCell',
        'formatAnchorTypeAbsolute'
      ]}
      label="Sizing"
      icon="DrawResize"
      tooltip="Determine how the drawing size will adjust as the cell sizes adjust."
    />
    {contextOptions}
  </>);

  return (
    <Box
      ref={refForwarded}
      sx={{
        paddingTop: '4px', // TODO - size of rounded border from theme
        paddingBottom: '4px', // TODO - size of rounded border from theme
        ...propSx,
      }}
      {...rest}
    >
      {items}
    </Box>
  );
}));

MovableContextMenu.displayName = "MovableContextMenu";
export { MovableContextMenu };