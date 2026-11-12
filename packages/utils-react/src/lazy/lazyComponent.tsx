import type React from 'react';
import { createContext, lazy, useCallback, useContext, useState } from 'react';

/**
 * Options for {@link lazyComponent}.
 */
export interface LazyComponentOptions<P> {
  /**
   * Rendered in place of the component when its module fails to load.
   *
   * @remarks
   * When omitted, the error is thrown to the nearest error boundary.
   * Call {@link useLazyRetry} from inside the rendered content to try again.
   */
  renderError?: (props: LazyErrorRenderProps<P>) => React.ReactNode;
}

/** What {@link LazyComponentOptions.renderError} is handed. */
export interface LazyErrorRenderProps<P> {
  /** Why the load failed. */
  error: unknown;
  /** The props the lazy component was rendered with. */
  props: P;
}

const LazyRetryContext = createContext<(() => void) | null>(null);

/**
 * Returns a function that retries loading the nearest {@link lazyComponent}, or `null` when there
 * is none.
 *
 * @remarks
 * Intended for the content rendered by {@link LazyComponentOptions.renderError}.
 */
export function useLazyRetry(): (() => void) | null {
  return useContext(LazyRetryContext);
}

/**
 * Like `React.lazy`, but a module that fails to load is not a permanent failure.
 *
 * @param loader Loads a module whose default export is the component.
 * @param options How a failure is rendered.
 *
 * @remarks
 * A mounted instance keeps showing the failure until {@link useLazyRetry} is called. A new mount
 * after a failure loads the module again. Render inside a `Suspense` boundary, as with `React.lazy`.
 *
 * @example
 * ```tsx
 * const CustomColorPanel = lazyComponent(() => import('./CustomColorPanel'), {
 *   renderError: ({ error }) => <LoadError error={error} />
 * });
 * ```
 */
export function lazyComponent<C extends React.ComponentType<any>>(
  loader: () => Promise<{ default: C }>,
  options?: LazyComponentOptions<React.ComponentProps<C>>
): React.FC<React.ComponentProps<C>> {
  type P = React.ComponentProps<C>;
  const renderError = options?.renderError;

  interface Attempt {
    readonly component: React.LazyExoticComponent<React.ComponentType<P>>;
    /** The module failed to load. */
    failed: boolean;
    /** The failure has been rendered, so the next mount loads again instead of showing it. */
    shown: boolean;
  }

  let current: Attempt | null = null;

  const create = (): Attempt => {
    const attempt: Attempt = {
      failed: false,
      shown: false,
      component: lazy(async () => {
        try {
          return await loader() as { default: React.ComponentType<P> };
        } catch (error: unknown) {
          attempt.failed = true;
          // Resolve to a component that reports the failure rather than rejecting. React mounts a
          // component that suspended on its first render again, and that mount must reach this
          // attempt's failure instead of starting another load; rendering it marks it shown.
          const LoadFailed = (props: P): React.ReactNode => {
            attempt.shown = true;
            if (!renderError) throw error;
            return renderError({ error, props });
          };
          return { default: LoadFailed };
        }
      })
    };
    return attempt;
  };

  const acquire = (): React.LazyExoticComponent<React.ComponentType<P>> => {
    if (!current || (current.failed && current.shown)) current = create();
    return current.component;
  };

  const LazyComponent = (props: P): React.ReactElement => {
    const [Component, setComponent] = useState(acquire);
    const retry = useCallback((): void => {
      setComponent(() => {
        if (!current || current.failed) current = create();
        return current.component;
      });
    }, []);
    return (
      <LazyRetryContext.Provider value={retry}>
        <Component {...props} />
      </LazyRetryContext.Provider>
    );
  };
  return LazyComponent;
}
