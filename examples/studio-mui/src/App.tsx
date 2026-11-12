import { type ThemeOptions } from '@mui/material';

import { LicenseManager } from '@sheetxl/sdk';

import { PersistentStateProvider, LocalStorageStore, VirtualKeyboardProvider } from '@sheetxl/utils-react';

import { linkPreviewMicrolink } from '@sheetxl/react';

import {
  Studio, useStudioApp, FileCommandButton, AppearanceCommandButton, setPrintExamplesOnLoad
} from '@sheetxl/studio-mui';

import { ScriptingPlugin } from '@sheetxl/scripting-mui';

import { OfflineSupport } from './pwa';

import './App.css';

/**
 * Google Analytics. This is optional and can be set to your own id or removed.
 */
// import ReactGA from 'react-ga4';

// // SheetXL Measure ID - To setup your own goto - https://analytics.google.com/
// ReactGA.initialize([{
//   trackingId: "G-1JGL700TV6",
//   gaOptions: {
//     content_group: 'demo_app',
//     cookies_flag: `Secure; Path=/; SameSite=None; Partitioned;`
//   }
// }]);

// // Let GA know that someone has visited this Demo
// ReactGA.send({ hitType: "pageview", page: "/", title: "View Demo" });

/**
 * Simple application to demonstrate how to use the workbook component. This should be copied and
 * modified to suit your needs.
 */
// LicenseManager.setLicenseKey('visit https://my.sheetxl.com to generate a license key.');
await LicenseManager.printBanner();
// Print examples in console if dev or eval
setPrintExamplesOnLoad(true);

// Scripting is an opt-in plugin (it pulls in a lazy load Monaco). Register it once before the Studio renders.
ScriptingPlugin();

// Provide a custom theme or override the default theme
const theme: ThemeOptions = {
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"', // Prioritize Segoe UI on windows
      'Roboto', // we font fallback
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
  },
};

const AppName="studio-mui";

function App() {
  // Single-call Studio app setup: resolves what to open (the `?source` URL query, else a blank
  // workbook) and wires the single-per-window app chrome — tab title (+ ● unsaved marker), close
  // prompt, browser keyboard guard — following the studio's live document across in-app opens.
  // With no `?source`, the welcome dialog offers a blank workbook, an open, or a template.
  const studioApp = useStudioApp({
    startWith: 'welcome',
    // The hyperlink card previews the linked page — its social card (picture + title) looked up
    // through microlink, a free service. Off in the Studio by default because it is a request to a
    // third party per hovered web link; `linkPreviewMShots` is a screenshot alternative.
    propsWorkbook: { propsSheet: { propsHyperlink: { preview: linkPreviewMicrolink } } }
  });

  return (
    <PersistentStateProvider
      store={typeof window !== "undefined" ? new LocalStorageStore() : undefined}
      namespace={AppName}
    >
      {/* On a phone, a tap on the grid keeps the keyboard up, as Excel does. */}
      <VirtualKeyboardProvider keepOnTap>
        <Studio
          {...studioApp}
          className="App"
          autoFocus
          square
          topLeft={<FileCommandButton/>}
          topRight={<AppearanceCommandButton/>}
          muiTheme={theme}
          style={{
            position: 'absolute'
          }}
        />
      </VirtualKeyboardProvider>
      <OfflineSupport/>
    </PersistentStateProvider>
  );
}

export default App;
