import type React from 'react';
import { Suspense } from 'react';

import { lazyComponent } from '@sheetxl/utils-react';

import { AnimatedLoadingPanel } from './AnimatedLoadingPanel';
import { LazyLoadErrorPanel } from './LazyLoadErrorPanel';

/**
 * Creates a lazily loaded panel component: a loading panel while its module loads, and a
 * {@link LazyLoadErrorPanel} with a Retry button if the load fails.
 *
 * @param loader Loads a module whose default export is the panel component.
 *
 * @remarks
 * The panel carries its own `Suspense` boundary, so a host can render it like any other component.
 * Intended for content that is shown on demand (a task pane, a tab of a dialog), so that its code
 * is not part of the startup bundle.
 *
 * @example
 * ```tsx
 * const FormatTaskPane = lazyPanel(
 *   defineLazyModule('studio:formatTaskPane', () => import('./FormatTaskPane')).load
 * );
 * ```
 */
export function lazyPanel<C extends React.ComponentType<any>>(
  loader: () => Promise<{ default: C }>
): React.FC<React.ComponentProps<C>> {
  const Lazy = lazyComponent(loader, {
    renderError: ({ error }) => <LazyLoadErrorPanel error={error} />
  });
  const LazyPanel = (props: React.ComponentProps<C>): React.ReactElement => (
    <Suspense fallback={<AnimatedLoadingPanel/>}>
      <Lazy {...props} />
    </Suspense>
  );
  return LazyPanel;
}
