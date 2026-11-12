import type React from 'react';
import { memo, forwardRef, Suspense, useEffect, useId, useMemo, useState } from 'react';

import clsx from 'clsx';

import { Box, Paper } from '@mui/material';

import { LicenseManager } from '@sheetxl/sdk';

import { defineLazyModule } from '@sheetxl/utils';
import {
  lazyComponent, RenderSlot, usePersistentState, useResolvedThemeMode, createThemeScopeClass, ThemeModeFallbackContext,
  type ThemeMode
} from '@sheetxl/utils-react';
import { LazyLoadErrorPanel } from '@sheetxl/utils-mui';

import { ThemeStateKey, ThemeStateDefaults } from '@sheetxl/react';

// private
import { defaultRenderWorkbookLoading } from '../workbook/DefaultRenderers';

import { type StudioProps, type IStudioElement } from './StudioProps';
import { splitStudioProps } from './splitStudioProps';

// Passed to EagerStudio so it does NOT render its own loading overlay: this wrapper owns the single
// startup panel (below). (EagerStudio's overlay is only for direct, non-lazy EagerStudio use.)

const EagerStudioModule = defineLazyModule('studio:eagerStudio', () => import('./EagerStudio'));

/** Shown when the studio itself fails to load. `onShown` lifts the startup panel covering it. */
const StudioLoadError: React.FC<{ error: unknown, onShown: () => void }> = ({ error, onShown }) => {
  useEffect(() => {
    onShown();
  }, []);
  return <LazyLoadErrorPanel error={error} />;
};

/**
 * Studio
 *
 * Fully featured workbook component.
 *  * controlled/uncontrolled workbook
 *  * snackbar
 *  * export/import to local file system
 *  * workbook title
 *  * Material-ui theme width light/dark toggle
 *  * lazy loading
 *
 * Demo:
 *
 * - [SheetXL](https://storybook.sheetxl.com/?path=/story/studio--workbook-studio)
 *
 * API:
 *
 * - [StudioProps](https://api.sheetxl.com/interfaces/_sheetxl_studio-mui.StudioProps.html)
 * - [IStudioElement](https://api.sheetxl.com/interfaces/_sheetxl_studio-mui.IStudioElement.html)
 */
