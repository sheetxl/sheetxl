import type React from 'react';

import { IconButton } from '@mui/material';

import {
  defaultRenderScrollButtonEdge as renderPlainScrollButtonEdge, ScrollbarOrientation, DynamicIcon, useTranslator,
  type ScrollButtonProps
} from '@sheetxl/utils-react';

import { SimpleTooltip } from '../components';

/**
 * The edge-scroll tooltip text.
 *
 * A component rather than a string, so the text re-renders on a language switch. Each of the four
 * variants is a WHOLE sentence — gluing a translated edge name onto a translated clause doesn't
 * work, because a fragment is not independently translatable.
 */
const ScrollEdgeTooltipTitle = ({ isHorizontal, isBefore }: { isHorizontal: boolean; isBefore: boolean }): React.ReactElement => {
  const t = useTranslator();
  // Literal keys at every branch — the extractor cannot see a computed one.
  if (isBefore) return <>{isHorizontal ? t('scroll.edgeLeft') : t('scroll.edgeTop')}</>;
  return <>{isHorizontal ? t('scroll.edgeRight') : t('scroll.edgeBottom')}</>;
};

export const defaultRenderScrollButtonEdge = (props: ScrollButtonProps): React.ReactNode => {
  const propsCustom = {
    style: {
      cursor: 'pointer'
    },
    ...props
  };
  let retValue = renderPlainScrollButtonEdge(propsCustom);
  if (props.isBefore !== undefined && !props.disabled) {
    const isHorizontal = props.orientation === ScrollbarOrientation.Horizontal;
    retValue = (
      <SimpleTooltip
        title={<ScrollEdgeTooltipTitle isHorizontal={isHorizontal} isBefore={props.isBefore} />}
        enterDelay={800}
        enterNextDelay={1600}
      >
        {props.disabled ? <div style={{display: 'flex'}}>{retValue}</div> : retValue}
      </SimpleTooltip>
    );
  }

  return retValue;
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

export const defaultRenderScrollButtonStart = (props: ScrollButtonProps): React.ReactNode => {
  return createScrollButton(
    props,
    (ScrollbarOrientation.Horizontal ? <DynamicIcon iconKey="ArrowLeft" size="small"/> : <DynamicIcon iconKey="ArrowUpward" size="small"/>),
    `Scroll ${props.orientation === ScrollbarOrientation.Horizontal ? 'Left' : 'Up'}`,
    `Scroll ${props.orientation === ScrollbarOrientation.Horizontal ? 'left' : 'up'}, 'Ctrl+Click' to scroll to the beginning`
  );
}

export const defaultRenderScrollButtonEnd = (props: ScrollButtonProps): React.ReactNode => {
  return createScrollButton(
    props,
    (ScrollbarOrientation.Horizontal ? <DynamicIcon iconKey="ArrowRight" size="small"/> : <DynamicIcon iconKey="ArrowDownward" size="small"/>),
    `Scroll ${props.orientation === ScrollbarOrientation.Horizontal ? 'Right' : 'Down'}`,
    `Scroll ${props.orientation === ScrollbarOrientation.Horizontal ? 'right' : 'down'}, 'Ctrl+Click' to scroll to the end`
  )
}