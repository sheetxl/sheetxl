import React, { memo, forwardRef, Suspense, useMemo } from 'react';

import { LicenseManager } from '@sheetxl/sdk';

import { Paper } from '@mui/material';
import { type IWorkbookElement } from '../components';

import { renderWorkbookLoading } from '../components/workbook/WorkbookRenderers';

import { type StudioProps } from './StudioProps';

/**
 * Studio
 *
 * Fully featured workbook component.
 *  * controlled/uncontrolled workbook
 *  * snackbar
 *  * export/import to local file system
 *  * workbook title
 *  * Material-ui theme width light/dark toggle
 *  * lazy loading
 *
 * Demos:
 *
 * - [SheetXL](https://storybook.sheetxl.com/)
 *
 * API:
 *
 * - [Studio](https://api.sheetxl.com/variables/_sheetxl_studio-mui.Studio.html)
 */
const Studio = memo(forwardRef<IWorkbookElement, StudioProps>((props: StudioProps, refForwarded: React.Ref<IWorkbookElement>) => {
  const {
    sx: propSx,
    style: propStyle,
    className: propClassName,
    licenseKey,
    renderLoading: propRenderLoading = renderWorkbookLoading,
    loadingProps,
    ...rest
  } = props;
  if (licenseKey) {
    LicenseManager.setLicenseKey(licenseKey);
  }

  const renderedLoadingPanel = useMemo(() => {
    if (!propRenderLoading) return null;
    // TODO - switch this to a css-transition-group like workbook
    return (
      <Paper
        sx={propSx}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...propStyle
        }}
      >
        {propRenderLoading(
          {...loadingProps}
        )}
      </Paper>
    );
  }, [propSx, propStyle, propRenderLoading, loadingProps]);

  const EagerStudio = useMemo(() => {
    return React.lazy(async () => {
      const retValue = await import('./EagerStudio');
      return retValue;
    });
  }, []);

  return (<>
    <Suspense
      fallback={renderedLoadingPanel}
    >
      <EagerStudio
        {...rest}
        className={propClassName}
        renderLoading={propRenderLoading}
        loadingProps={{
          ...loadingProps,
          transitionDelay: '0ms' // because we were already rendering it
        }}
        sx={propSx}
        style={propStyle}
        ref={refForwarded}
      />
    </Suspense>
   </>
 );
}));


// export as both named and default
Studio.displayName = "Studio";
export default Studio;
export { Studio };