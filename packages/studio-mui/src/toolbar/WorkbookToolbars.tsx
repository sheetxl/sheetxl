import React, { useCallback, useState, useMemo, memo, forwardRef } from 'react';

import { type SxProps } from '@mui/system';
import { Theme, alpha, getOverlayAlpha } from '@mui/material/styles';

import { Box } from '@mui/material';
import { Paper, type PaperProps } from '@mui/material';
import { Tabs } from '@mui/material';
import { Tab, type TabProps } from '@mui/material';
import { MenuItem } from '@mui/material';
import { FormControl } from '@mui/material';
import { Select, SelectChangeEvent, type SelectProps } from '@mui/material';
import { type ToolbarProps } from '@mui/material';

import { ICommands } from '@sheetxl/utils-react';

import { IWorkbookElement } from '../components';

import { HomeToolbar } from './HomeToolbar';
import { InsertToolbar } from './InsertToolbar';
import { FormulaToolbar } from './FormulaToolbar';
import { ViewToolbar } from './ViewToolbar';

export interface WorkbookToolbarsProps extends React.HTMLAttributes<HTMLDivElement> {
  commands: ICommands.IGroup;
  /**
   * Wrap the select with custom component
   * @param children
   */
  selectWrapper?: (children: React.ReactNode) => React.ReactNode;
  /**
   * Properties for the select
   */
  selectProps?: SxProps;
  /** If we need to render compact */
  renderCompact?: boolean;
  /**
   * Wrap the palette with custom component
   * @param children
   */
  paletteWrapper?: (children: React.ReactNode) => React.ReactNode;

  paletteProps?: PaperProps;

  toolbarsProps? : Record<string, ToolbarProps>;

  workbook?: IWorkbookElement;
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps;
}

export interface WorkbookToolbarsRef {
  // No returns yet
}

interface StyledTabProps extends TabProps {

}

export const renderWorkbookToolbars = (props: WorkbookToolbarsProps): React.ReactElement => {
  return <WorkbookToolbars {...props}/>
}

const StyledTab = memo((props: StyledTabProps) => {
  const {
    sx: propSx,
    ...rest
  } = props;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        '&:hover:not([disabled]) .indicator': {
          borderBottom: (theme: Theme) => `${alpha(theme.palette.primary.main, 0.35)} solid 2px`
        },
      }}
    >
    <Tab
      disableRipple
      onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault() }}
      sx={{
        textTransform: 'none',
        flex: '1 1 100%',
        fontWeight: (theme: Theme) => theme.typography.fontWeightRegular,
        padding: '2px 6px',
        minHeight: '0px',
        minWidth: '0px',
        // fontSize: (theme: Theme) => theme.typography.pxToRem(15),
        marginRight: (theme: Theme) => theme.spacing(0.5),
        '&.Mui-selected': {
          // fontWeight: (theme: Theme) => theme.typography.fontWeightBold
        },
        '&.Mui-focusVisible': {
        },
        ...propSx
      }}
      {...rest}
    />
      <Box
        className="indicator"
        sx={{
          width: '90%',
          borderRadius: '4px',
          minWidth: '4px',
          position: 'absolute',
          bottom: '0',
          alignSelf: 'center',
          /* justify-self: end; */
          display: 'flex'
        }}
      />
    </Box>
  );
});

