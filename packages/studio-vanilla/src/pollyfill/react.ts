import { userConfig } from '../Config';

let reactInstance: any;

// If the user provided their own instance, use it.
if (userConfig.react) {
  reactInstance = userConfig.react;
} else {
  // Otherwise, dynamically load it from a CDN.
  // The `await` here works because of top-level await in modern ESM.

  // In src/ambient.d.ts
  // Add this for type safety
// declare module 'https://esm.sh/react@19.1.0' {
//   export * from 'react';
//   export { default } from 'react';
// }

  // const reactUrl = 'https://esm.sh/react@19.1.0';
  // reactInstance = await import(/* @vite-ignore */ /* webpackIgnore: true */ reactUrl);
}

// Export all named exports and the default export from the resolved instance.
export const {
  useState,
  useEffect,
  useRef,
  // ... all other React exports you might need
} = reactInstance;

export default reactInstance;