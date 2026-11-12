import { forwardRef } from 'react';
import { Tooltip, type TooltipProps } from '@mui/material';
import { useFullscreenPortal } from '@sheetxl/utils-react';

/**
 * SimpleTooltip wraps that use the useFullscreenPortal hook
 * to wrap MUI Tooltip and set the Popper container to support
 * fullscreen/portal scenarios. Behaves exactly like Tooltip.
 *
 * @remarks
 * The shared portal container is used ONLY in fullscreen, where the tooltip has to be mounted under
 * the fullscreen element to be visible at all. Outside it, the tooltip stays on MUI's own default
 * (`document.body`): the shared container carries a `z-index`, which makes it a stacking context
 * that caps everything inside it — and a tooltip's whole point is that it out-stacks the menu or
 * dialog it is describing.
 */
export const SimpleTooltip = forwardRef<HTMLElement, TooltipProps>((props, ref) => {
  const { slotProps, ...rest } = props;

  const { getPortalContainer, isFullscreen } = useFullscreenPortal();
  return (
    <Tooltip
      ref={ref}
      slotProps={{
        ...slotProps,
        popper: {
          container: isFullscreen ? getPortalContainer : undefined,
          ...(slotProps?.popper || {})
        }
      }}
      {...rest}
    />
  );
});

SimpleTooltip.displayName = "SimpleTooltip";
