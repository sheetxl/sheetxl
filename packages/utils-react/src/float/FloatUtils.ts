import { useContext } from 'react';

import { type RenderSlotFn } from '../components';
import { type FloatPanelProps } from './FloatPanel';
import { type FloatPopupPanelProps } from './FloatPopup';
import { type RenderFloatPanel } from './useFloatStack';

import {
  THEME_MODE_ATTR, THEME_SURFACE_ATTR, type ThemeAttrs, type ThemeMode
} from '../theme';

import { SurfaceContext } from './_FloatUtils';

/**
 * The theme a float opens with (THEMING-DESIGN §7). A float portals to a shared, theme-free container
 * (`getPortalContainer()`), so it must carry its **origin instance's** theme onto its own wrapper. That
 * theme rides the float-surface context: the nearest {@link FloatSurface}-providing ancestor
 * ({@link FloatProvider}) decides it — the app sets one at its root; the grid deliberately sets none, so a
 * grid-originated menu inherits the app's (a menu from a light grid in a dark app opens dark, following the
 * app). To theme (or re-surface) floats for a subtree, drop a {@link FloatProvider} with a new theme.
 */
export interface FloatThemeScope {
  /**
   * Scope class name(s) placed on the float wrapper so the instance's per-instance `@scope (.<class>){…}`
   * rules treat the wrapper as a scope root and apply to it. Accumulated through nested providers so a float
   * can resolve every ancestor instance's scoped tokens (layer order settles conflicts).
   */
  classes?: string[];
  /** The `data-sxl-theme-surface` a float opens with. App-driven; defaults to `app`. */
  surface?: string;
  /** The `data-sxl-theme-mode` a float opens with — the app's resolved mode (so floats follow the app). */
  mode?: ThemeMode;
}

/**
 * Ambient floating-surface configuration: how the panel is rendered and any
 * extra panel props to merge. Resolved most-specific-wins via {@link FloatProvider}.
 */
export interface FloatSurface {
  renderFloatPanel?: RenderFloatPanel;
  /** The default float content, used when a float doesn't supply its own. */
  renderPopupPanel?: RenderSlotFn<FloatPopupPanelProps>;
  propsFloatPanel?: Partial<FloatPanelProps>;
  /**
   * The theme floats in this subtree open with (scope class(es) + surface + mode). Carried onto the float
   * wrapper by {@link FloatPopper} so a portaled float resolves the origin instance's scoped tokens. See
   * {@link FloatThemeScope}.
   */
  themeScope?: FloatThemeScope;
}

/** The ambient {@link FloatSurface}, or `null` if none is provided. */
export const useFloatSurface = (): FloatSurface | null => {
  return useContext(SurfaceContext);
};

/**
 * Turn a {@link FloatThemeScope} into the props to carry it across a portal boundary: the scope class(es)
 * and the `data-sxl-theme-*` attrs to spread onto the portaled wrapper so it resolves the origin instance's
 * scoped tokens (THEMING-DESIGN §7). Shared by every element that portals out of its themed subtree —
 * {@link FloatPopper} (popups/menus) and the modal dialog wrapper alike, since a dialog portals to the same
 * theme-free container and must carry its theme the same way. Returns an empty result (no className, no
 * attrs) when the scope carries nothing, so the caller can apply its own fallback.
 */
export const floatThemeScopeProps = (
  themeScope?: FloatThemeScope
): { className?: string; attrs: ThemeAttrs } => {
  const attrs: ThemeAttrs = {};
  if (!themeScope) return { attrs };
  if (themeScope.mode) attrs[THEME_MODE_ATTR] = themeScope.mode;
  if (themeScope.surface) attrs[THEME_SURFACE_ATTR] = themeScope.surface;
  const className = themeScope.classes?.length ? themeScope.classes.join(' ') : undefined;
  return { className, attrs };
};
