import type React from 'react';
import { useCallback, useState, useMemo, memo, forwardRef } from 'react';

import { type SxProps } from '@mui/system';
import { alpha, type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { Paper, type PaperProps } from '@mui/material';
import { Tabs } from '@mui/material';
import { Tab, type TabProps } from '@mui/material';
import { MenuItem } from '@mui/material';
import { FormControl } from '@mui/material';
import { Select, type SelectChangeEvent, type SelectProps } from '@mui/material';
import { type ToolbarProps } from '@mui/material';

import { CommonUtils } from '@sheetxl/utils';
import { CommandButtonEntryLabel, useCommandButtonRegistry } from '@sheetxl/utils-react';
import { CommandToolbar } from '@sheetxl/utils-mui';

import { WORKBOOK_TOOLBARS_KEY } from '@sheetxl/react';

/**
 * Fallback tab list used only when the {@link WORKBOOK_TOOLBARS_KEY} strip panel is not registered (a bare
 * host that never called `registerWorkbookCommandGroups`). Normally the strip's members ARE the config.
 */
export const DefaultWorkbookToolbars: readonly string[] = [
  'homeToolbar', 'insertToolbar', 'formulaToolbar', 'dataToolbar', 'reviewToolbar', 'viewToolbar'
];

export interface WorkbookToolbarsProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Explicit override of the ordered ribbon tabs (each the **key** of a registered toolbar surface).
   *
   * @remarks
   * By default the tabs are **contribution-driven**: resolved from the members of the
   * `workbookToolbars` strip panel, so features/plugins add tabs by contributing into it (e.g. the
   * react table contributor's contextual `tableToolbar`). Pass this only to bypass the registry and
   * pin an explicit list — doing so opts OUT of contributed/contextual tabs.
   */
  toolbars?: readonly string[];
  /**
   * Wrap the select with custom component.
   *
   * @param children
   */
  wrapperSelect?: (children: React.ReactNode) => React.ReactNode;
  /**
   * If we need to render compact.
   */
  isCompact?: boolean;
  /**
   * Wrap the palette with custom component.
   *
   * @param children
   */
  wrapperPalette?: (children: React.ReactNode) => React.ReactNode;

  propsPalette?: PaperProps;

  /** Per-tab {@link ToolbarProps}, keyed by the toolbar key (e.g. `homeToolbar`). */
  propsToolbars?: Record<string, ToolbarProps>;

  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps;
}

interface StyledTabProps extends TabProps {

}

export const defaultRenderToolbar = (props: WorkbookToolbarsProps): React.ReactElement => {
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
      retValue.push(<StyledTab label={toolbars[i].label} key={toolbars[i].key ?? toolbars[i].label}/>);
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
}

const OptionSelect = memo((props: OptionSelectProps) => {
  const {
    toolbars,
    value: propValue,
    onToolbarChange,
    ...rest
  } = props;

  const handleChange = useCallback((event: SelectChangeEvent<unknown>) => {
    onToolbarChange?.(event.target.value as unknown as number);
  }, [onToolbarChange]);

  const menus = useMemo(() => {
    const retValue = [];
    const toolbarsLength = toolbars.length;
    for (let i=0; i<toolbarsLength; i++) {
      const label = toolbars[i].label;
      retValue.push(
        <MenuItem
          key={toolbars[i].key ?? label}
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
        }
      }}
      size="small"
    >
      <Select
        value={propValue}
        onChange={handleChange}
        variant="outlined"
        {...rest}
      >
        {menus}
      </Select>
    </FormControl>
  );
});


export const WorkbookToolbars = memo(forwardRef<HTMLElement, WorkbookToolbarsProps>(
  (props: WorkbookToolbarsProps, refForwarded) => {
  const {
    toolbars: toolbarsOverride,
    wrapperSelect,
    isCompact = false,
    wrapperPalette,
    propsToolbars = CommonUtils.EmptyObject,
    propsPalette = CommonUtils.EmptyObject,
    sx: sxProp,
    ...rest
  } = props;

  // The tab strip is **contribution-driven**: resolve the `workbookToolbars` panel's members (the base
  // tabs woven with any contributed tabs — e.g. the react table contributor's contextual `tableToolbar`,
  // added / removed as a table is selected). `useCommandButtonRegistry` re-renders this on the registry
  // version (which the table contributor bumps when it toggles the tab), so no selection logic lives
  // here. An explicit `toolbars` prop bypasses the registry (opting out of contributed tabs).
  const registry = useCommandButtonRegistry();
  const toolbarKeys: readonly string[] = toolbarsOverride ?? (() => {
    const resolved = registry.resolveMembers(WORKBOOK_TOOLBARS_KEY);
    if (!resolved) return DefaultWorkbookToolbars;
    return resolved.filter((m): m is string => typeof m === 'string' && m !== '-');
  })();
  // Stable signature so the descriptor memo only rebuilds when the tab SET changes (not every render).
  const toolbarKeysSig = toolbarKeys.join('|');

  // Ribbon-tab descriptors. Labels are self-resolving elements over the toolbar panel ENTRIES (the same
  // registry-first, language-aware read as any command button), so this stays stable across language
  // switches — the label element re-renders itself. `key` is the (stable) toolbar key, never the label
  // (react keys must survive a language switch).
  const tabs = useMemo(() => {
    return toolbarKeys.map((key) => {
      const { ref: _ref, ...propsToolbar } = propsToolbars?.[key] ?? CommonUtils.EmptyObject;
      return {
        key,
        label: <CommandButtonEntryLabel entryKey={key}/>,
        component: <CommandToolbar {...propsToolbar} key={key} groupKey={key}/>
      };
    });
  }, [toolbarKeysSig, propsToolbars]);

  const tabPanes = useMemo(() => tabs.map((tab) => tab.component), [tabs]);

  const [tabIndex, setTabIndex] = useState<number>(0);
  // The Table tab is contextual, so the active count changes at runtime; clamp the rendered index so a
  // vanishing tab (table deselected while its tab was active) falls back to the last available tab.
  const selectedIndex = tabs.length > 0 ? Math.min(tabIndex, tabs.length - 1) : 0;

  const handleToolbarChange = (newValue: number) => {
    setTabIndex(newValue);
  };

  const toolbarSelect = useMemo(() => {
    // TODO - return focus after select (or better yet prevent on click focus)
    if (isCompact) {
      return (
        <OptionSelect
          toolbars={tabs}
          value={selectedIndex}
          onToolbarChange={handleToolbarChange}
          sx={{
            paddingLeft: (theme: Theme) => theme.spacing(1),
            paddingRight: (theme: Theme) => theme.spacing(1)
          }}
        />
      );
    }
    return (
      <ToolbarSelectTabs
        toolbars={tabs}
        value={selectedIndex}
        onToolbarChange={handleToolbarChange}
      />
    );
  }, [tabs, selectedIndex, isCompact]);

  const {
    sx: paletteSXProps,
    ...paletteRest
  } = propsPalette;
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
        // The palette is docked, not floating, but it wants to read as the SAME surface as the menus and
        // the overflow popup it spawns — so it reads the float fill rather than a token of its own
        // ("a brighter toolbar" is an app style choice, not a color a host names). Falls back to the paper
        // it has always used.
        backgroundColor: 'var(--sxl-color-elevated, var(--sxl-color-base-100))',
        // The edge a flat host gives its floating chrome — see ExhibitFloatPanel.
        border: '1px solid var(--sxl-color-elevated-border, transparent)',
        marginLeft: (theme: Theme) => { return theme.spacing(1) },
        marginRight: (theme: Theme) => { return theme.spacing(1) },
        marginTop: (theme: Theme) => { return theme.spacing(0.5) },
        marginBottom: (theme: Theme) => { return theme.spacing(0.5) },
        ...paletteSXProps
      }}
      {...paletteRest}
    >
      {tabPanes[selectedIndex]}
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
      {wrapperSelect ? wrapperSelect(toolbarSelect) : toolbarSelect}
      {wrapperPalette ? wrapperPalette(paletteElement) : paletteElement}
    </Box>
  );
}));

WorkbookToolbars.displayName = "WorkbookToolbars";