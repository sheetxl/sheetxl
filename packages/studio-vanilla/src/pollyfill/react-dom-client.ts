import { userConfig } from '../Config';

let reactDomClientInstance: any;

if (userConfig['react-dom/client']) {
  reactDomClientInstance = userConfig['react-dom/client'];
} else {
  // reactDomClientInstance = await import('https://unpkg.com/react-dom@19/esm/react-dom-client.production.min.js');
  reactDomClientInstance = await import('react-dom/client');
}

export const { createRoot } = reactDomClientInstance;
export default reactDomClientInstance;