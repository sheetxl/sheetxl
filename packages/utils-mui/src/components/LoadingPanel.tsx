import React, { useRef, useMemo, memo, forwardRef, useEffect } from 'react';

//import test from 'react/jsx-runtime'

import clsx from 'clsx';
import { alpha } from '@mui/system';
import { mergeRefs } from 'react-merge-refs';
import { useIsomorphicLayoutEffect } from 'react-use';

// import { SxProps } from '@mui/system';
import { Theme } from '@mui/material/styles';

import { Paper } from '@mui/material';
import { Box, BoxProps } from '@mui/material';
import { Typography } from '@mui/material';

import styles from './Loading.module.css';

export interface AnimatedIconProps extends BoxProps {
  speed?: number;
  size?: number;
}

/**
 * These super animated icons are from https://codepen.io/nikhil8krishnan. MIT attribution. Thank you Nikhil Krishnan
 *
 * Note - Currently svg animations do not animate if the main thread is blocked.
 * https://codepen.io/mtf2000/pen/oNPwzap
 */
export const AnimatedClockIcon: React.FC<AnimatedIconProps> = memo((props) => {
  const {
    sx: propSx,
    speed=2,
    size=70,
    ...rest
  } = props;

  return (
    <Box
      sx={{
        width: `${size}px`,
        height: `${size}px`,
        zIndex: 1,
        '& .primary': {
          stroke: (theme: Theme) => {
            return theme.palette.grey[600];
          },
          fill: 'none'
        },
        ...propSx
      }}
    {...rest}
    >
      <svg x="0px" y="0px" viewBox="0 0 100 100">
        <circle className="primary" strokeWidth="4" cx="50" cy="50" r="48"></circle>
        <line className="primary" strokeLinecap="round" strokeWidth="4" x1="50" y1="50" x2="85" y2="50.5">
          <animateTransform attributeName="transform" dur={`${speed}s`} type="rotate" from="0 50 50" to="360 50 50" repeatCount="indefinite"></animateTransform>
        </line>
        <line className="primary" strokeLinecap="round" strokeWidth="4"x1="50" y1="50" x2="49.5" y2="74">
          <animateTransform attributeName="transform" dur={`${speed * 7.5}s`} type="rotate" from="0 50 50" to="360 50 50" repeatCount="indefinite"></animateTransform>
        </line>
      </svg>
    </Box>
  );
});

export const AnimatedCircleIcon: React.FC<AnimatedIconProps> = memo((props) => {
  const {
    sx: propSx,
    speed=1.5,
    size=70,
    ...rest
  } = props;

  return (
    <Box
      sx={{
        width: `${size}px`,
        height: `${size}px`,
        zIndex: 1,
        '& .primary': {
          fill: (theme: Theme) => {
            return theme.palette.grey[600];
          }
        },
        '& .secondary': {
          stroke: (theme: Theme) => {
            return theme.palette.grey[600];
          },
          fill: 'none',
          opacity: 0.5
        },
        ...propSx
      }}
    {...rest}
    >
    <svg x="0px" y="0px" viewBox="0 0 100 100">
      <circle className="secondary" strokeWidth="4" cx="50" cy="50" r="21"></circle>
      <path className="primary" d="M73,50c0-12.7-10.3-23-23-23S27,37.3,27,50 M30.9,50c0-10.5,8.5-19.1,19.1-19.1S69.1,39.5,69.1,50">
        <animateTransform attributeName="transform" type="rotate" dur={`${speed * 1}s`} from="0 50 50" to="360 50 50" repeatCount="indefinite"></animateTransform>
      </path>
    </svg>
    </Box>
  );
});

export const AnimatedFadingEllipsisIcon: React.FC<AnimatedIconProps> = memo((props) => {
  const {
    sx: propSx,
    speed=1,
    size=70,
    ...rest
  } = props;

  return (
    <Box
      sx={{
        width: `${size}px`,
        height: `${size}px`,
        zIndex: 1,
        // '& .primary': {
        //   fill: (theme: Theme) => {
        //     return theme.palette.grey[600];
        //   },
        //   stroke: "none"
        // },
        ...propSx
      }}
    {...rest}
    >
      <svg x="0px" y="0px" viewBox="0 0 100 100">
        <circle className="primary" cx="6" cy="50" r="6">
          <animate attributeName="opacity" dur={`${speed}s`} values="0;1;0" repeatCount="indefinite" begin="0.1"></animate>
        </circle>
        <circle className="primary" cx="26" cy="50" r="6">
          <animate attributeName="opacity" dur={`${speed}s`} values="0;1;0" repeatCount="indefinite" begin="0.2"></animate>
        </circle>
        <circle className="primary" cx="46" cy="50" r="6">
          <animate attributeName="opacity" dur={`${speed}s`} values="0;1;0" repeatCount="indefinite" begin="0.3"></animate>
        </circle>
      </svg>
    </Box>
  );
});

