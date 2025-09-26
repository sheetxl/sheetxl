import React, { useEffect } from 'react';

import { useNotifier } from '../../hooks';

class GlobalErrorHandler {
  private notifier: any;
  private handleUnhandledRejection: (event: PromiseRejectionEvent) => void;
  private handleGlobalError: (event: ErrorEvent) => void;

  constructor(notifier: any) {
    this.notifier = notifier;

    // Store bound functions so we can remove them later
    this.handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason instanceof DOMException && reason.name === 'AbortError') { // storybook is giving these errors
        // Handle AbortError specifically
        return;
      }
      this.notifier.showError(reason);
      // event.preventDefault(); // Prevent default browser error handling
    };

    this.handleGlobalError = (event: ErrorEvent) => {
      this.notifier.showError(event.error);
    };

    this.setupGlobalHandlers();
  }

  private setupGlobalHandlers() {
    // Add event listeners
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    window.addEventListener('error', this.handleGlobalError);
  }

  public cleanup() {
    // Remove event listeners
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    window.removeEventListener('error', this.handleGlobalError);
  }
}

// In your app initialization
export const UncaughtErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const notifier = useNotifier();

  useEffect(() => {
    const globalHandler = new GlobalErrorHandler(notifier);
    return () => {
      // Cleanup - remove event listeners
      globalHandler.cleanup();
    };
  }, [notifier]);

  return <>{children}</>;
};