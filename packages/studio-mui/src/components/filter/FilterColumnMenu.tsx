import React, { useMemo, memo, forwardRef } from 'react';

import { Box } from '@mui/material';

import type { IAutoFilter } from '@sheetxl/sdk';

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

  floatReference: FloatReference;
}

/**
 * FilterColumnMenu component to provide a menu for filter column actions.
 */
export const FilterColumnMenu = memo(forwardRef<HTMLDivElement, FilterColumnMenuProps>(
  (props: FilterColumnMenuProps, refForwarded) => {
  const {
    filter,
    commands,
    disabled: propDisabled,
    style: propStyle,
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
      style={{
        paddingTop: '4px', // TODO - size of rounded border from theme
        paddingBottom: '4px', // TODO - size of rounded border from theme
        display: 'flex',
        flexDirection: 'column',
        ...propStyle,
      }}
      {...rest}
    >
      {items}
    </Box>
  );
}));

FilterColumnMenu.displayName = "FilterColumnMenu";