export const AnimatedBouncingEllipsisIcon: React.FC<AnimatedIconProps> = memo((props) => {
  const {
    sx: propSx,
    speed=1,
    size=70,
    ...rest
  } = props;

  return (
    <Box
      sx={{
        width: `${size}px`,
        height: `${size}px`,
        zIndex: 1,
        '& .primary': {
          fill: (theme: Theme) => {
            return theme.palette.grey[600];
          },
          stroke: "none"
        },
        ...propSx
      }}
    {...rest}
    >
      <svg x="0px" y="0px" viewBox="0 0 100 100">
        <circle className="primary" cx="6" cy="50" r="6">
          <animateTransform attributeName="transform" dur={`${speed}s`} type="translate" values="0 15 ; 0 -15; 0 15" repeatCount="indefinite" begin="0.1"></animateTransform>
        </circle>
        <circle className="primary" cx="30" cy="50" r="6">
          <animateTransform attributeName="transform" dur={`${speed}s`} type="translate" values="0 10 ; 0 -10; 0 10" repeatCount="indefinite" begin="0.2"></animateTransform>
        </circle>
        <circle className="primary" cx="54" cy="50" r="6">
          <animateTransform attributeName="transform" dur={`${speed}s`} type="translate" values="0 5 ; 0 -5; 0 5" repeatCount="indefinite" begin="0.3"></animateTransform>
        </circle>
      </svg>
    </Box>
  );
});

export const AnimatedOrbitIcon: React.FC<AnimatedIconProps> = memo((props) => {
  const {
    sx: propSx,
    speed=2,
    size=70,
    ...rest
  } = props;

  return (
    <Box
      sx={{
        width: `${size}px`,
        height: `${size}px`,
        zIndex: 1,
        '& .primary': {
          stroke: (theme: Theme) => {
            return theme.palette.grey[600];
          },
          opacity: 0.5,
          fill: "none"
        },
        '& .secondary': {
          fillOpacity: (theme: Theme) => {
            return theme.palette.grey[600];
          },
          opacity: 0.8,
          stroke: (theme: Theme) => {
            // Note - This is mimicking transparent by being the same color as the background.
            // If we decide to use this the better way is to create a 'cutout circle and rotate it.
            return theme.palette.background.paper;
          }
        },
        ...propSx
      }}
    {...rest}
    >
      <svg x="0px" y="0px" viewBox="0 0 100 100">
        <circle className="primary" strokeWidth="4" cx="50" cy="50" r="44"></circle>
        <circle className="secondary" strokeWidth="3" cx="8" cy="54" r="6">
          <animateTransform attributeName="transform" dur={`${speed}s`} type="rotate" from="0 50 48" to="360 50 52" repeatCount="indefinite"></animateTransform>
        </circle>
      </svg>
    </Box>
  );
});

export interface AnimatedTraversingEllipsisIconProps extends BoxProps {
  speed?: number;
  size?: number;
  width?: number;
  height?: number;
}

/**
 * This is the only AnimatedIcon that works with a blocking ui.
 * Note - currently this has a hardcoded bounds of 61x13
 */
export const AnimatedTraversingEllipsisIcon: React.FC<AnimatedTraversingEllipsisIconProps> = memo((props) => {
  const {
    sx: propSx,
    speed:_speed=1, // TODO - allow this to be configurable
    size=13,
    width=64, //
    height=17, // 13 + 2 + 2
    ...rest
  } = props;

  // TODO - make circles completely dynamic based on width and height?

  const padding = (height - size) / 2;
  return (
    <Box
      sx={{
        width: `${width}px`,
        height: `${height}px`,
        '& .primary': {
          backgroundColor: (theme: Theme) => {
            return theme.palette.grey[600];
          },
          top: `${padding}px`,
          width: () => {
            return `${size}px`;
          },
          height: () => {
            return `${size}px`;
          },
        },
        ...propSx
      }}
      className={clsx(styles['traverse-ellipsis'], 'animated-icon')}
      {...rest}
    >
      <div className="primary"></div>
      <div className="primary"></div>
      <div className="primary"></div>
      <div className="primary"></div>
    </Box>
  );
});

