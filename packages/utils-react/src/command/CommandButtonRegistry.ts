// import { ThemeProvider, createTheme } from '@mui/material/styles';

// const theme = createTheme({
//   palette: {
//     primary: {
//       main: red[500],
//     },
//   },
// });

// function App() {
//   return <ThemeProvider theme={theme}>...</ThemeProvider>;
// }

/**
 * Follow useCommandsButtons. pattern createCommandButtonSet
 *
 * Use ProviderContext or just set a singleton. (research why/which)
 *
 * Register icon, label, description
 *           { commandManager.createButton( commands.getCommand('formatAlignLeftToggle'), CommandButtonType.TOOLBAR ) }
 *
 * Register factory for each type of Command
 * Register configuration for each key
 *
 * When registering to a component also
 *
 */

export const CommandButtonType = {
  /**
   * Suitable for toolbars. Click to open, click to close, generally disabled as icon
   */
  Toolbar: 'toolbar',

  /**
   * Suitable for menus. HoverIn to open, hover leave to close, generally disabled as icon and text
   */
  Menuitem: 'menuitem'
} as const;
export type CommandButtonType = typeof CommandButtonType[keyof typeof CommandButtonType];

export interface CommandButtonMeta {
  // key

  // type

  //icon:

  //label

  // description
}

export interface CommandButtonRegistry {
// map of commandButton Meta

// add/delete/get/iterator commandButtonMeta

// register factories creators
}

export interface CommandButtonCreator {

// createButton(command: ICommand, type: CommandButtonType) }

// getIcon(command: ICommand);

// getLabel(command: ICommand);

// getDescription(command: ICommand);
}

// useButtonCreator();
