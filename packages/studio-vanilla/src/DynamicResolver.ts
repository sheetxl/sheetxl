import { type Dependencies } from './Types';

import { ResolvedDependencies } from './_Types'; // Import the Runtime interface

// A single, module-level variable to hold the promise for our dependencies.
// It starts as null.
let dependenciesPromise: Promise<ResolvedDependencies> | null = null;

const DefaultReactUrls19 = {
  reactUrl: 'https://esm.sh/react@19.1.0',
  reactJsxTransform: "https://esm.sh/react@19.1.0/jsx-runtime",
  reactDomUrl: "https://esm.sh/react-dom@19.1.0",
  reactDomUrlClient: "https://esm.sh/react-dom@19.1.0/client"
}

/**
 * This function is now the single source of truth for loading dependencies.
 * It's lazy: it only does the work the first time it's called.
 */
export const resolveDependencies = (dependencies?: Dependencies): Promise<ResolvedDependencies> => {
  dependencies = {
    ...dependencies,
    ...DefaultReactUrls19
  }

  // If the promise already exists, just return it.
  // It might be pending or already resolved, but the caller can just `await` it.
  if (dependenciesPromise) {
    return dependenciesPromise;
  }

  // console.log('SheetXL: Resolving dependencies with:', dependencies);
  // If it's the first call, create the promise.
  dependenciesPromise = (async () => {
    // TODO: Add your "if (globalThis.React)" logic here later to change this URL.

    const reactUrl = dependencies.reactUrl;
    const reactDomUrl = dependencies.reactDomUrl;
    const reactDomUrlClient = dependencies.reactDomUrlClient;
    const reactJsxTransform = dependencies.reactJsxTransform;

    // Create and inject the import map.
    if (!document.querySelector('script[type="importmap"]')) {
      const importMapScript = document.createElement('script');
      importMapScript.type = 'importmap';
      importMapScript.textContent = JSON.stringify({
        imports: {
          "react": reactUrl,
          "react/jsx-runtime": reactJsxTransform,
          "react-dom": reactDomUrl,
          "react-dom/client": reactDomUrlClient
        }
      });
      document.head.appendChild(importMapScript);
      // console.log('SheetXL: Import map injected2:', importMapScript.textContent);
    } else {
      // TODO -if there is a  script[type="importmap"] then we should check if the imports are already there
      console.warn('SheetXL: Import map already exists. Skipping injection.');
    }

    // *** FIX FOR THE RACE CONDITION ***
    // We must yield to the browser's event loop for a moment to allow it
    // to process the newly injected import map before we try to use it.
    // A timeout of 0ms is a standard way to do this.
    await new Promise(resolve => setTimeout(resolve, 0));

    // Now, load all dependencies in a single, combined Promise.all
    // TODO - don't load react/jsx-runtime and react-dom/client as separate modules
    const asArray = await Promise.all([
      import('react'),
      import('react/jsx-runtime'),
      import('react-dom'),
      import('react-dom/client'),
      import('@sheetxl/studio-mui'),
    ]);
    // console.log('SheetXL: Dependencies resolved:', asArray);
    return {
      React: asArray[0],
      ReactJSXTransform: asArray[1],
      ReactDOM: asArray[2],
      ReactDOMClient: asArray[3],
      StudioMUI: asArray[4],
    }
  })();

  return dependenciesPromise;
};