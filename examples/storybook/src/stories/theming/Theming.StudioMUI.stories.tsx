import React from 'react';

import { type ThemeOptions } from '@mui/material';

import { Studio, AppearanceCommandButton } from '@sheetxl/studio-mui';

import { asStory } from '../../components';

/**
 * **Theme a Studio with MUI (`ThemeOptions`).** The MUI-native path: pass a single `muiTheme` — shared options
 * plus **per-mode** overrides via MUI's native `colorSchemes: { light, dark }` — and Studio maps the MUI
 * palette onto the `--sxl-*` tokens, so the MUI chrome and the grid both follow. `palette.primary` →
 * `--sxl-color-primary`, `palette.secondary` → `--sxl-color-accent`.
 *
 * Use this if you already theme with MUI; the **Studio Tokens** story gets the identical result from the
 * token side. Toggle light/dark (top-right). The grid stays light in dark mode unless "Enable Dark
 * Grid" is on (so a workbook renders as authored / prints faithfully).
 */
const muiTheme: ThemeOptions = {
  colorSchemes: {
    light: { palette: { primary: { main: '#6d28d9' }, secondary: { main: '#0891b2' } } },
    dark:  { palette: { primary: { main: '#a78bfa' }, secondary: { main: '#22d3ee' } } }
  }
};

const Template: React.FC = () => (
  <Studio
    muiTheme={muiTheme}
    topRight={<AppearanceCommandButton/>}
  />
);

export const StudioMUI = asStory(Template);
StudioMUI.args = {};
StudioMUI.storyName = 'Studio + MUI';

const Story = {
  title: 'Theming',
  component: Studio,
};
export default Story;
