/**
 * @internal
 */
type ReactDOMRoot = import('react-dom/client').Root;

import type { ResolvedDependencies } from './_Types'; // Import the Runtime interface

import type { InitializationOptions, Attached } from './Types';
import { showLoadingPanel, showErrorPanel, hidePanel } from './Panels';

interface ReactInstance {
  root: ReactDOMRoot | null,
  runtime: ResolvedDependencies
}

// A map to keep track of attached instances for detachment and updates
const attachedInstances = new Map<string | HTMLElement, ReactInstance>();

export const doAttach = async <T=any, P=any>(
  runtime: ResolvedDependencies,
  options: string | InitializationOptions,
  elementType: string,
  props?: P
): Promise<T & Attached<P>> => {
  if (!options) {
    throw new Error(`Either a 'selector' or a 'InitializationOptions' must be provided to attach.`);
  }
  const selector = typeof options === 'string' ? options : options.selector || '#sheetxl';
  const rootElement = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!rootElement) {
    throw new Error(`Element with selector "${selector}" not found.`);
  }
  if (attachedInstances.has(selector) && attachedInstances.get(selector) !== null) {
    throw new Error(`SheetXL already attached to "${selector}". Detach first if you want to re-attach.`);
  }
  const asInitializationOptions = typeof options === 'object' ? options : null;
  // Show loading panel immediately
  showLoadingPanel(selector, asInitializationOptions?.loading);

  try {

    // Hide loading panel before rendering the actual component
    hidePanel(selector);

    // For React 18+
    const root = runtime.ReactDOMClient.createRoot(rootElement);
    const componentRef = runtime.React.createRef<any>();
    // this hides the elementType so treeshaking may remove it
    // we add a hardcoded reference in StaticResolver
    const element = runtime.StudioMUI[elementType];

    let originalApi: any = null;
    const refReadyPromise = new Promise<void>(resolve => {
      const callbackRef = (instance: any) => {
        if (instance) {
          originalApi = instance;
          resolve();
        }
      };
      root.render(runtime.React.createElement(element, { ...props, ref: callbackRef }));
    });
    await refReadyPromise;

    const instance: ReactInstance = {
      runtime,
      root
    };
    attachedInstances.set(selector, instance);
    let detached: boolean = false;
    // --- Create the Proxy Controller ---
    const controller = new Proxy(originalApi, {
      get(target, prop, receiver) {
        if (detached) {
          throw new Error(`SheetXL instance attached to "${selector}" has been detached. Cannot access properties.`);
        }
        // Intercept calls for your new vanilla methods
        if (prop === 'update') {
          return (newProps: T): Promise<void> => {
            // 1. Combine the original props with the new props.
            const combinedProps = { ...props, ...newProps, ref: componentRef };
            // 2. Call root.render with the raw React.createElement call.
            root.render(runtime.React.createElement(element, combinedProps));
            return Promise.resolve();
          };
        }
        if (prop === 'detach') {
          return (): Promise<void> => {
            attachedInstances.delete(selector);
            root.unmount();
            detached = true;
            return Promise.resolve();
          };
        }

        // For all other properties, forward the request to the original API
        return Reflect.get(target, prop, receiver);
      },
    });

    return controller as Promise<T & Attached<P>>;
  } catch (error) {
    // Hide loading panel and show error panel
    hidePanel(selector);
    showErrorPanel(selector, {
      message: `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`,
      ...asInitializationOptions?.error
    });
    console.error('Failed to initialize:', error);
    throw error;
  }
}

export const doInitialize = async (runtime: ResolvedDependencies, options: string | InitializationOptions): Promise<ResolvedDependencies> => {
  if (typeof options === 'string') {
    options = { selector: options };
  }
  try {
    if (options?.selector) {
      showLoadingPanel(options?.selector, options?.loading);
    }
    if (!runtime) {
      throw new Error('No runtime provided');
    }
    if (options?.licenseKey) {
      await runtime.StudioMUI.LicenseManager.setLicenseKey(options.licenseKey);
    }
    if (options?.selector) {
      hidePanel(options?.selector);
    }
  } catch (error) {
    if (options?.selector) {
      hidePanel(options.selector);
      showErrorPanel(options.selector, {
        message: `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`,
        ...options?.error
      });
    }
    console.error('Failed to initialize:', error);
    throw error;
  }
  return runtime;
}