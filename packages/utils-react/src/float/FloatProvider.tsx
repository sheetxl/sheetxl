import React, { useContext, useRef, useMemo, useEffect } from 'react';

import { type RenderSlotFn } from '../components';
import { type ThemeMode } from '../theme';

import { type FloatReference, type RenderFloatPanel } from './useFloatStack';
import { FloatStackProvider, useFloat } from './FloatStackContext';
import { FloatPanel, type FloatPanelProps } from './FloatPanel';
import { type FloatPopupPanelProps } from './FloatPopup';


import { type FloatSurface, type FloatThemeScope } from './FloatUtils';
import { SurfaceContext, createFloatRoot, type FloatRoot } from './_FloatUtils';

/** The built-in neutral surface (the "floor") used when nothing else provides one. */
export const defaultRenderFloatPanel: RenderFloatPanel = (props: FloatPanelProps) => {
  return <FloatPanel {...props}/>;
};

export interface FloatProviderProps {
  /**
   * The floating surface for descendants. When omitted, the surface is
   * inherited from an outer provider (and ultimately the neutral `FloatPanel`).
   */
  renderFloatPanel?: RenderFloatPanel;
  /** The default float content for descendants. Inherited when omitted. */
  renderPopupPanel?: RenderSlotFn<FloatPopupPanelProps>;
  /** Extra props merged into the rendered panel. Inherited when omitted. */
  propsFloatPanel?: Partial<FloatPanelProps>;
  /**
   * Add a per-instance scope class to the theme floats in this subtree carry (see {@link FloatThemeScope}).
   * Accumulates onto any inherited scope classes, so a float resolves every ancestor instance's scoped
   * tokens. An app/instance sets this to its own scope class (e.g. `sheetxl-studio-<id>`).
   */
  themeScopeClass?: string;
  /** The `data-sxl-theme-surface` floats in this subtree open with (nearest provider wins). App sets `app`. */
  themeSurface?: string;
  /** The `data-sxl-theme-mode` floats in this subtree open with (nearest provider wins). App sets its mode. */
  themeMode?: ThemeMode;
  /**
   * Establish an isolated state root for this subtree (its own open-tree,
   * focus/click-away coordination and debounce), independent of other roots on
   * the page. Mount on the boundary that should coordinate as a unit (e.g. an
   * app or split-view container). Without it, a nested provider inherits the
   * enclosing root — but a *top-level* provider (no enclosing float) still
   * auto-roots, so `isolate` is only needed to force a NEW root when nested.
   */
  isolate?: boolean;
  /**
   * Receives the root float in effect for this subtree, so an owner *outside*
   * the subtree can drive it imperatively (e.g. `rootRef.current.closeAll()` on
   * webview focus loss). `isolate` *creates* a root; this only *exposes* it.
   *
   * Set with or without `isolate`: the owned root when this provider roots
   * (isolating, or top of the tree), otherwise the inherited root. Always set to
   * a root (never null) while mounted.
   */
  rootRef?: React.Ref<FloatReference>;
  children?: React.ReactNode;
}

/**
 * Configures the float system for a subtree.
 *
 * - `renderFloatPanel`/`propsFloatPanel` set the surface, overriding only when
 *   given (otherwise the outer surface flows through unchanged), so the
 *   nearest explicit surface wins.
 * - The top provider in a tree (no enclosing float) automatically owns a fresh
 *   coordinating root; nested providers inherit it. `isolate` forces a *new*
 *   root even when nested (a sub-scope).
 */
export const FloatProvider = (props: FloatProviderProps): React.ReactElement => {
  const {
    renderFloatPanel, renderPopupPanel, propsFloatPanel,
    themeScopeClass, themeSurface, themeMode, isolate, rootRef, children
  } = props;

  // Inherit-when-absent: only override the fields actually supplied.
  const inherited = useContext(SurfaceContext);
  const surface = useMemo<FloatSurface>(() => {
    // Theme: scope classes ACCUMULATE (so a float resolves every ancestor instance's scoped tokens);
    // surface + mode are nearest-wins (the closest provider decides what floats here open with). Omit the
    // theme entirely until some ancestor supplies a piece, so FloatPopper can fall back to `closest()` in
    // the (interim) provider-less case.
    const inheritedTheme = inherited?.themeScope;
    const classes = themeScopeClass
      ? [...(inheritedTheme?.classes ?? []), themeScopeClass]
      : inheritedTheme?.classes;
    const surfaceAttr = themeSurface ?? inheritedTheme?.surface;
    const mode = themeMode ?? inheritedTheme?.mode;
    const themeScope: FloatThemeScope | undefined =
      (classes?.length || surfaceAttr || mode) ? { classes, surface: surfaceAttr, mode } : undefined;
    return {
      renderFloatPanel: renderFloatPanel ?? inherited?.renderFloatPanel,
      renderPopupPanel: renderPopupPanel ?? inherited?.renderPopupPanel,
      propsFloatPanel: propsFloatPanel ?? inherited?.propsFloatPanel,
      themeScope
    };
  }, [renderFloatPanel, renderPopupPanel, propsFloatPanel, themeScopeClass, themeSurface, themeMode, inherited]);

  // The float enclosing this provider (outer context), used to resolve the
  // effective root when not isolating.
  const inheritedFloat = useFloat();

  let tree: React.ReactElement = (
    <SurfaceContext.Provider value={surface}>
      {children}
    </SurfaceContext.Provider>
  );

  // A provider owns a root when it explicitly isolates, or when it sits at the
  // top of a tree (no inherited scope). Otherwise it inherits the enclosing root.
  // So every independent provider tree self-roots — no shared module singleton,
  // and two unrelated trees never cross-coordinate.
  const shouldOwnRoot = isolate || !inheritedFloat;
  const refRoot = useRef<FloatRoot>(null);
  if (shouldOwnRoot && refRoot.current === null)
    refRoot.current = createFloatRoot();
  const ownRoot = shouldOwnRoot ? refRoot.current : null;
  if (ownRoot) {
    tree = (
      <FloatStackProvider value={ownRoot}>
        {tree}
      </FloatStackProvider>
    );
  }

  // The root this provider's descendants coordinate under: the owned root when we
  // root, else the inherited one. Exactly one is always set, so never null.
  const effectiveRoot: FloatReference = (ownRoot ?? inheritedFloat)!.getRoot();

  // Expose it to an outside owner via `rootRef` (object or callback ref).
  useEffect(() => {
    if (!rootRef)
      return;
    if (typeof rootRef === 'function') {
      rootRef(effectiveRoot);
      return () => { rootRef(null); };
    }
    (rootRef as React.RefObject<FloatReference | null>).current = effectiveRoot;
    return () => { (rootRef as React.RefObject<FloatReference | null>).current = null; };
  }, [rootRef, effectiveRoot]);

  return tree;
};
