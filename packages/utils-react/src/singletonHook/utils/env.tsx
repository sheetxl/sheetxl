import type React from 'react';
import { createRoot } from 'react-dom/client';
import { unstable_batchedUpdates } from 'react-dom';
import { warning } from './warning';

// `globalThis` (ES2020) is defined in every environment (avoids `window is not defined` under babel-node/SSR).
const globalObject: any = globalThis;

export const batch = (cb: () => void) => unstable_batchedUpdates(cb);
export const mount = (C: React.ComponentType<any>) => {
  if (globalObject.document && globalObject.document.createElement) {
    const container = globalObject.document.createElement('div');
    const root = createRoot(container);
    root.render(<C automaticContainerInternalUseOnly={true}/>);
  } else {
    warning('Can not mount SingletonHooksContainer on server side. '
      + 'Did you manage to run useEffect on server? '
      + 'Please mount SingletonHooksContainer into your components tree manually.');
  }
};
