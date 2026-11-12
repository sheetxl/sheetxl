import React, { useMemo } from 'react';

import { useColorMode } from '@docusaurus/theme-common';
import { createTheme, ThemeProvider } from '@mui/material';

import { GlobalStyles } from '@mui/material';

export default function MUIThemeWrapper(props) {
  const {
    children,
    ..._rest
  } = props;

  const {colorMode} = useColorMode();
  const defaultTheme = useMemo(() => {
    // MUI defaults to Roboto; inherit the site font and colors from the Infima variables so
    // MUI-rendered copy matches the markdown pages.
    return createTheme({
      typography: {
        fontFamily: 'inherit',
      },
      palette: {
        mode: colorMode,
        primary: {
          main: '#3e7dff',
        },
        // MUI derives alpha variants from these, so they must be literal colors, not CSS
        // variables. Same values as custom.css.
        text: colorMode === 'dark'
          ? { primary: '#ffffff', secondary: '#b5b3bc' }
          : { primary: '#080321', secondary: '#637381' },
        background: colorMode === 'dark'
          ? { default: '#080321', paper: '#131b4d' }
          : { default: '#ffffff', paper: '#ffffff' },
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
