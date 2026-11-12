import type React from 'react';

import { FloatProvider, type FloatProviderProps, type FloatPanelProps } from '@sheetxl/utils-react';

import { ExhibitFloatPanel } from './ExhibitFloatPanel';
import { defaultRenderPopupPanel } from './ExhibitPopup';

const renderExhibitFloatPanel = (props: FloatPanelProps): React.ReactElement => {
  return <ExhibitFloatPanel {...props}/>;
};

/**
 * A {@link FloatProvider} preconfigured with the MUI floating surface
 * ({@link ExhibitFloatPanel} + the MUI popup-panel default).
 *
 * The MUI surface is required (not just preferred): floats render in a portal,
 * and the neutral `FloatPanel` themes via `--sxl-*` CSS variables which do not
 * reach the portal container, so it renders unthemed there. The MUI `Paper`
 * surface carries the theme into the portal. (See the parked experiment to drop
 * the MUI surface — blocked on CSS-variable propagation into portals.)
 *
 * Mount once near a MUI app root so every float below renders on the MUI
 * surface. Other {@link FloatProviderProps} (e.g. `isolate`) pass through.
 */
export const ExhibitFloatProvider = (
  props: Omit<FloatProviderProps, 'renderFloatPanel' | 'renderPopupPanel'>
): React.ReactElement => {
  return (
    <FloatProvider
      {...props}
      renderFloatPanel={renderExhibitFloatPanel}
      renderPopupPanel={defaultRenderPopupPanel}
    />
  );
};
