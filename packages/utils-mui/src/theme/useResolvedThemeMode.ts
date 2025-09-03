import { useEffect, useState } from 'react';

import { ThemeMode } from './Types';

type Source = 'prop' | 'class' | 'media';

interface UseThemeOptions {
  mode?: ThemeMode;// | 'auto'; // 'auto' falls back to class/media
}

export function useResolvedThemeMode(options?: UseThemeOptions): { themeMode: ThemeMode; source: Source } {
  const {
    mode: propMode,
  } = options || {};

  const [state, setState] = useState<{ themeMode: ThemeMode; source: Source }>(() => {
    if (propMode === 'light' || propMode === 'dark') {
      return { themeMode: propMode, source: 'prop' };
    }

    if (typeof document !== 'undefined') {
      const classMode = getThemeFromClass();
      if (classMode) return { themeMode: classMode, source: 'class' };
    }

    const mediaMode = getThemeFromMedia();
    return { themeMode: mediaMode, source: 'media' };
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
        const mediaMode = getThemeFromMedia();
        setState({ themeMode: mediaMode, source: 'media' });
      }
    };

    const observer = new MutationObserver(update);
    const targets = [document.documentElement, document.body].filter(Boolean);
    for (const el of targets) {
      observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);

    update();
    return () => {
      observer.disconnect();
      mq.removeEventListener('change', update);
    };
  }, [propMode]);

  return state;
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
