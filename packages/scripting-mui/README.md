# SheetXL - Scripting-MUI

<p align="center">
  <a href="https://www.sheetxl.com" target="_blank">
    <img src="https://www.sheetxl.com/logo-text.svg" alt="SheetXL Logo" width="180" />
  </a>
</p>

MUI script workspace, toolbar, templates and the run-script command-bar plugin for
[SheetXL](https://www.sheetxl.com). Wraps the editor from `@sheetxl/scripting-react` with the studio
chrome and registers scripting as a task pane + command-bar contribution.

Register it explicitly during application startup:

```ts
import { ScriptingPlugin } from '@sheetxl/scripting-mui';

ScriptingPlugin();
```
