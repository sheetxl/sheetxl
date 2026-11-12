import React from 'react';

import {
  DefaultIconService, DefaultCommandButtonRegistry, type CommandButtonProps
} from '@sheetxl/utils-react';

import { DefaultTaskPaneRegistry } from '@sheetxl/react';

import { ScriptingReactPlugin } from '@sheetxl/scripting-react';

import { ScriptTaskPane } from './workspace';
import { RunScriptContribution } from './command/RunScriptContribution';
import { InsertFunctionContribution } from './command/InsertFunctionContribution';

// TODO - accept plugin config object
// TODO - model as vite plugin with a pipeline of hooks?
export const ScriptingPlugin = () => {
  // Base (framework-agnostic) scripting registrations: the bare scriptEditor task pane and the
  // workbook-level script commands (executeScript / showScriptEditor). The richer MUI task pane below
  // replaces the bare one (replace: true); the command contribution is reused as-is.
  ScriptingReactPlugin();

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
  DefaultIconService.register(
    'plugin-scripts', {
      icons: {
      }
    }
  );

  // Register CommandButtonCreators (if required)

  // CommandPalettes are popup menus (with into to create menu, or ribbon, etc) (Are these identical to TaskPanes)
  // Register CommandPaletteCreators (if required) // Title, Icon, Tooltip

  // Add Commands to Palettes Paths (if required)
  // // contributions: ['menu/view/taskpanes', 'toolbar/view/taskpanes'],

  DefaultTaskPaneRegistry.registerTaskPane({
    key: 'scriptEditor',
    component: ScriptTaskPane,
    // Keep the editor mounted across tab switches — remounting tears down Monaco's CDN loader +
    // language workers and fails to reload them on the way back.
    keepMounted: true
  }, true);

  // Contribute the Run Script button to the ribbons. The button self-gates: on the home ribbon it
  // only appears when the workbook has macros or the editor is open; on the view ribbon it is always
  // shown. A different host (e.g. a VSCode extension) can register its own contribution at these
  // points to open a native editor instead.
  // Chrome-only entry for the bespoke Run Script (Macros) popup — its head label/tooltip resolve
  // through the catalog (`scripting-react`'s `groups.cmd.json`, scope `ui`) instead of being hardcoded
  // in the button, so they translate. The strings here are just the English fallback.
  DefaultCommandButtonRegistry.register({
    key: 'scriptsOptions'
  }, true);
  DefaultCommandButtonRegistry.register({
    key: 'customFunctionOptions'
  }, true);

  DefaultCommandButtonRegistry.register({
    key: 'scripting.runScript.home',
    // Injects at the tail of the Home toolbar (end edge). `RunScriptContribution` renders its own
    // leading divider when shown and returns null when hidden, so it needs no `divider` here.
    contributions: { homeToolbar: {} },
    render: (props: CommandButtonProps): React.ReactElement =>
      React.createElement(RunScriptContribution, { ...props })
  }, true);
  // Injects at the tail of the View toolbar (end edge). `RunScriptContribution` renders its own leading divider, so no `divider`
  // is needed here. Modern key: the registered `viewToolbar` group (was the legacy `find('ribbon/view')`
  // reverse-index).
  DefaultCommandButtonRegistry.register({
    key: 'scripting.runScript.view',
    contributions: { viewToolbar: { order: 10 } },
    render: (props: CommandButtonProps): React.ReactElement =>
      React.createElement(RunScriptContribution, { ...props, groupKey: 'view', alwaysShow: true })
  }, true);

  // Contribute the Custom Functions button to the Formulas ribbon (`formulaToolbar`), positioned right after
  // the built-in `web` category (anchor + positive order ⇒ immediately after `formulaCategory.web`). Lists
  // the workbook's user-defined calculation functions, inserting the chosen one via the workbook
  // `insertFunction` command. Unlike the Run Script button it DISABLES rather than hides when there are none.
  DefaultCommandButtonRegistry.register({
    key: 'scripting.insertFunction.formula',
    contributions: { formulaToolbar: { anchor: 'formulaCategory.web', order: 1 } },
    render: (props: CommandButtonProps): React.ReactElement =>
      React.createElement(InsertFunctionContribution, { ...props })
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
