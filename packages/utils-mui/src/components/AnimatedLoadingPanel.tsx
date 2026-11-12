import type React from 'react';
import { useRef, useMemo, memo, forwardRef, useEffect } from 'react';

//import test from 'react/jsx-runtime'

import clsx from 'clsx';
import { alpha } from '@mui/system';
import { useMergeRefs } from 'react-merge-refs';

import { type Theme } from '@mui/material';
import { Paper } from '@mui/material';
import { Box, type BoxProps } from '@mui/material';
import { Typography } from '@mui/material';
import { LinearProgress } from '@mui/material';

import { useIsomorphicLayoutEffect, type LoadingPanelProps } from '@sheetxl/utils-react';

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



export interface AnimatedLoadingPanelProps extends LoadingPanelProps, Omit<BoxProps, 'label' | 'color' | 'ref' | 'children'> {

  icon?: React.ReactNode;

  label?: string | React.ReactNode;
  /**
   * Determinate progress as a fraction in `[0, 1]`. When a number, a determinate progress bar and
   * percentage are shown in place of the animated `icon`; when `null`/`undefined` the indeterminate
   * `icon` is shown.
   */
  progress?: number | null;
  /**
   * Wrap the icon and label in a paper panel.
   */
  panel?: boolean;
  /**
   * Begin the fade-in as soon as the panel mounts. @defaultValue `true` — mount it when work starts
   * and it shows itself; unmount it when the work ends.
   *
   * Pass `false` to keep the panel mounted but idle and drive it with {@link showLoadingPanel} /
   * {@link hideLoadingPanel}. Both modes obey the same rule — the fade must be COMMITTED before the
   * caller blocks the main thread — but a panel mounted at the moment work begins has never been
   * painted, so committing it costs a mount, a first paint of a full-screen layer, and the wait for
   * `transitionrun` below. An already-mounted panel is already painted: one frame and it is armed.
   */
  autoStart?: boolean;
}

const SHARED_ANIMATED_CIRCLE = <AnimatedCircleIcon/>;

/**
 * Arm a driven ({@link AnimatedLoadingPanelProps.autoStart} `false`) panel's fade-in, resolving once
 * the browser has COMMITTED it. Only then may the caller seize the main thread: a class change
 * reaches the compositor through a rendering frame, and a blocked thread never yields one, so
 * arm-and-go would animate nothing for exactly the work worth announcing.
 *
 * Whether anything is ever SEEN is the panel's `transition-delay` (1.2s by default), which is CSS
 * rather than a timer for the same reason — a `setTimeout` cannot fire while the thread is blocked,
 * so a JS-scheduled reveal would appear for every operation EXCEPT the long ones. Work that finishes
 * inside the delay disarms before a pixel changes.
 *
 * @param element The panel's root.
 * @param label Replaces the panel's text (for a panel rendered with a string or absent label). Set
 *              directly rather than through a render, which could not land before blocking work.
 * @returns A promise that settles once the fade is committed, or `null` when there is nothing to wait
 *          for — no element, or already armed (a second concurrent operation rides the first).
 */
export const showLoadingPanel = (
  element: HTMLElement | null | undefined,
  label?: string
): Promise<void> | null => {
  if (!element) return null;
  if (label !== undefined) {
    const labelElement = element.querySelector('[data-sxl-loading-label]');
    if (labelElement) labelElement.textContent = label;
  }
  if (element.classList.contains('animating')) return null; // already armed — free

  element.classList.remove('animating-idle'); // re-enable the transition
  // Force a reflow so the starting opacity is committed before the class changes it: with no resolved
  // starting value the browser coalesces both into one style and there is no transition to run at all
  // (the workaround the auto-start path reaches for, and the one react-transition-group uses). This is
  // the operation's only forced layout, and it happens BEFORE the work, while layout is still clean.
  void element.offsetHeight;
  element.classList.add('animating');

  // Wait for the fade to START, not merely to exist: an animation's `ready` settles once the
  // compositor is running it, and only then is blocking safe. The signals that look sooner are not:
  // - `transitionrun` fires when the transition is CREATED, which any style read after the class
  //   change does at once — before any frame. Work that blocks from there holds the fade back until
  //   it yields, and the panel appears at the end of the operation instead of during it.
  // - the task after the next frame's paint: that frame has committed the fade, but the compositor
  //   may not have started it, and blocking then still left the panel unseen.
  //
  // `getAnimations()` resolves style itself, so the transition exists by the time it answers; none
  // means there is no fade to wait for. Without Web Animations, two frames is the nearest stand-in.
  // A hidden page starts no animations; the timer keeps it from waiting on one that never starts.
  const animations = typeof element.getAnimations === 'function' ? element.getAnimations() : null;
  if (animations?.length === 0) return null;
  return new Promise<void>((resolve) => {
    const fallback = setTimeout(resolve, 250);
    const done = (): void => { clearTimeout(fallback); resolve(); };
    if (animations) {
      // A rejection is a cancelled fade (disarmed before it started): nothing left to wait for.
      Promise.all(animations.map((animation) => animation.ready)).then(done, done);
    } else {
      requestAnimationFrame(() => requestAnimationFrame(done));
    }
  });
};

