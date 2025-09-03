import React from 'react';

import { ScrollbarOrientation } from './IScrollbar';

export interface ScrollButtonProps {
  style?: React.CSSProperties;
  orientation?: ScrollbarOrientation;
  disabled: boolean;
  onMouseUp: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
}

const defaultPadding = 3;

/**
 * Relies on external styling. Follows the styling of scrollbars pattern. @see  https://css-tricks.com/custom-scrollbars-in-webkit/
 * class of scrollbar-button, vertical or horizontal, end
 */
export const defaultCreateScrollStartButton = (props: ScrollButtonProps): React.ReactElement => {
  const {
    style,
    orientation=ScrollbarOrientation.Vertical,
    ...rest
  } = props;

  const isVertical = orientation === ScrollbarOrientation.Vertical;
  const path = isVertical ?
    `m 3.7274761,0.68060577 1.11969,1.93863003 1.12075,1.93912 c 0.0895,0.155 0.12152,0.33658 0.0904,0.51283 -0.0311,0.17625 -0.12336,0.33591 -0.26054,0.45091 -0.13715,0.11495 -0.31044,0.17793 -0.4894,0.17781 H 0.83095614 c -0.20186,0 -0.39542,-0.0802 -0.53814,-0.2229 -0.14272,-0.14272 -0.22291,-0.33629 -0.22291,-0.53814 -3e-4,-0.13308 0.0347,-0.26385 0.10147,-0.379 l 1.11872996,-1.94066 1.11921,-1.93864003 c 0.13594,-0.23541 0.38717,-0.38047 0.65905,-0.38047 0.27188,0 0.52311,0.14506 0.65905,0.38047 z`
  :
    `m 0.75051,2.3424298 1.93863,-1.11969 1.93912,-1.12075 c 0.155,-0.0895 0.33658,-0.12152 0.51283,-0.0904 0.17625,0.0311 0.33591,0.12336 0.45091,0.26054 0.11495,0.13715 0.17793,0.31044 0.17781,0.4894 v 4.47742 c 0,0.20186 -0.0802,0.39542 -0.2229,0.53814 -0.14272,0.14272 -0.33629,0.22291 -0.53814,0.22291 -0.13308,3e-4 -0.26385,-0.0347 -0.379,-0.10147 L 2.68911,4.7797998 0.75047,3.6605898 C 0.51506,3.5246498 0.37,3.2734198 0.37,3.0015398 c 0,-0.27188 0.14506,-0.52311 0.38047,-0.65905 z`

  return (
    <div
      style={{
        paddingBottom: '0px',
        paddingRight: '0px',
        paddingLeft: isVertical ? '0px' : `${defaultPadding}px`,
        paddingTop: !isVertical ? '0px' : `${defaultPadding}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
      {...rest}
    >
      <button
        style={{
          padding: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none'
      }}
        className={`scrollbar-button ${isVertical ? 'vertical' : 'horizontal'} single-button start`}
      >
        <svg width="9" height="9" viewBox="0 0 6 6"
          style={{
            opacity: 'inherit'
          }}
        >
          <path
            d={path}
          />
        </svg>
      </button>
    </div>
  )
}

/**
 * Relies on external styling. Follows the styling of scrollbars pattern. @see  https://css-tricks.com/custom-scrollbars-in-webkit/
 * class of scrollbar-button, vertical or horizontal, end
 */
export const defaultCreateScrollEndButton = (props: ScrollButtonProps): React.ReactElement => {
  const {
    style,
    orientation=ScrollbarOrientation.Vertical,
    ...rest
  } = props;

  const isVertical = orientation === ScrollbarOrientation.Vertical;

  const path = isVertical ?
  `M 2.412334,5.319396 1.292644,3.3807659 0.17189405,1.4416459 c -0.0895,-0.155 -0.12152,-0.33658 -0.0904,-0.51282998 0.0311,-0.17625 0.12336,-0.33591 0.26054,-0.45091 0.13715,-0.11495 0.31044,-0.17793 0.4894,-0.17781 H 5.308854 c 0.20186,0 0.39542,0.0802 0.53814,0.2229 0.14272,0.14272 0.22291,0.33629 0.22291,0.53813998 3e-4,0.13308 -0.0347,0.26385 -0.10147,0.379 l -1.11873,1.94066 -1.11921,1.9386401 c -0.13594,0.23541 -0.38717,0.38047 -0.65905,0.38047 -0.27188,0 -0.52311,-0.14506 -0.65905,-0.38047 z`
:
  `m 5.3893002,3.6575719 -1.9386301,1.11969 -1.93912,1.12075 c -0.155,0.0895 -0.33658,0.12152 -0.51282997,0.0904 -0.17625,-0.0311 -0.33591,-0.12336 -0.45091,-0.26054 -0.11495,-0.13715 -0.17793,-0.31044 -0.17781,-0.4894 V 0.76105195 c 0,-0.20186 0.0802,-0.39542 0.2229,-0.53814 C 0.73562013,0.08019195 0.92919013,1.9467784e-6 1.1310401,1.9467784e-6 1.2641201,-2.9805322e-4 1.3948901,0.03470195 1.5100401,0.10147195 l 1.94066,1.11872995 1.9386401,1.11921 c 0.23541,0.13594 0.38047,0.38717 0.38047,0.65905 0,0.27188 -0.14506,0.52311 -0.38047,0.65905 z`

  return (
  <div
    style={{
      paddingLeft: '0px',
      paddingTop: '0px',
      paddingRight: isVertical ? '0px' : `${defaultPadding}px`,
      paddingBottom: !isVertical ? '0px' : `${defaultPadding}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...style
    }}
    {...rest}
  >
    <button
      style={{
        padding: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none'
      }}
      className={`scrollbar-button ${isVertical ? 'vertical' : 'horizontal'} single-button end`}
    >
      <svg width="9" height="9" viewBox="0 0 6 6"
        style={{
          opacity: 'inherit'
        }}
      >
        <path
          d={path}
        />
      </svg>
    </button>
  </div>
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
          d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2"
          // fill={`${props.disabled ? 'grey' : 'inherit'}`}
        />
      </svg>
    </div>
  )
}