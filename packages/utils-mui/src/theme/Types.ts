import { ThemeOptions } from '@mui/material/styles';

export const ThemeMode = {
  Light: 'light',
  Dark: 'dark'
} as const;
export type ThemeMode = typeof ThemeMode[keyof typeof ThemeMode];
export interface ThemeModeOptions {
  /**
   * The user doesn't want to use the default.
   *
   * @defaultValue the system default
   */
  mode?: ThemeMode;
  /**
   * Customizations to the theme.
   *
   * @defaultValue `Theme`
   */
  theme?: ThemeOptions;
  /**
   * Customizations to the light theme.
   *
   * @defaultValue Theme values.
   */
  light?: ThemeOptions;
  /**
   * Customizations to the dark theme.
   *
   * @defaultValue Theme values
   */
  dark?: ThemeOptions;
  /**
   * By default the the standalone workbook grid will be the same theme as the workbook.
   * If forceGridLight is `true` then the grid will always use the light mode.
   *
   * When `true` the grid will behave consistent with current Excel (2023).
   *
   * @remarks
   * When the grid has a dark theme it will attempt to use DocTheme dark colors
   * but will 'force' non dark-themed colors to be light via an inversion algo.
   *
   * @defaultValue false
   */
  enableDarkGrid?: boolean;
  /**
   * By default the the standalone workbook images will invert images if the grid
   * is in dark mode.
   *
   * @defaultValue false
   */
  enableDarkImages?: boolean;
  /**
   * When theming also apply the MUI CssBaseline.
   *
   * @defaultValue false
   */
  cssBaseline?: boolean;
  /**
   * Called if the current mode changes for the AppTheme.
   *
   * @remarks
   * * This is only used if the themeOptions are not provided.
   * * If `null` is sent then the theme should inherit.
   */
  onModeChange?: (mode: ThemeMode | null) => void;
  onEnabledDarkGridChange?: (allow: boolean) => void;
  onEnabledDarkImagesChange?: (allow: boolean) => void;
}
