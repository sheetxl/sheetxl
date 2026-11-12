import type React from 'react';
import { forwardRef, memo, useCallback, useMemo } from 'react';


import { useCallbackRef, themeSurfaceProps } from '@sheetxl/utils-react';
import { useCommands } from '@sheetxl/utils-react';

import { type IColor, Color } from '@sheetxl/sdk';

import { CommandButtonType } from '@sheetxl/utils-react';

import { type CommandContext, useGridColorScheme } from '@sheetxl/react';

import { CommandTooltip, PopupButtonType, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

import {
  ColorPopupButton, type ColorPanelProps, type ColorPopupButtonProps
} from '../color';

/**
 * Wraps ColorPopupButton with a command.
 */
export interface ColorCommandButtonProps extends Omit<ColorPopupButtonProps, "selectedColor" | "variant" | "icon" | "label"> {
  commandKey?: string;
  /**
   * The group the button is a member of: its label is the command's label in that group (a menu's
   * short form, `High Point` for `High Point Color`).
   */
  groupKey?: string;

  icon?: React.ReactNode | ((command: any) => React.ReactNode);

  label?: React.ReactNode | ((command: any) => React.ReactNode);
  /**
   * Styling
   * @defaultValue CommandButtonType.Toolbar
   */
  variant?: CommandButtonType;
  /**
   * Hint to indicate to the popup to behave like a split button even if no commands is available.
   */
  isSplit?: boolean;

  darkMode?: boolean;
}

export const ColorCommandButton = memo(forwardRef<HTMLElement, ColorCommandButtonProps>(
  (props, refForwarded) => {
  const {
    commandKey,
    groupKey,
    onSelectColor: propOnSelectedColor,
    disabled: propDisabled,
    variant = CommandButtonType.Toolbar,
    quickColor: propQuickColor,
    propsPanel,
    isSplit = false,
    darkMode: propDarkMode,
    icon: propIcon,
    ...rest
  } = props;

  const {
    autoColor: propAutoColor,
    schemeLookup: propSchemeLookup,
    recentColors: propRecentColors,
    ...restPanelProps
  } = propsPanel ?? {};

  if ((rest as any).selectedColor)
    throw new Error('Command selectedColor will be used. Do not try to provide one as a direct argument');
  const [command] = useCommands<IColor, CommandContext.Color>([commandKey ?? '']);

  const context:CommandContext.Color | undefined = command?.getContext();
  let quickColor = propQuickColor ?? context?.quickColor;
  if (isSplit && !quickColor)
    quickColor = new Color('transparent');
  // `null` is a deliberate "no automatic swatch" from the caller; only an ABSENT prop falls back
  // to the command's context (where e.g. the fill picker's automatic is No Fill).
  const autoColor = propAutoColor !== undefined ? propAutoColor : context?.autoColor;
  const schemeLookup = propSchemeLookup ?? context?.schemeLookup;
  const recentColors = propRecentColors ?? context?.recentColors;
  // Self-source the grid's light/dark intent from the shared preference (same value the grid resolves — no
  // drift, no `context.darkMode`). A `darkMode` prop is still an explicit override.
  const gridColorScheme = useGridColorScheme();
  const darkMode = propDarkMode ?? (gridColorScheme === 'dark');

  const localPropsPanel:Partial<ColorPanelProps> = useMemo(() => {
    return {
      autoColor,
      schemeLookup,
      recentColors,
      darkMode,
      // The picker popup is portaled outside the grid subtree. Instead of re-establishing the grid's
      // `--sxl-sys-color-*` as concrete values, the panel root just ADOPTS
      // the grid surface: `data-sxl-theme-surface="grid"` + the grid's mode. The float wrapper carries the
      // origin instance's scope class, so the scoped `[mode][surface="grid"]` tokens + the global OOXML sys
      // aliases resolve `auto`/system swatches (var(--sxl-sys-color-*)) against the grid — no concrete style needed.
      ...themeSurfaceProps('grid', darkMode ? 'dark' : 'light'),
      ...restPanelProps
    };
  }, [autoColor, schemeLookup, recentColors, darkMode]);

  const handleOnSelectColor = useCallbackRef((color: IColor | null, isCustom: boolean) => {
    if (color && isCustom && context?.addRecentColor)
      context.addRecentColor(color);
    if (context?.onColorSelect)
      context.onColorSelect(color as IColor);
    propOnSelectedColor?.(color, isCustom);
    command?.execute(color);
  }, [command, propOnSelectedColor, context]);

  const renderTooltip = useCallback((props: ButtonTooltipRenderProps): React.JSX.Element => {
    const {
      disabled,
      children,
      title, // remove default title
       ...rest
    } = props;

    let retValue = props.children;
    // no tooltip then we are done
    // if (!command?.getLabel())
    //   return retValue;

    // can't have a disabled component in a tooltip
    if (command?.disabled() || propDisabled) {
      retValue = (
        <div>
          {retValue}
        </div>
      )
    }

    return (
      <CommandTooltip
        commandKey={commandKey}
        placement={variant === CommandButtonType.Toolbar? "bottom-start" : "right-start"}
        disabled={disabled}
        {...rest}
      >
        {retValue}
      </CommandTooltip>
    )
  }, [command, propDisabled]);

  return (
    <ColorPopupButton
      ref={refForwarded}
      propsPanel={localPropsPanel}
      icon={propIcon ?? command?.getIcon() as any }
      quickColor={quickColor}
      selectedColor={command?.getState() as IColor}
      onSelectColor={handleOnSelectColor}
      variant={variant === CommandButtonType.Menuitem ? PopupButtonType.Menuitem : PopupButtonType.Toolbar } // TODO - clean this up
      renderTooltip={renderTooltip}
      label={command?.getLabel(groupKey) as any}
      disabled={propDisabled ?? (!command || command.disabled())}
      compareRGB={true}
      darkMode={darkMode}
      {...rest}
    />
  );
}));

ColorCommandButton.displayName = "ColorCommandButton";