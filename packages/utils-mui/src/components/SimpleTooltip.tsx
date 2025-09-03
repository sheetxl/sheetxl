import React, { forwardRef } from 'react';
import { Tooltip, TooltipProps } from '@mui/material';
import { useFullscreenPortal } from '@sheetxl/utils-react';

/**
 * SimpleTooltip wraps that use the useFullscreenPortal hook
 * to wrap MUI Tooltip and set the Popper container to support
 * fullscreen/portal scenarios. Behaves exactly like Tooltip.
 */
const SimpleTooltip = forwardRef<any, TooltipProps>((props, ref) => {
  const { slotProps, ...rest } = props;

  const { getPortalContainer } = useFullscreenPortal();
  return (
    <Tooltip
      ref={ref}
      slotProps={{
        ...slotProps,
        popper: {
          container: getPortalContainer,
          ...(slotProps?.popper || {})
        }
      }}
      {...rest}
    />
  );
});

SimpleTooltip.displayName = "SimpleTooltip";
export { SimpleTooltip };