import React, { useMemo } from 'react';

import { useColorMode } from '@docusaurus/theme-common';
import { createTheme, ThemeProvider } from '@mui/material/styles';

import { GlobalStyles } from '@mui/material';

export default function MUIThemeWrapper(props) {
  const {
    children,
    ..._rest
  } = props;

  const {colorMode} = useColorMode();
  const defaultTheme = useMemo(() => {
    return createTheme({
      palette: {
        mode: colorMode,
        text: {
          // primary: 'var(--ifm-font-color-base)',
          // secondary: 'var(--ifm-font-color-secondary)',
        }
        // 'var(--ifm-font-color-secondary)'
      },
    })
  }, [colorMode]);

  const [renderedChildren, setRenderedChildren] = React.useState(children);
  React.useEffect(() => {
    /**
     * This is a hack. For some reason MUI/emotion reads the wrong values
     * by force a re-render we 'mask' the problem.
     */
    if (colorMode === 'dark') {
        setRenderedChildren((
          <div>
            {children}
          </div>
        ))
    }
  }, [colorMode, children]);

  return (
    <ThemeProvider theme={defaultTheme}>
      <GlobalStyles styles={{ ul: { margin: 0, padding: 0 }}} />
      {renderedChildren}
    </ThemeProvider>
  );
}
