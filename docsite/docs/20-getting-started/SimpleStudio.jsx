import { Studio } from '@sheetxl/studio-mui';

/**
 * This example is a complete React app that adds Studio to the
 * the default App div.
 *
 * To see an example that runs as a standalone application and includes page level
 * concerns. (light/dark Mode, tab title, pwa, etc)
 * visit: https://github.com/sheetxl/sheetxl/tree/main/examples/studio-mui
 *
 */
export default function App() {
  /* Add the standalone widget to a div. The className is not required. */
  return (
    <div className="App">
      <Studio />
    </div>
  );
}