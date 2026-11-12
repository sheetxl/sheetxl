import type React from 'react';
import { createContext, useContext, useEffect, Suspense } from 'react';

import { lazyComponent } from '@sheetxl/utils-react';

/**
 * Props added to a modal created with {@link lazyModal}.
 */
export interface LazyModalProps {
  /**
   * Called when the modal's module fails to load. Nothing is rendered; the host should dismiss the
   * modal and report the error.
   */
  onLoadError?: (error: unknown) => void;
}

const LoadErrorContext = createContext<((error: unknown) => void) | undefined>(undefined);

const ReportLoadError = ({ error }: { error: unknown }): null => {
  const onLoadError = useContext(LoadErrorContext);
  useEffect(() => {
    onLoadError?.(error);
  }, [error]);
  return null;
};

/**
 * Creates a lazily loaded modal component that reports a failed load through `onLoadError`
 * instead of throwing.
 *
 * @param loader Loads a module whose default export is the modal component.
 *
 * @remarks
 * Modal hosts such as `mui-modal-provider` render outside any error boundary, so a lazy modal must
 * not throw. Opening the modal again after a failure loads the module again.
 */
export function lazyModal<C extends React.ComponentType<any>>(
  loader: () => Promise<{ default: C }>
): React.FC<React.ComponentProps<C> & LazyModalProps> {
  const Lazy = lazyComponent(loader, {
    renderError: ({ error }) => <ReportLoadError error={error} />
  });
  const LazyModal = (props: React.ComponentProps<C> & LazyModalProps): React.ReactElement => {
    const { onLoadError, ...rest } = props;
    // Own boundary: the provider wraps every modal in one shared Suspense, so a loading modal would
    // otherwise hide its mounted siblings and re-run their layout effects when it resolves.
    return (
      <LoadErrorContext.Provider value={onLoadError}>
        <Suspense fallback={null}>
          <Lazy {...(rest as React.ComponentProps<C>)} />
        </Suspense>
      </LoadErrorContext.Provider>
    );
  };
  return LazyModal;
}
