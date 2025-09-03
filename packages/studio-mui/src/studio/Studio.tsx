import React, { memo, forwardRef, Suspense, useMemo } from 'react';

import { LicenseManager } from '@sheetxl/sdk';

import { Box } from '@mui/material';
import { LoadingPanel } from '@sheetxl/utils-mui';
import { type IWorkbookElement, type WorkbookRefAttribute } from '../components';

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
const Studio: React.FC<StudioProps & WorkbookRefAttribute> =
memo(forwardRef<IWorkbookElement, StudioProps>((props, refForwarded) => {
  const {
    sx: propSx,
    style: propStyle,
    className: propClassName,
    licenseKey,
    renderLoadingPanel,
    ...rest
  } = props;
  if (licenseKey) {
    LicenseManager.setLicenseKey(licenseKey);
  }

  const loadingPanel = useMemo(() => {
    const props = {
      transitionDelay: '160ms',
      transparentBackground: true
    }
    // TODO - switch this to a css-transition-group like workbook
    return (
      <Box
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
        {renderLoadingPanel?.(props) ?? (<LoadingPanel{...props}/>)}
      </Box>
    );
  }, [propSx, propStyle, renderLoadingPanel]);

  const EagerStudio = useMemo(() => {
    return React.lazy(async () => {
      const retValue = await import('./EagerStudio');
      return retValue;
    });
  }, []);

  return (<>
    <Suspense
      fallback={loadingPanel}
    >
      <EagerStudio
        {...rest}
        className={propClassName}
        renderLoadingPanel={renderLoadingPanel}
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