import React, { memo, useLayoutEffect, useRef } from 'react';

import { SXL_THEME_LAYER_ORDER } from './buildThemeCSS';

const LAYER_ORDER_ID = 'sxl-theme-layer-order';

/**
 * Puts the `sxl-*` cascade-layer order statement first in `root` (the document's `<head>`, or a shadow
 * root), once per root.
 *
 * @remarks
 * Layer order is fixed by the first place each layer name appears in document order. A host's stylesheet
 * that writes `@layer sxl-overrides { … }` usually sits in `<head>` ahead of anything a component renders,
 * which would make `sxl-overrides` the lowest layer. Placing the statement before every other sheet keeps
 * `sxl-defaults` < `sxl-app` < `sxl-overrides` however the host's sheets are ordered.
 */
export const ensureThemeLayerOrder = (root: Document | ShadowRoot = document): void => {
  if (typeof document === 'undefined') return;
  if (root.getElementById(LAYER_ORDER_ID)) return;
  const style = document.createElement('style');
  style.id = LAYER_ORDER_ID;
  style.textContent = SXL_THEME_LAYER_ORDER;
  const parent = root instanceof Document ? root.head : root;
  parent.prepend(style);
};

export interface ThemeStyleProps {
  /** A layered theme sheet, e.g. from `buildThemeCSS({ layer })`. */
  css: string;
}

/**
 * Renders a layered theme stylesheet inline and makes sure the layer order is declared first in the
 * document or shadow root it lands in ({@link ensureThemeLayerOrder}).
 */
export const ThemeStyle = memo(({ css }: ThemeStyleProps) => {
  const ref = useRef<HTMLStyleElement>(null);
  useLayoutEffect(() => {
    const root = ref.current?.getRootNode();
    if (root instanceof Document || root instanceof ShadowRoot) ensureThemeLayerOrder(root);
  }, []);
  return <style ref={ref}>{css}</style>;
});
ThemeStyle.displayName = 'ThemeStyle';
