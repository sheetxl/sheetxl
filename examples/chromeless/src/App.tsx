import { LicenseManager } from '@sheetxl/sdk';

import {
  WorkbookElement, useWorkbookApp, setPrintExamplesOnLoad
} from '@sheetxl/react';

import './App.css';

/**
 * Chromeless example.
 *
 * Demonstrates how to host a chromeless `WorkbookElement`.
 */

// LicenseManager.setLicenseKey('visit https://my.sheetxl.com to generate a license key.');
await LicenseManager.printBanner();
// Print examples in console if dev or eval
setPrintExamplesOnLoad(true);

function App() {
  // Resolve the workbook (from the `?source` URL query, else a blank workbook) and wire the
  // single-per-window app chrome (tab title + ● unsaved marker, close prompt, browser keyboard
  // guard). WorkbookElement awaits the same promise — showing its loading/error panel as needed.
  const workbook = useWorkbookApp();

  return (
    <WorkbookElement
      className="App"
      autoFocus
      workbook={workbook}
      style={{ position: 'absolute' }}
    />
  );
}

export default App;
