import React from 'react';

import { ThemeProvider, createTheme, Theme } from '@mui/material/styles';

import { Box } from '@mui/material';
import { Paper } from '@mui/material';
import { Button } from '@mui/material';

import { Studio, WorkbookElement } from '@sheetxl/studio-mui';


/**
 * The simplest way to customize the App theme is to use
 * the workbook is to use
 * https://bareynol.github.io/mui-theme-creator/
 * and then copy the themeOptions as json into a variable.
 *
 * Another potentially useful resource is:
 * https://codecrafted.net/randommaterial/
 */
const lightTheme = createTheme({
  palette: {
    primary: {
      main: "#ffc107" // orange
    },
    secondary: {
      main: "#ff6e40" // dark orange
    },
    info: {
      main: "#9c27b0" // purple
    }
    // success?: PaletteColorOptions,
    // warning?: PaletteColorOptions,
    // error?: PaletteColorOptions
  }
});

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#ffa000" // dark yellow
    },
    secondary: {
      main: "#ff7043" // light purple
    },
    info: {
      main: "#b388ff" // reddish brown
    }
    // success?: PaletteColorOptions,
    // warning?: PaletteColorOptions,
    // error?: PaletteColorOptions
  }
});

const Template: React.FC = () => {

  const [currentTheme, setCurrentTheme] = React.useState<Theme>(lightTheme);

  const App = () => {
    return (
      <ThemeProvider theme={currentTheme}>
      <Box
        sx={{
          width: '100%', // to layout in storybook
          height: '100%', // to layout in storybook
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          rowGap: '4px',
        }}
      >
        <Paper
          sx={{
            padding: '4px',
          }}
        >
          <Button onClick={() => setCurrentTheme(lightTheme)} color="primary">
            Light
          </Button>
          <Button onClick={() => setCurrentTheme(darkTheme)} color="primary">
            Dark
          </Button>
        </Paper>
        {/* <Studio
          square={false}
          sx={{
            flex: '1 1 100%'
          }}
        /> */}
        <WorkbookElement
          sx={{
            flex: '1 1 100%'
          }}
        />
      </Box>
      </ThemeProvider>
    );
  };

  return <App />;
};

export const WorkbookAppCustomAppThemes = Template.bind({});
WorkbookAppCustomAppThemes.args = {

};

WorkbookAppCustomAppThemes.storyName = "Custom AppTheme";

const Story = {
  title: 'Workbook/Custom AppTheme',
  component: Studio,
};
export default Story;