const ToolbarSelectTabs = memo((props: any) => {
  const {
    toolbars,
    value,
    onToolbarChange,
    sx: propsSX,
    ...rest
  } = props;

  const tabs = useMemo(() => {
    const retValue = [];
    for (let i=0; i<toolbars.length; i++) {
      retValue.push(<StyledTab label={toolbars[i].label} key={toolbars[i].label}/>);
    }
    return retValue;
  }, [toolbars]);

  return (
    <Tabs
      value={value}
      onChange={(_event, index) => {
        onToolbarChange?.(index);
      }}
      variant="scrollable"
      scrollButtons={false}
      sx={{
        paddingLeft: (theme: Theme) => theme.spacing(1.5),
        paddingRight: (theme: Theme) => theme.spacing(1.5),
        paddingTop: (theme: Theme) => theme.spacing(0),
        paddingBottom: (theme: Theme) => theme.spacing(0),
        minHeight: '26px', // magic # 'unset',
        alignItems: 'center',
        '& .MuiTabs-indicator': {
          display: 'flex',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        },
        '& .MuiTabs-indicatorSpan': {
          width: '90%',
          borderRadius: '4px',
          minWidth: '4px',
          backgroundColor: (theme: Theme) => theme.palette.primary.main
        },
        '& .MuiTab-root': {
          marginRight: '0px'
        },
        ...propsSX
      }}
      slotProps={{
        indicator: {
          children: <span className="MuiTabs-indicatorSpan" />
        }
      }}
      {...rest}
    >
      {tabs}
    </Tabs>
  );
});

type OptionSelectProps = Omit<SelectProps, 'variant' | 'onSelect'> & {
  toolbars: any;
  value: number;
  onToolbarChange: (newValue: number) => void;
  selectProps?: SxProps;
}

const OptionSelect = memo((props: OptionSelectProps) => {
  const {
    toolbars,
    value: propValue,
    onToolbarChange,
    selectProps,
    ...rest
  } = props;

  const handleChange = useCallback((event: SelectChangeEvent) => {
    onToolbarChange?.(event.target.value as unknown as number);
  }, [onToolbarChange]);

  const menus = useMemo(() => {
    const retValue = [];
    for (let i=0; i<toolbars.length; i++) {
      const label = toolbars[i].label;
      retValue.push(
        <MenuItem
          key={label}
          value={i}
          sx={{
            color: (theme: Theme) => {
              if (propValue === i)
                return theme.palette.primary.main
            }
          }}
        >
          {label}
        </MenuItem>
      );
    }
    return retValue;
  }, [toolbars, propValue]);

  return (
    <FormControl
      sx={{
        minWidth: '125px', // TODO - make this dynamic
        maxWidth: '125px',
        // maxWidth: '100%',
        '& .MuiInputBase-root': {
          paddingLeft: '0px',
          paddingRight: '0px',
        },
        '& .MuiSelect-select': {
          paddingTop: (theme: Theme) => { return theme.spacing(0.5) },
          paddingBottom: (theme: Theme) => { return theme.spacing(0.5) },
          paddingLeft: (theme: Theme) => { return theme.spacing(2) },
          color: (theme: Theme) => {
            return theme.palette.primary.main;
            // return theme.palette.text.secondary;
          },
          // "&:hover:not(.Mui-disabled)": {
          //   color: (theme: Theme) => {
          //     return theme.palette.primary.main;
          //     // return theme.palette.text.primary;
          //   }
          // }
        },
        '& .MuiSelect-icon': {
          fill: (theme: Theme) => {
            return ((theme.palette.text as any).icon ?? theme.palette.action.active);
            // return theme.palette.text.secondary;
          },
          "&:hover:not(.Mui-disabled)": {
            color: (theme: Theme) => {
              return ((theme.palette.text as any).icon ?? theme.palette.action.active);
              // return theme.palette.text.primary;
            }
          }
        },
        ...selectProps
      }}
      size="small"
    >
      <Select
        value={propValue}
        onChange={handleChange}
        variant="outlined"
        sx={{
          backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
        }}
        {...rest}
      >
        {menus}
      </Select>
    </FormControl>
  );
});


