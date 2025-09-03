import React, { useMemo } from 'react';

import {
  IThemeCollection, ThemeCollection, Theme, IColor
} from '@sheetxl/sdk';

import { DocThemesProvider } from '@sheetxl/react';

import { Studio } from '@sheetxl/studio-mui';

/**
 * This example shows how to update the
 * default docTheme. This will:
 *
 * 1. Cause all new Workbooks to use the customized default docTheme
 * 2. Add Halloween as a new Theme to ThemeSelect
 *
 * Existing save documents with saved themes will
 * continue to use their existing theme.
 */
const Template: React.FC = () => {

  // For new workbooks
  const defaultDocTheme = useMemo(() => {
    return new Theme({
      name: 'Holiday',
      colors: {
        dk1: IColor.Named.Red,
        dk2: IColor.Named.Green,
        accent1: IColor.Named.LtGreen,
        accent2: IColor.Named.LtPink,
        accent3: 'blue',
        accent4: '#ff6e40',
      }
    });
  }, []);

  // For themes select dropdown
  const customThemes = useMemo(() => {
    const themes:IThemeCollection = new ThemeCollection();

    /**
     * Add Halloween as option theme in ThemesSelector
     */
    const theme = new Theme({
      name: 'Halloween',
      colors: {
        dk1: '#130912',
        dk2: '#42331E',
        lt1: '#FFEFC9', // yellow
        lt2: '#E9Cb95', // light orange
        accent1: '#FFC502', // yellow
        accent2: '#F56F16', // orange
        accent3: '#B14624', // brown
        accent4: '#602749', // purple
        accent5: '#5A7E5A', // green
        accent6: '#A21A00', // red
      }
    });
    themes.setCustomTheme(theme);
    /**
     * Set a default custom theme.
     *
     * @remarks
     * * Adds the theme to the themes collection.
     * * Redundant with passing the theme via attachStudioOptions.
     * * Another Example that also updates the available themes in the drop down.
     */
    themes.setDefaultTheme(defaultDocTheme);

    return themes;
  }, [defaultDocTheme]);

  const App = () => {
    return (
      <DocThemesProvider themes={customThemes}>
        <Studio
          square={false}
          sx={{
            flex: '1 1 100%'
          }}
        />
      </DocThemesProvider>
    );
  };

  return <App/>;
};

export const WorkbookAppCustomDocThemes = Template.bind({});
WorkbookAppCustomDocThemes.args = {

};

WorkbookAppCustomDocThemes.storyName = "Custom DocThemes";

const Story = {
  title: 'Workbook/Custom DocThemes',
  component: Studio,
};
export default Story;