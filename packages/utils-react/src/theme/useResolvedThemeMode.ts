import { createContext, useContext, useEffect, useState } from 'react';

import { type ThemeMode } from './TokenTheme';

type Source = 'prop' | 'class' | 'media' | 'fallback';

/**
 * What {@link useResolvedThemeMode} uses when neither an explicit mode nor a `dark`/`light` class on
 * `<html>`/`<body>` decides: `'system'` follows `prefers-color-scheme`; a {@link ThemeMode} is used as is.
 */
export type ThemeModeFallback = 'system' | ThemeMode;

/**
 * The {@link ThemeModeFallback} for every {@link useResolvedThemeMode} below it that does not pass its own.
 *
 * @remarks
 * Defaults to `'light'`: a component embedded in a page cannot know whether the page follows the OS, and
 * most pages are light, so it stays light unless the host says otherwise. An app shell that owns the whole
 * surface (Studio) provides `'system'`. Provided once per tree so every layer that resolves the mode
 * independently (workbook, sheet, charts, floats) agrees.
 */
export const ThemeModeFallbackContext = createContext<ThemeModeFallback>('light');

interface UseThemeOptions {
  /**
   * An explicit mode. `'auto'` follows the page: a `dark`/`light` class on `<html>`/`<body>`, else the OS
   * (`prefers-color-scheme`), whatever the {@link ThemeModeFallbackContext} says.
   */
  mode?: ThemeMode | 'auto';
  /** Overrides {@link ThemeModeFallbackContext} for this call. Ignored when `mode` is `'auto'`. */
  fallback?: ThemeModeFallback;
}

/**
 * Resolves the effective light/dark mode from (in priority order) an explicit `mode`, a `dark`/`light`
 * class on `<html>`/`<body>`, then the {@link ThemeModeFallback} (`prefers-color-scheme` when `'system'`).
 * Framework-neutral (DOM only) — lives here so both the neutral `@sheetxl/react` layer and the MUI studio
 * resolve the SAME preference the same way (no drift). Re-resolves on class mutations (and media changes
 * when following the system) when no explicit `mode` is given.
 */
export function useResolvedThemeMode(options?: UseThemeOptions): { themeMode: ThemeMode; source: Source } {
  const {
    mode: requestedMode,
    fallback: propFallback,
  } = options || {};
  const contextFallback = useContext(ThemeModeFallbackContext);
  const auto = requestedMode === 'auto';
  const propMode: ThemeMode | undefined = auto ? undefined : requestedMode;
  const fallback: ThemeModeFallback = auto ? 'system' : (propFallback ?? contextFallback);

  const [state, setState] = useState<{ themeMode: ThemeMode; source: Source }>(() => {
    if (propMode === 'light' || propMode === 'dark') {
      return { themeMode: propMode, source: 'prop' };
    }

    if (typeof document !== 'undefined') {
      const classMode = getThemeFromClass();
      if (classMode) return { themeMode: classMode, source: 'class' };
    }

    return resolveFallback(fallback);
  });

  useEffect(() => {
    // no propMode specified, so we listen to class and media changes
    const update = () => {
      if (propMode) {
        if (propMode !== state.themeMode || state.source !== 'prop') {
          setState((prev) => ({
            ...prev,
            themeMode: propMode,
            source: 'prop',
          }));
        }
        return;
      }
      const classMode = getThemeFromClass();
      if (classMode) {
        setState({ themeMode: classMode, source: 'class' });
      } else {
        setState(resolveFallback(fallback));
      }
    };

    const observer = new MutationObserver(update);
    const targets = [document.documentElement, document.body].filter(Boolean);
    for (const el of targets) {
      observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    }

    const mq = fallback === 'system' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    mq?.addEventListener('change', update);

    update();
    return () => {
      observer.disconnect();
      mq?.removeEventListener('change', update);
    };
  }, [propMode, fallback]);

  return state;
}

function resolveFallback(fallback: ThemeModeFallback): { themeMode: ThemeMode; source: Source } {
  if (fallback === 'system') return { themeMode: getThemeFromMedia(), source: 'media' };
  return { themeMode: fallback, source: 'fallback' };
}

function getThemeFromClass(): ThemeMode | null {
  if (typeof document === 'undefined') return null;
  const bodyClasses = Array.from(document.body.classList);
  const docClasses = document.documentElement ? Array.from(document.documentElement.classList) : [];
  const classList = [...bodyClasses, ...docClasses];

  if (classList.includes('dark')) return 'dark';
  if (classList.includes('light')) return 'light';

  return null;
}

function getThemeFromMedia(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
