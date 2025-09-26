import React, { useCallback, Component, ReactNode } from 'react';

import { useNotifier } from '../../hooks';

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {

  static getDerivedStateFromError(): ErrorBoundaryState {
    // React requires this method, so we implement it
    // But we'll ignore the state in render()
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    // Always render children regardless of hasError state
    // This prevents any flickering or UI interruption
    return this.props.children;
  }
}

// Wrapper with notification integration
export const ReactErrorBoundary: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const notifier = useNotifier();

  const handleError = useCallback((error: Error) => {
    notifier.showError(error);
  }, [notifier]);

  return (
    <ErrorBoundary
      onError={handleError}
    >
      {children}
    </ErrorBoundary>
  );
};