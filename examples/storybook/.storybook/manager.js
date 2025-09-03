import { addons } from 'storybook/manager-api';

import theme from './Theme';

// https://github.com/storybookjs/storybook/blob/next/code/addons/docs/docs/recipes.md
/**
 * Note - As of storybook 9.0.13, the manager file must a js file to be discovered.
 */
addons.setConfig({
  navSize: 300,
  // bottomPanelHeight: 300,
  // rightPanelWidth: 300,
  // panelPosition: 'bottom',
  addonPanelInRight: false,
  enableShortcuts: false, // these conflict with our shortcuts
  theme: theme,
  disabledSaveFromUI: true,
  selectedPanel: undefined,
  showTabs: false,
  showToolbar: true,
  showAddonPanel: false,
  // initialActive: 'sidebar',
  sidebar: {
    showRoots: false,
    collapsedRoots: ['other'],
  },
  toolbar: {
    title: { hidden: false },
    zoom: { hidden: false },
    eject: { hidden: false },
    copy: { hidden: false },
    fullscreen: { hidden: false },
  },
});