/**
 * Disarm a driven panel — at once, and back to the state a fresh mount would be in. Both halves are
 * what an unmount gave the auto-start panel for free:
 * - **at once**: work that outlasted the reveal delay is on screen when it ends. Simply dropping the
 *   class would transition BACK through that delay, leaving the panel up for another second after its
 *   operation finished; parking it in `animating-idle` (no transition) snaps it away instead.
 * - **fresh**: the next operation gets its own countdown. Without that, back-to-back operations
 *   inherit an elapsed delay and the panel appears instantly on work that should have been silent.
 *
 * Costs no forced layout, so it is safe in the same task the work ended in — which it must be:
 * anything that lets a frame paint first shows the panel after its operation.
 */
export const hideLoadingPanel = (element: HTMLElement | null | undefined): void => {
  if (!element) return;
  if (!element.classList.contains('animating')) return;
  element.classList.add('animating-idle');
  element.classList.remove('animating');
};

export const AnimatedLoadingPanel = memo(forwardRef<HTMLDivElement, AnimatedLoadingPanelProps>((props: AnimatedLoadingPanelProps, refForwarded) => {
  const {
    sx: propSx,
    style: propStyle,
    onMount,
    onUnmount,
    transitionDelay = '1200ms',
    panel = false,
    autoStart = true,
    transparentBackground = true,
    icon = SHARED_ANIMATED_CIRCLE,
    label,
    progress = null,
    ...rest
  } = props;

  const labelWrapped = useMemo(() => {
    // A driven panel keeps its (possibly empty) label node mounted: the text is written into it at
    // arm time, since a render cannot land ahead of blocking work. Auto panels are unchanged.
    if (typeof label === 'string' || (!autoStart && (label === null || label === undefined))) {
      return (
        <Typography
          data-sxl-loading-label=""
          variant="caption"
          component="div"
          sx={{
            fontSize: '0.875rem',
            lineHeight: 1.43,
            letterSpacing: '0.01071em'
          }}
        >
          {typeof label === 'string' ? label : ''}
        </Typography>
      );
    }
    return label;
  }, [label, autoStart]);

  // When a determinate `progress` fraction is supplied, show a progress bar in place of the
  // indeterminate animated icon. We deliberately omit a numeric percentage: a digit sprinting 1% at a
  // time reads as busier (and less polished) than a single smoothly gliding bar. `color="inherit"` so
  // it follows the panel's contrast color.
  const indicator = useMemo(() => {
    if (typeof progress !== 'number') return icon;
    const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
    // At 100% the producer's I/O is done but work may continue (e.g. a synchronous model build that
    // blocks the main thread). Pulse the full bar to signal "still working" — opacity is a pure
    // compositor animation, so it keeps breathing even while JS is busy, no spinner swap needed.
    const isComplete = percent >= 100;
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          width: '180px'
        }}
      >
        <LinearProgress
          variant="determinate"
          value={percent}
          color="inherit"
          sx={{
            width: '100%',
            borderRadius: '2px',
            // Keyframes co-located with the rule that references them so emotion keeps the name in
            // scope (defining them on a different element's style block silently breaks the link).
            '@keyframes sxlProgressPulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.25 }
            },
            '& .MuiLinearProgress-bar': {
              // Glide between the coarse (~5%) value steps instead of jumping, so the bar trails the
              // true value slightly and reads as continuous motion. Linear matches the steady fill.
              transition: 'transform 0.5s linear',
              // Once full, breathe to show ongoing work. `will-change: opacity` promotes the bar to its
              // own compositor layer so the animation keeps running even while the main thread is
              // blocked by the synchronous model build (without it, opacity animates on the main thread
              // and freezes during the block — exactly when we need it moving).
              ...(isComplete && {
                willChange: 'opacity',
                animation: 'sxlProgressPulse 1s ease-in-out infinite'
              })
            }
          }}
        />
      </Box>
    );
  }, [progress, icon]);

  const refLocal = useRef<HTMLDivElement>(null);
  const refMerged = useMergeRefs([refLocal, refForwarded]);
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
        {indicator}
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
        {...rest}
        ref={refMerged as React.RefObject<HTMLDivElement>}
        className="animatable"
        sx={{
          cursor: 'wait',
          boxSizing: 'border-box',
          alignItems: 'center',
          justifyContent: 'center',
          display: 'flex',
          flexDirection: 'column',
          willChange: 'opacity',
          // Idle (mounted, not armed): hold every animation still. A driven panel sits in the tree
          // for the life of the app and an invisible spinner should not cost frames.
          '&:not(.animating) *': {
            animationPlayState: 'paused'
          },
          opacity: transparentBackground ? 0.001 : 1,
          transitionProperty: 'opacity',
          transitionDelay,
          transitionDuration: '320ms',
          transitionTimingFunction: 'ease-in',
          overflow: 'hidden',
          outline: 'none',
          width: '100%',
          height: '100%',
          minWidth: 0,
          minHeight: 0,
          zIndex: 99999, // should be on top of everything
          '&.animating': {
            opacity: 1
          },
          // Driven panels rest here between operations: no transition, so dropping `animating` snaps
          // back instead of reverse-fading through the entry delay, and the NEXT arm starts a fresh
          // countdown rather than inheriting an elapsed one. (Both are what unmounting used to give
          // the auto-start panel for free.)
          '&.animating-idle': {
            transition: 'none'
          },
          '&.animating-exit': {
            opacity: 0,
            transition: 'opacity 210ms'
          },
          ...propSx,
          ...propStyle as unknown as any
        }}
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
  }, [propSx, panel, labelWrapped, indicator, refMerged]); // visible

  const isMounted = useRef(false);

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

    The forced reflow is the load-bearing part: a panel that mounts and gains `animating` in the same
    commit has no resolved starting opacity, so the browser coalesces both into one style, no
    transition runs, and the panel appears AT ONCE — losing the anti-flicker delay entirely.
    @see https://github.com/reactjs/react-transition-group/blob/5007303e729a74be66a21c3e2205e4916821524b/src/CSSTransition.js#L208

    Knowing exactly WHEN the fade began used to matter too, and cost a `transitionrun` listener plus a
    timeout for the times it did not fire. Nothing needs that now: the caller that had to hold off
    blocking the thread until the fade was committed drives the panel through `showLoadingPanel`
    instead, which is mounted ahead of time and reports back by promise.
  */
  useIsomorphicLayoutEffect(() => {
    if (autoStart === false) return; // driven by showLoadingPanel / hideLoadingPanel
    const element = refLocal.current;
    if (!element || isMounted.current) return;
    isMounted.current = true;

    if (element.classList.contains('animatable') && !element.classList.contains('animating')) {
      void element.offsetHeight; // resolve the starting opacity, or there is no transition to run
      element.classList.add('animating');
    }
    onMount?.();
  }, [refLocal.current, autoStart]);

  useEffect(() => {
    return () => {
      if (isMounted.current) {
        // console.log('--- unmount', refLocal.current?.classList);
        refLocal.current?.classList.remove('animating');
        isMounted.current = false;
        onUnmount?.();
      }
    }
  }, []);


  return retValue;
}));

AnimatedLoadingPanel.displayName = 'AnimatedLoadingPanel';