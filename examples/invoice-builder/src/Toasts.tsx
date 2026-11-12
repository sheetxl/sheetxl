import { useMemo, useState, type ReactNode } from 'react';

import { ReactNotifierProvider, type IReactNotifier } from '@sheetxl/utils-react';

interface Toast { id: number; message: ReactNode; error: boolean }

let nextId = 0;

/**
 * Shows the messages SheetXL raises, such as "the cell is protected", as toasts.
 *
 * SheetXL shows nothing on its own: a notifier decides how messages look. This one implements only
 * `showMessage` and `showError`; everything it leaves out keeps its default.
 */
export function Toasts({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notifier = useMemo((): Partial<IReactNotifier> => {
    const show = (message: ReactNode, error: boolean): void => {
      const id = nextId++;
      setToasts(current => [...current, { id, message, error }]);
      setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), 4000);
    };
    return {
      showMessage: (message, options) => show(message, options?.type === 'error'),
      showError: (error) => show(error instanceof Error ? error.message : String(error), true)
    };
  }, []);

  return (
    <ReactNotifierProvider notifier={notifier}>
      {children}
      <div className="Toasts" role="status" aria-live="polite">
        {toasts.map(toast => (
          <div key={toast.id} className={toast.error ? 'Toast Toast-error' : 'Toast'}>{toast.message}</div>
        ))}
      </div>
    </ReactNotifierProvider>
  );
}