// TODO - add a beforeTabs and afterTabs top (for file and settings)
const WorkbookToolbars: React.FC<WorkbookToolbarsProps & {
  ref?: React.Ref<WorkbookToolbarsRef>;
}> = memo(
  forwardRef<WorkbookToolbarsRef, WorkbookToolbarsProps>((props, refForwarded) => {
  const {
    commands,
    selectWrapper,
    selectProps = {},
    renderCompact = false,
    paletteWrapper,
    toolbarsProps,
    paletteProps = {},
    workbook,
    sx: sxProp,
    ...rest
  } = props;

  const toolbars = useMemo(() => {
    const retValue = [];
    const {
      ref: toolbarHomeRef,
      ...restToolbarHomeProps
    } = toolbarsProps?.['Home'] || {};

    retValue.push({
      label: 'Home',
      component: <HomeToolbar commands={commands} {...restToolbarHomeProps} />
    });

    const {
      ref: toolbarInsertRef,
      ...restToolbarInsertProps
    } = toolbarsProps?.['Insert'] || {};
    retValue.push({
      label: 'Insert',
      component: <InsertToolbar commands={commands} {...restToolbarInsertProps} />
    });
    if (__DEV__) {
      const {
        ref: toolbarFormulasRef,
        ...restToolbarFormulasProps
      } = toolbarsProps?.['Formulas'] || {};
      retValue.push({
        label: 'Formulas',
        component: <FormulaToolbar commands={commands} {...restToolbarFormulasProps} />
      });
    }
    const {
      ref: toolbarViewRef,
      ...restToolbarViewProps
    } = toolbarsProps?.['View'] || {};
    retValue.push({
      label: 'View',
      component: <ViewToolbar commands={commands} {...restToolbarViewProps} />
    });
    return retValue;
  }, [commands, workbook]);

  const tabPanes = useMemo(() => {
    // Note - We could generate just the single toolbar
    const retValue = [];
    for (let i=0; i<toolbars.length; i++) {
      retValue.push(
        React.cloneElement(toolbars[i].component, {
          ...toolbars[i].component.props,
          key: (toolbars[i] as unknown as any).key ?? toolbars[i].label
        })
      );
    }
    return retValue;
  }, [toolbars]);

  const [tabIndex, setTabIndex] = useState<number>(0);

  const handleToolbarChange = (newValue: number) => {
    setTabIndex(newValue);
  };

  const toolbarSelect = useMemo(() => {
    // TODO - return focus after select (or better yet prevent on click focus)
    if (renderCompact) {
      return (
        <OptionSelect
          toolbars={toolbars}
          value={tabIndex}
          onToolbarChange={handleToolbarChange}
          sx={selectProps}
        />
      );
    }
    return (
      <ToolbarSelectTabs
        toolbars={toolbars}
        value={tabIndex}
        onToolbarChange={handleToolbarChange}
        sx={selectProps}
      />
    );
  }, [toolbars, tabIndex, selectProps, renderCompact]);

  const {
    sx: paletteSXProps,
    ...paletteRest
  } = paletteProps;
  const paletteElement = (
    <Paper
      elevation={2}
      tabIndex={0}
      sx={{
        display:'flex',
        alignItems: 'center',
        userSelect: 'none',
        flexGrow: 1,
        borderRadius: '8px', // border-radius: var(--borderRadiusXLarge);
        backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
        marginLeft: (theme: Theme) => { return theme.spacing(1) },
        marginRight: (theme: Theme) => { return theme.spacing(1) },
        marginTop: (theme: Theme) => { return theme.spacing(0.5) },
        marginBottom: (theme: Theme) => { return theme.spacing(0.5) },
        ...paletteSXProps
      }}
      {...paletteRest}
    >
      {tabPanes[tabIndex]}
    </Paper>
  );
  return (
    <Box
      ref={refForwarded}
      className="toolbarWrappers"
      sx={{
        display:'flex',
        flexDirection: 'column',
        paddingTop: (theme: Theme) => { return theme.spacing(0.5) },
        '*': {
          userSelect: 'none'
        },
        ...sxProp
      }}
      {...rest}
    >
      {selectWrapper ? selectWrapper(toolbarSelect) : toolbarSelect}
      {paletteWrapper ? paletteWrapper(paletteElement) : paletteElement}
    </Box>
  );
}));

WorkbookToolbars.displayName = "WorkbookToolbars";
export { WorkbookToolbars };