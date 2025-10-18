import React from 'react';

import clsx from 'clsx';

import { ScrollbarOrientation } from './IScrollbar';

import styles from './Scrollbar.module.css';

export interface ScrollButtonProps extends React.HTMLAttributes<any> {
  // style?: React.CSSProperties;
  orientation?: ScrollbarOrientation;
  disabled?: boolean;

  onMouseUp: (e: React.MouseEvent<any>) => void;
  onMouseLeave: (e: React.MouseEvent<any>) => void;
  onMouseDown: (e: React.MouseEvent<any>) => void;
  onClick?: (e: React.MouseEvent<any>) => void;

  ref?: React.Ref<any>;
}

// TODO - make dynamic icons with viewport of 0 0 9 9
const vertPath = `M 5.4951012,0.62494002 7.1746358,3.4734472 8.8557603,6.3226744 c 0.13425,0.2277477 0.18228,0.4945506 0.1356,0.7535218 -0.04665,0.2589712 -0.18504,0.4935661 -0.3908099,0.6625402 C 8.3948254,7.9076371 8.1348905,8.0001761 7.8664506,7.9999997 H 1.1503225 c -0.30278993,0 -0.59312985,-0.117841 -0.80720983,-0.3275159 -0.2140799,-0.2097042 -0.3343649,-0.4941244 -0.3343649,-0.7907107 -4.5e-4,-0.1955399 0.05205,-0.3876855 0.152205,-0.55688 L 1.8390472,3.4734031 3.5178618,0.62488125 C 3.7217717,0.27898385 4.0986166,0.0658413 4.5064365,0.0658413 c 0.4078199,0 0.7846648,0.21314255 0.9885747,0.55903995 z`;
const horzPath = `M 0.6632643,3.5136438 3.5117715,1.8341092 6.3609987,0.15298466 c 0.2277477,-0.13425 0.4945506,-0.18228 0.7535218,-0.1356 0.2589712,0.04665 0.4935661,0.18504 0.6625402,0.3908099 0.1689007,0.205725 0.2614397,0.4656599 0.2612633,0.73409984 v 6.7161281 c 0,0.3027899 -0.117841,0.5931298 -0.3275159,0.8072098 -0.2097042,0.2140799 -0.4941244,0.3343649 -0.7907107,0.3343649 -0.1955399,4.5e-4 -0.3876855,-0.05205 -0.55688,-0.152205 L 3.5117274,7.1696978 0.6632056,5.4908832 C 0.31730817,5.2869733 0.10416562,4.9101284 0.10416562,4.5023085 c 0,-0.4078199 0.21314255,-0.7846648 0.55903998,-0.9885747 z`;
const edgePath = `M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2`;

const endStyle: React.CSSProperties = {
  transform: 'rotate(180deg)'
}

/**
 * Relies on external styling. Follows the styling of scrollbars pattern. @see  https://css-tricks.com/custom-scrollbars-in-webkit/
 * class of scrollbar-button, vertical or horizontal, end
 */
export const defaultCreateScrollStartButton = (props: ScrollButtonProps): React.ReactElement => {
  const {
    style: propStyle,
    orientation=ScrollbarOrientation.Vertical,
    disabled: propDisabled,
    ...rest
  } = props;

  const isVertical = orientation === ScrollbarOrientation.Vertical;
  const path = isVertical ? vertPath : horzPath;

  return (
    <button
      style={propStyle}
      className={clsx(styles['scrollbar-button'], orientation, 'scroll-button')}
      disabled={propDisabled}
      {...rest}
    >
      <svg
        width="9"
        height="9"
        viewBox="0 0 9 9"
      >
        <path d={path} />
      </svg>
    </button>
  )
}

/**
 * Relies on external styling. Follows the styling of scrollbars pattern.
 * @see  https://css-tricks.com/custom-scrollbars-in-webkit/
 * class of scrollbar-button, vertical or horizontal, end
 */
export const defaultCreateScrollEndButton = (props: ScrollButtonProps): React.ReactElement => {
  const {
    style: propStyle,
    orientation=ScrollbarOrientation.Vertical,
    disabled: propDisabled,
    ...rest
  } = props;

  const isVertical = orientation === ScrollbarOrientation.Vertical;
  const path = isVertical ? vertPath : horzPath;

  return (
    <button
      style={propStyle}
      className={clsx(styles['scrollbar-button'], orientation, 'scroll-button')}
      disabled={propDisabled}
      {...rest}
    >
      <svg
        width="9"
        height="9"
        viewBox="0 0 9 9"
        style={endStyle}
      >
        <path d={path} />
      </svg>
    </button>
  )
}

/**
 * TODO - implement styling support similar to other scroll buttons. Currently hardcoded
 */
export const defaultCreateScrollEdgeButton = (props: ScrollButtonProps): React.ReactElement => {
  const {
    style,
    orientation=ScrollbarOrientation.Vertical,
    ...rest
  } = props;
  const isVertical = orientation === ScrollbarOrientation.Vertical;
  const transform = `${isVertical ? 'rotate(90) ' : ''}`;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'end',
        transition: 'fill-opacity 1s',
        zIndex: 1,
        width: '24px',
        height: '24px',
        ...style
        //boxShadow: -6px 0px 2px -1px rgb(0 0 0 / 10%)
      }}
      className={`scrollbar-button ${isVertical ? 'vertical' : 'horizontal'} edge`}
      {...rest}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" transform={transform}>
        <path
          style={{
            transition: 'opacity 240ms ease 0s',
            opacity:props.disabled ? 0 : 1
          }}
          d={edgePath}
          // fill={`${props.disabled ? 'grey' : 'inherit'}`}
        />
      </svg>
    </div>
  )
}