import React, {
  useRef, useEffect, memo, forwardRef, useState, useMemo
} from 'react';

import { mergeRefs } from 'react-merge-refs';

import { SxProps } from '@mui/system';
import { Theme } from '@mui/material/styles';

import { Typography } from '@mui/material';
import { Box, BoxProps } from '@mui/material';

import { ISheet } from '@sheetxl/sdk';

import { GridStyle } from '@sheetxl/grid-react';

import { useEditMode } from '@sheetxl/utils-react';
import { ExhibitDivider } from '@sheetxl/utils-mui';

import { SheetZoomScale } from './SheetZoomScale';

export interface StatusBarItem {
  /**
   * Use for identifying the item
   */
  key: string;

  createElement(props: BoxProps): React.ReactElement;

  /**
   * If not provided, we will create a default menu item
   * @param props
   */
  createMenuItem?(props: BoxProps): React.ReactElement;

  /**
   * Should we show a divider before this item
   */
  hasDivider?: boolean;
}

export interface StatusBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;
  /**
   * The Sheet.
   */
  // TODO - remove this dependency
  sheet?: ISheet;
  gridStyle?: GridStyle;
  childrenEnd?: React.ReactNode | undefined;

  ref?: React.Ref<StatusBarElement>;
}

export interface StatusBarAttributes {
  // No returns yet
}

export interface StatusBarElement extends HTMLDivElement, StatusBarAttributes {};

/**
 * This show the current cell state as an unstyled editable field.
 * This wraps this with material styling and submit and cancel buttons
 */
export const StatusBar = memo(
  forwardRef<StatusBarElement, StatusBarProps>((props, refForwarded) => {
  const {
    sx: propSx,
    sheet,
    gridStyle,
    children,
    childrenEnd,
    ...rest
  } = props;

  /* Expose some methods in ref */
  // useImperativeHandle(refForwarded, () => {
  //   return {
  //     isStatusBar: () => true
  //   };
  // });

  const refLocal = useRef<HTMLDivElement>(null);
  // Note - This isn't working because the Workbook is not returning a correct ref.
  // This should be at workbook standalone. Not here
  useEffect(() => {
    const handleWheel = (e: globalThis.WheelEvent) => e.preventDefault();
    refLocal.current?.addEventListener("wheel", handleWheel, {
       passive: false,
     });
    return () => {
      refLocal.current?.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const editModeHandler = useEditMode();
  const modeMessage = useMemo(() => {
    const mode = editModeHandler.getMode();
    if (mode?.description) {
      return mode.description;
    }
    // if (mode.key === 'point')
    //   return 'Point'; // selection
    return 'Ready';
  }, [editModeHandler]);

  // Hack work around because the sliderBar's tooltip interferes with dndDrag
  const [statusMouseOver, setStatusMouseOver] = useState(false);
  return (
    <Box
      className="statusBar"
      ref={mergeRefs([refLocal, refForwarded])}
      sx={{
        display: "flex",
        alignItems: "stretch",
        flexDirection: "row",
        flex: "0",
        paddingLeft: "12px",
        paddingRight: "12px",
        gap: '8px',
        paddingTop: '1px',
        minHeight: "calc(1em + 8px)",
        // background: sliderMouseOver ? 'red' : 'pink',
        overflow: statusMouseOver ? 'visible' : 'hidden',
        boxShadow: `0px -1px 0px ${(gridStyle.header.edgeStrokeFill)}`,
        zIndex: 1000, // To ensure box shadow is above item before it
        ...propSx
      }}
      onMouseOver={() => setStatusMouseOver(true)}
      onMouseLeave={() => setStatusMouseOver(false)}
      {...rest}
    >
      {children}
      <div
        style={{
          flex: "1 1 100%",
          display: 'flex',
          alignItems: 'end',
          overflow: 'hidden',
        }}
      >
        <Typography
          component="div"
          sx={{
            userSelect: 'none',
            whiteSpace: 'pre',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: (theme: Theme) => theme.palette.text.secondary,
          }}
          variant="caption"
        >
          {modeMessage}
        </Typography>
      </div>
      {/* TODO - Add a cell aggregation functions like Excel */}
      { childrenEnd ?
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {childrenEnd}
      </Box>
      : null }
      <ExhibitDivider style={{
          marginTop: '6px',
          marginBottom: '6px'
        }}
      />
      <SheetZoomScale
        sx={{
          paddingLeft: '4px', // to visually align with the right side
          minWidth: "175px"
        }}
        sheet={sheet}
      />
      {/* <Typography style={{flex: "0", whiteSpace: 'pre'}} variant="caption" component="div">Another Label</Typography>
      <div style={{minHeight: '3px', minWidth: '50px', background: 'red'}}></div> */}
    </Box>
    );
  })
);

StatusBar.displayName = "StatusBar";