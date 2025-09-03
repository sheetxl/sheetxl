import React, { CSSProperties, useEffect, useMemo } from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

import { useId } from '@sheetxl/utils-react';

export interface WalkingCopyIconProps extends SvgIconProps {
  /**
   * @defaultValue false
   */
  isWalking?: boolean;

  /**
   * @defaultValue "info"
   */
  themedType?: string;
}

export const WalkingCopyIcon = (
    props: WalkingCopyIconProps
  ) => {
  const {
    isWalking = false,
    themedType = "info",
    ...rest
  } = props;

  const id = useId().replaceAll(':', '');
  const animationName = "copy-walking-offset-" + id;

  useEffect(() => {
    if (!isWalking)
      return;

    const rule = `
    @keyframes ${animationName} {
      to {
        stroke-dashoffset: 0px;
      }
    }`;

    const styleEl  = document.createElement("style");
    // WebKit hack
    styleEl.appendChild(document.createTextNode(rule));
    document.head.appendChild(styleEl);
    const styleSheet = styleEl.sheet;
    styleSheet.insertRule(rule, 0);

    return () => {
      document.head.removeChild(styleEl);
    }
  }, [isWalking]);

  let animationProps:CSSProperties = useMemo(() => {
    if (!isWalking)
      return;
    const speed = 120;
    const dashGap = 2;
    const dashLength = 5;
    const totalLength = dashGap + dashLength;
    const totalSpeed = speed * totalLength;

    return {
      strokeDasharray: `${dashLength}px ${dashGap}px`,
      strokeDashoffset: `${totalLength}px`,
      animation: `${animationName} ${totalSpeed}ms linear infinite`,
      willChange: `stroke-dashoffset`
    }
  }, [isWalking]);

  return (
    <SvgIcon {...rest}>
      <g>
        <path
          d="M 16,1 H 4 C 2.9,1 2,1.9 2,3 V 17 H 4 V 3 h 12 z"
        />
        {/* <path
          className="info"
          d="M 19,5 H 8 C 6.9,5 6,5.9 6,7 v 14 c 0,1.1 0.9,2 2,2 h 11 c 1.1,0 2,-0.9 2,-2 V 7 C 21,5.9 20.1,5 19,5 Z m 0,16 H 8 V 7 h 11 z"
        /> */}
        <rect x="7" y="6" width="13" height="16" rx="1.5"
          className={`styled ${themedType} stroked`}
          style= {{
            fill: 'none',
            // stroke: `var(--sxl-app-color-${themedType}, currentColor)`,
            strokeWidth: '2px',
            vectorEffect: 'non-scaling-stroke',
            ...animationProps
          }}
        />
      </g>
    </SvgIcon>
  );
}

export default WalkingCopyIcon;