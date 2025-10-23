import React, { useState, memo, forwardRef } from 'react';

import clsx from 'clsx';

import { ThemeProvider, Theme, useTheme } from '@mui/material/styles';
import { alpha } from '@mui/system';
import { Button } from '@mui/material';
import { Box } from '@mui/material';
import { TabProps } from '@sheetxl/react';

import { ISheet, IColor } from '@sheetxl/sdk';

import { RoundedTab, DynamicIcon } from '@sheetxl/utils-react';
import { useModelListener } from '@sheetxl/react';

export interface SheetTabProps extends TabProps {
  /**
   * The sheet
   */
  sheet: ISheet;
  /**
   * Allow you to specify a specific material ui theme for the grid.
   *
   * * @defaultValue - the current Theme.
   *
   * @remarks
   * Useful for decorating the application with a single theme (such as dark mode) but render
   * the main grid using a different theme (for example light mode).
  */
  gridTheme?: Theme;

  /**
   * The rounded tab radius
   */
  tabRadius?: number;
}

/**
 * A tab representing a sheet in a workbook.
 */
export const SheetTab = memo(forwardRef<HTMLElement, TabProps>(
  (props: SheetTabProps, refForwarded) => {
  const {
    children,
    sheet,
    style,
    className,
    value,
    index,
    editing,
    editable,
    disabled,
    selectedIndex,
    dragging,
    borderColor,
    borderWidth,
    activeColor, // Not used as we grab from sheet.
    background: propBackground = 'white', // replace with activeColor
    tabRadius = 4,
    gridTheme,
    ...rest
  } = props;

  const [isProtected, setProtected] = useState<boolean>(() => sheet ? sheet.getProtection().isLocked() : false);
  const [tabColor, setTabColor] = useState<IColor>(() => sheet ? sheet.getTabColor() : null);
  useModelListener<ISheet, ISheet.IListeners>(sheet, {
    onProtectionChange:() => {
      setProtected(sheet.getProtection().isLocked());
    },
    onTabColorChange:() => {
      setTabColor((sheet.getTabColor()));
    },
    onStyleChange:() => {
      setTabColor((sheet.getTabColor()));
    }
  });

  const appTheme = useTheme();

  const isSelected = selectedIndex === index;
  let coloredBackground = null;
  let contrastTextColor = null;
  if (tabColor || dragging) {
    let background = propBackground;
    let backgroundGradient1 = background;
    let backgroundGradient2 = background;
    if (tabColor) {
      contrastTextColor = tabColor.toBlackOrWhite().toCSS();
      background = tabColor?.toCSS();
      backgroundGradient1 = alpha(background, .75);
      backgroundGradient2 = alpha(background, .10);
    } else if (!isSelected) {
      // TODO - make this configurable
      background = appTheme.palette.background.paper;
    }

    const linearGradient = `linear-gradient(0deg, ${background} 0%, ${backgroundGradient1} 60%, ${backgroundGradient2} 90%, transparent 100%)`;

    // TODO - use invertedColor for icons
    coloredBackground = (
      <Box
        sx={{
          position: 'absolute',
          boxSizing: 'border-box',
          top: '3px',
          left: '4px',
          right: '4.5px',
          bottom: '1.5px',
          // bottom: (isSelected ? '1px': '-2px'),
          opacity: (isSelected ? '50%': '100%'),
          borderRadius: '4px',
          border: (theme: Theme) => isSelected ? `${propBackground} solid 1px` : `${theme.palette.divider} solid 1px`,
          background: (isSelected && tabColor) ? linearGradient : background
        }}
      />
    );
  }

  let borderColorCSS = null;
  if (typeof borderColor === "string") {
    borderColorCSS = borderColor as string;
  } else if (borderColor?.toCSS) {
    borderColorCSS = borderColor.toCSS() as string;
  }

  const indicator = (isSelected ? (
    <Box
      sx={{
        width: '100%',
        borderRadius: '4px',
        minWidth: '4px',
        height: '2px',
        backgroundColor: (theme: Theme) => theme.palette.primary.main
      }}
    />
  ) : null);

  return (
    <ThemeProvider theme={isSelected ? (gridTheme ?? appTheme) : appTheme} >
    <Box
      ref={refForwarded}
      className={clsx(className)}
      sx={{
        ...style,
        display:'flex',
        flexDirection: 'column',
        minHeight: '0px',
        fontWeight: (isSelected ? '700' : '400'),
        fontSize: '0.85rem',
        letterSpacing: '0',
        lineHeight: '1',
        textTransform: 'none',
        minWidth: 'unset',
        cursor: dragging ? 'grabbing': undefined
      }}
      {...rest}
    >
      <RoundedTab
        style={{
          flex: '1 1 100%',
          display:'flex',
          flexDirection: 'row'
        }}
        radius={tabRadius}
        strokeColor={isSelected ? borderColorCSS : 'transparent'}
        // strokeWidth={isSelected ? borderWidth : 0}
      >
        <Button
          key={value + ':' + index}
          sx={{
            textTransform: 'none',
            borderRadius: '0px',
            minHeight: '0px',
            paddingLeft: '11px', // deliberately 1 left that the right to make appear more center (no idea why this is needed but I suspect i's the rounded bordering drawing is off by 1.)
            paddingRight: '12px',
            paddingTop: '3px',
            flex: '1 1 100%',
            paddingBottom: '3px',
            fontWeight: (isSelected ? '700' : '400'),
            fontSize: '0.85rem',
            letterSpacing: '0',
            transition: 'none', // to prevent transition when adding/remove/light/dark
            cursor: dragging ? 'grabbing': undefined,
            color: isSelected ? 'primary': (contrastTextColor ? contrastTextColor : 'text.secondary'),
            backgroundColor: isSelected ? propBackground : 'transparent',
            '&:hover:not([disabled])': {
              backgroundColor: isSelected ? propBackground : 'transparent'
            },
            '& input': {
              color: (theme: Theme) => `${theme.palette.text.primary}`,
              textAlign: 'center',
              fontWeight: '500',
              // fontSize: '0.85rem',
            },
            marginTop: '0px',
            // fontWeight: '700',
            minWidth: 'unset',
          }}
          disabled={disabled}
          disableRipple={editing}
          component="div"
        >
          <>
          {coloredBackground}
          <Box
            sx={{
              zIndex: '1',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center'
            }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                rowGap: '1px',
                lineHeight: '1',
                marginTop: !isSelected ? '1px': undefined
              }}>
              {children}
              {indicator}
            </Box>
            {isProtected ? <DynamicIcon iconKey="Lock" style={{scale: '0.80', marginLeft: '2px', width: '22px', height : '22px'}} color="secondary" /> : <Box sx={{minHeight: '22px'}}/>}
          </Box>
          </>
        </Button>
      </RoundedTab>
    </Box>
    </ThemeProvider>
  );
}));

SheetTab.displayName = "SheetTab";