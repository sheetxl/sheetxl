import React from 'react';

import { DefaultDynamicIconService } from '@sheetxl/utils-react';

import { DefaultTaskPaneRegistry } from '@sheetxl/react';

import { ScriptTaskPane } from './workspace';

// TODO - accept plugin config object
// TODO - model as vite plugin with a pipeline of hooks?
export const ScriptingPlugin = () => {
  // Register Icons to existing pack (how to add to existing? lazy load?)
  // Register i18n strings
  // Register addition icons

  // Call functions (to allow for any generic work to be done)

  // Register commands.

  // commands are register against an 'on' 'action' (action & noun) 'workbook, sheet, table, drawing (chart image, table), scripts, etc

  // The same command key can work on multiple object. (copy or select)

  /*
    https://github.com/microsoft/vscode-codicons/tree/main/src/icons
    https://microsoft.github.io/vscode-codicons/dist/codicon.html
  */
  DefaultDynamicIconService.register(
    'plugin-scripts', {
      icons: {
      }
    }
  );

  // Register CommandButtonCreators (if required)

  // CommandPalettes are popup menus (with into to create menu, or ribbon, etc) (Are these identical to TaskPanes)
  // Register CommandPaletteCreators (if required) // Title, Icon, Tooltip

  // Add Commands to Palettes Paths (if required)
  // // contributionPoints: ['menu/view/taskpanes', 'toolbar/view/taskpanes'],

  DefaultTaskPaneRegistry.registerTaskPane({
    key: 'scriptEditor',
    getTitle(): string {
      return 'Script (Typescript)';
    },
    getIcon(): React.ReactElement | string {
      return 'ScriptRun';
    },
    renderTaskPane: ScriptTaskPane
  }, true);

  // Customization Options
  // Custom Theme? (n) (add to theme?)
  // Custom IconPack

  // Workbook options
  // Custom Validators
  // Custom Formulas/Macros
  // Custom filters
  // Custom sorters

  // Custom renderers
  // Custom datasources
  // Custom Editors
  // Custom Overlay
  // Custom Movable

  // ? How to Customize Headers
}

/**
 * Dialog vs TaskPane vs CommandPalette
 *
 * (Dialogs are modal?)
 * (TaskPanes & Dialogs have lifecycle events)
 * (CommandPalettes have neither)
 */
