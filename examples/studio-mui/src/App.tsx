import React, { useEffect, useMemo } from 'react';
import './App.css';

import { useMediaQuery } from '@mui/material';
import { useLocalstorageState } from 'rooks';

import { useLocation } from 'react-use';

import { ThemeOptions } from '@mui/material/styles';

import { IWorkbook, LicenseManager } from '@sheetxl/sdk';

import { PersistenceStateProvider, LocalStorageStore } from '@sheetxl/utils-react';

import { ThemeMode, ThemeModeOptions } from '@sheetxl/utils-mui';

import type { ReadWorkbookOptions } from '@sheetxl/io';
import {
  Studio, setPrintExamplesOnLoad
} from '@sheetxl/studio-mui';

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
setPrintExamplesOnLoad(true); // Print examples in console if dev or eval

// Provide a custom theme or override the default theme
const theme:ThemeOptions = {
  palette: {
    // text: {
    //   primary: 'rgba(255,0,0,1)',
    //   secondary: 'rgba(255,255,0,1)',
    //   icon: 'rgba(255,0,255,1)'
    // } as any, // ThemeOptions doesn't defined icon but it's a valid prop
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"', // Prioritize Segoe UI on windows
      'Roboto', // we font fallback
      // '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
  },
};

function App() {
  // Setup toggle of light/dark mode
  // const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  const [themeMode, setThemeMode] = useLocalstorageState<ThemeMode>("themeMode", null);
  const [enableDarkGrid, setEnabledDarkGrid] = useLocalstorageState<boolean>("enableDarkGrid", false); // Default to Excel behavior
  const [enableDarkImages, setEnableDarkImages] = useLocalstorageState<boolean>("enableDarkImages", false);
  const themeOptions:ThemeModeOptions = React.useMemo(() => {
    return {
      mode: themeMode,
      enableDarkGrid,
      theme,
      enableDarkImages: enableDarkImages === null ? enableDarkGrid : enableDarkImages,
      // defaultMode: prefersDark ? ThemeMode.Dark : ThemeMode.Light,
      /* If there are no event handlers then by default the toggle light/dark menu will be removed */
      onModeChange: (mode: ThemeMode | null) => setThemeMode(mode),
      onEnabledDarkGridChange: (allow: boolean) => setEnabledDarkGrid(allow),
      onEnabledDarkImagesChange: (force: boolean) => setEnableDarkImages(force)
    }
  }, [themeMode, enableDarkGrid, enableDarkImages]);

  // const observer = new PerformanceObserver((list, obj) => {
  //   list.getEntries().forEach((entry) => {
  //     // Process "measure" events
  //     // …
  //     // Disable additional performance events
  //     observer.disconnect();
  //   });
  // });
  // observer.observe({ entryTypes: ["mark", "measure"] });
  // Example to override PerformanceObserver
  // try {
  //   if (window.PerformanceObserver) {
  //     (window as any).PerformanceObserver = function () {
  //       return {
  //         observe: () => {},
  //         disconnect: () => {},
  //       };
  //     };
  //   }
  // } catch (error: any) {
  //   console.error(error);
  // }

  /**
   * Prevent some browser level keystrokes from doing anything.
   */
  useEffect(() => {
    // const originalFocusHandler = document.body.onfocus;
    const originalKeyDownHandler = document.body.onkeydown;
    const originalKeyUpHandler = document.body.onkeyup;

    const ignore_keys = ['o', 's', 'w', 'n', 't', 'm'];
    const handleKeyEvent = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'KeyK')) { // no keystrokes left!
        console.clear();
      }
      if (e.defaultPrevented) return;

      // preventDefault browser keystrokes. Many others that could be added
      if (e.altKey) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
        }
      } else if (e.ctrlKey) {
        if (ignore_keys.includes(e.key)) {
          e.preventDefault();
        }
      }
    }
    document.body.onkeydown = (e: KeyboardEvent) => {
      handleKeyEvent(e);
      (originalKeyDownHandler as any)?.(e);
    };
    document.body.onkeyup = (e: KeyboardEvent) => {
      handleKeyEvent(e);
      (originalKeyUpHandler as any)?.(e);
    };

    const unload = (_e: BeforeUnloadEvent) => {
      // TODO - prompt if unsaved changes
      return;
      // e.preventDefault();
      // /*
      //  * Note - This message is ignored by webkit browsers but is required to force the prompt.
      // */
      // const confirmationMessage = 'Are you sure you want to close?';
      // (e || window.event).returnValue = confirmationMessage;
      // return confirmationMessage;
    };

    window.addEventListener("beforeunload", unload);

    return () => {
      document.body.onkeydown = originalKeyDownHandler;
      document.body.onkeyup = originalKeyUpHandler;

      window.removeEventListener("beforeunload", unload)
    }
  }, []);

  // const [workbookResolved, setWorkbookResolved] = useState<IWorkbook>(null);
  // useModelListener<IWorkbook, IWorkbook.IListeners>(workbookResolved, {
  //   onSelectionChange: (source: IWorkbook) => {
  //     // console.log('Workbook Selection Changed', source?.getSelectedRanges().toString());
  //   }
  // });

  // Check the url for a fetch resource and a title.
  const state = useLocation();
  const workbookOptions = useMemo(() => {
    if (!state.search) {
      // we could create a workbook with custom options
      return null;
    }

    /// http://localhost:5173/?source=https://www.sheetxl.com/docs/examples/financial-calculators.xlsx&title=Testing
    const asOptions: ReadWorkbookOptions = {} as ReadWorkbookOptions;
    const searchParams = new URLSearchParams(state.search);
    const fetchUrl = searchParams.get('source');
    asOptions.source = fetchUrl;
    if (searchParams.get('title')) {
      asOptions.name = searchParams.get('title');
    }
    return asOptions;

    // hard coded example
    // return {
    //   readonly: true,
    //   source: {
    //     input: 'https://www.sheetxl.com/docs/examples/financial-calculators.xlsx',
    //   }
    // }
  }, [state?.search]);

  const isAppStandalone = useMediaQuery('(display-mode: standalone)');

  return (
    <PersistenceStateProvider
      store={typeof window !== "undefined" ? new LocalStorageStore() : undefined}
      namespace="studio-mui"
      debounceMs={150}
      crossTabSync={true}
    >
      <Studio
        className="App"
        autoFocus
        square={true}
        style={{
          position: 'absolute'
        }}
        // ref={(instance) => {
        //   console.log('Workbook Element ref called', instance);
        // }}
        workbook={workbookOptions}
        onWorkbookChange={(wb: IWorkbook) => {
          // do something interesting with the workbook
          // setWorkbookResolved(wb);
        }}
        // with background
        // renderLoading={() => (
        //   <div style={{
        //     width: '100%',
        //     height: '100%',
        //     display: 'flex',
        //     alignItems: 'center',
        //     justifyContent: 'center',
        //     background: 'pink'
        //   }}>
        //     <div>Loading workbook...</div>
        //   </div>
        // )}
        // renderLoading={() => (
        //   <div>Loading workbook...</div>
        // )}
        // update the tab
        onTitleChange={(title: string) => {
          if (isAppStandalone) {
            document.title = title;
          } else {
            const divider = '-';
            const index = document.title.lastIndexOf(divider);
            const appTitle = index === -1 ? document.title : document.title.substring(index + divider.length);
            document.title = title ? `${title} ${divider} ${appTitle}` : appTitle;
          }
        }}
        themeOptions={themeOptions}
      />
    </PersistenceStateProvider>
  );
}

export default App;