const Studio = memo(forwardRef<IStudioElement, StudioProps>(
  (props: StudioProps, refForwarded: React.Ref<IStudioElement>) => {
  const {
    sx: propSx,
    style: propStyle,
    className: propClassName,
    licenseKey,
    renderDocumentLoading: propRenderLoading = defaultRenderWorkbookLoading,
    propsDocumentLoading: propsLoading,
    onRenderSettled: propOnRenderSettled,
    onDocumentError: propOnDocumentError,
    ...rest
  } = props;
  const [studioProps, elementProps] = splitStudioProps(rest);
  // During render, not in an effect: children's effects run first and must see the key. Once per key,
  // and a rejection is already reported by the license banner — not an unhandled error per render.
  useMemo(() => {
    if (licenseKey) LicenseManager.setLicenseKey(licenseKey).catch(() => {});
  }, [licenseKey]);

  // Dark-ness for the loading-panel background, from the self-managed mode preference (persisted mode
  // → media query fallback) — the same resolution EagerStudio uses, so the background matches before
  // the themes have loaded.
  const [persistedMode] = usePersistentState<ThemeMode | null>(ThemeStateKey.Mode, ThemeStateDefaults[ThemeStateKey.Mode]);
  const { themeMode } = useResolvedThemeMode({ mode: persistedMode ?? undefined, fallback: 'system' });
  const isDark = themeMode === 'dark';

  // The root element: rendered here, not by the lazy EagerStudio, so it exists from the first render
  // and holds the loading panel. `className` / `style` / `sx` and element attributes land on this one
  // element, as on a `div`. EagerStudio renders into it and decorates it with the studio handle.
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  // Per-instance `@scope` root for the studio's theme sheet (see EagerStudio).
  const scopeClass = createThemeScopeClass('studio', useId());

  // ONE startup loading panel, owned here and rendered as a sibling of EagerStudio on top (high zIndex) — NOT a
  // `Suspense` fallback. A fallback is torn down the moment the lazy chunk resolves (handing off to
  // EagerStudio's overlay), which flashes the UI before the workbook has loaded; a sibling is a single
  // continuous element instead. It covers the lazy chunk-load, the model-resolve, AND the grid
  // first-paint, and is removed only once the initial load SETTLES — the grid's first screen has
  // finished drawing and painted (onRenderSettled), the load fails (onDocumentError, so the error panel underneath becomes visible), or the studio
  // itself fails to load. EagerStudio's own overlay is suppressed (`null`) so there is exactly one
  // panel.
  const [settled, setSettled] = useState(false);
  const loadingPanel = useMemo(() => {
    if (!propRenderLoading || settled) return null;
    return (
      <Paper
        style={{
          backgroundColor: `var(--sxl-color-base-100, ${isDark ? '#121212' : '#fff'})`,
          // Anchor to the root, NOT the static position. An absolutely-positioned box with no
          // inset sits where it WOULD fall in normal flow — fine while the lazy EagerStudio is suspended
          // (nothing before it), but it drops BELOW the studio the instant EagerStudio mounts a full-height
          // sibling in front of it, jumping the cover down and adding a page scrollbar (studio 100% + cover
          // 100% = 200%). `inset: 0` pins it as a true overlay regardless of siblings.
          inset: 0,
          width: '100%',
          height: '100%',
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9900, // random high zIndex
        }}
      >
        <RenderSlot render={propRenderLoading} props={propsLoading ?? {}} />
      </Paper>
    );
  }, [propRenderLoading, propsLoading, isDark, settled]);

  const EagerStudio = useMemo(() => {
    return lazyComponent(EagerStudioModule.load, {
      renderError: ({ error }) => <StudioLoadError error={error} onShown={() => setSettled(true)} />
    });
  }, []);

  // Studio owns the whole surface, so with no preference set it follows the OS. Provided for the tree so
  // the workbook, sheets, charts and floats below — each resolving the mode on its own — agree with it.
  return (
    <ThemeModeFallbackContext.Provider value="system">
    <Box
      ref={setHost}
      className={clsx('sheetxl-studio', scopeClass, propClassName)}
      // The `app`-surface mode boundary: `data-sxl-theme-mode` selects which cells of the injected
      // matrix (see EagerStudio) resolve for the whole subtree; `color-scheme` rides it via the stylesheet.
      // The grid/header containers set `data-sxl-theme-surface` further down to pick their own cells.
      data-sxl-theme-mode={themeMode}
      sx={propSx}
      // Self-fill: grow to fill the parent whether it's a flex container (flex grow) or a plain
      // block with a definite size (width/height 100%). `flex: 1 1 100%` sets flex-basis, which
      // takes precedence over the width/height main-size in a flex parent, so the two don't
      // conflict / overflow. Identical contract to WorkbookElement / WorksheetElement. Clips so a
      // rounded root rounds the chrome too; floats portal out, so nothing is lost to the clip.
      style={{ display: 'flex', flexDirection: 'column', flex: '1 1 100%', width: '100%', height: '100%', minWidth: 0, minHeight: 0, position: 'relative', overflow: 'hidden', ...propStyle }}
      {...elementProps}
    >
      <Suspense fallback={null}>
        <EagerStudio
          {...studioProps}
          host={host}
          scopeClass={scopeClass}
          // Hide the startup panel once the load settles (drawn OR error), then forward to the
          // consumer's handler — which these overrides would otherwise swallow. `onRenderSettled`
          // comes after the studio's own load handshake (language, toolbar labels) and after the
          // paint, so the cover lifts onto an assembled studio in one step.
          onRenderSettled={(e) => {
            setSettled(true);
            propOnRenderSettled?.(e);
          }}
          onDocumentError={(error) => {
            setSettled(true);
            return propOnDocumentError?.(error);
          }}
          // Suppress EagerStudio's own overlay; this wrapper owns the single panel (above).
          renderDocumentLoading={null}
          ref={refForwarded}
        />
      </Suspense>
      {loadingPanel}
    </Box>
    </ThemeModeFallbackContext.Provider>
  );
}));


// export as both named and default
Studio.displayName = "Studio";
export default Studio;
export { Studio };
