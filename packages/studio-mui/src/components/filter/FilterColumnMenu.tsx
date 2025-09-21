import React, { useMemo, memo, forwardRef } from 'react';

import { Theme } from '@mui/material/styles';
import { SxProps } from '@mui/system';

import { Box } from '@mui/material';
// import { Button } from '@mui/material';

import { IAutoFilter } from '@sheetxl/sdk';

import {
  ICommand, ICommands, CommandButtonType
} from '@sheetxl/utils-react';

import {
  CommandButton, FloatReference, ExhibitDivider
} from '@sheetxl/utils-mui';

// import { Filters } from './Filters';

export interface FilterColumnMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  filter: IAutoFilter.IColumn;

  commands?: ICommands.IGroup;

  disabled?: boolean;
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;

  floatReference: FloatReference;
}

const FilterColumnMenu = memo(forwardRef<HTMLDivElement, FilterColumnMenuProps>((props, refForwarded) => {
  const {
    filter,
    commands,
    disabled: propDisabled,
    sx: propSx,
    floatReference,
    ...rest
  } = props;


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
      ...buttonProps,
      ...commandProps,
      variant: CommandButtonType.Menuitem
    }
  }, [buttonProps, commandProps]);

  // const commandPopupProps = useMemo(() => {
  //   return {
  //     commands,
  //     variant: CommandButtonType.Menuitem,
  //     parentFloat: floatReference,
  //     ...commandProps
  //   }
  // }, [commands, commandProps, floatReference]);

  const contextOptions = [];

  const items = (<>
    <CommandButton
      {...commandButtonProps}
      command={commands.getCommand('sortAscending')}
    />
    <CommandButton
      {...commandButtonProps}
      command={commands.getCommand('sortDescending')}
    />
    <ExhibitDivider orientation="horizontal"/>
    <CommandButton
      {...commandButtonProps}
      // scope={'filter'}
      command={commands.getCommand('autoFilterClear')}
    />
    {/* <ExhibitDivider orientation="horizontal"/>
    <Filters
      filter={filter}
    /> */}
    {/* <ExhibitDivider orientation="horizontal"/>
    <Button
      color={'primary'}
      variant={'contained'}
      size={`small`}
      disabled={propDisabled}
      sx={{
        flex: 'none',
        alignSelf: 'end',
        margin: '4px 16px',
        minWidth: `75px`
      }}
      onClick={() => {
        // TODO - update filter state with current values
        console.log('filter reapply');
        floatReference.closeAll()
      }}
      >
      <div
        style={{
          paddingTop: '3px' // not sure why this is needed to make visually nice
        }}
      >
        Apply
      </div>
    </Button> */}
    {contextOptions}
  </>);

  return (
    <Box
      ref={refForwarded}
      sx={{
        paddingTop: '4px', // TODO - size of rounded border from theme
        paddingBottom: '4px', // TODO - size of rounded border from theme
        display: 'flex',
        flexDirection: 'column',
        ...propSx,
      }}
      {...rest}
    >
      {items}
    </Box>
  );
}));

FilterColumnMenu.displayName = "FilterColumnMenu";
export { FilterColumnMenu };