export interface LoadingPanelProps extends BoxProps {
  icon?: React.ReactNode;

  label?: string | React.ReactNode;
  /**
   * Wrap the icon and label in a paper panel.
   */
  panel?: boolean;
  transitionDelay?: string;
  transparentBackground?: boolean;

  onMount?: () => void;
  onUnmount?: () => void;
}

const SHARED_ANIMATED_CIRCLE = <AnimatedCircleIcon/>;

const LoadingPanel: React.FC<LoadingPanelProps & { ref?: any }> = memo(
  forwardRef<any, LoadingPanelProps>((props, refForwarded) => {
  const {
    sx: propSx,
    style: propStyle,
    onMount,
    onUnmount,
    transitionDelay = '1200ms',
    panel = false,
    transparentBackground = true,
    icon = SHARED_ANIMATED_CIRCLE,
    label,
    ...rest
  } = props;

  const labelWrapped = useMemo(() => {
    if (typeof label === 'string') {
      return (
        <Typography
          variant="caption"
          component="div"
          sx={{
            fontSize: '0.875rem',
            lineHeight: 1.43,
            letterSpacing: '0.01071em'
          }}
        >
          {label}
        </Typography>
      );
    }
    return label;
  }, [label]);

  const localRef = useRef<HTMLDivElement>(null);
  const retValue = useMemo(() => {
    let content = (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          rowGap: '8px'
        }}
      >
        {labelWrapped}
        {icon}
      </Box>
    );
    if (panel === true) {
      content = (
        <Paper
          elevation={0}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            alignSelf: 'center',
            marginBottom: '5%',
            backgroundColor:  (theme: Theme) => {
              return theme.palette.info.light; // '#2196f3'; // nice blue
            },
            color:  (theme: Theme) => {
              return theme.palette.info.contrastText; // '#fff'; // white
            },
            paddingLeft: (theme: Theme) => theme.spacing(2),
            paddingRight: (theme: Theme) => theme.spacing(2),
            paddingTop: (theme: Theme) => theme.spacing(2),
            paddingBottom: (theme: Theme) => theme.spacing(1),
            rowGap: (theme: Theme) => theme.spacing(1),
            borderRadius: (theme: Theme) => {
              return `${theme.shape.borderRadius}px`;
            },
            boxShadow: (theme: Theme) => {
              return theme.shadows[2];
            },
            '& .primary': {
              background: (theme: Theme) => {
                return `${alpha(theme.palette.info.contrastText, 0.9)} !important`; // '#fff'; // white
              },
              boxShadow: (theme: Theme) => `0 0 0 1px ${theme.palette.mode === 'dark' ? theme.palette.text.secondary : theme.palette.divider}`,
              boxSizing: 'content-box',
              border: 'solid transparent',
            },
            zIndex: 1
          }}
        >
          {content}
        </Paper>
      );
    }

    return (
      <Box
        ref={mergeRefs([localRef, refForwarded]) as React.RefObject<HTMLDivElement>}
        className="animatable"
        sx={{
          cursor: 'wait',
          boxSizing: 'border-box',
          alignItems: 'center',
          justifyContent: 'center',
          display: 'flex',
          flexDirection: 'column',
          willChange: 'opacity',
          opacity: transparentBackground ? 0.001 : 1,
          transitionProperty: 'opacity',
          transitionDelay,
          transitionDuration: '320ms',
          transitionTimingFunction: 'ease-in',
          overflow: 'hidden',
          outline: 'none',
          width: '100%',
          height: '100%',
          zIndex: 99999, // should be on top of everything
          '&.animating': {
            opacity: 1
          },
          '&.animating-exit': {
            opacity: 0,
            transition: 'opacity 210ms'
          },
          ...propSx,
          ...propStyle as unknown as any
        }}
        {...rest}
      >
        <Box className="center"
          sx={{
            display: 'flex',
            flex: '1 1 100%',
            height: '100%',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          <Box
            className="backdrop"
            sx={{
              opacity: (theme: Theme)=> {
                return transparentBackground ? theme.palette.action.disabledOpacity * 1.5 : undefined;
              },
              background: (theme: Theme)=> {
                return transparentBackground? undefined : theme.palette.background.paper
              },
              backdropFilter: `blur(4px)`,
              borderRadius: (theme: Theme) => {
                return `${theme.shape.borderRadius}px`;
              },
              zIndex: -1, // shouldn't be required but is.
              position: 'absolute',
              width: '100%',
              height: '100%',
              boxSizing: 'border-box'
            }}
          >
          </Box>
          {content}
        </Box>
      </Box>
    );
  }, [propSx, panel]); // visible, , refForwarded

  const isMounted = useRef(false);
  const isMounting = useRef(false);

  /*
    Note - To create a nice loading panel we had to consider a few things.
    1. Block is probably going to block the ui thread.
    2. Delay start (for short blocks we don't want the screen to flicker)
    3. Fade in. (to avoid flicker)
    4. Animated CSS
    5. Quicker fade out (TODO)
    To accomplish this we had to take advantage the face that css opacity and transform (but not layout) can
    will done on the compositor thread instead of the the ui thread.
    We have to make sure though that we have started the transition before we return the the blocking ui thread.


    Note - There is a hack/bug workaround in implementation due to transitionrun even not firing reliably.

    Note - adding a forcereflow may fix this.
    @see https://github.com/reactjs/react-transition-group/blob/5007303e729a74be66a21c3e2205e4916821524b/src/CSSTransition.js#L208
  */
  useIsomorphicLayoutEffect(() => {
    if (!localRef.current || isMounted.current || isMounting.current) return;
    isMounting.current = true;

    if (localRef.current.classList.contains('animatable') && !localRef.current.classList.contains('animating')) {
      // console.log('add listener', localRef.current?.classList);
      let listenerCalled = false;
      const started = () => {
        // console.log('started', localRef.current?.classList);
        if (isMounting.current) { // double check as could have been remove during wait
          isMounted.current = true;
          isMounting.current = false;
          listenerCalled = true;
          // console.log('--- mount');
            onMount?.();
        }
      };
      if (localRef.current)
      localRef.current.addEventListener("transitionrun", started, { once: true, capture: true, passive: true });
      // localRef.current.addEventListener("transitioncancel", (event) => {
      //   console.log("Transition canceled", event, localRef.current);
      // }, { once: true, capture: true, passive: true });
      // localRef.current.addEventListener("transitionstarted", (event) => {
      //   console.log("transitionstarted", event, localRef.current);
      // }, { once: true, capture: true, passive: true });
      // localRef.current.addEventListener("transitionend", (event) => {
      //   console.log("transitionend", event, localRef.current);
      // }, { once: true, capture: true, passive: true });
      // HACK WORKAROUND - Through observation and testing it seems that the transitionrun event is not always fired. Not sure why
      if (isMounting.current && localRef.current) {
        // setTimeout(() => {
          // console.log('set animating', localRef.current?.classList, localRef.current.style.transition);
          // HACK WORKAROUND -
          // Through observation and testing it seems that the transitionrun event is not fired if set immediately after listener.
          // We noticed that if we explicity force the opacity to resolve then the transitionrun event is fired (but we have a timeout backup)
          const opacity = window.getComputedStyle(localRef.current, null).opacity;
          if (opacity !== '0.001') {
            // There is a 'race condition.
            // The transitionrun event is not fired if set immediately after listener.
            // It seems to be in chrome but it could be in react or even emotion styles.
            // reset opacity. This should never occur but is so perhaps we should put back
            // console.warn('opacity is not 0.001');
          }
          localRef.current.classList.add('animating');
        // }, 10);
      }
      setTimeout(() => {
        if (!listenerCalled && isMounting.current && localRef.current) {
          // console.log('timeout', window.getComputedStyle(localRef.current, null).opacity, window.getComputedStyle(localRef.current, null).transition);
          localRef.current?.removeEventListener("transitionrun", started);
          started();
        }
      }, 100);
    } else {
      isMounted.current = true;
      isMounting.current = false;
      onMount?.();
    }
    return () => {
      // console.log('--- unmount1', localRef.current?.classList);
    }
  }, [localRef.current]);

  useEffect(() => {
    return () => {
      if (isMounted.current) {
        // console.log('--- unmount', localRef.current?.classList);
        localRef.current?.classList.remove('animating');
        isMounted.current = false;
        isMounting.current = false;
        onUnmount?.();
      }
    }
  }, []);


  return retValue;
}));

LoadingPanel.displayName = 'LoadingPanel';
export { LoadingPanel };