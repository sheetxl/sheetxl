import type React from 'react';
import { useCallback, Component } from 'react';

import { useNotifier } from '../hooks';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Rendered in place of the children while they are throwing. @defaultValue `null` */
  fallback?: React.ReactNode;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * A minimal error boundary that renders a **fallback** while its children throw, reports each distinct
 * error once, and recovers on the next legitimate re-render.
 *
 * @remarks
 * The important part is what it does NOT do: it does not re-render the throwing children. An error
 * boundary whose `render()` returns `this.props.children` even after catching will immediately re-mount
 * the subtree that just threw → it throws again → catch → render → throw … a synchronous infinite retry
 * that React surfaces as "Maximum update depth exceeded", burying the real error. Rendering a fallback
 * breaks that cycle so the true error is reported once and the UI stays responsive.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {

  state: ErrorBoundaryState = { error: null };

  // Last reported message — so a persistent error re-thrown after each recovery attempt notifies once.
  private _reportedMessage: string | null = null;

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    if (this._reportedMessage === error.message) return;
    this._reportedMessage = error.message;
    this.props.onError?.(error);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Recover: a changed `children` reference means the parent re-rendered (state changed, sheet
    // switched, …), so clear the error and let the fresh subtree try again. If it still throws we simply
    // fall back again — a retry at the parent's cadence, never a synchronous loop. Once we render cleanly
    // (no error) drop the dedupe so a genuinely new failure is reported.
    if (this.state.error && prevProps.children !== this.props.children) {
      this.setState({ error: null });
    } else if (!this.state.error && this._reportedMessage !== null) {
      this._reportedMessage = null;
    }
  }

  render(): React.ReactNode {
    if (this.state.error) return this.props.fallback ?? null;
    return this.props.children;
  }
}

// Wrapper with notification integration
export const ReactErrorBoundary: React.FC<{
  children: React.ReactNode;
  /** Rendered while the children are throwing. @defaultValue `null` */
  fallback?: React.ReactNode;
}> = ({ children, fallback }) => {
  const notifier = useNotifier();

  const handleError = useCallback((error: Error) => {
    notifier.showError(error);
  }, [notifier]);

  return (
    <ErrorBoundary
      fallback={fallback}
      onError={handleError}
    >
      {children}
    </ErrorBoundary>
  );
};
