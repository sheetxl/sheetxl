import { type IKeyStroke } from '../types';

import { type ResolvedCommand } from './createResolvedCommand';

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

export interface CommandButtonOptions<STATE=any, CONTEXT=any, ARGS = void> extends Omit<React.HTMLAttributes<HTMLElement>, "color" | "label"> {
  /**
   * The panel/group the button renders in (e.g. `'contextMenu'`, `'cellStyle'`) — selects the
   * command's matching `groupLabels` variant. Omit for the full label. (Named `groupKey`, NOT
   * "scope" — command *scopes* are contributors; this is purely a presentation surface.)
   */
  groupKey?: string;

  icon?: React.ReactNode | ((command: ResolvedCommand<STATE, CONTEXT, ARGS>) => React.ReactNode);

  label?: React.ReactNode | ((command: ResolvedCommand<STATE, CONTEXT, ARGS>) => React.ReactNode);

  /**
   * Render the `label` as visible button content (alongside the icon) rather than tooltip-only.
   * Toolbar buttons are icon-only by default; menu items always show their label. See
   * {@link CommandButtonEntry.showLabel} for the entry-level equivalent.
   * @defaultValue false
   */
  showLabel?: boolean;

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
   *
   * @defaultValue CommandButtonType.Toolbar
   */
  variant?: CommandButtonType;
  /**
   * Optional state for this specific command button.
   *
   * @defaultValue to undefined
   */
  commandState?: STATE;
}

export interface CommandButtonProps<STATE=any, CONTEXT=any, ARGS = void> extends CommandButtonOptions<STATE, CONTEXT, ARGS> {
  commandKey?: string;
  command?: ResolvedCommand<STATE, CONTEXT, ARGS>;
}