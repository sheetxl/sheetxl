# Persistence State

Provides a storage agnostic api for storing state.

```ts Provider Example

// App entry (web, localStorage)
import { PersistentStateProvider, LocalStorageStore } from '@sheetxl/utils-react';

export default function AppRoot() {
  return (
    <PersistentStateProvider
      store={typeof window !== "undefined" ? new LocalStorageStore() : undefined}
      namespace="sheetxl"
      debounceMs={150}
    >
      <App />
    </PersistentStateProvider>
  );
}
```

``` tsx In a component
import { usePersistentState } from '@sheetxl/utils-react';

function ThemeToggle() {
  const [theme, setTheme, clearTheme] = usePersistentState<"light"|"dark"|"system">(
    "ui.theme" /* key */,
    "system" /* defaultValue */
  );

  return (
    <div>
      <select value={theme} onChange={(e) => setTheme(e.target.value as any)}>
        <option>light</option>
        <option>dark</option>
        <option>system</option>
      </select>
      <button onClick={clearTheme}>Reset</button>
    </div>
  );
}

```
