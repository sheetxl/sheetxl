import React from 'react';

import { IconButton } from '@mui/material';

import { ArrowLeft as ArrowLeftIcon } from '@mui/icons-material';
import { ArrowUpward as ArrowUpwardIcon } from '@mui/icons-material';
import { ArrowRight as ArrowRightIcon } from '@mui/icons-material';
import { ArrowDownward as ArrowDownwardIcon } from '@mui/icons-material';

import {
  defaultCreateScrollEdgeButton, ScrollbarOrientation, ScrollButtonProps
} from '@sheetxl/utils-react';

import { SimpleTooltip } from '../components';

export const createScrollEdgeButton = (props: ScrollButtonProps) => {
  const propsCustom = {
    style: {
      cursor: 'pointer'
    },
    ...props
  };
  return defaultCreateScrollEdgeButton(propsCustom)
}

export const createScrollButton = (props: ScrollButtonProps, icon: React.ReactElement, title: string, description: string) => {
  // Would like to use the theme for this but we don't have it at the moment } (theme.transitions.duration.standard as number) * 2
  const {
    style: propStyle,
    ...rest
  } = props;
  const iconButton = (
    <IconButton
      component="div"
      {...rest}
      style={{
        ...propStyle,
        padding: '0px'
      }}
      sx={{
        padding: '0'
      }}
      color={props.disabled ? undefined : "primary"}
      aria-label={title}
      size="small"
    >
      {icon}
    </IconButton>
  );

  return (
    <SimpleTooltip
      title={props.disabled ? title : description}
      enterDelay={800}
      enterNextDelay={1600}
    >
      {props.disabled ? <div style={{display: 'flex'}}>{iconButton}</div> : iconButton}
    </SimpleTooltip>
  )
}

export const createScrollStartButton = (props: ScrollButtonProps) => {
  return createScrollButton(
    props,
    (ScrollbarOrientation.Horizontal ? <ArrowLeftIcon fontSize="small"/> : <ArrowUpwardIcon fontSize="small"/>),
    `Scroll ${props.orientation === ScrollbarOrientation.Horizontal ? 'Left' : 'Up'}`,
    `Scroll ${props.orientation === ScrollbarOrientation.Horizontal ? 'left' : 'up'}, 'Ctrl+Click' to scroll to the beginning`
  );
}

export const createScrollEndButton = (props: ScrollButtonProps) => {
  return createScrollButton(
    props,
    (ScrollbarOrientation.Horizontal ? <ArrowRightIcon fontSize="small"/> : <ArrowDownwardIcon fontSize="small"/>),
    `Scroll ${props.orientation === ScrollbarOrientation.Horizontal ? 'Right' : 'Down'}`,
    `Scroll ${props.orientation === ScrollbarOrientation.Horizontal ? 'right' : 'down'}, 'Ctrl+Click' to scroll to the end`
  )
}