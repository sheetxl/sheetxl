import React from 'react';

import * as ReactDOMClient from 'react-dom/client';

import { addResourceRoot } from '@sheetxl/utils';

import './index.css';
import App from './App';

// Only English is bundled. Other languages (German today) ship as JSON files in each
// @sheetxl package's resources/ folder, which this monorepo's Vite ResourcesPlugin copies to
// resources/ beside the app at build time. Registering that URL lets the language menu find those
// packs and fetch one when it is picked. Remove this line and the app runs in English with no
// requests.
addResourceRoot(`${import.meta.env.BASE_URL}resources`);

const root = ReactDOMClient.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App/>
  </React.StrictMode>
);
