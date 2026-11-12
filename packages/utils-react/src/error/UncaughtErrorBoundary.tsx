import type React from 'react';
import { useEffect } from 'react';

import { ExpectedError } from '@sheetxl/utils';

import { useNotifier } from '../hooks';

/**
 * Script URLs of browser extensions. Extensions inject code into every page (React DevTools,
 * password managers, grammar checkers), and their failures reach the page's global error handlers
 * but are nothing the app did or the user can act on.
 */
const EXTENSION_URL = /\b(?:chrome|moz|safari-web|ms-browser)-extension:\/\//;

/**
 * React DevTools' injected backend. Its stack frames do not always carry the extension URL (the
 * backend is evaluated from a hook script), so it is also recognized by name.
 */
const DEVTOOLS_SCRIPT = /\breact_devtools_backend/;

function isFromExtension(filename: string | undefined, error: unknown): boolean {
  const stack = error instanceof Error ? error.stack ?? '' : '';
  const source = `${filename ?? ''}\n${stack}`;
  return EXTENSION_URL.test(source) || DEVTOOLS_SCRIPT.test(source);
}

class GlobalErrorHandler {
  private notifier: any;
  private handleUnhandledRejection: (event: PromiseRejectionEvent) => void;
  private handleGlobalError: (event: ErrorEvent) => void;

  constructor(notifier: any) {
    this.notifier = notifier;

    // Store bound functions so we can remove them later
    this.handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason instanceof Error
          && reason.message
          && reason.message.startsWith('Maximum update depth exceeded')) {
        // Handle Maximum update depth exceeded specifically
        console.warn(reason);
        return;
      }
      if (reason instanceof DOMException && reason.name === 'AbortError') { // storybook is giving these errors
        // Handle AbortError specifically
        return;
      }
      if (isFromExtension(undefined, reason)) return;
      this.notifier.showError(reason);
      if (reason instanceof ExpectedError) {
        event.preventDefault(); // Prevent default browser error handling, mostly print stack to console
      }
    };

    this.handleGlobalError = (event: ErrorEvent) => {
      // "ResizeObserver loop completed with undelivered notifications" is a
      // benign, non-actionable browser warning (the observer simply deferred a
      // batch to the next frame). It carries no `error` object and can fire in
      // bursts (e.g. while a floating panel settles), so surfacing it as an
      // error toast just floods the snackbar queue.
      if (typeof event.message === 'string' && event.message.includes('ResizeObserver loop')) {
        return;
      }
      // Still logged by the browser; just not ours to put in front of the user.
      if (isFromExtension(event.filename, event.error)) return;
      this.notifier.showError(event.error ?? event.message);
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