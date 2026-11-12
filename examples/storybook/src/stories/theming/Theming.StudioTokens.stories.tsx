import React from 'react';

import { type ExplicitTokens } from '@sheetxl/react';

import { Studio, AppearanceCommandButton } from '@sheetxl/studio-mui';

import { asStory } from '../../components';

/**
 * **Theme a Studio with `tokens`.** Even though Studio is MUI-based, the `app` cell retints its **MUI chrome**
 * (toolbar, zoom slider, tab indicator) *and* the grid: Studio maps those tokens into its MUI theme. The same
 * shape themes a MUI-free `WorkbookElement` (see **Workbook Tokens**).
 *
 * Toggle light/dark (top-right); the values follow the studio's mode. A hand-written `@layer sxl-overrides`
 * sheet themes only the grid, since MUI reads its palette in JavaScript.
 */
const TOKENS: ExplicitTokens = {
  light: { app: { 'color-primary': '#6d28d9', 'color-accent': '#0891b2' } },
  dark: { app: { 'color-primary': '#a78bfa', 'color-accent': '#22d3ee' } }
};

const Template: React.FC = () => (
  <Studio tokens={TOKENS} topRight={<AppearanceCommandButton/>} />
);

export const StudioTokens = asStory(Template);
StudioTokens.args = {};
StudioTokens.storyName = 'Studio Tokens';

const Story = {
  title: 'Theming',
  component: Studio,
};
export default Story;
