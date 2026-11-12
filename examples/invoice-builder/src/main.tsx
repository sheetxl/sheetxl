import React, { Suspense } from 'react';

import * as ReactDOMClient from 'react-dom/client';

import { addResourceRoot } from '@sheetxl/utils';

import './index.css';
import App from './App';
import { Toasts } from './Toasts';

// Language packs ship beside the app under resources/, which follows the deployed base path.
addResourceRoot(`${import.meta.env.BASE_URL}resources`);

const root = ReactDOMClient.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <Toasts>
      <Suspense>
        <App/>
      </Suspense>
    </Toasts>
  </React.StrictMode>
);
