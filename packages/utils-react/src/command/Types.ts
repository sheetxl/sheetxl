import type { IKeyStroke } from '../types';
import type { ICommand } from './ICommand';

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

export type CommandButtonRefAttribute = {
  ref?: React.Ref<HTMLDivElement>;
};

export interface CommandButtonOptions<STATE=any, CONTEXT=any> extends Omit<React.HTMLAttributes<HTMLElement>, "color" | "label"> {
  /**
   * Allow for listeners against a specific buttons execute rather then the command.
   * Useful when knowing the specific button that executed a command is required.
   * (For example when closing menus or restoring focus)
   */
  commandHook?: ICommand.Hook<STATE, CONTEXT>;
  /**
   * Optional string to enable the command label to be configured based on the scope of how it is being used.
   */
  scope?: string;

  icon?: React.ReactNode | ((command: ICommand) => React.ReactNode);

  label?: React.ReactNode | ((command: ICommand) => React.ReactNode);
  // show label?

  /**
   * The shortcut to display.
   *
   * @remarks
   * This is display only and doesn't actually track the shortcut.
   * Override the display for the shortcut on the command (if available).
   */
  shortcut?: IKeyStroke | IKeyStroke[];

  selected?: boolean;
  disabled?: boolean;
  disableHover?: boolean;
  /**
   * Tooltip properties. If this is specified then the tooltips are used.
   * Do not provide a child as this component will be the child.
   */
  propsTooltip?: any;//Omit<ExhibitTooltipProps, 'children'>;
  /**
   * How the button will be styles.
   * @defaultValue CommandButtonType.Toolbar
   */
  variant?: CommandButtonType;
  /**
   * Optional state for this specific command button.
   * @defaultValue to undefined
   */
  commandState?: STATE;

  context?: CONTEXT;
}

export interface CommandButtonProps<STATE=any, CONTEXT=any> extends CommandButtonOptions {
  command: ICommand<STATE, CONTEXT>;

  // ref?: React.Ref<unknown>;
}