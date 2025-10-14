import React, { Suspense, useMemo } from 'react';

import BrowserOnly from '@docusaurus/BrowserOnly';
import { useColorMode } from '@docusaurus/theme-common';

import { Paper } from '@mui/material';

import styles from './studio.module.css';

// const NeverResolving = React.lazy(() => new Promise(() => {}));

const defaultBounds = {
  minHeight: '580px',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default function StudioDemo() {
  const { colorMode } = useColorMode();

  const Studio = useMemo(() => {
    return React.lazy(() => import('@sheetxl/studio-mui'));
  }, []);

  return (
    <div className={`container ${styles.studio}`}>
    <Paper elevation={2}>
      <BrowserOnly fallback={(
        <div style={defaultBounds}><div>Loading studio...</div></div>
      )}>
      {() => {
        return (
          <Suspense fallback={<div style={defaultBounds}><div>Loading studio...</div></div>}>
            {/* <NeverResolving /> */}
            <Studio
              style={defaultBounds}
              themeOptions={{
                mode: colorMode,
                enableDarkGrid: true
              }}
              workbook={{
                source: `/examples/highlights.xlsx`,
                fetchTimeout: 30000 // 30 second timeout for external URLs
              }}
            />
          </Suspense>
        )
      }}
      </BrowserOnly>
    </Paper>
    </div>
  );
}

