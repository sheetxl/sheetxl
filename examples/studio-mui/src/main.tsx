import React from 'react';

import * as ReactDOMClient from 'react-dom/client';

import { addResourceRoot } from '@sheetxl/utils';

import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// If Roboto is desired, run install
// pnpm install @fontsource/roboto,

// and uncomment the following lines
// import '@fontsource/roboto/300.css'; // Light
// import '@fontsource/roboto/400.css'; // Regular
// import '@fontsource/roboto/500.css'; // Medium
// import '@fontsource/roboto/700.css'; // Bold

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

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();